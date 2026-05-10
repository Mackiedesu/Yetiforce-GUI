const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Model fallback chain — tries each in order until one succeeds
const MODEL_CHAIN = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1500;
const TIMEOUT_MS = 60_000; // 60 seconds per attempt

/** Sleep for `ms` milliseconds */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wraps a promise with a timeout so a hung request doesn't block forever.
 */
function withTimeout(promise, ms) {
  const timer = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Yêu cầu AI bị timeout sau ${ms / 1000}s`)), ms)
  );
  return Promise.race([promise, timer]);
}

/**
 * Returns true if the error is a transient server-side issue worth retrying.
 * Returns false for permanent errors (model not found, bad API key) so we
 * skip to the next model instead of burning all retries on a hopeless call.
 */
function isRetryable(error) {
  const msg = String(error?.message || error).toLowerCase();

  // Permanent errors — skip immediately to the next model
  if (
    msg.includes('404') ||
    msg.includes('not found') ||
    msg.includes('api key') ||
    msg.includes('permission') ||
    msg.includes('invalid_argument')
  ) {
    return false;
  }

  // Transient errors — safe to retry with back-off
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
 * Call the Gemini API with retry + exponential backoff.
 * Falls back through MODEL_CHAIN if a model is unavailable.
 */
async function callGeminiWithRetry(prompt) {
  let lastError;

  for (const model of MODEL_CHAIN) {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`[AI] Trying model=${model} attempt=${attempt}`);
        const response = await withTimeout(
          ai.models.generateContent({ model, contents: prompt }),
          TIMEOUT_MS
        );
        console.log(`[AI] Success with model=${model}`);
        return response;
      } catch (error) {
        lastError = error;
        if (!isRetryable(error)) {
          // Non-retryable (model not found, bad key, etc.) — try next model
          console.warn(`[AI] model=${model} non-retryable error: ${error.message}. Trying next model...`);
          break; // exit inner retry loop
        }
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1); // 1.5s → 3s → 6s
        console.warn(`[AI] model=${model} attempt=${attempt} failed (${error.message}). Retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
    console.warn(`[AI] All retries exhausted for model=${model}. Trying next fallback...`);
  }

  // All models and retries exhausted
  throw new Error(
    'AI hiện đang quá tải hoặc không khả dụng. Vui lòng thử lại sau vài giây. ' +
    `(Chi tiết: ${lastError?.message || lastError})`
  );
}

/**
 * Generate structured Katalon test output from a natural language requirement.
 * Returns: { testSteps, expectedResults, testData, katalonScript }
 */
async function generateKatalonTest(requirement) {
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
    throw new Error('Chưa cấu hình GEMINI_API_KEY trong file .env');
  }

  const prompt = `
Bạn là chuyên gia Katalon Studio và kiểm thử tự động web. Nhiệm vụ của bạn là phân tích yêu cầu kiểm thử bằng ngôn ngữ tự nhiên và tạo ra một bộ kiểm thử hoàn chỉnh.

YÊU CẦU KIỂM THỬ:
"""
${requirement}
"""

Hãy tạo ra kết quả theo định dạng JSON sau (KHÔNG bọc trong markdown, CHỈ trả về JSON thuần):
{
  "testSteps": [
    "Bước 1: ...",
    "Bước 2: ...",
    "Bước 3: ..."
  ],
  "expectedResults": [
    "Kết quả kỳ vọng bước 1: ...",
    "Kết quả kỳ vọng bước 2: ...",
    "Kết quả kỳ vọng bước 3: ..."
  ],
  "testData": {
    "url": "URL trang web cần test (nếu có)",
    "username": "tên đăng nhập mẫu (nếu có)",
    "password": "mật khẩu mẫu (nếu có)",
    "otherKey": "các dữ liệu test khác..."
  },
  "katalonScript": "WebUI.openBrowser('')\\nWebUI.navigateToUrl(GlobalVariable.url)\\n..."
}

QUY TẮC CHO katalonScript:
1. Sử dụng ĐÚNG Katalon WebUI API: WebUI.openBrowser(''), WebUI.navigateToUrl(url), WebUI.setText(findTestObject('...'), value), WebUI.setEncryptedText(findTestObject('...'), encryptedValue), WebUI.click(findTestObject('...')), WebUI.verifyElementPresent(findTestObject('...'), timeout), WebUI.verifyElementText(findTestObject('...'), text), WebUI.delay(seconds), WebUI.takeScreenshot(), WebUI.closeBrowser()
2. Dùng findTestObject('FolderName/object_name') để định vị phần tử — đặt tên folder theo chức năng (ví dụ: 'Login/input_email', 'Home/btn_submit')
3. Dùng GlobalVariable cho dữ liệu test (ví dụ: GlobalVariable.baseUrl, GlobalVariable.username)
4. Thêm comment // trước mỗi nhóm hành động để mô tả bước
5. Script là Groovy hợp lệ, chạy trong Katalon Studio
6. Dùng WebUI.setEncryptedText cho trường mật khẩu
7. Thêm WebUI.takeScreenshot() sau mỗi bước quan trọng
8. Độ trễ hợp lý: WebUI.delay(2) sau khi submit form
9. Dùng \\n để xuống dòng trong katalonScript

QUAN TRỌNG: Chỉ trả về JSON hợp lệ, không giải thích, không markdown.
`;

  const response = await callGeminiWithRetry(prompt);

  let rawText = response.text.trim();

  // Strip markdown code fences if present
  if (rawText.startsWith('```')) {
    rawText = rawText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  }

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    // Attempt to extract JSON object from within the response
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('AI trả về định dạng không hợp lệ. Vui lòng thử lại.');
    }
  }

  return {
    testSteps: Array.isArray(parsed.testSteps) ? parsed.testSteps : [],
    expectedResults: Array.isArray(parsed.expectedResults) ? parsed.expectedResults : [],
    testData: (parsed.testData && typeof parsed.testData === 'object') ? parsed.testData : {},
    katalonScript: typeof parsed.katalonScript === 'string' ? parsed.katalonScript : ''
  };
}

module.exports = { generateKatalonTest };
