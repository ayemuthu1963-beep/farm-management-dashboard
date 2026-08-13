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
          '/map-data/orthomosaic/Muthu_Farms_Full_Orthomosaic_2026_WebMercator_Z16-Z22_WebP88.pmtiles',
        headers: [
          { key: 'Content-Type', value: 'application/octet-stream' },
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source:
          '/map-data/coordinates/Muthu_Farms_Coconut_Tree_Coordinates_Approved_2026.geojson',
        headers: [
          { key: 'Content-Type', value: 'application/geo+json; charset=utf-8' },
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source:
          '/map-data/coordinates/Muthu_Farms_Jackfruit_Tree_Coordinates_Translated_Proposal_2026.geojson',
        headers: [
          { key: 'Content-Type', value: 'application/geo+json; charset=utf-8' },
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source:
          '/map-data/coordinates/Muthu_Farms_Jackfruit_Tree_Coordinates_Audit_2026.geojson',
        headers: [
          { key: 'Content-Type', value: 'application/geo+json; charset=utf-8' },
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source:
          '/map-data/coordinates/Muthu_Farms_Jackfruit_Tree_Coordinates_Affine_Corrected_Proposal_2026.geojson',
        headers: [
          { key: 'Content-Type', value: 'application/geo+json; charset=utf-8' },
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ]
  },
}

export default nextConfig
