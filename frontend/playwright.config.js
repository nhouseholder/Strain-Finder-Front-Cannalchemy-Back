import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  timeout: 30000,
  use: {
    // Run against the Wrangler local dev server for full Cloudflare Function testing
    baseURL: process.env.TEST_BASE_URL || 'http://localhost:8788',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Start Wrangler dev server before tests
  webServer: process.env.TEST_BASE_URL ? undefined : {
    command: 'npm run dev:local',
    port: 8788,
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
})
