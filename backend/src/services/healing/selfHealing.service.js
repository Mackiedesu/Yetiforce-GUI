const { By } = require('selenium-webdriver');

const { loadObject, markObjectNeedsUpdate } = require('../../repositories/object.repository');

let healingLog = [];

async function findElementWithHealing(driver, objectId) {
  const obj = loadObject(objectId);
  if (!obj) {
    throw new Error(`Object "${objectId}" không tồn tại trong Object Repository`);
  }

  const sortedLocators = (obj.locators || [])
    .filter((locator) => locator.status === 'active')
    .sort((a, b) => a.priority - b.priority);

  if (sortedLocators.length === 0) {
    throw new Error(`Object "${objectId}" không có locator nào khả dụng`);
  }

  let firstError = null;

  for (let index = 0; index < sortedLocators.length; index += 1) {
    const locator = sortedLocators[index];
    try {
      const byLocator = getByLocator(locator.type, locator.value);
      const element = await driver.findElement(byLocator);
      const isDisplayed = await element.isDisplayed().catch(() => false);

      if (!isDisplayed) {
        throw new Error('Phần tử tìm được nhưng không hiển thị');
      }

      if (index > 0) {
        const healEntry = {
          objectId,
          failedLocators: sortedLocators.slice(0, index).map((failedLocator) => ({
            type: failedLocator.type,
            value: failedLocator.value
          })),
          usedFallback: {
            type: locator.type,
            value: locator.value,
            priority: locator.priority
          },
          healedAt: new Date().toISOString()
        };

        healingLog.push(healEntry);
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
      if (!firstError) {
        firstError = error;
      }
    }
  }

  const healEntry = {
    objectId,
    failedLocators: sortedLocators.map((locator) => ({ type: locator.type, value: locator.value })),
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

function getHealingReport() {
  return {
    totalHealed: healingLog.filter((entry) => entry.usedFallback).length,
    totalFailed: healingLog.filter((entry) => !entry.usedFallback).length,
    entries: healingLog
  };
}

function clearHealingLog() {
  healingLog = [];
}

module.exports = {
  findElementWithHealing,
  getByLocator,
  getHealingReport,
  clearHealingLog
};
