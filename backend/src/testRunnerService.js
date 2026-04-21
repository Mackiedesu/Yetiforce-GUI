const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

async function runMochaTest(scriptContent) {
  return new Promise((resolve, reject) => {
    // Lưu tạm file test
    const testsDir = path.join(__dirname, '..', 'tmp_tests');
    if (!fs.existsSync(testsDir)) {
      fs.mkdirSync(testsDir, { recursive: true });
    }
    
    // Tên file duy nhất
    const filename = `test_${Date.now()}.test.js`;
    const filePath = path.join(testsDir, filename);
    
    fs.writeFileSync(filePath, scriptContent);
    
    // Đảm bảo thư mục báo cáo (reports) có sẵn
    const reportDir = path.join(__dirname, '..', 'reports');

    const reportFilename = `report_${Date.now()}`;

    // Chạy mocha qua command line và format kết quả với mochawesome
    const mochaCmd = `npx mocha "${filePath}" --reporter mochawesome --reporter-options reportDir="${reportDir}",reportFilename="${reportFilename}",html=true,json=true --timeout 60000`;
    
    exec(mochaCmd, (error, stdout, stderr) => {
      // Mocha returns a non-zero exit code if any test fails, 
      // so `error` might be populated even if it ran successfully but tests failed.
      const result = {
        success: !error,
        stdout,
        stderr,
        reportFolder: reportDir,
        reportHtml: path.join(reportDir, `${reportFilename}.html`)
      };
      
      resolve(result);
    });
  });
}

module.exports = { runMochaTest };
