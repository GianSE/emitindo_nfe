"""
Fábrica de provider — "o botão".

O worker (e o ERP) chamam SEMPRE `criar_provider(config)` e usam `.emitir()`.
Trocar de backend é mudar UM campo na config (ou uma variável de ambiente):

    ConfigNFe(backend="proprio")   # nosso provider (XML + assinatura + SEFAZ)
    ConfigNFe(backend="focus", focus_token="...")   # delega para a Focus NFe

Como ambos expõem a MESMA interface (emitir/status -> ResultadoEmissao),
nada mais no sistema muda. É esse o ganho de ter feito por adapter.
"""

from ..provider import ConfigNFe, NFeProvider


def criar_provider(config: ConfigNFe):
    if config.backend == "proprio":
        return NFeProvider(config)
    if config.backend == "focus":
        from .focus import ProviderFocus   # import tardio: só carrega se usar
        return ProviderFocus(config)
    raise ValueError(f"backend desconhecido: {config.backend!r} (use 'proprio' ou 'focus')")
