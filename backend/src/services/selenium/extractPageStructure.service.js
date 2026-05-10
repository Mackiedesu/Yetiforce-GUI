const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

async function extractPageStructure(url) {
  const options = new chrome.Options();
  options.addArguments('--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage');

  const driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();

  try {
    await driver.get(url);
    await driver.wait(until.elementLocated(By.tagName('body')), 10000);

    const title = await driver.getTitle();
    const rawHtml = await driver.findElement(By.tagName('body')).getAttribute('innerHTML');
    const filteredHtml = cleanHtml(rawHtml);

    return {
      title,
      html: filteredHtml
    };
  } catch (error) {
    console.error('Error extracting page structure:', error);
    throw error;
  } finally {
    await driver.quit();
  }
}

function cleanHtml(htmlStr) {
  let cleaned = htmlStr.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  cleaned = cleaned.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  cleaned = cleaned.replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '');
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');
  cleaned = cleaned.replace(/^\s*[\r\n]/gm, '');
  return cleaned;
}

module.exports = {
  extractPageStructure
};
