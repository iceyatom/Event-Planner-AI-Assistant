import type { NextConfig } from 'next';
import { frameAncestors } from './src/lib/framing';
const config: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  async headers() {
    const common = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'no-referrer' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    ];
    return [
      { source: '/:path*', headers: common },
      { source: '/', headers: [{ key: 'Content-Security-Policy', value: "frame-ancestors 'self'; object-src 'none'; base-uri 'self'" }] },
      { source: '/embed', headers: [{ key: 'Content-Security-Policy', value: `frame-ancestors ${frameAncestors(process.env.FRAME_ANCESTORS)}; object-src 'none'; base-uri 'self'` }] },
    ];
  },
};
export default config;
