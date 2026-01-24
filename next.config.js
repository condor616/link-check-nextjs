/** @type {import('next').NextConfig} */
const nextConfig = {

  // Add standalone output for Docker deployment
  output: 'standalone',
  reactStrictMode: true,
  experimental: {
    // Create persistent scrollbars to avoid layout shifts during transitions
    scrollRestoration: true,
  },
  sassOptions: {
    quietDeps: true,
    silenceDeprecations: ['legacy-js-api'],
  },
}

module.exports = nextConfig 