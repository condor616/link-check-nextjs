/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable ESLint during production builds
  eslint: {
    // Warning: only disable this when you're confident your code is working
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig 