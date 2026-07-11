"""
Armazenamento dos documentos fiscais no MinIO (S3-compatível).

Por lei o XML autorizado deve ser guardado por 5 anos. Guardamos também o DANFE.
O MinIO é um servidor S3 self-hosted — em produção pode ser AWS S3, etc.

Chaves determinísticas (pela chave de acesso):
  nfe/<chave>.xml     -> XML autorizado (nfeProc)
  danfe/<chave>.pdf   -> DANFE

Config por env (defaults apontam para o MinIO de teste na 9010):
  MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, MINIO_BUCKET, MINIO_SECURE
"""

import io
import os
from minio import Minio

BUCKET = os.environ.get("MINIO_BUCKET", "nfe-docs")
_cliente: Minio | None = None


def cliente() -> Minio:
    global _cliente
    if _cliente is None:
        _cliente = Minio(
            os.environ.get("MINIO_ENDPOINT", "localhost:9010"),
            access_key=os.environ.get("MINIO_ACCESS_KEY", "erp"),
            secret_key=os.environ.get("MINIO_SECRET_KEY", "erp12345"),
            secure=os.environ.get("MINIO_SECURE", "false").lower() == "true",
        )
        if not _cliente.bucket_exists(BUCKET):
            _cliente.make_bucket(BUCKET)
    return _cliente


def _put(caminho: str, dados: bytes, content_type: str):
    c = cliente()
    c.put_object(BUCKET, caminho, io.BytesIO(dados), length=len(dados), content_type=content_type)


def guardar_documentos(chave: str, xml_bytes: bytes, danfe_bytes: bytes) -> dict:
    """Sobe XML + DANFE e retorna os caminhos (object keys)."""
    xml_key = f"nfe/{chave}.xml"
    danfe_key = f"danfe/{chave}.pdf"
    _put(xml_key, xml_bytes, "application/xml")
    _put(danfe_key, danfe_bytes, "application/pdf")
    return {"xml": xml_key, "danfe": danfe_key}
