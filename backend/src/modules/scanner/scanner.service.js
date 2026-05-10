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
        console.log(`[Scanner AI] model=${model} attempt=${attempt}`);
        const response = await ai.models.generateContent({ model, contents: prompt });
        console.log(`[Scanner AI] Success with model=${model}`);
        return response;
      } catch (error) {
        lastError = error;
        if (!isRetryable(error)) throw error;
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        console.warn(`[Scanner AI] model=${model} attempt=${attempt} failed. Retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }
  throw new Error(
    `AI hiện đang quá tải. Vui lòng thử lại sau. (${lastError?.message || lastError})`
  );
}

/**
 * Crawl a URL using Selenium (existing infrastructure) and extract structured DOM elements.
 * Returns { url, title, elements: [...] }
 */
async function crawlPageElements(targetUrl) {
  const { Builder, By } = require('selenium-webdriver');
  const chrome = require('selenium-webdriver/chrome');

  const options = new chrome.Options();
  options.addArguments('--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--window-size=1280,800');

  const driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();

  try {
    await driver.get(targetUrl);
    await driver.sleep(2500);

    const title = await driver.getTitle();

    const elements = await driver.executeScript(`
      const result = [];
      const seen = new Set();

      function getSelector(el) {
        if (el.id) return '#' + el.id;
        if (el.name) return '[name="' + el.name + '"]';
        const classes = Array.from(el.classList).filter(c => c.length > 0 && !/^ng-|^v-|^is-|^has-/.test(c));
        if (classes.length > 0) return el.tagName.toLowerCase() + '.' + classes[0];
        return el.tagName.toLowerCase();
      }

      function getXPath(el) {
        if (el.id) return '//*[@id="' + el.id + '"]';
        const parts = [];
        let node = el;
        while (node && node.nodeType === 1) {
          let idx = 1;
          let sibling = node.previousSibling;
          while (sibling) {
            if (sibling.nodeType === 1 && sibling.nodeName === node.nodeName) idx++;
            sibling = sibling.previousSibling;
          }
          const tag = node.nodeName.toLowerCase();
          parts.unshift(tag + (idx > 1 ? '[' + idx + ']' : ''));
          node = node.parentNode;
        }
        return '/' + parts.join('/');
      }

      function safeTrunc(s, n) {
        return typeof s === 'string' ? s.trim().substring(0, n) : '';
      }

      function isVisible(el) {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return rect.width > 0 && rect.height > 0 &&
               style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
      }

      // Inputs
      document.querySelectorAll('input:not([type="hidden"]):not([style*="display:none"])').forEach(el => {
        if (!isVisible(el)) return;
        const key = el.outerHTML.substring(0, 80);
        if (seen.has(key)) return;
        seen.add(key);
        result.push({
          tag: 'input', type: el.type || 'text',
          id: el.id || '', name: el.name || '',
          placeholder: safeTrunc(el.placeholder, 80),
          label: '', selector: getSelector(el), xpath: getXPath(el),
          isRequired: el.required || false
        });
      });

      // Textareas
      document.querySelectorAll('textarea').forEach(el => {
        if (!isVisible(el)) return;
        const key = el.outerHTML.substring(0, 80);
        if (seen.has(key)) return;
        seen.add(key);
        result.push({
          tag: 'textarea', type: 'textarea',
          id: el.id || '', name: el.name || '',
          placeholder: safeTrunc(el.placeholder, 80),
          label: '', selector: getSelector(el), xpath: getXPath(el),
          isRequired: el.required || false
        });
      });

      // Selects
      document.querySelectorAll('select').forEach(el => {
        if (!isVisible(el)) return;
        const key = el.outerHTML.substring(0, 80);
        if (seen.has(key)) return;
        seen.add(key);
        const opts = Array.from(el.options).slice(0, 5).map(o => o.text.trim());
        result.push({
          tag: 'select', type: 'select',
          id: el.id || '', name: el.name || '',
          placeholder: opts.join(' | '),
          label: '', selector: getSelector(el), xpath: getXPath(el),
          isRequired: el.required || false
        });
      });

      // Buttons
      document.querySelectorAll('button, input[type="submit"], input[type="button"], input[type="reset"]').forEach(el => {
        if (!isVisible(el)) return;
        const key = el.outerHTML.substring(0, 80);
        if (seen.has(key)) return;
        seen.add(key);
        result.push({
          tag: 'button', type: el.type || 'button',
          id: el.id || '', name: el.name || '',
          text: safeTrunc(el.innerText || el.value, 60),
          label: '', selector: getSelector(el), xpath: getXPath(el),
          isRequired: false
        });
      });

      // Links
      document.querySelectorAll('a[href]').forEach(el => {
        if (!isVisible(el)) return;
        const key = el.href;
        if (seen.has(key)) return;
        seen.add(key);
        const text = safeTrunc(el.innerText, 60);
        if (!text) return;
        result.push({
          tag: 'a', type: 'link',
          id: el.id || '', name: '',
          text, href: el.href || '',
          label: '', selector: getSelector(el), xpath: getXPath(el),
          isRequired: false
        });
      });

      // Forms (metadata)
      document.querySelectorAll('form').forEach(el => {
        const key = 'form:' + (el.id || el.action || el.outerHTML.substring(0, 40));
        if (seen.has(key)) return;
        seen.add(key);
        result.push({
          tag: 'form', type: 'form',
          id: el.id || '', name: el.name || '',
          action: el.action || '', method: el.method || 'get',
          label: '', selector: getSelector(el), xpath: getXPath(el),
          isRequired: false
        });
      });

      return result;
    `);

    // Attach label text by matching for/aria-labelledby
    const labelMap = await driver.executeScript(`
      const map = {};
      document.querySelectorAll('label[for]').forEach(l => {
        map[l.htmlFor] = l.innerText.trim().substring(0, 80);
      });
      return map;
    `);

    const enriched = elements.map((el) => ({
      ...el,
      label: (el.id && labelMap[el.id]) ? labelMap[el.id] : el.label,
    }));

    return { url: targetUrl, title, elements: enriched };
  } finally {
    await driver.quit();
  }
}

/**
 * Generate Katalon Object Repository entries + Groovy script from structured elements.
 * Returns { objectRepository: [...], katalonScript: string }
 */
async function generateKatalonFromElements({ url, title, elements }) {
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
    throw new Error('Chưa cấu hình GEMINI_API_KEY trong file .env');
  }

  // Reduce payload: take max 40 most useful elements
  const prioritized = [
    ...elements.filter((e) => e.tag === 'form'),
    ...elements.filter((e) => e.tag === 'input'),
    ...elements.filter((e) => e.tag === 'textarea'),
    ...elements.filter((e) => e.tag === 'select'),
    ...elements.filter((e) => e.tag === 'button'),
    ...elements.filter((e) => e.tag === 'a'),
  ].slice(0, 40);

  const elemSummary = prioritized.map((el, i) => {
    const desc = [el.tag, el.type, el.id ? `id="${el.id}"` : '', el.name ? `name="${el.name}"` : '', el.text || el.placeholder || el.label || ''].filter(Boolean).join(' ');
    return `${i + 1}. ${desc} | xpath: ${el.xpath}`;
  }).join('\n');

  const prompt = `
Bạn là chuyên gia Katalon Studio. Phân tích các phần tử DOM từ trang web sau và tạo ra:
1. Katalon Object Repository (danh sách object definitions)
2. Katalon Groovy automation script hoàn chỉnh

THÔNG TIN TRANG WEB:
URL: ${url}
Title: ${title}

DANH SÁCH PHẦN TỬ DOM (${prioritized.length} phần tử):
${elemSummary}

Trả về JSON theo định dạng sau (KHÔNG markdown, CHỈ JSON thuần):
{
  "objectRepository": [
    {
      "name": "PageFolder/objectName",
      "selectorMethod": "XPATH",
      "selectorValue": "//xpath/here",
      "description": "Mô tả ngắn về phần tử này"
    }
  ],
  "katalonScript": "// Katalon Groovy script\\nWebUI.openBrowser('')\\n..."
}

QUY TẮC objectRepository:
- name theo dạng "PageName/element_type_purpose" (ví dụ: "LoginPage/inp_username", "HomePage/btn_submit")
- Chỉ tạo object cho input, textarea, select, button quan trọng và form
- selectorMethod: ưu tiên XPATH nếu có id thì dùng CSS

QUY TẮC katalonScript:
1. Import và mở browser với GlobalVariable.baseUrl hoặc URL cụ thể
2. Dùng findTestObject('ObjectRepository/name') để tham chiếu
3. Thao tác theo luồng logic hợp lý của trang (form fill → submit → verify)
4. setText cho input text, click cho button/link, selectOptionByLabel cho select
5. verifyElementPresent, verifyElementText để xác nhận kết quả
6. takeScreenshot() sau các bước quan trọng
7. delay(1) giữa các thao tác
8. Xử lý tất cả form fields quan trọng
9. Comment // mô tả từng nhóm bước
10. Kết thúc với closeBrowser()

Trả về JSON hợp lệ, không giải thích thêm.
`;

  const response = await callGeminiWithRetry(prompt);

  let rawText = response.text.trim();
  if (rawText.startsWith('```')) {
    rawText = rawText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  }

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    const match = rawText.match(/\{[\s\S]*\}/);
    if (match) parsed = JSON.parse(match[0]);
    else throw new Error('AI trả về định dạng không hợp lệ. Vui lòng thử lại.');
  }

  return {
    objectRepository: Array.isArray(parsed.objectRepository) ? parsed.objectRepository : [],
    katalonScript: String(parsed.katalonScript || ''),
  };
}

module.exports = { crawlPageElements, generateKatalonFromElements };
