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
    background-color: var(--ax-bg-subtle);
}

.table-row--summary {
    cursor: pointer;
}

.table-row--summary td {
    border-top: 1px solid var(--ax-border);
    padding-top: 10px;
}

.table-row--group + .table-row--summary td,
.table-row--major-group + .table-row--summary td {
    border-top: none;
    padding-top: 6px;
}

.table-row--group {
    font-weight: 700;
    background-color: var(--ax-bg-group);
}

.table-row--major-group {
    background-color: var(--ax-bg-group-strong);
    color: var(--ax-fg);
}

.table-header-cell {
    white-space: nowrap;
    text-align: right;
    cursor: pointer;
    font-weight: 700;
    color: var(--ax-fg);
    padding: 8px 10px;
    background-color: inherit;
    border-bottom: 1px solid var(--ax-border-subtle);
    user-select: none;
    position: relative;
    transition: opacity 0.2s ease;
}

.table-header-cell--sticky {
    position: sticky;
    left: 0;
    z-index: var(--ax-z-table-sticky-header);
    text-align: left;
    background-color: inherit;
    border-right: 1px solid var(--ax-border-subtle);
}

.table-header-cell--sticky::after {
    content: '';
    position: absolute;
    top: 0;
    right: -18px;
    width: 18px;
    height: 100%;
    background: var(--ax-bg-sticky-fade);
    pointer-events: none;
}

.table-header-cell--sticky-right {
    position: sticky;
    right: 0;
    z-index: var(--ax-z-table-sticky-header);
    text-align: center;
    cursor: default;
    background-color: inherit;
    border-left: 1px solid var(--ax-border-subtle);
}

.table-header-cell--sticky-right::before {
    content: '';
    position: absolute;
    top: 0;
    left: -18px;
    width: 18px;
    height: 100%;
    background: var(--ax-bg-sticky-fade-reverse);
    pointer-events: none;
}

.table-header-cell--derived {
    font-weight: 500;
    color: var(--ax-table-head);
}

.table-header-cell--spacer {
    cursor: default;
    width: auto;
}

.table-header-cell--dragging {
    opacity: 0.35; /* DS_OPACITY.dragging */
}

.table-header-cell--drop-left {
    box-shadow: inset 3px 0 0 0 var(--ax-blue);
}

.table-header-cell--drop-right {
    box-shadow: inset -3px 0 0 0 var(--ax-blue);
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
    color: var(--ax-positive);
}

.table-cell-numeric--negative {
    color: var(--ax-negative);
}

.table-cell-spacer {
    padding: 6px 10px;
    text-align: left;
}

.table-cell-symbol {
    text-align: left;
    font-weight: 700;
    color: var(--ax-table-head);
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
    z-index: var(--ax-z-table-sticky-cell);
    background-color: var(--ax-bg-table);
    border-right: 1px solid var(--ax-border-subtle);
}

.table-row--child .table-cell-sticky {
    background-color: var(--ax-bg-subtle);
}

.table-row--group .table-cell-sticky {
    background-color: var(--ax-bg-group);
}

.table-row--major-group .table-cell-sticky {
    background-color: var(--ax-bg-group-strong);
}

.table-cell-sticky::after {
    content: '';
    position: absolute;
    top: 0;
    right: -18px;
    width: 18px;
    height: 100%;
    background: var(--ax-bg-sticky-shadow);
    pointer-events: none;
}

.table-cell-sticky-right {
    position: sticky;
    right: 0;
    z-index: var(--ax-z-table-sticky-cell);
    background-color: var(--ax-bg-table);
    border-left: 1px solid var(--ax-border-subtle);
}

.table-row--child .table-cell-sticky-right {
    background-color: var(--ax-bg-subtle);
}

.table-row--group .table-cell-sticky-right {
    background-color: var(--ax-bg-group);
}

.table-row--major-group .table-cell-sticky-right {
    background-color: var(--ax-bg-group-strong);
}

.table-cell-sticky-right::before {
    content: '';
    position: absolute;
    top: 0;
    left: -18px;
    width: 18px;
    height: 100%;
    background: var(--ax-bg-sticky-shadow-reverse);
    pointer-events: none;
}

.table-action-btn {
    font-size: var(--ax-fs-sm);
    padding: 3px 8px;
    border-radius: var(--ax-radius-sm);
    cursor: pointer;
    border: 1px solid var(--ax-border);
    background: var(--ax-bg-glass-inset);
    font-family: var(--ax-font-body);
    white-space: nowrap;
    line-height: 1.4;
    vertical-align: middle;
    transition: background-color 0.1s ease, border-color 0.1s ease;
}

.table-action-btn:hover {
    background: var(--ax-bg-row-hover);
    border-color: var(--ax-border-strong);
}

.table-action-btn--info {
    color: var(--ax-cyan);
}

.table-action-btn--news {
    color: var(--ax-blue);
    margin-left: 4px;
}

.table-action-btn--ai {
    color: var(--ax-purple);
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
    color: var(--ax-fg);
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
    color: var(--ax-fg);
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
    color: var(--ax-positive);
}

.table-badge-count--negative {
    color: var(--ax-negative);
}

.table-row-border-top {
    border-top: 3px solid var(--ax-border);
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
    color: var(--ax-blue);
}

.table-header-cell[data-sort="asc"]::after {
    content: ' ▲';
    font-size: 0.75em;
    color: var(--ax-blue);
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
