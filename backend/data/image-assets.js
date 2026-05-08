const fs = require("node:fs");
const path = require("node:path");

const ROOT_DIR = path.resolve(__dirname, "..", "..");
const FRONTEND_ASSETS_DIR = path.join(ROOT_DIR, "frontend", "assets");
const IMAGE_EXTENSIONS = new Set([".gif", ".jpeg", ".jpg", ".png", ".svg", ".webp"]);

const assetDirectories = {
  roles: path.join(FRONTEND_ASSETS_DIR, "roles"),
  scripts: path.join(FRONTEND_ASSETS_DIR, "scripts"),
};

function isRemoteImage(value) {
  return /^https?:\/\//i.test(String(value || "").trim());
}

function findCachedImage(kind, id) {
  const directory = assetDirectories[kind];
  const itemId = String(id || "").trim();
  if (!directory || !itemId || !fs.existsSync(directory)) {
    return "";
  }

  const file = fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .find((entry) => {
      const extension = path.extname(entry.name).toLowerCase();
      return IMAGE_EXTENSIONS.has(extension) && entry.name.startsWith(`${itemId}.`);
    });

  return file ? `/assets/${kind}/${file.name}` : "";
}

function resolveCatalogImage(item, kind) {
  const sourceImage = String(item?.image || "").trim();
  if (!sourceImage) {
    return {
      image: "",
      imageCached: false,
      sourceImageUrl: "",
    };
  }

  if (!isRemoteImage(sourceImage)) {
    return {
      image: sourceImage,
      imageCached: sourceImage.startsWith("/assets/"),
      sourceImageUrl: "",
    };
  }

  const cachedImage = findCachedImage(kind, item.id);
  return {
    image: cachedImage || sourceImage,
    imageCached: Boolean(cachedImage),
    sourceImageUrl: sourceImage,
  };
}

function withResolvedImage(item, kind) {
  const { image, imageCached, sourceImageUrl } = resolveCatalogImage(item, kind);
  return {
    ...item,
    image,
    ...(imageCached ? { imageCached: true } : {}),
    ...(sourceImageUrl ? { sourceImageUrl } : {}),
  };
}

function getImageAssetDirectories() {
  return Object.values(assetDirectories);
}

module.exports = {
  getImageAssetDirectories,
  isRemoteImage,
  withResolvedImage,
};
