import "server-only";
import { ALERT_FROM, sendAlertEmail } from "@/lib/notifications";
import { naira } from "@/lib/format";

// The order confirmation a storefront customer gets once Paystack confirms
// their payment. Sent from BNP's address but branded as the merchant, with
// replies going to the merchant, since that's who the customer bought from.

export type CustomerOrderLine = {
  order_ref: string;
  customer_name: string;
  customer_email: string | null;
  delivery_address: string | null;
  rider: string | null;
  location: string | null;
  product_id: string | null;
  product_name: string;
  quantity: number;
  total: number;
};

export type CustomerEmailMerchant = {
  business_name: string;
  email: string | null;
  phone: string | null;
  logo_url: string | null;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** "Ada's Shop via BNP Fulfillment <orders@...>" from ALERT_FROM's address. */
function fromAs(businessName: string): string {
  const address = ALERT_FROM.match(/<([^>]+)>/)?.[1] ?? ALERT_FROM;
  const name = businessName.replace(/[<>",]/g, "").trim() || "Your order";
  return `${name} via BNP Fulfillment <${address}>`;
}

export function buildCustomerOrderEmail(
  lines: CustomerOrderLine[],
  merchant: CustomerEmailMerchant,
): { subject: string; html: string } {
  const first = lines[0];
  const shop = escapeHtml(merchant.business_name);
  const items = lines.filter((l) => l.product_id);
  const delivery = lines.filter((l) => !l.product_id);
  const grandTotal = lines.reduce((sum, l) => sum + l.total, 0);
  const isPickup = first.rider === "Pickup";

  const row = (label: string, value: string, strong = false) =>
    `<tr><td style="padding:6px 12px 6px 0;color:#455568;font-size:14px;">${label}</td><td style="padding:6px 0;color:#0f2a44;font-size:14px;text-align:right;white-space:nowrap;${strong ? "font-weight:700;" : ""}">${value}</td></tr>`;

  const itemRows = items
    .map((l) => row(`${escapeHtml(l.product_name)} &times; ${l.quantity}`, naira(l.total)))
    .join("");
  const deliveryRows = delivery
    .map((l) => row(escapeHtml(l.product_name), naira(l.total)))
    .join("");

  const pickupFrom = [...new Set(items.map((l) => l.location).filter(Boolean))].join(" & ");
  const fulfilment = isPickup
    ? `<p style="margin:0;color:#0f2a44;font-size:14px;font-weight:600;">Pickup</p>
       <p style="margin:4px 0 0;color:#455568;font-size:14px;">${pickupFrom ? `From our ${escapeHtml(pickupFrom)} warehouse. ` : ""}We'll contact you when your order is ready to collect.</p>`
    : `<p style="margin:0;color:#0f2a44;font-size:14px;font-weight:600;">Delivering to</p>
       <p style="margin:4px 0 0;color:#455568;font-size:14px;">${escapeHtml(first.delivery_address ?? "")}</p>`;

  const contact = [
    merchant.phone ? `call ${escapeHtml(merchant.phone)}` : null,
    merchant.email ? "reply to this email" : null,
  ]
    .filter(Boolean)
    .join(" or ");

  const logo = merchant.logo_url
    ? `<img src="${escapeHtml(merchant.logo_url)}" alt="" width="48" height="48" style="display:block;width:48px;height:48px;border-radius:8px;object-fit:cover;margin:0 0 12px;" />`
    : "";

  const html = `
  <div style="background:#f8f5f0;padding:24px 12px;font-family:system-ui,Segoe UI,Helvetica,Arial,sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px;">
      ${logo}
      <p style="margin:0;color:#2e8b9a;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">${shop}</p>
      <h1 style="margin:6px 0 4px;color:#0f2a44;font-size:20px;">Thanks for your order, ${escapeHtml(first.customer_name.split(" ")[0] || first.customer_name)}!</h1>
      <p style="margin:0 0 20px;color:#455568;font-size:14px;">Your payment was successful and ${shop} is now preparing your order.</p>

      <div style="background:#f8f5f0;border-radius:8px;padding:12px 16px;margin:0 0 20px;">
        <p style="margin:0;color:#8a97a8;font-size:12px;">Order number</p>
        <p style="margin:2px 0 0;color:#0f2a44;font-size:16px;font-weight:700;letter-spacing:.02em;">${escapeHtml(first.order_ref)}</p>
      </div>

      <table style="border-collapse:collapse;width:100%;">
        ${itemRows}
        ${deliveryRows}
        <tr><td colspan="2" style="border-top:1px solid #eae4d8;padding:0;"></td></tr>
        ${row("Total paid", naira(grandTotal), true)}
      </table>

      <div style="margin:20px 0 0;">${fulfilment}</div>

      <p style="margin:24px 0 0;color:#455568;font-size:13px;">Questions about your order? ${contact ? `${contact.charAt(0).toUpperCase()}${contact.slice(1)}` : `Contact ${shop}`} and mention order <span style="white-space:nowrap;">${escapeHtml(first.order_ref)}</span>.</p>
    </div>
    <p style="max-width:560px;margin:12px auto 0;color:#8a97a8;font-size:11px;text-align:center;">Fulfilled by BNP Fulfillment on behalf of ${shop}.</p>
  </div>`;

  return {
    subject: `Order confirmed: ${first.order_ref} from ${merchant.business_name}`,
    html,
  };
}

export async function sendCustomerOrderEmail(
  lines: CustomerOrderLine[],
  merchant: CustomerEmailMerchant,
) {
  const to = lines[0]?.customer_email;
  if (!to) return;

  const { subject, html } = buildCustomerOrderEmail(lines, merchant);
  await sendAlertEmail({
    to: [to],
    subject,
    html,
    from: fromAs(merchant.business_name),
    replyTo: merchant.email ?? undefined,
  });
}
