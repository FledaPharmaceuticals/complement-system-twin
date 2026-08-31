import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const HOST = "127.0.0.1";
const PORT = Number(process.env.PORT || 8766);
const API_BASE_URL = "https://api.twins.fledausa.com";
const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const API_META = '<meta name="fleda-complement-api-base-url" content="https://api.twins.fledausa.com">';
const LOCAL_META = `<meta name="fleda-complement-api-base-url" content="http://${HOST}:${PORT}">`;

const CONTENT_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp"
};

let apiRequestCount = 0;

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${HOST}:${PORT}`);
    if (url.pathname === "/__c3_api_requests") {
      sendJson(response, 200, { apiRequestCount });
      return;
    }
    if (url.pathname.startsWith("/v1/") || url.pathname === "/health") {
      await proxyApi(request, response, url);
      return;
    }
    await serveStatic(response, url.pathname);
  } catch (error) {
    sendJson(response, 502, { error: String(error?.message || error) });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`C3 browser regression server: http://${HOST}:${PORT}/?fledaApi=trial`);
  console.log(`Fixed upstream API: ${API_BASE_URL}`);
});

async function proxyApi(request, response, url) {
  apiRequestCount += 1;
  const body = await readRequestBody(request);
  const headers = new Headers();
  for (const name of ["accept", "content-type"]) {
    const value = request.headers[name];
    if (typeof value === "string") headers.set(name, value);
  }
  const upstream = await fetch(`${API_BASE_URL}${url.pathname}${url.search}`, {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : body
  });
  response.writeHead(upstream.status, Object.fromEntries(
    ["content-type", "retry-after"].flatMap((name) => {
      const value = upstream.headers.get(name);
      return value ? [[name, value]] : [];
    })
  ));
  response.end(Buffer.from(await upstream.arrayBuffer()));
}

async function serveStatic(response, pathname) {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const filePath = resolve(ROOT, `.${decodeURIComponent(requested)}`);
  if (!filePath.startsWith(`${ROOT}${sep}`) || !existsSync(filePath) || !statSync(filePath).isFile()) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }
  const contentType = CONTENT_TYPES[extname(filePath)] || "application/octet-stream";
  if (filePath === resolve(ROOT, "index.html")) {
    const html = await new Response(createReadStream(filePath)).text();
    response.writeHead(200, { "content-type": contentType });
    response.end(html.replace(API_META, LOCAL_META));
    return;
  }
  response.writeHead(200, { "content-type": contentType });
  createReadStream(filePath).pipe(response);
}

function readRequestBody(request) {
  return new Promise((resolveBody, reject) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.once("end", () => resolveBody(Buffer.concat(chunks)));
    request.once("error", reject);
  });
}

function sendJson(response, status, value) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(`${JSON.stringify(value)}\n`);
}
