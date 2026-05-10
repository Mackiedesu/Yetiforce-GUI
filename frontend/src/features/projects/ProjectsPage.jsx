import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Database, FolderOpen, Plus, RefreshCw, Trash2 } from 'lucide-react';
import PathPickerInput from '../../components/PathPickerInput';

import {
  createProject,
  deleteProject,
  getProjectStructure,
  importProject,
  listProjects,
  updateProject
} from './projects.api';

const EMPTY_FORM = {
  name: '',
  description: '',
  katalon_project_path: ''
};

const EMPTY_ERRORS = {
  name: '',
  katalon_project_path: ''
};

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

/**
 * Extract the most useful error message from an axios error response.
 * The backend always returns { error: '...' } on failure.
 */
function extractErrorMessage(error) {
  return (
    error?.response?.data?.error ||
    error?.message ||
    'Có lỗi không xác định xảy ra'
  );
}

/**
 * Returns true if the path looks like a plausible absolute filesystem path.
 * Mirrors the backend isPlausibleAbsolutePath logic for instant client feedback.
 *
 * Accepts:
 *   Windows:  C:\foo  or  D:/bar
 *   Unix:     /home/user/project
 */
function isAbsolutePath(value) {
  const v = (value || '').trim();
  // Windows absolute path
  if (/^[a-zA-Z]:[/\\]/.test(v)) return true;
  // Unix absolute path
  if (v.startsWith('/')) return true;
  return false;
}

/**
 * Validate the form locally.
 * Returns an errors object — empty strings mean no error for that field.
 */
function validateForm(form) {
  const errors = { ...EMPTY_ERRORS };

  if (!form.name.trim()) {
    errors.name = 'Tên project là bắt buộc';
  } else if (form.name.trim().length > 100) {
    errors.name = 'Tên project không được vượt quá 100 ký tự';
  }

  if (!form.katalon_project_path.trim()) {
    errors.katalon_project_path = 'Đường dẫn Katalon project là bắt buộc';
  } else if (!isAbsolutePath(form.katalon_project_path)) {
    errors.katalon_project_path =
      'Đường dẫn không hợp lệ. Nhập đường dẫn tuyệt đối, ví dụ: D:\\KatalonProjects\\MyProject';
  }

  return errors;
}

function hasFormErrors(errors) {
  return Object.values(errors).some(Boolean);
}

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

const ProjectsPage = ({ addLog }) => {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [selectedStructure, setSelectedStructure] = useState(null);

  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState(EMPTY_ERRORS);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingStructure, setLoadingStructure] = useState(false);

  // Inline banner for API-level errors (e.g. duplicate name 409)
  const [apiError, setApiError] = useState('');

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) || null,
    [projects, selectedProjectId]
  );

  const refreshProjects = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listProjects();
      setProjects(data.projects || []);
    } catch (error) {
      addLog(`Lỗi tải danh sách project: ${extractErrorMessage(error)}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [addLog]);

  useEffect(() => {
    const timer = setTimeout(() => {
      refreshProjects();
    }, 0);

    return () => clearTimeout(timer);
  }, [refreshProjects]);

  function onSelectProject(project) {
    setSelectedProjectId(project.id);
    setForm({
      name: project.name || '',
      description: project.description || '',
      katalon_project_path: project.katalon_project_path || ''
    });
    setIsEditing(true);
    setFieldErrors(EMPTY_ERRORS);
    setApiError('');
    fetchStructure(project.id);
  }

  async function fetchStructure(projectId) {
    setLoadingStructure(true);
    try {
      const data = await getProjectStructure(projectId);
      setSelectedStructure(data.structure || null);
    } catch (error) {
      setSelectedStructure(null);
      addLog(`Không thể parse cấu trúc Katalon: ${extractErrorMessage(error)}`, 'error');
    } finally {
      setLoadingStructure(false);
    }
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setFieldErrors(EMPTY_ERRORS);
    setApiError('');
    setIsEditing(false);
    setSelectedProjectId(null);
    setSelectedStructure(null);
  }

  /** Update a single form field and clear its inline error */
  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: '' }));
    setApiError('');
  }

  /** Run form validation; returns false if invalid (sets errors into state) */
  function validateAndSetErrors() {
    const errors = validateForm(form);
    setFieldErrors(errors);
    return !hasFormErrors(errors);
  }

  async function handleCreateProject() {
    if (!validateAndSetErrors()) return;

    setApiError('');
    try {
      const data = await createProject(form);
      addLog(`Đã tạo project: ${data.project.name}`, 'success');
      await refreshProjects();
      onSelectProject(data.project);
    } catch (error) {
      const msg = extractErrorMessage(error);
      setApiError(msg);
      addLog(`Lỗi tạo project: ${msg}`, 'error');
    }
  }

  async function handleUpdateProject() {
    if (!selectedProjectId) return;
    if (!validateAndSetErrors()) return;

    setApiError('');
    try {
      const data = await updateProject(selectedProjectId, form);
      addLog(`Đã cập nhật project: ${data.project.name}`, 'success');
      await refreshProjects();
      await fetchStructure(selectedProjectId);
    } catch (error) {
      const msg = extractErrorMessage(error);
      setApiError(msg);
      addLog(`Lỗi cập nhật project: ${msg}`, 'error');
    }
  }

  async function handleDeleteProject() {
    if (!selectedProjectId) return;

    try {
      await deleteProject(selectedProjectId);
      addLog('Đã xóa project.', 'info');
      await refreshProjects();
      resetForm();
    } catch (error) {
      addLog(`Lỗi xóa project: ${extractErrorMessage(error)}`, 'error');
    }
  }

  async function handleImportProject() {
    if (!validateAndSetErrors()) return;

    setApiError('');
    try {
      const data = await importProject(form);
      addLog(`Import thành công: ${data.project.name}`, 'success');
      await refreshProjects();
      onSelectProject(data.project);
      setSelectedStructure(data.structure || null);
    } catch (error) {
      const msg = extractErrorMessage(error);
      setApiError(msg);
      addLog(`Lỗi import Katalon project: ${msg}`, 'error');
    }
  }

  return (
    <div className="object-repo-container">
      <div className="object-repo-header">
        <div className="object-repo-title">
          <FolderOpen size={20} />
          <h2>Projects</h2>
          <span className="obj-count-label">{projects.length} projects</span>
        </div>
        <div className="object-repo-actions">
          <button className="toolbar-btn" onClick={refreshProjects} disabled={loading}>
            <RefreshCw size={14} /> {loading ? 'Đang tải...' : 'Làm mới'}
          </button>
          <button className="toolbar-btn" onClick={resetForm}>
            <Plus size={14} /> Project mới
          </button>
        </div>
      </div>

      <div className="object-repo-body">
        <div className="object-list">
          <div className="object-list-header">
            <span>Danh sách Projects</span>
          </div>
          {projects.length === 0 ? (
            <div className="empty-state">
              <Database size={40} />
              <p>Chưa có project nào</p>
              <span>Tạo project mới hoặc import từ thư mục Katalon</span>
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
                      <span className="obj-tag-badge">{new Date(project.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="object-detail">
          <div className="object-detail-content">
            <div className="object-detail-header">
              <h3>{isEditing ? 'Cập nhật Project' : 'Tạo Project mới'}</h3>
              <div className="detail-header-actions">
                {isEditing && (
                  <button className="toolbar-btn delete-btn" onClick={handleDeleteProject}>
                    <Trash2 size={14} /> Xóa
                  </button>
                )}
              </div>
            </div>

            {/* API-level error banner (e.g. duplicate name, path not found) */}
            {apiError && (
              <div
                className="ai-gen-error"
                style={{ marginBottom: 12, borderRadius: 8 }}
                role="alert"
              >
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{apiError}</span>
              </div>
            )}

            <div className="detail-section">
              {/* Project Name */}
              <div className="input-group">
                <label>Tên Project</label>
                <input
                  className={`input-field ${fieldErrors.name ? 'input-field--error' : ''}`}
                  value={form.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="VD: QA Automation Core"
                  maxLength={100}
                />
                {fieldErrors.name && (
                  <span className="field-error-msg">{fieldErrors.name}</span>
                )}
              </div>

              {/* Description */}
              <div className="input-group">
                <label>Mô tả</label>
                <textarea
                  className="input-field"
                  rows={3}
                  value={form.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  placeholder="Mô tả project..."
                />
              </div>

              {/* Katalon Project Path */}
              <PathPickerInput
                id="project-katalon-path"
                label="Katalon Project Path"
                required
                type="directory"
                value={form.katalon_project_path}
                onChange={(val) => updateField('katalon_project_path', val)}
                placeholder="D:\KatalonProjects\MyProject"
                error={fieldErrors.katalon_project_path}
                hint="Chọn thư mục gốc của Katalon project (chứa file .prj)"
              />

              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                {isEditing ? (
                  <button className="toolbar-btn run" onClick={handleUpdateProject}>Cập nhật</button>
                ) : (
                  <button className="toolbar-btn run" onClick={handleCreateProject}>Tạo Project</button>
                )}
                <button className="toolbar-btn" onClick={handleImportProject}>Import Katalon</button>
              </div>
            </div>

            <div className="detail-section">
              <h4>Cấu trúc Katalon</h4>
              {!selectedProject && !selectedStructure && (
                <span className="detail-value">Chọn project để xem chi tiết cấu trúc.</span>
              )}
              {loadingStructure && <span className="detail-value">Đang phân tích cấu trúc...</span>}
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectsPage;
