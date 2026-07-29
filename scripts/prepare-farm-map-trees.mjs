import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

const [plot1Source, plot2Source, outputDirectory] = process.argv.slice(2)

if (!plot1Source || !plot2Source || !outputDirectory) {
  console.error(
    "Usage: node scripts/prepare-farm-map-trees.mjs <plot1.geojson> <plot2.geojson> <output-directory>",
  )
  process.exit(2)
}

const definitions = [
  {
    plot: "Plot 1",
    source: plot1Source,
    output: "plot1-coconut-trees-v1.geojson",
    expectedCount: 954,
  },
  {
    plot: "Plot 2",
    source: plot2Source,
    output: "plot2-coconut-trees-v1.geojson",
    expectedCount: 1163,
  },
]

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex")
}

function validate(definition, raw, collection) {
  if (collection?.type !== "FeatureCollection" || !Array.isArray(collection.features)) {
    throw new Error(`${definition.plot}: expected a GeoJSON FeatureCollection`)
  }

  if (collection.features.length !== definition.expectedCount) {
    throw new Error(
      `${definition.plot}: expected ${definition.expectedCount} features, found ${collection.features.length}`,
    )
  }

  const crsName = String(collection.crs?.properties?.name ?? "")
  if (!/(CRS84|EPSG(?:::|:|\/0\/)4326)/i.test(crsName)) {
    throw new Error(`${definition.plot}: expected CRS84/EPSG:4326, found ${crsName || "no declared CRS"}`)
  }

  const seen = new Set()
  let decimalCount = 0

  for (const [index, feature] of collection.features.entries()) {
    if (feature?.type !== "Feature" || feature?.geometry?.type !== "Point") {
      throw new Error(`${definition.plot}: feature ${index + 1} is not a Point feature`)
    }

    const treeNo = feature?.properties?.TreeNo
    if (typeof treeNo !== "string" || !treeNo.trim()) {
      throw new Error(`${definition.plot}: feature ${index + 1} has a blank or non-string TreeNo`)
    }

    if (treeNo !== treeNo.trim()) {
      throw new Error(`${definition.plot}: TreeNo ${JSON.stringify(treeNo)} contains surrounding whitespace`)
    }

    if (seen.has(treeNo)) {
      throw new Error(`${definition.plot}: duplicate TreeNo ${treeNo}`)
    }
    seen.add(treeNo)

    if (treeNo.includes(".") && !/\.0+$/.test(treeNo)) {
      decimalCount += 1
    }

    const [longitude, latitude, ...extraCoordinates] = feature.geometry.coordinates ?? []
    if (
      extraCoordinates.length > 0 ||
      !Number.isFinite(longitude) ||
      !Number.isFinite(latitude) ||
      longitude < -180 ||
      longitude > 180 ||
      latitude < -90 ||
      latitude > 90
    ) {
      throw new Error(`${definition.plot}: feature ${index + 1} has invalid EPSG:4326 coordinates`)
    }
  }

  return {
    sourceSha256: sha256(raw),
    featureCount: collection.features.length,
    decimalCount,
  }
}

await mkdir(outputDirectory, { recursive: true })

for (const definition of definitions) {
  const raw = await readFile(definition.source)
  const collection = JSON.parse(raw.toString("utf8"))
  const validation = validate(definition, raw, collection)

  const prepared = {
    ...collection,
    features: collection.features.map((feature) => ({
      ...feature,
      properties: {
        TreeNo: feature.properties.TreeNo,
        Plot: definition.plot,
      },
    })),
  }
  const outputPath = path.join(outputDirectory, definition.output)
  const output = Buffer.from(`${JSON.stringify(prepared)}\n`, "utf8")
  await writeFile(outputPath, output)

  console.log(
    JSON.stringify({
      plot: definition.plot,
      source: definition.source,
      sourceSha256: validation.sourceSha256,
      output: outputPath,
      outputSha256: sha256(output),
      featureCount: validation.featureCount,
      decimalCount: validation.decimalCount,
    }),
  )
}
