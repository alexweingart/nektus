const withPWA = require('next-pwa');
const CaseSensitivePathsPlugin = require('case-sensitive-paths-webpack-plugin');

// PWA configuration is only applied in production to reduce logs

// Using App Router configuration - prevents _document error
const nextConfig = {
  // Next.js 15.3 configuration
  pageExtensions: ['tsx', 'ts', 'jsx', 'js'],
  serverExternalPackages: ['next-pwa', 'openai'],
  reactStrictMode: false, // Temporarily disabled to test production-like behavior
  eslint: {
    ignoreDuringBuilds: true, // Skip ESLint during builds for speed
    dirs: ['src'],
  },
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },
  compiler: {
    removeConsole: false, // Keep console logs in dev
  },
  webpack: (config, { isServer, dev }) => {
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
    
    // Handle WebAssembly modules
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };
    
    // Exclude problematic modules
    config.resolve.alias = {
      ...config.resolve.alias,
      'farmhash-modern': false,
    };
    
    // Add case sensitive paths check in development
    if (dev) {
      config.plugins.push(new CaseSensitivePathsPlugin());
    }
    
    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: '*.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'lh4.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'lh5.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'lh6.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
      },
      {
        protocol: 'https',
        hostname: '*.firebasestorage.app',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
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
      disable: false, // PWA enabled
      cacheOnFrontEndNav: false, // CRITICAL: Disable to prevent blocking navigation
      disableDevLogs: true,
      // buildExcludes: [
      //   /middleware-manifest\.json$/,
      //   /_middleware\.js$/,
      //   /_error\.js$/,
      //   /_document\.js$/,  // Exclude _document.js reference to avoid build errors
      //   /chunks\/pages\/api\//
      // ],
      runtimeCaching: [
        {
          urlPattern: /\/favicon\.(ico|svg|png)$/,
          handler: 'NetworkOnly',
          options: {
            cacheName: 'favicon-cache-v2',
            expiration: {
              maxEntries: 1,
              maxAgeSeconds: 1 * 60 * 60, // 1 hour only
            },
          },
        },
        {
          urlPattern: /^https:\/\/storage\.googleapis\.com\/.*$/,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'firebase-storage-cache',
            expiration: {
              maxEntries: 50,
              maxAgeSeconds: 24 * 60 * 60, // 24 hours
            },
            // Use a plugin to customize cache key
            plugins: [
              {
                cacheKeyWillBeUsed: async ({ request }) => request.url,
              },
            ],
          },
        },
      ]
    })(nextConfig)
  : nextConfig;

module.exports = config;
