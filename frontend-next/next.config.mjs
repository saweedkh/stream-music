/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["vaul"],
  output: "standalone",
  env: {
    NEXT_PUBLIC_WEBPUSH_VAPID_PUBLIC_KEY:
      process.env.NEXT_PUBLIC_WEBPUSH_VAPID_PUBLIC_KEY ?? "",
  },
};

export default nextConfig;
