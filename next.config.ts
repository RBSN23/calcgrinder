import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PROJ-4 — production security headers.
  // Four zero-risk drop-ins documented in
  // `docs/production/security-headers.md`. CSP is deliberately deferred
  // (see PROJ-4 Decision Log).
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
