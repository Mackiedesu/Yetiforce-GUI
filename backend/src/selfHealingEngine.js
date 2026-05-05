const { By } = require('selenium-webdriver');
const { loadObject, updateObject } = require('./objectRepository');

// Lưu lại lịch sử healing trong lần chạy hiện tại
let healingLog = [];

/**
 * Tìm phần tử với cơ chế Self-Healing
 * Thử từ locator ưu tiên cao nhất → thấp nhất
 * Nếu locator chính hỏng nhưng fallback tìm được → đánh dấu cần cập nhật
 * 
 * @param {WebDriver} driver - Selenium WebDriver instance
 * @param {string} objectId - ID của object trong repository
 * @returns {WebElement} Phần tử tìm được
 */
async function findElementWithHealing(driver, objectId) {
  const obj = loadObject(objectId);
  if (!obj) {
    throw new Error(`Object "${objectId}" không tồn tại trong Object Repository`);
  }

  const sortedLocators = (obj.locators || [])
    .filter(l => l.status === 'active')
    .sort((a, b) => a.priority - b.priority);

  if (sortedLocators.length === 0) {
    throw new Error(`Object "${objectId}" không có locator nào khả dụng`);
  }

  let firstError = null;

  for (let i = 0; i < sortedLocators.length; i++) {
    const locator = sortedLocators[i];
    try {
      const byLocator = getByLocator(locator.type, locator.value);
      const element = await driver.findElement(byLocator);

      // Kiểm tra phần tử có thực sự hiển thị không
      const isDisplayed = await element.isDisplayed().catch(() => false);
      if (!isDisplayed) {
        throw new Error('Phần tử tìm được nhưng không hiển thị');
      }

      if (i > 0) {
        // Locator chính (i=0) đã hỏng, đang dùng locator dự phòng
        const healEntry = {
          objectId,
          failedLocators: sortedLocators.slice(0, i).map(l => ({
            type: l.type,
            value: l.value
          })),
          usedFallback: {
            type: locator.type,
            value: locator.value,
            priority: locator.priority
          },
          healedAt: new Date().toISOString()
        };

        healingLog.push(healEntry);

        // Đánh dấu object cần cập nhật
        const { markObjectNeedsUpdate } = require('./objectRepository');
        markObjectNeedsUpdate(objectId, {
          failedLocator: sortedLocators[0],
          usedFallback: locator
        });

        console.log(
          `⚕️ [Self-Healing] Object "${objectId}": Locator chính "${sortedLocators[0].type}:${sortedLocators[0].value}" đã hỏng. ` +
          `Đã tự chữa bằng "${locator.type}:${locator.value}".`
        );
      }

      return element;
    } catch (error) {
      if (!firstError) firstError = error;
      // Thử locator tiếp theo
      continue;
    }
  }

  // Tất cả locators đều hỏng
  const healEntry = {
    objectId,
    failedLocators: sortedLocators.map(l => ({ type: l.type, value: l.value })),
    usedFallback: null,
    error: 'Tất cả locators đều thất bại',
    healedAt: new Date().toISOString()
  };
  healingLog.push(healEntry);

  throw new Error(
    `Self-healing thất bại cho "${objectId}": Không tìm thấy phần tử bằng bất kỳ locator nào ` +
    `(đã thử ${sortedLocators.length} locator). Lỗi gốc: ${firstError?.message}`
  );
}

/**
 * Chuyển đổi loại locator thành Selenium By
 */
function getByLocator(type, value) {
  switch (type) {
    case 'id':
      return By.id(value);
    case 'name':
      return By.name(value);
    case 'className':
      return By.className(value);
    case 'css':
      return By.css(value);
    case 'xpath':
      return By.xpath(value);
    case 'linkText':
      return By.linkText(value);
    case 'data-testid':
      return By.css(`[data-testid="${value}"]`);
    default:
      return By.css(`[${type}="${value}"]`);
  }
}

/**
 * Lấy báo cáo Healing của lần chạy gần nhất
 */
function getHealingReport() {
  return {
    totalHealed: healingLog.filter(h => h.usedFallback).length,
    totalFailed: healingLog.filter(h => !h.usedFallback).length,
    entries: healingLog
  };
}

/**
 * Xóa log healing (gọi khi bắt đầu chạy test mới)
 */
function clearHealingLog() {
  healingLog = [];
}

module.exports = {
  findElementWithHealing,
  getByLocator,
  getHealingReport,
  clearHealingLog
};
