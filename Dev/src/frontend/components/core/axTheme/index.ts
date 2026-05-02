// Public barrel for the AlexQuant theme runtime.

export { axCssVars } from "./cssVars";
export {
  axResetCss,
  axGlassCss,
  axUtilitiesCss,
  axPresetsCss,
  axAnimationsCss,
} from "./baseCss";
export { axShellCss } from "./shellCss";
export { ensureAxUICss, cx } from "./runtime";
export {
  attachLiquidGlassRim,
  ensureLiquidGlassFilter,
  startGlobalRimObserver,
  setLiquidGlassEnabled,
} from "./liquidGlass";
export {
  initTheme,
  setTheme,
  hydrateThemeFromKV,
  isDarkTheme,
  getCurrentMode,
  getEffectiveTheme,
  onThemeChanged,
  type AxThemeMode,
  type AxEffectiveTheme,
} from "./controller";
export {
  initRenderMode,
  setRenderMode,
  hydrateRenderModeFromKV,
  getRenderMode,
  isEco,
  onRenderModeChanged,
  withShadow,
  type AxRenderMode,
  type ShadowOpts,
} from "./renderMode";
export {
  AX_CHART_COLORS_LIGHT,
  AX_CHART_COLORS_DARK,
  getAxChartColors,
} from "./chartTheme";
