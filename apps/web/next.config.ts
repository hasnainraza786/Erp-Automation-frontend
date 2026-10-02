import type { NextConfig } from 'next';

/** Static SPA export: hosted on Cloudflare Pages and loaded by the Electron desktop shell. */
const config: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  transpilePackages: ['@erp/ui', '@erp/core', '@erp/api-client'],
  reactStrictMode: true,
  typedRoutes: false,
};

export default config;
