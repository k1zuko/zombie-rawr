# Tahap 1: Build Aplikasi Next.js
# Menggunakan image Node.js yang stabil
FROM node:20.13.1 AS builder

# Atur direktori kerja
WORKDIR /app

# Salin file package.json dan package-lock.json/yarn.lock
COPY package.json yarn.lock ./

# Install dependensi
RUN yarn install --frozen-lockfile

# Salin semua file proyek ke direktori kerja
COPY . .

# Jalankan proses build Next.js
# Pastikan next.config.js sudah memiliki "output: 'standalone'"
RUN yarn build

---

# Tahap 2: Jalankan Aplikasi Produksi
# Menggunakan image yang sama untuk konsistensi
FROM node:20.13.1

# Atur direktori kerja
WORKDIR /app

# Salin folder `standalone` yang sudah di-build di tahap 1
# Ini berisi semua yang dibutuhkan untuk produksi (tanpa node_modules)
COPY --from=builder /app/.next/standalone ./

# Salin folder `public` (untuk aset statis seperti gambar, font, dll.)
COPY --from=builder /app/public ./public

# Tentukan port aplikasi
ENV PORT=3000

# Ekspos port agar bisa diakses dari luar
EXPOSE 3000

# Perintah untuk menjalankan aplikasi
# server.js adalah file yang dibuat oleh next.js standalone
CMD ["node", "server.js"]