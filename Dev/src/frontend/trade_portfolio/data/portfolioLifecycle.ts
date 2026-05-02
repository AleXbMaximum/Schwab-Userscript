/**
 * Portfolio page lifecycle helpers.
 *
 * Encapsulates the component-ref bookkeeping, section-layout bootstrap,
 * and update-vs-recreate decision that previously lived inline in page.ts.
 *
 * `createPortfolioLifecycle()` captures the shared mutable refs (components
 * map, sectionLayout/slots holders, the placeholder DOM nodes) and returns
 * the helper closures the page render path calls.
 */

import {
  renderPortfolioSectionLayout,
  type PortfolioSectionLayoutResult,
} from "../components/layout/PortfolioSectionLayout";
import type { PortfolioControlState, PortfolioSectionId } from "../types";
import { logService } from "shared/log/core/LogService";

const log = logService.namespace("render");

export type ComponentRef = HTMLElement & {
  cleanup?: () => void;
  update?: (...args: any[]) => void;
};

export type Slots = {
  health: HTMLElement;
  betaExposure: HTMLElement;
  greeks: HTMLElement;
  heatmap: HTMLElement;
  rebalance: HTMLElement;
};

export const ALL_PORTFOLIO_SECTIONS: PortfolioSectionId[] = [
  "overview",
  "exposure",
  "scenarios",
  "governance",
];

export type LifecycleRefs = {
  /** Mutable component map. */
  components: Record<string, ComponentRef>;
  /** Mutable section-layout holder. */
  sectionLayout: { value: PortfolioSectionLayoutResult | null };
  /** Mutable slots holder. */
  slots: { value: Slots | null };
  navBarPlaceholder: HTMLElement;
  stateVectorPlaceholder: HTMLElement;
  controlBarPlaceholder: HTMLElement;
  contentArea: HTMLElement;
};

export type LifecycleHooks = {
  /** Called by ensureSectionLayout after wiring the navBar. */
  syncAllStickyTops: () => void;
  /** Returns the current control state (read at section-expand-time). */
  getControlState: () => PortfolioControlState;
  /** Mutable set of user-expanded sections (for "all" focus mode). */
  manualExpandedSections: Set<PortfolioSectionId>;
};

export type PortfolioLifecycle = {
  cleanupComponent: (key: string) => void;
  cleanupAllComponents: () => void;
  updateOrCreate: (
    host: HTMLElement,
    componentKey: string,
    createFn: () => ComponentRef,
    updateArgs?: any[],
  ) => void;
  ensureSectionLayout: () => void;
};

export function createPortfolioLifecycle(
  refs: LifecycleRefs,
  hooks: LifecycleHooks,
): PortfolioLifecycle {
  const { components } = refs;

  const cleanupComponent = (key: string): void => {
    const comp = components[key];
    if (!comp) return;
    if (comp.cleanup) {
      try {
        comp.cleanup();
      } catch (err) {
        log.warn("component.cleanup.fail", {
          key,
          error: (err as Error)?.message,
        });
      }
    }
    delete components[key];
  };

  const cleanupAllComponents = (): void => {
    Object.keys(components).forEach((key) => cleanupComponent(key));
    refs.sectionLayout.value = null;
    refs.slots.value = null;
    refs.navBarPlaceholder.innerHTML = "";
    refs.stateVectorPlaceholder.innerHTML = "";
    refs.controlBarPlaceholder.innerHTML = "";
    refs.contentArea.innerHTML = "";
  };

  const updateOrCreate = (
    host: HTMLElement,
    componentKey: string,
    createFn: () => ComponentRef,
    updateArgs?: any[],
  ): void => {
    const existing = components[componentKey];

    if (existing && existing.update && updateArgs) {
      try {
        existing.update(...updateArgs);
        return;
      } catch (err) {
        log.warn("component.update.fail", {
          key: componentKey,
          error: (err as Error)?.message,
        });
        cleanupComponent(componentKey);
      }
    }

    if (components[componentKey]) {
      cleanupComponent(componentKey);
    }

    const next = createFn();
    host.innerHTML = "";
    host.appendChild(next);
    components[componentKey] = next;
  };

  const ensureSectionLayout = (): void => {
    if (refs.sectionLayout.value && refs.slots.value) {
      hooks.syncAllStickyTops();
      return;
    }

    if (refs.sectionLayout.value) {
      cleanupComponent("sectionLayout");
      refs.sectionLayout.value = null;
      refs.slots.value = null;
    }

    const layout = renderPortfolioSectionLayout(
      (id: PortfolioSectionId, expanded: boolean) => {
        if (hooks.getControlState().focusMode !== "all") return;
        if (expanded) hooks.manualExpandedSections.add(id);
        else hooks.manualExpandedSections.delete(id);
      },
    );

    refs.contentArea.innerHTML = "";
    refs.contentArea.appendChild(layout);

    const navBarEl = layout.getNavBar();
    refs.navBarPlaceholder.innerHTML = "";
    refs.navBarPlaceholder.appendChild(navBarEl);
    refs.navBarPlaceholder.style.display = "block";
    navBarEl.style.zIndex = "var(--z-sticky-nav, 100)";

    hooks.syncAllStickyTops();

    refs.sectionLayout.value = layout;
    components.sectionLayout = layout;

    refs.slots.value = {
      health: layout.getCardSlot("overview", "healthScore", 1, "text"),
      greeks: layout.getCardSlot("overview", "greeks", 1, "chart"),
      betaExposure: layout.getCardSlot(
        "exposure",
        "betaExposure",
        3,
        "text",
        1,
        true,
      ),
      heatmap: layout.getCardSlot("scenarios", "heatmap", 3, "interactive"),
      rebalance: layout.getCardSlot(
        "governance",
        "rebalanceIdeas",
        3,
        "text",
        1,
        true,
      ),
    };
  };

  return {
    cleanupComponent,
    cleanupAllComponents,
    updateOrCreate,
    ensureSectionLayout,
  };
}
