const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const MODEL_CHAIN = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1500;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryable(error) {
  const msg = String(error?.message || error).toLowerCase();
  return (
    msg.includes('503') || msg.includes('unavailable') ||
    msg.includes('high demand') || msg.includes('overloaded') ||
    msg.includes('429') || msg.includes('rate limit') ||
    msg.includes('econnreset') || msg.includes('etimedout')
  );
}

async function callGeminiWithRetry(prompt) {
  let lastError;
  for (const model of MODEL_CHAIN) {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`[AI Agent] model=${model} attempt=${attempt}`);
        const response = await ai.models.generateContent({ model, contents: prompt });
        console.log(`[AI Agent] Success with model=${model}`);
        return response;
      } catch (error) {
        lastError = error;
        if (!isRetryable(error)) throw error;
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        console.warn(`[AI Agent] model=${model} attempt=${attempt} failed. Retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }
  throw new Error(
    `AI hiện đang quá tải. Vui lòng thử lại sau. (${lastError?.message || lastError})`
  );
}

function normalizeTestCases(raw) {
  const list = Array.isArray(raw) ? raw : [];
  return list.map((tc) => ({
    name: String(tc.name || 'Unnamed Test Case'),
    description: String(tc.description || ''),
    steps: Array.isArray(tc.steps) ? tc.steps.map((s) => ({
      title: String(s.title || ''),
      description: String(s.description || ''),
      expected_result: String(s.expected_result || ''),
    })) : [],
    expectedResult: String(tc.expectedResult || ''),
    testData: (tc.testData && typeof tc.testData === 'object') ? tc.testData : {},
    katalonScript: String(tc.katalonScript || ''),
    objectLocators: Array.isArray(tc.objectLocators) ? tc.objectLocators : [],
  }));
}

function parseAiJson(rawText) {
  let text = rawText.trim();
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  }
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('AI trả về định dạng không hợp lệ. Vui lòng thử lại.');
  }
}

/**
 * Generate test cases from a plain-text feature description.
 */
async function generateTestCasesFromFeature(featureDescription) {
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
    throw new Error('Chưa cấu hình GEMINI_API_KEY trong file .env');
  }

  const prompt = `
Bạn là chuyên gia kiểm thử phần mềm và Katalon Studio. Phân tích mô tả tính năng sau và tạo ra bộ test case hoàn chỉnh.

MÔ TẢ TÍNH NĂNG:
"""
${featureDescription}
"""

Tạo ra TỪ 3 ĐẾN 6 test case bao phủ các kịch bản quan trọng nhất (happy path, edge cases, negative cases).

Trả về JSON theo định dạng sau (KHÔNG markdown, CHỈ JSON thuần):
{
  "testCases": [
    {
      "name": "Tên test case ngắn gọn",
      "description": "Mô tả mục tiêu của test case này",
      "steps": [
        {
          "title": "Mô tả hành động ngắn gọn",
          "description": "Chi tiết cách thực hiện hành động",
          "expected_result": "Kết quả kỳ vọng sau bước này"
        }
      ],
      "expectedResult": "Kết quả tổng thể kỳ vọng của toàn bộ test case",
      "testData": { "key": "value" },
      "objectLocators": [],
      "katalonScript": "// Comment mô tả\\nWebUI.openBrowser('')\\nWebUI.navigateToUrl(GlobalVariable.baseUrl)\\n..."
    }
  ]
}

QUY TẮC katalonScript:
1. Dùng Katalon WebUI API: openBrowser, navigateToUrl, setText, setEncryptedText, click, verifyElementPresent, verifyElementText, delay, takeScreenshot, closeBrowser
2. findTestObject('Folder/object_name') để định vị phần tử
3. GlobalVariable cho dữ liệu (GlobalVariable.baseUrl, GlobalVariable.username, v.v.)
4. Comment // trước mỗi nhóm bước
5. setEncryptedText cho trường mật khẩu
6. takeScreenshot() sau bước quan trọng
7. delay(2) sau khi submit form
8. Groovy hợp lệ, dùng \\n để xuống dòng

Trả về JSON hợp lệ, không giải thích thêm.
`;

  const response = await callGeminiWithRetry(prompt);
  const parsed = parseAiJson(response.text);
  return { testCases: normalizeTestCases(parsed.testCases) };
}

/**
 * Generate test cases from scanned DOM elements.
 * Uses real XPaths and CSS selectors from the scan so scripts reference actual page locators.
 *
 * @param {{ url: string, title: string, elements: Array }} pageData
 */
async function generateTestCasesFromDOM({ url, title, elements }) {
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
    throw new Error('Chưa cấu hình GEMINI_API_KEY trong file .env');
  }

  // Prioritise interactive elements; cap at 40 to keep prompt manageable
  const prioritized = [
    ...elements.filter((e) => e.tag === 'form'),
    ...elements.filter((e) => e.tag === 'input'),
    ...elements.filter((e) => e.tag === 'textarea'),
    ...elements.filter((e) => e.tag === 'select'),
    ...elements.filter((e) => e.tag === 'button'),
    ...elements.filter((e) => e.tag === 'a').slice(0, 10),
  ].slice(0, 40);

  // Build a readable element summary that includes real locators
  const elemSummary = prioritized.map((el, i) => {
    const attrs = [
      el.tag,
      el.type && el.type !== el.tag ? `type="${el.type}"` : null,
      el.id ? `id="${el.id}"` : null,
      el.name ? `name="${el.name}"` : null,
      el.text ? `text="${el.text.substring(0, 50)}"` : null,
      el.placeholder ? `placeholder="${el.placeholder.substring(0, 50)}"` : null,
      el.label ? `label="${el.label.substring(0, 50)}"` : null,
      el.isRequired ? 'required' : null,
    ].filter(Boolean).join(' ');
    return `[${i + 1}] ${attrs}\n    css: ${el.selector}\n    xpath: ${el.xpath}`;
  }).join('\n');

  const prompt = `
Bạn là chuyên gia kiểm thử phần mềm và Katalon Studio. Phân tích cấu trúc DOM của trang web sau và tạo ra bộ test case Katalon hoàn chỉnh.

THÔNG TIN TRANG WEB:
URL: ${url}
Tiêu đề: ${title}

CÁC PHẦN TỬ DOM (${prioritized.length} phần tử tương tác):
${elemSummary}

NHIỆM VỤ:
1. Xác định các luồng người dùng có sẵn trên trang (đăng nhập, đăng ký, tìm kiếm, thanh toán, v.v.)
2. Tạo TỪ 3 ĐẾN 6 test case bao phủ happy path, edge case, và negative case
3. Mỗi test case phải tập trung vào MỘT luồng cụ thể
4. Sử dụng ĐÚNG các xpath/selector từ danh sách phần tử DOM ở trên trong Katalon script

Trả về JSON (KHÔNG markdown, CHỈ JSON thuần):
{
  "testCases": [
    {
      "name": "Tên test case ngắn gọn, mô tả rõ kịch bản",
      "description": "Mục tiêu của test case này",
      "steps": [
        {
          "title": "Tên hành động ngắn gọn",
          "description": "Hướng dẫn chi tiết, đề cập đến phần tử cụ thể",
          "expected_result": "Kết quả kỳ vọng sau bước này"
        }
      ],
      "expectedResult": "Kết quả tổng thể kỳ vọng",
      "testData": {
        "username": "testuser@example.com",
        "password": "Password123"
      },
      "objectLocators": [
        {
          "name": "PageName/element_purpose",
          "selectorMethod": "XPATH",
          "selectorValue": "//xpath/from/above/list",
          "description": "Mô tả phần tử"
        }
      ],
      "katalonScript": "// TC: Tên test case\\nWebUI.openBrowser('')\\nWebUI.navigateToUrl('${url}')\\n// Bước 1: ...\\nWebUI.click(findTestObject('PageName/element'))\\n// Verify\\nWebUI.verifyElementPresent(findTestObject('PageName/result'), 10)\\nWebUI.takeScreenshot()\\nWebUI.closeBrowser()"
    }
  ]
}

QUY TẮC BẮT BUỘC cho katalonScript:
1. MỞ ĐẦU: WebUI.openBrowser('') rồi WebUI.navigateToUrl('${url}')
2. LOCATOR: Dùng ĐÚNG xpath từ danh sách DOM ở trên trong findTestObject(). VÍ DỤ: findTestObject tham chiếu objectLocators đã khai báo
3. THAO TÁC: setText cho input/textarea, click cho button/link, selectOptionByLabel cho select
4. MẬT KHẨU: setEncryptedText
5. SUBMIT: delay(2) sau khi submit form
6. XÁC NHẬN: verifyElementPresent hoặc verifyElementText để kiểm tra kết quả
7. SCREENSHOT: takeScreenshot() sau các bước quan trọng
8. KẾT THÚC: WebUI.closeBrowser()
9. COMMENT: // mô tả trước mỗi nhóm bước
10. XUỐNG DÒNG: dùng \\n trong chuỗi JSON

Trả về JSON hợp lệ, không giải thích thêm.
`;

  const response = await callGeminiWithRetry(prompt);
  const parsed = parseAiJson(response.text);
  return { testCases: normalizeTestCases(parsed.testCases) };
}

module.exports = { generateTestCasesFromFeature, generateTestCasesFromDOM };
