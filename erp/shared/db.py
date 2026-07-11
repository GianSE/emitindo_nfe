"""Conexão com o Postgres. DSN vem de DATABASE_URL (ou default local)."""

import os
import psycopg

# Local (fora do Docker) usamos a porta 5433 mapeada; dentro do compose, 5432.
DSN = os.environ.get(
    "DATABASE_URL",
    "postgresql://erp:erp@localhost:5433/erp",
)


def conectar(autocommit: bool = False) -> psycopg.Connection:
    return psycopg.connect(DSN, autocommit=autocommit)
