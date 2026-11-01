import { defineConfig } from '@playwright/test';

// Browser tests run against their own server and folders, so they never touch real records.
process.env.DATA_DIR ||= '.data/test-e2e';
process.env.RUN_EXPORT_DIR ||= '.data/test-e2e/student-runs';
process.env.BASE_URL ||= 'http://localhost:4174';

export default defineConfig({
  testDir: './tests',
  testMatch: '*.e2e.ts',
  timeout: 120000,
  workers: 1,
  webServer: {
    command: 'vite build && tsx server/index.ts',
    url: `${process.env.BASE_URL}/api/config`,
    reuseExistingServer: true,
    env: {
      PORT: '4174',
      NODE_ENV: 'production',
      ASSESSMENT_MODE: 'demo',
      DATA_DIR: process.env.DATA_DIR,
      RUN_EXPORT_DIR: process.env.RUN_EXPORT_DIR,
      TYPESAFE_API_KEY: '',
      ANTHROPIC_API_KEY: '',
    },
  },
  use: {
    baseURL: process.env.BASE_URL,
    viewport: { width: 1440, height: 1000 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
      args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader'],
    },
  },
});
