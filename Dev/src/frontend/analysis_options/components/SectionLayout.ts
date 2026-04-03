import {
  createSectionLayout,
  type GenericSectionLayoutResult,
  type SectionConfig,
} from "../../components/core/sectionLayout";
import { DS_COLORS } from "../../components/core/theme";
import type { SectionId } from "../types";

export type SectionLayoutResult = GenericSectionLayoutResult<SectionId>;

const SECTIONS: SectionConfig<SectionId>[] = [
  {
    id: "signal",
    title: "Signal",
    tabLabel: "Signal",
    defaultExpanded: true,
    accentColor: "#007AFF",
    accentBg: "rgba(0, 122, 255, 0.08)",
  },
  {
    id: "iv",
    title: "Iv",
    tabLabel: "Iv",
    defaultExpanded: true,
    accentColor: DS_COLORS.raw.purple,
    accentBg: "rgba(88, 86, 214, 0.08)",
  },
  {
    id: "diagnostics",
    title: "Diagnostics",
    tabLabel: "Diag",
    defaultExpanded: true,
    accentColor: "#8E8E93",
    accentBg: "rgba(142, 142, 147, 0.08)",
  },
];

export function renderSectionLayout(
  onToggle: (id: SectionId, expanded: boolean) => void,
): SectionLayoutResult {
  return createSectionLayout({
    sections: SECTIONS,
    onToggle,
    showNavInfo: true,
    navBarStickyTop: "var(--section-nav-sticky-top, 0px)",
    unitHeight: 500,
  });
}
