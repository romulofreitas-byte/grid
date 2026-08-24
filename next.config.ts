import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg", "@react-pdf/renderer"],
};

export default nextConfig;
