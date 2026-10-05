/**
 * Meridian reporting BFF — loopback only. Serves report fixtures and
 * POST /api/v1/assistant/chat (Grok via xAI when XAI_API_KEY is set; else fixture).
 */
import { createServer } from "node:http";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadDotEnv(fileName) {
  const path = resolve(process.cwd(), fileName);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined || process.env[key] === "") {
      process.env[key] = value;
    }
  }
}

loadDotEnv(".env.local");
loadDotEnv(".env");

const host = "127.0.0.1";
const port = Number.parseInt(process.env.PORT ?? "4001", 10);
const allowedOrigin = process.env.MERIDIAN_REPORTING_APP_ORIGIN ?? "http://localhost:3001";
const expectedToken = process.env.MERIDIAN_BFF_DEMO_TOKEN;
const xaiApiKey = process.env.XAI_API_KEY?.trim() ?? "";
const xaiModel = process.env.XAI_MODEL?.trim() || "grok-4-fast-non-reasoning";
const requestsByIp = new Map();
const rateLimitWindowMs = 60_000;
const rateLimitMaxRequests = 120;

if (!["development", "test"].includes(process.env.NODE_ENV)) {
  throw new Error("This synthetic BFF may only run with NODE_ENV set to development or test.");
}

if (!expectedToken || expectedToken.length < 16) {
  throw new Error("MERIDIAN_BFF_DEMO_TOKEN must be set to a value of at least 16 characters.");
}

const organisation = {
  id: "org_harbour_studio",
  name: "Harbour Studio",
  role: "Owner",
};

const getRoutes = {
  "/health": { status: "ok", service: "meridian-reporting-bff" },
  "/api/v1/organisation": organisation,
  "/api/v1/reports/profit-loss": {
    organisationId: organisation.id,
    period: "2026-04-01/2026-09-30",
    income: 104390,
    expenses: 61547.27,
    netProfit: 42842.73,
  },
  "/api/v1/reports/cash-flow": {
    organisationId: organisation.id,
    period: "2026-04-01/2026-09-30",
    openingCash: 38000,
    netCashMovement: 13392,
    closingCash: 51392,
  },
};

function sendJson(response, statusCode, requestId, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Security-Policy": "default-src 'none'",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-Request-Id": requestId,
  });
  response.end(JSON.stringify({ requestId, ...payload }));
}

function tokenMatches(authorization) {
  if (!authorization?.startsWith("Bearer ")) return false;
  const supplied = Buffer.from(authorization.slice(7));
  const expected = Buffer.from(expectedToken);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

function withinRateLimit(ip) {
  const now = Date.now();
  const recentRequests = (requestsByIp.get(ip) ?? []).filter((timestamp) => now - timestamp < rateLimitWindowMs);
  if (recentRequests.length >= rateLimitMaxRequests) return false;
  recentRequests.push(now);
  requestsByIp.set(ip, recentRequests);
  if (requestsByIp.size > 1_000) {
    requestsByIp.delete(requestsByIp.keys().next().value);
  }
  return true;
}

function readBody(request, maxBytes = 64_000) {
  return new Promise((resolveBody, reject) => {
    const chunks = [];
    let total = 0;
    request.on("data", (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error("request_too_large"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolveBody(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

function sanitizeContext(value) {
  return String(value ?? "")
    .replace(/[\r\n]+/g, " ")
    .slice(0, 100);
}

function sanitizeHistory(history) {
  return (Array.isArray(history) ? history : [])
    .filter((entry) => entry && ["user", "assistant"].includes(entry.role))
    .map((entry) => ({
      role: entry.role,
      content: String(entry.content ?? "").slice(0, 1000),
    }))
    .slice(-6);
}

function fixtureAssistantReply(message) {
  const lower = String(message ?? "").toLowerCase();
  if (lower.includes("quarter") || lower.includes("compare")) {
    return {
      reply:
        "Income is up versus last quarter, and net profit improved as client work held steady.\n\n1. **Income** – $56,180 this quarter vs $48,210 last quarter\n2. **Net profit** – $24,202 vs $18,640\n\nFigures use Harbour Studio demo books (AUD).",
      table: {
        headers: ["Metric", "Last Quarter (Apr–Jun 2026)", "Current Quarter (Jul–Sep 2026)"],
        rows: [
          ["Income", "$48,210", "$56,180"],
          ["Net Profit", "$18,640", "$24,202"],
        ],
      },
      cta: { label: "Open Profit and loss Report", href: "/#profit-loss" },
      provider: "fixture",
      rationale:
        "Compared current quarter (Jul–Sep 2026) income and net profit against last quarter (Apr–Jun 2026) from Harbour Studio demo books.",
      relatedQuestions: [
        "What's driving the income increase?",
        "What's my gross profit margin?",
        "What are my biggest income sources?",
      ],
    };
  }
  if (lower.includes("margin") || lower.includes("gross")) {
    return {
      reply:
        "Gross profit margin is about **58%** this quarter on demo data — strong for wholesale coffee.",
      table: null,
      cta: { label: "Open Profit and loss Report", href: "/#profit-loss" },
      provider: "fixture",
      rationale: "Divided gross profit by income for the current quarter on Harbour Studio demo books.",
      relatedQuestions: [
        "How does this quarter compare to last?",
        "What are my biggest expenses?",
        "What are my biggest income sources?",
      ],
    };
  }
  if (lower.includes("income") || lower.includes("source")) {
    return {
      reply:
        "Your top income sources this quarter are:\n\n1. **Coffee Sales** – $142,800 (retail & wholesale combined)\n2. **Merchandise** – $18,450\n3. **Catering Events** – $12,300\n\nLast quarter: Coffee Sales were $138,200, Merchandise $15,900, Catering $9,800.",
      table: {
        headers: ["Source", "Amount"],
        rows: [
          ["Coffee Sales", "$142,800"],
          ["Merchandise", "$18,450"],
          ["Catering Events", "$12,300"],
        ],
      },
      cta: { label: "Open Profit and loss Report", href: "/#profit-loss" },
      provider: "fixture",
      rationale:
        "Ranked income accounts for the current quarter from Harbour Studio demo books, then compared the same categories to last quarter.",
      relatedQuestions: [
        "How does this quarter compare to last?",
        "What's my gross profit margin?",
        "Which income source grew the most?",
      ],
    };
  }
  return {
    reply:
      "I can compare quarters, margin, or income sources using Harbour Studio demo books. Ask a finance question to continue.",
    table: null,
    cta: null,
    provider: "fixture",
    rationale: "No specific metric requested — offered the default demo finance prompts.",
    relatedQuestions: [
      "How does this quarter compare to last?",
      "What's my gross profit margin?",
      "What are my biggest income sources?",
    ],
  };
}

function parseGrokPayload(raw, fallbackMessage) {
  try {
    const cleaned = String(raw ?? "")
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "");
    const parsed = JSON.parse(cleaned);
    const reply = String(parsed.reply ?? "").trim();
    if (!reply) throw new Error("missing_reply");
    return {
      reply,
      table: null,
      cta: { label: "Open Profit and loss Report", href: "/#profit-loss" },
      rationale:
        String(parsed.rationale ?? "").trim() ||
        "Answered from Harbour Studio demo books for this page context.",
      relatedQuestions: (Array.isArray(parsed.relatedQuestions) ? parsed.relatedQuestions : [])
        .map((item) => String(item ?? "").trim())
        .filter(Boolean)
        .slice(0, 3),
    };
  } catch {
    const fixture = fixtureAssistantReply(fallbackMessage);
    return {
      reply: String(raw ?? "").trim() || fixture.reply,
      table: null,
      cta: fixture.cta,
      rationale: fixture.rationale,
      relatedQuestions: fixture.relatedQuestions,
    };
  }
}

async function callGrok({ message, context, history }) {
  const safeContext = sanitizeContext(context);
  const system = `You are Meridian's in-product AI Assistant for Harbour Studio (synthetic AU accounting demo).
Prefer AUD. Context page: ${safeContext || "Dashboard"}.
Never invent real customer PII. Do not claim live bank access.

Respond with ONLY valid JSON (no markdown fences) using this shape:
{"reply":"user-facing answer using markdown: paragraphs and numbered lists with **bold** labels; put each list item on its own line","rationale":"1-2 sentences explaining which demo-book figures or steps you used","relatedQuestions":["follow-up 1","follow-up 2","follow-up 3"]}`;

  const messages = [
    { role: "system", content: system },
    ...sanitizeHistory(history),
    { role: "user", content: String(message ?? "").slice(0, 2000) },
  ];

  async function complete(withJsonFormat) {
    const body = {
      model: xaiModel,
      messages,
      temperature: 0.3,
      max_tokens: 700,
    };
    if (withJsonFormat) body.response_format = { type: "json_object" };
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${xaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) throw new Error(`xai_${res.status}`);
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("xai_empty_reply");
    return content;
  }

  let content;
  try {
    content = await complete(true);
  } catch {
    content = await complete(false);
  }
  const parsed = parseGrokPayload(content, message);
  if (!parsed.relatedQuestions.length) {
    parsed.relatedQuestions = fixtureAssistantReply(message).relatedQuestions;
  }
  return {
    ...parsed,
    provider: `grok:${xaiModel}`,
  };
}

const server = createServer(async (request, response) => {
  const requestId = randomUUID();
  const origin = request.headers.origin;
  const ip = request.socket.remoteAddress ?? "unknown";
  const path = new URL(request.url, `http://${host}`).pathname;

  if (origin && origin !== allowedOrigin) {
    sendJson(response, 403, requestId, { error: "origin_not_allowed" });
    return;
  }

  if (origin) response.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  response.setHeader("Vary", "Origin");
  response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");

  if (!withinRateLimit(ip)) {
    sendJson(response, 429, requestId, { error: "rate_limit_exceeded" });
    return;
  }

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  if (!tokenMatches(request.headers.authorization)) {
    console.info(JSON.stringify({ event: "authentication_failure", requestId, route: path }));
    sendJson(response, 401, requestId, { error: "unauthorized" });
    return;
  }

  if (request.method === "POST" && path === "/api/v1/assistant/chat") {
    try {
      const raw = await readBody(request);
      const body = raw.length ? JSON.parse(raw.toString("utf8")) : {};
      const message = String(body.message ?? "").trim();
      if (!message) {
        sendJson(response, 400, requestId, { error: "message_required" });
        return;
      }

      let payload;
      if (xaiApiKey) {
        try {
          payload = await callGrok({
            message,
            context: sanitizeContext(body.context),
            history: sanitizeHistory(body.history),
          });
        } catch (err) {
          console.info(
            JSON.stringify({
              event: "assistant_grok_fallback",
              requestId,
              error: err instanceof Error ? err.message.slice(0, 80) : "unknown",
            }),
          );
          payload = fixtureAssistantReply(message);
        }
      } else {
        payload = fixtureAssistantReply(message);
      }

      console.info(
        JSON.stringify({
          event: "assistant_chat",
          requestId,
          provider: payload.provider,
          hasKey: Boolean(xaiApiKey),
        }),
      );
      sendJson(response, 200, requestId, payload);
    } catch (err) {
      console.info(
        JSON.stringify({
          event: "assistant_chat_error",
          requestId,
          error: err instanceof Error ? err.message : "unknown",
        }),
      );
      sendJson(response, 500, requestId, { error: "assistant_failed" });
    }
    return;
  }

  if (request.method !== "GET") {
    sendJson(response, 405, requestId, { error: "method_not_allowed" });
    return;
  }

  const payload = getRoutes[path];
  if (!payload) {
    sendJson(response, 404, requestId, { error: "not_found" });
    return;
  }

  console.info(JSON.stringify({ event: "request_success", requestId, route: path }));
  sendJson(response, 200, requestId, payload);
});

server.listen(port, host, () => {
  console.info(
    JSON.stringify({
      event: "server_started",
      service: "meridian-reporting-bff",
      host,
      port,
      assistant: xaiApiKey ? "grok" : "fixture",
    }),
  );
});
