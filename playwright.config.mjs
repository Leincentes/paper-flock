import {
  defineConfig,
  devices
} from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  failOnFlakyTests: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ["line"],
    ["html", {
      outputFolder: "playwright-report",
      open: "never"
    }]
  ],
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  projects: [
    {
      name: "desktop-chromium",
      use: {
        ...devices["Desktop Chrome"]
      }
    },
    {
      name: "mobile-chromium",
      use: {
        ...devices["Pixel 7"]
      }
    },
    {
      name: "mobile-webkit",
      use: {
        ...devices["iPhone 15"]
      }
    }
  ],
  webServer: {
    command:
      "python3 -m http.server 4173 --bind 127.0.0.1 --directory dist",
    url: "http://127.0.0.1:4173/",
    reuseExistingServer: !process.env.CI,
    timeout: 120000
  }
});
