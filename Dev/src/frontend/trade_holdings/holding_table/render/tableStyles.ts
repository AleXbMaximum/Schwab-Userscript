const TABLE_CSS_STYLES = `

.table-scroll .ios-table {
    /* Allow ::after/::before gradient overlays to visually overflow the table boundary. */
    overflow: visible !important;
}

.table-scroll {
    position: relative;
    overflow-x: auto;
    overflow-y: visible;
}

@keyframes tableFlashGreen {
    0% { background-color: rgba(70, 210, 70, 0); }
    12% { background-color: rgba(70, 210, 70, 0.18); }
    100% { background-color: rgba(70, 210, 70, 0); }
}

@keyframes tableFlashRed {
    0% { background-color: rgba(210, 70, 70, 0); }
    12% { background-color: rgba(210, 70, 70, 0.18); }
    100% { background-color: rgba(210, 70, 70, 0); }
}

/* Flash overlay uses ::before pseudo-element so the td's own background-color
   remains available for heatmap tints, conditional formatting, etc. */
.table-flash-green::before,
.table-flash-red::before {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
}

.table-flash-green::before {
    animation: tableFlashGreen 0.6s ease;
}

.table-flash-red::before {
    animation: tableFlashRed 0.6s ease;
}

.table-row {
    transition: background-color 0.15s ease;
}

.table-row--child {
    background-color: var(--ios-secondary-bg);
}

.table-row--summary {
    cursor: pointer;
}

.table-row--summary td {
    border-top: 1px solid rgba(180, 190, 210, 0.5);
    padding-top: 10px;
}

.table-row--group + .table-row--summary td,
.table-row--major-group + .table-row--summary td {
    border-top: none;
    padding-top: 6px;
}

.table-row--group {
    font-weight: 700;
    background-color: rgba(27, 95, 167, 0.08);
}

.table-row--major-group {
    background-color: rgba(27, 95, 167, 0.15);
    color: black;
}

.table-header-cell {
    white-space: nowrap;
    text-align: right;
    cursor: pointer;
    font-weight: 700;
    color: var(--ios-text-primary);
    padding: 8px 10px;
    background-color: inherit;
    border-bottom: 1px solid rgba(60, 60, 67, 0.12);
    user-select: none;
    position: relative;
    transition: opacity 0.2s ease;
}

.table-header-cell--sticky {
    position: sticky;
    left: 0;
    z-index: var(--z-table-sticky-header, 32);
    text-align: left;
    background-color: inherit;
    border-right: 1px solid rgba(0, 0, 0, 0.10);
}

.table-header-cell--sticky::after {
    content: '';
    position: absolute;
    top: 0;
    right: -18px;
    width: 18px;
    height: 100%;
    background: linear-gradient(to right, rgba(255, 255, 255, 0.90), rgba(255, 255, 255, 0));
    pointer-events: none;
}

.table-header-cell--sticky-right {
    position: sticky;
    right: 0;
    z-index: var(--z-table-sticky-header, 32);
    text-align: center;
    cursor: default;
    background-color: inherit;
    border-left: 1px solid rgba(0, 0, 0, 0.10);
}

.table-header-cell--sticky-right::before {
    content: '';
    position: absolute;
    top: 0;
    left: -18px;
    width: 18px;
    height: 100%;
    background: linear-gradient(to left, rgba(255, 255, 255, 0.90), rgba(255, 255, 255, 0));
    pointer-events: none;
}

.table-header-cell--derived {
    font-weight: 500;
    color: var(--ios-table-header);
}

.table-header-cell--spacer {
    cursor: default;
    width: auto;
}

.table-header-cell--dragging {
    opacity: 0.35; /* DS_OPACITY.dragging */
}

.table-header-cell--drop-left {
    box-shadow: inset 3px 0 0 0 var(--ios-blue);
}

.table-header-cell--drop-right {
    box-shadow: inset -3px 0 0 0 var(--ios-blue);
}

.table-cell-symbol,
.table-cell-text,
.table-cell-numeric,
.table-cell-group {
    padding: 6px 10px;
    white-space: nowrap;
    vertical-align: middle;
}

.table-cell-numeric {
    text-align: right;
    position: relative;
}

.table-cell-numeric--positive {
    color: var(--ios-green);
}

.table-cell-numeric--negative {
    color: var(--ios-red);
}

.table-cell-spacer {
    padding: 6px 10px;
    text-align: left;
}

.table-cell-symbol {
    text-align: left;
    font-weight: 700;
    color: var(--ios-table-header);
    position: relative;
}

.table-symbol-inline {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
}

.table-cell-symbol--child {
    padding-left: 36px;
    font-size: 0.9em;
}

.table-symbol-link {
    color: inherit;
    text-decoration: none;
    cursor: pointer;
}

.table-symbol-label {
    display: inline-block;
}

.table-symbol-label--summary {
    width: var(--summary-ticker-slot-width, auto);
    flex: 0 0 auto;
}

.table-symbol-link:hover {
    text-decoration: underline;
}

.table-cell-sticky {
    position: sticky;
    left: 0;
    z-index: var(--z-table-sticky-cell, 30);
    background-color: var(--ios-background);
    border-right: 1px solid rgba(0, 0, 0, 0.10);
}

.table-row--child .table-cell-sticky {
    background-color: var(--ios-secondary-bg);
}

.table-row--group .table-cell-sticky {
    background-color: rgba(27, 95, 167, 0.08);
}

.table-row--major-group .table-cell-sticky {
    background-color: rgba(27, 95, 167, 0.15);
}

.table-cell-sticky::after {
    content: '';
    position: absolute;
    top: 0;
    right: -18px;
    width: 18px;
    height: 100%;
    background: linear-gradient(to right, rgba(0, 0, 0, 0.07), rgba(0, 0, 0, 0));
    pointer-events: none;
}

.table-cell-sticky-right {
    position: sticky;
    right: 0;
    z-index: var(--z-table-sticky-cell, 30);
    background-color: var(--ios-background);
    border-left: 1px solid rgba(0, 0, 0, 0.10);
}

.table-row--child .table-cell-sticky-right {
    background-color: var(--ios-secondary-bg);
}

.table-row--group .table-cell-sticky-right {
    background-color: rgba(27, 95, 167, 0.08);
}

.table-row--major-group .table-cell-sticky-right {
    background-color: rgba(27, 95, 167, 0.15);
}

.table-cell-sticky-right::before {
    content: '';
    position: absolute;
    top: 0;
    left: -18px;
    width: 18px;
    height: 100%;
    background: linear-gradient(to left, rgba(0, 0, 0, 0.07), rgba(0, 0, 0, 0));
    pointer-events: none;
}

.table-action-btn {
    font-size: 11px;
    padding: 3px 8px;
    border-radius: 6px;
    cursor: pointer;
    border: 1px solid rgba(0, 0, 0, 0.13);
    background: rgba(255, 255, 255, 0.85);
    font-family: var(--ios-font, -apple-system, BlinkMacSystemFont, sans-serif);
    white-space: nowrap;
    line-height: 1.4;
    vertical-align: middle;
    transition: background-color 0.1s ease, border-color 0.1s ease;
}

.table-action-btn:hover {
    background: var(--ios-background);
    border-color: rgba(0, 0, 0, 0.22);
}

.table-action-btn--info {
    color: var(--ios-teal, #5AC8FA);
}

.table-action-btn--news {
    color: var(--ios-blue, #007AFF);
    margin-left: 4px;
}

.table-action-btn--ai {
    color: var(--ios-purple, #AF52DE);
    margin-left: 4px;
}

.table-cell-text {
    text-align: left;
}

.table-cell-text--right {
    text-align: right;
}

.table-cell-group {
    text-align: left;
}

.table-group-title {
    font-weight: 700;
    color: var(--ios-text-primary);
}

.table-asset-badges {
    margin-left: 0;
    white-space: nowrap;
    font-weight: 700;
    font-size: 0.82em;
    display: inline-flex;
    align-items: flex-start;
    gap: 4px;
}

.table-row--summary .table-asset-badges {
    width: var(--summary-badge-slot-width, auto);
    flex: 0 0 auto;
    justify-content: flex-start;
}

.table-badge-group {
    display: inline-flex;
    align-items: flex-start;
    gap: 1px;
    line-height: 1;
}

.table-badge-letter {
    color: var(--ios-text-primary);
    line-height: 1;
}

.table-badge-count {
    font-size: 0.66em;
    line-height: 1;
    font-weight: 700;
    position: relative;
    top: -0.45em;
    margin-left: 1px;
}

.table-badge-count--positive {
    color: var(--ios-green);
}

.table-badge-count--negative {
    color: var(--ios-red);
}

.table-row-border-top {
    border-top: 3px solid var(--ios-border);
}

.table-cell-symbol--has-sparkline {
    padding-right: 10px;
}

.table-sparkline-wrap {
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
    line-height: 0;
}

.table-sparkline-canvas {
    pointer-events: none;
    display: block;
}

.table-header-cell[data-sort="desc"]::after {
    content: ' ▼';
    font-size: 0.75em;
    color: var(--ios-blue, #007AFF);
}

.table-header-cell[data-sort="asc"]::after {
    content: ' ▲';
    font-size: 0.75em;
    color: var(--ios-blue, #007AFF);
}
`;

export function injectTableStyles(): void {
  const styleId = "alexquant-table-styles";
  let style = document.getElementById(styleId) as HTMLStyleElement | null;

  if (!style) {
    style = document.createElement("style");
    style.id = styleId;
    document.head.appendChild(style);
  }

  // Always refresh the stylesheet content so latest sticky behavior wins.
  if (style.textContent !== TABLE_CSS_STYLES) {
    style.textContent = TABLE_CSS_STYLES;
  }
}
