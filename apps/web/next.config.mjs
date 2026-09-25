/** @type {import('next').NextConfig} */
const nextConfig = {
  // Browser → Next.js (/api/*) → NestJS. Same origin for the browser: no CORS, cookie stays first-party.
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${process.env.API_URL ?? 'http://localhost:4000'}/:path*` }];
  },
};

export default nextConfig;
