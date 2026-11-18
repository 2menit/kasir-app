/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // These ship ?. / ?? in their dist; downlevel them so iOS 12 Safari (crew iPad mini 2) can parse the bundle.
  transpilePackages: ["tailwind-merge", "date-fns-tz", "date-fns"],
  experimental: {
    // ExcelJS is a server-only dependency; keep it external to the bundle.
    serverComponentsExternalPackages: ["exceljs", "@prisma/client", "bcryptjs"],
  },
};

export default nextConfig;
