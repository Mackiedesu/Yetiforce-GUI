'use strict';

const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const MODEL_CHAIN = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1500;

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

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
    // Store Playwright spec content in katalonScript field for DB backward compat
    katalonScript: String(tc.playwrightScript || tc.katalonScript || ''),
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

// ── Playwright spec boilerplate ───────────────────────────────────────────────

const PLAYWRIGHT_RULES = `
QUY TẮC CHO playwrightScript (Playwright + Mocha + Chai):
1. CẤU TRÚC: Mỗi script là nội dung bên trong describe() — chỉ gồm các it() block
2. DÙNG: page.goto(), page.fill(), page.click(), page.waitForSelector(), page.screenshot()
3. ASSERT: expect(value).to.equal() / to.include() / to.be.true / to.not.be.empty
4. SCREENSHOT: await page.screenshot({ path: path.join(__dirname, '../../screenshots', 'step.png') })
5. WAIT: Dùng await page.waitForLoadState('load') hoặc chờ selector xuất hiện bằng await page.waitForSelector('selector') — TUYỆT ĐỐI KHÔNG dùng 'networkidle' vì Yetiforce có các request ngầm chạy liên tục dễ khiến test bị treo vô hạn.
6. SELECTOR: Dùng CSS (#id, .class) hoặc XPath từ danh sách phần tử ở trên — KHÔNG tự đặt selector mới
7. XUỐNG DÒNG: dùng \\n trong chuỗi JSON
8. KHÔNG import / require trong script (đã có ở wrapper)
9. Các biến page, expect, path, fs đã được khai báo sẵn bởi wrapper
10. TEXT ASSERTIONS: Khi assert textContent/innerText, PHẢI dùng đúng giá trị text= từ danh sách phần tử DOM — KHÔNG tự đặt text khác
11. NAVIGATION URL: Bạn KHÔNG biết URL đích sau khi click link. Dùng expect(page.url()).to.not.equal(startUrl) hoặc expect(page.url()).to.match(/https?:\/\//) thay vì hardcode URL đích không chắc

Ví dụ it() block hợp lệ:
  it('should login successfully', async () => {\\n    await page.goto('https://example.com/login');\\n    await page.fill('#email', 'user@example.com');\\n    await page.fill('#password', 'secret');\\n    await page.click('[type=submit]');\\n    await page.waitForLoadState('networkidle');\\n    expect(page.url()).to.include('/dashboard');\\n  });
`;

// ── Text-based generation (feature description) ───────────────────────────────

async function generateTestCasesFromFeature(featureDescription) {
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
    throw new Error('Chưa cấu hình GEMINI_API_KEY trong file .env');
  }

  const prompt = `
Bạn là chuyên gia kiểm thử phần mềm với Playwright, Mocha, và Chai.
Phân tích mô tả tính năng sau và tạo ra bộ test case hoàn chỉnh.

MÔ TẢ TÍNH NĂNG:
"""
${featureDescription}
"""

Tạo TỪ 3 ĐẾN 6 test case bao phủ các kịch bản quan trọng nhất (happy path, edge cases, negative cases).

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
      "playwrightScript": "// Các it() blocks\\n  it('should ...', async () => {\\n    await page.goto('https://...');\\n    // steps\\n    expect(page.url()).to.include('...');\\n  });"
    }
  ]
}

${PLAYWRIGHT_RULES}

Trả về JSON hợp lệ, không giải thích thêm.
`;

  const response = await callGeminiWithRetry(prompt);
  const parsed = parseAiJson(response.text);
  return { testCases: normalizeTestCases(parsed.testCases) };
}

// ── DOM-based generation (from URL scanner) ───────────────────────────────────

async function generateTestCasesFromDOM({ url, title, elements }) {
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
    throw new Error('Chưa cấu hình GEMINI_API_KEY trong file .env');
  }

  const prioritized = [
    ...elements.filter((e) => e.tag === 'form'),
    ...elements.filter((e) => e.tag === 'input'),
    ...elements.filter((e) => e.tag === 'textarea'),
    ...elements.filter((e) => e.tag === 'select'),
    ...elements.filter((e) => e.tag === 'button'),
    ...elements.filter((e) => e.tag === 'a').slice(0, 10),
  ].slice(0, 40);

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
Bạn là chuyên gia kiểm thử phần mềm với Playwright, Mocha, và Chai.
Phân tích cấu trúc DOM của trang web sau và tạo ra bộ test case hoàn chỉnh.

THÔNG TIN TRANG WEB:
URL: ${url}
Tiêu đề: ${title}

CÁC PHẦN TỬ DOM (${prioritized.length} phần tử tương tác):
${elemSummary}

NHIỆM VỤ:
1. Xác định các luồng người dùng có sẵn trên trang (đăng nhập, đăng ký, tìm kiếm, v.v.)
2. Tạo TỪ 3 ĐẾN 6 test case bao phủ happy path, edge case, và negative case
3. Mỗi test case tập trung vào MỘT luồng cụ thể
4. Sử dụng ĐÚNG CSS selector hoặc xpath từ danh sách phần tử DOM ở trên
5. Khi assert textContent của bất kỳ phần tử nào, PHẢI dùng đúng giá trị text= từ danh sách — ví dụ nếu text="More information..." thì assert phải dùng "More information...", KHÔNG được dùng text khác
6. Khi test click link/button dẫn đến trang khác: dùng expect(page.url()).to.not.equal('${url}') hoặc expect(newPage.url()).to... thay vì đoán URL đích

Trả về JSON (KHÔNG markdown, CHỈ JSON thuần):
{
  "testCases": [
    {
      "name": "Tên test case ngắn gọn, mô tả rõ kịch bản",
      "description": "Mục tiêu của test case này",
      "steps": [
        {
          "title": "Tên hành động ngắn gọn",
          "description": "Hướng dẫn chi tiết",
          "expected_result": "Kết quả kỳ vọng"
        }
      ],
      "expectedResult": "Kết quả tổng thể kỳ vọng",
      "testData": { "username": "testuser@example.com", "password": "Password123" },
      "objectLocators": [
        {
          "name": "PageName/element_purpose",
          "selectorMethod": "CSS",
          "selectorValue": "#selector-from-above-list",
          "description": "Mô tả phần tử"
        }
      ],
      "playwrightScript": "  it('should ...', async () => {\\n    await page.goto('${url}');\\n    await page.fill('${prioritized.find((e) => e.tag === 'input')?.selector || '#input'}', 'value');\\n    await page.click('${prioritized.find((e) => e.tag === 'button')?.selector || 'button'}');\\n    await page.waitForLoadState('networkidle');\\n    expect(page.url()).to.include('/expected');\\n  });"
    }
  ]
}

${PLAYWRIGHT_RULES}

Trả về JSON hợp lệ, không giải thích thêm.
`;

  const response = await callGeminiWithRetry(prompt);
  const parsed = parseAiJson(response.text);
  return { testCases: normalizeTestCases(parsed.testCases) };
}

module.exports = { generateTestCasesFromFeature, generateTestCasesFromDOM };
