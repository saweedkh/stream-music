#!/usr/bin/env sh
# Prints best-effort primary IPv4 for this machine (for ALLOWED_HOSTS / CORS hints).

detect_primary_ip() {
  if command -v ip >/dev/null 2>&1; then
    _src="$(ip -4 route get 1.1.1.1 2>/dev/null | sed -n 's/.*src \([^ ]*\).*/\1/p')"
    if [ -n "$_src" ]; then
      printf '%s' "$_src"
      return 0
    fi
  fi
  if command -v route >/dev/null 2>&1 && command -v ipconfig >/dev/null 2>&1; then
    _iface="$(route -n get default 2>/dev/null | awk '/interface:/{print $2}')"
    if [ -n "$_iface" ]; then
      _src="$(ipconfig getifaddr "$_iface" 2>/dev/null)"
      if [ -n "$_src" ]; then
        printf '%s' "$_src"
        return 0
      fi
    fi
  fi
  if command -v hostname >/dev/null 2>&1; then
    _src="$(hostname -I 2>/dev/null | awk '{print $1}')"
    if [ -n "$_src" ]; then
      printf '%s' "$_src"
      return 0
    fi
  fi
  printf '%s' "127.0.0.1"
}

detect_primary_ip
