import { expect, test } from '@playwright/test';

import { containsSecret, gotoDashboard, readApiKeyFromEnvLocal } from './helpers';

test('E11 페이지 요청 URL과 로드된 JavaScript 번들에 API 키가 노출되지 않는다', async ({
  page,
  request,
}) => {
  const apiKey = readApiKeyFromEnvLocal();
  const requestUrls: string[] = [];
  page.on('request', (requestEvent) => requestUrls.push(requestEvent.url()));

  await gotoDashboard(page);

  if (containsSecret(requestUrls, apiKey)) {
    throw new Error('페이지 로드 요청 URL에서 비밀값이 발견되었습니다.');
  }

  const scripts = await page.locator('script').evaluateAll((nodes) =>
    nodes.map((node) => ({
      source: (node as HTMLScriptElement).src,
      inlineBody: node.textContent ?? '',
    })),
  );
  const scriptBodies = scripts.map((script) => script.inlineBody);
  for (const script of scripts.filter((item) => item.source.length > 0)) {
    const response = await request.get(script.source);
    if (!response.ok()) {
      throw new Error('로드된 JavaScript 번들을 확인하지 못했습니다.');
    }
    scriptBodies.push(await response.text());
  }

  if (containsSecret(scriptBodies, apiKey)) {
    throw new Error('로드된 JavaScript 본문에서 비밀값이 발견되었습니다.');
  }

  expect(requestUrls.length).toBeGreaterThan(0);
  expect(scriptBodies.length).toBeGreaterThan(0);
});
