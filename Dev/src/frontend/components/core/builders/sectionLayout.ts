/**
 * Generic Section Layout
 *
 * Shared implementation for collapsible section grids with sticky nav tabs,
 * intersection-based active tab, and unit-based responsive grid.
 *
 * Used by both the analysis-options and portfolio pages via thin wrappers.
 */

import { ui_createElement } from "./createElement";

// ── Public types ─────────────────────────────────────────────────────────────

export type SectionConfig<TId extends string = string> = {
  id: TId;
  title: string;
  tabLabel: string;
  defaultExpanded: boolean;
  accentColor: string;
  accentBg: string;
};

export type SectionLayoutOptions<TId extends string> = {
  sections: SectionConfig<TId>[];
  onToggle: (id: TId, expanded: boolean) => void;
  /** CSS `top` for the sticky nav bar. Default `'0'`. */
  navBarStickyTop?: string;
  /** Gap between grid cells. Default `'10px'`. */
  gridGap?: string;
  /** Padding inside the grid. Default `'10px'`. */
  gridPadding?: string;
  /** Gap between root children (sections). Default `'12px'`. */
  rootGap?: string;
  /** Nav bar inner gap. Default `'8px'`. */
  navGap?: string;
  /** Nav bar padding. Default `'5px 10px'`. */
  navPadding?: string;
  /** Nav pill padding. Default `'3px 10px'`. */
  pillPadding?: string;
  /** Section header padding. Default `'7px 12px'`. */
  headerPadding?: string;
  /** Header title uses uppercase + letter-spacing. Default `false`. */
  headerTitleUppercase?: boolean;
  /** Show a nav info area on the right side of the nav bar. Default `false`. */
  showNavInfo?: boolean;
  /** Minimum unit cell width in pixels. Default `340`. */
  minUnitWidth?: number;
  /** Unit cell height / width ratio (height = width * ratio). Default `0.65`. Ignored when `unitHeight` is set. */
  unitAspectRatio?: number;
  /** Fixed unit cell height in pixels. When set, overrides `unitAspectRatio`. */
  unitHeight?: number;
  /** Maximum number of grid columns. Default `3`. */
  maxCols?: number;
};

export type CardSpan = 1 | 2 | 3;
export type CardRowSpan = 1 | 2;
export type CardNature = "chart" | "text" | "interactive";

export type GenericSectionLayoutResult<TId extends string> = HTMLElement & {
  cleanup?: () => void;
  getCardSlot: (
    sectionId: TId,
    cardId: string,
    span: CardSpan,
    nature: CardNature,
    rowSpan?: CardRowSpan,
    autoHeight?: boolean,
  ) => HTMLElement;
  getSectionInfoChips: (sectionId: TId) => HTMLElement;
  getNavInfoChips: () => HTMLElement;
  getNavBar: () => HTMLElement;
  setExpanded: (id: TId, expanded: boolean) => void;
  setAllExpanded: (expanded: boolean) => void;
  scrollToSection: (id: TId) => void;
  scrollToCard: (cardId: string) => void;
  highlightCard: (cardId: string) => void;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function parsePx(value: string): number {
  return parseFloat(value) || 0;
}

// ── Implementation ───────────────────────────────────────────────────────────

export function createSectionLayout<TId extends string>(
  options: SectionLayoutOptions<TId>,
): GenericSectionLayoutResult<TId> {
  const {
    sections,
    onToggle,
    navBarStickyTop = "0",
    gridGap = "10px",
    gridPadding = "10px",
    rootGap = "12px",
    navGap = "8px",
    navPadding = "5px 10px",
    pillPadding = "3px 10px",
    headerPadding = "7px 12px",
    headerTitleUppercase = false,
    showNavInfo = false,
    minUnitWidth = 340,
    unitAspectRatio = 0.65,
    unitHeight: fixedUnitHeight,
    maxCols = 3,
  } = options;

  const gapPx = parsePx(gridGap);
  const padPx = parsePx(gridPadding);

  // ── Style builders ───────────────────────────────────────────────────────

  const rootStyle = `display: flex; flex-direction: column; gap: ${rootGap}; width: 100%;`;

  const navBarStyle =
    `display: flex; align-items: center; gap: ${navGap}; padding: ${navPadding};` +
    " min-width: 0;" +
    " background: var(--ax-glass-2-bg);" +
    " -webkit-backdrop-filter: blur(var(--ax-glass-2-blur)) saturate(var(--ax-glass-2-saturate));" +
    " backdrop-filter: blur(var(--ax-glass-2-blur)) saturate(var(--ax-glass-2-saturate));" +
    " border-bottom: 1px solid var(--ax-border-subtle);" +
    ` position: sticky; top: ${navBarStickyTop}; z-index: var(--z-sticky-nav, 100); border-radius: var(--ax-radius-md);`;

  const navTabsStyle =
    "display: flex; align-items: center; gap: 6px; flex: 0 0 auto; min-width: 0;";

  const navInfoStyle =
    "display: flex; align-items: center; gap: 6px; flex-wrap: wrap; justify-content: flex-end;" +
    " margin-left: auto; min-width: 0;";

  const navPillBase =
    `padding: ${pillPadding}; font-size: var(--ax-fs-sm); font-weight: var(--ax-fw-semibold); border-radius: var(--ax-radius-lg);` +
    " cursor: pointer; border: 1px solid var(--ax-border);" +
    " font-family: var(--ax-font-body); transition: all 0.15s;" +
    " white-space: nowrap; background: var(--ax-bg-input);" +
    " color: var(--ax-fg);";

  const sectionWrapperStyle =
    "border-radius: var(--ax-radius-xl); border: 1px solid var(--ax-border-subtle);" +
    " background: var(--ax-glass-2-bg); overflow: visible;";

  const buildHeaderStyle = (cfg: SectionConfig<TId>): string =>
    "display: flex; align-items: center; justify-content: space-between;" +
    ` padding: ${headerPadding}; cursor: pointer; user-select: none;` +
    ` background: ${cfg.accentBg};` +
    " border-radius: 12px 12px 0 0;" +
    " -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px);" +
    " transition: background 0.15s ease;";

  const headerLeftStyle =
    "display: flex; align-items: center; gap: 10px; min-width: 0;";

  const headerTitleStyle = (cfg: SectionConfig<TId>): string => {
    const base = "font-weight: 700; white-space: nowrap;";
    const sizing = headerTitleUppercase
      ? "font-size: 10px; text-transform: uppercase; letter-spacing: 0.6px;"
      : "font-size: 11px; letter-spacing: 0.2px;";
    return `${base} ${sizing} color: ${cfg.accentColor};`;
  };

  const chipsContainerStyle =
    "display: flex; align-items: center; gap: 4px; flex-wrap: wrap; min-width: 0;";

  const chevronStyle = (cfg: SectionConfig<TId>): string =>
    `font-size: 10px; transition: transform 0.2s ease; line-height: 1; color: ${cfg.accentColor};`;

  // Grid style: columns and row height set dynamically by ResizeObserver
  const gridBaseStyle =
    `gap: ${gridGap}; padding: ${gridPadding}; grid-auto-flow: dense;`;

  // ── State ──────────────────────────────────────────────────────────────────

  type SlotEntry = {
    el: HTMLElement;
    declaredCol: CardSpan;
    declaredRow: CardRowSpan;
    autoHeight: boolean;
  };

  let currentCols = maxCols;
  const allSlots: SlotEntry[] = [];

  // ── DOM construction ─────────────────────────────────────────────────────

  const root = ui_createElement("div", {
    styleString: rootStyle,
  }) as GenericSectionLayoutResult<TId>;

  const expandedState = new Map<TId, boolean>();
  const gridEls = new Map<TId, HTMLElement>();
  const chevronEls = new Map<TId, HTMLElement>();
  const chipsEls = new Map<TId, HTMLElement>();
  const sectionEls = new Map<TId, HTMLElement>();
  const cleanupFns: (() => void)[] = [];

  // ── Nav bar ──────────────────────────────────────────────────────────────

  const navBar = ui_createElement("div", { styleString: navBarStyle });
  const navPills = new Map<TId, HTMLElement>();

  let navTabs: HTMLElement;
  let navInfo: HTMLElement;

  if (showNavInfo) {
    navTabs = ui_createElement("div", { styleString: navTabsStyle });
    navInfo = ui_createElement("div", { styleString: navInfoStyle });
  } else {
    navTabs = navBar;
    navInfo = ui_createElement("div", { styleString: "display: none;" });
  }

  for (const cfg of sections) {
    const pill = ui_createElement("button", {
      text: cfg.tabLabel,
      styleString: navPillBase,
    });
    const onClick = () => {
      const sectionEl = sectionEls.get(cfg.id);
      if (sectionEl)
        sectionEl.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    pill.addEventListener("click", onClick);
    cleanupFns.push(() => pill.removeEventListener("click", onClick));
    navTabs.appendChild(pill);
    navPills.set(cfg.id, pill);
  }

  if (showNavInfo) {
    navBar.appendChild(navTabs);
    navBar.appendChild(navInfo);
  }
  root.appendChild(navBar);

  // ── Active tab highlight ─────────────────────────────────────────────────

  const updateActiveTab = (activeId: TId) => {
    for (const cfg of sections) {
      const pill = navPills.get(cfg.id);
      if (!pill) continue;
      if (cfg.id === activeId) {
        pill.style.background = cfg.accentColor;
        pill.style.color = "#fff";
        pill.style.borderColor = cfg.accentColor;
      } else {
        pill.style.background = "var(--ax-bg-input)";
        pill.style.color = "var(--ax-fg)";
        pill.style.borderColor = "var(--ax-border)";
      }
    }
  };

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const id = (entry.target as HTMLElement).dataset.sectionId as TId;
        if (id) updateActiveTab(id);
      }
    },
    { threshold: 0.3 },
  );
  cleanupFns.push(() => observer.disconnect());

  // ── Sections ─────────────────────────────────────────────────────────────

  for (const cfg of sections) {
    const isExpanded = cfg.defaultExpanded;
    expandedState.set(cfg.id, isExpanded);

    const wrapper = ui_createElement("div", {
      styleString: sectionWrapperStyle,
    });
    wrapper.dataset.sectionId = cfg.id;

    const header = ui_createElement("div", {
      styleString: buildHeaderStyle(cfg),
    });

    const headerLeft = ui_createElement("div", {
      styleString: headerLeftStyle,
    });
    headerLeft.appendChild(
      ui_createElement("span", {
        text: cfg.title,
        styleString: headerTitleStyle(cfg),
      }),
    );

    const chipsEl = ui_createElement("div", {
      styleString: chipsContainerStyle,
    });
    chipsEls.set(cfg.id, chipsEl);
    headerLeft.appendChild(chipsEl);

    const chevron = ui_createElement("span", {
      text: isExpanded ? "\u25BC" : "\u25B6",
      styleString: chevronStyle(cfg),
    });
    chevronEls.set(cfg.id, chevron);

    header.appendChild(headerLeft);
    header.appendChild(chevron);

    const handleClick = () => {
      const current = expandedState.get(cfg.id) ?? false;
      setExpanded(cfg.id, !current);
    };
    header.addEventListener("click", handleClick);
    cleanupFns.push(() => header.removeEventListener("click", handleClick));

    const grid = ui_createElement("div", {
      className: "section-grid",
      styleString: `display: grid; ${gridBaseStyle}`,
    });
    grid.style.display = isExpanded ? "grid" : "none";
    gridEls.set(cfg.id, grid);

    wrapper.appendChild(header);
    wrapper.appendChild(grid);
    root.appendChild(wrapper);
    sectionEls.set(cfg.id, wrapper);

    observer.observe(wrapper);
  }

  updateActiveTab(sections[0].id);

  // ── Unit-based responsive grid ──────────────────────────────────────────

  function computeCols(containerWidth: number): number {
    const available = containerWidth - padPx * 2;
    if (available <= 0) return 1;
    const cols = Math.floor((available + gapPx) / (minUnitWidth + gapPx));
    return Math.max(1, Math.min(cols, maxCols));
  }

  function applyGridLayout(cols: number, containerWidth: number): void {
    const available = containerWidth - padPx * 2;
    const unitW = (available - gapPx * (cols - 1)) / cols;
    const unitH = fixedUnitHeight ?? Math.round(unitW * unitAspectRatio);

    for (const grid of gridEls.values()) {
      grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
      grid.style.gridAutoRows = `minmax(${unitH}px, auto)`;
    }

    for (const slot of allSlots) {
      const effCol = Math.min(slot.declaredCol, cols);
      slot.el.style.gridColumn = `span ${effCol}`;
      if (slot.autoHeight) {
        slot.el.style.gridRow = "auto";
      } else {
        const effRow = cols <= 1 ? 1 : slot.declaredRow;
        slot.el.style.gridRow = `span ${effRow}`;
      }
    }

    currentCols = cols;
  }

  const resizeObs = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const w = entry.contentRect.width;
      const newCols = computeCols(w);
      if (newCols !== currentCols) {
        applyGridLayout(newCols, w);
      }
    }
  });
  resizeObs.observe(root);
  cleanupFns.push(() => resizeObs.disconnect());

  // Apply initial layout synchronously
  const initWidth = root.clientWidth || 960;
  const initCols = computeCols(initWidth);
  applyGridLayout(initCols, initWidth);

  // ── setExpanded ──────────────────────────────────────────────────────────

  function setExpanded(id: TId, expanded: boolean): void {
    expandedState.set(id, expanded);

    const grid = gridEls.get(id);
    const chevron = chevronEls.get(id);

    if (grid) grid.style.display = expanded ? "grid" : "none";
    if (chevron) chevron.textContent = expanded ? "\u25BC" : "\u25B6";

    onToggle(id, expanded);
  }

  // ── Public API ───────────────────────────────────────────────────────────

  root.getCardSlot = (
    sectionId: TId,
    cardId: string,
    span: CardSpan,
    nature: CardNature,
    rowSpan: CardRowSpan = 1,
    autoHeight: boolean = false,
  ): HTMLElement => {
    const grid = gridEls.get(sectionId);
    if (!grid) throw new Error(`Unknown section: ${sectionId}`);

    const effCol = Math.min(span, currentCols);

    let gridRowStyle: string;
    let overflowStyle: string;
    if (autoHeight) {
      gridRowStyle = "grid-row: auto;";
      overflowStyle = " overflow: visible;";
    } else {
      const effRow = currentCols <= 1 ? 1 : rowSpan;
      gridRowStyle = `grid-row: span ${effRow};`;
      overflowStyle = " overflow: hidden;";
    }

    const slot = ui_createElement("div", {
      styleString:
        `grid-column: span ${effCol}; ${gridRowStyle}` +
        ` min-width: 0; display: grid;${overflowStyle}`,
    });
    slot.dataset.cardId = cardId;
    slot.dataset.nature = nature;

    allSlots.push({ el: slot, declaredCol: span, declaredRow: rowSpan, autoHeight });
    grid.appendChild(slot);
    return slot;
  };

  root.getSectionInfoChips = (sectionId: TId): HTMLElement => {
    const el = chipsEls.get(sectionId);
    if (!el) throw new Error(`Unknown section: ${sectionId}`);
    return el;
  };

  root.getNavInfoChips = (): HTMLElement => navInfo;

  root.getNavBar = (): HTMLElement => navBar;

  root.setExpanded = setExpanded;

  root.setAllExpanded = (expanded: boolean): void => {
    for (const cfg of sections) {
      setExpanded(cfg.id, expanded);
    }
  };

  root.scrollToSection = (id: TId) => {
    const el = sectionEls.get(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  root.scrollToCard = (cardId: string) => {
    const slot = root.querySelector(
      `[data-card-id="${cardId}"]`,
    ) as HTMLElement | null;
    if (slot) slot.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  root.highlightCard = (cardId: string) => {
    const slot = root.querySelector(
      `[data-card-id="${cardId}"]`,
    ) as HTMLElement | null;
    if (!slot) return;
    slot.style.boxShadow =
      "0 0 0 3px rgba(255, 204, 0, 0.8), 0 0 12px rgba(255, 204, 0, 0.3)";
    slot.style.transition = "box-shadow 0.3s ease";
    const timer = window.setTimeout(() => {
      slot.style.boxShadow = "";
    }, 2000);
    cleanupFns.push(() => clearTimeout(timer));
  };

  root.cleanup = () => {
    for (const fn of cleanupFns) fn();
    cleanupFns.length = 0;
  };

  return root;
}
