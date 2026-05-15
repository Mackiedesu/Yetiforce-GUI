import { useCallback, useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  Activity, AlertTriangle, CheckCircle, ChevronLeft, ChevronRight,
  Clock, Cpu, Filter, RefreshCw, XCircle,
} from 'lucide-react';

import { getExecution, getExecutionStats, listExecutions } from './executions.api';

const STATUS_COLOR = {
  passed:  '#4CAF50',
  failed:  '#f44336',
  error:   '#FF9800',
  running: '#5865F2',
  pending: '#607D8B',
};

const STATUS_LABEL = {
  passed:  'Passed',
  failed:  'Failed',
  error:   'Error',
  running: 'Running',
  pending: 'Pending',
};

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

function StatusPill({ status }) {
  const color = STATUS_COLOR[status] || '#607D8B';
  const label = STATUS_LABEL[status] || status?.toUpperCase() || '—';
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: 12,
      fontSize: '0.72rem',
      fontWeight: 700,
      letterSpacing: '0.4px',
      background: `${color}22`,
      color,
      border: `1px solid ${color}66`,
    }}>
      {label}
    </span>
  );
}

/* ── Stat card ── */
function StatCard({ icon, label, value, sub, color }) {
  return (
    <div className="dash-stat-card">
      <div className="dash-stat-icon" style={{ color }}>{icon}</div>
      <div className="dash-stat-body">
        <div className="dash-stat-value" style={{ color }}>{value}</div>
        <div className="dash-stat-label">{label}</div>
        {sub && <div className="dash-stat-sub">{sub}</div>}
      </div>
    </div>
  );
}

/* ── Custom tooltip for bar chart ── */
function BarTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--bg-tertiary)',
      border: '1px solid var(--border-color)',
      borderRadius: 8,
      padding: '8px 12px',
      fontSize: '0.8rem',
      maxWidth: 280,
    }}>
      <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--text-primary)', wordBreak: 'break-word' }}>{label}</div>
      {payload.map((p) => (
        <div key={p.name} style={{ color: p.fill }}>
          {p.name}: <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  );
}

/* ── Custom X-axis tick — angled label for long suite names ── */
function BarXAxisTick({ x, y, payload }) {
  const name = payload.value || '';
  // Show up to 18 chars then ellipsis
  const display = name.length > 18 ? name.slice(0, 17) + '…' : name;
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={8}
        textAnchor="end"
        fill="var(--text-secondary)"
        fontSize={10}
        transform="rotate(-40)"
      >
        {display}
      </text>
    </g>
  );
}

/* ── Main dashboard ── */
export default function ExecutionDashboard({ onSelectRun, refreshTrigger }) {
  const [stats, setStats] = useState(null);
  const [runs, setRuns] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [detailRun, setDetailRun] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const PAGE_SIZE = 10;

  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const data = await getExecutionStats();
      setStats(data.stats);
    } catch {
      // silently fail
    } finally {
      setLoadingStats(false);
    }
  }, []);

  const fetchRuns = useCallback(async (p = 1, status = '') => {
    setLoadingRuns(true);
    try {
      const data = await listExecutions({ page: p, limit: PAGE_SIZE, status: status || undefined });
      setRuns(data.runs || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch {
      setRuns([]);
    } finally {
      setLoadingRuns(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchRuns(page, statusFilter);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger]);

  async function handleRowClick(run) {
    if (detailRun?.id === run.id) {
      setDetailRun(null);
      return;
    }
    setLoadingDetail(true);
    try {
      const data = await getExecution(run.id);
      setDetailRun(data.run);
    } catch {
      setDetailRun(null);
    } finally {
      setLoadingDetail(false);
    }
  }

  function handleFilterChange(status) {
    setStatusFilter(status);
    setPage(1);
    fetchRuns(1, status);
  }

  function handlePageChange(next) {
    const p = Math.max(1, Math.min(totalPages, next));
    setPage(p);
    fetchRuns(p, statusFilter);
  }

  function handleRefresh() {
    fetchStats();
    fetchRuns(page, statusFilter);
  }

  // Build pie data
  const pieData = stats
    ? Object.entries(stats.statusCounts)
        .filter(([, count]) => count > 0)
        .map(([key, count]) => ({ name: STATUS_LABEL[key] || key, value: count, key }))
    : [];

  // Build bar data from recent runs (chronological)
  const barData = stats
    ? [...(stats.recentRuns || [])].reverse().map((r) => {
        // Extract suite name from path, support both / and \
        const rawName = (r.suite_name) ||
          (r.suite_path || '').split(/[\/\\]/).pop() ||
          r.id.slice(0, 8);
        return {
          name: rawName,
          fullName: rawName, // keep full name for tooltip
          Passed: r.passed_tests,
          Failed: r.failed_tests,
        };
      })
    : [];

  const passRate = stats && (stats.totalPassed + stats.totalFailed) > 0
    ? Math.round((stats.totalPassed / (stats.totalPassed + stats.totalFailed)) * 100)
    : null;

  return (
    <div className="dash-root">
      {/* ── Header ── */}
      <div className="dash-header">
        <div className="dash-header-left">
          <Activity size={18} />
          <span>Execution Dashboard</span>
          <span className="dash-total-badge">{total} runs</span>
        </div>
        <button className="toolbar-btn" onClick={handleRefresh} title="Làm mới">
          <RefreshCw size={13} className={loadingStats ? 'spin' : ''} />
        </button>
      </div>

      <div className="dash-scroll">
        {/* ── Stats cards ── */}
        <div className="dash-stats-row">
          <StatCard
            icon={<Activity size={20} />}
            label="Total Runs"
            value={loadingStats ? '…' : stats?.totalRuns ?? 0}
            color="var(--accent-color)"
          />
          <StatCard
            icon={<CheckCircle size={20} />}
            label="Passed"
            value={loadingStats ? '…' : stats?.statusCounts?.passed ?? 0}
            sub={passRate != null ? `${passRate}% pass rate` : undefined}
            color="var(--success-color)"
          />
          <StatCard
            icon={<XCircle size={20} />}
            label="Failed"
            value={loadingStats ? '…' : (stats?.statusCounts?.failed ?? 0) + (stats?.statusCounts?.error ?? 0)}
            color="var(--error-color)"
          />
          <StatCard
            icon={<Clock size={20} />}
            label="Avg Duration"
            value={loadingStats ? '…' : formatDuration(Math.round(stats?.avgDurationMs || 0))}
            color="var(--warning-color)"
          />
          <StatCard
            icon={<Cpu size={20} />}
            label="Running"
            value={loadingStats ? '…' : stats?.statusCounts?.running ?? 0}
            color="var(--cyan-color)"
          />
        </div>

        {/* ── Charts row ── */}
        {!loadingStats && stats && stats.totalRuns > 0 && (
          <div className="dash-charts-row">
            {/* Pie chart */}
            <div className="dash-chart-card">
              <div className="dash-chart-title">Status Breakdown</div>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry) => (
                      <Cell key={entry.key} fill={STATUS_COLOR[entry.key] || '#607D8B'} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 8,
                      fontSize: '0.8rem',
                    }}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Bar chart */}
            <div className="dash-chart-card dash-chart-wide">
              <div className="dash-chart-title">Recent Pass / Fail (last 10 runs)</div>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={barData} barSize={14} barGap={2} margin={{ bottom: 30 }}>
                  <XAxis
                    dataKey="name"
                    tick={<BarXAxisTick />}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                    height={50}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={28}
                  />
                  <Tooltip
                    content={<BarTooltip />}
                    formatter={(value, name) => [value, name]}
                  />
                  <Bar dataKey="Passed" fill={STATUS_COLOR.passed} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Failed" fill={STATUS_COLOR.failed} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ── Table ── */}
        <div className="dash-table-section" style={{ minHeight: 0 }}>
          <div className="dash-table-header">
            <div className="dash-table-title">
              Execution History
              {total > 0 && <span className="dash-total-badge">{total}</span>}
            </div>
            <div className="dash-table-controls">
              <Filter size={13} style={{ color: 'var(--text-secondary)' }} />
              <select
                className="dash-filter-select"
                value={statusFilter}
                onChange={(e) => handleFilterChange(e.target.value)}
              >
                <option value="">All statuses</option>
                {Object.entries(STATUS_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="dash-table-wrap">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Run ID</th>
                  <th>Project</th>
                  <th>Test Suite</th>
                  <th>Browser</th>
                  <th>OS</th>
                  <th>Status</th>
                  <th>Start Time</th>
                  <th>Duration</th>
                  <th style={{ textAlign: 'center' }}>✓</th>
                  <th style={{ textAlign: 'center' }}>✗</th>
                  <th>Report</th>
                </tr>
              </thead>
              <tbody>
                {loadingRuns && (
                  <tr>
                    <td colSpan={11} className="dash-table-loading">
                      <RefreshCw size={14} className="spin" /> Loading…
                    </td>
                  </tr>
                )}
                {!loadingRuns && runs.length === 0 && (
                  <tr>
                    <td colSpan={11} className="dash-table-empty">
                      <AlertTriangle size={16} /> No executions found
                    </td>
                  </tr>
                )}
                {!loadingRuns && runs.map((run) => {
                  const isExpanded = detailRun?.id === run.id;
                  return [
                    <tr
                      key={run.id}
                      className={`dash-table-row ${isExpanded ? 'dash-row-expanded' : ''}`}
                      onClick={() => handleRowClick(run)}
                    >
                      <td className="dash-cell-id" title={run.id}>{run.id.slice(0, 8)}…</td>
                      <td className="dash-cell-project">{run.project_name || <span style={{ color: 'var(--text-secondary)' }}>—</span>}</td>
                      <td className="dash-cell-suite" title={run.suite_path}>
                        {run.suite_path.split('/').pop() || run.suite_path}
                      </td>
                      <td>{run.browser}</td>
                      <td>{run.os || '—'}</td>
                      <td><StatusPill status={run.status} /></td>
                      <td className="dash-cell-time">{formatTs(run.created_at)}</td>
                      <td>{formatDuration(run.duration_ms)}</td>
                      <td style={{ textAlign: 'center', color: 'var(--success-color)', fontWeight: 700 }}>
                        {run.passed_tests > 0 ? run.passed_tests : '—'}
                      </td>
                      <td style={{ textAlign: 'center', color: run.failed_tests > 0 ? 'var(--error-color)' : 'var(--text-secondary)', fontWeight: 700 }}>
                        {run.failed_tests > 0 ? run.failed_tests : '—'}
                      </td>
                      <td>
                        <button
                          className="dash-report-btn"
                          onClick={(e) => { e.stopPropagation(); onSelectRun(run); }}
                          title="Xem report đầy đủ trong Run Engine"
                        >
                          View Report
                        </button>
                      </td>
                    </tr>,
                    isExpanded && (
                      <tr key={`${run.id}-detail`} className="dash-expanded-row">
                        <td colSpan={11}>
                          {loadingDetail ? (
                            <div className="dash-expand-loading"><RefreshCw size={13} className="spin" /> Loading detail…</div>
                          ) : (
                            <InlineRunDetail run={detailRun} onOpenFull={() => onSelectRun(run)} />
                          )}
                        </td>
                      </tr>
                    ),
                  ];
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="dash-pagination">
              <span className="dash-page-info">
                Page {page} of {totalPages} · {total} total
              </span>
              <div className="dash-page-btns">
                <button
                  className="toolbar-btn"
                  disabled={page <= 1}
                  onClick={() => handlePageChange(page - 1)}
                >
                  <ChevronLeft size={14} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                  .reduce((acc, p, idx, arr) => {
                    if (idx > 0 && p - arr[idx - 1] > 1) acc.push('…');
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, i) =>
                    p === '…' ? (
                      <span key={`ellipsis-${i}`} className="dash-page-ellipsis">…</span>
                    ) : (
                      <button
                        key={p}
                        className={`toolbar-btn dash-page-num ${p === page ? 'dash-page-active' : ''}`}
                        onClick={() => handlePageChange(p)}
                      >
                        {p}
                      </button>
                    )
                  )}
                <button
                  className="toolbar-btn"
                  disabled={page >= totalPages}
                  onClick={() => handlePageChange(page + 1)}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Inline expanded detail (mini report) ── */
function InlineRunDetail({ run, onOpenFull }) {
  if (!run) return null;

  const passRate = run.total_tests > 0
    ? Math.round((run.passed_tests / run.total_tests) * 100)
    : null;

  return (
    <div className="dash-inline-detail">
      <div className="dash-inline-summary">
        <div className="dash-inline-kv">
          <span>Suite Path</span><code>{run.suite_path}</code>
        </div>
        <div className="dash-inline-kv">
          <span>Project Path</span><code>{run.project_path}</code>
        </div>
        <div className="dash-inline-kv">
          <span>Profile</span><code>{run.profile}</code>
        </div>
        {run.exit_code != null && (
          <div className="dash-inline-kv">
            <span>Exit Code</span><code>{run.exit_code}</code>
          </div>
        )}
        {passRate != null && (
          <div className="dash-inline-kv">
            <span>Pass Rate</span>
            <code style={{ color: passRate >= 100 ? 'var(--success-color)' : passRate < 50 ? 'var(--error-color)' : 'var(--warning-color)' }}>
              {passRate}%
            </code>
          </div>
        )}
        {run.error_message && (
          <div className="dash-inline-kv">
            <span>Error</span>
            <code style={{ color: 'var(--error-color)', whiteSpace: 'pre-wrap' }}>{run.error_message}</code>
          </div>
        )}
      </div>

      {run.logs && run.logs.length > 0 && (
        <div className="dash-inline-logs">
          {run.logs.slice(0, 8).map((l, i) => (
            <div key={i} className={`kat-log-line kat-log-${l.level}`} style={{ padding: '2px 0' }}>
              <span className="kat-log-time">{new Date(l.logged_at).toLocaleTimeString('vi-VN')}</span>
              <span className="kat-log-msg">{l.message}</span>
            </div>
          ))}
          {run.logs.length > 8 && (
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.77rem', marginTop: 4 }}>
              …{run.logs.length - 8} more lines
            </div>
          )}
        </div>
      )}

      <button className="dash-report-btn" style={{ marginTop: 10 }} onClick={onOpenFull}>
        Open Full Report →
      </button>
    </div>
  );
}
