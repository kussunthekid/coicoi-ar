// PWAを一時的に無効化してmanifest.jsonの401エラーを回避
// const withPWA = require('next-pwa')({
//   dest: 'public',
//   disable: true, // 一時的に無効化
// })

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  output: 'export',
  trailingSlash: false,
  images: {
    unoptimized: true
  },
  assetPrefix: '',
}

// PWA無効化
module.exports = nextConfig