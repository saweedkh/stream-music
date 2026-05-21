import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Native shells load the hosted Next app in a WebView (recommended for App Router).
 * Set CAPACITOR_SERVER_URL to your dev machine IP for devices/emulators, or production URL.
 */
const serverUrl =
  process.env.CAPACITOR_SERVER_URL?.trim() ||
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  "http://127.0.0.1:3000";

const config: CapacitorConfig = {
  appId: "com.streammusic.app",
  appName: "Stream Music",
  webDir: "capacitor-www",
  server: {
    url: serverUrl,
    cleartext: serverUrl.startsWith("http://"),
    androidScheme: serverUrl.startsWith("https") ? "https" : "http",
  },
  android: {
    allowMixedContent: true,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      androidSplashResourceName: "splash",
      backgroundColor: "#0a0a0a",
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0a0a0a",
    },
  },
};

export default config;
