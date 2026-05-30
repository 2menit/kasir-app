/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // ExcelJS is a server-only dependency; keep it external to the bundle.
    serverComponentsExternalPackages: ["exceljs", "@prisma/client", "bcryptjs"],
  },
};

export default nextConfig;
