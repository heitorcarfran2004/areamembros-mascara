import { NextRequest, NextResponse } from "next/server";
import { setSession, normalizeEmail } from "@/lib/auth";
import { memberExists, touchLogin } from "@/lib/data";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  let email = "";
  const ct = req.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    email = (await req.json())?.email ?? "";
  } else {
    const form = await req.formData();
    email = String(form.get("email") ?? "");
  }

  email = normalizeEmail(email);

  if (!EMAIL_RE.test(email)) {
    return NextResponse.redirect(new URL("/?erro=email", req.url), 303);
  }

  // Só deixa entrar quem já comprou (já é membro).
  const exists = await memberExists(email);
  if (!exists) {
    return NextResponse.redirect(new URL("/?erro=naocomprou", req.url), 303);
  }

  await setSession(email);
  await touchLogin(email);
  return NextResponse.redirect(new URL("/membros", req.url), 303);
}
