/** Hash e verificação de senha com scrypt (sem dependência externa). */
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function hashSenha(senha: string): string {
  const salt = randomBytes(16).toString("hex");
  const h = scryptSync(senha, salt, 64).toString("hex");
  return `${salt}:${h}`;
}

export function conferirSenha(senha: string, armazenado: string): boolean {
  const [salt, h] = armazenado.split(":");
  if (!salt || !h) return false;
  const calc = scryptSync(senha, salt, 64);
  const orig = Buffer.from(h, "hex");
  return calc.length === orig.length && timingSafeEqual(calc, orig);
}
