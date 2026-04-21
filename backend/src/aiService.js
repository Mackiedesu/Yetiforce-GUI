const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function generateTestScript(htmlContent, testCaseDescription, url) {
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
    throw new Error('Chưa cấu hình GEMINI_API_KEY trong file .env');
  }

  // Khời tạo model của Gemini. Sử dụng gemini-2.5-flash cho tốc độ và khả năng xử lý context lớn
  
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

  try {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
    });
    
    let generatedCode = response.text;
    
    // Xử lý loại bỏ markdown ticks nếu mô hình trả về
    if (generatedCode.includes('\`\`\`javascript')) {
      generatedCode = generatedCode.split('\`\`\`javascript')[1].split('\`\`\`')[0].trim();
    } else if (generatedCode.includes('\`\`\`')) {
      generatedCode = generatedCode.split('\`\`\`')[1].split('\`\`\`')[0].trim();
    }
    
    return generatedCode;
  } catch (error) {
    console.error('Error generating script from AI:', error);
    throw error;
  }
}

module.exports = { generateTestScript };
