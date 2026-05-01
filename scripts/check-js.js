const { spawnSync } = require("node:child_process");
const os = require("node:os");
const fs = require("node:fs");
const path = require("node:path");

const ROOT_DIR = path.resolve(__dirname, "..");
const CHECK_DIRS = ["backend", "frontend", "scripts"];

function collectJavaScriptFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return collectJavaScriptFiles(fullPath);
    }

    return entry.isFile() && entry.name.endsWith(".js") ? [fullPath] : [];
  });
}

const files = CHECK_DIRS.flatMap((directory) =>
  collectJavaScriptFiles(path.join(ROOT_DIR, directory)),
).sort();

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "botc-js-check-"));

function getCheckPath(file) {
  const relativePath = path.relative(ROOT_DIR, file);
  const isFrontendScript = relativePath.startsWith(`frontend${path.sep}`);

  if (!isFrontendScript) {
    return file;
  }

  const tempFile = path.join(
    tempDir,
    `${relativePath.replace(/[\\/]/g, "__")}.mjs`,
  );
  fs.writeFileSync(tempFile, fs.readFileSync(file, "utf8"));
  return tempFile;
}

for (const file of files) {
  const checkPath = getCheckPath(file);
  const result = spawnSync(process.execPath, ["--check", checkPath], {
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

fs.rmSync(tempDir, { recursive: true, force: true });
