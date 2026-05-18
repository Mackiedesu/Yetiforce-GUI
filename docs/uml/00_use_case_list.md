# QA Studio Platform — Use Case Catalogue

> **Version:** 4.1 · **Last updated:** 2026-05-16  
> **Status:** Current — reflects post-refactor architecture (v4, Mocha + Playwright engine)

---

## System Modules

| Module | Prefix | Use Cases | Use Case Diagram | Activity Diagram |
|---|---|---|---|---|
| Authentication | UC-AUTH | 1 | *(in UC_00 overview)* | `ACT_01_login.puml` |
| Project Management | UC-PROJ | 8 | `UC_01_project_management.puml` | `ACT_02_create_project.puml` |
| Test Suite Management | UC-SUITE | 9 | `UC_02_test_suite_management.puml` | *(none)* |
| Test Case Management | UC-TC | 7 | `UC_03_test_case_management.puml` | `ACT_03_create_test_case.puml` |
| AI QA Studio | UC-STUDIO | 10 | `UC_04_ai_qa_studio.puml` | `ACT_04_ai_generate_test_cases.puml` |
| Run Engine / Execution | UC-EXEC | 10 | `UC_05_run_engine_execution.puml` | `ACT_05_execute_test_suite.puml` |
| Reporting & Dashboard | UC-REPORT | 8 | `UC_06_reporting_dashboard.puml` | `ACT_06_view_report.puml` |
| File System Browser | UC-FS | 5 | *(in UC_01 project mgmt)* | *(none)* |
| **Total** | | **58** | | |

> **Removed in v3:** UC-SPY (Object Spy), UC-OBJ (Object Repository),
> UC-SCAN (standalone scanner → merged into AI Studio),
> UC-AIGEN (standalone AI Generator → merged into AI Studio)

---

## Diagram Index

### Use Case Diagrams

| File | Coverage |
|---|---|
| `usecase/UC_00_general_overview.puml` | System-level overview of all modules and actors |
| `usecase/UC_01_project_management.puml` | Create, generate, import, update, delete projects; file system browser |
| `usecase/UC_02_test_suite_management.puml` | Suite CRUD, test case linking, suite discovery (SuiteTreePicker) |
| `usecase/UC_03_test_case_management.puml` | Test case CRUD, steps, data sets, suite linking, disk sync |
| `usecase/UC_04_ai_qa_studio.puml` | URL scan, text describe, AI generation, review, save to project |
| `usecase/UC_05_run_engine_execution.puml` | Configure, execute, monitor live log, view history |
| `usecase/UC_06_reporting_dashboard.puml` | Dashboard stats, charts, execution history, run detail view |

### Sequence Diagrams

| File | Flow Covered | Related Use Cases |
|---|---|---|
| `sequence/SD_01_login.puml` | User login and session creation | UC-AUTH-01 |
| `sequence/SD_02_create_project.puml` | Create project with duplicate name check | UC-PROJ-02 |
| `sequence/SD_03_generate_katalon_project.puml` | Generate Mocha + Playwright project folder on disk | UC-PROJ-03 |
| `sequence/SD_04_create_test_case.puml` | Create test case with file sync and suite linking | UC-TC-01 |
| `sequence/SD_05_create_test_suite.puml` | Create test suite with compensating transaction on disk failure | UC-SUITE-01 |
| `sequence/SD_06_link_testcase_suite.puml` | Link existing test case to suite and sync `.spec.js` | UC-SUITE-06 |
| `sequence/SD_07_ai_qa_studio_workflow.puml` | Full AI Studio workflow (URL/text → generate → save) | UC-STUDIO-01 to 10 |
| `sequence/SD_08_url_scan_dom_extraction.puml` | Scan URL with Playwright headless browser, extract elements | UC-STUDIO-02 |
| `sequence/SD_09_ai_test_generation.puml` | Gemini AI test case generation with retry/fallback logic | UC-STUDIO-04 |
| `sequence/SD_10_execute_test_suite.puml` | Execute test suite and stream live output via WebSocket | UC-EXEC-03 |
| `sequence/SD_11_parse_execution_report.puml` | Parse Mochawesome JSON report after Mocha exits | UC-EXEC-05 |
| `sequence/SD_12_dashboard_run_engine_nav.puml` | Dashboard "View Report" navigation to Run Engine tab | UC-REPORT-06 |
| `sequence/SD_13_save_files_to_katalon.puml` | Write Playwright spec files to disk; rollback on failure | UC-TC-01, UC-SUITE-01 |
| `sequence/SD_14_recursive_suite_scan.puml` | Recursive scan of `tests/suites/` folder tree | UC-SUITE-09, UC-EXEC-02 |
| `sequence/SD_15_import_katalon_project.puml` | Import and validate existing Playwright project on disk | UC-PROJ-04 |

### Activity Diagrams

| File | Workflow Covered | Related Use Cases |
|---|---|---|
| `activity/ACT_01_login.puml` | Login workflow with credential validation | UC-AUTH-01 |
| `activity/ACT_02_create_project.puml` | Create or generate or import a project | UC-PROJ-02, UC-PROJ-03, UC-PROJ-04 |
| `activity/ACT_03_create_test_case.puml` | Define test case fields, write file, link to suites | UC-TC-01 |
| `activity/ACT_04_ai_generate_test_cases.puml` | AI-assisted test case generation (URL scan or text describe) | UC-STUDIO-01 to 10 |
| `activity/ACT_05_execute_test_suite.puml` | Configure and run a test suite, monitor, view result | UC-EXEC-01 to 09 |
| `activity/ACT_06_view_report.puml` | View and navigate execution reports on Dashboard | UC-REPORT-01 to 08 |

---

## UC-AUTH — Authentication

> **Diagrams:** `usecase/UC_00_general_overview.puml` (overview) · `activity/ACT_01_login.puml` · `sequence/SD_01_login.puml`

### UC-AUTH-01: Login
- **Actor:** QA Engineer
- **Trigger:** User opens the application
- **Flow:**
  1. Enter username + password
  2. Frontend validates non-empty
  3. POST /api/auth/login
  4. Backend compares against `AUTH_USERNAME`/`AUTH_PASSWORD` env vars
  5. On match: return base64 token → stored in localStorage
  6. Redirect to Projects page
- **Error:** HTTP 401 if credentials don't match
- **Diagram:** `sequence/SD_01_login.puml`

---

## UC-PROJ — Project Management

> **Diagrams:** `usecase/UC_01_project_management.puml` · `activity/ACT_02_create_project.puml` · Sequences: `SD_02`, `SD_03`, `SD_15`

### UC-PROJ-01: List Projects
- **Actor:** QA Engineer
- **Flow:** GET /api/projects → sorted list (newest first)

### UC-PROJ-02: Create Project (Manual Path)
- **Actor:** QA Engineer
- **Flow:**
  1. Fill name, optional description + `katalon_project_path` (disk path field)
  2. POST /api/projects
  3. Check duplicate name (case-insensitive)
  4. INSERT to projects table
- **Diagram:** `sequence/SD_02_create_project.puml`

### UC-PROJ-03: Generate Mocha Project on Disk
- **Actor:** QA Engineer
- **Flow:**
  1. Fill name, description, save directory (PathPicker)
  2. POST /api/projects/generate
  3. `mochaScaffold.service.js` creates 8 folders + 5 scaffold files
  4. INSERT to projects table with generated path
- **Disk output:** `tests/suites/`, `tests/cases/`, `tests/generated/`, `tests/locators/`,
  `reports/`, `screenshots/`, `.mocharc.cjs`, `package.json`, `.gitignore`, `README.md`
- **Diagram:** `sequence/SD_03_generate_katalon_project.puml`

### UC-PROJ-04: Import Existing Playwright Project
- **Actor:** QA Engineer
- **Flow:**
  1. Enter path to existing folder (PathPicker) + project name
  2. POST /api/projects/import
  3. Validate: path exists, required folders present (`tests/`)
  4. INSERT to projects table
- **Diagram:** `sequence/SD_15_import_katalon_project.puml`

### UC-PROJ-05: View Project Folder Structure
- **Actor:** QA Engineer
- **Flow:** GET /api/projects/:id/structure → file tree with counts

### UC-PROJ-06: Update Project
- **Actor:** QA Engineer
- **Flow:** PUT /api/projects/:id → validate name uniqueness, UPDATE

### UC-PROJ-07: Delete Project
- **Actor:** QA Engineer
- **Flow:** DELETE /api/projects/:id → CASCADE to suites and test cases

### UC-PROJ-08: Browse File System (PathPickerInput)
- **Actor:** QA Engineer
- **Flow:**
  1. Open modal
  2. GET /api/fs/drives → list Windows drives
  3. GET /api/fs/browse?path=X → directory contents
  4. Navigate, select → POST /api/fs/validate
- **Diagram:** *(no dedicated sequence diagram — covered by backend API: GET /api/fs/drives, GET /api/fs/browse, POST /api/fs/validate)*

---

## UC-SUITE — Test Suite Management

> **Diagrams:** `usecase/UC_02_test_suite_management.puml` · Sequences: `SD_05`, `SD_06`, `SD_13`, `SD_14`

### UC-SUITE-01: Create Test Suite (+ disk write)
- **Actor:** QA Engineer
- **Flow:**
  1. Select project, fill name + description
  2. POST /api/projects/:pid/suites
  3. DB transaction: INSERT test_suites + optional inline test cases + links
  4. Lookup project disk path
  5. `writeTestSuiteFile()` → `tests/suites/<name>.spec.js`
  6. On disk failure: DELETE suite record (compensate), return HTTP 500
- **Diagrams:** `sequence/SD_05_create_test_suite.puml` · `sequence/SD_13_save_files_to_katalon.puml`

### UC-SUITE-02: Update Test Suite
- **Actor:** QA Engineer
- **Flow:** PUT → UPDATE row + `syncSuiteToDisk()` (best-effort, returns `disk_warning`)

### UC-SUITE-03: Delete Test Suite (+ disk cleanup)
- **Actor:** QA Engineer
- **Flow:** DELETE CASCADE → `deleteTestSuiteFile()` (best-effort)

### UC-SUITE-04: List Test Suites for Project
- **Actor:** QA Engineer
- **Flow:** GET /api/projects/:pid/suites → with `test_case_count`

### UC-SUITE-05: Add New Test Case to Suite
- **Actor:** QA Engineer
- **Flow:**
  1. POST .../test-cases (no `test_case_id`)
  2. Create reusable test case in DB transaction
  3. INSERT `suite_test_case_links`
  4. `syncSuiteToDisk()` → regenerate `.spec.js`

### UC-SUITE-06: Link Existing Test Case to Suite
- **Actor:** QA Engineer
- **Flow:**
  1. POST .../test-cases `{ test_case_id: uuid }`
  2. INSERT `suite_test_case_links`
  3. `syncSuiteToDisk()` → regenerate `.spec.js`
- **Diagram:** `sequence/SD_06_link_testcase_suite.puml`

### UC-SUITE-07: Remove Test Case from Suite
- **Actor:** QA Engineer
- **Flow:** DELETE link → `syncSuiteToDisk()` → regenerate `.spec.js` without that TC

### UC-SUITE-08: Reorder Test Cases in Suite
- **Actor:** QA Engineer
- **Flow:** PUT .../reorder `{ items: [{ id, execution_order }] }` → UPDATE in transaction

### UC-SUITE-09: Recursive Test Suite Scan (SuiteTreePicker)
- **Actor:** QA Engineer (in Run Engine form)
- **Flow:**
  1. GET /api/projects/:pid/scan-suites
  2. `mochaSuiteScanner` walks `tests/suites/` folder recursively
  3. Returns hierarchical tree of `.spec.js` file nodes
  4. Frontend renders expandable tree picker (SuiteTreePicker)
- **Diagram:** `sequence/SD_14_recursive_suite_scan.puml`

---

## UC-TC — Test Case Management

> **Diagrams:** `usecase/UC_03_test_case_management.puml` · `activity/ACT_03_create_test_case.puml` · Sequences: `SD_04`, `SD_13`

### UC-TC-01: Create Test Case (+ disk write + suite linking)
- **Actor:** QA Engineer
- **Flow:**
  1. Fill name, description, expected_result, url, script, steps (JSON), data_sets (JSON)
  2. Optionally select suites via SuiteMultiSelect
  3. POST /api/projects/:pid/test-cases
  4. DB transaction: INSERT test_cases + steps + data_sets (COMMIT)
  5. Lookup project path → `writeTestCaseFile()`:
     - `tests/cases/<name>.spec.js` (Playwright + Mocha + Chai spec)
  6. On disk failure: DELETE test case record (compensate), return HTTP 500
  7. For each selected suite: POST link → `.spec.js` suite regenerated
- **Diagrams:** `sequence/SD_04_create_test_case.puml` · `sequence/SD_13_save_files_to_katalon.puml`

### UC-TC-02: List Test Cases for Project
- **Actor:** QA Engineer
- **Flow:** GET /api/projects/:pid/test-cases → with `linked_suite_count`

### UC-TC-03: View Test Case Details
- **Actor:** QA Engineer
- **Flow:** GET /api/projects/:pid/test-cases/:id → steps tree + data_sets + linked_suites

### UC-TC-04: Update Test Case (+ disk sync)
- **Actor:** QA Engineer
- **Flow:** PUT → UPDATE + `writeTestCaseFile()` (best-effort, `disk_warning` if fails)

### UC-TC-05: Delete Test Case (+ disk cleanup)
- **Actor:** QA Engineer
- **Flow:** Fetch name → DELETE CASCADE → `deleteTestCaseFile()` (best-effort)

### UC-TC-06: Link Test Case to Multiple Suites
- **Actor:** QA Engineer
- **Flow:** SuiteMultiSelect in create/edit form → loop POST for each selected suite

### UC-TC-07: View Linked Suites
- **Actor:** QA Engineer
- **Flow:** `linked_suites[]` from `suite_test_case_links JOIN test_suites`

---

## UC-STUDIO — AI QA Studio

> **Diagrams:** `usecase/UC_04_ai_qa_studio.puml` · `activity/ACT_04_ai_generate_test_cases.puml` · Sequences: `SD_07`, `SD_08`, `SD_09`

### UC-STUDIO-01: Select Input Mode
- **Actor:** QA Engineer
- **Flow:** Toggle "URL Scan" / "Text Describe" tabs → resets generated test cases

### UC-STUDIO-02: Scan Website URL (DOM Extraction)
- **Actor:** QA Engineer + Playwright
- **Flow:**
  1. Enter URL → validate `http://` or `https://`
  2. POST /api/ai-agent/scan-url
  3. Playwright headless Chrome → navigate → extract elements (input, button, a, form…)
  4. Return elements with css selector, xpath, id, name, label, type, required, href
- **Error:** 422 if no elements found; 502 if connection fails
- **Diagram:** `sequence/SD_08_url_scan_dom_extraction.puml`

### UC-STUDIO-03: Describe Feature in Text
- **Actor:** QA Engineer
- **Flow:** Enter natural language description → POST /api/ai-agent/generate-test-cases `{ requirement }`

### UC-STUDIO-04: Generate Test Cases via Gemini AI
- **Actor:** Gemini AI (Google)
- **Flow:**
  1. Build structured prompt (DOM context or text requirement)
  2. `callGeminiWithRetry()` — model chain: `gemini-2.5-flash` → `1.5-flash` → `1.5-pro`
  3. 3 attempts per model with exponential backoff (1.5s, 3s, 6s)
  4. Parse JSON → normalize `{ name, description, steps[], expected_result, target_url, playwrightScript }`
- **Diagram:** `sequence/SD_09_ai_test_generation.puml`

### UC-STUDIO-05: Review & Edit Generated Test Cases
- **Actor:** QA Engineer
- **Flow:** Review cards, edit fields, select/deselect checkboxes

### UC-STUDIO-06: Select Existing Project
- **Actor:** QA Engineer
- **Flow:** Dropdown from GET /api/projects → triggers suite list load

### UC-STUDIO-07: Create New Project from Studio
- **Actor:** QA Engineer
- **Flow:**
  1. Toggle "New Project" mode
  2. Fill name, description, save directory
  3. On save: POST /api/projects/generate → Mocha scaffold on disk + DB insert
  4. Project prepended to state; suite selector hidden

### UC-STUDIO-08: Select Target Suite
- **Actor:** QA Engineer
- **Flow:** Dropdown showing suites for selected project (existing project mode only)

### UC-STUDIO-09: Save Batch Test Cases
- **Actor:** QA Engineer
- **Flow:**
  1. POST /api/ai-agent/save-batch `{ project_id, testCases[], source_url }`
  2. For each TC: DB transaction INSERT test_cases + steps + data_sets
  3. Returns `{ saved, errors, testCases[] }`

### UC-STUDIO-10: Auto-link Saved Test Cases to Suite
- **Actor:** QA Engineer
- **Flow:** If `selectedSuiteId` → loop POST link per saved TC → `.spec.js` suite file regenerated
- **Diagram:** `sequence/SD_07_ai_qa_studio_workflow.puml`

---

## UC-EXEC — Run Engine / Execution

> **Diagrams:** `usecase/UC_05_run_engine_execution.puml` · `activity/ACT_05_execute_test_suite.puml` · Sequences: `SD_10`, `SD_11`, `SD_12`, `SD_14`

### UC-EXEC-01: Configure Execution Parameters
- **Actor:** QA Engineer
- **Inputs:** project (auto-fills path), suite (from tree picker), browser, OS, profile

### UC-EXEC-02: Scan Test Suites Recursively
- **Actor:** QA Engineer
- **Flow:** Auto-triggered on project selection → GET scan-suites → SuiteTreePicker
- **Diagram:** `sequence/SD_14_recursive_suite_scan.puml`

### UC-EXEC-03: Start Execution
- **Actor:** QA Engineer
- **Flow:**
  1. POST /api/executions
  2. Sanitize paths (`sanitizePath`) and profile (`sanitizeProfile`)
  3. INSERT `katalon_execution_runs` (status=`running`) → broadcast `katalon_start`
  4. `runExecution()` async fire-and-forget
- **Diagram:** `sequence/SD_10_execute_test_suite.puml`

### UC-EXEC-04: Monitor Live Execution
- **Actor:** QA Engineer + WebSocket Server
- **Flow:** stdout/stderr streamed as `katalon_log` events → LiveLogPanel (includes Playwright browser install progress on first run)

### UC-EXEC-05: Parse Mochawesome JSON Report
- **Actor:** System (automatic after Mocha exits)
- **Flow:**
  1. `parseMochaReport(reportDir)` — never throws
  2. Find `reports/mocha-report.json` in project directory
  3. Parse JSON → walk `results[].suites[].tests[]` and `beforeHooks`/`afterHooks`
  4. Map each entry to status, duration_ms, error_message, stack_trace
  5. Fallback: extract aggregate counts from `stats` object
- **Diagram:** `sequence/SD_11_parse_execution_report.puml`

### UC-EXEC-06: Persist Test Case Details
- **Actor:** System
- **Flow:** Bulk INSERT to `execution_run_details` in a single transaction

### UC-EXEC-07: Broadcast Completion & Update Run
- **Actor:** WebSocket Server
- **Flow:** UPDATE run (status, exit_code, duration_ms, passed_tests, failed_tests…) → broadcast `katalon_complete`

### UC-EXEC-08: View Execution History
- **Actor:** QA Engineer
- **Flow:** Sidebar list from GET /api/executions → click row to load full detail

### UC-EXEC-09: View Execution Details (3 tabs)
- **Actor:** QA Engineer
- **Flow:** GET /api/executions/:id → `{ logs[], testCaseDetails[] }` → RunDetailPanel
  - **LOGS tab:** all stdout/stderr lines with level badges
  - **TEST CASES tab:** per-test status filter + stack trace expansion (includes hook failures as ERROR entries)
  - **CONFIG tab:** suite, project, browser, profile, report path

### UC-EXEC-10: Delete Execution Record
- **Actor:** QA Engineer
- **Flow:** DELETE /api/executions/:id → CASCADE logs + test case details

---

## UC-REPORT — Reporting & Dashboard

> **Diagrams:** `usecase/UC_06_reporting_dashboard.puml` · `activity/ACT_06_view_report.puml` · Sequences: `SD_12`

### UC-REPORT-01: View Dashboard Statistics
- **Actor:** QA Engineer
- **Flow:** GET /api/executions/stats → total runs, status counts, avg duration, pass rate

### UC-REPORT-02: View Status Breakdown Chart
- **Actor:** QA Engineer
- **Flow:** Pie chart derived from `statusCounts` in stats response

### UC-REPORT-03: View Pass/Fail Trend Chart
- **Actor:** QA Engineer
- **Flow:** Bar chart from `recentRuns[]` (last 10 runs)

### UC-REPORT-04: Filter Executions by Status
- **Actor:** QA Engineer
- **Flow:** GET /api/executions?status=passed|failed|error → filtered paginated list

### UC-REPORT-05: Expand Inline Run Detail (Dashboard)
- **Actor:** QA Engineer
- **Flow:** Click table row → GET /api/executions/:id → mini detail with 8 log lines

### UC-REPORT-06: Navigate to Run Engine via "View Report"
- **Actor:** QA Engineer
- **Flow:**
  1. Click [View Report] on dashboard row
  2. `onSelectRun(run)` → `setExecPreselect(run.id)` + `handleNavigate('executions')`
  3. ExecutionsTab receives `initialRunId` prop
  4. `useEffect([initialRunId])` → `fetchDetail(id)` → RunDetailPanel shown
- **Diagram:** `sequence/SD_12_dashboard_run_engine_nav.puml`

### UC-REPORT-07: View Test Case Results (Run Engine tab)
- **Actor:** QA Engineer
- **Flow:** TEST CASES tab in RunDetailPanel → filter by status → expand stack traces

### UC-REPORT-08: Auto-refresh Dashboard
- **Actor:** WebSocket Server
- **Flow:** `katalon_complete` → `setDashboardRefreshKey(k+1)` → re-fetch stats + runs; NEW badge shown on Dashboard nav item

---

## UC-FS — File System Browser

> **Diagrams:** *(modelled within `usecase/UC_01_project_management.puml` as "Browse File System")* · No dedicated sequence or activity diagram

### UC-FS-01: Open Path Picker
- **Actor:** QA Engineer
- **Trigger:** Click PathPickerInput field anywhere in the app

### UC-FS-02: List Windows Drives
- **Actor:** QA Engineer
- **Flow:** GET /api/fs/drives → PowerShell `Get-PSDrive` (Windows) or root `/` (Unix)

### UC-FS-03: Navigate Directory Tree
- **Actor:** QA Engineer
- **Flow:** GET /api/fs/browse?path=X → `readdirSync`, sorted (dirs first, alphabetical)

### UC-FS-04: Select Path
- **Actor:** QA Engineer
- **Flow:** Click [Select] → path value written to input field

### UC-FS-05: Validate Path Type
- **Actor:** System
- **Flow:** POST /api/fs/validate `{ path, expectType: 'directory'|'file' }` → exists + type check

---

## Actors Reference

| Actor | Role |
|---|---|
| QA Engineer | Primary human user of the platform |
| Gemini AI (Google) | Generates test cases from DOM or natural language |
| Playwright (Headless Chrome) | DOM extraction from target websites |
| Mocha + Playwright | Executes test suites via `node mocha` + Playwright browser |
| WebSocket Server | Broadcasts real-time execution events |
| PostgreSQL | Persistent data store |
| File System | Mocha + Playwright project folder structure on disk |

---

## Removed Features (v2 → v3)

| Feature | Reason |
|---|---|
| Object Spy (UC-SPY) | Outside MVP scope; Playwright handles element capture |
| Object Repository (UC-OBJ) | Redundant with AI-generated locators |
| Standalone Scanner tab | Merged into AI QA Studio |
| Standalone AI Generator tab | Merged into AI QA Studio |
| Header: Object Spy / Save / Run Test / Settings buttons | Removed to simplify UI |
| Manual Tab / Script Tab | Outside MVP scope |
| Katalon Runtime Engine (KRE) | Replaced by Mocha + Playwright (Node.js-native, no licence required) |
| Groovy scripts / .tc XML / .ts XML | Replaced by `.spec.js` (Playwright + Mocha + Chai) |
| JUnit XML report parsing | Replaced by Mochawesome JSON report parsing |
