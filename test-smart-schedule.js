const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Navigate to the smart schedule page
  console.log('Navigating to smart schedule page...');
  await page.goto('http://localhost:3000/contact/101283223228700640955/smart-schedule');

  // Wait for the page to load and API calls to complete
  console.log('Waiting for API calls to complete...');
  await page.waitForTimeout(10000);

  // Capture console logs from the browser
  page.on('console', msg => {
    if (msg.text().includes('[getAllValidSlots]')) {
      console.log('BROWSER LOG:', msg.text());
    }
  });

  console.log('Page loaded. Check server logs for Saturday Oct 18 slot generation details.');
  console.log('Keeping browser open for 30 seconds...');

  await page.waitForTimeout(30000);

  await browser.close();
})();
