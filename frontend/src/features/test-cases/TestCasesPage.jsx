import { useCallback, useEffect, useMemo, useState } from 'react';
import { ListChecks, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';

import { listProjects } from '../projects/projects.api';
import {
  createProjectTestCase,
  deleteProjectTestCase,
  getProjectTestCase,
  listProjectTestCases,
  updateProjectTestCase
} from './testCases.api';

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

const TestCasesPage = ({ addLog }) => {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');

  const [testCases, setTestCases] = useState([]);
  const [selectedTestCaseId, setSelectedTestCaseId] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);

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

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProjects();
    }, 0);

    return () => clearTimeout(timer);
  }, [fetchProjects]);

  useEffect(() => {
    if (!selectedProjectId) {
      return;
    }
    const timer = setTimeout(() => {
      fetchTestCases(selectedProjectId);
    }, 0);
    return () => clearTimeout(timer);
  }, [selectedProjectId, fetchTestCases]);

  async function selectTestCase(testCaseId) {
    setSelectedTestCaseId(testCaseId);
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
  }

  async function handleSaveTestCase() {
    if (!selectedProjectId) {
      addLog('Vui lòng chọn project trước.', 'error');
      return;
    }

    if (!form.name.trim()) {
      addLog('Tên test case là bắt buộc.', 'error');
      return;
    }

    let steps;
    let dataSets;
    try {
      steps = parseJsonField(form.steps_json, 'steps_json');
      dataSets = parseJsonField(form.data_sets_json, 'data_sets_json');
    } catch (error) {
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
      } else {
        data = await createProjectTestCase(selectedProjectId, payload);
        addLog(`Đã tạo test case: ${data.test_case.name}`, 'success');
      }

      await fetchTestCases(selectedProjectId);
      await selectTestCase(data.test_case.id);
    } catch (error) {
      addLog(`Lỗi lưu test case: ${error.response?.data?.error || error.message}`, 'error');
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
                <label>Steps JSON (nested)</label>
                <textarea
                  className="input-field"
                  rows={8}
                  value={form.steps_json}
                  onChange={(event) => setForm((prev) => ({ ...prev, steps_json: event.target.value }))}
                />
              </div>

              <div className="input-group">
                <label>Data Sets JSON</label>
                <textarea
                  className="input-field"
                  rows={6}
                  value={form.data_sets_json}
                  onChange={(event) => setForm((prev) => ({ ...prev, data_sets_json: event.target.value }))}
                />
              </div>

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
