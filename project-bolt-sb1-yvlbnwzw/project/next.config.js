/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: true,
  },
  async redirects() {
    return [
      {
        source: '/book/available',
        destination: '/booking',
        permanent: true,
      },
      {
        source: '/book/:businessId',
        destination: '/booking/:businessId',
        permanent: true,
      },
      {
        source: '/book/:businessId/:serviceId',
        destination: '/booking/:businessId/:serviceId',
        permanent: true,
      },
    ];
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'www.gigzone.app' },
    ],
  },
  generateBuildId: async () => {
    return `build-${Date.now()}`;
  },
};

module.exports = nextConfig;
