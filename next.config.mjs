import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  // Untuk build APK, uncomment output: "export" di bawah
  // output: "export",
  turbopack: {
    root: __dirname,
  },
}

export default nextConfig
