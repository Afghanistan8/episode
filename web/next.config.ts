import type { NextConfig } from "next";
import { assertProductionConfig } from "./lib/deployment";

if (process.env.NODE_ENV === "production") assertProductionConfig(process.env);

const config: NextConfig = {
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: false },
  // The repository root carries its own lockfile for the deploy and seed
  // scripts, so say plainly that the app's root is this directory.
  turbopack: { root: import.meta.dirname },
};

export default config;
