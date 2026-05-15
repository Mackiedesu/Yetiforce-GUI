import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ListChecks, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';

import { listProjects } from '../projects/projects.api';
import {
  createProjectTestCase,
  deleteProjectTestCase,
  getProjectTestCase,
  listProjectTestCases,
  updateProjectTestCase
} from './testCases.api';
import { addSuiteTestCase, listProjectSuites } from '../suites/suites.api';

const STEPS_PLACEHOLDER = '[\n'
  + '  {\n'
  + '    "title": "M\u1EDF tr\u00ECnh duy\u1EC7t v\u00E0 v\u00E0o trang",\n'
  + '    "description": "M\u1EDF Chrome, \u0111i\u1EC1u h\u01B0\u1EDBng \u0111\u1EBFn URL m\u1EE5c ti\u00EAu",\n'
  + '    "expected_result": "Trang t\u1EA3i th\u00E0nh c\u00F4ng"\n'
  + '  },\n'
  + '  {\n'
  + '    "title": "Nh\u1EADp email v\u00E0 m\u1EADt kh\u1EA9u",\n'
  + '    "description": "\u0110i\u1EC1n th\u00F4ng tin \u0111\u0103ng nh\u1EADp",\n'
  + '    "expected_result": "Form \u0111\u01B0\u1EE3c \u0111i\u1EC1n \u0111\u00FAng"\n'
  + '  }\n'
  + ']\n\n'
  + '// Ho\u1EB7c d\u00F9ng format action-based:\n'
  + '// { "step": 1, "action": "openBrowser", "value": "https://..." }\n'
  + '// { "step": 2, "action": "setText", "target": "input_email", "value": "${username}" }';

const DATA_SETS_PLACEHOLDER = `[
  {
    "username": "user@example.com",
    "password": "Pass123",
    "description": "Đăng nhập thành công"
  },
  {
    "username": "wrong@example.com",
    "password": "WrongPass",
    "description": "Sai mật khẩu"
  }
]`;

const EMPTY_FORM = {
  name: '',
  description: '',
  expected_result: '',
  url: '',
  script: '',
  steps_json: '[]',
  data_sets_json: '[]'
};

function parseJsonField(rawValue, fieldName) {
  try {
    const parsed = JSON.parse(rawValue || '[]');
    if (!Array.isArray(parsed)) {
      throw new Error(`${fieldName} phải là mảng JSON`);
    }
    return parsed;
  } catch (error) {
    throw new Error(`${fieldName} không hợp lệ: ${error.message}`);
  }
}

/* ─── Suite multi-select ─────────────────────────────────────────────────── */
function SuiteMultiSelect({ suites, selectedIds, onChange }) {
  const [open, setOpen] = useState(false);

  function toggleSuite(id) {
    onChange((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const selectedNames = suites.filter((s) => selectedIds.has(s.id)).map((s) => s.name);
  const label = selectedIds.size === 0
    ? 'Không liên kết (tùy chọn)'
    : selectedIds.size === 1
      ? selectedNames[0]
      : `${selectedIds.size} suites đã chọn`;

  return (
    <div className="suite-ms-wrap">
      <button
        type="button"
        className={`suite-ms-trigger ${open ? 'open' : ''}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="suite-ms-label">{label}</span>
        {selectedIds.size > 0 && (
          <span className="suite-ms-badge">{selectedIds.size}</span>
        )}
        <ChevronDown size={13} className={`suite-ms-chevron ${open ? 'open' : ''}`} />
      </button>

      {open && (
        <div className="suite-ms-dropdown">
          {suites.length === 0 ? (
            <div className="suite-ms-empty">Chưa có suite nào trong project này.</div>
          ) : (
            suites.map((suite) => (
              <label key={suite.id} className="suite-ms-item">
                <input
                  type="checkbox"
                  checked={selectedIds.has(suite.id)}
                  onChange={() => toggleSuite(suite.id)}
                />
                <span className="suite-ms-name">{suite.name}</span>
                {suite.test_case_count > 0 && (
                  <span className="suite-ms-count">{suite.test_case_count} TCs</span>
                )}
              </label>
            ))
          )}
          {selectedIds.size > 0 && (
            <button
              type="button"
              className="suite-ms-clear"
              onClick={() => onChange(new Set())}
            >
              Bỏ chọn tất cả
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Main page ─────────────────────────────────────────────────────────── */
const TestCasesPage = ({ addLog }) => {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');

  const [testCases, setTestCases] = useState([]);
  const [selectedTestCaseId, setSelectedTestCaseId] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);

  const [suites, setSuites] = useState([]);
  const [selectedSuiteIds, setSelectedSuiteIds] = useState(new Set());

  // Inline form validation error (shown in form, not just log)
  const [formError, setFormError] = useState('');

  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingTestCases, setLoadingTestCases] = useState(false);

  const selectedTestCase = useMemo(
    () => testCases.find((item) => item.id === selectedTestCaseId) || null,
    [testCases, selectedTestCaseId]
  );

  const fetchProjects = useCallback(async () => {
    setLoadingProjects(true);
    try {
      const data = await listProjects();
      const list = data.projects || [];
      setProjects(list);
      if (list.length > 0) {
        setSelectedProjectId((prev) => prev || list[0].id);
      }
    } catch (error) {
      addLog(`Lỗi tải project: ${error.response?.data?.error || error.message}`, 'error');
    } finally {
      setLoadingProjects(false);
    }
  }, [addLog]);

  const fetchTestCases = useCallback(async (projectId) => {
    if (!projectId) {
      setTestCases([]);
      setSelectedTestCaseId('');
      return;
    }

    setLoadingTestCases(true);
    try {
      const data = await listProjectTestCases(projectId);
      setTestCases(data.test_cases || []);
      setSelectedTestCaseId('');
      setForm(EMPTY_FORM);
    } catch (error) {
      setTestCases([]);
      addLog(`Lỗi tải test cases: ${error.response?.data?.error || error.message}`, 'error');
    } finally {
      setLoadingTestCases(false);
    }
  }, [addLog]);

  const fetchSuites = useCallback(async (projectId) => {
    if (!projectId) { setSuites([]); return; }
    try {
      const data = await listProjectSuites(projectId);
      setSuites(data.suites || []);
    } catch {
      setSuites([]);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { fetchProjects(); }, 0);
    return () => clearTimeout(timer);
  }, [fetchProjects]);

  useEffect(() => {
    if (!selectedProjectId) return;
    const timer = setTimeout(() => {
      fetchTestCases(selectedProjectId);
      fetchSuites(selectedProjectId);
    }, 0);
    return () => clearTimeout(timer);
  }, [selectedProjectId, fetchTestCases, fetchSuites]);

  async function selectTestCase(testCaseId) {
    setSelectedTestCaseId(testCaseId);
    setSelectedSuiteIds(new Set());
    try {
      const data = await getProjectTestCase(selectedProjectId, testCaseId);
      const item = data.test_case;
      setForm({
        name: item.name || '',
        description: item.description || '',
        expected_result: item.expected_result || '',
        url: item.url || '',
        script: item.script || '',
        steps_json: JSON.stringify(item.steps || [], null, 2),
        data_sets_json: JSON.stringify(item.data_sets || [], null, 2)
      });
    } catch (error) {
      addLog(`Lỗi tải chi tiết test case: ${error.response?.data?.error || error.message}`, 'error');
    }
  }

  function resetForm() {
    setSelectedTestCaseId('');
    setForm(EMPTY_FORM);
    setSelectedSuiteIds(new Set());
    setFormError('');
  }

  async function handleSaveTestCase() {
    setFormError('');

    if (!selectedProjectId) {
      setFormError('Vui lòng chọn project trước.');
      return;
    }

    if (!form.name.trim()) {
      setFormError('Tên test case là bắt buộc.');
      return;
    }

    let steps;
    let dataSets;
    try {
      steps = parseJsonField(form.steps_json, 'Steps JSON');
      dataSets = parseJsonField(form.data_sets_json, 'Data Sets JSON');
    } catch (error) {
      setFormError(error.message);
      addLog(error.message, 'error');
      return;
    }

    const payload = {
      name: form.name,
      description: form.description,
      expected_result: form.expected_result,
      url: form.url,
      script: form.script,
      steps,
      data_sets: dataSets
    };

    try {
      let data;
      if (selectedTestCaseId) {
        data = await updateProjectTestCase(selectedProjectId, selectedTestCaseId, payload);
        addLog(`Đã cập nhật test case: ${data.test_case.name}`, 'success');
        setFormError('');
      } else {
        data = await createProjectTestCase(selectedProjectId, payload);
        addLog(`Đã tạo test case: ${data.test_case.name}`, 'success');
        setFormError('');

        // Link to selected suites
        if (selectedSuiteIds.size > 0) {
          let linked = 0;
          for (const suiteId of selectedSuiteIds) {
            try {
              await addSuiteTestCase(selectedProjectId, suiteId, { test_case_id: data.test_case.id });
              linked += 1;
            } catch (err) {
              addLog(`Lỗi liên kết suite: ${err.response?.data?.error || err.message}`, 'error');
            }
          }
          if (linked > 0) {
            addLog(`Đã liên kết vào ${linked} test suite.`, 'success');
          }
        }
      }

      await fetchTestCases(selectedProjectId);
      await selectTestCase(data.test_case.id);
    } catch (error) {
      const msg = error.response?.data?.error || error.message;
      setFormError(msg);
      addLog(`Lỗi lưu test case: ${msg}`, 'error');
    }
  }

  async function handleDeleteTestCase() {
    if (!selectedProjectId || !selectedTestCaseId) {
      return;
    }

    try {
      await deleteProjectTestCase(selectedProjectId, selectedTestCaseId);
      addLog('Đã xóa test case.', 'info');
      await fetchTestCases(selectedProjectId);
      resetForm();
    } catch (error) {
      addLog(`Lỗi xóa test case: ${error.response?.data?.error || error.message}`, 'error');
    }
  }

  return (
    <div className="object-repo-container">
      <div className="object-repo-header">
        <div className="object-repo-title">
          <ListChecks size={20} />
          <h2>Reusable Test Cases</h2>
          <span className="obj-count-label">{testCases.length} test cases</span>
        </div>
        <div className="object-repo-actions">
          <button
            className="toolbar-btn"
            onClick={() => fetchTestCases(selectedProjectId)}
            disabled={loadingProjects || loadingTestCases}
          >
            <RefreshCw size={14} /> Làm mới
          </button>
          <button className="toolbar-btn" onClick={resetForm}>
            <Plus size={14} /> Mới
          </button>
        </div>
      </div>

      <div className="object-repo-body">
        <div className="object-list">
          <div className="object-list-header">
            <span>Project & Test Cases</span>
          </div>

          <div style={{ padding: '10px' }}>
            <label style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Project</label>
            <select
              className="input-field"
              value={selectedProjectId}
              onChange={(event) => setSelectedProjectId(event.target.value)}
              style={{ marginTop: 6 }}
            >
              <option value="">-- Chọn project --</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </div>

          {loadingTestCases ? (
            <div className="empty-state"><span>Đang tải test cases...</span></div>
          ) : (
            <div className="object-items">
              {testCases.map((testCase) => (
                <div
                  key={testCase.id}
                  className={`object-item ${selectedTestCaseId === testCase.id ? 'selected' : ''}`}
                  onClick={() => selectTestCase(testCase.id)}
                >
                  <div className="object-item-info">
                    <div className="object-item-name">{testCase.name}</div>
                    <div className="object-item-meta">
                      <span className="obj-locator-count">Linked {testCase.linked_suite_count || 0} suites</span>
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
              <h3>{selectedTestCase ? 'Cập nhật Test Case' : 'Tạo Test Case mới'}</h3>

              {/* ── Inline error banner ── */}
              {formError && (
                <div style={{
                  background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)',
                  borderRadius: 8, padding: '10px 14px', marginBottom: 12,
                  color: '#fca5a5', fontSize: '0.82rem', lineHeight: 1.5,
                  display: 'flex', gap: 8, alignItems: 'flex-start'
                }}>
                  <span style={{ flexShrink: 0 }}>⚠️</span>
                  <span>{formError}</span>
                  <button
                    onClick={() => setFormError('')}
                    style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}
                  >×</button>
                </div>
              )}
              {selectedTestCase && (
                <button className="toolbar-btn delete-btn" onClick={handleDeleteTestCase}>
                  <Trash2 size={14} /> Xóa
                </button>
              )}
            </div>

            <div className="detail-section">
              <div className="input-group">
                <label>Tên Test Case</label>
                <input
                  className="input-field"
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="VD: Login happy path"
                />
              </div>

              <div className="input-group">
                <label>Mô tả</label>
                <textarea
                  className="input-field"
                  rows={2}
                  value={form.description}
                  onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                />
              </div>

              <div className="input-group">
                <label>Expected Result</label>
                <textarea
                  className="input-field"
                  rows={2}
                  value={form.expected_result}
                  onChange={(event) => setForm((prev) => ({ ...prev, expected_result: event.target.value }))}
                />
              </div>

              <div className="input-group">
                <label>URL mục tiêu</label>
                <input
                  className="input-field"
                  value={form.url}
                  onChange={(event) => setForm((prev) => ({ ...prev, url: event.target.value }))}
                />
              </div>

              <div className="input-group">
                <label>Script</label>
                <textarea
                  className="input-field"
                  rows={3}
                  value={form.script}
                  onChange={(event) => setForm((prev) => ({ ...prev, script: event.target.value }))}
                />
              </div>

              <div className="input-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  Steps JSON
                  <span style={{ fontSize: '0.72rem', fontWeight: 400, color: 'var(--text-secondary)' }}>(tùy chọn — mỗi bước cần có "title")</span>
                </label>
                <textarea
                  className="input-field"
                  rows={8}
                  value={form.steps_json}
                  onChange={(event) => setForm((prev) => ({ ...prev, steps_json: event.target.value }))}
                  placeholder={STEPS_PLACEHOLDER}
                  style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}
                />
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.5 }}>
                  💡 Hỗ trợ 2 format: <code style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: 3 }}>{'{"title":"..."}'}</code> hoặc <code style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: 3 }}>{'{"action":"setText","target":"input_email","value":"..."}'}</code>
                </div>
              </div>

              <div className="input-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  Data Sets JSON
                  <span style={{ fontSize: '0.72rem', fontWeight: 400, color: 'var(--text-secondary)' }}>(tùy chọn — dữ liệu cho Data-Driven testing)</span>
                </label>
                <textarea
                  className="input-field"
                  rows={6}
                  value={form.data_sets_json}
                  onChange={(event) => setForm((prev) => ({ ...prev, data_sets_json: event.target.value }))}
                  placeholder={DATA_SETS_PLACEHOLDER}
                  style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}
                />
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.5 }}>
                  💡 Mỗi object là 1 bộ dữ liệu chạy lặp. Dùng <code style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: 3 }}>description</code> để đặt tên cho bộ dữ liệu (tự động nhận diện). Ví dụ: <code style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: 3 }}>{'{"username":"...","password":"...","description":"Login thành công"}'}</code>
                </div>
              </div>

              {/* Suite linking — only shown when creating a new test case */}
              {!selectedTestCase && (
                <div className="input-group">
                  <label>
                    Liên kết vào Test Suite
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 400, marginLeft: 4 }}>(tùy chọn)</span>
                  </label>
                  <SuiteMultiSelect
                    suites={suites}
                    selectedIds={selectedSuiteIds}
                    onChange={setSelectedSuiteIds}
                  />
                </div>
              )}

              <button className="toolbar-btn run" onClick={handleSaveTestCase}>
                <Save size={14} /> {selectedTestCase ? 'Cập nhật Test Case' : 'Tạo Test Case'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestCasesPage;
