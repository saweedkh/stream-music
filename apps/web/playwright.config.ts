import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
/** API calls go through Next dev rewrites (same origin as the app) unless overridden. */
const apiURL = process.env.PLAYWRIGHT_API_URL ?? baseURL;

const systemChrome =
  process.env.PLAYWRIGHT_CHROME_PATH ??
  (process.platform === "linux"
    ? ["/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"].find(
        (p) => {
          try {
            require("node:fs").accessSync(p);
            return true;
          } catch {
            return false;
          }
        },
      )
    : undefined);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  timeout: 90_000, 
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(systemChrome ? { launchOptions: { executablePath: systemChrome } } : {}),
      },
    },
    {
      name: "chromium-playback",
      testMatch: /playback-channel\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          ...(systemChrome ? { executablePath: systemChrome } : {}),
          args: ["--autoplay-policy=document-user-activation-required", "--no-sandbox", "--disable-dev-shm-usage"],
        },
      },
    },
  ],
  webServer: process.env.CI
    ? undefined
    : [
        {
          command: "npm run dev -- -H 127.0.0.1 -p 3000",
          url: baseURL,
          reuseExistingServer: true,
          timeout: 120_000,
          env: {
            ...process.env,
            DEV_REMOTE_ORIGIN: process.env.DEV_REMOTE_ORIGIN ?? "http://127.0.0.1:8002",
            NEXT_PUBLIC_WS_BASE_URL: process.env.NEXT_PUBLIC_WS_BASE_URL ?? "ws://127.0.0.1:8002",
          },
        },
      ],
  metadata: { apiURL },
});
