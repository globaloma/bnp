// SKU variants: each colour/size is its own product row (SKU) with its own
// stock and barcode; rows that are variants of one product share group_id.

type VariantShape = { id: string; name: string; variant: string | null; group_id: string | null };

/** "Ankara Tote (Red)", or just the name when there's no variant. */
export function displayName(p: Pick<VariantShape, "name" | "variant">): string {
  return p.variant ? `${p.name} (${p.variant})` : p.name;
}

/** Groups SKUs into products, keeping the original order of first appearance. */
export function groupVariants<T extends VariantShape>(products: T[]): T[][] {
  const groups = new Map<string, T[]>();
  for (const p of products) {
    const key = p.group_id ?? p.id;
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  return [...groups.values()];
}
