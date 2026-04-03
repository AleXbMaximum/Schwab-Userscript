import { ui_createElement } from "../../../components/core/createElement";
import { DS_COMPONENTS, DS_TYPOGRAPHY } from "../../../components/core/theme";
import { OPTIONS_SEMANTIC_COLORS as C } from "frontend/charts/ChartTheme";
import { ladderValue } from "frontend/charts/ChartUtils";
import type { OptionsWallData, KeyLevelsLadderData } from "backend/computation/options/types";
import {
  toggleFocusedLevel,
  isLevelActive,
  subscribeFocusedLevels,
} from "../../focus/focusStrike";
import { formatStrike } from "shared/utils/formatters";

type LevelDef = {
  id: "putWall" | "callWall" | "maxPain" | "flip" | "spot" | "forward" | "minIV";
  lineLabel: string;
  strike: number | null;
  detail: string;
  color: string;
  bg: string;
};

export function renderKeyLevelsCards(
  wallData: OptionsWallData,
  ladder: KeyLevelsLadderData,
  _scopeLabel: string = "Selected",
  sourceNote: string = "",
): HTMLElement & {
  cleanup?: () => void;
  update?: (
    data: OptionsWallData,
    l: KeyLevelsLadderData,
    scope?: string,
    note?: string,
  ) => void;
} {
  const panel = ui_createElement("div", {
    styleString:
      DS_COMPONENTS.panel +
      " display: flex; flex-direction: column; height: 100%; overflow: hidden;",
  }) as HTMLElement & {
    cleanup?: () => void;
    update?: (
      data: OptionsWallData,
      l: KeyLevelsLadderData,
      scope?: string,
      note?: string,
    ) => void;
  };

  panel.appendChild(
    ui_createElement("h3", {
      text: "Key Levels",
      styleString: DS_TYPOGRAPHY.panelTitle + " flex-shrink: 0;",
    }),
  );
  panel.appendChild(
    ui_createElement("div", {
      text: "OI concentration panel. Level markers use Unified Key Levels Ladder values to avoid source mismatch.",
      styleString: DS_TYPOGRAPHY.panelDesc + " flex-shrink: 0;",
    }),
  );
  const sourceNoteEl = ui_createElement("div", {
    text: sourceNote,
    styleString:
      "font-size: 10px; color: var(--ios-text-secondary); margin: -6px 0 10px 0; flex-shrink: 0;" +
      (sourceNote ? "" : " display: none;"),
  });
  panel.appendChild(sourceNoteEl);

  const contentContainer = ui_createElement("div", {
    styleString: "flex: 1 1 0; min-height: 0; overflow-y: auto;",
  });
  panel.appendChild(contentContainer);

  let currentData = wallData;
  let currentLadder = ladder;

  const buildLevels = (): LevelDef[] => [
    {
      id: "putWall",
      lineLabel: "Put Wall",
      strike: ladderValue(currentLadder, "putWall"),
      detail: "Max dealer put gamma",
      color: C.putWall,
      bg: C.bgNegative,
    },
    {
      id: "callWall",
      lineLabel: "Call Wall",
      strike: ladderValue(currentLadder, "callWall"),
      detail: `OI: ${currentData.callWallOI.toLocaleString("en-US")}`,
      color: C.callWall,
      bg: C.bgPositive,
    },
    {
      id: "maxPain",
      lineLabel: "Max Pain",
      strike: ladderValue(currentLadder, "maxPain"),
      detail: "Expiry magnet",
      color: C.maxPain,
      bg: "rgba(215,129,0,0.06)",
    },
    {
      id: "flip",
      lineLabel: "\u03B3 Flip",
      strike: ladderValue(currentLadder, "flip"),
      detail: `Positive ${C.arrowUp}${C.arrowDown} Negative`,
      color: C.gammaFlip,
      bg: "rgba(142,68,173,0.06)",
    },
    {
      id: "spot",
      lineLabel: "Spot",
      strike: currentData.underlyingPrice,
      detail: "Current price",
      color: C.spot,
      bg: C.bgInfo,
    },
    {
      id: "forward",
      lineLabel: "Forward",
      strike: currentData.forward,
      detail: "Cost-of-carry adjusted",
      color: "#00C7BE",
      bg: "rgba(0,199,190,0.06)",
    },
    {
      id: "minIV",
      lineLabel: "Min IV",
      strike: currentData.minIVStrike,
      detail: "Lowest implied vol strike",
      color: "#AF52DE",
      bg: "rgba(175,82,222,0.06)",
    },
  ];

  const SOURCE_MAP: Partial<Record<LevelDef["id"], string>> = {
    putWall: "GEX",
    callWall: "OI",
    flip: "GEX",
    minIV: "IV",
    forward: "Carry",
  };

  const renderLevels = () => {
    contentContainer.innerHTML = "";

    const table = ui_createElement("div", {
      styleString:
        "display: grid; grid-template-columns: auto 1fr auto auto; gap: 0; align-items: center;" +
        " font-variant-numeric: tabular-nums lining-nums;",
    });

    const levels = buildLevels();

    for (const lvl of levels) {
      const active = isLevelActive(lvl.strike, lvl.lineLabel);
      const rowBg = active ? lvl.bg : "transparent";

      const row = ui_createElement("button", {
        styleString:
          "display: contents; cursor: pointer; font-family: var(--ios-font);",
        events: {
          click: () => {
            if (lvl.strike != null) {
              toggleFocusedLevel(lvl.strike, lvl.lineLabel, lvl.color);
            }
          },
        },
      });

      // Color dot + label
      const labelCell = ui_createElement("div", {
        styleString:
          `display: flex; align-items: center; gap: 6px; padding: 5px 8px; background: ${rowBg};` +
          " border-radius: 6px 0 0 6px;",
      });
      labelCell.appendChild(
        ui_createElement("span", {
          styleString:
            `display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${lvl.color}; flex-shrink: 0;`,
        }),
      );
      labelCell.appendChild(
        ui_createElement("span", {
          text: lvl.lineLabel,
          styleString:
            "font-size: 13px; font-weight: 700; color: var(--ios-text-primary); white-space: nowrap;",
        }),
      );
      row.appendChild(labelCell);

      // Detail
      row.appendChild(
        ui_createElement("div", {
          text: lvl.detail,
          styleString:
            `font-size: 12px; color: var(--ios-text-secondary); padding: 5px 4px; background: ${rowBg};` +
            " white-space: nowrap; overflow: hidden; text-overflow: ellipsis;",
        }),
      );

      // Source tag
      row.appendChild(
        ui_createElement("div", {
          text: SOURCE_MAP[lvl.id] ?? "",
          styleString:
            `font-size: 10px; color: var(--ios-text-secondary); padding: 5px 4px; background: ${rowBg};` +
            " white-space: nowrap;",
        }),
      );

      // Strike value
      row.appendChild(
        ui_createElement("div", {
          text: formatStrike(lvl.strike),
          styleString:
            `font-size: 13px; font-weight: 800; color: ${lvl.color}; padding: 5px 8px; background: ${rowBg};` +
            " border-radius: 0 6px 6px 0; text-align: right; white-space: nowrap;",
        }),
      );

      table.appendChild(row);
    }

    contentContainer.appendChild(table);
  };

  renderLevels();

  const unsubscribeFocus = subscribeFocusedLevels(() => {
    renderLevels();
  });

  panel.update = (
    data: OptionsWallData,
    l: KeyLevelsLadderData,
    _scope?: string,
    note?: string,
  ) => {
    currentData = data;
    currentLadder = l;
    if (note != null) {
      sourceNoteEl.textContent = note;
      sourceNoteEl.style.display = note ? "" : "none";
    }
    renderLevels();
  };

  panel.cleanup = () => {
    unsubscribeFocus();
  };

  return panel;
}
