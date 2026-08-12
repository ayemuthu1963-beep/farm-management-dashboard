/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source:
          '/map-data/coordinates/Muthu_Farms_Coconut_Tree_Coordinates_Approved_2026.geojson',
        headers: [
          { key: 'Content-Type', value: 'application/geo+json; charset=utf-8' },
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ]
  },
}

export default nextConfig
