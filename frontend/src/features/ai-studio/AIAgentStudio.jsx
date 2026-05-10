import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle, Bot, Check, CheckSquare, ChevronDown, ChevronRight,
  ClipboardList, Code2, Database, FileCheck, Globe, Loader2,
  RefreshCw, Save, ScanLine, Sparkles, Square, X,
} from 'lucide-react';

import { listProjects } from '../projects/projects.api';
import { scanUrl, generateFromDom, saveTestCases } from './aiAgent.api';

// ─── Element tag colours (shared with old Scanner) ──────────────────────────
const TAG_META = {
  input:    { bg: '#dbeafe', color: '#1d4ed8', label: 'INPUT'    },
  textarea: { bg: '#ede9fe', color: '#7c3aed', label: 'TEXTAREA' },
  select:   { bg: '#fef9c3', color: '#a16207', label: 'SELECT'   },
  button:   { bg: '#dcfce7', color: '#16a34a', label: 'BUTTON'   },
  a:        { bg: '#ffedd5', color: '#c2410c', label: 'LINK'     },
  form:     { bg: '#fce7f3', color: '#be185d', label: 'FORM'     },
};

function TagChip({ tag }) {
  const m = TAG_META[tag] || { bg: '#f1f5f9', color: '#475569', label: tag.toUpperCase() };
  return (
    <span style={{
      background: m.bg, color: m.color,
      fontSize: '0.6rem', fontWeight: 700, borderRadius: 4,
      padding: '1px 6px', letterSpacing: 0.5, flexShrink: 0,
    }}>{m.label}</span>
  );
}

const TC_TABS = [
  { id: 'steps',    icon: ClipboardList, label: 'Steps'    },
  { id: 'expected', icon: FileCheck,     label: 'Expected' },
  { id: 'data',     icon: Database,      label: 'Data'     },
  { id: 'locators', icon: Globe,         label: 'Locators' },
  { id: 'script',   icon: Code2,         label: 'Script'   },
];

// ─── DOM Summary chip row ────────────────────────────────────────────────────
function DomSummary({ scanResult, onRescan }) {
  const counts = ['input', 'textarea', 'select', 'button', 'a', 'form'].reduce((acc, tag) => {
    const n = scanResult.elements.filter((e) => e.tag === tag).length;
    if (n > 0) acc[tag] = n;
    return acc;
  }, {});

  return (
    <div className="studio-dom-summary">
      <div className="studio-dom-page">
        <Globe size={12} style={{ flexShrink: 0 }} />
        <span className="studio-dom-title" title={scanResult.title}>{scanResult.title || '(no title)'}</span>
        <button className="studio-rescan-btn" onClick={onRescan} title="Quét lại">
          <RefreshCw size={11} />
        </button>
      </div>
      <div className="studio-dom-chips">
        {Object.entries(counts).map(([tag, n]) => {
          const m = TAG_META[tag] || {};
          return (
            <span key={tag} style={{
              background: m.bg, color: m.color,
              fontSize: '0.62rem', fontWeight: 700,
              borderRadius: 12, padding: '2px 8px',
            }}>
              {m.label || tag.toUpperCase()} ×{n}
            </span>
          );
        })}
        <span style={{ fontSize: '0.62rem', color: 'var(--text-secondary)' }}>
          {scanResult.elements.length} total
        </span>
      </div>
    </div>
  );
}

// ─── DOM Elements preview table ──────────────────────────────────────────────
function DomElementsTable({ elements }) {
  const [expanded, setExpanded] = useState({});
  const toggle = (i) => setExpanded((p) => ({ ...p, [i]: !p[i] }));
  const interactive = elements.filter((e) => e.tag !== 'form');
  const forms = elements.filter((e) => e.tag === 'form');

  return (
    <div className="studio-dom-table-wrap">
      {forms.length > 0 && (
        <div className="studio-dom-forms">
          {forms.map((f, i) => (
            <span key={i} className="studio-dom-form-badge">
              <TagChip tag="form" />
              <code style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                {f.id ? `#${f.id}` : f.name || 'anonymous'}
                {' '}&bull;{' '}
                {(f.action || '').replace(/^https?:\/\/[^/]+/, '') || '/'}
              </code>
            </span>
          ))}
        </div>
      )}

      <table className="scanner-table">
        <thead>
          <tr>
            <th>#</th><th>Type</th><th>ID / Name</th><th>Label / Text</th><th>Selector</th><th />
          </tr>
        </thead>
        <tbody>
          {interactive.map((el, i) => (
            <>
              <tr key={i} className="scanner-table-row" onClick={() => toggle(i)} style={{ cursor: 'pointer' }}>
                <td style={{ color: '#94a3b8', fontSize: '0.7rem' }}>{i + 1}</td>
                <td><TagChip tag={el.tag} /></td>
                <td style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#334155' }}>
                  {el.id ? `#${el.id}` : el.name ? `[name="${el.name}"]` : '—'}
                </td>
                <td style={{ fontSize: '0.75rem', color: '#475569', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {el.label || el.text || el.placeholder || el.href?.replace(/^https?:\/\/[^/]+/, '') || '—'}
                </td>
                <td style={{ fontSize: '0.7rem', fontFamily: 'monospace', color: '#7c3aed', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {el.selector}
                </td>
                <td style={{ padding: '0 6px' }}>
                  {expanded[i] ? <ChevronDown size={12} color="#94a3b8" /> : <ChevronRight size={12} color="#94a3b8" />}
                </td>
              </tr>
              {expanded[i] && (
                <tr key={`x-${i}`} className="scanner-table-expand">
                  <td colSpan={6}>
                    <div className="scanner-expand-body">
                      <div><span>XPath:</span><code>{el.xpath}</code></div>
                      {el.type && <div><span>Type:</span><code>{el.type}</code></div>}
                      {el.isRequired && <div><span>Required:</span><code>true</code></div>}
                      {el.href && <div><span>href:</span><code style={{ wordBreak: 'break-all' }}>{el.href}</code></div>}
                    </div>
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Test case card ──────────────────────────────────────────────────────────
function TestCaseCard({ tc, index, isSelected, onToggleSelect, onChange }) {
  const [expanded, setExpanded]   = useState(index === 0);
  const [activeTab, setActiveTab] = useState('steps');
  const [editing, setEditing]     = useState(false);
  const [draftName, setDraftName] = useState(tc.name);
  const [draftDesc, setDraftDesc] = useState(tc.description);

  function commitEdit() {
    onChange({ ...tc, name: draftName.trim() || tc.name, description: draftDesc });
    setEditing(false);
  }

  return (
    <div className={`studio-tc-card ${isSelected ? 'studio-tc-selected' : ''}`}>
      <div className="studio-tc-header" onClick={() => !editing && setExpanded((e) => !e)}>
        <button
          className="studio-checkbox-btn"
          onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
          title={isSelected ? 'Bỏ chọn' : 'Chọn để lưu'}
        >
          {isSelected
            ? <CheckSquare size={16} style={{ color: 'var(--accent-color)' }} />
            : <Square size={16} style={{ color: 'var(--text-secondary)' }} />}
        </button>

        <div className="studio-tc-num">TC{String(index + 1).padStart(2, '0')}</div>

        <div className="studio-tc-name-block" style={{ flex: 1, minWidth: 0 }}>
          {editing ? (
            <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <input
                className="input-field"
                style={{ fontSize: '0.82rem', padding: '4px 8px' }}
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                autoFocus
              />
              <input
                className="input-field"
                style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                value={draftDesc}
                onChange={(e) => setDraftDesc(e.target.value)}
                placeholder="Mô tả (tùy chọn)"
              />
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="toolbar-btn" style={{ fontSize: '0.72rem' }} onClick={commitEdit}>
                  <Check size={11} /> Lưu
                </button>
                <button className="toolbar-btn" style={{ fontSize: '0.72rem' }} onClick={() => setEditing(false)}>
                  <X size={11} /> Hủy
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="studio-tc-name">{tc.name}</div>
              {tc.description && <div className="studio-tc-desc">{tc.description}</div>}
            </>
          )}
        </div>

        <div className="studio-tc-meta">
          <span className="studio-tc-chip"><ClipboardList size={10} /> {tc.steps.length}</span>
          {Object.keys(tc.testData || {}).length > 0 && (
            <span className="studio-tc-chip"><Database size={10} /> data</span>
          )}
          {tc.katalonScript && <span className="studio-tc-chip script"><Code2 size={10} /></span>}
        </div>

        {!editing && (
          <button
            className="toolbar-btn"
            style={{ fontSize: '0.7rem', padding: '2px 6px' }}
            onClick={(e) => { e.stopPropagation(); setEditing(true); setExpanded(true); }}
            title="Chỉnh sửa tên/mô tả"
          >
            Edit
          </button>
        )}

        <button className="studio-expand-btn" onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}>
          {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </button>
      </div>

      {expanded && !editing && (
        <div className="studio-tc-body">
          <div className="studio-tc-tabs">
            {TC_TABS.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                className={`studio-tc-tab ${activeTab === id ? 'active' : ''}`}
                onClick={() => setActiveTab(id)}
              >
                <Icon size={12} /> {label}
              </button>
            ))}
          </div>

          {activeTab === 'steps' && (
            <div className="studio-tab-content">
              {tc.steps.length === 0 ? (
                <div className="studio-empty-tab">Không có bước nào.</div>
              ) : tc.steps.map((step, i) => (
                <div key={i} className="studio-step-row">
                  <div className="studio-step-num">{i + 1}</div>
                  <div className="studio-step-body">
                    <div className="studio-step-title">{step.title}</div>
                    {step.description && <div className="studio-step-detail">{step.description}</div>}
                    {step.expected_result && (
                      <div className="studio-step-expected"><Check size={10} /> {step.expected_result}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'expected' && (
            <div className="studio-tab-content">
              <div className="studio-expected-box">
                <div className="studio-expected-label">Overall Expected Result</div>
                <p className="studio-expected-text">
                  {tc.expectedResult || <span style={{ color: 'var(--text-secondary)' }}>—</span>}
                </p>
              </div>
            </div>
          )}

          {activeTab === 'data' && (
            <div className="studio-tab-content">
              {Object.keys(tc.testData || {}).length === 0 ? (
                <div className="studio-empty-tab">Không có test data.</div>
              ) : (
                <table className="studio-data-table">
                  <thead><tr><th>Key</th><th>Value</th></tr></thead>
                  <tbody>
                    {Object.entries(tc.testData).map(([k, v]) => (
                      <tr key={k}>
                        <td className="studio-data-key">{k}</td>
                        <td className="studio-data-val">{String(v)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === 'locators' && (
            <div className="studio-tab-content">
              {!tc.objectLocators || tc.objectLocators.length === 0 ? (
                <div className="studio-empty-tab">Không có locator nào.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {tc.objectLocators.map((loc, i) => (
                    <div key={i} className="studio-locator-row">
                      <code className="studio-locator-name">{loc.name}</code>
                      <span className="scanner-selector-method" style={{ fontSize: '0.65rem' }}>{loc.selectorMethod}</span>
                      <code className="studio-locator-val">{loc.selectorValue}</code>
                      {loc.description && <div className="studio-locator-desc">{loc.description}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'script' && (
            <div className="studio-tab-content studio-script-wrap">
              {tc.katalonScript
                ? <pre className="studio-script-block">{tc.katalonScript}</pre>
                : <div className="studio-empty-tab">Không có script.</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function AIAgentStudio({ onNavigateToTestCases }) {
  // Workflow state: 'idle' | 'scanning' | 'scanned' | 'generating' | 'generated'
  const [phase, setPhase]   = useState('idle');

  const [url, setUrl]                   = useState('');
  const [scanResult, setScanResult]     = useState(null);  // { url, title, elements }
  const [testCases, setTestCases]       = useState([]);
  const [selected, setSelected]         = useState(new Set());
  const [projects, setProjects]         = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [error, setError]               = useState('');
  const [saving, setSaving]             = useState(false);
  const [saveResult, setSaveResult]     = useState(null);
  const [domTabOpen, setDomTabOpen]     = useState(true);

  const urlInputRef = useRef(null);

  const fetchProjects = useCallback(async () => {
    try {
      const data = await listProjects();
      const list = data.projects || [];
      setProjects(list);
      if (list.length > 0 && !selectedProjectId) setSelectedProjectId(list[0].id);
    } catch { /* silently fail */ }
  }, [selectedProjectId]);

  useEffect(() => { fetchProjects(); }, []);

  // ── Step 1: Scan URL ────────────────────────────────────────────────────
  async function handleScan() {
    const trimmed = url.trim();
    if (!trimmed) return;

    setError('');
    setScanResult(null);
    setTestCases([]);
    setSelected(new Set());
    setSaveResult(null);
    setPhase('scanning');

    try {
      const data = await scanUrl(trimmed);
      setScanResult(data);
      setDomTabOpen(true);
      setPhase('scanned');
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Quét trang thất bại');
      setPhase('idle');
    }
  }

  function handleRescan() {
    setPhase('idle');
    setScanResult(null);
    setTestCases([]);
    setSelected(new Set());
    setSaveResult(null);
    setError('');
    setTimeout(() => urlInputRef.current?.focus(), 50);
  }

  // ── Step 2: Generate from DOM ───────────────────────────────────────────
  async function handleGenerate() {
    if (!scanResult) return;
    setError('');
    setTestCases([]);
    setSelected(new Set());
    setSaveResult(null);
    setPhase('generating');

    try {
      const data = await generateFromDom(scanResult);
      const tcs = data.testCases || [];
      setTestCases(tcs);
      setSelected(new Set(tcs.map((_, i) => i)));
      setPhase('generated');
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Lỗi khi gọi AI. Vui lòng thử lại.');
      setPhase('scanned');
    }
  }

  // ── Step 3: Save ────────────────────────────────────────────────────────
  async function handleSave() {
    if (!selectedProjectId) { setError('Vui lòng chọn project trước khi lưu.'); return; }
    const toSave = testCases.filter((_, i) => selected.has(i));
    if (toSave.length === 0) { setError('Chưa có test case nào được chọn để lưu.'); return; }

    setSaving(true);
    setError('');
    try {
      const result = await saveTestCases(
        selectedProjectId,
        toSave,
        scanResult?.url || null,
        scanResult ? { url: scanResult.url, title: scanResult.title, elements: scanResult.elements } : null,
      );
      setSaveResult(result);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Lỗi khi lưu test cases.');
    } finally {
      setSaving(false);
    }
  }

  function toggleSelect(i) {
    setSelected((prev) => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });
  }
  function toggleSelectAll() {
    setSelected(selected.size === testCases.length ? new Set() : new Set(testCases.map((_, i) => i)));
  }

  function updateTestCase(index, updated) {
    setTestCases((prev) => prev.map((tc, i) => (i === index ? updated : tc)));
  }

  const isScanning   = phase === 'scanning';
  const isGenerating = phase === 'generating';
  const hasScanned   = ['scanned', 'generating', 'generated'].includes(phase);
  const hasResults   = phase === 'generated' && testCases.length > 0;

  return (
    <div className="studio-layout">
      {/* ── Left control panel ── */}
      <div className="studio-input-panel">
        <div className="studio-panel-header">
          <div className="studio-header-icon"><Bot size={20} /></div>
          <div>
            <div className="studio-header-title">AI QA Studio</div>
            <div className="studio-header-sub">Quét URL → AI tạo test cases → Lưu vào project</div>
          </div>
        </div>

        {/* Project selector */}
        <div className="studio-field">
          <label className="studio-label">Lưu vào Project <span style={{ color: 'var(--error-color)' }}>*</span></label>
          <select
            className="input-field"
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
          >
            {projects.length === 0 && <option value="">— Chưa có project —</option>}
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        {/* URL input */}
        <div className="studio-field">
          <label className="studio-label">URL trang web cần kiểm thử <span style={{ color: 'var(--error-color)' }}>*</span></label>
          <div className="studio-url-row">
            <Globe size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
            <input
              ref={urlInputRef}
              className="input-field studio-url-input"
              type="url"
              placeholder="https://example.com/login"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !isScanning && handleScan()}
              disabled={isScanning || isGenerating}
            />
          </div>
          <button
            className="studio-scan-btn"
            onClick={handleScan}
            disabled={!url.trim() || isScanning || isGenerating}
          >
            {isScanning
              ? <><Loader2 size={14} className="studio-spin" /> Đang quét trang…</>
              : <><ScanLine size={14} /> Quét URL</>}
          </button>
        </div>

        {/* DOM summary — shown after successful scan */}
        {hasScanned && scanResult && (
          <div className="studio-field">
            <label className="studio-label">Kết quả quét DOM</label>
            <DomSummary scanResult={scanResult} onRescan={handleRescan} />
          </div>
        )}

        {/* Generate button — shown after scan */}
        {hasScanned && scanResult && (
          <button
            className="studio-generate-btn"
            onClick={handleGenerate}
            disabled={isGenerating || isScanning}
          >
            {isGenerating
              ? <><Loader2 size={16} className="studio-spin" /> AI đang tạo test cases…</>
              : <><Sparkles size={16} /> Tạo Test Cases với AI</>}
          </button>
        )}

        {/* Scanning state hint */}
        {isScanning && (
          <div className="studio-info-box">
            <Loader2 size={13} className="studio-spin" />
            <span>Đang khởi động Chrome headless và crawl trang. Có thể mất 15–30 giây.</span>
          </div>
        )}

        {/* Generating hint */}
        {isGenerating && (
          <div className="studio-info-box">
            <Sparkles size={13} />
            <span>AI đang phân tích cấu trúc DOM và sinh test cases. Có thể mất 15–30 giây.</span>
          </div>
        )}
      </div>

      {/* ── Right result panel ── */}
      <div className="studio-result-panel">
        {/* Error banner */}
        {error && (
          <div className="studio-error-banner">
            <AlertCircle size={14} />
            <span>{error}</span>
            <button className="studio-error-close" onClick={() => setError('')}><X size={12} /></button>
          </div>
        )}

        {/* Save result banner */}
        {saveResult && (
          <div className="studio-save-banner">
            <Check size={14} />
            <span>
              Đã lưu <strong>{saveResult.saved}</strong> test case
              {saveResult.errors > 0 && `, ${saveResult.errors} lỗi`} vào project.
            </span>
            {onNavigateToTestCases && (
              <button className="studio-nav-btn" onClick={onNavigateToTestCases}>Xem Test Cases →</button>
            )}
            <button className="studio-error-close" onClick={() => setSaveResult(null)}><X size={12} /></button>
          </div>
        )}

        {/* Empty state */}
        {phase === 'idle' && !error && (
          <div className="studio-empty-state">
            <div className="studio-empty-icon"><Bot size={52} /></div>
            <h3>AI QA Studio</h3>
            <p>Nhập URL trang web bên trái và nhấn <strong>"Quét URL"</strong> để bắt đầu.</p>
            <div className="studio-feature-chips">
              <span className="studio-chip"><ScanLine size={12} /> Scan DOM</span>
              <span className="studio-chip"><ClipboardList size={12} /> Test Steps</span>
              <span className="studio-chip"><FileCheck size={12} /> Expected Results</span>
              <span className="studio-chip"><Database size={12} /> Test Data</span>
              <span className="studio-chip"><Code2 size={12} /> Katalon Script</span>
              <span className="studio-chip"><Globe size={12} /> Object Locators</span>
            </div>
          </div>
        )}

        {/* Scanning loading */}
        {isScanning && (
          <div className="studio-loading-overlay">
            <div className="studio-loading-card">
              <Loader2 size={32} className="studio-spin" style={{ color: 'var(--accent-color)' }} />
              <div className="studio-loading-title">Đang crawl trang web…</div>
              <div className="studio-loading-sub">Chrome headless đang khởi động và trích xuất phần tử DOM</div>
              <div className="studio-loading-sub" style={{ opacity: 0.6 }}>Có thể mất 15–30 giây</div>
            </div>
          </div>
        )}

        {/* DOM elements preview — after scan, before/after generate */}
        {hasScanned && scanResult && !isScanning && (
          <div className="studio-dom-preview">
            <div
              className="studio-dom-preview-header"
              onClick={() => setDomTabOpen((v) => !v)}
              style={{ cursor: 'pointer' }}
            >
              <ScanLine size={14} />
              <span>DOM Elements ({scanResult.elements.length})</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginLeft: 4 }}>
                — {scanResult.title || scanResult.url}
              </span>
              <div style={{ flex: 1 }} />
              {domTabOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </div>
            {domTabOpen && <DomElementsTable elements={scanResult.elements} />}
          </div>
        )}

        {/* Generating loading overlay */}
        {isGenerating && (
          <div className="studio-loading-overlay" style={{ position: 'relative', height: 220, background: 'transparent' }}>
            <div className="studio-loading-card">
              <Loader2 size={32} className="studio-spin" style={{ color: 'var(--accent-color)' }} />
              <div className="studio-loading-title">AI đang phân tích DOM và tạo test cases…</div>
              <div className="studio-loading-sub">Quá trình này có thể mất 15–30 giây</div>
            </div>
          </div>
        )}

        {/* Test case results */}
        {hasResults && (
          <>
            <div className="studio-results-bar">
              <div className="studio-results-info">
                <Sparkles size={14} style={{ color: 'var(--accent-color)' }} />
                <strong>{testCases.length} test cases</strong> được tạo từ{' '}
                <code style={{ fontSize: '0.75rem' }}>{scanResult?.url}</code>
                {selected.size > 0 && (
                  <span className="studio-selected-badge">{selected.size} đã chọn</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="toolbar-btn" onClick={toggleSelectAll}>
                  {selected.size === testCases.length
                    ? <><CheckSquare size={13} /> Bỏ chọn tất cả</>
                    : <><Square size={13} /> Chọn tất cả</>}
                </button>
                <button
                  className="studio-save-btn"
                  onClick={handleSave}
                  disabled={saving || selected.size === 0 || !selectedProjectId}
                  title={!selectedProjectId ? 'Chọn project trước' : ''}
                >
                  {saving
                    ? <><Loader2 size={13} className="studio-spin" /> Đang lưu…</>
                    : <><Save size={13} /> Lưu {selected.size > 0 ? selected.size : ''} vào Project</>}
                </button>
              </div>
            </div>

            <div className="studio-tc-list">
              {testCases.map((tc, i) => (
                <TestCaseCard
                  key={i}
                  tc={tc}
                  index={i}
                  isSelected={selected.has(i)}
                  onToggleSelect={() => toggleSelect(i)}
                  onChange={(updated) => updateTestCase(i, updated)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
