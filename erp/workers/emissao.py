"""
WORKER DE EMISSÃO — consome a outbox e emite as NFes.

Padrões demonstrados aqui (todos importantes num ERP fiscal de verdade):

  1. CLAIM concorrente:  SELECT ... FOR UPDATE SKIP LOCKED  -> vários workers
     em paralelo, cada um pega uma linha diferente, sem pisar um no outro.

  2. Numeração idempotente:  o número (nNF) e o cNF são reservados numa
     transação PRÓPRIA e reaproveitados em retries -> a CHAVE fica estável e
     não se "queima" numeração a cada falha.

  3. SEFAZ fora de transação:  a chamada de rede NÃO segura locks do banco.

  4. Máquina de estados:  pendente -> autorizada | rejeitada.

  5. Retry com backoff só para falhas TRANSITÓRIAS (SEFAZ fora do ar);
     rejeição de regra é terminal (retry não adianta).

  6. Reaper:  linhas presas em 'processando' (worker morreu no meio) voltam
     para a fila depois de um tempo.

  7. Ao autorizar, publica o evento 'nfe.autorizada' -> outros serviços reagem.
"""

import datetime
import json
import random
import sys
import time
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
except (AttributeError, ValueError):
    pass

# O worker usa o PROVIDER (serviço fiscal Python) que está na pasta ../provider.
import os  # noqa: E402
_ERP = Path(__file__).resolve().parent.parent          # pasta erp/
sys.path.insert(0, str(_ERP))                          # para 'shared'
sys.path.insert(0, str(_ERP.parent / "provider"))      # para 'nfe' (pacote fiscal)
from nfe.provider import ConfigNFe  # noqa: E402
from nfe.sefaz.fabrica import criar_provider  # noqa: E402
from shared.db import conectar  # noqa: E402
from shared.empresa import carregar_empresa  # noqa: E402

# --- parâmetros de retry ---------------------------------------------------- #
MAX_TENTATIVAS = 5
BACKOFF_SEG = 5            # backoff = BACKOFF_SEG * tentativa
REAP_SEGUNDOS = 60        # requeue de linhas presas em 'processando'

# Provider fiscal criado sob demanda com os dados do emitente (vindos do banco).
#   FISCAL_BACKEND=proprio (default) -> nosso provider | focus -> Focus NFe ("o botão")
_provider = None
def obter_provider(empresa: dict):
    global _provider
    if _provider is None:
        _provider = criar_provider(ConfigNFe(
            backend=os.environ.get("FISCAL_BACKEND", "proprio"),
            cnpj=empresa["CNPJ"], uf=empresa["UF"], ambiente=empresa.get("ambiente", "2"),
            modo="simulado", focus_token=os.environ.get("FOCUS_TOKEN", ""),
        ))
    return _provider


class TransitoriaError(Exception):
    """Falha temporária (ex.: SEFAZ fora do ar) — vale a pena tentar de novo."""


def log(msg: str):
    print(f"[{datetime.datetime.now():%H:%M:%S}] {msg}", flush=True)


def montar_dados(empresa, cliente, itens, serie, numero, cnf) -> dict:
    """Traduz venda -> estrutura que o provider.emitir() espera."""
    agora = datetime.datetime.now().astimezone().replace(microsecond=0)
    return {
        "ide": {
            "ano": agora.year, "mes": agora.month, "natOp": "VENDA DE MERCADORIA",
            "serie": str(serie), "nNF": str(numero), "dhEmi": agora.isoformat(),
            "tpAmb": empresa.get("ambiente", "2"), "cNF": cnf,  # cNF fixo -> CHAVE estável
        },
        "emit": empresa,   # emitente vindo do cadastro (banco)
        "dest": cliente,
        "itens": itens,
        "pagamento": {"tPag": "17"},
        "obs": "Emitida via worker de emissao (outbox).",
    }


def requeue_travados(conn):
    """Reaper: devolve à fila o que ficou preso em 'processando' (worker morto)."""
    with conn.transaction():
        n = conn.execute(
            "UPDATE outbox SET status='pendente', processando_desde=NULL "
            "WHERE status='processando' "
            "AND processando_desde < now() - (%s * interval '1 second')",
            (REAP_SEGUNDOS,),
        ).rowcount
    if n:
        log(f"reaper: {n} comando(s) preso(s) devolvido(s) à fila")


def processar_um(conn) -> bool:
    # ---- TX1: reivindica UMA linha da fila (SKIP LOCKED) ---------------- #
    with conn.transaction():
        row = conn.execute(
            "SELECT id, payload FROM outbox "
            "WHERE status='pendente' AND disponivel_em <= now() "
            "ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1"
        ).fetchone()
        if row is None:
            return False
        outbox_id, payload = row
        conn.execute(
            "UPDATE outbox SET status='processando', processando_desde=now() WHERE id=%s",
            (outbox_id,),
        )
    venda_id = payload["venda_id"]

    try:
        _processar(conn, outbox_id, venda_id)
    except TransitoriaError as e:
        # backoff: volta para 'pendente' (ou 'erro' após o limite)
        with conn.transaction():
            conn.execute(
                "UPDATE outbox SET "
                "  tentativas = tentativas + 1, "
                "  status = CASE WHEN tentativas + 1 >= %s THEN 'erro' ELSE 'pendente' END, "
                "  disponivel_em = now() + (%s * (tentativas + 1) * interval '1 second'), "
                "  processando_desde = NULL, ultimo_erro = %s "
                "WHERE id = %s",
                (MAX_TENTATIVAS, BACKOFF_SEG, str(e), outbox_id),
            )
        log(f"  ↻ transitória: {e} — reagendado com backoff")
    return True


def _processar(conn, outbox_id, venda_id):
    # ---- TX2: reserva número + cNF (idempotente por venda) ------------- #
    with conn.transaction():
        nota = conn.execute(
            "SELECT id, serie, numero, cnf, status, tentativas "
            "FROM notas_fiscais WHERE venda_id=%s", (venda_id,)
        ).fetchone()

        if nota and nota[4] == "autorizada":
            # já foi autorizada antes — idempotência: nada a refazer
            conn.execute("UPDATE outbox SET status='concluido', processando_desde=NULL WHERE id=%s", (outbox_id,))
            log(f"  = idempotente: venda {venda_id[:8]} já autorizada (nº {nota[2]})")
            return

        if nota is None:
            # ponto de CONTENÇÃO: alocação serializada da numeração
            numero = conn.execute(
                "UPDATE numeracao SET proximo_numero = proximo_numero + 1 "
                "WHERE serie = 1 RETURNING proximo_numero - 1"
            ).fetchone()[0]
            cnf = f"{random.randint(0, 99999999):08d}"
            nota_id = conn.execute(
                "INSERT INTO notas_fiscais (venda_id, serie, numero, cnf, status, tentativas) "
                "VALUES (%s, 1, %s, %s, 'pendente', 1) RETURNING id",
                (venda_id, numero, cnf),
            ).fetchone()[0]
            serie, tent = 1, 1
        else:
            nota_id, serie, numero, cnf, _st, tent = nota
            tent += 1
            conn.execute("UPDATE notas_fiscais SET tentativas=%s WHERE id=%s", (tent, nota_id))

        venda = conn.execute("SELECT cliente, itens, opcoes FROM vendas WHERE id=%s", (venda_id,)).fetchone()
    # >>> número já está DURAVELMENTE reservado; a chamada à SEFAZ é fora de tx <<<

    cliente, itens, opcoes = venda

    # demonstração de falha transitória (SEFAZ "fora do ar") nas 1as tentativas
    if opcoes.get("simular_falha") and tent <= 2:
        raise TransitoriaError(f"SEFAZ indisponível (simulado) — tentativa {tent}")

    # ---- chamada ao provider (contata a SEFAZ ou a Focus) -------------- #
    # ref = venda_id -> chave de idempotência (a Focus usa isso; no próprio, ignora).
    empresa = carregar_empresa(conn)                      # emitente do cadastro (banco)
    dados = montar_dados(empresa, cliente, itens, serie, numero, cnf)
    resultado = obter_provider(empresa).emitir(dados, ref=venda_id)

    # backend assíncrono (ex.: Focus "processando") -> reconsulta depois (retry)
    if resultado.pendente:
        raise TransitoriaError("autorização ainda em processamento (assíncrono)")

    # ---- TX3: grava o resultado + publica evento ---------------------- #
    with conn.transaction():
        if resultado.autorizada:
            conn.execute(
                "UPDATE notas_fiscais SET status='autorizada', chave=%s, cstat=%s, "
                "motivo=%s, nprot=%s, xml_autorizado=%s, atualizada_em=now() WHERE id=%s",
                (resultado.chave, resultado.cstat, resultado.xmotivo,
                 resultado.nprot, resultado.xml_autorizado, nota_id),
            )
            conn.execute(
                "INSERT INTO eventos (tipo, payload) VALUES ('nfe.autorizada', %s)",
                (json.dumps({"venda_id": venda_id, "nota_id": str(nota_id),
                             "numero": numero, "chave": resultado.chave}),),
            )
            conn.execute("UPDATE outbox SET status='concluido', processando_desde=NULL WHERE id=%s", (outbox_id,))
            conn.execute("NOTIFY evento_novo")
            log(f"  ✔ AUTORIZADA nº {numero}  chave …{resultado.chave[-6:]}  prot {resultado.nprot}")
        else:
            # rejeição de REGRA -> terminal (retry não resolveria)
            conn.execute(
                "UPDATE notas_fiscais SET status='rejeitada', cstat=%s, motivo=%s, atualizada_em=now() WHERE id=%s",
                (resultado.cstat, resultado.xmotivo, nota_id),
            )
            conn.execute("UPDATE outbox SET status='erro', processando_desde=NULL, ultimo_erro=%s WHERE id=%s",
                         (resultado.xmotivo, outbox_id))
            log(f"  ✘ REJEITADA nº {numero}: {resultado.cstat} - {resultado.xmotivo}")
            if resultado.erros_schema:
                for e in resultado.erros_schema[:2]:
                    log(f"      · {e}")

    # storage FORA da transação (best-effort): não segura locks durante upload
    if resultado.autorizada:
        _guardar_no_storage(conn, nota_id, resultado)


def _guardar_no_storage(conn, nota_id, resultado):
    """Gera o DANFE e sobe XML+DANFE ao MinIO. Falha aqui não derruba a emissão."""
    import tempfile, os as _os
    try:
        from nfe.danfe import gerar_danfe
        from shared.storage import guardar_documentos

        tmp = tempfile.mktemp(suffix=".pdf")
        gerar_danfe(resultado.xml_autorizado, tmp)
        danfe_bytes = open(tmp, "rb").read()
        _os.unlink(tmp)

        guardar_documentos(resultado.chave, resultado.xml_autorizado, danfe_bytes)
        with conn.transaction():
            conn.execute("UPDATE notas_fiscais SET armazenado=true WHERE id=%s", (nota_id,))
        log(f"    💾 XML+DANFE guardados no MinIO (…{resultado.chave[-6:]})")
    except Exception as e:
        log(f"    (storage adiado: {e})")


def main():
    conn = conectar()                     # conexão de trabalho (transações manuais)
    ouvinte = conectar(autocommit=True)   # conexão só para ouvir NOTIFY
    ouvinte.execute("LISTEN outbox_nova")
    log("worker de emissão pronto (aguardando comandos na outbox)…")

    while True:
        try:
            requeue_travados(conn)
            while processar_um(conn):      # drena tudo que estiver pendente
                pass
            # dorme até chegar um NOTIFY ou estourar o timeout (poll de segurança)
            for _ in ouvinte.notifies(timeout=3, stop_after=1):
                pass
        except KeyboardInterrupt:
            log("encerrando…")
            break
        except Exception as e:  # nunca deixa o worker morrer por um erro isolado
            log(f"ERRO inesperado no loop: {e!r}")
            time.sleep(2)


if __name__ == "__main__":
    main()
