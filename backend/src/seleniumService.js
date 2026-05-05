const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

/**
 * Khởi tạo Selenium WebDriver hiện ẩn (headless Chrome)
 * Trích xuất cấu trúc HTML để gửi cho AI
 */
async function extractPageStructure(url) {
  let options = new chrome.Options();
  options.addArguments('--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage');

  let driver = await new Builder()
    .forBrowser('chrome')
    .setChromeOptions(options)
    .build();

  try {
    await driver.get(url);
    // Chờ cho body xuất hiện
    await driver.wait(until.elementLocated(By.tagName('body')), 10000);
    
    // Lấy tiêu đề trang
    const title = await driver.getTitle();
    
    // Lấy HTML cơ bản của body
    // Trong thực tế cần lọc bỏ các thẻ script, style và svg để đỡ tốn token của AI
    const rawHtml = await driver.findElement(By.tagName('body')).getAttribute('innerHTML');
    
    // Hàm rút gọn HTML cơ bản ở backend (bỏ bớt detail thừa thãi)
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
  // Bỏ đi các đoạn code dễ gây nhiễu và dài dòng
  // Dùng regex cơ bản để loại bỏ
  let cleaned = htmlStr.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  cleaned = cleaned.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  cleaned = cleaned.replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '');
  // Loại bỏ các comment HTML
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');
  
  // Rút gọn các dòng trống
  cleaned = cleaned.replace(/^\s*[\r\n]/gm, '');
  
  // Tránh việc nội dung quá lớn, giới hạn số lượng ký tự đầu tiên nếu cần thiết
  // Tuy nhiên LLM có context window lớn, nên tạm thời có thể giữ lại
  return cleaned;
}

module.exports = { extractPageStructure };
