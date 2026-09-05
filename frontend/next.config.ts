import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // middleware.ts runs on /api/admin and /api/learner too (its matcher only excludes
    // _next/static, _next/image, favicon.ico and api/auth) — Next.js buffers the whole request
    // body up to this cap whenever middleware could read it, truncating anything larger before
    // it reaches the route handler. Track audio uploads (especially uncompressed WAV) routinely
    // exceed the 10MB default, which corrupts the multipart body and breaks track creation.
    proxyClientMaxBodySize: "100mb"
  }
};

export default nextConfig;
