const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const zlib = require("node:zlib");
const {
  getBootstrapData,
  getEncyclopediaData,
  getJinxById,
  getRoleById,
  getScriptById,
  getTermById,
} = require("./data/encyclopedia-cache");
const { analyzeWorlds } = require("./deduction/scorer");

const DEFAULT_PORT = Number(process.env.PORT || 3000);
const MAX_PORT_ATTEMPTS = 20;
const MAX_JSON_BODY_BYTES = 512 * 1024;
const MIN_GZIP_BYTES = 1024;
const ROOT_DIR = path.resolve(__dirname, "..");
const FRONTEND_DIR = path.join(ROOT_DIR, "frontend");

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

function acceptsGzip(request) {
  return /\bgzip\b/.test(String(request.headers["accept-encoding"] || ""));
}

function isCompressibleContentType(contentType) {
  return /(?:application\/json|text\/|javascript|svg\+xml)/i.test(contentType);
}

function writeResponse(request, response, statusCode, headers, body) {
  const buffer = Buffer.isBuffer(body) ? body : Buffer.from(String(body));
  const contentType = headers["Content-Type"] || headers["content-type"] || "";
  const shouldCompress =
    buffer.length >= MIN_GZIP_BYTES &&
    acceptsGzip(request) &&
    isCompressibleContentType(contentType);

  if (!shouldCompress) {
    response.writeHead(statusCode, {
      ...headers,
      "Content-Length": buffer.length,
    });
    response.end(buffer);
    return;
  }

  zlib.gzip(buffer, (error, compressed) => {
    if (error) {
      response.writeHead(statusCode, {
        ...headers,
        "Content-Length": buffer.length,
      });
      response.end(buffer);
      return;
    }

    response.writeHead(statusCode, {
      ...headers,
      "Content-Encoding": "gzip",
      "Content-Length": compressed.length,
      Vary: "Accept-Encoding",
    });
    response.end(compressed);
  });
}

function sendJson(request, response, statusCode, payload) {
  writeResponse(request, response, statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  }, JSON.stringify(payload));
}

function sendRawJson(request, response, statusCode, payload) {
  sendJson(request, response, statusCode, payload);
}

function getStaticCacheControl(filePath) {
  const extension = path.extname(filePath).toLowerCase();

  if (extension === ".html") {
    return "no-store";
  }

  if ([".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"].includes(extension)) {
    return "public, max-age=86400";
  }

  return "no-cache";
}

function sendFile(request, response, filePath, stats = null) {
  if (stats?.mtime) {
    const modifiedSince = Date.parse(request.headers["if-modified-since"] || "");
    if (Number.isFinite(modifiedSince) && stats.mtime.getTime() <= modifiedSince + 999) {
      response.writeHead(304, {
        "Cache-Control": getStaticCacheControl(filePath),
        "Last-Modified": stats.mtime.toUTCString(),
      });
      response.end();
      return;
    }
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      sendJson(request, response, 404, { error: "Not found" });
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    const headers = {
      "Content-Type": contentTypes[extension] || "application/octet-stream",
      "Cache-Control": getStaticCacheControl(filePath),
    };

    if (stats?.mtime) {
      headers["Last-Modified"] = stats.mtime.toUTCString();
    }

    writeResponse(request, response, 200, headers, content);
  });
}

function readData(request, response, errorMessage) {
  try {
    return getEncyclopediaData();
  } catch (error) {
    console.error(error);
    sendJson(request, response, 500, { error: errorMessage });
    return null;
  }
}

function readJsonBody(request, response, onBody) {
  let body = "";
  let tooLarge = false;

  request.on("data", (chunk) => {
    if (tooLarge) {
      return;
    }

    body += chunk;
    if (Buffer.byteLength(body, "utf8") > MAX_JSON_BODY_BYTES) {
      tooLarge = true;
      sendJson(request, response, 413, { error: "Request body too large" });
      request.destroy();
    }
  });

  request.on("end", () => {
    if (tooLarge) {
      return;
    }

    try {
      onBody(body ? JSON.parse(body) : {});
    } catch (error) {
      sendJson(request, response, 400, { error: "Invalid JSON body" });
    }
  });

  request.on("error", () => {
    if (!response.headersSent) {
      sendJson(request, response, 400, { error: "Failed to read request body" });
    }
  });
}

function handleApi(request, response) {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  const segments = requestUrl.pathname.split("/").filter(Boolean);

  if (requestUrl.pathname === "/api/deduction/analyze") {
    if (request.method !== "POST") {
      sendJson(request, response, 405, { error: "Method not allowed" });
      return;
    }

    readJsonBody(request, response, (payload) => {
      const data = readData(request, response, "Failed to read deduction data");
      if (!data) {
        return;
      }

      if (!payload?.game || typeof payload.game !== "object") {
        sendJson(request, response, 400, { error: "Missing game payload" });
        return;
      }

      try {
        sendJson(request, response, 200, analyzeWorlds(payload.game, data));
      } catch (error) {
        console.error(error);
        sendJson(request, response, 500, { error: "Failed to analyze deduction state" });
      }
    });
    return;
  }

  if (request.method !== "GET") {
    sendJson(request, response, 405, { error: "Method not allowed" });
    return;
  }

  if (requestUrl.pathname === "/api/health") {
    sendJson(request, response, 200, { ok: true, service: "botc-encyclopedia" });
    return;
  }

  if (requestUrl.pathname === "/api/bootstrap") {
    try {
      sendRawJson(request, response, 200, getBootstrapData());
    } catch (error) {
      console.error(error);
      sendJson(request, response, 500, { error: "Failed to read bootstrap data" });
    }
    return;
  }

  if (requestUrl.pathname === "/api/encyclopedia") {
    const data = readData(request, response, "Failed to read encyclopedia data");
    if (data) {
      sendRawJson(request, response, 200, data);
    }
    return;
  }

  if (segments[0] === "api" && segments[1] === "scripts") {
    const data = readData(request, response, "Failed to read script data");
    if (!data) {
      return;
    }

    if (!segments[2]) {
      sendRawJson(request, response, 200, data.scripts || []);
      return;
    }

    const script = getScriptById(segments[2]);
    if (!script) {
      sendJson(request, response, 404, { error: "Script not found" });
      return;
    }

    sendRawJson(request, response, 200, script);
    return;
  }

  if (segments[0] === "api" && segments[1] === "roles") {
    const data = readData(request, response, "Failed to read role data");
    if (!data) {
      return;
    }

    if (!segments[2]) {
      sendRawJson(request, response, 200, data.roles || []);
      return;
    }

    const role = getRoleById(segments[2]);
    if (!role) {
      sendJson(request, response, 404, { error: "Role not found" });
      return;
    }

    sendRawJson(request, response, 200, role);
    return;
  }

  if (segments[0] === "api" && segments[1] === "jinxes") {
    const data = readData(request, response, "Failed to read jinx data");
    if (!data) {
      return;
    }

    if (!segments[2]) {
      sendRawJson(request, response, 200, data.jinxes || []);
      return;
    }

    const jinx = getJinxById(segments[2]);
    if (!jinx) {
      sendJson(request, response, 404, { error: "Jinx not found" });
      return;
    }

    sendRawJson(request, response, 200, jinx);
    return;
  }

  if (segments[0] === "api" && segments[1] === "terms") {
    const data = readData(request, response, "Failed to read term data");
    if (!data) {
      return;
    }

    if (!segments[2]) {
      sendRawJson(request, response, 200, data.terms || []);
      return;
    }

    const term = getTermById(segments[2]);
    if (!term) {
      sendJson(request, response, 404, { error: "Term not found" });
      return;
    }

    sendRawJson(request, response, 200, term);
    return;
  }

  sendJson(request, response, 404, { error: "API route not found" });
}

function handleStatic(request, response) {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  const pathname = decodeURIComponent(requestUrl.pathname);
  const relativePath = pathname === "/" ? "index.html" : pathname.slice(1);
  const filePath = path.resolve(FRONTEND_DIR, relativePath);
  const isInsideFrontend =
    filePath === FRONTEND_DIR || filePath.startsWith(`${FRONTEND_DIR}${path.sep}`);

  if (!isInsideFrontend) {
    sendJson(request, response, 403, { error: "Forbidden" });
    return;
  }

  fs.stat(filePath, (error, stats) => {
    if (!error && stats.isFile()) {
      sendFile(request, response, filePath, stats);
      return;
    }

    if (path.extname(filePath)) {
      sendJson(request, response, 404, { error: "Not found" });
      return;
    }

    const indexPath = path.join(FRONTEND_DIR, "index.html");
    fs.stat(indexPath, (indexError, indexStats) => {
      sendFile(request, response, indexPath, indexError ? null : indexStats);
    });
  });
}

const server = http.createServer((request, response) => {
  if (!request.url || !request.method) {
    sendJson(request, response, 400, { error: "Bad request" });
    return;
  }

  if (request.url.startsWith("/api/")) {
    handleApi(request, response);
    return;
  }

  if (request.method !== "GET") {
    sendJson(request, response, 405, { error: "Method not allowed" });
    return;
  }

  handleStatic(request, response);
});

function listen(port, attemptsLeft = MAX_PORT_ATTEMPTS) {
  server.once("error", (error) => {
    if (error.code === "EADDRINUSE" && attemptsLeft > 0) {
      listen(port + 1, attemptsLeft - 1);
      return;
    }

    console.error(error);
    process.exitCode = 1;
  });

  server.listen(port, () => {
    console.log(`Blood on the Clocktower encyclopedia is running at http://localhost:${port}`);
  });
}

listen(DEFAULT_PORT);
