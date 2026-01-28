/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  transpilePackages: ['@erp/types', '@erp/ui'],
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1',
    NEXT_PUBLIC_TIMEZONE: process.env.NEXT_PUBLIC_TIMEZONE || 'Asia/Manila',
    TZ: 'Asia/Manila',
  },
  async redirects() {
    return [
      {
        source: '/store',
        destination: '/integrations/store',
        permanent: true,
      },
      {
        source: '/store/:path*',
        destination: '/integrations/store/:path*',
        permanent: true,
      },
      {
        source: '/meta',
        destination: '/integrations/meta',
        permanent: true,
      },
      {
        source: '/meta/:path*',
        destination: '/integrations/meta/:path*',
        permanent: true,
      },
    ];
  },
}

module.exports = nextConfig
