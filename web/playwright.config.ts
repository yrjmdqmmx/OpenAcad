import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  timeout: 45000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 2,
  reporter: [
    ["list"],
    [
      "html",
      { outputFolder: "../tests/artifacts/browser-report", open: "never" },
    ],
    ["json", { outputFile: "../tests/artifacts/browser-results.json" }],
  ],
  use: {
    actionTimeout: 15000,
    baseURL: process.env.OPENACAD_BASE_URL || "http://127.0.0.1:5178",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: process.env.OPENACAD_CHROMIUM_BINARY
          ? { executablePath: process.env.OPENACAD_CHROMIUM_BINARY }
          : undefined,
        viewport: { width: 1600, height: 1000 },
      },
    },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: process.env.OPENACAD_BASE_URL
    ? undefined
    : {
        command: process.env.CI
          ? "npm run preview -- --host 127.0.0.1 --port 5178"
          : "npm run dev",
        url: "http://127.0.0.1:5178",
        reuseExistingServer: !process.env.CI,
      },
});
