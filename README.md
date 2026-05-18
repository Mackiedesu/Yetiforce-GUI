# QA-Studio-For-Yetiforce-UI-Testing

An AI-powered GUI platform for managing and automating tests with Katalon integration. The platform allows importing Katalon projects, managing test suites/cases, running Selenium-based tests, and generating Groovy automation scripts via Google Gemini AI.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Project Structure](#project-structure)
- [Environment Setup](#environment-setup)
- [Running the Project](#running-the-project)
  - [Option A – Docker (Recommended for Database)](#option-a--docker-recommended-for-database)
  - [Option B – Manual PostgreSQL Setup](#option-b--manual-postgresql-setup)
- [Running Frontend & Backend](#running-frontend--backend)
- [Configuration Reference](#configuration-reference)
- [Katalon Run Engine Setup](#katalon-run-engine-setup)
- [Useful Commands](#useful-commands)
- [Notes & Gotchas](#notes--gotchas)

---

## Architecture Overview

```
Yetiforce-GUI/
├── frontend/        # React + Vite (port 5173)
├── backend/         # Express + PostgreSQL + Selenium/WebSocket (port 5000)
├── docker-compose.yml
└── README.md
```

- **Frontend** communicates with the backend at `http://localhost:5000` and `ws://localhost:5000/ws` (hardcoded in `frontend/src/config/endpoints.js`).
- **Backend** serves REST APIs and WebSocket connections, manages the PostgreSQL database, and drives Chrome via Selenium WebDriver.

---

## Prerequisites

Install **all** of the following tools before running the project.

### 1. Node.js (v18 or higher)

Download from: https://nodejs.org/

Verify:
```bash
node --version   # e.g. v20.x.x
npm --version    # e.g. 10.x.x
```

### 2. Docker Desktop (for PostgreSQL via Docker)

Download from: https://www.docker.com/products/docker-desktop/

Verify:
```bash
docker --version
docker compose version
```

> **Alternative:** If you prefer a local PostgreSQL installation instead of Docker, see [Option B](#option-b--manual-postgresql-setup).

### 3. Google Chrome (for Selenium)

Download from: https://www.google.com/chrome/

The Selenium WebDriver routes (`/api/extract`, `/api/spy/*`, `/api/run-test`) require a locally installed Chrome browser.

### 4. ChromeDriver

ChromeDriver must match your installed Chrome version.

- Download from: https://googlechromelabs.github.io/chrome-for-testing/
- Add the `chromedriver` executable to your system `PATH`.

Verify:
```bash
chromedriver --version
```

### 5. Google Gemini API Key

The AI test generation feature requires a Gemini API key.

- Get one at: https://aistudio.google.com/app/apikey
- You will set this in the backend `.env` file (see [Environment Setup](#environment-setup)).

---

## Project Structure

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
│   └── config/endpoints.js   # Backend URL configuration
├── index.html
└── package.json
```

---

## Environment Setup

### 1. Clone the repository

```bash
git clone <repository-url>
cd Yetiforce-GUI
```

### 2. Configure backend environment variables

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` and fill in your values:

```env
PORT=5000
GEMINI_API_KEY=your_gemini_api_key_here                   # Required for AI test generation
KATALON_API_KEY=your_katalon_api_key_here                 # Required for Katalon Run Engine
KATALON_EXECUTABLE_PATH=C:\path\to\katalonc.exe           # Optional: pre-configure so users skip the path field

POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5432
POSTGRES_DB=yetiforce_gui
POSTGRES_USER=yetiforce
POSTGRES_PASSWORD=yetiforce_pwd
POSTGRES_SSL=false
```

> **Getting your Katalon API Key:** Log in to [katalon.com](https://katalon.com) → click your avatar (top right) → **Katalon API Key** → **Generate Key**.

### 3. Install dependencies

**Backend:**
```bash
cd backend
npm install
```

**Frontend:**
```bash
cd frontend
npm install
```

---

## Running the Project

### Option A – Docker (Recommended for Database)

This spins up a PostgreSQL 16 container with the database pre-initialized from the SQL migration files in `backend/db/init/`.

**From the project root:**
```bash
docker compose up -d
```

Verify the container is healthy:
```bash
docker compose ps
```

You should see `yetiforce_postgres` with status `healthy`.

To stop the database:
```bash
docker compose down
```

To stop and remove all data (full reset):
```bash
docker compose down -v
```

---

### Option B – Manual PostgreSQL Setup

If you prefer a local PostgreSQL installation:

1. Install PostgreSQL 14+ from: https://www.postgresql.org/download/
2. Create the database and user:

```sql
CREATE USER yetiforce WITH PASSWORD 'yetiforce_pwd';
CREATE DATABASE yetiforce_gui OWNER yetiforce;
```

3. Run the migration scripts in order:

```bash
psql -U yetiforce -d yetiforce_gui -f backend/db/init/001_create_projects.sql
psql -U yetiforce -d yetiforce_gui -f backend/db/init/002_create_test_suites.sql
psql -U yetiforce -d yetiforce_gui -f backend/db/init/003_create_test_cases.sql
psql -U yetiforce -d yetiforce_gui -f backend/db/init/004_unique_project_name.sql
```

4. Update `backend/.env` to point to your local PostgreSQL host.

---

## Running Frontend & Backend

You need **two terminal windows** running simultaneously.

### Terminal 1 – Backend

```bash
cd backend

# Development mode (auto-restarts on file changes):
npm run dev

# OR production mode:
npm start
```

The backend will start at: **http://localhost:5000**

### Terminal 2 – Frontend

```bash
cd frontend
npm run dev
```

The frontend will start at: **http://localhost:5173**

Open your browser and navigate to `http://localhost:5173`.

---

## Configuration Reference

| Variable | Default | Description |
|---|---|---|
| `PORT` | `5000` | Backend server port |
| `GEMINI_API_KEY` | *(required)* | Google Gemini API key for AI features |
| `KATALON_API_KEY` | *(required for Run Engine)* | Katalon API key for KRE online activation. Get it at katalon.com → Profile → API Keys |
| `KATALON_EXECUTABLE_PATH` | `katalonc` | Full path to `katalonc.exe`. Set this so users never need to enter it in the UI |
| `POSTGRES_HOST` | `127.0.0.1` | PostgreSQL host |
| `POSTGRES_PORT` | `5432` | PostgreSQL port |
| `POSTGRES_DB` | `yetiforce_gui` | Database name |
| `POSTGRES_USER` | `yetiforce` | Database user |
| `POSTGRES_PASSWORD` | `yetiforce_pwd` | Database password |
| `POSTGRES_SSL` | `false` | Enable SSL for DB connection |

> **Frontend URLs** are hardcoded in `frontend/src/config/endpoints.js`. If you change the backend port, update `BACKEND_URL` and `WS_URL` there as well.

---

## Useful Commands

### Frontend

```bash
cd frontend
npm run dev       # Start dev server (hot reload)
npm run lint      # Run ESLint
npm run build     # Build for production
npm run preview   # Preview production build locally
```

### Backend

```bash
cd backend
npm run dev       # Start with auto-restart (watch mode)
npm start         # Start without watch mode
```

### Docker

```bash
# From project root
docker compose up -d          # Start PostgreSQL in background
docker compose down           # Stop containers
docker compose down -v        # Stop and delete all data (full reset)
docker compose logs postgres  # View database logs
```

---

## Katalon Run Engine Setup

The **Run Engine** tab lets you execute Katalon test suites directly from the website using Katalon Runtime Engine (KRE).

### Step 1 — Install Katalon Studio

Download and run the **Katalon Studio** installer (`KatalonSetup.exe`) from [katalon.com](https://katalon.com/katalon-studio).

> Katalon Studio ships with `katalonc.exe` built-in — you do **not** need to download a separate KRE package.

### Step 2 — Find katalonc.exe

After installation, Katalon Studio auto-downloads its runtime packages into the user home directory. Run the following in PowerShell to locate `katalonc.exe`:

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

Copy the full directory path shown (e.g. `C:\Users\<you>\.katalon\packages\KS-11.1.3\katalonc.exe`).

### Step 3 — Set environment variables

Add both values to `backend/.env`:

```env
KATALON_API_KEY=your-katalon-api-key-here
KATALON_EXECUTABLE_PATH=C:\Users\<you>\.katalon\packages\KS-11.1.3\katalonc.exe
```

- **`KATALON_API_KEY`** — get it from [katalon.com](https://katalon.com) → avatar → **Katalon API Key** → Generate.
- **`KATALON_EXECUTABLE_PATH`** — the full path found in Step 2.

With both values set, the **Run Engine** form only requires **Project Path** and **Test Suite Path** — all other fields have server-side defaults.

### Step 4 — Run a test suite

In the **Run Engine** tab, click **Tạo Execution mới** and fill in:

| Field | Required | Example |
|---|---|---|
| **Project Path** | ✅ | `C:\Users\you\Katalon Studio\MyProject` |
| **Test Suite Path** | ✅ | `Test Suites/LoginSuite` |
| **Browser** | optional | Chrome (default) |
| **Đường dẫn Katalon CLI** | optional | Leave blank — uses `KATALON_EXECUTABLE_PATH` from `.env` |
| **Katalon API Key** | optional | Leave blank — uses `KATALON_API_KEY` from `.env` |

### Common errors

| Error | Cause | Fix |
|---|---|---|
| `'katalonc' is not recognized` | `KATALON_EXECUTABLE_PATH` not set in `.env` and field left blank | Complete Step 2–3 above |
| `The system cannot find the path specified` | Path in `KATALON_EXECUTABLE_PATH` is wrong | Re-run the PowerShell command in Step 2 |
| `Activation failed: No Offline License` | `KATALON_API_KEY` missing or invalid | Check Step 3 |
| `KRE exit code: 2` | Always caused by one of the two errors above | Fix the relevant env var |

---

## Notes & Gotchas

- **ChromeDriver version must match Chrome** — mismatch will cause Selenium errors on test-run routes.
- **`GEMINI_API_KEY` is required** for the AI test generation endpoint (`/api/generate-script`). The backend will start without it, but AI features will fail at runtime.
- **`KATALON_API_KEY` is required** for the Run Engine feature. The backend will start without it, but KRE will exit with code 2 (`Activation failed`) on every execution.
- **User-facing text and logs are in Vietnamese** — this is intentional; do not change unless explicitly requested.
- **Do not commit runtime artifacts** — `backend/object_repository/`, `backend/test_suites/`, `backend/reports/`, and `backend/tmp_tests/` are listed in `.gitignore`.
- **`npm test` in backend always exits 1** — it is a placeholder and not implemented.
- **Database is auto-initialized by Docker** — the SQL files in `backend/db/init/` are executed automatically when the Docker container first starts. If you reset the volume (`docker compose down -v`), all data will be lost and the schema will be re-created on next `docker compose up`.
