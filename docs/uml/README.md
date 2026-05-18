# UML Documentation — QA Studio Platform

> **Version:** 4.0 · **Last updated:** 2026-05-15
> Diagrams follow standard academic UML modeling conventions (Boundary/Control/Entity for sequence diagrams, clean business-level actors for use case diagrams).

---

## Folder Structure

```
docs/uml/
├── README.md                            ← this file
├── 00_use_case_list.md                  ← use case catalogue
├── plantuml.jar                         ← local PlantUML renderer
│
├── class/                               ← UML class diagrams
│   └── CD_01_class_diagram.puml         ← full domain class model
│
├── erd/                                 ← database ERD diagrams
│   └── ERD_01_database_design.puml      ← full database schema
│
├── usecase/                             ← use case diagrams
│   ├── UC_00_general_overview.puml      ← system overview
│   ├── UC_01_project_management.puml    ← project operations
│   ├── UC_02_test_suite_management.puml ← suite operations
│   ├── UC_03_test_case_management.puml  ← test case operations
│   ├── UC_04_ai_qa_studio.puml          ← AI generation workflow
│   ├── UC_05_run_engine_execution.puml  ← execution and monitoring
│   └── UC_06_reporting_dashboard.puml   ← reporting and dashboard
│
├── sequence/                            ← sequence diagrams (BCE style)
│   ├── SD_01_login.puml
│   ├── SD_02_create_project.puml
│   ├── SD_03_generate_katalon_project.puml
│   ├── SD_04_create_test_case.puml
│   ├── SD_05_create_test_suite.puml
│   ├── SD_06_link_testcase_suite.puml
│   ├── SD_07_ai_qa_studio_workflow.puml
│   ├── SD_08_url_scan_dom_extraction.puml
│   ├── SD_09_ai_test_generation.puml
│   ├── SD_10_execute_test_suite.puml
│   ├── SD_11_parse_execution_report.puml
│   ├── SD_12_dashboard_run_engine_nav.puml
│   ├── SD_13_save_files_to_katalon.puml
│   ├── SD_14_recursive_suite_scan.puml
│   └── SD_15_import_katalon_project.puml ← Import Mocha Engine project
│
└── activity/                            ← activity diagrams (swimlane style)
    ├── ACT_01_login.puml
    ├── ACT_02_create_project.puml
    ├── ACT_03_create_test_case.puml
    ├── ACT_04_ai_generate_test_cases.puml
    ├── ACT_05_execute_test_suite.puml
    ├── ACT_06_view_report.puml
    └── ACT_07_create_test_suite.puml     ← create and manage test suite
```

---

## Rendering PlantUML

### Option 1 — VS Code Extension (recommended)
Install **PlantUML** by `jebbs`. Open any `.puml` file and press `Alt+D` to preview.

### Option 2 — Online Renderer
Paste diagram content at: https://www.plantuml.com/plantuml/uml/

### Option 3 — Local JAR
```bash
java -jar docs/uml/plantuml.jar docs/uml/usecase/UC_00_general_overview.puml
```

### Batch render all diagrams
```bash
java -jar docs/uml/plantuml.jar docs/uml/class/*.puml
java -jar docs/uml/plantuml.jar docs/uml/erd/*.puml
java -jar docs/uml/plantuml.jar docs/uml/usecase/*.puml
java -jar docs/uml/plantuml.jar docs/uml/sequence/*.puml
java -jar docs/uml/plantuml.jar docs/uml/activity/*.puml
```

### Export as SVG (recommended for thesis/reports)
```bash
java -jar docs/uml/plantuml.jar docs/uml/class/*.puml -tsvg -o ./output
java -jar docs/uml/plantuml.jar docs/uml/erd/*.puml -tsvg -o ./output
```

---

## Class Diagram Index

| File | Coverage |
|---|---|
| `class/CD_01_class_diagram.puml` | Full domain class model — User, Project, TestSuite, TestCase, Steps, DataSets, ExecutionRun, Logs, AI generation |

---

## Database ERD Index

| File | Coverage |
|---|---|
| `erd/ERD_01_database_design.puml` | Complete PostgreSQL schema — all tables, PKs, FKs, cardinality relationships |

---

## Use Case Diagram Index

| File | Coverage |
|---|---|
| `UC_00_general_overview.puml` | System-level overview of all modules |
| `UC_01_project_management.puml` | Create, generate, import, update, delete projects |
| `UC_02_test_suite_management.puml` | Suite CRUD, test case linking, suite discovery |
| `UC_03_test_case_management.puml` | Test case CRUD, steps, data sets, suite linking |
| `UC_04_ai_qa_studio.puml` | URL scan, text describe, AI generation, save workflow |
| `UC_05_run_engine_execution.puml` | Configure, execute, monitor, view history |
| `UC_06_reporting_dashboard.puml` | Dashboard stats, charts, execution history, run detail |

**Actors used in Use Case Diagrams:**

| Actor | Role |
|---|---|
| **QA Engineer** | Primary human user of the platform |
| **AI Service** | Generates test cases from DOM or text input |
| **Mocha + Playwright** | Executes test suites via Node.js |

---

## Sequence Diagram Index

All sequence diagrams use **Boundary / Control / Entity** lifeline style.

| File | Flow Covered |
|---|---|
| `SD_01_login.puml` | User login and session creation |
| `SD_02_create_project.puml` | Create project with duplicate name check |
| `SD_03_generate_katalon_project.puml` | Generate Mocha + Playwright project folder structure on disk |
| `SD_04_create_test_case.puml` | Create test case with file sync and suite linking |
| `SD_05_create_test_suite.puml` | Create test suite with file sync |
| `SD_06_link_testcase_suite.puml` | Link existing test case to suite and sync file |
| `SD_07_ai_qa_studio_workflow.puml` | Full AI Studio workflow (URL/text → save) |
| `SD_08_url_scan_dom_extraction.puml` | Scan URL and extract page elements |
| `SD_09_ai_test_generation.puml` | AI test case generation with retry logic |
| `SD_10_execute_test_suite.puml` | Execute test suite and stream live output |
| `SD_11_parse_execution_report.puml` | Parse Mochawesome JSON report after execution |
| `SD_12_dashboard_run_engine_nav.puml` | Dashboard View Report navigation flow |
| `SD_13_save_files_to_katalon.puml` | Write Playwright spec files to disk |
| `SD_14_recursive_suite_scan.puml` | Recursive scan of test suite folder tree |
| `SD_15_import_katalon_project.puml` | Import and validate existing Mocha Engine project |

---

## Activity Diagram Index

All activity diagrams use swimlane notation.

| File | Workflow Covered |
|---|---|
| `ACT_01_login.puml` | User login workflow |
| `ACT_02_create_project.puml` | Create or import a project |
| `ACT_03_create_test_case.puml` | Define and save a test case |
| `ACT_04_ai_generate_test_cases.puml` | AI-assisted test case generation |
| `ACT_05_execute_test_suite.puml` | Configure and run a test suite |
| `ACT_06_view_report.puml` | View and navigate execution reports |
| `ACT_07_create_test_suite.puml` | Create suite, link test cases, set execution order, sync to disk |

---

## UML Style Guide

### Use Case Diagrams
- `left to right direction`
- Actors: **QA Engineer**, **AI Service**, **Mocha + Playwright** only
- No technical actors (no database, no backend, no file system)
- One diagram per module
- Use `<<include>>` and `<<extend>>` for relationships

### Sequence Diagrams
- Lifelines follow **Boundary / Control / Entity** pattern
- Boundary: screens and forms
- Control: controllers handling business logic
- Entity: data entities and external services
- Use `alt`, `opt`, `loop` blocks for conditional and repetitive flows
- Success and failure paths shown with `alt`

### Activity Diagrams
- Swimlanes separate: QA Engineer, System, AI Service, Mocha + Playwright
- Top-to-bottom flow
- Business-focused decision points
- No technical implementation details
