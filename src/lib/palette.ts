// Shared palettes — card colors, sticky colors, connector colors,
// user presence colors and tag colors. Dark-mode tuned.

export interface Swatch {
  id: string;
  name: string;
  hex: string;
}

export const CARD_COLORS: Swatch[] = [
  { id: "slate", name: "Slate", hex: "#1e2433" },
  { id: "rose", name: "Rose", hex: "#f43f5e" },
  { id: "amber", name: "Amber", hex: "#f59e0b" },
  { id: "lime", name: "Lime", hex: "#84cc16" },
  { id: "cyan", name: "Cyan", hex: "#22d3ee" },
  { id: "violet", name: "Violet", hex: "#8b5cf6" },
  { id: "pink", name: "Pink", hex: "#ec4899" },
];

export const STICKY_COLORS: Swatch[] = [
  { id: "butter", name: "Butter", hex: "#fde68a" },
  { id: "peach", name: "Peach", hex: "#fdba9a" },
  { id: "mint", name: "Mint", hex: "#a7f3d0" },
  { id: "sky", name: "Sky", hex: "#bae6fd" },
  { id: "lilac", name: "Lilac", hex: "#ddd6fe" },
  { id: "blush", name: "Blush", hex: "#fbcfe8" },
];

export const LINE_COLORS: Swatch[] = [
  { id: "steel", name: "Steel", hex: "#7d8aa8" },
  { id: "red", name: "Red", hex: "#f87171" },
  { id: "orange", name: "Orange", hex: "#fb923c" },
  { id: "green", name: "Green", hex: "#4ade80" },
  { id: "cyan", name: "Cyan", hex: "#22d3ee" },
  { id: "blue", name: "Blue", hex: "#60a5fa" },
  { id: "violet", name: "Violet", hex: "#a78bfa" },
];

export const USER_COLORS = [
  "#f87171",
  "#fb923c",
  "#facc15",
  "#4ade80",
  "#22d3ee",
  "#60a5fa",
  "#a78bfa",
  "#f472b6",
];

export const TAG_COLOR_POOL = [
  "#f87171",
  "#fb923c",
  "#facc15",
  "#4ade80",
  "#22d3ee",
  "#60a5fa",
  "#a78bfa",
  "#f472b6",
];

export function pickUserColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return USER_COLORS[Math.abs(h) % USER_COLORS.length];
}

export function findSwatch(list: Swatch[], idOrHex?: string | null): Swatch {
  return (
    list.find((s) => s.id === idOrHex) ??
    list.find((s) => s.hex === idOrHex) ??
    list[0]
  );
}

/** Luminance 0..1 — used to pick readable text on colored fills. */
export function luminance(hex: string): number {
  const m = hex.replace("#", "");
  const r = parseInt(m.slice(0, 2), 16) / 255;
  const g = parseInt(m.slice(2, 4), 16) / 255;
  const b = parseInt(m.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function readableOn(hex: string): string {
  return luminance(hex) > 0.55 ? "#1c1917" : "#ffffff";
}

export const BOARD_EMOJIS = [
  "🏠", "📋", "📜", "🎮", "🗺️", "🧙", "🎨", "🎵", "🐛", "⚙️",
  "💡", "🔥", "🗡️", "🛡️", "🏰", "🌲", "⚔️", "🧪", "📦", "🚀",
  "❤️", "💰", "🧟", "👾", "🕹️", "🧩", "📖", "🎬", "🗣️", "⭐",
];
