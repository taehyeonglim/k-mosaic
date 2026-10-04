import { expect, test } from '@playwright/test';

import {
  containsApiKeyParameter,
  containsSecret,
  gotoDashboard,
  readApiKeyIfAvailable,
} from './helpers';

test('E11 페이지 요청 URL과 로드된 JavaScript 번들에 API 키가 노출되지 않는다', async ({
  page,
  request,
}) => {
  // 키가 없는 환경(CI·새 clone)에서는 값 비교 대신 인증 파라미터 흔적만 검사한다.
  const apiKey = readApiKeyIfAvailable();
  const requestUrls: string[] = [];
  page.on('request', (requestEvent) => requestUrls.push(requestEvent.url()));

  await gotoDashboard(page);

  if (
    (apiKey !== null && containsSecret(requestUrls, apiKey)) ||
    containsApiKeyParameter(requestUrls)
  ) {
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

  if (
    (apiKey !== null && containsSecret(scriptBodies, apiKey)) ||
    containsApiKeyParameter(scriptBodies)
  ) {
    throw new Error('로드된 JavaScript 본문에서 비밀값이 발견되었습니다.');
  }

  expect(requestUrls.length).toBeGreaterThan(0);
  expect(scriptBodies.length).toBeGreaterThan(0);
});
