'use strict';

/**
 * katalonFileWriter.service.js
 *
 * Writes individual Katalon-compatible files to an existing project directory:
 *   - Test Cases/<name>.tc                       (metadata XML)
 *   - Scripts/<name>/Script<ts>/Script.groovy    (executable Groovy)
 *   - Test Suites/<name>.ts                      (suite XML with test-case links)
 *   - Object Repository/<folder>/<name>.rs       (web element selector XML)
 *
 * All public functions NEVER throw — they return { diskError } on failure
 * so callers can decide whether to rollback or just warn.
 */

const { randomUUID } = require('crypto');
const fs   = require('fs');
const path = require('path');

// ── XML / Groovy helpers ──────────────────────────────────────────────────────

function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function sanitizeFilename(name) {
  return (String(name || ''))
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .trim() || 'Unnamed';
}

// ── File content builders ─────────────────────────────────────────────────────

/**
 * Build a Katalon Object Repository .rs XML file (WebElementEntity).
 * @param {string} name             Short element name (last path segment)
 * @param {string} selectorMethod   XPATH | CSS | ID | NAME | CLASS_NAME | LINK_TEXT | TAG_NAME
 * @param {string} selectorValue    The actual selector string
 * @param {string} description
 */
function buildObjectRepositoryXml(name, { selectorMethod = 'XPATH', selectorValue = '', description = '' } = {}) {
  const VALID_METHODS = ['XPATH', 'CSS', 'ID', 'NAME', 'CLASS_NAME', 'LINK_TEXT', 'PARTIAL_LINK_TEXT', 'TAG_NAME'];
  const safeMethod = VALID_METHODS.includes(String(selectorMethod).toUpperCase())
    ? String(selectorMethod).toUpperCase()
    : 'XPATH';
  const guid = randomUUID();
  return `<?xml version="1.0" encoding="UTF-8"?>
<WebElementEntity>
   <description>${escapeXml(description || '')}</description>
   <name>${escapeXml(name)}</name>
   <tag></tag>
   <elementGuidId>${guid}</elementGuidId>
   <selectorCollection>
      <entry>
         <key>${safeMethod}</key>
         <value>${escapeXml(selectorValue || '')}</value>
      </entry>
   </selectorCollection>
   <selectorMethod>${safeMethod}</selectorMethod>
   <smartLocatorSetting>
      <enableSmartLocator>false</enableSmartLocator>
   </smartLocatorSetting>
   <useRalativeImagePath>false</useRalativeImagePath>
</WebElementEntity>
`;
}

function buildTestCaseXml(name, description) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<TestCaseEntity>
   <description>${escapeXml(description || '')}</description>
   <name>${escapeXml(name)}</name>
   <tag></tag>
   <comment></comment>
   <steps/>
   <variables/>
</TestCaseEntity>
`;
}

function buildGroovyScript(name, description, url, script) {
  // Use the user-supplied script if provided
  if (script && String(script).trim()) return String(script);

  const safeUrl  = (url || '').replace(/'/g, "\\'");
  const safeDesc = (description || '').replace(/'/g, "\\'");
  const navLine  = safeUrl
    ? `WebUI.navigateToUrl('${safeUrl}')`
    : `// WebUI.navigateToUrl('https://example.com')`;

  return `import com.kms.katalon.core.webui.keyword.WebUiBuiltinKeywords as WebUI
import internal.GlobalVariable as GlobalVariable

'Test: ${String(name || '').replace(/'/g, "\\'")}'
${safeDesc ? `'${safeDesc}'` : ''}

WebUI.openBrowser('')
${navLine}

// TODO: Implement test steps

WebUI.closeBrowser()
`;
}

/**
 * Build a Katalon .ts XML file.
 * @param {string} name
 * @param {string} description
 * @param {string} suiteGuid  — UUID used as <testSuiteGuid>
 * @param {Array<{name:string, id:string}>} testCaseEntries
 */
function buildTestSuiteXml(name, description, suiteGuid, testCaseEntries = []) {
  const tcLinks = testCaseEntries.map((tc) => {
    const safeName = sanitizeFilename(tc.name);
    return `   <testCaseLink>
      <guid>${escapeXml(tc.id || '')}</guid>
      <isReuseDriver>false</isReuseDriver>
      <isRun>true</isRun>
      <testCaseId>Test Cases/${escapeXml(safeName)}</testCaseId>
      <usingDataBindingAtSuiteLevel>false</usingDataBindingAtSuiteLevel>
   </testCaseLink>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<TestSuiteEntity>
   <description>${escapeXml(description || '')}</description>
   <name>${escapeXml(name)}</name>
   <tag></tag>
   <isRerun>false</isRerun>
   <mailRecipient></mailRecipient>
   <numberOfRerun>0</numberOfRerun>
   <pageLoadTimeout>30</pageLoadTimeout>
   <pageLoadTimeoutDefault>true</pageLoadTimeoutDefault>
   <rerunFailedTestCasesOnly>false</rerunFailedTestCasesOnly>
   <rerunImmediately>false</rerunImmediately>
   <testSuiteGuid>${escapeXml(suiteGuid || '')}</testSuiteGuid>
${tcLinks}
</TestSuiteEntity>
`;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Write a Katalon test-case to disk.
 * Creates:
 *   <projectPath>/Test Cases/<safeName>.tc
 *   <projectPath>/Scripts/<safeName>/Script<ts>/Script.groovy
 *
 * @returns {{ tcFilePath, scriptPath, diskError }}
 */
function writeTestCaseFile(projectPath, tcName, { description = '', url = '', script = '' } = {}) {
  try {
    if (!projectPath || !tcName) {
      return { tcFilePath: null, scriptPath: null, diskError: 'Missing projectPath or test case name' };
    }

    const safeName      = sanitizeFilename(tcName);
    const tcDir         = path.join(projectPath, 'Test Cases');
    const tcFilePath    = path.join(tcDir, `${safeName}.tc`);
    const scriptBaseDir = path.join(projectPath, 'Scripts', safeName);

    // Reuse the existing Script_* folder when present so repeated updates don't
    // accumulate duplicate folders that confuse Katalon's script discovery.
    let scriptDir;
    if (fs.existsSync(scriptBaseDir)) {
      const existingFolders = fs.readdirSync(scriptBaseDir)
        .filter((f) => {
          try { return f.startsWith('Script') && fs.statSync(path.join(scriptBaseDir, f)).isDirectory(); }
          catch { return false; }
        })
        .sort();
      if (existingFolders.length > 0) {
        scriptDir = path.join(scriptBaseDir, existingFolders[0]);
        // Clean up any extra accumulated folders (keep only the first one)
        existingFolders.slice(1).forEach((folder) => {
          try { fs.rmSync(path.join(scriptBaseDir, folder), { recursive: true, force: true }); } catch { /* ignore */ }
        });
      } else {
        scriptDir = path.join(scriptBaseDir, `Script${Date.now()}`);
      }
    } else {
      scriptDir = path.join(scriptBaseDir, `Script${Date.now()}`);
    }

    const scriptPath = path.join(scriptDir, 'Script.groovy');

    fs.mkdirSync(tcDir,    { recursive: true });
    fs.writeFileSync(tcFilePath, buildTestCaseXml(tcName, description), 'utf8');

    fs.mkdirSync(scriptDir, { recursive: true });
    fs.writeFileSync(scriptPath, buildGroovyScript(tcName, description, url, script), 'utf8');

    return { tcFilePath, scriptPath, diskError: null };
  } catch (err) {
    return { tcFilePath: null, scriptPath: null, diskError: err.message };
  }
}

/**
 * Write (or overwrite) a Katalon test-suite file to disk.
 * Creates: <projectPath>/Test Suites/<safeName>.ts
 *
 * @param {string}  projectPath
 * @param {string}  suiteName
 * @param {object}  opts
 * @param {string}  opts.description
 * @param {string}  opts.suiteId        — used as <testSuiteGuid>
 * @param {Array}   opts.testCases      — [{ id, name }] for test-case links
 * @returns {{ tsFilePath, diskError }}
 */
function writeTestSuiteFile(projectPath, suiteName, { description = '', suiteId = '', testCases = [] } = {}) {
  try {
    if (!projectPath || !suiteName) {
      return { tsFilePath: null, diskError: 'Missing projectPath or suite name' };
    }

    const safeName   = sanitizeFilename(suiteName);
    const tsDir      = path.join(projectPath, 'Test Suites');
    const tsFilePath = path.join(tsDir, `${safeName}.ts`);

    fs.mkdirSync(tsDir, { recursive: true });
    fs.writeFileSync(tsFilePath, buildTestSuiteXml(suiteName, description, suiteId, testCases), 'utf8');

    return { tsFilePath, diskError: null };
  } catch (err) {
    return { tsFilePath: null, diskError: err.message };
  }
}

/**
 * Write a Katalon Object Repository file (.rs) to disk.
 * Creates: <projectPath>/Object Repository/<objectPath>.rs
 *
 * objectPath may include a folder prefix, e.g. "LoginPage/btn_Login"
 * which produces Object Repository/LoginPage/btn_Login.rs
 *
 * @param {string}  projectPath
 * @param {string}  objectPath   Slash-separated path: "Folder/ElementName" or "ElementName"
 * @param {object}  opts
 * @param {string}  opts.selectorMethod   XPATH | CSS | ID | NAME | ...
 * @param {string}  opts.selectorValue    The actual selector string
 * @param {string}  opts.description
 * @returns {{ rsFilePath, diskError }}
 */
function writeObjectRepositoryFile(projectPath, objectPath, { selectorMethod = 'XPATH', selectorValue = '', description = '' } = {}) {
  try {
    if (!projectPath || !objectPath) {
      return { rsFilePath: null, diskError: 'Missing projectPath or objectPath' };
    }

    const parts = String(objectPath).replace(/\\/g, '/').split('/').map((p) => sanitizeFilename(p)).filter(Boolean);
    if (parts.length === 0) {
      return { rsFilePath: null, diskError: 'Invalid objectPath' };
    }

    const objectName = parts[parts.length - 1];
    const folderParts = parts.slice(0, -1);
    const rsDir = path.join(projectPath, 'Object Repository', ...folderParts);
    const rsFilePath = path.join(rsDir, `${objectName}.rs`);

    fs.mkdirSync(rsDir, { recursive: true });
    fs.writeFileSync(rsFilePath, buildObjectRepositoryXml(objectName, { selectorMethod, selectorValue, description }), 'utf8');

    return { rsFilePath, diskError: null };
  } catch (err) {
    return { rsFilePath: null, diskError: err.message };
  }
}

/**
 * Delete a test-case file from disk (best-effort, never throws).
 */
function deleteTestCaseFile(projectPath, tcName) {
  try {
    if (!projectPath || !tcName) return;
    const filePath = path.join(projectPath, 'Test Cases', `${sanitizeFilename(tcName)}.tc`);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch { /* non-fatal */ }
}

/**
 * Delete a test-suite file from disk (best-effort, never throws).
 */
function deleteTestSuiteFile(projectPath, suiteName) {
  try {
    if (!projectPath || !suiteName) return;
    const filePath = path.join(projectPath, 'Test Suites', `${sanitizeFilename(suiteName)}.ts`);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch { /* non-fatal */ }
}

/**
 * Delete an object repository file from disk (best-effort, never throws).
 */
function deleteObjectRepositoryFile(projectPath, objectPath) {
  try {
    if (!projectPath || !objectPath) return;
    const parts = String(objectPath).replace(/\\/g, '/').split('/').map((p) => sanitizeFilename(p)).filter(Boolean);
    if (parts.length === 0) return;
    const rsFilePath = path.join(projectPath, 'Object Repository', ...parts.slice(0, -1), `${parts[parts.length - 1]}.rs`);
    if (fs.existsSync(rsFilePath)) fs.unlinkSync(rsFilePath);
  } catch { /* non-fatal */ }
}

module.exports = {
  writeTestCaseFile,
  writeTestSuiteFile,
  writeObjectRepositoryFile,
  deleteTestCaseFile,
  deleteTestSuiteFile,
  deleteObjectRepositoryFile,
};
