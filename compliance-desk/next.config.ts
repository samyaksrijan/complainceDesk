import type { NextConfig } from "next"
const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["pdf-parse", "tesseract.js", "@prisma/client"],
  poweredByHeader: false,
  outputFileTracingIncludes: { "/api/**": ["./node_modules/pdf-parse/dist/worker/**/*", "./node_modules/pdfjs-dist/legacy/build/**/*", "./node_modules/tesseract.js-core/**/*", "./node_modules/tesseract.js/**/*", "./node_modules/pdfjs-dist/standard_fonts/**/*", "./node_modules/pdfjs-dist/cmaps/**/*", "./node_modules/pdfkit/js/standard-fonts/**/*"] },
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ] }]
  },
}
export default nextConfig
