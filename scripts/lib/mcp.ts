import { redact } from './redact.js';

// korean-stats-mcp 탐색 도구 — 데이터 탐색 단계 전용, 런타임에는 쓰지 않는다 (DL-003).

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: unknown;
  [key: string]: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parseMcpResponse(text: string): unknown {
  try {
    return JSON.parse(text.replace(/^\uFEFF/, '').trim());
  } catch {
    const events = text
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .filter(Boolean);
    const last = events.at(-1);
    if (!last) throw new Error(redact('MCP 응답 JSON을 파싱할 수 없습니다.'));
    try {
      return JSON.parse(last);
    } catch {
      throw new Error(redact('MCP 이벤트 응답 JSON을 파싱할 수 없습니다.'));
    }
  }
}

export async function listMcpTools(endpoint: string): Promise<McpTool[]> {
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(redact(`MCP 요청에 실패했습니다. ${message}`));
  }
  const body = parseMcpResponse(await response.text());
  if (!response.ok) throw new Error(redact(`MCP HTTP 응답 오류 ${response.status}`));
  if (!isRecord(body)) throw new Error(redact('MCP 응답 구조가 예상과 다릅니다.'));
  if (isRecord(body.error)) {
    throw new Error(
      redact(`MCP tools/list 오류: ${String(body.error.message ?? '알 수 없는 오류')}`),
    );
  }
  const result = isRecord(body.result) ? body.result : body;
  const tools = isRecord(result) && Array.isArray(result.tools) ? result.tools : null;
  if (tools === null) throw new Error(redact('MCP 응답에 도구 목록이 없습니다.'));
  return tools.filter(isRecord) as McpTool[];
}
