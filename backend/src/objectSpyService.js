const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const { getSpyScript } = require('./spyInjectionScript');
const { saveObject } = require('./objectRepository');

// Trạng thái spy session
let spySession = {
  active: false,
  driver: null,
  url: null,
  capturedObjects: []
};

// WebSocket broadcast function (sẽ được set từ server.js)
let wsBroadcast = null;

function setWsBroadcast(fn) {
  wsBroadcast = fn;
}

/**
 * Bắt đầu Object Spy Session
 * Mở Chrome (có giao diện) và inject spy script
 */
async function startSpySession(url) {
  if (spySession.active) {
    throw new Error('Đang có một Spy session khác đang chạy. Vui lòng dừng trước.');
  }

  const backendUrl = `http://localhost:${process.env.PORT || 5000}`;

  let options = new chrome.Options();
  // KHÔNG dùng headless — cần hiện browser để user tương tác
  options.addArguments(
    '--disable-gpu',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-popup-blocking',
    '--start-maximized'
  );

  const driver = await new Builder()
    .forBrowser('chrome')
    .setChromeOptions(options)
    .build();

  spySession = {
    active: true,
    driver,
    url,
    capturedObjects: []
  };

  try {
    await driver.get(url);
    await driver.wait(until.elementLocated(By.tagName('body')), 10000);

    // Inject spy script
    const script = getSpyScript(backendUrl);
    await driver.executeScript(script);

    // Broadcast trạng thái
    broadcast({ type: 'spy_started', url });

    return { success: true, message: `Spy session đã bắt đầu tại: ${url}` };
  } catch (error) {
    await stopSpySession();
    throw error;
  }
}

/**
 * Dừng Spy Session
 */
async function stopSpySession() {
  if (spySession.driver) {
    try {
      await spySession.driver.quit();
    } catch (e) {
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

/**
 * Xử lý khi nhận data từ spy script (user Ctrl+Click)
 */
function handleSpyCapture(elementData) {
  if (!spySession.active) {
    return { success: false, message: 'Không có spy session nào đang chạy' };
  }

  // Lưu vào Object Repository
  const savedObj = saveObject(elementData);
  spySession.capturedObjects.push(savedObj.objectId);

  // Broadcast cho frontend biết đã capture
  broadcast({
    type: 'object_captured',
    object: {
      objectId: savedObj.objectId,
      tagName: savedObj.tagName,
      textContent: savedObj.textContent,
      locatorCount: savedObj.locators.length,
      sourceUrl: savedObj.sourceUrl
    }
  });

  // Chụp screenshot phần tử (async, không block)
  captureElementScreenshot(elementData).catch(err => {
    console.log('Không thể chụp screenshot phần tử:', err.message);
  });

  return { success: true, objectId: savedObj.objectId };
}

/**
 * Chụp screenshot phần tử bằng Selenium sau khi capture
 */
async function captureElementScreenshot(elementData) {
  if (!spySession.driver || !elementData.rect) return;

  try {
    // Chụp toàn trang rồi crop (đơn giản và ổn định hơn)
    const fullScreenshot = await spySession.driver.takeScreenshot();
    
    // Lưu screenshot vào object (update)
    const { updateObject } = require('./objectRepository');
    updateObject(elementData.objectId, {
      screenshot: `data:image/png;base64,${fullScreenshot}`
    });
  } catch (e) {
    // Bỏ qua nếu không chụp được
  }
}

/**
 * Lấy trạng thái hiện tại của Spy
 */
function getSpyStatus() {
  return {
    active: spySession.active,
    url: spySession.url,
    capturedCount: spySession.capturedObjects.length,
    capturedObjects: spySession.capturedObjects
  };
}

/**
 * Broadcast message qua WebSocket
 */
function broadcast(data) {
  if (wsBroadcast) {
    wsBroadcast(data);
  }
}

module.exports = {
  startSpySession,
  stopSpySession,
  handleSpyCapture,
  getSpyStatus,
  setWsBroadcast
};
