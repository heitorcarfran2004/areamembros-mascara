import { NextRequest, NextResponse } from "next/server";
import {
  extractEmail,
  extractIsPaid,
  extractProductRefs,
  extractOrderRef,
} from "@/lib/webhook";
import {
  resolveProductRefs,
  grantAccess,
  logWebhookEvent,
} from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// URL de configuração nos gateways:
//   https://SEU-SITE/api/webhook/vega?token=SEU_WEBHOOK_SECRET
//   https://SEU-SITE/api/webhook/ggcheckout?token=SEU_WEBHOOK_SECRET
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ gateway: string }> }
) {
  const { gateway } = await ctx.params;
  const secret = process.env.WEBHOOK_SECRET || "";

  // 1) Lê o corpo cru UMA vez (precisamos do texto pra validar e pra parsear)
  const rawText = await req.text();

  // 2) Parseia (JSON; se vier form-urlencoded, converte)
  let payload: any = {};
  try {
    payload = JSON.parse(rawText);
  } catch {
    try {
      payload = Object.fromEntries(new URLSearchParams(rawText));
    } catch {
      payload = {};
    }
  }

  // 3) Validação do segredo. Vega: use ?token=SEU_SECRET na URL.
  //    GG: preencha o campo "Secret" com o mesmo valor (ele é enviado no
  //    header e/ou no corpo). Aceitamos o segredo em qualquer um desses lugares.
  const url = new URL(req.url);
  const headerBlob = Array.from(req.headers.values()).join(" ");
  const authorized =
    !!secret &&
    (url.searchParams.get("token") === secret ||
      headerBlob.includes(secret) ||
      rawText.includes(secret));

  if (!authorized) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  // 3) Extrai dados do payload (tolerante a formato)
  const email = extractEmail(payload);
  const { isPaid, status } = extractIsPaid(payload);
  const refs = extractProductRefs(payload);
  const orderRef = extractOrderRef(payload);

  let matchedProductIds: string[] = [];
  let unmatched: string[] = refs;
  let ok = true;

  try {
    // 4) Só libera se estiver paga e tiver email
    if (isPaid && email) {
      const resolved = await resolveProductRefs(gateway, refs);
      matchedProductIds = resolved.productIds;
      unmatched = resolved.unmatched;
      await grantAccess(email, matchedProductIds, gateway, orderRef);
    }
  } catch (e) {
    ok = false;
    console.error("[webhook] erro ao processar", e);
  }

  // 5) Sempre registra o evento cru (pra você ver os IDs reais e calibrar o mapa)
  try {
    await logWebhookEvent({
      gateway,
      email,
      status,
      isPaid,
      matchedProductIds,
      unmatchedExternalIds: unmatched,
      raw: payload,
      ok,
    });
  } catch (e) {
    console.error("[webhook] erro ao logar evento", e);
  }

  // 6) Responde 200 pro gateway (sempre, pra ele não ficar reenviando)
  return NextResponse.json({
    received: true,
    gateway,
    paid: isPaid,
    email_found: !!email,
    unlocked: matchedProductIds.length,
    unmatched_ids: unmatched,
  });
}

// GET simples pra você testar no navegador se a rota está de pé
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ gateway: string }> }
) {
  const { gateway } = await ctx.params;
  return NextResponse.json({ ok: true, gateway, hint: "use POST para enviar eventos" });
}
