const { generateTestCasesFromFeature, generateTestCasesFromDOM } = require('./aiAgent.service');
const { crawlPageElements } = require('../scanner/scanner.service');
const { createTestCase, projectExists, getProjectPath } = require('../test-cases/infrastructure/testCase.repository.pg');
const { writeTestCaseFile, writeTestSuiteFile, writeObjectRepositoryFile } = require('../projects/infrastructure/mochaFileWriter.service');
const suiteRepository = require('../test-suites/infrastructure/testSuite.repository.pg');

// ─── Helpers ────────────────────────────────────────────────────────────────

function validationError(msg) {
  const e = new Error(msg);
  e.statusCode = 400;
  return e;
}

/** Map low-level crawler errors to user-friendly Vietnamese messages */
function mapScanError(err) {
  const msg = String(err?.message || err).toLowerCase();
  if (msg.includes('econnrefused') || msg.includes('enotfound') || msg.includes('getaddrinfo')) {
    return 'Không thể kết nối đến trang web. Kiểm tra lại URL hoặc kết nối mạng.';
  }
  if (msg.includes('timeout') || msg.includes('etimedout') || msg.includes('timed out')) {
    return 'Trang web không phản hồi sau thời gian chờ. Trang có thể bị chậm hoặc không khả dụng.';
  }
  if (msg.includes('net::err_ssl') || msg.includes('certificate')) {
    return 'Lỗi chứng chỉ SSL của trang web. Không thể quét trang này.';
  }
  if (msg.includes('403') || msg.includes('forbidden') || msg.includes('access denied')) {
    return 'Trang web từ chối truy cập (403 Forbidden). Trang có thể chặn crawler tự động.';
  }
  if (msg.includes('404') || msg.includes('not found')) {
    return 'Trang không tồn tại (404). Kiểm tra lại URL.';
  }
  if (msg.includes('chrome') || msg.includes('chromedriver') || msg.includes('webdriver')) {
    return 'Không thể khởi động Chrome headless. Đảm bảo Chrome và ChromeDriver đã được cài đặt.';
  }
  return `Quét trang thất bại: ${err?.message || err}`;
}

// ─── Text-based generation (legacy, kept for backward compat) ────────────────

async function generateHandler(req, res) {
  const { requirement } = req.body;
  if (!requirement || !String(requirement).trim()) {
    return res.status(400).json({ error: 'requirement là bắt buộc' });
  }
  const result = await generateTestCasesFromFeature(String(requirement).trim());
  return res.json({ success: true, ...result });
}

// ─── Scan URL (step 1 of unified workflow) ───────────────────────────────────

async function scanUrlHandler(req, res) {
  const { url } = req.body;

  if (!url || typeof url !== 'string' || !url.trim()) {
    return res.status(400).json({ error: 'url là bắt buộc' });
  }

  // Validate URL format
  let parsedUrl;
  try {
    parsedUrl = new URL(url.trim());
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error();
  } catch {
    return res.status(400).json({ error: 'URL không hợp lệ. Vui lòng nhập địa chỉ HTTP/HTTPS hợp lệ.' });
  }

  console.log(`[AI Studio] Scanning URL: ${url}`);

  try {
    const scanResult = await crawlPageElements(url.trim());

    if (!scanResult.elements || scanResult.elements.length === 0) {
      return res.status(422).json({
        error: 'Không tìm thấy phần tử tương tác nào trên trang. Trang có thể trống, yêu cầu đăng nhập, hoặc chặn trình duyệt tự động.',
      });
    }

    console.log(`[AI Studio] Scanned "${scanResult.title}" — ${scanResult.elements.length} elements`);
    return res.json({ success: true, ...scanResult });
  } catch (err) {
    console.error('[AI Studio] Scan error:', err.message);
    return res.status(502).json({ error: mapScanError(err) });
  }
}

// ─── Generate test cases from DOM (step 2 of unified workflow) ──────────────

async function generateFromDomHandler(req, res) {
  const { url, title, elements } = req.body;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'url là bắt buộc' });
  }
  if (!Array.isArray(elements) || elements.length === 0) {
    return res.status(400).json({ error: 'elements phải là mảng không rỗng (kết quả từ bước scan)' });
  }

  console.log(`[AI Studio] Generating test cases for ${url} (${elements.length} elements)`);

  const result = await generateTestCasesFromDOM({ url, title: title || url, elements });

  console.log(`[AI Studio] Generated ${result.testCases.length} test cases`);
  return res.json({ success: true, ...result });
}

// ─── Save batch (shared by both text and DOM workflows) ─────────────────────

async function saveBatchHandler(req, res) {
  const { project_id, suite_id, testCases, source_url, scanned_dom_json } = req.body;

  if (!project_id) {
    return res.status(400).json({ error: 'project_id là bắt buộc' });
  }
  if (!Array.isArray(testCases) || testCases.length === 0) {
    return res.status(400).json({ error: 'testCases phải là mảng không rỗng' });
  }

  const exists = await projectExists(project_id);
  if (!exists) {
    return res.status(404).json({ error: 'Project không tồn tại' });
  }

  // Fetch the on-disk Katalon project path so we can write .tc / .groovy files
  const projectPath = await getProjectPath(project_id);

  // Validate suite belongs to project if provided
  if (suite_id) {
    const suiteCheck = await suiteRepository.getSuiteById(project_id, suite_id);
    if (!suiteCheck) {
      return res.status(404).json({ error: 'Test suite không tồn tại trong project này' });
    }
  }

  const saved = [];
  const errors = [];

  for (const tc of testCases) {
    try {
      const created = await createTestCase(project_id, {
        name: tc.name,
        description: tc.description || null,
        expected_result: tc.expectedResult || null,
        script: tc.katalonScript || null,
        url: source_url || null,
        // Store the DOM snapshot so the test case is traceable back to its origin
        scanned_dom_json: scanned_dom_json || null,
        steps: (tc.steps || []).map((s, i) => ({
          title: s.title,
          description: s.description || null,
          expected_result: s.expected_result || null,
          step_order: i + 1,
          children: [],
        })),
        data_sets: Object.keys(tc.testData || {}).length > 0
          ? [{ name: 'Generated Test Data', data_json: tc.testData }]
          : [],
      });
      saved.push(created);

      // ── Write .tc + Script.groovy files to disk ──────────────────────────
      if (projectPath) {
        const { diskError } = writeTestCaseFile(projectPath, tc.name, {
          description: tc.description || '',
          url:         source_url   || '',
          script:      tc.katalonScript || '',
        });
        if (diskError) {
          console.warn(`[AI Studio] Disk write warning for "${tc.name}": ${diskError}`);
        } else {
          console.log(`[AI Studio] Wrote Katalon files for "${tc.name}" to disk`);
        }

        // ── Write Object Repository .rs files for each test object locator ──
        if (Array.isArray(tc.objectLocators) && tc.objectLocators.length > 0) {
          for (const locator of tc.objectLocators) {
            if (!locator.name) continue;
            const { rsFilePath, diskError: rsDiskError } = writeObjectRepositoryFile(
              projectPath,
              locator.name,
              {
                selectorMethod: locator.selectorMethod || 'XPATH',
                selectorValue:  locator.selectorValue  || '',
                description:    locator.description    || '',
              }
            );
            if (rsDiskError) {
              console.warn(`[AI Studio] Object repo write warning for "${locator.name}": ${rsDiskError}`);
            } else {
              console.log(`[AI Studio] Wrote object repository file: ${rsFilePath}`);
            }
          }
        }
      } else {
        console.warn(`[AI Studio] No katalon_project_path for project ${project_id} — skipping disk write`);
      }

      // ── Link to suite if suite_id provided ───────────────────────────
      if (suite_id) {
        try {
          await suiteRepository.addTestCase(project_id, suite_id, { test_case_id: created.id });
        } catch (linkErr) {
          console.warn(`[AI Studio] Suite link warning for "${tc.name}": ${linkErr.message}`);
        }
      }
    } catch (err) {
      errors.push({ name: tc.name, error: err.message });
    }
  }

  // ── Regenerate .ts suite file on disk after all test cases linked ─────
  if (suite_id && saved.length > 0 && projectPath) {
    try {
      const updatedSuite = await suiteRepository.getSuiteById(project_id, suite_id);
      if (updatedSuite) {
        const { diskError } = writeTestSuiteFile(projectPath, updatedSuite.name, {
          description: updatedSuite.description,
          suiteId:     updatedSuite.id,
          testCases:   (updatedSuite.test_cases || []).map((tc) => ({ id: tc.id, name: tc.name })),
        });
        if (diskError) {
          console.warn(`[AI Studio] Suite .ts sync warning: ${diskError}`);
        } else {
          console.log(`[AI Studio] Synced .ts file for suite "${updatedSuite.name}"`);
        }
      }
    } catch (syncErr) {
      console.warn(`[AI Studio] Suite .ts sync error: ${syncErr.message}`);
    }
  }

  return res.status(201).json({
    success: true,
    saved: saved.length,
    errors: errors.length,
    testCases: saved,
    failures: errors,
  });
}

module.exports = { generateHandler, scanUrlHandler, generateFromDomHandler, saveBatchHandler };
