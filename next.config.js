const withPWA = require('next-pwa');

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true
};

const pwaConfig = withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development"
});

module.exports = pwaConfig(nextConfig);
