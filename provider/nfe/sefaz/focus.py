"""
Backend "focus" — delega a emissão para a API da Focus NFe.

A grande diferença para o backend "proprio": aqui você NÃO monta XML, NÃO assina
e NÃO fala com a SEFAZ. Você manda um JSON para a Focus e ELA cuida de tudo
(o seu certificado A1 fica hospedado lá, enviado uma única vez no cadastro).

Repare que este adapter expõe EXATAMENTE os mesmos métodos do NFeProvider
(`emitir` e `status`) e devolve o mesmo `ResultadoEmissao`. Por isso trocar de um
para o outro é só mudar `config.backend` — o worker não muda nada. É "o botão".

Fluxo da Focus (REST):
  POST /v2/nfe?ref=<sua_referencia>   -> cria a nota (idempotente por `ref`)
  GET  /v2/nfe/<ref>                  -> consulta o status
Autenticação: HTTP Basic com o token como usuário (senha vazia).
Idempotância: se você repetir o mesmo `ref`, a Focus devolve a nota já existente.
Assíncrono: a resposta pode vir "processando_autorizacao"; aí consultamos depois.

Docs oficiais: https://focusnfe.com.br/doc/
"""

from __future__ import annotations

from ..provider import ConfigNFe, ResultadoEmissao


class ProviderFocus:
    def __init__(self, config: ConfigNFe):
        if not config.focus_token:
            raise ValueError("Focus: informe config.focus_token")
        self.config = config
        self.base = config.focus_url.rstrip("/")
        self.auth = (config.focus_token, "")  # token como usuário, senha vazia

    # -- API pública (mesma assinatura do NFeProvider) -------------------- #
    def status(self):
        """A Focus não tem 'status serviço' próprio; assumimos operante."""
        from .comunicador import RespostaStatus
        return RespostaStatus("107", "Servico em Operacao (via Focus)", em_operacao=True)

    def emitir(self, dados_venda: dict, ref: str | None = None) -> ResultadoEmissao:
        import requests

        if not ref:
            # a referência idempotente é OBRIGATÓRIA na Focus
            ref = f"nfe-{dados_venda['ide']['serie']}-{dados_venda['ide']['nNF']}"

        payload = self._para_json_focus(dados_venda)

        # POST cria (ou, se o ref já existe, a Focus responde a nota existente)
        resp = requests.post(
            f"{self.base}/v2/nfe",
            params={"ref": ref},
            auth=self.auth,
            json=payload,
            timeout=60,
        )
        # 422/400 = payload inválido (erro terminal); 2xx/202 = aceito p/ processar
        data = resp.json() if resp.content else {}
        return self._interpretar(data, ref)

    def consultar(self, ref: str) -> ResultadoEmissao:
        """Consulta o status de uma nota já enviada (para o retry assíncrono)."""
        import requests
        resp = requests.get(f"{self.base}/v2/nfe/{ref}", auth=self.auth, timeout=60)
        return self._interpretar(resp.json() if resp.content else {}, ref)

    # -- mapeamentos ------------------------------------------------------ #
    def _interpretar(self, data: dict, ref: str) -> ResultadoEmissao:
        """Traduz a resposta da Focus para o nosso ResultadoEmissao."""
        status = data.get("status", "")

        if status == "autorizado":
            xml = None
            caminho = data.get("caminho_xml_nota_fiscal")
            if caminho:
                import requests
                xml = requests.get(f"{self.base}{caminho}", auth=self.auth, timeout=60).content
            return ResultadoEmissao(
                autorizada=True,
                cstat=str(data.get("status_sefaz", "100")),
                xmotivo=data.get("mensagem_sefaz", "Autorizado o uso da NF-e"),
                chave=data.get("chave_nfe", ""),
                nprot=data.get("protocolo"),
                xml_autorizado=xml,
            )

        if status in ("processando_autorizacao", "em_processamento", ""):
            # ainda processando -> o worker vai reconsultar (retry)
            return ResultadoEmissao(
                autorizada=False, pendente=True,
                cstat="processando", xmotivo="Aguardando autorização na Focus/SEFAZ",
                chave=data.get("chave_nfe", ""),
            )

        # erro_autorizacao / rejeitado / etc. -> terminal
        return ResultadoEmissao(
            autorizada=False,
            cstat=str(data.get("status_sefaz", status or "erro")),
            xmotivo=data.get("mensagem_sefaz") or data.get("mensagem") or "Rejeitada pela Focus",
            chave=data.get("chave_nfe", ""),
        )

    def _para_json_focus(self, d: dict) -> dict:
        """
        Converte nossos `dados` para o JSON que a Focus espera. (Recorte dos
        campos principais; a Focus tem muitos campos opcionais — ver docs.)
        """
        ide, emit, dest, itens = d["ide"], d["emit"], d["dest"], d["itens"]
        doc = dest["doc"]
        payload = {
            "natureza_operacao": ide["natOp"],
            "data_emissao": ide["dhEmi"],
            "tipo_documento": ide.get("tpNF", "1"),   # 1=saída
            "finalidade_emissao": "1",
            "cnpj_emitente": emit["CNPJ"],
            # destinatário
            "nome_destinatario": dest["xNome"],
            ("cnpj_destinatario" if len(doc) == 14 else "cpf_destinatario"): doc,
            "logradouro_destinatario": dest["xLgr"],
            "numero_destinatario": dest["nro"],
            "bairro_destinatario": dest["xBairro"],
            "municipio_destinatario": dest["xMun"],
            "uf_destinatario": dest["UF"],
            "cep_destinatario": dest["CEP"],
            "indicador_inscricao_estadual_destinatario": dest.get("indIEDest", "9"),
            "items": [],
        }
        for i, it in enumerate(itens, start=1):
            payload["items"].append({
                "numero_item": i,
                "codigo_produto": it["cProd"],
                "descricao": it["xProd"],
                "codigo_ncm": it["NCM"],
                "cfop": it["CFOP"],
                "unidade_comercial": it["uCom"],
                "quantidade_comercial": it["qtd"],
                "valor_unitario_comercial": it["vUnit"],
                "valor_bruto": round(float(it["qtd"]) * float(it["vUnit"]), 2),
                "icms_origem": "0",
                "icms_situacao_tributaria": "102",   # Simples Nacional (CSOSN)
            })
        return payload
