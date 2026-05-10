import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronRight, Clock, LayoutDashboard, Play, Plus, RefreshCw, Terminal, Trash2, X } from 'lucide-react';

import { listProjects } from '../projects/projects.api';
import { listProjectSuites } from '../suites/suites.api';
import { deleteExecution, getExecution, listExecutions, startExecution } from './executions.api';
import PathPickerInput from '../../components/PathPickerInput';

const BROWSERS = ['Chrome', 'Firefox', 'Edge', 'Chrome (headless)', 'Firefox (headless)'];
const PROFILES = ['default', 'dev', 'staging', 'production'];
const OS_OPTIONS = ['Windows', 'macOS', 'Linux'];

const STATUS_META = {
  running:  { label: 'RUNNING',  cls: 'kat-status-running'  },
  passed:   { label: 'PASSED',   cls: 'kat-status-passed'   },
  failed:   { label: 'FAILED',   cls: 'kat-status-failed'   },
  error:    { label: 'ERROR',    cls: 'kat-status-error'     },
  pending:  { label: 'PENDING',  cls: 'kat-status-pending'  },
};

const EMPTY_CONFIG = {
  project_id: '',
  katalon_executable_path: '',
  project_path: '',
  suite_path: '',
  browser: 'Chrome',
  os: 'Windows',
  profile: 'default',
  api_key: '',
};

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || { label: status?.toUpperCase() || '—', cls: 'kat-status-pending' };
  return <span className={`kat-status-badge ${meta.cls}`}>{meta.label}</span>;
}

function formatDuration(ms) {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}m ${s}s`;
}

function formatTs(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const ExecutionsTab = ({ katalonWsEvent, initialRunId, onInitialRunConsumed, onOpenDashboard }) => {
  const [runs, setRuns] = useState([]);
  const [selectedRunId, setSelectedRunId] = useState(null);
  const [selectedRunDetail, setSelectedRunDetail] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form data
  const [config, setConfig] = useState(EMPTY_CONFIG);
  const [projects, setProjects] = useState([]);
  const [suites, setSuites] = useState([]);

  // Live run tracking
  const [liveRunId, setLiveRunId] = useState(null);
  const [liveLogs, setLiveLogs] = useState([]);
  const [liveStatus, setLiveStatus] = useState(null);
  const logEndRef = useRef(null);

  const fetchRuns = useCallback(async () => {
    setLoadingRuns(true);
    try {
      const data = await listExecutions({ page: 1, limit: 20 });
      setRuns(data.runs || []);
    } catch {
      // silently fail
    } finally {
      setLoadingRuns(false);
    }
  }, []);

  const fetchDetail = useCallback(async (id) => {
    setLoadingDetail(true);
    try {
      const data = await getExecution(id);
      setSelectedRunDetail(data.run);
    } catch {
      setSelectedRunDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  const fetchProjects = useCallback(async () => {
    try {
      const data = await listProjects();
      setProjects(data.projects || []);
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    fetchRuns();
    fetchProjects();
  }, [fetchRuns, fetchProjects]);

  // Scroll log to bottom on new entries
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [liveLogs]);

  // Handle WebSocket events from MainApp
  useEffect(() => {
    if (!katalonWsEvent) return;

    switch (katalonWsEvent.type) {
      case 'katalon_start':
        setLiveRunId(katalonWsEvent.runId);
        setLiveLogs([]);
        setLiveStatus('running');
        break;

      case 'katalon_log':
        if (katalonWsEvent.runId === liveRunId || liveRunId) {
          setLiveLogs((prev) => [
            ...prev,
            {
              level: katalonWsEvent.level,
              message: katalonWsEvent.message,
              time: new Date().toLocaleTimeString(),
            },
          ]);
        }
        break;

      case 'katalon_complete':
        setLiveStatus(katalonWsEvent.status);
        setSubmitting(false);
        fetchRuns();
        if (selectedRunId === katalonWsEvent.runId) {
          fetchDetail(katalonWsEvent.runId);
        }
        break;

      default:
        break;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [katalonWsEvent]);

  async function handleProjectChange(projectId) {
    setConfig((prev) => ({ ...prev, project_id: projectId, suite_path: '' }));
    setSuites([]);

    if (!projectId) return;

    // Pre-fill project_path from the selected project's katalon_project_path
    const project = projects.find((p) => p.id === projectId);
    if (project?.katalon_project_path) {
      setConfig((prev) => ({ ...prev, project_path: project.katalon_project_path }));
    }

    try {
      const data = await listProjectSuites(projectId);
      setSuites(data.suites || []);
    } catch {
      // silently fail
    }
  }

  async function handleSubmit() {
    if (!config.project_path.trim() || !config.suite_path.trim()) return;

    setSubmitting(true);
    setLiveLogs([]);
    setLiveStatus('running');
    setShowForm(false);

    try {
      const data = await startExecution(config);
      const newRun = data.run;
      setLiveRunId(newRun.id);
      setSelectedRunId(newRun.id);
      setSelectedRunDetail(null);
      setRuns((prev) => [newRun, ...prev]);
    } catch (err) {
      setSubmitting(false);
      setLiveStatus('error');
      setLiveLogs((prev) => [
        ...prev,
        { level: 'error', message: err.response?.data?.error || err.message, time: new Date().toLocaleTimeString() },
      ]);
    }
  }

  // Pre-select a run when navigating from the Dashboard
  useEffect(() => {
    if (!initialRunId) return;
    setShowForm(false);
    setSelectedRunId(initialRunId);
    fetchDetail(initialRunId);
    onInitialRunConsumed?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRunId]);

  async function handleSelectRun(run) {
    setSelectedRunId(run.id);
    setShowForm(false);

    if (run.id === liveRunId && liveStatus === 'running') {
      setSelectedRunDetail(null);
    } else {
      await fetchDetail(run.id);
    }
  }

  async function handleDeleteRun(id, e) {
    e.stopPropagation();
    await deleteExecution(id);
    setRuns((prev) => prev.filter((r) => r.id !== id));
    if (selectedRunId === id) {
      setSelectedRunId(null);
      setSelectedRunDetail(null);
    }
    if (liveRunId === id) {
      setLiveRunId(null);
      setLiveLogs([]);
    }
  }

  function handleNewExecution() {
    setShowForm(true);
    setSelectedRunId(null);
    setSelectedRunDetail(null);
  }

  const isLiveRun = selectedRunId === liveRunId && liveStatus === 'running';

  return (
    <div className="kat-exec-layout">
      {/* ── Left sidebar: run history ── */}
      <div className="kat-exec-sidebar">
        <div className="kat-exec-sidebar-header">
          <div className="kat-exec-sidebar-title">
            <Play size={16} />
            <span>Executions</span>
            {(liveStatus === 'running') && (
              <span className="running-indicator" style={{ fontSize: '0.7rem' }}>
                <span className="running-dot" /> Live
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {onOpenDashboard && (
              <button className="toolbar-btn" onClick={onOpenDashboard} title="Xem Dashboard">
                <LayoutDashboard size={13} />
              </button>
            )}
            <button className="toolbar-btn" onClick={fetchRuns} disabled={loadingRuns} title="Làm mới">
              <RefreshCw size={13} />
            </button>
            <button className="toolbar-btn run" onClick={handleNewExecution} title="Chạy mới">
              <Plus size={13} /> Mới
            </button>
          </div>
        </div>

        <div className="kat-exec-run-list">
          {/* Live run entry while running */}
          {liveRunId && liveStatus === 'running' && !runs.find((r) => r.id === liveRunId) && (
            <div
              className={`kat-exec-run-item ${selectedRunId === liveRunId ? 'active' : ''}`}
              onClick={() => { setSelectedRunId(liveRunId); setShowForm(false); }}
            >
              <StatusBadge status="running" />
              <div className="kat-exec-run-info">
                <div className="kat-exec-run-name">Đang chạy...</div>
                <div className="kat-exec-run-meta">
                  <span className="running-dot" style={{ background: 'var(--accent-color)' }} /> LIVE
                </div>
              </div>
            </div>
          )}

          {runs.length === 0 && !loadingRuns && !(liveRunId && liveStatus === 'running') && (
            <div className="kat-exec-empty-list">
              <Play size={28} />
              <p>Chưa có lần chạy nào</p>
              <span>Nhấn "Mới" để bắt đầu</span>
            </div>
          )}

          {runs.map((run) => (
            <div
              key={run.id}
              className={`kat-exec-run-item ${selectedRunId === run.id ? 'active' : ''}`}
              onClick={() => handleSelectRun(run)}
            >
              <StatusBadge status={run.id === liveRunId && liveStatus === 'running' ? 'running' : run.status} />
              <div className="kat-exec-run-info">
                <div className="kat-exec-run-name" title={run.suite_path}>
                  {run.suite_path.split('/').pop() || run.suite_path}
                </div>
                <div className="kat-exec-run-meta">
                  <Clock size={10} /> {formatTs(run.created_at)}
                </div>
                <div className="kat-exec-run-meta">
                  {run.browser} · {run.profile}
                  {run.passed_tests + run.failed_tests > 0 && (
                    <> · <span style={{ color: 'var(--success-color)' }}>{run.passed_tests}✓</span>
                    {run.failed_tests > 0 && <span style={{ color: 'var(--error-color)', marginLeft: 4 }}>{run.failed_tests}✗</span>}</>
                  )}
                </div>
              </div>
              <button
                className="toolbar-btn kat-delete-btn"
                onClick={(e) => handleDeleteRun(run.id, e)}
                title="Xóa"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right main panel ── */}
      <div className="kat-exec-main">
        {/* ── New Execution Form ── */}
        {showForm && (
          <div className="kat-exec-form-panel">
            <div className="kat-exec-form-header">
              <h2>Cấu hình Katalon Execution</h2>
              <button className="toolbar-btn" onClick={() => setShowForm(false)}><X size={14} /></button>
            </div>

            <div className="kat-exec-form-body">
              <div className="kat-form-grid">
                {/* Project selector */}
                <div className="kat-form-group full-width">
                  <label>Project (tùy chọn)</label>
                  <select
                    className="input-field"
                    value={config.project_id}
                    onChange={(e) => handleProjectChange(e.target.value)}
                  >
                    <option value="">-- Chọn project để tự điền đường dẫn --</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                {/* Katalon executable */}
                <PathPickerInput
                  id="exec-katalon-exe"
                  label="Đường dẫn Katalon CLI (katalonc.exe)"
                  type="file"
                  fileExtension=".exe"
                  value={config.katalon_executable_path}
                  onChange={(val) => setConfig((c) => ({ ...c, katalon_executable_path: val }))}
                  readOnly={false}
                  hint={
                    config.katalon_executable_path.trim()
                      ? 'Dùng đường dẫn tùy chỉnh này.'
                      : 'Để trống để dùng đường dẫn đã cấu hình từ server.'
                  }
                />

                {/* Project path */}
                <PathPickerInput
                  id="exec-project-path"
                  label={<>Project Path <span className="kat-required">*</span></>}
                  required
                  type="directory"
                  value={config.project_path}
                  onChange={(val) => setConfig((c) => ({ ...c, project_path: val }))}
                  placeholder="D:\auto-test\MyKatalonProject"
                />

                {/* Suite path */}
                <div className="kat-form-group full-width">
                  <label>Test Suite Path <span className="kat-required">*</span></label>
                  {suites.length > 0 ? (
                    <select
                      className="input-field"
                      value={config.suite_path}
                      onChange={(e) => setConfig((c) => ({ ...c, suite_path: e.target.value }))}
                    >
                      <option value="">-- Chọn suite --</option>
                      {suites.map((s) => (
                        <option key={s.id} value={`Test Suites/${s.name}`}>{s.name}</option>
                      ))}
                    </select>
                  ) : (
                    <PathPickerInput
                      id="exec-suite-path"
                      type="directory"
                      value={config.suite_path}
                      onChange={(val) => setConfig((c) => ({ ...c, suite_path: val }))}
                      readOnly={false}
                      placeholder="VD: Test Suites/LoginSuite"
                      hint="Nhập hoặc duyệt đến thư mục Test Suite trong project"
                    />
                  )}
                </div>

                {/* Browser */}
                <div className="kat-form-group">
                  <label>Browser</label>
                  <select
                    className="input-field"
                    value={config.browser}
                    onChange={(e) => setConfig((c) => ({ ...c, browser: e.target.value }))}
                  >
                    {BROWSERS.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>

                {/* OS */}
                <div className="kat-form-group">
                  <label>Operating System</label>
                  <select
                    className="input-field"
                    value={config.os}
                    onChange={(e) => setConfig((c) => ({ ...c, os: e.target.value }))}
                  >
                    {OS_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>

                {/* Profile */}
                <div className="kat-form-group">
                  <label>Execution Profile</label>
                  <select
                    className="input-field"
                    value={config.profile}
                    onChange={(e) => setConfig((c) => ({ ...c, profile: e.target.value }))}
                  >
                    {PROFILES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>

                {/* API Key */}
                <div className="kat-form-group">
                  <label>Katalon API Key</label>
                  <input
                    className="input-field"
                    type="password"
                    value={config.api_key}
                    onChange={(e) => setConfig((c) => ({ ...c, api_key: e.target.value }))}
                    placeholder="Để trống để dùng API key từ server"
                    autoComplete="off"
                  />
                  <span className="kat-field-hint">
                    {config.api_key.trim()
                      ? 'Dùng API key tùy chỉnh này.'
                      : 'Server đã cấu hình sẵn API key mặc định — để trống để dùng key đó.'}
                  </span>
                </div>
              </div>

              {/* CLI preview */}
              <div className="kat-cli-preview">
                <div className="kat-cli-preview-label">
                  <Terminal size={12} /> CLI Command Preview
                </div>
                <code className="kat-cli-code">
                  {config.katalon_executable_path || 'katalonc'} \<br />
                  {'  '}-projectPath="{config.project_path || '<project_path>'}" \<br />
                  {'  '}-testSuitePath="{config.suite_path || '<suite_path>'}" \<br />
                  {'  '}-browserType="{config.browser}" \<br />
                  {'  '}-executionProfile="{config.profile}"{config.api_key && ` \\\n  -apiKey="***"`}
                </code>
              </div>

              <div className="kat-form-actions">
                <button
                  className="toolbar-btn"
                  onClick={() => setShowForm(false)}
                >
                  Hủy
                </button>
                <button
                  className="toolbar-btn run"
                  onClick={handleSubmit}
                  disabled={submitting || !config.project_path.trim() || !config.suite_path.trim()}
                >
                  <Play size={14} />
                  {submitting ? 'Đang chạy...' : 'Chạy Test'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Live log panel (while running) ── */}
        {!showForm && (isLiveRun || (liveRunId && selectedRunId === liveRunId)) && (
          <LiveLogPanel
            runId={liveRunId}
            logs={liveLogs}
            status={liveStatus}
            logEndRef={logEndRef}
            onClose={() => { setSelectedRunId(null); setLiveRunId(null); setLiveLogs([]); }}
          />
        )}

        {/* ── Past run detail ── */}
        {!showForm && selectedRunId && selectedRunId !== liveRunId && (
          loadingDetail ? (
            <div className="kat-exec-loading">
              <RefreshCw size={20} className="spin" /> Đang tải...
            </div>
          ) : selectedRunDetail ? (
            <RunDetailPanel
              run={selectedRunDetail}
              onClose={() => { setSelectedRunId(null); setSelectedRunDetail(null); }}
            />
          ) : null
        )}

        {/* ── Empty state ── */}
        {!showForm && !selectedRunId && !liveRunId && (
          <div className="kat-exec-empty-main">
            <Play size={48} />
            <h3>Katalon Run Engine</h3>
            <p>Tích hợp với Katalon Runtime Engine để chạy test suite tự động.</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              {onOpenDashboard && (
                <button className="toolbar-btn" onClick={onOpenDashboard}>
                  <LayoutDashboard size={14} /> Xem Dashboard
                </button>
              )}
              <button className="toolbar-btn run" onClick={handleNewExecution}>
                <Plus size={14} /> Tạo Execution mới
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* ────────────────── Live Log Panel ────────────────── */
function LiveLogPanel({ runId, logs, status, logEndRef, onClose }) {
  return (
    <div className="kat-detail-panel">
      <div className="kat-detail-header">
        <div className="kat-detail-title">
          <Terminal size={16} />
          <span>Live Execution Log</span>
          <StatusBadge status={status} />
        </div>
        <button className="toolbar-btn" onClick={onClose}><X size={14} /></button>
      </div>

      <div className="kat-log-viewer">
        {logs.length === 0 && (
          <div className="kat-log-waiting">
            <span className="running-dot" style={{ background: 'var(--accent-color)', display: 'inline-block', marginRight: 8 }} />
            Đang chờ output từ Katalon CLI...
          </div>
        )}
        {logs.map((entry, i) => (
          <div key={i} className={`kat-log-line kat-log-${entry.level}`}>
            <span className="kat-log-time">{entry.time}</span>
            <span className="kat-log-msg">{entry.message}</span>
          </div>
        ))}
        <div ref={logEndRef} />
      </div>

      {status !== 'running' && (
        <div className="kat-detail-footer">
          <StatusBadge status={status} />
          <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginLeft: 8 }}>
            Execution hoàn tất
          </span>
        </div>
      )}
    </div>
  );
}

/* ────────────────── Past Run Detail Panel ────────────────── */
function RunDetailPanel({ run, onClose }) {
  const [activeTab, setActiveTab] = useState('logs');

  const passRate = run.total_tests > 0
    ? Math.round((run.passed_tests / run.total_tests) * 100)
    : null;

  return (
    <div className="kat-detail-panel">
      <div className="kat-detail-header">
        <div className="kat-detail-title">
          <Terminal size={16} />
          <span>{run.suite_path.split('/').pop() || run.suite_path}</span>
          <StatusBadge status={run.status} />
        </div>
        <button className="toolbar-btn" onClick={onClose}><X size={14} /></button>
      </div>

      {/* Summary cards */}
      <div className="kat-summary-bar">
        <div className="kat-summary-card">
          <span className="kat-summary-label">Duration</span>
          <span className="kat-summary-val">{formatDuration(run.duration_ms)}</span>
        </div>
        <div className="kat-summary-card">
          <span className="kat-summary-label">Browser</span>
          <span className="kat-summary-val">{run.browser}</span>
        </div>
        <div className="kat-summary-card">
          <span className="kat-summary-label">Profile</span>
          <span className="kat-summary-val">{run.profile}</span>
        </div>
        {run.os && (
          <div className="kat-summary-card">
            <span className="kat-summary-label">OS</span>
            <span className="kat-summary-val">{run.os}</span>
          </div>
        )}
        {run.total_tests > 0 && (
          <>
            <div className="kat-summary-card">
              <span className="kat-summary-label">Passed</span>
              <span className="kat-summary-val" style={{ color: 'var(--success-color)' }}>{run.passed_tests}</span>
            </div>
            <div className="kat-summary-card">
              <span className="kat-summary-label">Failed</span>
              <span className="kat-summary-val" style={{ color: run.failed_tests > 0 ? 'var(--error-color)' : 'var(--text-secondary)' }}>{run.failed_tests}</span>
            </div>
            <div className="kat-summary-card">
              <span className="kat-summary-label">Pass Rate</span>
              <span className="kat-summary-val" style={{ color: passRate >= 100 ? 'var(--success-color)' : passRate < 50 ? 'var(--error-color)' : 'var(--warning-color)' }}>
                {passRate}%
              </span>
            </div>
          </>
        )}
        <div className="kat-summary-card" style={{ marginLeft: 'auto' }}>
          <span className="kat-summary-label">Started</span>
          <span className="kat-summary-val" style={{ fontSize: '0.75rem' }}>{formatTs(run.created_at)}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="exec-subtabs" style={{ marginBottom: 0 }}>
        <button
          className={`exec-subtab ${activeTab === 'logs' ? 'active' : ''}`}
          onClick={() => setActiveTab('logs')}
        >LOGS</button>
        <button
          className={`exec-subtab ${activeTab === 'config' ? 'active' : ''}`}
          onClick={() => setActiveTab('config')}
        >CONFIG</button>
      </div>

      {activeTab === 'logs' && (
        <div className="kat-log-viewer">
          {(!run.logs || run.logs.length === 0) ? (
            <div className="kat-log-waiting">Không có log nào được ghi lại.</div>
          ) : (
            run.logs.map((entry, i) => (
              <div key={i} className={`kat-log-line kat-log-${entry.level}`}>
                <span className="kat-log-time">
                  {new Date(entry.logged_at).toLocaleTimeString('vi-VN')}
                </span>
                <span className="kat-log-msg">{entry.message}</span>
              </div>
            ))
          )}
          {run.error_message && (
            <div className="kat-log-line kat-log-error">
              <span className="kat-log-time">ERR</span>
              <span className="kat-log-msg">{run.error_message}</span>
            </div>
          )}
        </div>
      )}

      {activeTab === 'config' && (
        <div className="kat-config-view">
          {[
            ['Suite Path', run.suite_path],
            ['Project Path', run.project_path],
            ['Browser', run.browser],
            ['OS', run.os || '—'],
            ['Profile', run.profile],
            ['Katalon CLI', run.katalon_executable_path || '(default)'],
            ['Exit Code', run.exit_code != null ? String(run.exit_code) : '—'],
          ].map(([label, val]) => (
            <div key={label} className="kat-config-row">
              <span className="kat-config-label">{label}</span>
              <code className="kat-config-val">{val}</code>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ExecutionsTab;
