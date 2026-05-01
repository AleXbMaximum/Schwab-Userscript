// CSS custom property emission — single source for theme tokens.
//
// Emits two namespaces:
//   1. --ax-*       — modern AlexQuant-aligned tokens
//   2. --ios-* / --lg-* / --glass-*  — legacy aliases that point to the
//      matching --ax-* values, so the existing codebase picks up the new
//      style automatically and stays theme-aware.
//
// Light values render in `:root`; dark overrides render in `body.theme-dark`.

import { AX_LIGHT_RAW, AX_DARK_RAW, type AxRawColors } from "../axTokens/colors";
import {
  AX_LIGHT_SURFACES,
  AX_DARK_SURFACES,
  AX_LIGHT_BORDERS,
  AX_DARK_BORDERS,
  AX_LIGHT_SHADOWS,
  AX_DARK_SHADOWS,
  AX_LIGHT_TOOLTIP,
  AX_DARK_TOOLTIP,
  AX_LIGHT_FG_DISABLED,
  AX_DARK_FG_DISABLED,
  AX_LIGHT_SCENERY,
  AX_DARK_SCENERY,
  AX_LIGHT_TITLE_GRADIENT,
  AX_DARK_TITLE_GRADIENT,
  type AxSurfaceTokens,
  type AxBorderTokens,
  type AxShadowTokens,
} from "../axTokens/surfaces";
import {
  AX_LIGHT_GLASS,
  AX_DARK_GLASS,
  AX_LIGHT_GLASS_TINTS,
  AX_DARK_GLASS_TINTS,
  AX_LIGHT_GLASS_3_HOVER,
  AX_DARK_GLASS_3_HOVER,
  AX_LIGHT_TONE_BG,
  AX_DARK_TONE_BG,
  AX_LIGHT_TONE_BORDER,
  AX_DARK_TONE_BORDER,
  AX_LIGHT_TONE_SOFT,
  AX_DARK_TONE_SOFT,
  AX_LIGHT_CRITICAL_SOFT_BG,
  AX_DARK_CRITICAL_SOFT_BG,
  AX_LIGHT_CRITICAL_BORDER,
  AX_DARK_CRITICAL_BORDER,
  type AxGlassTier,
} from "../axTokens/glass";
import { AX_DURATION, AX_EASE } from "../axTokens/motion";
import { AX_RADIUS } from "../axTokens/radius";
import { AX_FONT, AX_FSIZE, AX_FWEIGHT, AX_LH, AX_LETTER } from "../axTokens/typography";
import { AX_Z } from "../axTokens/zIndex";

type ThemeData = {
  palette: AxRawColors;
  surfaces: AxSurfaceTokens;
  borders: AxBorderTokens;
  shadows: AxShadowTokens;
  glass: Record<"tier1" | "tier2" | "tier3", AxGlassTier>;
  glass3Hover: string;
  glassTints: Record<"positive" | "negative" | "info" | "warn", string>;
  toneBg: Record<"positive" | "negative" | "neutral" | "info" | "muted", string>;
  toneBorder: Record<"positive" | "negative" | "neutral" | "info" | "muted", string>;
  toneSoft: Record<"positive" | "negative" | "neutral" | "info" | "muted", string>;
  criticalSoftBg: string;
  criticalBorder: string;
  tooltip: Record<keyof typeof AX_LIGHT_TOOLTIP, string>;
  fgDisabled: string;
  scenery: string;
  titleGradient: string;
};

const LIGHT: ThemeData = {
  palette: AX_LIGHT_RAW as AxRawColors,
  surfaces: AX_LIGHT_SURFACES,
  borders: AX_LIGHT_BORDERS,
  shadows: AX_LIGHT_SHADOWS,
  glass: AX_LIGHT_GLASS,
  glass3Hover: AX_LIGHT_GLASS_3_HOVER,
  glassTints: AX_LIGHT_GLASS_TINTS,
  toneBg: AX_LIGHT_TONE_BG,
  toneBorder: AX_LIGHT_TONE_BORDER,
  toneSoft: AX_LIGHT_TONE_SOFT,
  criticalSoftBg: AX_LIGHT_CRITICAL_SOFT_BG,
  criticalBorder: AX_LIGHT_CRITICAL_BORDER,
  tooltip: AX_LIGHT_TOOLTIP,
  fgDisabled: AX_LIGHT_FG_DISABLED,
  scenery: AX_LIGHT_SCENERY,
  titleGradient: AX_LIGHT_TITLE_GRADIENT,
};

const DARK: ThemeData = {
  palette: AX_DARK_RAW as AxRawColors,
  surfaces: AX_DARK_SURFACES,
  borders: AX_DARK_BORDERS,
  shadows: AX_DARK_SHADOWS,
  glass: AX_DARK_GLASS,
  glass3Hover: AX_DARK_GLASS_3_HOVER,
  glassTints: AX_DARK_GLASS_TINTS,
  toneBg: AX_DARK_TONE_BG,
  toneBorder: AX_DARK_TONE_BORDER,
  toneSoft: AX_DARK_TONE_SOFT,
  criticalSoftBg: AX_DARK_CRITICAL_SOFT_BG,
  criticalBorder: AX_DARK_CRITICAL_BORDER,
  tooltip: AX_DARK_TOOLTIP,
  fgDisabled: AX_DARK_FG_DISABLED,
  scenery: AX_DARK_SCENERY,
  titleGradient: AX_DARK_TITLE_GRADIENT,
};

function emitGlassTier(prefix: string, tier: AxGlassTier): string {
  return [
    `${prefix}-blur: ${tier.blur};`,
    `${prefix}-saturate: ${tier.saturate};`,
    `${prefix}-brightness: ${tier.brightness};`,
    `${prefix}-bg: ${tier.bg};`,
    `${prefix}-border: ${tier.border};`,
    `${prefix}-shadow: ${tier.shadow};`,
    `${prefix}-edge: ${tier.edge};`,
  ].join("\n      ");
}

function emitTheme(t: ThemeData): string {
  return `
      /* ─── Palette (saturated accents) ─── */
      --ax-blue: ${t.palette.blue};
      --ax-dark-blue: ${t.palette.darkBlue};
      --ax-green: ${t.palette.green};
      --ax-orange: ${t.palette.orange};
      --ax-red: ${t.palette.red};
      --ax-gray: ${t.palette.gray};
      --ax-cyan: ${t.palette.cyan};
      --ax-purple: ${t.palette.purple};
      --ax-yellow: ${t.palette.yellow};

      /* ─── P&L sign (desaturated — for dashboards / tables) ─── */
      --ax-positive: ${t.palette.positive};
      --ax-negative: ${t.palette.negative};

      /* ─── Critical (saturated alert red — P0 alerts only) ─── */
      --ax-critical: ${t.palette.critical};
      --ax-critical-soft-bg: ${t.criticalSoftBg};
      --ax-critical-border: ${t.criticalBorder};

      /* ─── Foreground ─── */
      --ax-fg: ${t.palette.fg};
      --ax-fg-2: ${t.palette.fg2};
      --ax-fg-muted: ${t.palette.fgMuted};
      --ax-fg-disabled: ${t.fgDisabled};
      --ax-table-head: ${t.palette.tableHeader};

      /* ─── Background surfaces ─── */
      --ax-bg: ${t.surfaces.bg};
      --ax-bg-subtle: ${t.surfaces.bgSubtle};
      --ax-bg-card: ${t.surfaces.bgCard};
      --ax-bg-card-alt: ${t.surfaces.bgCardAlt};
      --ax-bg-chip: ${t.surfaces.bgChip};
      --ax-bg-modal: ${t.surfaces.bgModal};
      --ax-bg-input: ${t.surfaces.bgInput};
      --ax-bg-input-solid: ${t.surfaces.bgInputSolid};
      --ax-bg-toolbar: ${t.surfaces.bgToolbar};
      --ax-bg-panel: ${t.surfaces.bgPanel};
      --ax-bg-table: ${t.surfaces.bgTable};
      --ax-bg-table-head: ${t.surfaces.bgTableHead};
      --ax-bg-row-hover: ${t.surfaces.bgRowHover};
      --ax-bg-highlight: ${t.surfaces.bgHighlight};
      --ax-bg-group: ${t.surfaces.bgGroup};
      --ax-bg-group-strong: ${t.surfaces.bgGroupStrong};
      --ax-bg-glass-inset: ${t.surfaces.bgGlassInset};
      --ax-bg-sticky-fade: ${t.surfaces.bgStickyFade};
      --ax-bg-sticky-fade-reverse: ${t.surfaces.bgStickyFadeReverse};
      --ax-bg-sticky-shadow: ${t.surfaces.bgStickyShadow};
      --ax-bg-sticky-shadow-reverse: ${t.surfaces.bgStickyShadowReverse};
      --ax-modal-backdrop-bg: ${t.surfaces.modalBackdropBg};
      --ax-modal-backdrop-light: ${t.surfaces.modalBackdropLight};

      /* ─── Borders ─── */
      --ax-border: ${t.borders.base};
      --ax-border-subtle: ${t.borders.subtle};
      --ax-border-strong: ${t.borders.strong};

      /* ─── Shadows ─── */
      --ax-shadow-sm: ${t.shadows.sm};
      --ax-shadow-md: ${t.shadows.md};
      --ax-shadow-lg: ${t.shadows.lg};
      --ax-shadow-xl: ${t.shadows.xl};

      /* ─── Tone tints (containers) ─── */
      --ax-tone-positive-bg: ${t.toneBg.positive};
      --ax-tone-positive-border: ${t.toneBorder.positive};
      --ax-tone-negative-bg: ${t.toneBg.negative};
      --ax-tone-negative-border: ${t.toneBorder.negative};
      --ax-tone-neutral-bg: ${t.toneBg.neutral};
      --ax-tone-neutral-border: ${t.toneBorder.neutral};
      --ax-tone-info-bg: ${t.toneBg.info};
      --ax-tone-info-border: ${t.toneBorder.info};
      --ax-tone-muted-bg: ${t.toneBg.muted};
      --ax-tone-muted-border: ${t.toneBorder.muted};

      /* ─── Tone soft tints (chip / row washes) ─── */
      --ax-tone-positive-soft-bg: ${t.toneSoft.positive};
      --ax-tone-negative-soft-bg: ${t.toneSoft.negative};
      --ax-tone-neutral-soft-bg: ${t.toneSoft.neutral};
      --ax-tone-info-soft-bg: ${t.toneSoft.info};
      --ax-tone-muted-soft-bg: ${t.toneSoft.muted};

      /* ─── Liquid-glass tiers ─── */
      ${emitGlassTier("--ax-glass-1", t.glass.tier1)}

      ${emitGlassTier("--ax-glass-2", t.glass.tier2)}

      ${emitGlassTier("--ax-glass-3", t.glass.tier3)}

      --ax-glass-3-hover: ${t.glass3Hover};

      /* ─── Tinted glass washes ─── */
      --ax-glass-tint-positive: ${t.glassTints.positive};
      --ax-glass-tint-negative: ${t.glassTints.negative};
      --ax-glass-tint-info: ${t.glassTints.info};
      --ax-glass-tint-warn: ${t.glassTints.warn};

      /* ─── App-shell scenery + title gradient ─── */
      --ax-app-scenery: ${t.scenery};
      --ax-title-gradient: ${t.titleGradient};

      /* ─── Tooltip surface ─── */
      --ax-bg-tooltip: ${t.tooltip.bg};
      --ax-border-tooltip: ${t.tooltip.border};
      --ax-shadow-tooltip: ${t.tooltip.shadow};

      /* ─── Legacy --ios-* aliases (back-compat with existing code) ─── */
      --ios-blue: var(--ax-blue);
      --ios-dark-blue: var(--ax-dark-blue);
      --ios-green: var(--ax-green);
      --ios-orange: var(--ax-orange);
      --ios-red: var(--ax-red);
      --ios-gray: var(--ax-gray);
      --ios-cyan: var(--ax-cyan);
      --ios-purple: var(--ax-purple);

      --ios-text-primary: var(--ax-fg);
      --ios-text-secondary: var(--ax-fg-2);
      --ios-light-gray: ${t.toneBg.muted};

      --ios-background: var(--ax-bg);
      --ios-secondary-bg: var(--ax-bg-subtle);
      --ios-border: var(--ax-border);
      --ios-table-header: var(--ax-table-head);

      --ios-shadow-sm: var(--ax-shadow-sm);
      --ios-shadow-md: var(--ax-shadow-md);
      --ios-shadow: var(--ax-shadow-lg);

      --ios-status-active-bg: var(--ax-tone-positive-bg);
      --ios-status-pending-bg: var(--ax-tone-neutral-bg);
      --ios-status-inactive-bg: var(--ax-tone-negative-bg);

      --ios-table-row-hover: var(--ax-bg-row-hover);

      --ios-highlight-bg: var(--ax-bg-highlight);
      --ios-highlight-border: ${t.palette.yellow};
      --ios-highlight-hover: var(--ax-bg-highlight);

      --ios-header-bg: var(--ax-bg-table-head);
      --ios-title-gradient: var(--ax-title-gradient);

      /* ─── Legacy --lg-* (liquid-glass) aliases ─── */
      --lg-border: var(--ax-glass-2-border);
      --lg-shadow: var(--ax-glass-2-shadow);
      --lg-shadow-strong: var(--ax-shadow-lg);
      --lg-highlight-1: ${t.glass.tier2.edge.replace("inset 0 1px 0 ", "")};
      --lg-highlight-2: ${t.glass.tier3.edge.replace("inset 0 1px 0 ", "")};

      /* ─── Legacy --glass-N-* aliases ─── */
      --glass-1-blur: var(--ax-glass-1-blur);
      --glass-1-saturate: var(--ax-glass-1-saturate);
      --glass-1-bg: var(--ax-glass-1-bg);
      --glass-1-border: var(--ax-glass-1-border);
      --glass-1-shadow: var(--ax-glass-1-shadow);

      --glass-2-blur: var(--ax-glass-2-blur);
      --glass-2-saturate: var(--ax-glass-2-saturate);
      --glass-2-bg: var(--ax-glass-2-bg);
      --glass-2-bg-gradient: var(--ax-glass-2-bg);
      --glass-2-border: var(--ax-glass-2-border);
      --glass-2-shadow: var(--ax-glass-2-shadow);

      --glass-3-blur: var(--ax-glass-3-blur);
      --glass-3-saturate: var(--ax-glass-3-saturate);
      --glass-3-bg: var(--ax-glass-3-bg);
      --glass-3-inset-shadow: var(--ax-glass-3-edge);`;
}

function emitConstants(): string {
  return `
      /* ─── Motion (durations + easings) ─── */
      --ax-ease-out: ${AX_EASE.out};
      --ax-ease-in-out: ${AX_EASE.inOut};
      --ax-ease-spring: ${AX_EASE.spring};
      --ax-dur-fast: ${AX_DURATION.fast};
      --ax-dur-medium: ${AX_DURATION.medium};
      --ax-dur-slow: ${AX_DURATION.slow};

      /* ─── Radius scale ─── */
      --ax-radius-xs: ${AX_RADIUS.xs};
      --ax-radius-sm: ${AX_RADIUS.sm};
      --ax-radius-md: ${AX_RADIUS.md};
      --ax-radius-lg: ${AX_RADIUS.lg};
      --ax-radius-xl: ${AX_RADIUS.xl};
      --ax-radius-2xl: ${AX_RADIUS["2xl"]};
      --ax-radius-pill: ${AX_RADIUS.pill};

      /* ─── Typography ─── */
      --ax-font-body: ${AX_FONT.body};
      --ax-font-mono: ${AX_FONT.mono};

      /* ─── Liquid-glass mouse tracking (defaults; live values written by
             attachLiquidGlassRim() in liquidGlass.ts). Defining defaults
             here keeps calc()-based rim gradients valid before the first
             pointer event lands. ─── */
      --ax-lg-mx: 0;
      --ax-lg-mx-abs: 0;
      --ax-lg-my: 0;
      --ax-lg-hover: 0;
      --ax-fs-2xs:  ${AX_FSIZE["2xs"]};
      --ax-fs-xs:   ${AX_FSIZE.xs};
      --ax-fs-sm:   ${AX_FSIZE.sm};
      --ax-fs-md:   ${AX_FSIZE.md};
      --ax-fs-lg:   ${AX_FSIZE.lg};
      --ax-fs-menu: ${AX_FSIZE.menu};
      --ax-fs-xl:   ${AX_FSIZE.xl};
      --ax-fs-2xl:  ${AX_FSIZE["2xl"]};
      --ax-fs-3xl:  ${AX_FSIZE["3xl"]};
      --ax-fs-4xl:  ${AX_FSIZE["4xl"]};
      --ax-fw-light:    ${AX_FWEIGHT.light};
      --ax-fw-normal:   ${AX_FWEIGHT.normal};
      --ax-fw-medium:   ${AX_FWEIGHT.medium};
      --ax-fw-semibold: ${AX_FWEIGHT.semibold};
      --ax-fw-bold:     ${AX_FWEIGHT.bold};
      --ax-fw-heavy:    ${AX_FWEIGHT.heavy};
      --ax-lh-none:    ${AX_LH.none};
      --ax-lh-tight:   ${AX_LH.tight};
      --ax-lh-snug:    ${AX_LH.snug};
      --ax-lh-normal:  ${AX_LH.normal};
      --ax-lh-relaxed: ${AX_LH.relaxed};
      --ax-lh-loose:   ${AX_LH.loose};
      --ax-letter-tighter: ${AX_LETTER.tighter};
      --ax-letter-tight:   ${AX_LETTER.tight};
      --ax-letter-normal:  ${AX_LETTER.normal};
      --ax-letter-wide:    ${AX_LETTER.wide};
      --ax-letter-wider:   ${AX_LETTER.wider};
      --ax-letter-widest:  ${AX_LETTER.widest};

      /* ─── Z-index ─── */
      --ax-z-table-header: ${AX_Z.tableHeader};
      --ax-z-table-sticky-cell: ${AX_Z.tableStickyCell};
      --ax-z-table-sticky-header: ${AX_Z.tableStickyHeader};
      --ax-z-sticky-nav: ${AX_Z.stickyNav};
      --ax-z-sticky-control: ${AX_Z.stickyControl};
      --ax-z-sticky-state: ${AX_Z.stickyState};
      --ax-z-nav-dropdown: ${AX_Z.navDropdown};
      --ax-z-page-popover: ${AX_Z.pagePopover};
      --ax-z-alert: ${AX_Z.alert};
      --ax-z-notification: ${AX_Z.notification};
      --ax-z-dock: ${AX_Z.dock};
      --ax-z-floating-panel: ${AX_Z.floatingPanel};
      --ax-z-floating-toggle: ${AX_Z.floatingToggle};
      --ax-z-modal-backdrop: ${AX_Z.modalBackdrop};
      --ax-z-modal-content: ${AX_Z.modalContent};
      --ax-z-tooltip: ${AX_Z.tooltip};

      /* ─── Legacy z-index aliases ─── */
      --z-table-header: var(--ax-z-table-header);
      --z-table-sticky-cell: var(--ax-z-table-sticky-cell);
      --z-table-sticky-header: var(--ax-z-table-sticky-header);
      --z-sticky-nav: var(--ax-z-sticky-nav);
      --z-sticky-control: var(--ax-z-sticky-control);
      --z-sticky-state: var(--ax-z-sticky-state);
      --z-nav-dropdown: var(--ax-z-nav-dropdown);
      --z-page-popover: var(--ax-z-page-popover);
      --z-alert: var(--ax-z-alert);
      --z-notification: var(--ax-z-notification);
      --z-dock: var(--ax-z-dock);
      --z-floating-panel: var(--ax-z-floating-panel);
      --z-floating-toggle: var(--ax-z-floating-toggle);
      --z-modal-backdrop: var(--ax-z-modal-backdrop);
      --z-modal-content: var(--ax-z-modal-content);
      --z-tooltip: var(--ax-z-tooltip);

      /* ─── Legacy non-themed shape/font/anim aliases ─── */
      --ios-radius: var(--ax-radius-2xl);
      --ios-table-border-radius: var(--ax-radius-md);
      --ios-font: var(--ax-font-body);

      --ios-anim-fast: var(--ax-dur-fast);
      --ios-anim-medium: var(--ax-dur-medium);
      --ios-anim-slow: var(--ax-dur-slow);

      --ios-table-cell-padding: 6px 10px;
      --ios-table-header-font-size: var(--ax-fs-sm);
      --ios-table-cell-font-size: var(--ax-fs-md);
      --ios-empty-padding: 60px 20px;

      /* ─── Legacy --lg-alpha aliases (kept for back-compat with badge etc.) ─── */
      --lg-alpha-1: 0.80;
      --lg-alpha-2: 0.65;
      --lg-saturate: 140%;
      --lg-blur: 16px;`;
}

export function axCssVars(): string {
  return `
    :root {
      color-scheme: light;
${emitConstants()}
${emitTheme(LIGHT)}
    }

    body.theme-dark {
      color-scheme: dark;${emitTheme(DARK)}
    }
  `;
}
