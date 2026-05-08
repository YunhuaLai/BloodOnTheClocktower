const fs = require("node:fs");
const path = require("node:path");
const { loadLibraryData } = require("../backend/data/library");
const { isRemoteImage } = require("../backend/data/image-assets");

const ROOT_DIR = path.resolve(__dirname, "..");
const FRONTEND_ASSETS_DIR = path.join(ROOT_DIR, "frontend", "assets");
const CACHE_KINDS = {
  roles: {
    assetDirectory: path.join(FRONTEND_ASSETS_DIR, "roles"),
    getItems: (data) => data.roles || [],
  },
  scripts: {
    assetDirectory: path.join(FRONTEND_ASSETS_DIR, "scripts"),
    getItems: (data) => data.scripts || [],
  },
};
const IMAGE_EXTENSIONS = new Set([".gif", ".jpeg", ".jpg", ".png", ".svg", ".webp"]);
const CONTENT_TYPE_EXTENSIONS = {
  "image/gif": ".gif",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/svg+xml": ".svg",
  "image/webp": ".webp",
};
const DEFAULT_CONCURRENCY = 8;
const DEFAULT_TIMEOUT_MS = 25000;

function parseArgs(argv) {
  return argv.reduce(
    (options, arg) => {
      if (arg === "--dry-run") {
        return { ...options, dryRun: true };
      }

      if (arg === "--force") {
        return { ...options, force: true };
      }

      const [key, value = ""] = arg.split("=");
      if (key === "--kind") {
        return { ...options, kind: value };
      }

      if (key === "--limit") {
        return { ...options, limit: Math.max(0, Number(value) || 0) };
      }

      if (key === "--id") {
        return { ...options, id: value };
      }

      return options;
    },
    {
      dryRun: false,
      force: false,
      id: "",
      kind: "roles",
      limit: 0,
    },
  );
}

function getKinds(kind) {
  if (kind === "all") {
    return Object.keys(CACHE_KINDS);
  }

  if (!CACHE_KINDS[kind]) {
    throw new Error(`Unknown image cache kind "${kind}". Use roles, scripts, or all.`);
  }

  return [kind];
}

function getUrlExtension(url) {
  try {
    const extension = path.extname(new URL(url).pathname).toLowerCase();
    return IMAGE_EXTENSIONS.has(extension) ? extension : "";
  } catch {
    return "";
  }
}

function getContentTypeExtension(contentType) {
  const normalized = String(contentType || "").split(";")[0].trim().toLowerCase();
  return CONTENT_TYPE_EXTENSIONS[normalized] || "";
}

function findCachedFile(directory, id) {
  if (!fs.existsSync(directory)) {
    return "";
  }

  const prefix = `${id}.`;
  const file = fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .find((entry) => entry.name.startsWith(prefix));

  return file ? path.join(directory, file.name) : "";
}

function buildJobs(data, options) {
  return getKinds(options.kind).flatMap((kind) => {
    const config = CACHE_KINDS[kind];
    const items = config
      .getItems(data)
      .filter((item) => item?.id && isRemoteImage(item.image))
      .filter((item) => !options.id || item.id === options.id);

    return items.map((item) => ({
      id: item.id,
      image: String(item.image).trim(),
      kind,
      name: item.name || item.id,
      assetDirectory: config.assetDirectory,
    }));
  });
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    return await fetch(url, {
      headers: {
        "User-Agent": "botc-encyclopedia-image-cache/0.1",
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function downloadJob(job, options) {
  fs.mkdirSync(job.assetDirectory, { recursive: true });
  const cachedFile = findCachedFile(job.assetDirectory, job.id);
  if (cachedFile && !options.force) {
    return { ...job, cached: true, filePath: cachedFile, skipped: true };
  }

  const response = await fetchWithTimeout(job.image);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "";
  const extension = getContentTypeExtension(contentType) || getUrlExtension(job.image) || ".png";
  const filePath = path.join(job.assetDirectory, `${job.id}${extension}`);
  const arrayBuffer = await response.arrayBuffer();
  fs.writeFileSync(filePath, Buffer.from(arrayBuffer));
  return { ...job, cached: false, filePath, skipped: false };
}

async function runQueue(jobs, options) {
  const results = [];
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < jobs.length) {
      const job = jobs[nextIndex];
      nextIndex += 1;

      try {
        const result = await downloadJob(job, options);
        results.push({ ok: true, result });
        const label = result.skipped ? "cached" : "downloaded";
        console.log(`${label}: ${job.kind}/${job.id} ${job.name}`);
      } catch (error) {
        results.push({ ok: false, job, error });
        console.warn(`failed: ${job.kind}/${job.id} ${job.name} - ${error.message}`);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(DEFAULT_CONCURRENCY, jobs.length) }, () => worker()),
  );
  return results;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const data = loadLibraryData();
  const allJobs = buildJobs(data, options);
  const jobs = options.limit ? allJobs.slice(0, options.limit) : allJobs;
  const alreadyCached = jobs.filter((job) => findCachedFile(job.assetDirectory, job.id)).length;

  console.log(
    `Image cache: ${jobs.length} ${options.kind} remote image(s), ${alreadyCached} already cached.`,
  );

  if (options.dryRun) {
    jobs.slice(0, 20).forEach((job) => {
      const local = findCachedFile(job.assetDirectory, job.id);
      console.log(`${local ? "cached" : "missing"}: ${job.kind}/${job.id} ${job.image}`);
    });
    return;
  }

  const results = await runQueue(jobs, options);
  const failures = results.filter((item) => !item.ok);
  console.log(`Image cache done: ${results.length - failures.length} ok, ${failures.length} failed.`);

  if (failures.length) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
