import { ui_createElement } from "../../components/core/createElement";
import { DS_COLORS } from "../../components/core/theme";
import { openCompanyDetailsPanel } from "../../components/companyDetailsCard/CompanyDetailsPanel";

// Module-level pending symbol — set before navigating to this page
let _pendingSymbol: string | null = null;

export function setAnalysisSymbol(symbol: string): void {
  _pendingSymbol = symbol;
}

export function consumePendingSymbol(): string {
  const sym = (_pendingSymbol ?? "").toUpperCase();
  _pendingSymbol = null;
  return sym;
}

// ── Symbol input row ────────────────────────────────────────────────────────

export interface SymbolInputResult {
  symbolRow: HTMLElement;
  symbolInput: HTMLInputElement;
}

export function createSymbolInput(initialSymbol: string): SymbolInputResult {
  const symbolRow = ui_createElement("div", {
    styleString:
      "display: flex; align-items: center; gap: 8px; flex-wrap: wrap;" +
      " padding: 12px 16px; border: 1px solid var(--ios-border); border-radius: 14px;" +
      " background: rgba(255,255,255,0.5);",
  });
  symbolRow.appendChild(
    ui_createElement("span", {
      text: "Symbol",
      styleString:
        "font-size: 12px; font-weight: 600; color: var(--ios-text-secondary); text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap;",
    }),
  );

  const symbolInput = ui_createElement("input", {
    props: { type: "text", placeholder: "e.g. AAPL" },
    styleString:
      "padding: 5px 10px; font-size: 12px; font-weight: 700; border: 1px solid var(--ios-border);" +
      " border-radius: 8px; outline: none; width: 130px; font-family: var(--ios-font);" +
      " background: rgba(255,255,255,0.8); text-transform: uppercase; letter-spacing: 0.5px;",
  }) as HTMLInputElement;
  symbolInput.value = initialSymbol;
  symbolRow.appendChild(symbolInput);

  const companyInfoBtn = ui_createElement("button", {
    text: "Company Info",
    styleString:
      "font-size: 11px; font-weight: 600; padding: 5px 10px; border-radius: 8px; cursor: pointer;" +
      " border: 1px solid rgba(90,200,250,0.3); background: rgba(90,200,250,0.10);" +
      ` color: ${DS_COLORS.cyan}; transition: background 0.15s; white-space: nowrap;`,
  }) as HTMLButtonElement;
  companyInfoBtn.addEventListener("click", () => {
    const sym = symbolInput.value.trim().toUpperCase();
    if (sym) openCompanyDetailsPanel(sym);
  });
  symbolRow.appendChild(companyInfoBtn);

  return { symbolRow, symbolInput };
}
