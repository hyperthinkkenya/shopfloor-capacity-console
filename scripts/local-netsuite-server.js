import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const port = Number(process.env.PORT || 8888);
const host = "127.0.0.1";

loadEnvFile(resolve(root, ".env"));
loadEnvFile(resolve(root, ".env.local"));

const { handler } = await import("../netlify/functions/netsuite-work-orders.js");

createServer(async (request, response) => {
  const requestUrl = new URL(request.url || "/", `http://${request.headers.host}`);

  if (request.method === "OPTIONS") {
    response.writeHead(204, corsHeaders());
    response.end();
    return;
  }

  if (requestUrl.pathname !== "/.netlify/functions/netsuite-work-orders") {
    response.writeHead(404, {
      ...corsHeaders(),
      "Content-Type": "application/json",
    });
    response.end(JSON.stringify({ message: "Use /.netlify/functions/netsuite-work-orders" }));
    return;
  }

  const result = await handler({
    headers: request.headers,
    httpMethod: request.method,
    path: requestUrl.pathname,
    queryStringParameters: Object.fromEntries(requestUrl.searchParams.entries()),
  });

  response.writeHead(result.statusCode || 200, {
    ...corsHeaders(),
    ...(result.headers || {}),
  });
  response.end(result.body || "");
}).listen(port, host, () => {
  console.log(`Local NetSuite connector listening on http://localhost:${port}`);
  console.log(
    `Endpoint: http://localhost:${port}/.netlify/functions/netsuite-work-orders`,
  );
});

function corsHeaders() {
  return {
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Origin": "*",
  };
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;

  readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) return;

      const key = trimmed.slice(0, separatorIndex).trim();
      const rawValue = trimmed.slice(separatorIndex + 1).trim();
      const value = rawValue.replace(/^["']|["']$/g, "");

      if (key && process.env[key] === undefined) {
        process.env[key] = value;
      }
    });
}
