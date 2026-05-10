/**
 * generateScript.service.js
 *
 * Generates a Selenium/Mocha test script from an HTML snapshot and description
 * using the Gemini AI API.
 *
 * Resilience strategy (mirrors generateKatalonTest.service.js):
 *  - MODEL_CHAIN: tries each model in order
 *  - Exponential back-off retry for transient errors (429, 503, network resets)
 *  - Fast-fail for permanent errors (404 model not found, invalid API key)
 *  - 60-second per-attempt timeout via AbortSignal
 */

const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Fallback model chain – tries newest/fastest first, falls back to stable models
const MODEL_CHAIN = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1500;
const TIMEOUT_MS = 60_000; // 60 seconds per attempt

/** Sleep for `ms` milliseconds */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Returns true if the error is a transient server-side issue worth retrying.
 * Returns false for permanent errors (wrong model name, bad API key, etc.)
 * so we don't waste retries on errors that won't self-heal.
 */
function isRetryable(error) {
  const msg = String(error?.message || error).toLowerCase();

  // Permanent errors — do not retry
  if (
    msg.includes('404') ||          // model not found
    msg.includes('not found') ||    // model not found (message variant)
    msg.includes('api key') ||      // invalid API key
    msg.includes('permission') ||   // missing permission
    msg.includes('invalid_argument') // bad request
  ) {
    return false;
  }

  // Transient errors — safe to retry
  return (
    msg.includes('503') ||
    msg.includes('unavailable') ||
    msg.includes('high demand') ||
    msg.includes('overloaded') ||
    msg.includes('429') ||
    msg.includes('rate limit') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('timeout')
  );
}

/**
 * Wraps a promise with a timeout so a single hung request doesn't block forever.
 */
function withTimeout(promise, ms) {
  const timer = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Yêu cầu AI bị timeout sau ${ms / 1000}s`)), ms)
  );
  return Promise.race([promise, timer]);
}

/**
 * Call Gemini API with retry + exponential back-off.
 * Falls back through MODEL_CHAIN when a model is permanently unavailable.
 */
async function callGeminiWithRetry(prompt) {
  let lastError;

  for (const model of MODEL_CHAIN) {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`[generateScript] Trying model=${model} attempt=${attempt}`);

        const response = await withTimeout(
          ai.models.generateContent({ model, contents: prompt }),
          TIMEOUT_MS
        );

        console.log(`[generateScript] Success with model=${model}`);
        return response;
      } catch (error) {
        lastError = error;

        if (!isRetryable(error)) {
          // Non-retryable (e.g. model not found, invalid key) — try next model
          console.warn(`[generateScript] model=${model} non-retryable error: ${error.message}. Trying next model...`);
          break; // break inner retry loop, continue to next model
        }

        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1); // 1.5s → 3s → 6s
        console.warn(
          `[generateScript] model=${model} attempt=${attempt} failed (${error.message}). ` +
          `Retrying in ${delay}ms...`
        );
        await sleep(delay);
      }
    }
    console.warn(`[generateScript] Exhausted retries for model=${model}. Trying next fallback...`);
  }

  // All models exhausted
  throw new Error(
    'AI service hiện không khả dụng. Vui lòng thử lại sau vài giây. ' +
    `(Chi tiết: ${lastError?.message || lastError})`
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Main service
// ────────────────────────────────────────────────────────────────────────────

async function generateTestScript(htmlContent, testCaseDescription, url) {
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
    throw new Error('Chưa cấu hình GEMINI_API_KEY trong file .env');
  }

  const prompt = `
Bạn là một chuyên gia về kiểm thử tự động với Selenium WebDriver kết hợp Mocha (JavaScript).
Nhiệm vụ của bạn là dựa vào HTML của trang web và mô tả bằng ngôn ngữ tự nhiên của người kiểm thử (Test Case), hãy viết một kịch bản kiểm thử (Test Script) Javascript sử dụng Mocha và Selenium.

Thông tin:
- Trang web cần test: ${url}
- Mô tả Test Case từ người dùng: "${testCaseDescription}"

Một phần HTML của trang web (lưu ý HTML này để bạn tìm ra class/id các phần tử hợp lý phục vụ action):
\`\`\`html
${htmlContent.substring(0, 15000)} // Giới hạn một phần
\`\`\`

Yêu cầu về mã nguồn:
1. Trả về đúng ĐOẠN ĐẦU đến ĐOẠN CUỐI của file script. Bắt buộc có \`describe\` và \`it\` của Mocha.
2. Khởi tạo \`require('selenium-webdriver')\`.
3. Code KHÔNG chạy ngầm headless để người dùng có thể nhìn thấy tiến độ (đừng chặn headless trừ khi cần). Nhưng hiện tại cứ để có giao diện UI.
4. Có assertion (dùng require('assert') có sẵn của Node) để kiểm tra kết quả kỳ vọng.
5. Code chỉ chứa mã Javascript hợp lệ để chạy, KHÔNG CÓ giải thích dài dòng dư thừa ngoài các comment trong code. Không bọc trong block markdown \`\`\`javascript nếu bạn có thể trả về text thuần tuý dễ parse, nhưng nếu khó thì tôi sẽ parse sau. Tốt nhất là BỌC trong \`\`\`javascript và \`\`\`
6. LƯU Ý QUAN TRỌNG: Chỉ sử dụng các hàm hỗ trợ của Selenium WebDriver JS (như until.elementLocated, until.urlIs, until.urlMatches, until.urlContains, until.stalenessOf). TUYỆT ĐỐI KHÔNG tự bịa ra các hàm không tồn tại như until.urlIsNot. Nếu cần chờ URL thay đổi, hãy dùng driver.wait(async () => { return await driver.getCurrentUrl() !== initialUrl; }, 10000).

Mã script gợi ý tiêu chuẩn:
\`\`\`javascript
const { Builder, By, until } = require('selenium-webdriver');
const assert = require('assert');

describe('Automation Test for: ${url}', function() {
  this.timeout(30000);
  let driver;

  before(async function() {
    driver = await new Builder().forBrowser('chrome').build();
  });

  after(async function() {
    await driver.quit();
  });

  it('Thực thi Test Case: ${testCaseDescription.replace(/\n/g, ' ')}', async function() {
    // Viết các driver.get(), driver.findElement() tương ứng dưới đây
  });
});
\`\`\`
  `;

  const response = await callGeminiWithRetry(prompt);

  let generatedCode = response.text;

  // Strip markdown fences if present
  if (generatedCode.includes('```javascript')) {
    generatedCode = generatedCode.split('```javascript')[1].split('```')[0].trim();
  } else if (generatedCode.includes('```')) {
    generatedCode = generatedCode.split('```')[1].split('```')[0].trim();
  }

  return generatedCode;
}

module.exports = {
  generateTestScript
};
