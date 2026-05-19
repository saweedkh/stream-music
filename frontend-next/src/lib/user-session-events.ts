export const USER_SESSION_REFRESH_EVENT = "stream-music:user-refresh";

export function dispatchUserSessionRefresh() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(USER_SESSION_REFRESH_EVENT));
}

export function listenUserSessionRefresh(handler: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(USER_SESSION_REFRESH_EVENT, handler);
  return () => window.removeEventListener(USER_SESSION_REFRESH_EVENT, handler);
}
