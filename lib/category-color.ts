// A curated palette that harmonises with the warm earth/gold theme.
// Each entry is the dot color (used for the visual marker on tabs).
const PALETTE = [
  "#a07a3a", // gold
  "#7d4e8c", // purple
  "#2b5fa3", // blue
  "#2f7a3d", // green
  "#b03a3a", // red
  "#8a682f", // dark gold
  "#1f5c66", // teal
  "#714098", // deep purple
  "#a35a17", // orange
  "#5a7a4a", // olive
  "#4a5a7a", // slate
  "#6b3a4a", // burgundy
];

/** Stable color from a string — same name always maps to the same color. */
export function colorForName(name: string): string {
  if (!name) return PALETTE[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % PALETTE.length;
  return PALETTE[idx];
}
