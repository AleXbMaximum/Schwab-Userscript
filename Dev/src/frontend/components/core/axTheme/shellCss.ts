// App-shell CSS — composed from per-section files in ./shellCss.*.ts.
// Theme-aware: every value reads from --ax-* CSS vars.
// The previous monolithic version lived in this file; the per-section split keeps each piece below 600 lines.

import { axShellCssCore } from "./shellCss.core";
import { axShellCssComponents } from "./shellCss.components";
import { axShellCssResponsive } from "./shellCss.responsive";

export const axShellCss = axShellCssCore + axShellCssComponents + axShellCssResponsive;
