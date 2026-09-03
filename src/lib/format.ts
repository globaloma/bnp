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
