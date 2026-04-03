import {
  createSectionLayout,
  type GenericSectionLayoutResult,
  type SectionConfig,
} from "../../../components/core/sectionLayout";
import { DS_COLORS } from "../../../components/core/theme";
import type { PortfolioSectionId } from "../../types";

export type PortfolioSectionLayoutResult =
  GenericSectionLayoutResult<PortfolioSectionId>;

const SECTIONS: SectionConfig<PortfolioSectionId>[] = [
  {
    id: "overview",
    title: "OVERVIEW",
    tabLabel: "Overview",
    defaultExpanded: true,
    accentColor: DS_COLORS.raw.info,
    accentBg: "rgba(0, 122, 255, 0.08)",
  },
  {
    id: "exposure",
    title: "EXPOSURE",
    tabLabel: "Exposure",
    defaultExpanded: true,
    accentColor: DS_COLORS.raw.neutral,
    accentBg: "rgba(215, 129, 0, 0.08)",
  },
  {
    id: "scenarios",
    title: "SCENARIOS",
    tabLabel: "Scenarios",
    defaultExpanded: true,
    accentColor: DS_COLORS.raw.purple,
    accentBg: "rgba(88, 86, 214, 0.08)",
  },
  {
    id: "governance",
    title: "GOVERNANCE",
    tabLabel: "Govern",
    defaultExpanded: true,
    accentColor: DS_COLORS.raw.muted,
    accentBg: "rgba(142, 142, 147, 0.08)",
  },
];

export function renderPortfolioSectionLayout(
  onToggle: (id: PortfolioSectionId, expanded: boolean) => void,
): PortfolioSectionLayoutResult {
  return createSectionLayout({
    sections: SECTIONS,
    onToggle,
    navBarStickyTop: "var(--section-nav-sticky-top, 0px)",
    gridGap: "12px",
    gridPadding: "12px",
    rootGap: "16px",
    navGap: "6px",
    navPadding: "6px 12px",
    pillPadding: "4px 12px",
    headerPadding: "8px 14px",
    headerTitleUppercase: true,
  });
}
