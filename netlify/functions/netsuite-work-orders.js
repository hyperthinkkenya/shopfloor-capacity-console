import crypto from "node:crypto";

const DEFAULT_WORK_ORDER_QUERY = `
SELECT
  t.id,
  t.tranid,
  BUILTIN.DF(t.entity) AS customer,
  t.status,
  BUILTIN.DF(t.status) AS status_text,
  t.trandate,
  t.startdate,
  t.enddate,
  tl.item,
  BUILTIN.DF(tl.item) AS item_text,
  ABS(tl.quantity) AS quantity
FROM
  transaction t
LEFT JOIN
  transactionline tl
ON
  tl.transaction = t.id
  AND tl.mainline = 'T'
WHERE
  t.type = 'WorkOrd'
ORDER BY
  t.startdate,
  t.tranid
`;

const DEFAULT_OPERATION_QUERY = `
SELECT
  id,
  workorder,
  operationsequence,
  title,
  manufacturingworkcenter,
  BUILTIN.DF(manufacturingworkcenter) AS workcenter_text,
  setuptime,
  runrate,
  remainingwork,
  actualwork,
  startdate,
  enddate,
  status,
  BUILTIN.DF(status) AS status_text
FROM
  manufacturingoperationtask
ORDER BY
  workorder,
  operationsequence
`;

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return response(204, "");
  }

  if (event.httpMethod !== "GET") {
    return response(405, { error: "Use GET for work order fetches." });
  }

  const config = readConfig();
  config.realm = normalizeRealm(
    config.realm || realmFromRestBaseUrl(config.restBaseUrl) || config.accountId,
  );
  const missing = requiredConfig(config);

  if (missing.length > 0) {
    return response(200, {
      mode: "not_configured",
      message: `NetSuite credentials are not configured yet. Missing: ${missing.join(", ")}`,
      workOrders: [],
      raw: [],
    });
  }

  const includeRaw = event.queryStringParameters?.raw === "1";
  const workOrderQuery =
    process.env.NETSUITE_WORK_ORDER_QUERY || DEFAULT_WORK_ORDER_QUERY;
  const operationQuery =
    process.env.NETSUITE_OPERATION_QUERY || DEFAULT_OPERATION_QUERY;

  try {
    const workOrderPull = config.workOrderRestletUrl
      ? {
          rows: await runRestlet(config, config.workOrderRestletUrl, "workOrderRestlet"),
          source: "restlet",
        }
      : {
          rows: await runSuiteQl(config, workOrderQuery, "workOrders"),
          source: "suiteql",
        };
    const operationPull = await runOptionalSuiteQl(
      config,
      operationQuery,
      "operations",
    );
    const resourcePull = await runOptionalSuiteQl(
      config,
      process.env.NETSUITE_RESOURCE_QUERY,
      "resources",
    );
    const toolPull = await runOptionalSuiteQl(
      config,
      process.env.NETSUITE_TOOL_QUERY,
      "tools",
    );
    const normalized = normalizeScheduleData({
      operationRows: operationPull.rows,
      resourceRows: resourcePull.rows,
      toolRows: toolPull.rows,
      workOrderRows: workOrderPull.rows,
    });
    const warnings = [operationPull, resourcePull, toolPull]
      .filter((pull) => pull.warning)
      .map((pull) => pull.warning);

    return response(200, {
      mode: warnings.length > 0 ? "connected_partial" : "connected",
      count: normalized.workOrders.length,
      counts: {
        operations: operationPull.rows.length,
        resources: normalized.resources.length,
        tools: normalized.tools.length,
        workOrders: normalized.workOrders.length,
      },
      warnings,
      source: workOrderPull.source,
      workOrders: normalized.workOrders,
      resources: normalized.resources,
      tools: normalized.tools,
      raw: includeRaw
        ? {
            operations: operationPull.rows,
            resources: resourcePull.rows,
            tools: toolPull.rows,
            workOrders: workOrderPull.rows,
          }
        : undefined,
    });
  } catch (error) {
    if (error instanceof NetSuiteRequestError) {
      return response(error.status, {
        authContext: safeAuthContext(config),
        mode: "netsuite_error",
        status: error.status,
        message: error.message,
        query: error.label,
        raw: error.raw,
      });
    }

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
    realm: process.env.NETSUITE_REALM || "",
    restBaseUrl: process.env.NETSUITE_REST_BASE_URL || "",
    tokenId: process.env.NETSUITE_TOKEN_ID || "",
    tokenSecret: process.env.NETSUITE_TOKEN_SECRET || "",
    workOrderRestletUrl: process.env.NETSUITE_WORK_ORDER_RESTLET_URL || "",
  };
}

async function runOptionalSuiteQl(config, query, label) {
  if (!query) return { rows: [], warning: "" };

  try {
    const rows = await runSuiteQl(config, query, label);
    return { rows, warning: "" };
  } catch (error) {
    if (error instanceof NetSuiteRequestError) {
      return {
        rows: [],
        warning: `${label} query skipped: ${error.message}`,
      };
    }

    return {
      rows: [],
      warning: `${label} query skipped: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    };
  }
}

async function runSuiteQl(config, query, label) {
  const limit = clampNumber(process.env.NETSUITE_SUITEQL_LIMIT, 1, 1000, 1000);
  const maxRows = clampNumber(process.env.NETSUITE_SUITEQL_MAX_ROWS, 1, 100000, 5000);
  const rows = [];
  let offset = 0;

  while (rows.length < maxRows) {
    const url = `${config.restBaseUrl.replace(
      /\/$/,
      "",
    )}/query/v1/suiteql?limit=${limit}&offset=${offset}`;
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
      throw new NetSuiteRequestError(
        data?.title || data?.detail || text || "NetSuite request failed.",
        netsuiteResponse.status,
        data || text,
        label,
      );
    }

    const pageRows = Array.isArray(data?.items) ? data.items : [];
    rows.push(...pageRows);

    if (pageRows.length < limit || rows.length >= Number(data?.totalResults || 0)) {
      break;
    }

    offset += pageRows.length;
  }

  return rows.slice(0, maxRows);
}

async function runRestlet(config, url, label) {
  const netsuiteResponse = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: oauthHeader(url, "GET", config),
      "Content-Type": "application/json",
    },
  });

  const text = await netsuiteResponse.text();
  const data = parseJson(text);

  if (!netsuiteResponse.ok) {
    throw new NetSuiteRequestError(
      data?.title || data?.detail || text || "NetSuite RESTlet request failed.",
      netsuiteResponse.status,
      data || text,
      label,
    );
  }

  return normalizeRestletRows(data);
}

function realmFromRestBaseUrl(restBaseUrl) {
  try {
    const hostname = new URL(restBaseUrl).hostname;
    return hostname.split(".")[0] || "";
  } catch {
    return "";
  }
}

function normalizeRealm(value) {
  return String(value || "")
    .trim()
    .replace(/-/g, "_")
    .toUpperCase();
}

function safeAuthContext(config) {
  return {
    accountId: config.accountId,
    consumerKeyConfigured: Boolean(config.consumerKey),
    realm: config.realm,
    restHost: safeHost(config.restBaseUrl),
    tokenIdConfigured: Boolean(config.tokenId),
    workOrderRestletConfigured: Boolean(config.workOrderRestletUrl),
  };
}

function safeHost(restBaseUrl) {
  try {
    return new URL(restBaseUrl).hostname;
  } catch {
    return "invalid-url";
  }
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
  const parsedUrl = new URL(url);
  const oauthParams = {
    oauth_consumer_key: config.consumerKey,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA256",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: config.tokenId,
    oauth_version: "1.0",
  };
  const signatureParams = { ...oauthParams };
  parsedUrl.searchParams.forEach((value, key) => {
    signatureParams[key] = value;
  });

  const signatureBase = [
    method.toUpperCase(),
    encode(`${parsedUrl.origin}${parsedUrl.pathname}`),
    encode(normalizeParams(signatureParams)),
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

function normalizeScheduleData({
  operationRows,
  resourceRows,
  toolRows,
  workOrderRows,
}) {
  const operationsByWorkOrder = groupOperationsByWorkOrder(operationRows);
  const derivedResources = deriveResourcesFromOperations(operationRows);
  return {
    resources: resourceRows.length > 0 ? resourceRows.map(mapResourceRow) : derivedResources,
    tools: toolRows.map(mapToolRow),
    workOrders: workOrderRows.map((row, index) =>
      mapWorkOrderRow(row, index, operationsByWorkOrder.get(String(row.id)) || []),
    ),
  };
}

function normalizeRestletRows(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.workOrders)) return data.workOrders;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function groupOperationsByWorkOrder(operationRows) {
  const groups = new Map();
  operationRows.forEach((row) => {
    const workOrderId = stringValue(row.workorder, row.workOrder, row.work_order);
    if (!workOrderId) return;
    const rows = groups.get(workOrderId) || [];
    rows.push(row);
    groups.set(workOrderId, rows);
  });

  groups.forEach((rows) => {
    rows.sort(
      (a, b) =>
        numberValue(a.operationsequence, a.operationSequence) -
        numberValue(b.operationsequence, b.operationSequence),
    );
  });

  return groups;
}

function mapWorkOrderRow(row, index, operationRows) {
  const netsuiteId = stringValue(row.id, row.internalid, row.internalId);
  const transactionId = stringValue(row.tranid, row.tranId, `WO-${index + 1}`);
  const quantity = numberValue(row.quantity, row.orderquantity, row.orderQuantity);
  return {
    assemblyLevel: numberValue(row.assemblylevel, row.assemblyLevel, 0),
    id: transactionId,
    netsuiteId,
    parentWorkOrderId: stringValue(
      row.parentworkorder,
      row.parentWorkOrder,
      row.parent_work_order,
      "",
    ),
    customer: stringValue(
      row.customer,
      row.entityText,
      row.entity_text,
      row.entity,
      "NetSuite customer",
    ),
    item: stringValue(
      row.item_text,
      row.itemText,
      row.assemblyText,
      row.assembly,
      row.item,
      "NetSuite work order",
    ),
    quantity,
    dueDay: dateToPlanningDay(row.enddate || row.endDate || row.duedate || row.dueDate),
    priority: mapPriority(row.priority, row.priority_text, row.priorityText),
    materialStatus: mapMaterialStatus(row.status_text, row.status),
    routing: operationRows.map((operationRow, operationIndex) =>
      mapOperationRow(operationRow, operationIndex, quantity),
    ),
    source: "netsuite",
    transactionDate: row.trandate || row.tranDate || null,
    startDate: row.startdate || row.startDate || null,
    endDate: row.enddate || row.endDate || null,
  };
}

function mapOperationRow(row, index, quantity) {
  const operationId = stringValue(row.id, row.internalid, row.internalId);
  const sequence = stringValue(
    row.operationsequence,
    row.operationSequence,
    (index + 1) * 10,
  );
  const workCenterId = stringValue(
    row.manufacturingworkcenter,
    row.manufacturingWorkCenter,
    row.workcenter,
    row.workCenter,
    "unassigned",
  );
  const machineId = resourceId(workCenterId);
  const duration = estimateOperationHours(row, quantity);

  return {
    id: operationId ? `ns-op-${operationId}` : `ns-op-${sequence}`,
    step: sequence,
    label: stringValue(row.title, row.operationname, row.operationName, `Operation ${sequence}`),
    machineId,
    skill: machineId,
    toolId: stringValue(row.toolid, row.toolId, `tool-${machineId}`),
    duration,
    skillHours: duration,
    netsuiteId: operationId,
    status: stringValue(row.status_text, row.statusText, row.status, ""),
    startDate: row.startdate || row.startDate || null,
    endDate: row.enddate || row.endDate || null,
  };
}

function deriveResourcesFromOperations(operationRows) {
  const resources = new Map();
  operationRows.forEach((row) => {
    const workCenterId = stringValue(
      row.manufacturingworkcenter,
      row.manufacturingWorkCenter,
      row.workcenter,
      row.workCenter,
      "",
    );
    if (!workCenterId) return;
    const id = resourceId(workCenterId);
    resources.set(id, {
      id,
      netsuiteId: workCenterId,
      label: stringValue(
        row.workcenter_text,
        row.workCenterText,
        row.manufacturingworkcenter_text,
        `Work center ${workCenterId}`,
      ),
      type: "workCenter",
    });
  });
  return Array.from(resources.values());
}

function mapResourceRow(row) {
  const netsuiteId = stringValue(row.id, row.internalid, row.internalId);
  return {
    id: resourceId(netsuiteId || stringValue(row.name, row.label, "resource")),
    netsuiteId,
    label: stringValue(row.name, row.label, row.workcenter_text, `Resource ${netsuiteId}`),
    type: stringValue(row.type, "resource"),
    capacityHours: numberValue(row.capacityhours, row.capacityHours, row.capacity, 0),
  };
}

function mapToolRow(row) {
  const netsuiteId = stringValue(row.id, row.internalid, row.internalId);
  return {
    id: stringValue(row.toolid, row.toolId, netsuiteId ? `tool-${netsuiteId}` : ""),
    netsuiteId,
    label: stringValue(row.name, row.label, `Tool ${netsuiteId}`),
    quantity: numberValue(row.quantity, row.available, 1),
    location: stringValue(row.location, row.location_text, row.locationText, ""),
  };
}

function estimateOperationHours(row, quantity) {
  const remainingWork = numberValue(row.remainingwork, row.remainingWork);
  if (remainingWork > 0) return roundHours(remainingWork);

  const actualWork = numberValue(row.actualwork, row.actualWork);
  if (actualWork > 0) return roundHours(actualWork);

  const setupMinutes = numberValue(row.setuptime, row.setupTime);
  const runMinutes = numberValue(row.runrate, row.runRate);
  const estimatedMinutes = setupMinutes + runMinutes * Math.max(quantity, 1);
  return roundHours(estimatedMinutes > 0 ? estimatedMinutes / 60 : 1);
}

function dateToPlanningDay(value) {
  if (!value) return 4;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 4;
  const day = date.getDay();
  if (day === 1) return 0;
  if (day === 2) return 1;
  if (day === 3) return 2;
  if (day === 4) return 3;
  return 4;
}

function mapPriority(...values) {
  const value = stringValue(...values).toLowerCase();
  if (value.includes("hot") || value.includes("urgent") || value.includes("rush")) {
    return "Hot";
  }
  if (value.includes("high")) return "High";
  return "Standard";
}

function mapMaterialStatus(...values) {
  const value = stringValue(...values, "Released");
  if (/hold/i.test(value)) return "Hold";
  if (/partial/i.test(value)) return "Partial";
  return value;
}

function resourceId(value) {
  return `ns-wc-${String(value || "unassigned")
    .trim()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()}`;
}

function stringValue(...values) {
  const value = values.find(
    (candidate) => candidate !== undefined && candidate !== null && candidate !== "",
  );
  return value === undefined || value === null ? "" : String(value);
}

function numberValue(...values) {
  const value = values.find(
    (candidate) => candidate !== undefined && candidate !== null && candidate !== "",
  );
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function roundHours(value) {
  return Math.max(0.25, Number(value.toFixed(2)));
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
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

class NetSuiteRequestError extends Error {
  constructor(message, status, raw, label) {
    super(message);
    this.name = "NetSuiteRequestError";
    this.status = status;
    this.raw = raw;
    this.label = label;
  }
}
