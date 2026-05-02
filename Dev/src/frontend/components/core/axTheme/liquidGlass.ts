// Liquid-glass runtime — mouse tracking + SVG chromatic-aberration filter.
//
// The CSS in baseCss.ts wires four custom properties on `.ax-glass-rim`:
//   --ax-lg-mx      mouse offset from element center, x axis, in % (-50..50)
//   --ax-lg-mx-abs  abs(--ax-lg-mx)
//   --ax-lg-my      mouse offset from element center, y axis, in %
//   --ax-lg-hover   0 when not hovered, 1 when hovered (drives rim opacity)
//
// `attachLiquidGlassRim(el)` writes those vars on `el.style` in response to
// mousemove/enter/leave so the ::before/::after gradient rim follows the
// pointer. WeakSet dedup means safe to call repeatedly.
//
// `ensureLiquidGlassFilter()` injects the SVG chromatic-aberration filter
// (ported from recorder.user.js's AQ_LG_DISPLACEMENT_MAP). Reference it via
// `filter: url(#ax-lg-filter)` on glass surfaces that want refraction.
//
// `startGlobalRimObserver()` watches the body subtree for new
// `.ax-glass-rim` nodes and auto-attaches them. Idempotent; one observer
// per page.

const AX_LG_FILTER_ID = "ax-lg-filter";
// Prefix the host node id with "alexquant-" so the dark-mode page-hijack
// selector in axShellCss (which inverts every body child that *isn't*
// id-prefixed `alexquant-*` etc.) skips our offscreen SVG defs container.
// The SVG is 0×0 so visual impact would be nil regardless, but a
// double-inverted filter pipeline produces the wrong colour-mix for
// .ax-glass-refract consumers — easier to just stay outside the hijack.
const AX_LG_FILTER_SVG_ID = "alexquant-lg-filter-host";
const AX_LG_DISPLACEMENT_MAP =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAgAAZABkAAD/2wCEAAQDAwMDAwQDAwQGBAMEBgcFBAQFBwgHBwcHBwgLCAkJCQkICwsMDAwMDAsNDQ4ODQ0SEhISEhQUFBQUFBQUFBQBBQUFCAgIEAsLEBQODg4UFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFP/CABEIAQABAAMBEQACEQEDEQH/xAAxAAEBAQEBAQAAAAAAAAAAAAADAgQIAQYBAQEBAQEBAQAAAAAAAAAAAAMCBAEACAf/2gAMAwEAAhADEAAAAPjPor6kOgOiKhKgKhKgOhKhOhKxKgKhOgKhKhKgKxOhKhOgKhKhKgKwKhKgKgKwG841nns9J/nn2KVCdCdCVAVCVCVAdCVCdiVAVidCVAVCVAdiVCVCdAVCVCVAVCVAVAViVZxsBrPPY6R/NvsY6E6ErEqAqE6ErAqE6E7E7ErA0ErArAqAqEuiVAXRLol0S6J0JUBWBUI0BXnG88djpH81+xjoToSoSoCoTsSoYQTsTsTQSsCsCsCsCsCoC6A0JeAuiXSLwn0SoioCoCoBsBrPFH0j+a/Yx0J0JUJUJ2BUMIR2MIRoBoJIBXnJAK840BUA0BdAegXhLpF4S8R+IuiVgVANAV546fSH5r9jHRHQFQlYxYnZQgnYwhQokgEgEmckzjecazlYD3OPQHoD0S8JcI/EXiPxF0SoSvONBFF0j+a/YxdI7EqA6KLGEKEKEGFI0AlA0AUzimYbzjecazlWce5w6BdEeCXhPhFwz8R+MuiVgVAdF0j+a/Yp0RUJ0MWUIUWUIUKUIJqBoArnJM4pmBMopmC84XlCswdzj3OPQHwlwS8R8M+HHDPxl0ioDoukfzT7GOhOyiimzmzhDlShBNBNBJc4rmFMwJlBMwXlC82esoVmHucOgXgHxH4j4Zyccg/GfiOiKh6R/NPsY6GLOKObOUObOUI0KEAlEkzimYFygmUEyZ0y57yZ0yZ7yheUKzh3OPc5dEvEfij0RyI9E+iPGfT6T/NPsQ6OKiKmajy4ijmyOyKwNAFM4JlBMudMmdMue8mdMme8me8wVmGsw0A9A+kfjjxx6J9EememfT6W/MvsMqOamKiamKmKOKM7ErErAUzAmYLyZ0y50yZ0yZ7yBeULzBeYazl0T6R9KPRPYj0T2J9B9Ppj8x+wjo4qY7M9iKmKg6MrIrErALzBeYEyZ0y50yZkyZ7x50yheXPeUbzjWcqA6I+lHYnsT6J7E9iOx0z+YfYBUc1MdmexHZjsHRlRBRDYBecEzZ7yAmXNeTOmTOmPOmXOmULyjeYbzlYnQxRx057E9mexPYij6a/L/r86OOzPpjsR6Y7B9MqIaILDPYZ7zZ0y57y50yZ0x5kyAmXPeUEyjeYUznQnYnRTUTUT2JqJ7EUfTn5d9fFRx2Z9EdmPTHjLsF0h6I2OegzXmzJmzplz3lzJjzpkBMudMoplBM5JnOwOyiimzmomomonsHRdO/l318VFHYj0x6I9McgumXiHpDQ56DPebMmbNebMmXMmQEy50yguQEzCmYkA7GLGEKaObibiaOKOKPp38s+vCsj7EeiPTHIP0Hwx6ReMKDP0M95895syZ815cy5c6ZQTKCZRXMKZiQDQYQYsps5uJs5qIsjounvyz68KyLpx4z9Mcg+GXoLxl4g6IUGes+a8+e82ZM2dMuZMoJmBcwrlJM5IBoMKMoUWc2c3E0cWRUXT/wCV/XQ2R0RdiPQfDPkFwy9BeIOiHQz0Ges+a8+e82ZM2dMwLmBcwpmJc5qBoMIUIUoU2c2cWZ0R0PT/AOV/XQ2RUJdM+wfDL0Hwy5A+EfEHQz0AUGe8+dM2e82dcwJnFcwrnJc5IEKUIMIUoUWc2cWRUJ0PT/5V9dFYjZFRF0z8ZeM+QPDLxD4Q6OfoBQhefPeYEz50ziucUzCoEuclCEKFGUKEKLOLI7E6EqHqD8o+uhsRsisSoi6ZeM+QPiHhj0R8IUIdALALzgmcEzimcVAlzioGomgyhQgwhRZHZFQHQlQ9Qfk/10NiVkNiNiVENiNiViNEViNkVCVgKCViViViSCViSCVgdCViVCViVCdgVCVCdD1D+U/XBWQ2I0I2Q2JUQ2I0JWQ0I2JUQ2JUI2JUI2J0JWJWJWA2R0BWJ0I2JUJ2BUJUJ0P//EABkQAQEBAQEBAAAAAAAAAAAAAAECABEDEP/aAAgBAQABAgB1atWrVq1atWrVq1atWrVq1atWrVq1atWrVq+OrVq1atWrVq1atWrVq1atWrVq1atWrVq1atXxVppppppdWrVq1atWrVq1NNNNNNNNNNNPVWmmmmms6tWrVq1atWpppppppppppppppp6q0000uc51atWrVq1ammmmmmmmmmmmmt1Vpppc5znVq1atWrVqaaaaaaaaaaaaaeqtNLnOc51atWrVq1ammmmmmmmmmmmmnqrS5znOc6tWrVq1a9TbbbbTTTTTSq000qtLnOc5zq1atWrVq1ammmmmmmmmmmmmnqrS5znOc6tWrVq1a22222mmmmmmmlVppp6tKuc5znOrVq1a9TbbbbbbbbTTTTSqqqqqq5VWmmmmm222222mmmlVVVVVdWc5znOrVq1a9TbbbbbbbbbbaaaVVVVVVznOc6tWrVq1ammmmmmmmmmmmnqrS5znOc6tWrVq1a22222mmmmmllVVVVXVnOc5znVq1atWvU222220000qqqqqrnOc51atWrVqaaaaaaaaaaaaaeqtNLnOc5zq1atWrVr1Ntttttttpppppp6q0000qqqqrnOc5azq1atWrVq1a9TbbbbbbbTTTTSqqqqqqrnOc5zq1atWrVq1NNNNNNNNNNKq0000qqqqqq51atWrVq1a9TbbbbbbbTTTTSqqqqrnOc5znVq1atWrVr1Ntttttttppppp6q00000qqqqqq51atWrVq1a1atWrU00000qqqqqq51atWrVq1aterVq1atTTTTStNNNNK00000qqrTTTStNNNNNNNK0000000001NNNNNNK0000000rTTTStK0000001NNNNNNNK1NNNNNNNK01NNNNNNNK1NNNNNNNNNK00000qtNNNNNK//EABQRAQAAAAAAAAAAAAAAAAAAAKD/2gAIAQMBAz8AAB//2Q==";

// Per-element cleanup registry. Replaces the previous WeakSet so we can
// fully detach a rim (remove listeners + clear inline CSS vars + cancel
// pending rAF) when the render mode flips to Eco. Map keys hold strong
// refs while attached; Eco wipes the registry, Full re-attaches via the
// global observer's initial scan.
const cleanupRegistry = new Map<HTMLElement, () => void>();
let svgFilterInjected = false;
let observer: MutationObserver | null = null;
let observerRoot: Node | null = null;

// Render-mode gate. Defaults to enabled (Full) so the runtime works
// standalone; the renderMode controller flips this via
// setLiquidGlassEnabled() during initRenderMode() and on every mode
// change. Kept as a module-local flag rather than an import so this
// runtime stays unaware of the renderMode module — single direction of
// dependency.
let liquidGlassEnabled = true;

function isHtml(node: unknown): node is HTMLElement {
  return typeof HTMLElement !== "undefined" && node instanceof HTMLElement;
}

/**
 * Toggle the entire liquid-glass runtime. Called by the renderMode
 * controller; not meant for component-level use.
 *
 * On disable: detaches every currently-attached rim (removes listeners,
 * cancels pending rAF, clears inline CSS vars). The SVG filter <defs>
 * stays in the DOM but the .ax-glass-refract { filter: none } override
 * makes it inert — re-injecting it later would just churn DOM nodes.
 *
 * On enable: re-injects the SVG filter if it wasn't done at boot
 * (Eco-from-cold path) and re-scans the body for .ax-glass-rim nodes
 * to re-attach mouse tracking.
 */
export function setLiquidGlassEnabled(enabled: boolean): void {
  if (liquidGlassEnabled === enabled) return;
  liquidGlassEnabled = enabled;

  if (!enabled) {
    for (const cleanup of cleanupRegistry.values()) {
      try {
        cleanup();
      } catch {
        /* observer-style fan-out: one element's failure must not block the rest */
      }
    }
    cleanupRegistry.clear();
    return;
  }

  // Re-enable path. ensureLiquidGlassFilter is idempotent; calling it
  // here covers the "boot into Eco then user toggles to Full" flow
  // where the runtime bootstrap saw enabled=false and skipped injection.
  ensureLiquidGlassFilter();
  if (typeof document !== "undefined" && document.body) {
    attachAllInside(document.body);
  }
}

/**
 * Bind mouse tracking to a single liquid-glass element. Idempotent —
 * calling twice on the same element is a no-op. Listeners are passive
 * and never call preventDefault, so they don't interfere with scroll
 * or click. No-op when liquid glass is disabled (Eco mode).
 */
export function attachLiquidGlassRim(el: HTMLElement): void {
  if (!isHtml(el) || !liquidGlassEnabled) return;
  if (cleanupRegistry.has(el)) return;

  let raf = 0;
  let lastClientX = 0;
  let lastClientY = 0;

  // Defer both getBoundingClientRect() and setProperty() to the RAF flush.
  // getBoundingClientRect() forces a synchronous layout, so calling it on
  // every mousemove (~60+/s on a fast pointer) produces measurable thrash
  // even though the rect rarely changes between frames. Reading it inside
  // the RAF batches with the property write, so we hit layout once per
  // animation frame regardless of mouse event rate.
  const flush = () => {
    raf = 0;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const mx = ((lastClientX - cx) / rect.width) * 100;
    const my = ((lastClientY - cy) / rect.height) * 100;
    el.style.setProperty("--ax-lg-mx", String(mx));
    el.style.setProperty("--ax-lg-mx-abs", String(Math.abs(mx)));
    el.style.setProperty("--ax-lg-my", String(my));
  };

  const onMove = (e: MouseEvent) => {
    lastClientX = e.clientX;
    lastClientY = e.clientY;
    if (raf) return;
    raf = requestAnimationFrame(flush);
  };

  const onEnter = () => {
    el.style.setProperty("--ax-lg-hover", "1");
  };

  const onLeave = () => {
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    el.style.setProperty("--ax-lg-mx", "0");
    el.style.setProperty("--ax-lg-mx-abs", "0");
    el.style.setProperty("--ax-lg-my", "0");
    el.style.setProperty("--ax-lg-hover", "0");
  };

  el.addEventListener("mousemove", onMove, { passive: true });
  el.addEventListener("mouseenter", onEnter, { passive: true });
  el.addEventListener("mouseleave", onLeave, { passive: true });

  cleanupRegistry.set(el, () => {
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    el.removeEventListener("mousemove", onMove);
    el.removeEventListener("mouseenter", onEnter);
    el.removeEventListener("mouseleave", onLeave);
    el.style.removeProperty("--ax-lg-mx");
    el.style.removeProperty("--ax-lg-mx-abs");
    el.style.removeProperty("--ax-lg-my");
    el.style.removeProperty("--ax-lg-hover");
  });
}

/**
 * Inject the SVG chromatic-aberration / displacement filter into the document.
 * Idempotent. Reference via `filter: url(#ax-lg-filter)` on a glass surface
 * to give its frosted backdrop a slight RGB-channel split at the edges.
 *
 * The displacement map is a 256×256 base64 JPEG ported verbatim from the
 * recorder userscript. Three channel-specific feDisplacementMap passes
 * (R/G/B with scales -70/-77/-84) produce the chromatic split; the result
 * is composited back over a clean center via an edge mask so only the
 * outer ~24% of the surface gets the aberration.
 */
export function ensureLiquidGlassFilter(): void {
  if (svgFilterInjected) return;
  if (!liquidGlassEnabled) return;
  if (typeof document === "undefined") return;
  const host = document.body || document.documentElement;
  if (!host) return;

  const wrap = document.createElement("div");
  wrap.id = AX_LG_FILTER_SVG_ID;
  wrap.setAttribute("aria-hidden", "true");
  wrap.style.cssText =
    "position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;";

  // Build the SVG via DOM rather than innerHTML to keep CSP-friendly and
  // avoid any namespace quirks in the userscript injection environment.
  const SVG_NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("style", "position:absolute;width:0;height:0;");
  const defs = document.createElementNS(SVG_NS, "defs");

  // Edge-mask radial gradient — used to fade aberration to clean center.
  const grad = document.createElementNS(SVG_NS, "radialGradient");
  grad.setAttribute("id", "ax-lg-edge");
  grad.setAttribute("cx", "50%");
  grad.setAttribute("cy", "50%");
  grad.setAttribute("r", "50%");
  for (const [offset, alpha] of [
    ["0%", "0"],
    ["76%", "0"],
    ["100%", "1"],
  ] as const) {
    const stop = document.createElementNS(SVG_NS, "stop");
    stop.setAttribute("offset", offset);
    stop.setAttribute("stop-color", alpha === "0" ? "black" : "white");
    stop.setAttribute("stop-opacity", alpha);
    grad.appendChild(stop);
  }
  defs.appendChild(grad);

  // Displacement filter pipeline.
  const filter = document.createElementNS(SVG_NS, "filter");
  filter.setAttribute("id", AX_LG_FILTER_ID);
  filter.setAttribute("x", "-35%");
  filter.setAttribute("y", "-35%");
  filter.setAttribute("width", "170%");
  filter.setAttribute("height", "170%");
  filter.setAttribute("color-interpolation-filters", "sRGB");

  const append = (
    tag: string,
    attrs: Record<string, string>,
    children: SVGElement[] = [],
  ): SVGElement => {
    const node = document.createElementNS(SVG_NS, tag) as SVGElement;
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "href") node.setAttributeNS("http://www.w3.org/1999/xlink", "href", v);
      else node.setAttribute(k, v);
    }
    for (const c of children) node.appendChild(c);
    return node;
  };

  filter.appendChild(
    append("feImage", {
      x: "0",
      y: "0",
      width: "100%",
      height: "100%",
      result: "DM",
      href: AX_LG_DISPLACEMENT_MAP,
      preserveAspectRatio: "xMidYMid slice",
    }),
  );
  filter.appendChild(
    append("feColorMatrix", {
      in: "DM",
      type: "matrix",
      values: "0.3 0.3 0.3 0 0 0.3 0.3 0.3 0 0 0.3 0.3 0.3 0 0 0 0 0 1 0",
      result: "EI",
    }),
  );
  filter.appendChild(
    append(
      "feComponentTransfer",
      { in: "EI", result: "EM" },
      [append("feFuncA", { type: "discrete", tableValues: "0 0.1 1" })],
    ),
  );
  filter.appendChild(
    append("feOffset", { in: "SourceGraphic", dx: "0", dy: "0", result: "CO" }),
  );
  // R channel
  filter.appendChild(
    append("feDisplacementMap", {
      in: "SourceGraphic",
      in2: "DM",
      scale: "-70",
      xChannelSelector: "R",
      yChannelSelector: "B",
      result: "RD",
    }),
  );
  filter.appendChild(
    append("feColorMatrix", {
      in: "RD",
      type: "matrix",
      values: "1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0",
      result: "RC",
    }),
  );
  // G channel
  filter.appendChild(
    append("feDisplacementMap", {
      in: "SourceGraphic",
      in2: "DM",
      scale: "-77",
      xChannelSelector: "R",
      yChannelSelector: "B",
      result: "GD",
    }),
  );
  filter.appendChild(
    append("feColorMatrix", {
      in: "GD",
      type: "matrix",
      values: "0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0",
      result: "GC",
    }),
  );
  // B channel
  filter.appendChild(
    append("feDisplacementMap", {
      in: "SourceGraphic",
      in2: "DM",
      scale: "-84",
      xChannelSelector: "R",
      yChannelSelector: "B",
      result: "BD",
    }),
  );
  filter.appendChild(
    append("feColorMatrix", {
      in: "BD",
      type: "matrix",
      values: "0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0",
      result: "BC",
    }),
  );
  filter.appendChild(
    append("feBlend", { in: "GC", in2: "BC", mode: "screen", result: "GB" }),
  );
  filter.appendChild(
    append("feBlend", { in: "RC", in2: "GB", mode: "screen", result: "RGB" }),
  );
  filter.appendChild(
    append("feGaussianBlur", { in: "RGB", stdDeviation: "0.3", result: "AB" }),
  );
  filter.appendChild(
    append("feComposite", { in: "AB", in2: "EM", operator: "in", result: "EA" }),
  );
  filter.appendChild(
    append(
      "feComponentTransfer",
      { in: "EM", result: "IM" },
      [append("feFuncA", { type: "table", tableValues: "1 0" })],
    ),
  );
  filter.appendChild(
    append("feComposite", { in: "CO", in2: "IM", operator: "in", result: "CC" }),
  );
  filter.appendChild(
    append("feComposite", { in: "EA", in2: "CC", operator: "over" }),
  );

  defs.appendChild(filter);
  svg.appendChild(defs);
  wrap.appendChild(svg);
  host.appendChild(wrap);
  svgFilterInjected = true;
}

function attachAllInside(root: ParentNode): void {
  const els = root.querySelectorAll<HTMLElement>(".ax-glass-rim");
  for (let i = 0; i < els.length; i++) attachLiquidGlassRim(els[i]);
}

/**
 * Watch the document for any element with `.ax-glass-rim` and auto-attach
 * mouse tracking. Idempotent — second call is a no-op. Cheap: a single
 * MutationObserver on the body subtree filters by class and skips
 * already-attached nodes via a WeakSet.
 *
 * Components can still call attachLiquidGlassRim() directly when they
 * mount panels — the observer is a safety net for view rebuilds and
 * dynamically-injected children.
 */
export function startGlobalRimObserver(): void {
  if (typeof document === "undefined") return;
  const root = document.body || document.documentElement;
  if (!root) return;
  if (observer && observerRoot === root) return;

  // Initial scan covers anything already in the DOM.
  attachAllInside(root);

  observer = new MutationObserver((muts) => {
    for (let i = 0; i < muts.length; i++) {
      const m = muts[i];
      if (m.type !== "childList") continue;
      const added = m.addedNodes;
      for (let j = 0; j < added.length; j++) {
        const node = added[j];
        if (!isHtml(node)) continue;
        if (node.classList.contains("ax-glass-rim")) {
          attachLiquidGlassRim(node);
        }
        attachAllInside(node);
      }
    }
  });
  observer.observe(root, { childList: true, subtree: true });
  observerRoot = root;
}
