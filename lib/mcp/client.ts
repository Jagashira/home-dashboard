import { randomUUID } from "node:crypto";
import { NewsPayload, TavilyNewsArgs } from "@/lib/types/news";

const MCP_PROTOCOL_VERSION = "2025-03-26";
const HTTP_TIMEOUT_MS = 20000;

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: string | number;
  method: string;
  params?: Record<string, unknown>;
};

type JsonRpcResponse = {
  jsonrpc: "2.0";
  id?: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
};

function getMcpUrl() {
  return process.env.MCP_URL || "http://127.0.0.1:8000/mcp";
}

async function parseSse(text: string): Promise<JsonRpcResponse[]> {
  const chunks = text.split(/\n\n+/g).map((chunk) => chunk.trim()).filter(Boolean);
  const messages: JsonRpcResponse[] = [];

  for (const chunk of chunks) {
    const dataLines = chunk
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .filter(Boolean);

    if (dataLines.length === 0) {
      continue;
    }

    const payload = dataLines.join("\n");
    if (payload === "[DONE]") {
      continue;
    }

    try {
      const parsed = JSON.parse(payload) as JsonRpcResponse;
      if (parsed && parsed.jsonrpc === "2.0") {
        messages.push(parsed);
      }
    } catch {
      // Ignore non-JSON SSE messages.
    }
  }

  return messages;
}

async function parseHttpResponse(response: Response): Promise<JsonRpcResponse[]> {
  const contentType = response.headers.get("content-type") || "";
  const raw = await response.text();

  if (!raw.trim()) {
    return [];
  }

  if (contentType.includes("text/event-stream")) {
    return parseSse(raw);
  }

  try {
    const parsed = JSON.parse(raw) as JsonRpcResponse | JsonRpcResponse[];
    if (Array.isArray(parsed)) {
      return parsed.filter((item) => item && item.jsonrpc === "2.0");
    }
    if (parsed && parsed.jsonrpc === "2.0") {
      return [parsed];
    }
    return [];
  } catch {
    throw new Error(`Invalid MCP response body: ${raw.slice(0, 240)}`);
  }
}

async function pollSessionMessages(sessionId: string): Promise<JsonRpcResponse[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);

  try {
    const response = await fetch(getMcpUrl(), {
      method: "GET",
      headers: {
        accept: "application/json, text/event-stream",
        "mcp-protocol-version": MCP_PROTOCOL_VERSION,
        "mcp-session-id": sessionId
      },
      cache: "no-store",
      signal: controller.signal
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`MCP session poll failed (${response.status}): ${text.slice(0, 240)}`);
    }

    return parseHttpResponse(response);
  } finally {
    clearTimeout(timeout);
  }
}

async function sendJsonRpc(
  body: JsonRpcRequest,
  options?: {
    sessionId?: string;
  }
): Promise<{
  messages: JsonRpcResponse[];
  sessionId?: string;
}> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
    "mcp-protocol-version": MCP_PROTOCOL_VERSION
  };

  if (options?.sessionId) {
    headers["mcp-session-id"] = options.sessionId;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
  let response: Response;

  try {
    response = await fetch(getMcpUrl(), {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`MCP request failed (${response.status}): ${text.slice(0, 240)}`);
  }

  let messages = await parseHttpResponse(response);
  const sessionId = response.headers.get("mcp-session-id") || options?.sessionId || undefined;

  // Some streamable-http servers acknowledge POST with an empty body and deliver
  // JSON-RPC messages via session stream (GET). Recover those messages here.
  if (messages.length === 0 && sessionId && body.id !== undefined) {
    const streamed = await pollSessionMessages(sessionId);
    if (streamed.length > 0) {
      messages = streamed;
    }
  }

  return { messages, sessionId };
}

function extractReply(messages: JsonRpcResponse[], requestId: string): JsonRpcResponse {
  const message = messages.find((item) => String(item.id) === requestId) ?? messages[0];
  if (!message) {
    throw new Error("No MCP JSON-RPC message returned.");
  }
  if (message.error) {
    throw new Error(`MCP error: ${message.error.message}`);
  }
  return message;
}

function normalizeNewsPayload(raw: unknown): NewsPayload {
  if (!raw || typeof raw !== "object") {
    throw new Error("Tool response is not an object.");
  }

  const parsed = raw as {
    state?: unknown;
    attributes?: {
      tool?: unknown;
      query?: unknown;
      total_results?: unknown;
      top_headline?: unknown;
      top_url?: unknown;
      updated_at?: unknown;
      metadata?: unknown;
      articles?: unknown;
    };
  };

  const articlesArray = Array.isArray(parsed.attributes?.articles)
    ? parsed.attributes?.articles
    : [];
  const articles: NewsPayload["attributes"]["articles"] = [];
  for (const item of articlesArray) {
    if (!item || typeof item !== "object") continue;
    const article = item as Record<string, unknown>;
    const title = typeof article.title === "string" ? article.title : "(untitled)";
    const url = typeof article.url === "string" ? article.url : "";
    articles.push({
      title,
      url,
      source: typeof article.source === "string" ? article.source : undefined,
      published_date:
        typeof article.published_date === "string" ? article.published_date : undefined,
      score: typeof article.score === "number" ? article.score : undefined,
      content: typeof article.content === "string" ? article.content : undefined
    });
  }

  return {
    state: typeof parsed.state === "string" ? parsed.state : "ok",
    attributes: {
      tool: typeof parsed.attributes?.tool === "string" ? parsed.attributes.tool : "tavily_news",
      query: typeof parsed.attributes?.query === "string" ? parsed.attributes.query : "",
      total_results:
        typeof parsed.attributes?.total_results === "number" ? parsed.attributes.total_results : articlesArray.length,
      top_headline:
        typeof parsed.attributes?.top_headline === "string" ? parsed.attributes.top_headline : undefined,
      top_url: typeof parsed.attributes?.top_url === "string" ? parsed.attributes.top_url : undefined,
      updated_at:
        typeof parsed.attributes?.updated_at === "string"
          ? parsed.attributes.updated_at
          : new Date().toISOString(),
      metadata:
        parsed.attributes?.metadata && typeof parsed.attributes.metadata === "object"
          ? (parsed.attributes.metadata as Record<string, unknown>)
          : undefined,
      articles
    }
  };
}

export async function initializeSession(): Promise<{ sessionId?: string }> {
  const id = `init-${randomUUID()}`;
  const initializeResult = await sendJsonRpc({
    jsonrpc: "2.0",
    id,
    method: "initialize",
    params: {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: {
        name: "home-dashboard",
        version: "1.0.0"
      }
    }
  });

  extractReply(initializeResult.messages, id);

  await sendJsonRpc(
    {
      jsonrpc: "2.0",
      method: "notifications/initialized"
    },
    { sessionId: initializeResult.sessionId }
  );

  return { sessionId: initializeResult.sessionId };
}

export async function callTool(
  name: string,
  args: Record<string, unknown>,
  sessionId?: string
): Promise<unknown> {
  const id = `tool-${randomUUID()}`;
  const toolResult = await sendJsonRpc(
    {
      jsonrpc: "2.0",
      id,
      method: "tools/call",
      params: {
        name,
        arguments: args
      }
    },
    { sessionId }
  );

  const message = extractReply(toolResult.messages, id);
  const result = message.result as {
    content?: Array<{ type?: string; text?: string }>;
  };

  const text = result?.content?.[0]?.text;
  if (!text || typeof text !== "string") {
    throw new Error("tools/call result.content[0].text not found.");
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error("tools/call content text is not valid JSON.");
  }
}

export async function fetchNews(args: TavilyNewsArgs): Promise<NewsPayload> {
  const { sessionId } = await initializeSession();
  const raw = await callTool("tavily_news", args, sessionId);
  return normalizeNewsPayload(raw);
}
