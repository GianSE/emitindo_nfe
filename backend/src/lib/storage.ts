/**
 * Gera URLs assinadas (presigned) para o navegador baixar XML/DANFE do MinIO.
 * Os arquivos são SUBIDOS pelos workers Python; aqui só criamos os links.
 */
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const BUCKET = process.env.MINIO_BUCKET ?? "nfe-docs";

const s3 = new S3Client({
  endpoint: process.env.MINIO_ENDPOINT ?? "http://localhost:9010",
  region: "us-east-1",
  forcePathStyle: true, // exigido pelo MinIO
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY ?? "erp",
    secretAccessKey: process.env.MINIO_SECRET_KEY ?? "erp12345",
  },
});

export async function urlDownload(key: string, expiraSeg = 300): Promise<string> {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn: expiraSeg });
}
