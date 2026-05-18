# Yetiforce-GUI

An AI-powered GUI platform for managing and automating tests with Katalon integration. The platform allows importing Katalon projects, managing test suites and cases, running Selenium-based tests, and generating Groovy automation scripts via Google Gemini AI.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Features](#features)
3. [System Architecture](#system-architecture)
4. [Technologies](#technologies)
5. [Installation](#installation)
6. [Running the Project](#running-the-project)
7. [AI Workflow](#ai-workflow)
8. [Testing Workflow](#testing-workflow)
9. [UML Diagrams](#uml-diagrams)
10. [Folder Structure](#folder-structure)
11. [Configuration Reference](#configuration-reference)
12. [Katalon Run Engine Setup](#katalon-run-engine-setup)
13. [Useful Commands](#useful-commands)
14. [Notes & Gotchas](#notes--gotchas)
15. [UI Screenshots](#ui-screenshots)

---

## Project Overview

Yetiforce-GUI bridges the gap between manual QA work and automated test execution. It provides a unified web interface for:

- Registering and importing Katalon/Playwright projects from disk
- Authoring test cases manually or generating them via AI
- Organising test cases into ordered, executable test suites
- Running Katalon Runtime Engine (KRE) or Mocha suites with live log streaming
- Reviewing execution reports and analytics on a built-in dashboard

---

## Features

| Module | Description |
|---|---|
| **Project Management** | Create scaffolded projects or import existing ones from disk |
| **Test Case Editor** | Author reusable test cases with steps, data sets, and suite linking |
| **Test Suite Manager** | Organise test cases into suites with drag-and-drop ordering |
| **AI QA Studio** | Scan a live URL, extract DOM elements, and generate test cases with Google Gemini |
| **Run Engine** | Execute Katalon or Mocha suites; stream live logs via WebSocket |
| **Execution Dashboard** | Visualise pass/fail rates, duration trends, and per-suite breakdowns |

---

## System Architecture

```
Yetiforce-GUI/
├── frontend/        # React + Vite (port 5173)
├── backend/         # Express + PostgreSQL + Selenium/WebSocket (port 5000)
├── docker-compose.yml
└── README.md
```

- **Frontend** communicates with the backend at `http://localhost:5000` and `ws://localhost:5000/ws` (configured in `frontend/src/config/endpoints.js`).
- **Backend** serves REST APIs and WebSocket connections, manages the PostgreSQL database, and drives Chrome via Selenium WebDriver.
- **Database** is PostgreSQL 16, auto-initialized from SQL migration files in `backend/db/init/` when running via Docker.

---

## Technologies

### Frontend

| Technology | Role |
|---|---|
| React 18 | UI framework |
| Vite | Build tool and dev server |
| React Router | Client-side routing |
| Axios | HTTP client |

### Backend

| Technology | Role |
|---|---|
| Node.js + Express | REST API server |
| PostgreSQL 16 | Relational database |
| Selenium WebDriver | DOM extraction and test execution |
| WebSocket (`ws`) | Live log streaming |
| Google Gemini API | AI test case generation |

### Infrastructure

| Technology | Role |
|---|---|
| Docker + Docker Compose | Containerised PostgreSQL |
| Katalon Runtime Engine | Groovy/Selenium suite execution |
| Playwright | Automated screenshot generation |

---

## Installation

### Prerequisites

Install **all** of the following tools before running the project.

**1. Node.js (v18 or higher)**

```bash
node --version   # e.g. v20.x.x
npm --version    # e.g. 10.x.x
```

Download: https://nodejs.org/

**2. Docker Desktop** (for PostgreSQL via Docker)

```bash
docker --version
docker compose version
```

Download: https://www.docker.com/products/docker-desktop/

> **Alternative:** If you prefer a local PostgreSQL installation, see [Manual PostgreSQL Setup](#option-b--manual-postgresql-setup).

**3. Google Chrome** (for Selenium)

The Selenium WebDriver routes (`/api/extract`, `/api/spy/*`, `/api/run-test`) require a locally installed Chrome browser.

**4. ChromeDriver**

ChromeDriver must match your installed Chrome version.

```bash
chromedriver --version
```

Download: https://googlechromelabs.github.io/chrome-for-testing/

Add the `chromedriver` executable to your system `PATH`.

**5. Google Gemini API Key**

Required for AI test generation. Set this in `backend/.env` (see [Environment Setup](#environment-setup)).

Get one at: https://aistudio.google.com/app/apikey

---

### Environment Setup

**1. Clone the repository**

```bash
git clone <repository-url>
cd Yetiforce-GUI
```

**2. Configure backend environment variables**

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` and fill in your values:

```env
PORT=5000
GEMINI_API_KEY=your_gemini_api_key_here
KATALON_API_KEY=your_katalon_api_key_here
KATALON_EXECUTABLE_PATH=C:\path\to\katalonc.exe

POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5432
POSTGRES_DB=yetiforce_gui
POSTGRES_USER=yetiforce
POSTGRES_PASSWORD=yetiforce_pwd
POSTGRES_SSL=false
```

> **Katalon API Key:** Log in to [katalon.com](https://katalon.com) → avatar (top right) → **Katalon API Key** → Generate Key.

**3. Install dependencies**

```bash
# Backend
cd backend && npm install

# Frontend
cd frontend && npm install
```

---

## Running the Project

### Option A — Docker (Recommended)

Spins up PostgreSQL 16 pre-initialized from `backend/db/init/`.

```bash
# From project root
docker compose up -d

# Verify
docker compose ps    # yetiforce_postgres should be healthy

# Stop
docker compose down

# Full reset (deletes all data)
docker compose down -v
```

### Option B — Manual PostgreSQL Setup

1. Install PostgreSQL 14+ from: https://www.postgresql.org/download/
2. Create the database and user:

```sql
CREATE USER yetiforce WITH PASSWORD 'yetiforce_pwd';
CREATE DATABASE yetiforce_gui OWNER yetiforce;
```

3. Run migrations in order:

```bash
psql -U yetiforce -d yetiforce_gui -f backend/db/init/001_create_projects.sql
psql -U yetiforce -d yetiforce_gui -f backend/db/init/002_create_test_suites.sql
psql -U yetiforce -d yetiforce_gui -f backend/db/init/003_create_test_cases.sql
psql -U yetiforce -d yetiforce_gui -f backend/db/init/004_unique_project_name.sql
```

4. Update `backend/.env` to point to your local host.

### Starting Frontend & Backend

You need **two terminal windows** running simultaneously.

**Terminal 1 — Backend**

```bash
cd backend
npm run dev    # development (auto-restart)
# OR
npm start      # production
```

Backend starts at: **http://localhost:5000**

**Terminal 2 — Frontend**

```bash
cd frontend
npm run dev
```

Frontend starts at: **http://localhost:5173**

---

## AI Workflow

The **AI QA Studio** automates test case authoring in three steps:

1. **URL Scan** — Enter a target URL; the backend launches Chrome via Selenium and extracts all interactive DOM elements.
2. **AI Generation** — The extracted DOM is sent to Google Gemini, which returns structured test cases with steps, expected results, and locators.
3. **Review & Save** — The generated test cases appear in the UI for review. Approve and save them directly to the selected project.

The generated cases follow the same schema as manually authored ones and can be linked to test suites immediately after saving.

---

## Testing Workflow

1. **Author** test cases manually in the Test Cases module, or generate them via AI QA Studio.
2. **Organise** test cases into a test suite and set the execution order.
3. **Run** the suite from the Run Engine tab — configure project path, browser, and OS.
4. **Monitor** execution in real time via the live log stream (WebSocket).
5. **Review** results on the Dashboard — pass/fail rates, duration trends, per-suite breakdown.

---

## UML Diagrams

Full UML documentation is available in [`docs/uml/`](docs/uml/).

### Use Case Diagrams

| Diagram | File |
|---|---|
| General Overview | [UC_00_General_Overview.png](docs/uml/usecase/UC_00_General_Overview.png) |
| Project Management | [UC_01_Project_Management.png](docs/uml/usecase/UC_01_Project_Management.png) |
| Test Suite Management | [UC_02_Test_Suite_Management.png](docs/uml/usecase/UC_02_Test_Suite_Management.png) |
| Test Case Management | [UC_03_Test_Case_Management.png](docs/uml/usecase/UC_03_Test_Case_Management.png) |
| AI QA Studio | [UC_04_AI_QA_Studio.png](docs/uml/usecase/UC_04_AI_QA_Studio.png) |
| Run Engine Execution | [UC_05_Run_Engine_Execution.png](docs/uml/usecase/UC_05_Run_Engine_Execution.png) |
| Reporting Dashboard | [UC_06_Reporting_Dashboard.png](docs/uml/usecase/UC_06_Reporting_Dashboard.png) |

### Sequence Diagrams (Key Flows)

| Diagram | File |
|---|---|
| Login | [SD_01_Login.png](docs/uml/sequence/SD_01_Login.png) |
| Create Project | [SD_02_Create_Project.png](docs/uml/sequence/SD_02_Create_Project.png) |
| Create Test Case | [SD_04_Create_Test_Case.png](docs/uml/sequence/SD_04_Create_Test_Case.png) |
| AI QA Studio Workflow | [SD_07_AI_QA_Studio_Workflow.png](docs/uml/sequence/SD_07_AI_QA_Studio_Workflow.png) |
| Execute Test Suite | [SD_10_Execute_Test_Suite.png](docs/uml/sequence/SD_10_Execute_Test_Suite.png) |
| Dashboard / Run Engine Nav | [SD_12_Dashboard_View_Report.png](docs/uml/sequence/SD_12_Dashboard_View_Report.png) |

### Class & ERD Diagrams

| Diagram | File |
|---|---|
| Class Diagram | [CD_01_Class_Diagram.png](docs/uml/class/CD_01_Class_Diagram.png) |
| Database ERD | [ERD_01_Database_Design.png](docs/uml/erd/ERD_01_Database_Design.png) |

---

## Folder Structure

```
backend/
├── src/
│   ├── server.js              # Entry point
│   ├── config/env.js          # Environment variable defaults
│   ├── routes/api.routes.js   # All API route definitions
│   ├── controllers/           # Request handlers
│   ├── modules/               # Business logic (projects, test suites, etc.)
│   ├── services/              # AI generation services (Gemini)
│   ├── repositories/          # Database access layer
│   └── websocket/             # WebSocket server
├── db/init/                   # SQL migration files (auto-run by Docker)
├── object_repository/         # Runtime: Katalon object files (gitignored)
├── test_suites/               # Runtime: test suite data (gitignored)
├── reports/                   # Runtime: test reports (gitignored)
├── tmp_tests/                 # Runtime: temporary test scripts (gitignored)
├── .env.example               # Template for environment variables
└── package.json

frontend/
├── src/
│   ├── main.jsx               # Entry point
│   ├── app/App.jsx            # Main application component
│   └── config/endpoints.js    # Backend URL configuration
├── index.html
└── package.json

docs/
├── uml/                       # PlantUML source files and rendered diagrams
└── screenshots/               # Playwright-generated UI screenshots
```

---

## Configuration Reference

| Variable | Default | Description |
|---|---|---|
| `PORT` | `5000` | Backend server port |
| `GEMINI_API_KEY` | *(required)* | Google Gemini API key for AI features |
| `KATALON_API_KEY` | *(required for Run Engine)* | Katalon API key for KRE online activation |
| `KATALON_EXECUTABLE_PATH` | `katalonc` | Full path to `katalonc.exe` |
| `POSTGRES_HOST` | `127.0.0.1` | PostgreSQL host |
| `POSTGRES_PORT` | `5432` | PostgreSQL port |
| `POSTGRES_DB` | `yetiforce_gui` | Database name |
| `POSTGRES_USER` | `yetiforce` | Database user |
| `POSTGRES_PASSWORD` | `yetiforce_pwd` | Database password |
| `POSTGRES_SSL` | `false` | Enable SSL for DB connection |

> **Frontend URLs** are configured in `frontend/src/config/endpoints.js`. If you change the backend port, update `BACKEND_URL` and `WS_URL` there as well.

---

## Katalon Run Engine Setup

The **Run Engine** tab executes Katalon test suites directly from the UI using Katalon Runtime Engine (KRE).

### Step 1 — Install Katalon Studio

Download and install from [katalon.com](https://katalon.com/katalon-studio).

> Katalon Studio ships with `katalonc.exe` built-in — no separate KRE download is needed.

### Step 2 — Find katalonc.exe

Run the following in PowerShell to locate `katalonc.exe`:

```powershell
Get-ChildItem "$env:USERPROFILE\.katalon" -Recurse -Filter "katalonc.exe" -ErrorAction SilentlyContinue
```

Typical output:

```
Directory: C:\Users\<you>\.katalon\packages\KS-11.1.3

Mode    LastWriteTime    Length  Name
----    -------------    ------  ----
-a----  ...              252464  katalonc.exe
```

Copy the full path (e.g. `C:\Users\<you>\.katalon\packages\KS-11.1.3\katalonc.exe`).

### Step 3 — Set environment variables

Add both values to `backend/.env`:

```env
KATALON_API_KEY=your-katalon-api-key-here
KATALON_EXECUTABLE_PATH=C:\Users\<you>\.katalon\packages\KS-11.1.3\katalonc.exe
```

### Step 4 — Run a test suite

In the **Run Engine** tab, click **Tạo Execution mới** and fill in:

| Field | Required | Example |
|---|---|---|
| **Project Path** | Yes | `C:\Users\you\Katalon Studio\MyProject` |
| **Test Suite Path** | Yes | `Test Suites/LoginSuite` |
| **Browser** | Optional | Chrome (default) |
| **Katalon CLI Path** | Optional | Leave blank — uses `KATALON_EXECUTABLE_PATH` from `.env` |
| **Katalon API Key** | Optional | Leave blank — uses `KATALON_API_KEY` from `.env` |

### Common Errors

| Error | Cause | Fix |
|---|---|---|
| `'katalonc' is not recognized` | `KATALON_EXECUTABLE_PATH` not set | Complete Steps 2–3 |
| `The system cannot find the path specified` | Path in env var is wrong | Re-run the PowerShell command in Step 2 |
| `Activation failed: No Offline License` | `KATALON_API_KEY` missing or invalid | Check Step 3 |
| `KRE exit code: 2` | Caused by one of the two errors above | Fix the relevant env var |

---

## Useful Commands

### Frontend

```bash
cd frontend
npm run dev         # Start dev server (hot reload)
npm run lint        # Run ESLint
npm run build       # Build for production
npm run preview     # Preview production build locally
npm run screenshots # Regenerate UI screenshots via Playwright
```

### Backend

```bash
cd backend
npm run dev   # Start with auto-restart (watch mode)
npm start     # Start without watch mode
```

### Docker

```bash
# From project root
docker compose up -d           # Start PostgreSQL in background
docker compose down            # Stop containers
docker compose down -v         # Stop and delete all data (full reset)
docker compose logs postgres   # View database logs
```

---

## Notes & Gotchas

- **ChromeDriver version must match Chrome** — mismatch will cause Selenium errors on test-run routes.
- **`GEMINI_API_KEY` is required** for the AI test generation endpoint (`/api/generate-script`). The backend will start without it, but AI features will fail at runtime.
- **`KATALON_API_KEY` is required** for the Run Engine. The backend will start without it, but KRE will exit with code 2 (`Activation failed`) on every execution.
- **User-facing text and logs are in Vietnamese** — this is intentional.
- **Do not commit runtime artifacts** — `backend/object_repository/`, `backend/test_suites/`, `backend/reports/`, and `backend/tmp_tests/` are listed in `.gitignore`.
- **`npm test` in backend always exits 1** — it is a placeholder and not implemented.
- **Database is auto-initialized by Docker** — SQL files in `backend/db/init/` run automatically on first start. Resetting the volume (`docker compose down -v`) deletes all data; the schema is re-created on next `docker compose up`.

---

## UI Screenshots

See detailed screenshots grouped by module:

- [UI Showcase](docs/screenshots.md)

---
