export function naira(amount: number): string {
  return `₦${Math.round(amount).toLocaleString("en-NG")}`;
}

export function formatDate(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function daysSince(value: string | Date): number {
  const d = typeof value === "string" ? new Date(value) : value;
  return Math.floor((Date.now() - d.getTime()) / 86_400_000);
}

export function isToday(value: string | Date): boolean {
  const d = typeof value === "string" ? new Date(value) : value;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

/**
 * wa.me link for a Nigerian or international number. Local numbers
 * (0801 234 5678) become 2348012345678; numbers already starting with a
 * country code are kept as they are.
 */
export function whatsappLink(phone: string, text?: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0") && digits.length === 11) digits = `234${digits.slice(1)}`;
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
