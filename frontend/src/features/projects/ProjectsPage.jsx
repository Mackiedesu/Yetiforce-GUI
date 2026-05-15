import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Database,
  Download,
  FolderOpen,
  FolderPlus,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import PathPickerInput from '../../components/PathPickerInput';

import {
  createProject,
  deleteProject,
  generateProject,
  getProjectStructure,
  importProject,
  listProjects,
  updateProject,
} from './projects.api';

// ────────────────────────────────────────────────────────────────────────────
// Form defaults
// ────────────────────────────────────────────────────────────────────────────

const EMPTY_GENERATE_FORM = {
  name: '',
  description: '',
  save_directory: '',
};

const EMPTY_IMPORT_FORM = {
  name: '',
  description: '',
  katalon_project_path: '',
};

const EMPTY_ERRORS = {};

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function extractErrorMessage(error) {
  return (
    error?.response?.data?.error ||
    error?.message ||
    'Có lỗi không xác định xảy ra'
  );
}

function isAbsolutePath(value) {
  const v = (value || '').trim();
  if (/^[a-zA-Z]:[/\\]/.test(v)) return true;
  if (v.startsWith('/')) return true;
  return false;
}

function validateGenerateForm(form) {
  const errors = {};
  if (!form.name.trim()) {
    errors.name = 'Tên project là bắt buộc';
  } else if (form.name.trim().length > 100) {
    errors.name = 'Tên project không được vượt quá 100 ký tự';
  } else if (/[<>:"/\\|?*]/.test(form.name.trim())) {
    errors.name = 'Tên không được chứa ký tự đặc biệt: < > : " / \\ | ? *';
  }

  if (!form.save_directory.trim()) {
    errors.save_directory = 'Thư mục lưu project là bắt buộc';
  } else if (!isAbsolutePath(form.save_directory)) {
    errors.save_directory =
      'Đường dẫn không hợp lệ. Nhập đường dẫn tuyệt đối, ví dụ: D:\\Projects';
  }
  return errors;
}

function validateImportForm(form) {
  const errors = {};
  if (!form.name.trim()) {
    errors.name = 'Tên project là bắt buộc';
  } else if (form.name.trim().length > 100) {
    errors.name = 'Tên project không được vượt quá 100 ký tự';
  }

  if (!form.katalon_project_path.trim()) {
    errors.katalon_project_path = 'Đường dẫn project là bắt buộc';
  } else if (!isAbsolutePath(form.katalon_project_path)) {
    errors.katalon_project_path =
      'Đường dẫn không hợp lệ. Nhập đường dẫn tuyệt đối, ví dụ: D:\\Projects\\MyProject';
  }
  return errors;
}

function hasErrors(errors) {
  return Object.values(errors).some(Boolean);
}

// ────────────────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────────────────

function FieldError({ msg }) {
  if (!msg) return null;
  return <span className="field-error-msg">{msg}</span>;
}

function ScaffoldResult({ result }) {
  if (!result) return null;
  return (
    <div className="scaffold-result">
      <div className="scaffold-result-header">
        <CheckCircle2 size={16} style={{ color: 'var(--success-color)' }} />
        <strong>Tạo project thành công!</strong>
      </div>
      <div className="scaffold-result-body">
        <div className="scaffold-stat">
          <span className="scaffold-stat-label">Vị trí:</span>
          <code className="scaffold-stat-value">{result.katalon_project_path}</code>
        </div>
        <div className="scaffold-stats-row">
          <span className="scaffold-badge">
            <FolderOpen size={12} /> {result.scaffold?.folders_created ?? '—'} thư mục
          </span>
          <span className="scaffold-badge">
            📄 {result.scaffold?.files_created ?? '—'} file
          </span>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────────────────────

const ProjectsPage = ({ addLog }) => {
  // ── List state ─────────────────────────────────────────────────────────────
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [selectedStructure, setSelectedStructure] = useState(null);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingStructure, setLoadingStructure] = useState(false);

  // ── Mode: 'generate' | 'import' | 'edit' ──────────────────────────────────
  const [mode, setMode] = useState('generate'); // default to the new "generate" flow

  // ── Generate form ──────────────────────────────────────────────────────────
  const [genForm, setGenForm] = useState(EMPTY_GENERATE_FORM);
  const [genErrors, setGenErrors] = useState(EMPTY_ERRORS);
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState(null);

  // ── Import form ────────────────────────────────────────────────────────────
  const [impForm, setImpForm] = useState(EMPTY_IMPORT_FORM);
  const [impErrors, setImpErrors] = useState(EMPTY_ERRORS);
  const [importing, setImporting] = useState(false);

  // ── Edit form (shared with update) ────────────────────────────────────────
  const [editForm, setEditForm] = useState(EMPTY_IMPORT_FORM);
  const [editErrors, setEditErrors] = useState(EMPTY_ERRORS);

  // ── API-level error banner ─────────────────────────────────────────────────
  const [apiError, setApiError] = useState('');

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) || null,
    [projects, selectedProjectId]
  );

  // ── Load project list ──────────────────────────────────────────────────────
  const refreshProjects = useCallback(async () => {
    setLoadingProjects(true);
    try {
      const data = await listProjects();
      setProjects(data.projects || []);
    } catch (error) {
      addLog(`Lỗi tải danh sách project: ${extractErrorMessage(error)}`, 'error');
    } finally {
      setLoadingProjects(false);
    }
  }, [addLog]);

  useEffect(() => {
    const timer = setTimeout(refreshProjects, 0);
    return () => clearTimeout(timer);
  }, [refreshProjects]);

  // ── Load structure for selected project ────────────────────────────────────
  async function fetchStructure(projectId) {
    setLoadingStructure(true);
    try {
      const data = await getProjectStructure(projectId);
      setSelectedStructure(data.structure || null);
    } catch (error) {
      setSelectedStructure(null);
      addLog(`Không thể đọc cấu trúc project: ${extractErrorMessage(error)}`, 'error');
    } finally {
      setLoadingStructure(false);
    }
  }

  // ── Select a project from the list → switch to edit mode ──────────────────
  function onSelectProject(project) {
    setSelectedProjectId(project.id);
    setEditForm({
      name: project.name || '',
      description: project.description || '',
      katalon_project_path: project.katalon_project_path || '',
    });
    setEditErrors(EMPTY_ERRORS);
    setApiError('');
    setMode('edit');
    setGenResult(null);
    fetchStructure(project.id);
  }

  // ── Reset to "Generate new" form ──────────────────────────────────────────
  function startNew() {
    setSelectedProjectId(null);
    setSelectedStructure(null);
    setGenForm(EMPTY_GENERATE_FORM);
    setGenErrors(EMPTY_ERRORS);
    setImpForm(EMPTY_IMPORT_FORM);
    setImpErrors(EMPTY_ERRORS);
    setApiError('');
    setGenResult(null);
    setMode('generate');
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Actions
  // ────────────────────────────────────────────────────────────────────────────

  async function handleGenerate() {
    const errors = validateGenerateForm(genForm);
    setGenErrors(errors);
    if (hasErrors(errors)) return;

    setApiError('');
    setGenerating(true);
    setGenResult(null);
    try {
      const data = await generateProject(genForm);
      setGenResult(data);
      addLog(
        `✅ Tạo project thành công: ${data.project.name} → ${data.katalon_project_path}`,
        'success'
      );
      await refreshProjects();
      onSelectProject(data.project);
    } catch (error) {
      const msg = extractErrorMessage(error);
      setApiError(msg);
      addLog(`Lỗi tạo project: ${msg}`, 'error');
    } finally {
      setGenerating(false);
    }
  }

  async function handleImport() {
    const errors = validateImportForm(impForm);
    setImpErrors(errors);
    if (hasErrors(errors)) return;

    setApiError('');
    setImporting(true);
    try {
      const data = await importProject(impForm);
      addLog(`Import thành công: ${data.project.name}`, 'success');
      await refreshProjects();
      onSelectProject(data.project);
      setSelectedStructure(data.structure || null);
    } catch (error) {
      const msg = extractErrorMessage(error);
      setApiError(msg);
      addLog(`Lỗi import project: ${msg}`, 'error');
    } finally {
      setImporting(false);
    }
  }

  async function handleUpdate() {
    if (!selectedProjectId) return;
    const errors = validateImportForm(editForm);
    setEditErrors(errors);
    if (hasErrors(errors)) return;

    setApiError('');
    try {
      const data = await updateProject(selectedProjectId, editForm);
      addLog(`Đã cập nhật project: ${data.project.name}`, 'success');
      await refreshProjects();
      await fetchStructure(selectedProjectId);
    } catch (error) {
      const msg = extractErrorMessage(error);
      setApiError(msg);
      addLog(`Lỗi cập nhật project: ${msg}`, 'error');
    }
  }

  async function handleDelete() {
    if (!selectedProjectId) return;
    try {
      await deleteProject(selectedProjectId);
      addLog('Đã xóa project.', 'info');
      await refreshProjects();
      startNew();
    } catch (error) {
      addLog(`Lỗi xóa project: ${extractErrorMessage(error)}`, 'error');
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────────────────────

  return (
    <div className="object-repo-container">
      {/* Header */}
      <div className="object-repo-header">
        <div className="object-repo-title">
          <Layers size={20} />
          <h2>Projects</h2>
          <span className="obj-count-label">{projects.length} projects</span>
        </div>
        <div className="object-repo-actions">
          <button className="toolbar-btn" onClick={refreshProjects} disabled={loadingProjects}>
            <RefreshCw size={14} /> {loadingProjects ? 'Đang tải...' : 'Làm mới'}
          </button>
          <button className="toolbar-btn" onClick={startNew}>
            <Plus size={14} /> Project mới
          </button>
        </div>
      </div>

      <div className="object-repo-body">
        {/* ── Left: project list ─────────────────────────────────────────── */}
        <div className="object-list">
          <div className="object-list-header">
            <span>Danh sách Projects</span>
          </div>

          {projects.length === 0 ? (
            <div className="empty-state">
              <Database size={40} />
              <p>Chưa có project nào</p>
              <span>Tạo project mới hoặc import từ thư mục đã có</span>
            </div>
          ) : (
            <div className="object-items">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className={`object-item ${selectedProjectId === project.id ? 'selected' : ''}`}
                  onClick={() => onSelectProject(project)}
                >
                  <div className="object-item-icon">
                    <FolderOpen size={16} />
                  </div>
                  <div className="object-item-info">
                    <div className="object-item-name">{project.name}</div>
                    <div className="object-item-meta">
                      <span className="obj-tag-badge">
                        {new Date(project.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Right: detail panel ─────────────────────────────────────────── */}
        <div className="object-detail">
          <div className="object-detail-content">

            {/* ── Mode tabs (only when not editing) ──────────────────────── */}
            {mode !== 'edit' && (
              <div className="project-mode-tabs">
                <button
                  className={`project-mode-tab ${mode === 'generate' ? 'active' : ''}`}
                  onClick={() => { setMode('generate'); setApiError(''); }}
                >
                  <FolderPlus size={14} /> Tạo Project mới
                </button>
                <button
                  className={`project-mode-tab ${mode === 'import' ? 'active' : ''}`}
                  onClick={() => { setMode('import'); setApiError(''); }}
                >
                  <Download size={14} /> Import Project
                </button>
              </div>
            )}

            {/* ── Edit mode header ─────────────────────────────────────────── */}
            {mode === 'edit' && (
              <div className="object-detail-header">
                <h3>Cập nhật Project</h3>
                <div className="detail-header-actions">
                  <button className="toolbar-btn" onClick={startNew}>
                    <Plus size={14} /> Tạo mới
                  </button>
                  <button className="toolbar-btn delete-btn" onClick={handleDelete}>
                    <Trash2 size={14} /> Xóa
                  </button>
                </div>
              </div>
            )}

            {/* ── API error banner ─────────────────────────────────────────── */}
            {apiError && (
              <div className="ai-gen-error" style={{ marginBottom: 12, borderRadius: 8 }} role="alert">
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{apiError}</span>
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════
                GENERATE MODE — create Katalon structure from scratch
            ════════════════════════════════════════════════════════════ */}
            {mode === 'generate' && (
              <div className="detail-section">
                <div className="project-generate-banner">
                  <FolderPlus size={18} />
                  <div>
                    <strong>Tạo project mới</strong>
                    <p>Hệ thống sẽ tự động tạo cấu trúc thư mục và file cho Playwright + Mocha + Chai.</p>
                  </div>
                </div>

                {/* Name */}
                <div className="input-group">
                  <label>Tên Project <span className="kat-required">*</span></label>
                  <input
                    className={`input-field ${genErrors.name ? 'input-field--error' : ''}`}
                    value={genForm.name}
                    onChange={(e) => {
                      setGenForm((f) => ({ ...f, name: e.target.value }));
                      setGenErrors((er) => ({ ...er, name: '' }));
                      setApiError('');
                    }}
                    placeholder="VD: QA_Automation_Core"
                    maxLength={100}
                  />
                  <FieldError msg={genErrors.name} />
                </div>

                {/* Description */}
                <div className="input-group">
                  <label>Mô tả</label>
                  <textarea
                    className="input-field"
                    rows={2}
                    value={genForm.description}
                    onChange={(e) => setGenForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Mô tả project (tùy chọn)..."
                  />
                </div>

                {/* Save directory — with folder picker */}
                <PathPickerInput
                  id="project-save-dir"
                  label="Thư mục lưu Project"
                  required
                  type="directory"
                  value={genForm.save_directory}
                  onChange={(val) => {
                    setGenForm((f) => ({ ...f, save_directory: val }));
                    setGenErrors((er) => ({ ...er, save_directory: '' }));
                    setApiError('');
                  }}
                  placeholder="D:\Projects"
                  error={genErrors.save_directory}
                  hint={
                    genForm.name.trim()
                      ? `Project sẽ được tạo tại: ${genForm.save_directory.trim() || '…'}\\${genForm.name.trim()}`
                      : 'Chọn thư mục cha — project sẽ được tạo bên trong thư mục đó'
                  }
                />

                {/* Preview path */}
                {genForm.save_directory && genForm.name && (
                  <div className="project-path-preview">
                    <span className="path-preview-label">Đường dẫn sẽ tạo:</span>
                    <code className="path-preview-value">
                      {genForm.save_directory.trim()}
                      {genForm.save_directory.trim().endsWith('\\') ||
                      genForm.save_directory.trim().endsWith('/') ? '' : '\\'}
                      {genForm.name.trim()}
                    </code>
                  </div>
                )}

                <button
                  className="toolbar-btn run"
                  onClick={handleGenerate}
                  disabled={generating}
                  style={{ marginTop: 12 }}
                >
                  {generating ? (
                    <><Loader2 size={14} className="spin" /> Đang tạo project...</>
                  ) : (
                    <><FolderPlus size={14} /> Tạo Project</>
                  )}
                </button>

                {/* Scaffold result */}
                <ScaffoldResult result={genResult} />
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════
                IMPORT MODE — point to existing Katalon project folder
            ════════════════════════════════════════════════════════════ */}
            {mode === 'import' && (
              <div className="detail-section">
                <div className="project-generate-banner" style={{ '--banner-accent': 'var(--accent-secondary, #6c63ff)' }}>
                  <Download size={18} />
                  <div>
                    <strong>Import project có sẵn</strong>
                    <p>Chọn thư mục gốc của project đã tồn tại trên disk để đăng ký vào hệ thống.</p>
                  </div>
                </div>

                {/* Name */}
                <div className="input-group">
                  <label>Tên Project <span className="kat-required">*</span></label>
                  <input
                    className={`input-field ${impErrors.name ? 'input-field--error' : ''}`}
                    value={impForm.name}
                    onChange={(e) => {
                      setImpForm((f) => ({ ...f, name: e.target.value }));
                      setImpErrors((er) => ({ ...er, name: '' }));
                      setApiError('');
                    }}
                    placeholder="VD: QA Automation Core"
                    maxLength={100}
                  />
                  <FieldError msg={impErrors.name} />
                </div>

                {/* Description */}
                <div className="input-group">
                  <label>Mô tả</label>
                  <textarea
                    className="input-field"
                    rows={2}
                    value={impForm.description}
                    onChange={(e) => setImpForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Mô tả project (tùy chọn)..."
                  />
                </div>

                {/* Katalon Project Path */}
                <PathPickerInput
                  id="project-katalon-path"
                  label="Đường dẫn Project"
                  required
                  type="directory"
                  value={impForm.katalon_project_path}
                  onChange={(val) => {
                    setImpForm((f) => ({ ...f, katalon_project_path: val }));
                    setImpErrors((er) => ({ ...er, katalon_project_path: '' }));
                    setApiError('');
                  }}
                  placeholder="D:\Projects\MyProject"
                  error={impErrors.katalon_project_path}
                  hint="Chọn thư mục gốc của project"
                />

                <button
                  className="toolbar-btn run"
                  onClick={handleImport}
                  disabled={importing}
                  style={{ marginTop: 12 }}
                >
                  {importing ? (
                    <><Loader2 size={14} className="spin" /> Đang import...</>
                  ) : (
                    <><Download size={14} /> Import Project</>
                  )}
                </button>
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════
                EDIT MODE — update name / description / path for an existing project
            ════════════════════════════════════════════════════════════ */}
            {mode === 'edit' && (
              <div className="detail-section">
                {/* Name */}
                <div className="input-group">
                  <label>Tên Project</label>
                  <input
                    className={`input-field ${editErrors.name ? 'input-field--error' : ''}`}
                    value={editForm.name}
                    onChange={(e) => {
                      setEditForm((f) => ({ ...f, name: e.target.value }));
                      setEditErrors((er) => ({ ...er, name: '' }));
                      setApiError('');
                    }}
                    placeholder="Tên project"
                    maxLength={100}
                  />
                  <FieldError msg={editErrors.name} />
                </div>

                {/* Description */}
                <div className="input-group">
                  <label>Mô tả</label>
                  <textarea
                    className="input-field"
                    rows={2}
                    value={editForm.description}
                    onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Mô tả project..."
                  />
                </div>

                {/* Katalon path */}
                <PathPickerInput
                  id="edit-katalon-path"
                  label="Đường dẫn Project"
                  required
                  type="directory"
                  value={editForm.katalon_project_path}
                  onChange={(val) => {
                    setEditForm((f) => ({ ...f, katalon_project_path: val }));
                    setEditErrors((er) => ({ ...er, katalon_project_path: '' }));
                    setApiError('');
                  }}
                  placeholder="D:\Projects\MyProject"
                  error={editErrors.katalon_project_path}
                  hint="Thư mục gốc của project trên disk"
                />

                <button className="toolbar-btn run" onClick={handleUpdate} style={{ marginTop: 12 }}>
                  Cập nhật
                </button>
              </div>
            )}

            {/* ── Katalon structure viewer (edit mode only) ───────────────── */}
            {mode === 'edit' && (
              <div className="detail-section">
                <h4>Cấu trúc Project</h4>
                {!selectedStructure && !loadingStructure && (
                  <span className="detail-value">
                    {selectedProject ? 'Không thể đọc cấu trúc project.' : 'Chọn project để xem chi tiết.'}
                  </span>
                )}
                {loadingStructure && (
                  <span className="detail-value">
                    <Loader2 size={14} className="spin" style={{ marginRight: 6 }} />
                    Đang phân tích cấu trúc...
                  </span>
                )}
                {selectedStructure && (
                  <div className="locators-list">
                    {Object.entries(selectedStructure.folders || {}).map(([folderName, folderInfo]) => (
                      <div key={folderName} className="locator-item">
                        <span className={`locator-type-badge ${folderInfo.exists ? 'badge-green' : 'badge-default'}`}>
                          {folderInfo.exists ? 'FOUND' : 'MISSING'}
                        </span>
                        <code className="locator-value">{folderName}</code>
                        <span className="detail-value">{folderInfo.file_count} files</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectsPage;
