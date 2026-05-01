// Z-index layer scale — mirrors CSS custom properties.
// Three-zone architecture: T2 (page content), T1 (nav), T0 (body portals).

export const AX_Z = {
  // T2 — page content
  tableHeader: 10,
  tableStickyCell: 30,
  tableStickyHeader: 32,
  stickyNav: 100,
  stickyControl: 110,
  stickyState: 120,
  pagePopover: 210,

  // T1 — nav-bar chrome
  navDropdown: 200,

  // T0 — body portals, position:fixed
  alert: 100_000,
  notification: 100_100,
  dock: 100_200,
  floatingPanel: 100_300,
  floatingToggle: 100_400,
  modalBackdrop: 100_500,
  modalContent: 100_600,
  tooltip: 100_700,
} as const;

export type AxZKey = keyof typeof AX_Z;
