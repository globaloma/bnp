/**
 * A curated rotation of accent colors for icon tiles across the marketing
 * site. Keeps grids of cards (services, hub points, stakeholder cards) from
 * reading as monotone while staying inside the brand palette.
 */
export const ACCENTS = ["teal", "gold", "coral", "violet", "sky"] as const;
export type Accent = (typeof ACCENTS)[number];

const TILE_CLASSES: Record<Accent, string> = {
  teal: "bg-teal/10 text-teal",
  gold: "bg-gold/15 text-gold",
  coral: "bg-coral/15 text-coral",
  violet: "bg-violet/15 text-violet",
  sky: "bg-sky/15 text-sky",
};

export function accentTileClass(index: number): string {
  return TILE_CLASSES[ACCENTS[index % ACCENTS.length]];
}
