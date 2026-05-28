/** Shared layout: mobile = document scroll + flat chrome; lg+ = nested panel cage. */

/** Bottom padding when the global/channel mini player is docked (see --player-mini-inset). */
export const playerDockPad =
  "pb-[calc(var(--player-mini-inset,0px)+env(safe-area-inset-bottom,0px))]";

/** Channel room: mini player + mobile tab bar above it. */
export const playerDockPadWithRoomTabs =
  "max-lg:pb-[calc(var(--player-mini-inset,0px)+var(--room-mobile-tabs-height,3.25rem)+env(safe-area-inset-bottom,0px))] lg:pb-[calc(var(--player-mini-inset,0px)+env(safe-area-inset-bottom,0px))]";

export const mobilePageRoot = `flex min-h-dvh flex-col ${playerDockPad} max-lg:overflow-visible`;

export const mobilePageRootChannel = `flex min-h-dvh flex-col ${playerDockPadWithRoomTabs} max-lg:overflow-visible`;

export const desktopPageRoot =
  "lg:h-dvh lg:max-h-dvh lg:min-h-0 lg:overflow-hidden";

export const mobileMain = "flex w-full flex-col max-lg:flex-none max-lg:overflow-visible lg:flex-1";

export const desktopMain = "lg:min-h-0 lg:overflow-hidden";

export const shellFrame =
  "relative flex w-full flex-col max-lg:flex-none max-lg:overflow-visible lg:min-h-0 lg:flex-1 lg:overflow-hidden lg:rounded-2xl lg:bg-[var(--workspace-canvas)] lg:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] lg:flex-row dark:lg:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]";

export const shellMain =
  "relative flex w-full flex-col max-lg:flex-none max-lg:overflow-visible lg:min-h-0 lg:min-w-0 lg:flex-1 lg:overflow-hidden";

export const shellBody =
  "relative flex w-full flex-col max-lg:flex-none max-lg:overflow-visible lg:min-h-0 lg:flex-1 lg:overflow-hidden";

export const shellContent =
  "relative mx-auto flex w-full flex-col max-lg:flex-none max-lg:overflow-visible lg:mx-0 lg:h-full lg:min-h-0 lg:flex-1 lg:overflow-hidden";

/** Dashboard / hub panels: grow on desktop only — mobile uses page scroll. */
export const hubPanelRoot = "flex w-full flex-col max-lg:flex-none lg:min-h-0 lg:flex-1";

export const panelMobileFlat =
  "max-lg:rounded-none max-lg:border-0 max-lg:bg-transparent max-lg:shadow-none max-lg:before:hidden";

export const panelLgSurface =
  "lg:rounded-xl lg:bg-[var(--workspace-panel)] lg:backdrop-blur-xl";

/** @deprecated Use panelLgSurface — kept for channel room panels until migrated */
export const panelLgCage = panelLgSurface;
