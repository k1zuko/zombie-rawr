import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
};

module.exports = {
  images: {
    unoptimized: true, // Nonaktifkan optimisasi gambar global
    domains: [],
    disableStaticImages: true // Memaksa penggunaan import untuk gambar statis
  }
}

export default nextConfig;
