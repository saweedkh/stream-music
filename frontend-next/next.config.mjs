/** @type {import('next').NextConfig} */
const devRemoteOrigin = process.env.DEV_REMOTE_ORIGIN?.replace(/\/$/, "") ?? "";

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["vaul", "music-metadata"],
  output: "standalone",
  async rewrites() {
    const rewrites = [{ source: "/favicon.ico", destination: "/icon.svg" }];
    if (devRemoteOrigin) {
      rewrites.push(
        { source: "/api/:path*", destination: `${devRemoteOrigin}/api/:path*` },
        { source: "/ws/:path*", destination: `${devRemoteOrigin}/ws/:path*` },
        { source: "/audio/:path*", destination: `${devRemoteOrigin}/audio/:path*` },
      );
    }
    return rewrites;
  },
  env: {
    NEXT_PUBLIC_WEBPUSH_VAPID_PUBLIC_KEY:
      process.env.NEXT_PUBLIC_WEBPUSH_VAPID_PUBLIC_KEY ?? "",
  },
};

export default nextConfig;
