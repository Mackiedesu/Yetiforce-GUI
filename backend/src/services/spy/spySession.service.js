const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

const { PORT } = require('../../config/env');
const { getSpyScript } = require('./spyInjectionScript.template');
const { saveObject, updateObject } = require('../../repositories/object.repository');

let spySession = {
  active: false,
  driver: null,
  url: null,
  capturedObjects: []
};

let wsBroadcast = null;

function setWsBroadcast(fn) {
  wsBroadcast = fn;
}

function broadcast(data) {
  if (wsBroadcast) {
    wsBroadcast(data);
  }
}

async function startSpySession(url) {
  if (spySession.active) {
    throw new Error('Đang có một Spy session khác đang chạy. Vui lòng dừng trước.');
  }

  const backendUrl = `http://localhost:${PORT}`;

  const options = new chrome.Options();
  options.addArguments(
    '--disable-gpu',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-popup-blocking',
    '--start-maximized'
  );

  const driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();

  spySession = {
    active: true,
    driver,
    url,
    capturedObjects: []
  };

  try {
    await driver.get(url);
    await driver.wait(until.elementLocated(By.tagName('body')), 10000);
    const script = getSpyScript(backendUrl);
    await driver.executeScript(script);

    broadcast({ type: 'spy_started', url });
    return { success: true, message: `Spy session đã bắt đầu tại: ${url}` };
  } catch (error) {
    await stopSpySession();
    throw error;
  }
}

async function stopSpySession() {
  if (spySession.driver) {
    try {
      await spySession.driver.quit();
    } catch (error) {
      // Browser có thể đã bị đóng thủ công
    }
  }

  const capturedCount = spySession.capturedObjects.length;
  spySession = {
    active: false,
    driver: null,
    url: null,
    capturedObjects: []
  };

  broadcast({ type: 'spy_stopped', capturedCount });
  return { success: true, message: `Spy đã dừng. Đã capture ${capturedCount} phần tử.` };
}

function handleSpyCapture(elementData) {
  if (!spySession.active) {
    return { success: false, message: 'Không có spy session nào đang chạy' };
  }

  const savedObject = saveObject(elementData);
  spySession.capturedObjects.push(savedObject.objectId);

  broadcast({
    type: 'object_captured',
    object: {
      objectId: savedObject.objectId,
      tagName: savedObject.tagName,
      textContent: savedObject.textContent,
      locatorCount: savedObject.locators.length,
      sourceUrl: savedObject.sourceUrl
    }
  });

  captureElementScreenshot(elementData).catch((error) => {
    console.log('Không thể chụp screenshot phần tử:', error.message);
  });

  return { success: true, objectId: savedObject.objectId };
}

async function captureElementScreenshot(elementData) {
  if (!spySession.driver || !elementData.rect) {
    return;
  }

  try {
    const fullScreenshot = await spySession.driver.takeScreenshot();
    updateObject(elementData.objectId, {
      screenshot: `data:image/png;base64,${fullScreenshot}`
    });
  } catch (error) {
    // Bỏ qua nếu không chụp được
  }
}

function getSpyStatus() {
  return {
    active: spySession.active,
    url: spySession.url,
    capturedCount: spySession.capturedObjects.length,
    capturedObjects: spySession.capturedObjects
  };
}

module.exports = {
  startSpySession,
  stopSpySession,
  handleSpyCapture,
  getSpyStatus,
  setWsBroadcast
};
