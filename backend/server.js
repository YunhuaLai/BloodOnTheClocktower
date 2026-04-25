const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { augmentEncyclopedia } = require("./data/catalog");
const { loadLibraryData } = require("./data/library");

const PORT = Number(process.env.PORT || 3000);
const ROOT_DIR = path.resolve(__dirname, "..");
const FRONTEND_DIR = path.join(ROOT_DIR, "frontend");

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

function readData(callback) {
  try {
    callback(null, augmentEncyclopedia(loadLibraryData()));
  } catch (error) {
    callback(error);
  }
}

function sendRawJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

function sendFile(response, filePath) {
  fs.readFile(filePath, (error, content) => {
    if (error) {
      sendJson(response, 404, { error: "Not found" });
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      "Content-Type": contentTypes[extension] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    response.end(content);
  });
}

function handleApi(request, response) {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  const segments = requestUrl.pathname.split("/").filter(Boolean);

  if (requestUrl.pathname === "/api/health") {
    sendJson(response, 200, { ok: true, service: "botc-encyclopedia" });
    return;
  }

  if (requestUrl.pathname === "/api/encyclopedia") {
    readData((error, data) => {
      if (error) {
        sendJson(response, 500, { error: "Failed to read encyclopedia data" });
        return;
      }

      sendRawJson(response, 200, data);
    });
    return;
  }

  if (segments[0] === "api" && segments[1] === "scripts") {
    readData((error, data) => {
      if (error) {
        sendJson(response, 500, { error: "Failed to read script data" });
        return;
      }

      if (!segments[2]) {
        sendRawJson(response, 200, data.scripts || []);
        return;
      }

      const script = (data.scripts || []).find((item) => item.id === segments[2]);
      if (!script) {
        sendJson(response, 404, { error: "Script not found" });
        return;
      }

      sendRawJson(response, 200, script);
    });
    return;
  }

  if (segments[0] === "api" && segments[1] === "roles") {
    readData((error, data) => {
      if (error) {
        sendJson(response, 500, { error: "Failed to read role data" });
        return;
      }

      if (!segments[2]) {
        sendRawJson(response, 200, data.roles || []);
        return;
      }

      const role = (data.roles || []).find((item) => item.id === segments[2]);
      if (!role) {
        sendJson(response, 404, { error: "Role not found" });
        return;
      }

      sendRawJson(response, 200, role);
    });
    return;
  }

  if (segments[0] === "api" && segments[1] === "terms") {
    readData((error, data) => {
      if (error) {
        sendJson(response, 500, { error: "Failed to read term data" });
        return;
      }

      if (!segments[2]) {
        sendRawJson(response, 200, data.terms || []);
        return;
      }

      const term = (data.terms || []).find((item) => item.id === segments[2]);
      if (!term) {
        sendJson(response, 404, { error: "Term not found" });
        return;
      }

      sendRawJson(response, 200, term);
    });
    return;
  }

  sendJson(response, 404, { error: "API route not found" });
}

function handleStatic(request, response) {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  const pathname = decodeURIComponent(requestUrl.pathname);
  const relativePath = pathname === "/" ? "index.html" : pathname.slice(1);
  const filePath = path.resolve(FRONTEND_DIR, relativePath);
  const isInsideFrontend =
    filePath === FRONTEND_DIR || filePath.startsWith(`${FRONTEND_DIR}${path.sep}`);

  if (!isInsideFrontend) {
    sendJson(response, 403, { error: "Forbidden" });
    return;
  }

  fs.stat(filePath, (error, stats) => {
    if (!error && stats.isFile()) {
      sendFile(response, filePath);
      return;
    }

    if (path.extname(filePath)) {
      sendJson(response, 404, { error: "Not found" });
      return;
    }

    sendFile(response, path.join(FRONTEND_DIR, "index.html"));
  });
}

const server = http.createServer((request, response) => {
  if (!request.url || !request.method) {
    sendJson(response, 400, { error: "Bad request" });
    return;
  }

  if (request.method !== "GET") {
    sendJson(response, 405, { error: "Method not allowed" });
    return;
  }

  if (request.url.startsWith("/api/")) {
    handleApi(request, response);
    return;
  }

  handleStatic(request, response);
});

server.listen(PORT, () => {
  console.log(`Blood on the Clocktower encyclopedia is running at http://localhost:${PORT}`);
});
