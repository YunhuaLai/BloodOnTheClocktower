const fs = require("node:fs");
const path = require("node:path");
const { augmentEncyclopedia } = require("../backend/data/catalog");
const { buildBootstrapData, buildHomeData } = require("../backend/data/catalog-summaries");
const { loadLibraryDataAsync } = require("../backend/data/library");

const ROOT_DIR = path.resolve(__dirname, "..");
const OUTPUT_DIR = path.join(ROOT_DIR, "dist", "data");

function writeJson(filename, payload) {
  const outputPath = path.join(OUTPUT_DIR, filename);
  const json = JSON.stringify(payload);
  fs.writeFileSync(outputPath, json);
  return { filename, bytes: Buffer.byteLength(json) };
}

function formatMegabytes(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

async function main() {
  const startedAt = Date.now();
  const data = augmentEncyclopedia(await loadLibraryDataAsync());
  const bootstrap = buildBootstrapData(data);
  const home = buildHomeData(data);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const outputs = [
    writeJson("home.json", home),
    writeJson("bootstrap.json", bootstrap),
    writeJson("encyclopedia.json", data),
  ];

  const manifest = {
    generatedAt: new Date().toISOString(),
    counts: home.counts,
    outputs: Object.fromEntries(outputs.map((output) => [output.filename, output.bytes])),
  };
  writeJson("manifest.json", manifest);

  console.log(
    `Built catalog data in ${((Date.now() - startedAt) / 1000).toFixed(1)}s: ${outputs
      .map((output) => `${output.filename} ${formatMegabytes(output.bytes)}`)
      .join(", ")}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
