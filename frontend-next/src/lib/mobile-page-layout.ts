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
  "relative flex w-full flex-col max-lg:flex-none max-lg:overflow-visible lg:min-h-0 lg:flex-1 lg:overflow-hidden lg:rounded-2xl lg:border lg:border-border/50 lg:bg-card/40 lg:flex-row";

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

export const panelLgCage =
  "lg:rounded-2xl lg:border lg:border-border/60 lg:bg-gradient-to-br lg:from-background/95 lg:via-[var(--brand-subtle)] lg:to-background/95 lg:backdrop-blur-2xl";
