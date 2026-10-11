import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', fullyParallel: false,
  use: { baseURL: 'http://127.0.0.1:3000', channel: 'chrome', headless: true },
  webServer: { command: 'npm run dev', url: 'http://127.0.0.1:3000', reuseExistingServer: !process.env.CI, timeout: 120000, env: { CHAT_ENABLED: 'false', DEMO_MODE: 'true', OPENAI_API_KEY: 'TEST_SENTINEL_NOT_A_REAL_KEY' } },
});
