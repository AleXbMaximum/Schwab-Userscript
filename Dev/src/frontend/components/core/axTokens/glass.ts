// Glass tier definitions and tonal washes. All alpha-tinted variants are
// derived from raw light/dark via axColorWithAlpha so changing a palette
// value automatically propagates here.

import { AX_LIGHT_RAW, AX_DARK_RAW, axColorWithAlpha } from "./colors";

export type AxGlassTier = {
  blur: string;
  saturate: string;
  brightness: string;
  bg: string;
  border: string;
  shadow: string;
  edge: string;
};

export const AX_LIGHT_GLASS = {
  tier1: {
    blur: "0px",
    saturate: "100%",
    brightness: "1",
    bg: "#f3f3f5",
    border: "rgba(0,0,0,0.06)",
    shadow: "0 1px 2px rgba(15,30,60,0.05), 0 0 0 0.5px rgba(15,30,60,0.04)",
    edge: "inset 0 1px 0 rgba(255,255,255,0.78)",
  },
  tier2: {
    blur: "10px",
    saturate: "140%",
    brightness: "1.02",
    bg: "rgba(250,250,252,0.50)",
    border: "rgba(0,0,0,0.08)",
    shadow: "0 6px 18px rgba(15,30,60,0.10), 0 1px 3px rgba(15,30,60,0.06)",
    edge: "inset 0 1px 0 rgba(255,255,255,0.85)",
  },
  tier3: {
    blur: "14px",
    saturate: "160%",
    brightness: "1.03",
    bg: "rgba(248,249,252,0.42)",
    border: "rgba(0,0,0,0.10)",
    shadow: "0 18px 44px rgba(15,30,60,0.18), 0 2px 6px rgba(15,30,60,0.08)",
    edge: "inset 0 1px 0 rgba(255,255,255,0.62)",
  },
} as const satisfies Record<"tier1" | "tier2" | "tier3", AxGlassTier>;

export const AX_DARK_GLASS = {
  tier1: {
    blur: "0px",
    saturate: "100%",
    brightness: "1",
    bg: "#141418",
    border: "rgba(255,255,255,0.06)",
    shadow: "0 1px 0 rgba(0,0,0,0.40), 0 0 0 0.5px rgba(0,0,0,0.30)",
    edge: "inset 0 1px 0 rgba(255,255,255,0.04)",
  },
  tier2: {
    blur: "10px",
    saturate: "140%",
    brightness: "1.02",
    bg: "rgba(20,20,26,0.44)",
    border: "rgba(255,255,255,0.10)",
    shadow: "0 14px 34px rgba(0,0,0,0.55), 0 2px 6px rgba(0,0,0,0.35)",
    edge: "inset 0 1px 0 rgba(255,255,255,0.07)",
  },
  tier3: {
    blur: "14px",
    saturate: "125%",
    brightness: "1.02",
    bg: "rgba(22,22,26,0.34)",
    border: "rgba(255,255,255,0.12)",
    shadow: "0 24px 60px rgba(0,0,0,0.72), 0 2px 10px rgba(0,0,0,0.40)",
    edge: "inset 0 1px 0 rgba(255,255,255,0.10)",
  },
} as const satisfies Record<"tier1" | "tier2" | "tier3", AxGlassTier>;

export const AX_LIGHT_GLASS_3_HOVER = "rgba(255,255,255,0.42)";
export const AX_DARK_GLASS_3_HOVER = "rgba(255,255,255,0.18)";

export type AxGlassTintKey = "positive" | "negative" | "info" | "warn";

function tintGradient(raw: string, topAlpha: number, bottomAlpha: number): string {
  return `linear-gradient(180deg, ${axColorWithAlpha(raw, topAlpha)}, ${axColorWithAlpha(
    raw,
    bottomAlpha,
  )})`;
}

export const AX_LIGHT_GLASS_TINTS = {
  positive: tintGradient(AX_LIGHT_RAW.positive, 0.1, 0.04),
  negative: tintGradient(AX_LIGHT_RAW.negative, 0.1, 0.04),
  info: tintGradient(AX_LIGHT_RAW.info, 0.1, 0.04),
  warn: tintGradient(AX_LIGHT_RAW.neutral, 0.1, 0.04),
} as const satisfies Record<AxGlassTintKey, string>;

export const AX_DARK_GLASS_TINTS = {
  positive: tintGradient(AX_DARK_RAW.positive, 0.16, 0.06),
  negative: tintGradient(AX_DARK_RAW.negative, 0.16, 0.06),
  info: tintGradient(AX_DARK_RAW.info, 0.16, 0.06),
  warn: tintGradient(AX_DARK_RAW.neutral, 0.16, 0.06),
} as const satisfies Record<AxGlassTintKey, string>;

export type AxToneKey = "positive" | "negative" | "neutral" | "info" | "muted";

export const AX_LIGHT_TONE_BG = {
  positive: axColorWithAlpha(AX_LIGHT_RAW.positive, 0.12),
  negative: axColorWithAlpha(AX_LIGHT_RAW.negative, 0.12),
  neutral: axColorWithAlpha(AX_LIGHT_RAW.neutral, 0.12),
  info: axColorWithAlpha(AX_LIGHT_RAW.info, 0.12),
  muted: axColorWithAlpha(AX_LIGHT_RAW.muted, 0.12),
} as const satisfies Record<AxToneKey, string>;

export const AX_DARK_TONE_BG = {
  positive: axColorWithAlpha(AX_DARK_RAW.positive, 0.18),
  negative: axColorWithAlpha(AX_DARK_RAW.negative, 0.18),
  neutral: axColorWithAlpha(AX_DARK_RAW.neutral, 0.18),
  info: axColorWithAlpha(AX_DARK_RAW.info, 0.18),
  muted: axColorWithAlpha(AX_DARK_RAW.muted, 0.18),
} as const satisfies Record<AxToneKey, string>;

export const AX_LIGHT_TONE_BORDER = {
  positive: axColorWithAlpha(AX_LIGHT_RAW.positive, 0.28),
  negative: axColorWithAlpha(AX_LIGHT_RAW.negative, 0.3),
  neutral: axColorWithAlpha(AX_LIGHT_RAW.neutral, 0.28),
  info: axColorWithAlpha(AX_LIGHT_RAW.info, 0.28),
  muted: axColorWithAlpha(AX_LIGHT_RAW.muted, 0.24),
} as const satisfies Record<AxToneKey, string>;

export const AX_DARK_TONE_BORDER = {
  positive: axColorWithAlpha(AX_DARK_RAW.positive, 0.35),
  negative: axColorWithAlpha(AX_DARK_RAW.negative, 0.35),
  neutral: axColorWithAlpha(AX_DARK_RAW.neutral, 0.35),
  info: axColorWithAlpha(AX_DARK_RAW.info, 0.35),
  muted: axColorWithAlpha(AX_DARK_RAW.muted, 0.3),
} as const satisfies Record<AxToneKey, string>;

export const AX_LIGHT_TONE_SOFT = {
  positive: axColorWithAlpha(AX_LIGHT_RAW.positive, 0.06),
  negative: axColorWithAlpha(AX_LIGHT_RAW.negative, 0.06),
  neutral: axColorWithAlpha(AX_LIGHT_RAW.neutral, 0.06),
  info: axColorWithAlpha(AX_LIGHT_RAW.info, 0.06),
  muted: axColorWithAlpha(AX_LIGHT_RAW.muted, 0.06),
} as const satisfies Record<AxToneKey, string>;

export const AX_DARK_TONE_SOFT = {
  positive: axColorWithAlpha(AX_DARK_RAW.positive, 0.12),
  negative: axColorWithAlpha(AX_DARK_RAW.negative, 0.12),
  neutral: axColorWithAlpha(AX_DARK_RAW.neutral, 0.12),
  info: axColorWithAlpha(AX_DARK_RAW.info, 0.12),
  muted: axColorWithAlpha(AX_DARK_RAW.muted, 0.12),
} as const satisfies Record<AxToneKey, string>;

export const AX_LIGHT_CRITICAL_SOFT_BG = axColorWithAlpha(
  AX_LIGHT_RAW.critical,
  0.06,
);
export const AX_DARK_CRITICAL_SOFT_BG = axColorWithAlpha(
  AX_DARK_RAW.critical,
  0.12,
);
export const AX_LIGHT_CRITICAL_BORDER = axColorWithAlpha(
  AX_LIGHT_RAW.critical,
  0.25,
);
export const AX_DARK_CRITICAL_BORDER = axColorWithAlpha(
  AX_DARK_RAW.critical,
  0.35,
);

// ──────────────────────────────────────────────────────────────────────────
// Mouse-tracked glass rim (.ax-glass-rim) — fully parameterised so the same
// CSS algorithm renders for every theme. baseCss.ts emits ONE rim definition
// that reads `--ax-rim-*` vars; cssVars.ts swaps the values per theme.
//
// `color`        — RGB triplet (no alpha) the gradient interpolates through.
//                  Dark uses near-white; light uses cool dark navy so the
//                  multiply blend reads as a soft cool edge on white scenery.
// `alpha*Base`   — gradient stop alpha at rest (mouse centred).
// `alpha*Mod`    — extra alpha per 1% of mouse-x offset; the rim brightens
//                  toward the cursor side. Multiplied by abs(mx)∈[0..50].
// `*Blend`       — mix-blend-mode on the corresponding pseudo-element.
//                  Dark pairs `screen + overlay` for a luminous halo over
//                  saturated dark scenery; light pairs `multiply + multiply`
//                  for a subtractive cool shadow rim on white scenery.
// `*OpacityBase` / `*OpacityHoverBoost` — pseudo-element opacity at rest
//                  and its hover-driven boost (CSS reads --ax-lg-hover∈[0,1]).
//
// Light tier intensity is dialled to ~40% of dark — same two-layer structure,
// same mouse-tracked highlight, just softer so it doesn't read as a heavy
// black rim against light backgrounds.
// ──────────────────────────────────────────────────────────────────────────

export type AxRimTokens = {
  color: string;
  alphaNearBase: number;
  alphaNearMod: number;
  alphaFarBase: number;
  alphaFarMod: number;
  primaryBlend: string;
  primaryOpacityBase: number;
  primaryOpacityHoverBoost: number;
  secondaryBlend: string;
  secondaryOpacityBase: number;
  secondaryOpacityHoverBoost: number;
};

export const AX_DARK_RIM: AxRimTokens = {
  color: "255,255,255",
  alphaNearBase: 0.04,
  alphaNearMod: 0.014,
  alphaFarBase: 0.10,
  alphaFarMod: 0.018,
  primaryBlend: "screen",
  primaryOpacityBase: 0.40,
  primaryOpacityHoverBoost: 0.30,
  secondaryBlend: "overlay",
  secondaryOpacityBase: 0.28,
  secondaryOpacityHoverBoost: 0.20,
};

export const AX_LIGHT_RIM: AxRimTokens = {
  color: "15,30,60",
  alphaNearBase: 0.012,
  alphaNearMod: 0.004,
  alphaFarBase: 0.028,
  alphaFarMod: 0.005,
  primaryBlend: "multiply",
  primaryOpacityBase: 0.50,
  primaryOpacityHoverBoost: 0.30,
  secondaryBlend: "multiply",
  secondaryOpacityBase: 0.18,
  secondaryOpacityHoverBoost: 0.14,
};
