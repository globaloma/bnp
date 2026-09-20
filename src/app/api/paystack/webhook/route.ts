import { confirmPayment, verifyWebhookSignature } from "@/lib/paystack";

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-paystack-signature");

  if (!verifyWebhookSignature(rawBody, signature)) {
    return new Response("Invalid signature", { status: 401 });
  }

  let event: { event?: string; data?: { reference?: string } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid payload", { status: 400 });
  }

  if (event.event === "charge.success" && event.data?.reference) {
    const result = await confirmPayment(event.data.reference);
    if (!result.ok) {
      console.error("[paystack webhook] confirmPayment failed:", result.error);
    }
  }

  // Always 200 once the signature checks out - Paystack retries on non-2xx,
  // and an unrecognized/already-processed reference isn't a reason to retry.
  return new Response("ok", { status: 200 });
}
