# UI Showcase

Visual walkthrough of the Yetiforce-GUI platform, grouped by module.

> Screenshots are captured automatically via Playwright.
> Regenerate them by running `npm run screenshots` from the `frontend/` directory.

---

## Table of Contents

- [Dashboard](#dashboard)
- [Project Management](#project-management)
- [Test Suite Management](#test-suite-management)
- [Test Case Management](#test-case-management)
- [AI QA Studio](#ai-qa-studio)
- [Run Engine](#run-engine)
- [Authentication](#authentication)
- [Manual vs AI Comparison](#manual-vs-ai-comparison)

---

## Dashboard

The **Dashboard** aggregates execution analytics: pass/fail rates, duration trends, and per-suite breakdown charts.

**Full App View** — Complete application layout showing navigation rail and dashboard.

![Full App Overview](screenshots/dashboard/full-app-overview.png)

**Dashboard Overview** — KPI cards and charts for recent test runs.

![Dashboard Overview](screenshots/dashboard/dashboard-overview.png)

**Execution Stats** — Bar and pie charts showing pass/fail distribution over time.

![Execution Stats](screenshots/dashboard/dashboard-execution-stats.png)

---

## Project Management

The **Projects** module is the entry point of the platform. Create a fresh Katalon/Playwright project scaffold or import an existing one from disk.

**Projects Overview** — List of registered projects with creation dates.

![Projects Overview](screenshots/projects/projects-overview.png)

**Create New Project** — Scaffold a new Playwright + Mocha + Chai project structure automatically.

![Create Project Form](screenshots/projects/create-project-form.png)

**Import Existing Project** — Point to an existing project folder on disk to register it.

![Import Project Form](screenshots/projects/import-project-form.png)

---

## Test Suite Management

The **Test Suites** module organises test cases into ordered, executable suites. Drag-and-drop reordering is supported.

**Test Suites Overview** — Suite list grouped by project with test case counts.

![Test Suites Overview](screenshots/test-suites/test-suites-overview.png)

**Suite Detail** — Suite metadata, linked test cases with execution order.

![Suite Detail](screenshots/test-suites/test-suite-detail.png)

**Create Suite Form** — Name and describe a new test suite.

![Create Suite Form](screenshots/test-suites/create-suite-form.png)

---

## Test Case Management

The **Test Cases** module provides reusable, project-scoped test cases with full step/data-set editing and multi-suite linking.

**Test Cases Overview** — List of reusable test cases with suite link status.

![Test Cases Overview](screenshots/test-cases/test-cases-overview.png)

**Test Cases — Project Selected** — Test case list filtered by selected project.

![Test Cases Project Selected](screenshots/test-cases/test-cases-project-selected.png)

**Test Case Detail** — Full editor: name, description, expected result, URL, steps JSON, data sets JSON.

![Test Case Detail](screenshots/test-cases/test-case-detail.png)

**Manual Test Case Form** — Creating a new test case with step-by-step instructions.

![Manual Test Case Form](screenshots/test-cases/manual-test-case-form.png)

**Suite Link Dropdown** — Attach a test case to one or multiple suites in one action.

![Suite Link Dropdown](screenshots/test-cases/test-case-suite-link-dropdown.png)

---

## AI QA Studio

The **AI QA Studio** uses Google Gemini to scan a live URL, extract DOM elements, and auto-generate structured test cases with steps, expected results, and locators.

**AI Studio Overview** — Main workspace with project selector and generation controls.

![AI Studio Overview](screenshots/ai-qa-studio/ai-studio-overview.png)

**URL Scanner** — Enter a target URL to extract interactive elements for AI analysis.

![URL Scanner](screenshots/ai-qa-studio/ai-studio-url-scanner.png)

**AI Generate Test Case** — Review and approve AI-generated test cases before saving.

![AI Generate Test Case](screenshots/ai-qa-studio/ai-generate-test-case.png)

---

## Run Engine

The **Run Engine** executes Katalon or Mocha test suites, streams live logs via WebSocket, and stores results for reporting.

**Run Engine Overview** — Execution list with status badges (PASSED / FAILED / ERROR / RUNNING).

![Run Engine Overview](screenshots/run-engine/run-engine-overview.png)

**New Execution Form** — Configure project path, suite path, browser, OS, and environment profile.

![New Execution Form](screenshots/run-engine/run-engine-new-execution-form.png)

**Execution List** — Historical run records with timestamps and quick status indicators.

![Execution List](screenshots/run-engine/run-engine-execution-list.png)

**Execution History** — Audit trail of all past runs with timestamps.

![Execution History](screenshots/execution/execution-history-list.png)

---

## Authentication

**Login Page** — Secure sign-in with username and password.

![Login Page](screenshots/auth/login-page.png)

**Login with Credentials** — Form populated and ready to submit.

![Login with Credentials](screenshots/auth/login-credentials-filled.png)

---

## Manual vs AI Comparison

Side-by-side comparison of the **Manual Test Case editor** and the **AI QA Studio** workflow — illustrating the platform's dual approach to test authoring.

**Manual Test Case View** — Traditional editor for hand-crafted test steps and data sets.

![Manual Test Case View](screenshots/manual-vs-ai/manual-test-case-view.png)

**AI-Generated Test Case View** — AI Studio showing DOM-aware, auto-generated test cases ready for review.

![AI Generated Test Case View](screenshots/manual-vs-ai/ai-generated-test-case-view.png)
