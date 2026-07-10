# Imagem compartilhada pelos serviços do ERP (workers + CLI).
# O build context é a RAIZ do repositório (ver docker-compose.yml), porque
# precisamos copiar tanto ./erp quanto ./provider (o pacote fiscal `nfe`).
FROM python:3.12-slim

WORKDIR /app

# Dependências: as do provider (lxml, cryptography, signxml, nfelib, reportlab)
# + as do ERP (psycopg). Copiamos só os requirements primeiro p/ cache de camadas.
COPY provider/requirements.txt /app/provider/requirements.txt
COPY erp/requirements.txt /app/erp/requirements.txt
RUN pip install --no-cache-dir -r /app/provider/requirements.txt \
 && pip install --no-cache-dir -r /app/erp/requirements.txt

# Código
COPY provider /app/provider
COPY erp /app/erp

WORKDIR /app/erp
# comando default é sobrescrito por cada serviço no docker-compose
CMD ["python", "worker_emissao.py"]
