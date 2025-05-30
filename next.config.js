const withPWA = require('next-pwa');

// Silence PWA logs in development
const originalConsoleLog = console.log;
let hasLoggedPWAStatus = false;

console.log = function(...args) {
  // Check if this is a PWA status message
  if (args[0] && typeof args[0] === 'string' && args[0].includes('[PWA] PWA support is')) {
    if (!hasLoggedPWAStatus) {
      hasLoggedPWAStatus = true;
      originalConsoleLog.apply(console, args);
    }
    // Skip duplicate logs
    return;
  }
  
  // Pass through all other logs
  originalConsoleLog.apply(console, args);
};

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
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

// Apply PWA configuration
const pwaConfig = withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development"
});

// Apply the configuration
const config = pwaConfig(nextConfig);

// Restore original console.log
console.log = originalConsoleLog;

module.exports = config;
