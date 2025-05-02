/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable ESLint during production builds
  eslint: {
    // Warning: only disable this when you're confident your code is working
    ignoreDuringBuilds: true,
  },
  // Add standalone output for Docker deployment
  output: 'standalone',
  reactStrictMode: true,
  experimental: {
    windowHistorySupport: true,
    optimisticClientCache: true,
    // Improve transition performance
    optimisticNavigation: true,
    // Create persistent scrollbars to avoid layout shifts during transitions
    scrollRestoration: true,
  },
}

module.exports = nextConfig 