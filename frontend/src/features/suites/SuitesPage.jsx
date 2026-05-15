import { useCallback, useEffect, useMemo, useState } from 'react';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, ListOrdered, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';

import { listProjects } from '../projects/projects.api';
import {
  addSuiteTestCase,
  createProjectSuite,
  deleteProjectSuite,
  deleteSuiteTestCase,
  getProjectSuite,
  listProjectSuites,
  reorderSuiteTestCases,
  updateProjectSuite,
  updateSuiteTestCase
} from './suites.api';
import { getProjectTestCase, listProjectTestCases } from '../test-cases/testCases.api';

function SortableTestCaseItem({ testCase, onEdit, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: testCase.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  };

  return (
    <div ref={setNodeRef} style={style} className="locator-item">
      <button
        type="button"
        className="toolbar-btn"
        style={{ padding: '4px 6px', cursor: 'grab' }}
        {...attributes}
        {...listeners}
        title="Kéo để đổi thứ tự"
      >
        <GripVertical size={14} />
      </button>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <strong style={{ fontSize: '0.85rem' }}>{testCase.execution_order}. {testCase.name}</strong>
        <span className="detail-value" style={{ fontSize: '0.8rem' }}>{testCase.description || 'Không có mô tả'}</span>
      </div>
      <button type="button" className="toolbar-btn" onClick={() => onEdit(testCase)}>Sửa</button>
      <button type="button" className="toolbar-btn delete-btn" onClick={() => onDelete(testCase.id)}>
        <Trash2 size={14} />
      </button>
    </div>
  );
}

const EMPTY_SUITE_FORM = {
  name: '',
  description: ''
};

const EMPTY_TEST_CASE_FORM = {
  name: '',
  description: '',
  expected_result: '',
  url: '',
  script: '',
  steps_json: '[]',
  data_sets_json: '[]',
};

function parseJsonField(rawValue, fieldName) {
  try {
    const parsed = JSON.parse(rawValue || '[]');
    if (!Array.isArray(parsed)) throw new Error(`${fieldName} phải là mảng JSON`);
    return parsed;
  } catch (error) {
    throw new Error(`${fieldName} không hợp lệ: ${error.message}`);
  }
}

const SuitesPage = ({ addLog }) => {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');

  const [suites, setSuites] = useState([]);
  const [selectedSuiteId, setSelectedSuiteId] = useState('');
  const [selectedSuite, setSelectedSuite] = useState(null);

  const [suiteForm, setSuiteForm] = useState(EMPTY_SUITE_FORM);
  const [testCaseForm, setTestCaseForm] = useState(EMPTY_TEST_CASE_FORM);
  const [editingTestCaseId, setEditingTestCaseId] = useState('');
  const [orderHistory, setOrderHistory] = useState([]);
  const [availableTestCases, setAvailableTestCases] = useState([]);
  const [selectedReusableTestCaseId, setSelectedReusableTestCaseId] = useState('');

  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingSuites, setLoadingSuites] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

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

  const fetchSuites = useCallback(async (projectId, preserveSelection = false) => {
    setLoadingSuites(true);
    try {
      const data = await listProjectSuites(projectId);
      setSuites(data.suites || []);
      if (!preserveSelection) {
        setSelectedSuiteId('');
        setSelectedSuite(null);
      }
    } catch (error) {
      setSuites([]);
      addLog(`Lỗi tải suite: ${error.response?.data?.error || error.message}`, 'error');
    } finally {
      setLoadingSuites(false);
    }
  }, [addLog]);

  const fetchReusableTestCases = useCallback(async (projectId) => {
    if (!projectId) {
      setAvailableTestCases([]);
      return;
    }

    try {
      const data = await listProjectTestCases(projectId);
      setAvailableTestCases(data.test_cases || []);
    } catch (error) {
      setAvailableTestCases([]);
      addLog(`Lỗi tải reusable test case: ${error.response?.data?.error || error.message}`, 'error');
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
      fetchSuites(selectedProjectId);
      fetchReusableTestCases(selectedProjectId);
    }, 0);

    return () => clearTimeout(timer);
  }, [selectedProjectId, fetchSuites, fetchReusableTestCases]);

  function handleProjectChange(nextProjectId) {
    setSelectedReusableTestCaseId('');
    if (!nextProjectId) {
      setSuites([]);
      setSelectedSuite(null);
      setSelectedSuiteId('');
      setSuiteForm(EMPTY_SUITE_FORM);
      setTestCaseForm(EMPTY_TEST_CASE_FORM);
    }
    setSelectedProjectId(nextProjectId);
  }

  async function selectSuite(suiteId) {
    setSelectedSuiteId(suiteId);
    try {
      const data = await getProjectSuite(selectedProjectId, suiteId);
      setSelectedSuite(data.suite);
      setSuiteForm({ name: data.suite.name || '', description: data.suite.description || '' });
      setEditingTestCaseId('');
      setTestCaseForm(EMPTY_TEST_CASE_FORM);
    } catch (error) {
      addLog(`Lỗi tải chi tiết suite: ${error.response?.data?.error || error.message}`, 'error');
    }
  }

  async function handleCreateSuite() {
    if (!selectedProjectId) {
      addLog('Vui lòng chọn project trước.', 'error');
      return;
    }
    if (!suiteForm.name.trim()) {
      addLog('Tên suite là bắt buộc.', 'error');
      return;
    }

    try {
      const payload = { ...suiteForm, test_cases: [] };
      const data = await createProjectSuite(selectedProjectId, payload);
      addLog(`Đã tạo suite: ${data.suite.name}`, 'success');
      await fetchSuites(selectedProjectId);
      await selectSuite(data.suite.id);
    } catch (error) {
      addLog(`Lỗi tạo suite: ${error.response?.data?.error || error.message}`, 'error');
    }
  }

  async function handleUpdateSuite() {
    if (!selectedProjectId || !selectedSuiteId) {
      return;
    }

    try {
      const data = await updateProjectSuite(selectedProjectId, selectedSuiteId, suiteForm);
      addLog(`Đã cập nhật suite: ${data.suite.name}`, 'success');
      await fetchSuites(selectedProjectId);
      setSelectedSuite(data.suite);
    } catch (error) {
      addLog(`Lỗi cập nhật suite: ${error.response?.data?.error || error.message}`, 'error');
    }
  }

  async function handleDeleteSuite() {
    if (!selectedProjectId || !selectedSuiteId) {
      return;
    }

    try {
      await deleteProjectSuite(selectedProjectId, selectedSuiteId);
      addLog('Đã xóa suite.', 'info');
      setSelectedSuiteId('');
      setSelectedSuite(null);
      setSuiteForm(EMPTY_SUITE_FORM);
      setTestCaseForm(EMPTY_TEST_CASE_FORM);
      await fetchSuites(selectedProjectId);
    } catch (error) {
      addLog(`Lỗi xóa suite: ${error.response?.data?.error || error.message}`, 'error');
    }
  }

  async function handleSaveTestCase() {
    if (!selectedProjectId || !selectedSuiteId) {
      addLog('Vui lòng chọn suite trước.', 'error');
      return;
    }
    if (!testCaseForm.name.trim()) {
      addLog('Tên test case là bắt buộc.', 'error');
      return;
    }

    let steps;
    let dataSets;
    try {
      steps = parseJsonField(testCaseForm.steps_json, 'steps_json');
      dataSets = parseJsonField(testCaseForm.data_sets_json, 'data_sets_json');
    } catch (error) {
      addLog(error.message, 'error');
      return;
    }

    const payload = {
      name: testCaseForm.name,
      description: testCaseForm.description,
      expected_result: testCaseForm.expected_result,
      url: testCaseForm.url,
      script: testCaseForm.script,
      steps,
      data_sets: dataSets,
    };

    try {
      let data;
      if (editingTestCaseId) {
        data = await updateSuiteTestCase(selectedProjectId, selectedSuiteId, editingTestCaseId, payload);
        addLog('Đã cập nhật test case.', 'success');
      } else {
        data = await addSuiteTestCase(selectedProjectId, selectedSuiteId, payload);
        addLog('Đã thêm test case vào suite.', 'success');
      }

      setSelectedSuite(data.suite);
      setTestCaseForm(EMPTY_TEST_CASE_FORM);
      setEditingTestCaseId('');
      await fetchSuites(selectedProjectId, true);
      await fetchReusableTestCases(selectedProjectId);
    } catch (error) {
      addLog(`Lỗi lưu test case: ${error.response?.data?.error || error.message}`, 'error');
    }
  }

  async function handleLinkExistingTestCase() {
    if (!selectedProjectId || !selectedSuiteId) {
      addLog('Vui lòng chọn suite trước.', 'error');
      return;
    }
    if (!selectedReusableTestCaseId) {
      addLog('Vui lòng chọn reusable test case để liên kết.', 'error');
      return;
    }

    try {
      const data = await addSuiteTestCase(selectedProjectId, selectedSuiteId, { test_case_id: selectedReusableTestCaseId });
      setSelectedSuite(data.suite);
      setSelectedReusableTestCaseId('');
      addLog('Đã liên kết reusable test case vào suite.', 'success');
      await fetchSuites(selectedProjectId, true);
    } catch (error) {
      addLog(`Lỗi liên kết test case: ${error.response?.data?.error || error.message}`, 'error');
    }
  }

  async function handleEditTestCase(testCase) {
    setEditingTestCaseId(testCase.id);
    try {
      const data = await getProjectTestCase(selectedProjectId, testCase.id);
      const item = data.test_case;
      setTestCaseForm({
        name: item.name || '',
        description: item.description || '',
        expected_result: item.expected_result || '',
        url: item.url || '',
        script: item.script || '',
        steps_json: JSON.stringify(item.steps || [], null, 2),
        data_sets_json: JSON.stringify(item.data_sets || [], null, 2),
      });
    } catch (error) {
      addLog(`Lỗi tải chi tiết test case: ${error.response?.data?.error || error.message}`, 'error');
      // Fallback to the shallow data already in suite view
      setTestCaseForm({
        name: testCase.name || '',
        description: testCase.description || '',
        expected_result: testCase.expected_result || '',
        url: testCase.url || '',
        script: testCase.script || '',
        steps_json: '[]',
        data_sets_json: '[]',
      });
    }
  }

  async function handleDeleteTestCase(testCaseId) {
    if (!selectedProjectId || !selectedSuiteId) {
      return;
    }

    try {
      const data = await deleteSuiteTestCase(selectedProjectId, selectedSuiteId, testCaseId);
      setSelectedSuite(data.suite);
      addLog('Đã xóa test case.', 'info');
      await fetchSuites(selectedProjectId, true);
    } catch (error) {
      addLog(`Lỗi xóa test case: ${error.response?.data?.error || error.message}`, 'error');
    }
  }

  async function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id || !selectedSuite) {
      return;
    }

    const oldIndex = selectedSuite.test_cases.findIndex((item) => item.id === active.id);
    const newIndex = selectedSuite.test_cases.findIndex((item) => item.id === over.id);
    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    const reordered = arrayMove(selectedSuite.test_cases, oldIndex, newIndex).map((item, index) => ({
      ...item,
      execution_order: index + 1
    }));
    const previousOrderText = selectedSuite.test_cases.map((item) => item.name).join(' -> ');
    const nextOrderText = reordered.map((item) => item.name).join(' -> ');

    setSelectedSuite((prev) => ({ ...prev, test_cases: reordered }));

    setSavingOrder(true);
    try {
      const data = await reorderSuiteTestCases(selectedProjectId, selectedSuiteId, reordered.map((item) => item.id));
      setSelectedSuite(data.suite);
      addLog('Đã lưu thứ tự chạy test case.', 'success');
      setOrderHistory((prev) => ([
        {
          suiteId: selectedSuiteId,
          time: new Date().toLocaleTimeString(),
          before: previousOrderText,
          after: nextOrderText
        },
        ...prev
      ].slice(0, 20)));
      await fetchSuites(selectedProjectId, true);
    } catch (error) {
      addLog(`Lỗi lưu thứ tự test case: ${error.response?.data?.error || error.message}`, 'error');
      await selectSuite(selectedSuiteId);
    } finally {
      setSavingOrder(false);
    }
  }

  const orderedTestCases = useMemo(() => {
    return selectedSuite?.test_cases || [];
  }, [selectedSuite]);

  const currentOrderText = useMemo(() => {
    if (!orderedTestCases.length) {
      return 'Chưa có test case trong suite';
    }
    return orderedTestCases.map((item) => item.name).join(' -> ');
  }, [orderedTestCases]);

  const orderHistoryOfCurrentSuite = useMemo(() => {
    if (!selectedSuiteId) {
      return [];
    }
    return orderHistory.filter((item) => item.suiteId === selectedSuiteId).slice(0, 5);
  }, [orderHistory, selectedSuiteId]);

  return (
    <div className="object-repo-container">
      <div className="object-repo-header">
        <div className="object-repo-title">
          <ListOrdered size={20} />
          <h2>Test Suite Management</h2>
          <span className="obj-count-label">{suites.length} suites</span>
        </div>
        <div className="object-repo-actions">
          <button className="toolbar-btn" onClick={fetchProjects} disabled={loadingProjects || loadingSuites}>
            <RefreshCw size={14} /> Làm mới
          </button>
        </div>
      </div>

      <div className="object-repo-body">
        <div className="object-list">
          <div className="object-list-header">
            <span>Project & Suites</span>
          </div>

          <div style={{ padding: '10px' }}>
            <label style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Project</label>
            <select
              className="input-field"
              value={selectedProjectId}
              onChange={(event) => handleProjectChange(event.target.value)}
              style={{ marginTop: 6 }}
            >
              <option value="">-- Chọn project --</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </div>

          {loadingSuites ? (
            <div className="empty-state"><span>Đang tải suites...</span></div>
          ) : (
            <div className="object-items">
              {suites.map((suite) => (
                <div
                  key={suite.id}
                  className={`object-item ${selectedSuiteId === suite.id ? 'selected' : ''}`}
                  onClick={() => selectSuite(suite.id)}
                >
                  <div className="object-item-info">
                    <div className="object-item-name">{suite.name}</div>
                    <div className="object-item-meta">
                      <span className="obj-locator-count">{suite.test_case_count || 0} test cases</span>
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
              <h3>{selectedSuiteId ? 'Chi tiết Suite' : 'Tạo Suite mới'}</h3>
              {selectedSuiteId && (
                <button className="toolbar-btn delete-btn" onClick={handleDeleteSuite}>
                  <Trash2 size={14} /> Xóa Suite
                </button>
              )}
            </div>

            <div className="detail-section">
              <div className="input-group">
                <label>Tên Suite</label>
                <input
                  className="input-field"
                  value={suiteForm.name}
                  onChange={(event) => setSuiteForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="VD: Smoke Test Suite"
                />
              </div>
              <div className="input-group">
                <label>Mô tả Suite</label>
                <textarea
                  className="input-field"
                  rows={2}
                  value={suiteForm.description}
                  onChange={(event) => setSuiteForm((prev) => ({ ...prev, description: event.target.value }))}
                />
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                {selectedSuiteId ? (
                  <button className="toolbar-btn run" onClick={handleUpdateSuite}>
                    <Save size={14} /> Cập nhật Suite
                  </button>
                ) : (
                  <button className="toolbar-btn run" onClick={handleCreateSuite}>
                    <Plus size={14} /> Tạo Suite
                  </button>
                )}
              </div>
            </div>

            {selectedSuiteId && (
              <>
                <div className="detail-section">
                  <h4>{editingTestCaseId ? 'Cập nhật Test Case' : 'Thêm Test Case'}</h4>
                  <div className="input-group">
                    <label>Tên Test Case</label>
                    <input
                      className="input-field"
                      value={testCaseForm.name}
                      onChange={(event) => setTestCaseForm((prev) => ({ ...prev, name: event.target.value }))}
                    />
                  </div>
                  <div className="input-group">
                    <label>Mô tả</label>
                    <input
                      className="input-field"
                      value={testCaseForm.description}
                      onChange={(event) => setTestCaseForm((prev) => ({ ...prev, description: event.target.value }))}
                    />
                  </div>
                  <div className="input-group">
                    <label>Expected Result</label>
                    <textarea
                      className="input-field"
                      rows={2}
                      value={testCaseForm.expected_result}
                      onChange={(event) => setTestCaseForm((prev) => ({ ...prev, expected_result: event.target.value }))}
                    />
                  </div>
                  <div className="input-group">
                    <label>URL</label>
                    <input
                      className="input-field"
                      value={testCaseForm.url}
                      onChange={(event) => setTestCaseForm((prev) => ({ ...prev, url: event.target.value }))}
                    />
                  </div>
                  <div className="input-group">
                    <label>Script</label>
                    <textarea
                      className="input-field"
                      rows={3}
                      value={testCaseForm.script}
                      onChange={(event) => setTestCaseForm((prev) => ({ ...prev, script: event.target.value }))}
                    />
                  </div>
                  <div className="input-group">
                    <label>Steps JSON (nested)</label>
                    <textarea
                      className="input-field"
                      rows={6}
                      value={testCaseForm.steps_json}
                      onChange={(event) => setTestCaseForm((prev) => ({ ...prev, steps_json: event.target.value }))}
                      placeholder='[{"title":"Step 1","description":"","expected_result":"","children":[]}]'
                    />
                  </div>
                  <div className="input-group">
                    <label>Data Sets JSON</label>
                    <textarea
                      className="input-field"
                      rows={4}
                      value={testCaseForm.data_sets_json}
                      onChange={(event) => setTestCaseForm((prev) => ({ ...prev, data_sets_json: event.target.value }))}
                      placeholder='[{"name":"Dataset 1","data_json":{"key":"value"}}]'
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="toolbar-btn run" onClick={handleSaveTestCase}>
                      {editingTestCaseId ? 'Cập nhật Test Case' : 'Thêm Test Case'}
                    </button>
                    {editingTestCaseId && (
                      <button
                        className="toolbar-btn"
                        onClick={() => {
                          setEditingTestCaseId('');
                          setTestCaseForm(EMPTY_TEST_CASE_FORM);
                        }}
                      >
                        Hủy
                      </button>
                    )}
                  </div>

                  <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 6 }}>
                      Hoặc liên kết reusable test case có sẵn
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <select
                        className="input-field"
                        value={selectedReusableTestCaseId}
                        onChange={(event) => setSelectedReusableTestCaseId(event.target.value)}
                      >
                        <option value="">-- Chọn test case --</option>
                        {availableTestCases.map((item) => (
                          <option key={item.id} value={item.id}>{item.name}</option>
                        ))}
                      </select>
                      <button className="toolbar-btn" onClick={handleLinkExistingTestCase}>Liên kết</button>
                    </div>
                  </div>
                </div>

                <div className="detail-section">
                  <h4>Execution Order (Drag & Drop) {savingOrder ? '- Đang lưu...' : ''}</h4>
                  <div
                    style={{
                      marginBottom: 10,
                      padding: '8px 10px',
                      border: '1px solid var(--border-color)',
                      borderRadius: 6,
                      background: 'var(--bg-secondary)'
                    }}
                  >
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 6 }}>
                      Queue hiện tại
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                      {orderedTestCases.map((item) => (
                        <span key={item.id} className="locator-type-badge badge-cyan">
                          #{item.execution_order} {item.name}
                        </span>
                      ))}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {currentOrderText}
                    </div>
                  </div>

                  <div
                    style={{
                      marginBottom: 10,
                      padding: '8px 10px',
                      border: '1px solid var(--border-color)',
                      borderRadius: 6,
                      background: 'var(--bg-secondary)'
                    }}
                  >
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 6 }}>
                      Lịch sử đổi thứ tự (gần nhất)
                    </div>
                    {orderHistoryOfCurrentSuite.length === 0 ? (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        Chưa có lịch sử reorder.
                      </div>
                    ) : (
                      orderHistoryOfCurrentSuite.map((entry, index) => (
                        <div key={`${entry.time}-${index}`} style={{ marginBottom: 6 }}>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>[{entry.time}]</div>
                          <div style={{ fontSize: '0.75rem' }}>
                            <strong>Before:</strong> {entry.before}
                          </div>
                          <div style={{ fontSize: '0.75rem' }}>
                            <strong>After:</strong> {entry.after}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {orderedTestCases.length === 0 ? (
                    <span className="detail-value">Suite chưa có test case.</span>
                  ) : (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                      <SortableContext items={orderedTestCases.map((item) => item.id)} strategy={verticalListSortingStrategy}>
                        <div className="locators-list">
                          {orderedTestCases.map((testCase) => (
                            <SortableTestCaseItem
                              key={testCase.id}
                              testCase={testCase}
                              onEdit={handleEditTestCase}
                              onDelete={handleDeleteTestCase}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuitesPage;
