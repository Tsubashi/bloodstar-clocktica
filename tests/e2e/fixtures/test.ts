// Custom Playwright test fixture that wraps every `page` with an API-URL
// rewrite. The production bundle hardcodes `https://bloodstar.clocktica.com`
// as SITE_ROOT (src/config.ts), so browser-side API calls from the test
// stack would escape localhost and hit production. This fixture intercepts
// them at the Chromium-devtools level and reroutes to the local stack.
//
// When the production config is made dynamic (e.g., via window.location.origin
// or a runtime <meta> tag), this fixture can be deleted.
import { test as base } from '@playwright/test';

const PROD_ORIGIN = 'https://bloodstar.clocktica.com';
const LOCAL_ORIGIN = 'http://localhost:8086';

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route(`${PROD_ORIGIN}/**`, async (route) => {
      const req = route.request();
      const url = req.url().replace(PROD_ORIGIN, LOCAL_ORIGIN);
      const response = await route.fetch({
        url,
        method: req.method(),
        headers: req.headers(),
        postData: req.postDataBuffer() ?? undefined,
        maxRedirects: 0,
      });
      await route.fulfill({ response });
    });
    await use(page);
  },
});

export { expect } from '@playwright/test';
