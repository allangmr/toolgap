import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    // Deployed ToolGap must expose tools in Chrome without a complete native
    // document.modelContext. Set NEXT_PUBLIC_WEBMCP_POLYFILL=0 to disable.
    NEXT_PUBLIC_WEBMCP_POLYFILL:
      process.env.NEXT_PUBLIC_WEBMCP_POLYFILL === "0" ? "0" : "1",
  },
};

export default nextConfig;
