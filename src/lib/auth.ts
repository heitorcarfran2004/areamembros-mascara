import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";

// ---------------------------------------------------------------------------
// Sessão por "email puro": a pessoa digita o email e entra.
// Para que o cookie não possa ser forjado no navegador, ele é ASSINADO com
// HMAC usando SESSION_SECRET. O cookie guarda:  email|assinatura
// (Isso NÃO substitui senha — qualquer um que saiba o email entra. Foi a
//  opção escolhida. Dá pra trocar por magic link depois sem refazer o resto.)
// ---------------------------------------------------------------------------

const COOKIE_NAME = "membro_sessao";
const MAX_AGE = 60 * 60 * 24 * 60; // 60 dias

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("Falta a variável SESSION_SECRET");
  return s;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function sign(email: string): string {
  return createHmac("sha256", secret()).update(email).digest("hex");
}

function makeToken(email: string): string {
  return `${email}|${sign(email)}`;
}

function readToken(token: string): string | null {
  const i = token.lastIndexOf("|");
  if (i < 0) return null;
  const email = token.slice(0, i);
  const sig = token.slice(i + 1);
  const expected = sign(email);
  // Comparação resistente a timing attacks
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return email;
}

export async function setSession(email: string): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE_NAME, makeToken(normalizeEmail(email)), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

// Retorna o email logado (validado pela assinatura) ou null.
export async function getSessionEmail(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return readToken(token);
}
