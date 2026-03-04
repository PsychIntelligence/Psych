import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  async rewrites() {
    return [
      {
        source: '/catfiles/:path*',
        destination: '/api/catfile/:path*',
      },
    ];
  },

  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      ],
    },
    {
      source: '/catfiles/:path*',
      headers: [
        { key: 'Cache-Control', value: 'public, max-age=3600, immutable' },
      ],
    },
  ],
};

export default nextConfig;
