import "server-only";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(pw, salt, 32);
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [algo, salt, hash] = stored.split("$");
  if (algo !== "scrypt" || !salt || !hash) return false;
  const got = await scryptAsync(pw, Buffer.from(salt, "base64url"), 32);
  return safeEqual(got.toString("base64url"), hash);
}

export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const normEmail = (v: unknown) => String(v ?? "").trim().toLowerCase().slice(0, 120);

/** Lỗi mật khẩu mới, hoặc null nếu hợp lệ. */
export function passwordProblem(pw: string, again?: string): string | null {
  if (pw.length < 8) return "Mật khẩu cần ít nhất 8 ký tự.";
  if (again !== undefined && pw !== again) return "Hai lần nhập mật khẩu không giống nhau.";
  return null;
}

/** Chờ một chút khi sai mật khẩu, để dò mật khẩu chậm lại. */
export const slow = () => new Promise((r) => setTimeout(r, 800));
