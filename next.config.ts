import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 is a native module; keep it out of the client/server bundles.
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
