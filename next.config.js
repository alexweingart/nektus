const withPWA = require('next-pwa');

// PWA configuration is only applied in production to reduce logs

const nextConfig = {
  // Next.js 15.3 configuration
  pageExtensions: ['tsx', 'ts', 'jsx', 'js'],
  serverExternalPackages: ['next-pwa', 'openai'],
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    // This makes sure the OpenAI module is only bundled server-side
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
        crypto: false,
        stream: false,
        http: false,
        https: false,
        zlib: false,
        net: false,
        tls: false,
        dns: false,
        child_process: false,
        dgram: false,
        module: false,
      };
    }
    return config;
  },
  images: {
    domains: ['lh3.googleusercontent.com', 'lh4.googleusercontent.com', 'lh5.googleusercontent.com', 'lh6.googleusercontent.com'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: '*.googleusercontent.com',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,OPTIONS,PATCH,DELETE,POST,PUT' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version' },
        ]
      }
    ];
  },
  async rewrites() {
    return [
      {
        source: '/api/auth/:path*',
        destination: '/api/auth/:path*',
      },
    ];
  },
};

// Only apply PWA in production, use regular config in development
const config = process.env.NODE_ENV === 'production' 
  ? withPWA({
      dest: "public",
      register: true,
      skipWaiting: true,
      disable: false,
      cacheOnFrontEndNav: true,
      disableDevLogs: true,
      buildExcludes: [/middleware-manifest\.json$/, /_middleware\.js$/, /_error\.js$/, /chunks\/pages\/api\//],
      runtimeCaching: [
        {
          urlPattern: /\/favicon\.(ico|svg|png)$/,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'favicon-cache',
            expiration: {
              maxEntries: 1,
              maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
            },
          },
        },
      ]
    })(nextConfig)
  : nextConfig;

module.exports = config;
