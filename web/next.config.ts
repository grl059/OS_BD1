import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* The app has nothing to export statically - every page reads live state
   * from the C core through /api/run, so the default server output is what
   * we want. Nothing else needs overriding here. */
};

export default nextConfig;
