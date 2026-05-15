import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle, CheckCircle2, ChevronDown, ChevronRight,
  Clock, ClipboardList, FolderOpen, LayoutDashboard, Play,
  Plus, RefreshCw, Terminal, Trash2, X,
} from 'lucide-react';

import { listProjects } from '../projects/projects.api';
import { scanProjectSuites } from '../suites/suites.api';
import { deleteExecution, getExecution, listExecutions, startExecution } from './executions.api';
import PathPickerInput from '../../components/PathPickerInput';

const BROWSERS    = ['Chrome', 'Firefox', 'Edge', 'Chrome (headless)', 'Firefox (headless)'];
const PROFILES    = ['default', 'dev', 'staging', 'production'];
const OS_OPTIONS  = ['Windows', 'macOS', 'Linux'];

const STATUS_META = {
  running:  { label: 'RUNNING',  cls: 'kat-status-running'  },
  passed:   { label: 'PASSED',   cls: 'kat-status-passed'   },
  failed:   { label: 'FAILED',   cls: 'kat-status-failed'   },
  error:    { label: 'ERROR',    cls: 'kat-status-error'     },
  pending:  { label: 'PENDING',  cls: 'kat-status-pending'  },
};

// Per-test-case status
const TC_STATUS_META = {
  PASSED:     { cls: 'tc-s-passed',     label: 'PASSED'     },
  FAILED:     { cls: 'tc-s-failed',     label: 'FAILED'     },
  ERROR:      { cls: 'tc-s-error',      label: 'ERROR'      },
  SKIPPED:    { cls: 'tc-s-skipped',    label: 'SKIPPED'    },
  INCOMPLETE: { cls: 'tc-s-incomplete', label: 'INCOMPLETE' },
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

// ── Shared helpers ────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || { label: status?.toUpperCase() || '—', cls: 'kat-status-pending' };
  return <span className={`kat-status-badge ${meta.cls}`}>{meta.label}</span>;
}

function TcStatusBadge({ status }) {
  const meta = TC_STATUS_META[status?.toUpperCase()] || TC_STATUS_META.PASSED;
  return <span className={`tc-status-badge ${meta.cls}`}>{meta.label}</span>;
}

function formatDuration(ms) {
  if (!ms) return '—';
  if (ms < 1000)  return `${ms}ms`;
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

function suiteName(run) {
  return run.suite_name || run.suite_path?.split(/[/\\]/).pop() || run.suite_path || '—';
}

// ── Main component ────────────────────────────────────────────────────────────

const ExecutionsTab = ({ katalonWsEvent, initialRunId, onInitialRunConsumed, onOpenDashboard }) => {
  const [runs, setRuns]                     = useState([]);
  const [selectedRunId, setSelectedRunId]   = useState(null);
  const [selectedRunDetail, setSelectedRunDetail] = useState(null);
  const [showForm, setShowForm]             = useState(false);
  const [loadingRuns, setLoadingRuns]       = useState(false);
  const [loadingDetail, setLoadingDetail]   = useState(false);
  const [submitting, setSubmitting]         = useState(false);

  const [config, setConfig]     = useState(EMPTY_CONFIG);
  const [projects, setProjects] = useState([]);

  const [suiteTree, setSuiteTree]         = useState(null);
  const [testSuitesPath, setTestSuitesPath] = useState('');
  const [scanningTree, setScanningTree]   = useState(false);
  const [treeScanError, setTreeScanError] = useState('');

  // Live execution tracking
  const [liveRunId, setLiveRunId]       = useState(null);
  const [liveLogs, setLiveLogs]         = useState([]);
  const [liveStatus, setLiveStatus]     = useState(null);
  const logEndRef = useRef(null);

  // ── Data fetching ───────────────────────────────────────────────────────────
  const fetchRuns = useCallback(async () => {
    setLoadingRuns(true);
    try {
      const data = await listExecutions({ page: 1, limit: 20 });
      setRuns(data.runs || []);
    } catch { /* silently fail */ } finally {
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
    } catch { /* silently fail */ }
  }, []);

  useEffect(() => {
    fetchRuns();
    fetchProjects();
  }, [fetchRuns, fetchProjects]);

  // Auto-scroll logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [liveLogs]);

  // ── WebSocket events from MainApp ───────────────────────────────────────────
  useEffect(() => {
    if (!katalonWsEvent) return;
    switch (katalonWsEvent.type) {

      case 'katalon_start':
        setLiveRunId(katalonWsEvent.runId);
        setLiveLogs([]);
        setLiveStatus('running');
        break;

      case 'katalon_log':
        if (liveRunId || katalonWsEvent.runId) {
          setLiveLogs((prev) => [
            ...prev,
            { level: katalonWsEvent.level, message: katalonWsEvent.message, time: new Date().toLocaleTimeString() },
          ]);
        }
        break;

      case 'katalon_complete':
        setLiveStatus(katalonWsEvent.status);
        setSubmitting(false);
        fetchRuns();
        // Always fetch detail for the completed run so RunDetailPanel shows immediately
        fetchDetail(katalonWsEvent.runId);
        break;

      default:
        break;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [katalonWsEvent]);

  // ── Project / suite selection ───────────────────────────────────────────────
  async function handleProjectChange(projectId) {
    setConfig((prev) => ({ ...prev, project_id: projectId, suite_path: '' }));
    setSuiteTree(null);
    setTreeScanError('');

    if (!projectId) { setTestSuitesPath(''); return; }

    const project = projects.find((p) => p.id === projectId);
    if (project?.katalon_project_path) {
      setConfig((prev) => ({ ...prev, project_path: project.katalon_project_path }));
      setTestSuitesPath(`${project.katalon_project_path}\\tests\\suites`);
    }

    setScanningTree(true);
    try {
      const data = await scanProjectSuites(projectId);
      setSuiteTree({ tree: data.tree || [], suiteCount: data.suiteCount || 0 });
      if (data.testSuitesPath) setTestSuitesPath(data.testSuitesPath);
    } catch (err) {
      setTreeScanError(err?.response?.data?.error || 'Không thể quét thư mục Test Suites');
    } finally {
      setScanningTree(false);
    }
  }

  // ── Run actions ─────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!config.project_path.trim() || !config.suite_path.trim()) return;
    setSubmitting(true);
    setLiveLogs([]);
    setLiveStatus('running');
    setShowForm(false);
    try {
      const data   = await startExecution(config);
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

  // Pre-select a run when navigating from Dashboard
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
    // Always fetch the full detail (logs + testCaseDetails)
    await fetchDetail(run.id);
  }

  async function handleDeleteRun(id, e) {
    e.stopPropagation();
    await deleteExecution(id);
    setRuns((prev) => prev.filter((r) => r.id !== id));
    if (selectedRunId === id) { setSelectedRunId(null); setSelectedRunDetail(null); }
    if (liveRunId === id)     { setLiveRunId(null);     setLiveLogs([]); }
  }

  function handleNewExecution() {
    setShowForm(true);
    setSelectedRunId(null);
    setSelectedRunDetail(null);
  }

  // ── Display logic ───────────────────────────────────────────────────────────
  // Show LiveLogPanel ONLY while the selected run is actively executing
  const isActivelyRunning = selectedRunId === liveRunId && liveStatus === 'running';
  // Show RunDetailPanel for any selected, non-running run (including just-finished live runs)
  const showDetailPanel = !showForm && !!selectedRunId && !isActivelyRunning;

  return (
    <div className="kat-exec-layout">

      {/* ── Left sidebar: run history ── */}
      <div className="kat-exec-sidebar">
        <div className="kat-exec-sidebar-header">
          <div className="kat-exec-sidebar-title">
            <Play size={16} />
            <span>Executions</span>
            {liveStatus === 'running' && (
              <span className="running-indicator" style={{ fontSize: '0.7rem' }}>
                <span className="running-dot" /> Live
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {onOpenDashboard && (
              <button className="toolbar-btn" onClick={onOpenDashboard} title="Dashboard">
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
          {/* Placeholder while live run hasn't appeared in list yet */}
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

          {runs.map((run) => {
            const effectiveStatus = run.id === liveRunId && liveStatus === 'running'
              ? 'running' : run.status;
            return (
              <div
                key={run.id}
                className={`kat-exec-run-item ${selectedRunId === run.id ? 'active' : ''}`}
                onClick={() => handleSelectRun(run)}
              >
                <StatusBadge status={effectiveStatus} />
                <div className="kat-exec-run-info">
                  <div className="kat-exec-run-name" title={run.suite_path}>
                    {suiteName(run)}
                  </div>
                  <div className="kat-exec-run-meta">
                    <Clock size={10} /> {formatTs(run.created_at)}
                  </div>
                  <div className="kat-exec-run-meta">
                    {run.browser} · {run.profile}
                    {(run.passed_tests + run.failed_tests) > 0 && (
                      <>
                        {' · '}
                        <span style={{ color: 'var(--success-color)' }}>{run.passed_tests}✓</span>
                        {run.failed_tests > 0 && (
                          <span style={{ color: 'var(--error-color)', marginLeft: 4 }}>{run.failed_tests}✗</span>
                        )}
                      </>
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
            );
          })}
        </div>
      </div>

      {/* ── Right main panel ── */}
      <div className="kat-exec-main">

        {/* ── New Execution Form ── */}
        {showForm && (
          <div className="kat-exec-form-panel">
            <div className="kat-exec-form-header">
              <h2>Cấu hình Execution</h2>
              <button className="toolbar-btn" onClick={() => setShowForm(false)}><X size={14} /></button>
            </div>

            <div className="kat-exec-form-body">
              <div className="kat-form-grid">
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


                <PathPickerInput
                  id="exec-project-path"
                  label={<>Project Path <span className="kat-required">*</span></>}
                  required
                  type="directory"
                  value={config.project_path}
                  onChange={(val) => setConfig((c) => ({ ...c, project_path: val }))}
                  placeholder="D:\Projects\MyProject"
                />

                <div className="kat-form-group full-width">
                  <label>Test Suite Path <span className="kat-required">*</span></label>

                  {scanningTree && (
                    <div className="kat-scan-loading">
                      <RefreshCw size={13} className="spin" /> Đang quét Test Suites...
                    </div>
                  )}

                  {!scanningTree && treeScanError && (
                    <>
                      <div className="kat-scan-error">
                        <AlertCircle size={13} /> {treeScanError}
                      </div>
                      <PathPickerInput
                        id="exec-suite-path"
                        type="directory"
                        startPath={testSuitesPath}
                        value={config.suite_path}
                        onChange={(val) => setConfig((c) => ({ ...c, suite_path: val }))}
                        placeholder="VD: Test Suites/LoginSuite"
                        hint="Nhập hoặc duyệt đến thư mục Test Suite trong project"
                      />
                    </>
                  )}

                  {!scanningTree && suiteTree && (
                    suiteTree.tree.length > 0 ? (
                      <>
                        <SuiteTreePicker
                          tree={suiteTree.tree}
                          selected={config.suite_path}
                          onSelect={(p) => setConfig((c) => ({ ...c, suite_path: p }))}
                        />
                        {config.suite_path && (
                          <div className="suite-tree-selected-path">
                            Đã chọn: <code>{config.suite_path}</code>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="kat-scan-empty">
                        <FolderOpen size={18} />
                        Không tìm thấy Test Suite nào trong project này.
                      </div>
                    )
                  )}

                  {!scanningTree && !suiteTree && !treeScanError && (
                    <PathPickerInput
                      id="exec-suite-path"
                      type="directory"
                      startPath={testSuitesPath}
                      value={config.suite_path}
                      onChange={(val) => setConfig((c) => ({ ...c, suite_path: val }))}
                      placeholder="VD: Test Suites/LoginSuite"
                      hint="Chọn project ở trên để tự động quét, hoặc duyệt thủ công"
                    />
                  )}
                </div>

                <div className="kat-form-group">
                  <label>Browser</label>
                  <select className="input-field" value={config.browser}
                    onChange={(e) => setConfig((c) => ({ ...c, browser: e.target.value }))}>
                    {BROWSERS.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>

                <div className="kat-form-group">
                  <label>Operating System</label>
                  <select className="input-field" value={config.os}
                    onChange={(e) => setConfig((c) => ({ ...c, os: e.target.value }))}>
                    {OS_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>

                <div className="kat-form-group">
                  <label>Execution Profile</label>
                  <select className="input-field" value={config.profile}
                    onChange={(e) => setConfig((c) => ({ ...c, profile: e.target.value }))}>
                    {PROFILES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>

              </div>

              <div className="kat-cli-preview">
                <div className="kat-cli-preview-label">
                  <Terminal size={12} /> Mocha Command Preview
                </div>
                <code className="kat-cli-code">
                  node mocha \<br />
                  {'  '}"{config.suite_path ? `tests/suites/${config.suite_path.split(/[/\\]/).pop()}.spec.js` : 'tests/suites/<suite>.spec.js'}" \<br />
                  {'  '}--reporter mochawesome \<br />
                  {'  '}--timeout 30000 --exit
                </code>
              </div>

              <div className="kat-form-actions">
                <button className="toolbar-btn" onClick={() => setShowForm(false)}>Hủy</button>
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

        {/* ── Live log panel (while actively running) ── */}
        {!showForm && isActivelyRunning && (
          <LiveLogPanel
            runId={liveRunId}
            logs={liveLogs}
            status={liveStatus}
            logEndRef={logEndRef}
            onClose={() => { setSelectedRunId(null); setLiveRunId(null); setLiveLogs([]); }}
          />
        )}

        {/* ── Run detail panel (completed runs, including recently-finished live run) ── */}
        {showDetailPanel && (
          loadingDetail ? (
            <div className="kat-exec-loading">
              <RefreshCw size={20} className="spin" /> Đang tải chi tiết...
            </div>
          ) : selectedRunDetail ? (
            <RunDetailPanel
              run={selectedRunDetail}
              onClose={() => { setSelectedRunId(null); setSelectedRunDetail(null); }}
            />
          ) : null
        )}

        {/* ── Empty state ── */}
        {!showForm && !selectedRunId && !liveRunId && liveStatus !== 'running' && (
          <div className="kat-exec-empty-main">
            <Play size={48} />
            <h3>Run Engine</h3>
            <p>Tích hợp với Mocha + Playwright để chạy test suite tự động.</p>
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
function LiveLogPanel({ logs, status, logEndRef, onClose }) {
  const isConnecting = status === 'running' && logs.length === 0;

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
        {isConnecting && (
          <div className="kat-log-waiting">
            <RefreshCw size={14} className="spin" style={{ marginRight: 8, opacity: 0.7 }} />
            Đang khởi động — có thể mất vài phút nếu đây là lần đầu chạy (tải Playwright browser)...
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
            Execution hoàn tất — chọn lại run từ sidebar để xem báo cáo đầy đủ.
          </span>
        </div>
      )}
    </div>
  );
}

/* ────────────────── Test Cases Tab ────────────────── */
function TestCasesTab({ testCaseDetails, parseWarning, totalFromRun, passedFromRun, failedFromRun }) {
  const [filter, setFilter]           = useState('all');
  const [expandedRows, setExpandedRows] = useState(new Set());

  const details = testCaseDetails || [];

  const counts = {
    all:        details.length,
    passed:     details.filter((tc) => tc.status === 'PASSED').length,
    failed:     details.filter((tc) => tc.status === 'FAILED').length,
    error:      details.filter((tc) => tc.status === 'ERROR').length,
    skipped:    details.filter((tc) => tc.status === 'SKIPPED').length,
    incomplete: details.filter((tc) => tc.status === 'INCOMPLETE').length,
  };

  const filtered = filter === 'all'
    ? details
    : details.filter((tc) => tc.status.toLowerCase() === filter);

  function toggleRow(i) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  }

  if (details.length === 0) {
    return (
      <div className="tc-empty-state">
        {parseWarning ? (
          <>
            <AlertCircle size={32} style={{ color: 'var(--warning-color)', opacity: 0.6 }} />
            <p>Không thể phân tích báo cáo.</p>
            <code className="tc-parse-warning-msg">{parseWarning}</code>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Raw logs vẫn có trong tab LOGS.
            </p>
            {(totalFromRun > 0) && (
              <div className="tc-fallback-counts">
                <span className="tc-s-passed" style={{ padding: '3px 10px', borderRadius: 20 }}>
                  <CheckCircle2 size={12} /> {passedFromRun} passed
                </span>
                <span className="tc-s-failed" style={{ padding: '3px 10px', borderRadius: 20, marginLeft: 8 }}>
                  ✗ {failedFromRun} failed
                </span>
              </div>
            )}
          </>
        ) : (
          <>
            <ClipboardList size={32} style={{ opacity: 0.4 }} />
            <p style={{ color: 'var(--text-secondary)' }}>
              Chưa có dữ liệu test case cho lần chạy này.
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="tc-panel">
      {parseWarning && (
        <div className="tc-parse-warning-bar">
          <AlertCircle size={12} /> {parseWarning}
        </div>
      )}

      <div className="tc-filter-bar">
        {[
          ['all',        'Tất cả',    counts.all],
          ['passed',     'Passed',    counts.passed],
          ['failed',     'Failed',    counts.failed],
          ['error',      'Error',     counts.error],
          ['skipped',    'Skipped',   counts.skipped],
          ['incomplete', 'Incomplete',counts.incomplete],
        ].filter(([key]) => key === 'all' || counts[key] > 0)
          .map(([key, label, count]) => (
            <button
              key={key}
              className={`tc-filter-btn tc-filter-${key} ${filter === key ? 'active' : ''}`}
              onClick={() => setFilter(key)}
            >
              {label}
              <span className="tc-filter-count">{count}</span>
            </button>
          ))
        }
      </div>

      <div className="tc-table-wrap">
        <table className="tc-table">
          <thead>
            <tr>
              <th style={{ width: 36 }}>#</th>
              <th>Test Case</th>
              <th style={{ width: 100 }}>Status</th>
              <th style={{ width: 80 }}>Duration</th>
              <th>Error Message</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((tc, i) => {
              // Bonus: all rows are expandable to show detail parameters
              const isExpandable = !!(tc.stack_trace || tc.parameters || tc.description || tc.test_case_id || tc.test_data);
              return (
                <>
                  <tr
                    key={i}
                    className={`tc-row tc-row-${tc.status.toLowerCase()}${isExpandable ? ' tc-row-expandable' : ''}`}
                    onClick={() => isExpandable && toggleRow(i)}
                    title={isExpandable ? 'Click để xem chi tiết' : undefined}
                  >
                    <td className="tc-num">{i + 1}</td>
                    <td className="tc-name">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {isExpandable && (
                          <ChevronDown
                            size={12}
                            style={{
                              opacity: 0.5,
                              transform: expandedRows.has(i) ? 'rotate(180deg)' : 'none',
                              transition: 'transform 0.15s',
                              flexShrink: 0,
                            }}
                          />
                        )}
                        <span>{tc.test_case_name}</span>
                      </div>
                    </td>
                    <td className="tc-status-cell"><TcStatusBadge status={tc.status} /></td>
                    <td className="tc-duration-cell">{formatDuration(tc.duration_ms)}</td>
                    <td className="tc-error-cell">
                      {tc.error_message ? (
                        <span title={tc.error_message}>
                          {tc.error_message.length > 90
                            ? `${tc.error_message.slice(0, 90)}…`
                            : tc.error_message}
                        </span>
                      ) : <span style={{ color: 'var(--text-secondary)' }}>—</span>}
                    </td>
                  </tr>
                  {isExpandable && expandedRows.has(i) && (
                    <tr key={`trace-${i}`} className="tc-trace-row">
                      <td colSpan={5}>
                        <div className="tc-detail-expand">
                          {/* Test case parameters / metadata */}
                          {(tc.test_case_id || tc.description || tc.parameters || tc.test_data) && (
                            <div className="tc-detail-section">
                              <div className="tc-detail-section-title">Thông tin Test Case</div>
                              <div className="tc-detail-grid">
                                {tc.test_case_id && (
                                  <div className="tc-detail-kv">
                                    <span>ID</span><code>{tc.test_case_id}</code>
                                  </div>
                                )}
                                {tc.test_case_name && (
                                  <div className="tc-detail-kv">
                                    <span>Tên</span><code>{tc.test_case_name}</code>
                                  </div>
                                )}
                                {tc.description && (
                                  <div className="tc-detail-kv">
                                    <span>Mô tả</span><code>{tc.description}</code>
                                  </div>
                                )}
                                {tc.duration_ms != null && (
                                  <div className="tc-detail-kv">
                                    <span>Thời gian</span><code>{formatDuration(tc.duration_ms)}</code>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Parameters (if any) */}
                          {tc.parameters && typeof tc.parameters === 'object' && Object.keys(tc.parameters).length > 0 && (
                            <div className="tc-detail-section">
                              <div className="tc-detail-section-title">Parameters</div>
                              <div className="tc-detail-grid">
                                {Object.entries(tc.parameters).map(([key, val]) => (
                                  <div key={key} className="tc-detail-kv">
                                    <span>{key}</span>
                                    <code>{typeof val === 'object' ? JSON.stringify(val) : String(val)}</code>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Test data (if any) */}
                          {tc.test_data && (
                            <div className="tc-detail-section">
                              <div className="tc-detail-section-title">Test Data</div>
                              <pre className="tc-trace-content">{typeof tc.test_data === 'object' ? JSON.stringify(tc.test_data, null, 2) : String(tc.test_data)}</pre>
                            </div>
                          )}

                          {/* Stack trace for failed tests */}
                          {tc.stack_trace && (
                            <div className="tc-detail-section">
                              <div className="tc-detail-section-title" style={{ color: 'var(--error-color)' }}>Stack Trace</div>
                              <pre className="tc-trace-content">{tc.stack_trace}</pre>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ────────────────── Past Run Detail Panel ────────────────── */
function RunDetailPanel({ run, onClose }) {
  // Auto-switch to test cases tab for passed runs (Bug 3: no logs needed for success)
  const [activeTab, setActiveTab] = useState(run.status === 'passed' ? 'testcases' : 'logs');

  const suite   = suiteName(run);
  const total   = run.total_tests   || 0;
  const passed  = run.passed_tests  || 0;
  const failed  = run.failed_tests  || 0;
  const skipped = run.skipped_tests || 0;
  const errored = run.error_tests   || 0;

  const passRate = total > 0 ? Math.round((passed / total) * 100) : null;

  const tcDetails = run.testCaseDetails || [];
  const hasTcs    = tcDetails.length > 0;

  return (
    <div className="kat-detail-panel">
      {/* Header */}
      <div className="kat-detail-header">
        <div className="kat-detail-title">
          <Terminal size={16} />
          <span title={run.suite_path}>{suite}</span>
          <StatusBadge status={run.status} />
        </div>
        <button className="toolbar-btn" onClick={onClose}><X size={14} /></button>
      </div>

      {/* Pass-rate banner */}
      {passRate !== null && (
        <div className={`kat-run-banner kat-run-banner-${run.status}`}>
          <div className="kat-banner-meta">
            <span className="kat-banner-project">{run.project_name || run.project_path?.split(/[/\\]/).pop() || ''}</span>
          </div>
          <div className="kat-pass-rate-row">
            <span className="kat-pass-rate-num">{passRate}%</span>
            <div className="kat-pass-bar">
              <div
                className="kat-pass-fill"
                style={{
                  width: `${passRate}%`,
                  background: passRate >= 100 ? 'var(--success-color)'
                    : passRate < 50 ? 'var(--error-color)'
                    : 'var(--warning-color)',
                }}
              />
            </div>
            <span className="kat-pass-rate-label">{passed}/{total} passed</span>
          </div>
        </div>
      )}

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
        {total > 0 && (
          <>
            <div className="kat-summary-card">
              <span className="kat-summary-label">Total</span>
              <span className="kat-summary-val">{total}</span>
            </div>
            <div className="kat-summary-card">
              <span className="kat-summary-label">Passed</span>
              <span className="kat-summary-val" style={{ color: 'var(--success-color)' }}>{passed}</span>
            </div>
            <div className="kat-summary-card">
              <span className="kat-summary-label">Failed</span>
              <span className="kat-summary-val" style={{ color: failed > 0 ? 'var(--error-color)' : 'var(--text-secondary)' }}>{failed}</span>
            </div>
            {errored > 0 && (
              <div className="kat-summary-card">
                <span className="kat-summary-label">Errors</span>
                <span className="kat-summary-val" style={{ color: 'var(--warning-color)' }}>{errored}</span>
              </div>
            )}
            {skipped > 0 && (
              <div className="kat-summary-card">
                <span className="kat-summary-label">Skipped</span>
                <span className="kat-summary-val" style={{ color: 'var(--text-secondary)' }}>{skipped}</span>
              </div>
            )}
          </>
        )}
        <div className="kat-summary-card">
          <span className="kat-summary-label">Started</span>
          <span className="kat-summary-val" style={{ fontSize: '0.75rem' }}>{formatTs(run.created_at)}</span>
        </div>
        {run.ended_at && (
          <div className="kat-summary-card">
            <span className="kat-summary-label">Ended</span>
            <span className="kat-summary-val" style={{ fontSize: '0.75rem' }}>{formatTs(run.ended_at)}</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="exec-subtabs">
        {/* Bug 3: Hide LOGS tab for passed runs - only show for failed/error runs */}
        {run.status !== 'passed' && (
          <button
            className={`exec-subtab ${activeTab === 'logs' ? 'active' : ''}`}
            onClick={() => setActiveTab('logs')}
          >
            LOGS
            {run.logs?.length > 0 && (
              <span className="tc-filter-count" style={{ marginLeft: 4 }}>{run.logs.length}</span>
            )}
          </button>
        )}
        <button
          className={`exec-subtab ${activeTab === 'testcases' ? 'active' : ''}`}
          onClick={() => setActiveTab('testcases')}
        >
          TEST CASES
          {total > 0 && (
            <span className="tc-filter-count" style={{ marginLeft: 4 }}>{hasTcs ? tcDetails.length : total}</span>
          )}
        </button>
        <button
          className={`exec-subtab ${activeTab === 'config' ? 'active' : ''}`}
          onClick={() => setActiveTab('config')}
        >
          CONFIG
        </button>
      </div>

      {/* ── Logs tab ── */}
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

      {/* ── Test Cases tab ── */}
      {activeTab === 'testcases' && (
        <TestCasesTab
          testCaseDetails={tcDetails}
          parseWarning={run.parse_warning}
          totalFromRun={total}
          passedFromRun={passed}
          failedFromRun={failed}
        />
      )}

      {/* ── Config tab ── */}
      {activeTab === 'config' && (
        <div className="kat-config-view">
          {[
            ['Suite Name',   suite],
            ['Suite Path',   run.suite_path],
            ['Project',      run.project_name || '—'],
            ['Project Path', run.project_path],
            ['Browser',      run.browser],
            ['OS',           run.os || '—'],
            ['Profile',      run.profile],
            ['Engine',       'Mocha + Playwright'],
            ['Exit Code',    run.exit_code != null ? String(run.exit_code) : '—'],
            ['Report Path',  run.report_path || '—'],
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

/* ────────────────── Suite Tree Picker ────────────────── */
function SuiteTreePicker({ tree, selected, onSelect }) {
  const [expanded, setExpanded] = useState(() => {
    const paths = new Set();
    function collect(nodes) {
      for (const node of nodes) {
        if (node.type === 'folder') {
          paths.add(node.path);
          if (node.children?.length) collect(node.children);
        }
      }
    }
    collect(tree);
    return paths;
  });

  function toggleFolder(p) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p); else next.add(p);
      return next;
    });
  }

  function renderNodes(nodes, depth) {
    return nodes.map((node) => {
      if (node.type === 'folder') {
        const isOpen = expanded.has(node.path);
        return (
          <div key={node.path}>
            <div
              className="suite-tree-folder"
              style={{ paddingLeft: depth * 16 + 8 }}
              onClick={() => toggleFolder(node.path)}
            >
              <ChevronRight size={12} className={`suite-tree-chevron${isOpen ? ' open' : ''}`} />
              <FolderOpen size={13} />
              <span className="suite-tree-node-name">{node.name}</span>
              {node.suiteCount > 0 && <span className="suite-tree-count">{node.suiteCount}</span>}
            </div>
            {isOpen && node.children?.length > 0 && renderNodes(node.children, depth + 1)}
          </div>
        );
      }
      const isSelected = selected === node.path;
      return (
        <div
          key={node.path}
          className={`suite-tree-suite${isSelected ? ' selected' : ''}`}
          style={{ paddingLeft: depth * 16 + 26 }}
          onClick={() => onSelect(node.path)}
          title={node.path}
        >
          <Play size={10} className="suite-tree-suite-icon" />
          <span className="suite-tree-node-name">{node.name}</span>
        </div>
      );
    });
  }

  return <div className="suite-tree-picker">{renderNodes(tree, 0)}</div>;
}

export default ExecutionsTab;
