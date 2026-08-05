import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { listMcpTools, redact } from '../src/lib/mcp/index.js';

const MCP_ENDPOINT = 'https://mcp.gomdori.app/stats';

export async function runInspectMcp(endpoint = MCP_ENDPOINT): Promise<void> {
  const tools = await listMcpTools(endpoint);
  console.log(redact(`MCP 도구 ${tools.length}개`));
  for (const tool of tools)
    console.log(redact(`- ${tool.name}${tool.description ? `: ${tool.description}` : ''}`));
}

async function main(): Promise<void> {
  await runInspectMcp();
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(redact(`mcp:inspect 실패: ${message}`));
    process.exitCode = 1;
  });
}
