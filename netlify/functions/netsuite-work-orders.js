import crypto from "node:crypto";

const DEFAULT_QUERY = `
SELECT
  id,
  tranid,
  entity,
  status,
  trandate,
  startdate,
  enddate
FROM
  transaction
WHERE
  type = 'WorkOrd'
ORDER BY
  startdate
`;

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return response(204, "");
  }

  if (event.httpMethod !== "GET") {
    return response(405, { error: "Use GET for work order fetches." });
  }

  const config = readConfig();
  const missing = requiredConfig(config);

  if (missing.length > 0) {
    return response(200, {
      mode: "not_configured",
      message: `NetSuite credentials are not configured yet. Missing: ${missing.join(", ")}`,
      workOrders: [],
      raw: [],
    });
  }

  const url = `${config.restBaseUrl.replace(/\/$/, "")}/query/v1/suiteql`;
  const query = process.env.NETSUITE_WORK_ORDER_QUERY || DEFAULT_QUERY;

  try {
    const netsuiteResponse = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: oauthHeader(url, "POST", config),
        "Content-Type": "application/json",
        Prefer: "transient",
      },
      body: JSON.stringify({ q: query }),
    });

    const text = await netsuiteResponse.text();
    const data = parseJson(text);

    if (!netsuiteResponse.ok) {
      return response(netsuiteResponse.status, {
        mode: "netsuite_error",
        status: netsuiteResponse.status,
        message: data?.title || data?.detail || text || "NetSuite request failed.",
        raw: data || text,
      });
    }

    const rows = Array.isArray(data?.items) ? data.items : [];

    return response(200, {
      mode: "connected",
      count: rows.length,
      workOrders: rows.map(mapSuiteQlRow),
      raw: rows,
    });
  } catch (error) {
    return response(500, {
      mode: "function_error",
      message: error instanceof Error ? error.message : "Unknown NetSuite function error.",
    });
  }
}

function readConfig() {
  return {
    accountId: process.env.NETSUITE_ACCOUNT_ID || "",
    consumerKey: process.env.NETSUITE_CONSUMER_KEY || "",
    consumerSecret: process.env.NETSUITE_CONSUMER_SECRET || "",
    realm: process.env.NETSUITE_REALM || process.env.NETSUITE_ACCOUNT_ID || "",
    restBaseUrl: process.env.NETSUITE_REST_BASE_URL || "",
    tokenId: process.env.NETSUITE_TOKEN_ID || "",
    tokenSecret: process.env.NETSUITE_TOKEN_SECRET || "",
  };
}

function requiredConfig(config) {
  return [
    ["NETSUITE_ACCOUNT_ID", config.accountId],
    ["NETSUITE_REALM", config.realm],
    ["NETSUITE_CONSUMER_KEY", config.consumerKey],
    ["NETSUITE_CONSUMER_SECRET", config.consumerSecret],
    ["NETSUITE_TOKEN_ID", config.tokenId],
    ["NETSUITE_TOKEN_SECRET", config.tokenSecret],
    ["NETSUITE_REST_BASE_URL", config.restBaseUrl],
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);
}

function oauthHeader(url, method, config) {
  const oauthParams = {
    oauth_consumer_key: config.consumerKey,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA256",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: config.tokenId,
    oauth_version: "1.0",
  };

  const signatureBase = [
    method.toUpperCase(),
    encode(url),
    encode(normalizeParams(oauthParams)),
  ].join("&");
  const signingKey = `${encode(config.consumerSecret)}&${encode(config.tokenSecret)}`;
  const signature = crypto
    .createHmac("sha256", signingKey)
    .update(signatureBase)
    .digest("base64");

  return [
    `OAuth realm="${escapeHeader(config.realm)}"`,
    ...Object.entries({ ...oauthParams, oauth_signature: signature }).map(
      ([key, value]) => `${key}="${escapeHeader(value)}"`,
    ),
  ].join(", ");
}

function normalizeParams(params) {
  return Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${encode(key)}=${encode(value)}`)
    .join("&");
}

function mapSuiteQlRow(row, index) {
  const transactionId = row.tranid || row.tranId || `WO-${index + 1}`;
  return {
    id: transactionId,
    netsuiteId: String(row.id || ""),
    customer: String(row.entity || "NetSuite customer"),
    item: String(row.item || "NetSuite work order"),
    quantity: Number(row.quantity || 0),
    dueDay: 4,
    priority: "Standard",
    materialStatus: String(row.status || "Released"),
    routing: [],
    source: "netsuite",
    transactionDate: row.trandate || row.tranDate || null,
    startDate: row.startdate || row.startDate || null,
    endDate: row.enddate || row.endDate || null,
  };
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json",
    },
    body: body === "" ? "" : JSON.stringify(body),
  };
}

function encode(value) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function escapeHeader(value) {
  return encode(String(value));
}
