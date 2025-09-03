# Tahap 1: Build Aplikasi Next.js
FROM node:20.13.1 AS builder

WORKDIR /app

# Salin package.json dan lock file
COPY package.json pnpm-lock.yaml ./

# Install dependensi menggunakan pnpm
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

# Salin semua file proyek ke direktori kerja
COPY . .

# Jalankan proses build Next.js
RUN pnpm run build

# Tahap 2: Jalankan Aplikasi Produksi
FROM node:20.13.1

WORKDIR /app

# Salin folder `standalone` yang sudah di-build di tahap 1
COPY --from=builder /app/.next/standalone ./

# Salin folder `public` (untuk aset statis)
COPY --from=builder /app/public ./public

# Tentukan port aplikasi
ENV PORT=3000

# Ekspos port
EXPOSE 3000

# Perintah untuk menjalankan aplikasi
CMD ["node", "server.js"]