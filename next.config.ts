import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  productionBrowserSourceMaps: false,
  serverExternalPackages: ["pg", "@react-pdf/renderer"],
};

export default nextConfig;
