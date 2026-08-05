import { defineConfig, devices } from '@playwright/test';

const testPort = process.env.PLAYWRIGHT_PORT ?? '3000';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { outputFolder: 'e2e/playwright-report', open: 'never' }]],
  use: {
    baseURL: `http://localhost:${testPort}`,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `pnpm build && node -e "const net=require('node:net');const p=Number(process.argv[1]);const s=net.createServer();s.once('error',()=>{console.error('ERROR: port '+p+' is already in use');process.exit(1)});s.listen(p,()=>s.close())" ${testPort} && pnpm exec serve out -l ${testPort}`,
    url: `http://localhost:${testPort}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
