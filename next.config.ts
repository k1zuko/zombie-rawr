import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
};

module.exports = {
  images: {
    unoptimized: true, // Nonaktifkan optimisasi gambar global
    domains: [],
    disableStaticImages: true // Memaksa penggunaan import untuk gambar statis
  }
};

export default nextConfig;
