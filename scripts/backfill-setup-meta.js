const fs = require("node:fs");
const path = require("node:path");
const yaml = require("js-yaml");
const { inferSetupMeta } = require("./official-json");

const ROOT_DIR = path.resolve(__dirname, "..");
const ROLES_DIR = path.join(ROOT_DIR, "backend", "data", "library", "roles");

function readYamlFile(filePath) {
  return yaml.load(fs.readFileSync(filePath, "utf8"));
}

function writeYamlFile(filePath, data) {
  const content = yaml.dump(data, {
    lineWidth: 120,
    noRefs: true,
    quotingType: "'",
  });
  fs.writeFileSync(filePath, content, "utf8");
}

function readRoleEntries() {
  return fs
    .readdirSync(ROLES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".yaml"))
    .map((entry) => {
      const filePath = path.join(ROLES_DIR, entry.name);
      return {
        filePath,
        data: readYamlFile(filePath),
      };
    });
}

function normalizeSetupMeta(value) {
  return JSON.stringify(value || null);
}

function isEqualSetupMeta(left, right) {
  return normalizeSetupMeta(left) === normalizeSetupMeta(right);
}

function roleLabel(role) {
  return `${role.id || "unknown"}${role.name ? ` (${role.name})` : ""}`;
}

function insertSetupMeta(role, setupMeta) {
  const result = {};

  Object.entries(role).forEach(([key, value]) => {
    result[key] = value;

    if (key === "setup") {
      result.setupMeta = setupMeta;
    }
  });

  if (!Object.prototype.hasOwnProperty.call(result, "setupMeta")) {
    result.setupMeta = setupMeta;
  }

  return result;
}

function collectSetupMetaReport({ write = false, refresh = false } = {}) {
  const entries = readRoleEntries();
  const missing = [];
  const different = [];
  const overlay = [];
  const adjustments = [];
  const changed = [];

  entries.forEach((entry) => {
    const role = entry.data;
    const inferred = inferSetupMeta(role, role.type || "");
    const hasSetupMeta = Boolean(role.setupMeta);

    if (inferred.identityOverlay?.enabled) {
      overlay.push({ role, inferred });
    }

    if (inferred.configurationAdjustments?.length) {
      adjustments.push({ role, inferred });
    }

    if (!hasSetupMeta) {
      missing.push({ entry, inferred });

      if (write) {
        const nextRole = insertSetupMeta(role, inferred);
        writeYamlFile(entry.filePath, nextRole);
        changed.push(entry.filePath);
      }
      return;
    }

    if (!isEqualSetupMeta(role.setupMeta, inferred)) {
      different.push({ entry, inferred });

      if (write && refresh) {
        const nextRole = { ...role, setupMeta: inferred };
        writeYamlFile(entry.filePath, nextRole);
        changed.push(entry.filePath);
      }
    }
  });

  return {
    total: entries.length,
    missing,
    different,
    overlay,
    adjustments,
    changed,
  };
}

function printReport(report, { write, refresh }) {
  console.log(`扫描角色：${report.total}`);
  console.log(`缺少 setupMeta：${report.missing.length}`);
  console.log(`已有 setupMeta 但与当前推断不同：${report.different.length}`);
  console.log(`身份覆盖类角色：${report.overlay.length}`);
  console.log(`配置调整类角色：${report.adjustments.length}`);

  if (write) {
    console.log(`已写入文件：${report.changed.length}`);
    if (!refresh && report.different.length) {
      console.log("提示：已有 setupMeta 的差异未覆盖；如需重算覆盖，请使用 --write --refresh。");
    }
  } else {
    console.log("当前为 dry-run；如需补写缺失字段，请使用 --write。");
  }

  printRoleList("缺少 setupMeta", report.missing.map((item) => item.entry.data));
  printRoleList("setupMeta 差异", report.different.map((item) => item.entry.data));
  printRoleList("身份覆盖类", report.overlay.map((item) => item.role));
  printAdjustmentList(report.adjustments);
  printChangedFiles(report.changed);
}

function printRoleList(title, roles) {
  if (!roles.length) {
    return;
  }

  console.log(`\n${title}:`);
  roles.slice(0, 40).forEach((role) => {
    console.log(`- ${roleLabel(role)}`);
  });

  if (roles.length > 40) {
    console.log(`... 还有 ${roles.length - 40} 个`);
  }
}

function printAdjustmentList(items) {
  if (!items.length) {
    return;
  }

  console.log("\n配置调整类:");
  items.slice(0, 40).forEach(({ role, inferred }) => {
    const notes = inferred.configurationAdjustments.map((item) => item.note).join(" / ");
    console.log(`- ${roleLabel(role)}: ${notes}`);
  });

  if (items.length > 40) {
    console.log(`... 还有 ${items.length - 40} 个`);
  }
}

function printChangedFiles(files) {
  if (!files.length) {
    return;
  }

  console.log("\n写入文件:");
  files.slice(0, 80).forEach((filePath) => {
    console.log(`- ${path.relative(ROOT_DIR, filePath)}`);
  });

  if (files.length > 80) {
    console.log(`... 还有 ${files.length - 80} 个`);
  }
}

function printUsage() {
  console.log(`用法:
  node scripts/backfill-setup-meta.js
  node scripts/backfill-setup-meta.js --write
  node scripts/backfill-setup-meta.js --write --refresh

说明:
  默认只检查，不写文件。
  --write 会给缺少 setupMeta 的角色补字段。
  --write --refresh 会按当前推断逻辑重算并覆盖已有 setupMeta。`);
}

function main() {
  const args = new Set(process.argv.slice(2));

  if (args.has("--help") || args.has("-h")) {
    printUsage();
    return;
  }

  const write = args.has("--write");
  const refresh = args.has("--refresh");
  const report = collectSetupMetaReport({ write, refresh });

  printReport(report, { write, refresh });
}

if (require.main === module) {
  main();
}

module.exports = {
  collectSetupMetaReport,
};
