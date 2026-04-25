const { chromium } = require('playwright');

(async () => {
  try {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('BROWSER CONSOLE ERROR:', msg.text());
      }
    });

    page.on('pageerror', error => {
      console.log('BROWSER PAGE ERROR:', error.message);
    });

    await page.goto('https://zunoprospect.com.br', { waitUntil: 'networkidle' });
    
    // Give it a couple of seconds to execute JS
    await new Promise(r => setTimeout(r, 2000));
    
    await browser.close();
  } catch (err) {
    console.error('SCRIPT ERROR:', err);
  }
})();
