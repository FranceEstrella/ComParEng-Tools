import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const turbopackRoot = path.resolve(__dirname).replace(/\\/g, "/")

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Ensure turbopack uses the repository root as the workspace root so Next
  // does not accidentally infer `app/` as the project directory when running
  // within environments that may change the CWD resolution. Use an absolute
  // path so Next's warning about relative turbopack.root is avoided.
  turbopack: {
    root: turbopackRoot,
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
          {
            key: "Content-Type",
            value: "text/javascript; charset=utf-8",
          },
        ],
      },
    ]
  },
}

export default nextConfig
