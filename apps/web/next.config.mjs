/** @type {import('next').NextConfig} */
const devRemoteOrigin = process.env.DEV_REMOTE_ORIGIN?.replace(/\/$/, "") ?? "";
const isDockerBuild = process.env.DOCKER_BUILD === "1";

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["vaul", "music-metadata-browser", "html5-qrcode"],
  output: "standalone",
  eslint: {
    // Lint in CI/dev; skip during Docker prod build to cut memory on small VPS.
    ignoreDuringBuilds: isDockerBuild,
  },
  ...(isDockerBuild ? { experimental: { cpus: 1 } } : {}),
  async rewrites() {
    const rewrites = [{ source: "/favicon.ico", destination: "/icon.svg" }];
    const apiUpstream =
      devRemoteOrigin ||
      (process.env.NODE_ENV === "development" ? process.env.API_UPSTREAM?.replace(/\/$/, "") || "http://127.0.0.1:8000" : "");
    if (apiUpstream) {
      rewrites.push(
        { source: "/api/:path*", destination: `${apiUpstream}/api/:path*` },
        { source: "/ws/:path*", destination: `${apiUpstream}/ws/:path*` },
        { source: "/audio/:path*", destination: `${apiUpstream}/audio/:path*` },
      );
    }
    return rewrites;
  },
  env: {
    NEXT_PUBLIC_WEBPUSH_VAPID_PUBLIC_KEY:
      process.env.NEXT_PUBLIC_WEBPUSH_VAPID_PUBLIC_KEY ?? "",
  },
};

let exportedConfig = nextConfig;

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  const { withSentryConfig } = await import("@sentry/nextjs");
  exportedConfig = withSentryConfig(nextConfig, {
    silent: true,
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
  });
}

export default exportedConfig;
