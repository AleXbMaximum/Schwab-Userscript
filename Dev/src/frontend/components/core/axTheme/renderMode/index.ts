// Public barrel for the AlexQuant render-mode runtime (Full / Eco).

export {
  initRenderMode,
  setRenderMode,
  hydrateRenderModeFromKV,
  getRenderMode,
  isEco,
  onRenderModeChanged,
  type AxRenderMode,
} from "./controller";
export { axEcoOverrideCss } from "./overrideCss";
export { withShadow, type ShadowOpts } from "./canvasShadow";
