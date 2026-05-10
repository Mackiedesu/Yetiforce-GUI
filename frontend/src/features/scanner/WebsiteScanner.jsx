import { useState, useRef } from 'react';
import { ScanLine, Zap, Copy, Check, ChevronDown, ChevronRight, Globe, Code2, Database, AlertCircle, Loader2 } from 'lucide-react';
import { scanPage, generateFromScan } from './scanner.api';

const TAG_COLORS = {
  input:    { bg: '#dbeafe', color: '#1d4ed8', label: 'INPUT' },
  textarea: { bg: '#ede9fe', color: '#7c3aed', label: 'TEXTAREA' },
  select:   { bg: '#fef9c3', color: '#a16207', label: 'SELECT' },
  button:   { bg: '#dcfce7', color: '#16a34a', label: 'BUTTON' },
  a:        { bg: '#ffedd5', color: '#c2410c', label: 'LINK' },
  form:     { bg: '#fce7f3', color: '#be185d', label: 'FORM' },
};

function TagBadge({ tag }) {
  const cfg = TAG_COLORS[tag] || { bg: '#f1f5f9', color: '#475569', label: tag.toUpperCase() };
  return (
    <span style={{
      background: cfg.bg, color: cfg.color,
      fontSize: '0.6rem', fontWeight: 700, borderRadius: 4,
      padding: '1px 6px', letterSpacing: 0.5, flexShrink: 0,
    }}>{cfg.label}</span>
  );
}

function CopyButton({ text, small }) {
  const [copied, setCopied] = useState(false);
  const handle = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button className="scanner-copy-btn" onClick={handle} title="Copy to clipboard" style={small ? { padding: '3px 8px', fontSize: '0.7rem' } : {}}>
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {!small && (copied ? 'Copied' : 'Copy')}
    </button>
  );
}

function ElementsTable({ elements }) {
  const [expanded, setExpanded] = useState({});
  const toggle = (i) => setExpanded((p) => ({ ...p, [i]: !p[i] }));
  const visible = elements.filter((e) => e.tag !== 'form');
  const forms   = elements.filter((e) => e.tag === 'form');

  return (
    <div className="scanner-elements-wrap">
      {forms.length > 0 && (
        <div className="scanner-form-list">
          {forms.map((f, i) => (
            <div key={i} className="scanner-form-badge">
              <TagBadge tag="form" />
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                {f.id ? `#${f.id}` : f.name || 'anonymous'} &bull; {(f.action || '').replace(/^https?:\/\/[^/]+/, '') || '/'}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="scanner-table-wrap">
        <table className="scanner-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Type</th>
              <th>ID / Name</th>
              <th>Label / Text</th>
              <th>Selector</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((el, i) => (
              <>
                <tr key={i} className="scanner-table-row" onClick={() => toggle(i)}>
                  <td style={{ color: '#94a3b8', fontSize: '0.7rem' }}>{i + 1}</td>
                  <td><TagBadge tag={el.tag} /></td>
                  <td style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#334155' }}>
                    {el.id ? `#${el.id}` : el.name ? `[name="${el.name}"]` : '—'}
                  </td>
                  <td style={{ fontSize: '0.75rem', color: '#475569', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {el.label || el.text || el.placeholder || el.href?.replace(/^https?:\/\/[^/]+/, '') || '—'}
                  </td>
                  <td style={{ fontSize: '0.7rem', fontFamily: 'monospace', color: '#7c3aed', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {el.selector}
                  </td>
                  <td style={{ padding: '0 6px' }}>
                    {expanded[i] ? <ChevronDown size={13} color="#94a3b8" /> : <ChevronRight size={13} color="#94a3b8" />}
                  </td>
                </tr>
                {expanded[i] && (
                  <tr key={`x-${i}`} className="scanner-table-expand">
                    <td colSpan={6}>
                      <div className="scanner-expand-body">
                        <div><span>XPath:</span> <code>{el.xpath}</code></div>
                        {el.type && <div><span>Type:</span> <code>{el.type}</code></div>}
                        {el.isRequired && <div><span>Required:</span> <code>true</code></div>}
                        {el.href && <div><span>href:</span> <code style={{ wordBreak: 'break-all' }}>{el.href}</code></div>}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ObjectRepoPanel({ objects }) {
  return (
    <div className="scanner-artifact-panel">
      <div className="scanner-artifact-header">
        <Database size={15} />
        <span>Object Repository</span>
        <span className="scanner-artifact-count">{objects.length} objects</span>
        <div style={{ flex: 1 }} />
        <CopyButton text={JSON.stringify(objects, null, 2)} />
      </div>
      <div className="scanner-object-list">
        {objects.map((obj, i) => (
          <div key={i} className="scanner-object-item">
            <div className="scanner-object-name">{obj.name}</div>
            {obj.description && <div className="scanner-object-desc">{obj.description}</div>}
            <div className="scanner-object-selector">
              <span className="scanner-selector-method">{obj.selectorMethod}</span>
              <code>{obj.selectorValue}</code>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScriptPanel({ script }) {
  return (
    <div className="scanner-artifact-panel">
      <div className="scanner-artifact-header">
        <Code2 size={15} />
        <span>Katalon Groovy Script</span>
        <div style={{ flex: 1 }} />
        <CopyButton text={script} />
      </div>
      <pre className="scanner-script-pre">{script}</pre>
    </div>
  );
}

export default function WebsiteScanner() {
  const [url, setUrl] = useState('');
  const [scanResult, setScanResult] = useState(null);
  const [genResult, setGenResult] = useState(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [genLoading, setGenLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('elements');
  const inputRef = useRef();

  const handleScan = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setError('');
    setScanResult(null);
    setGenResult(null);
    setScanLoading(true);
    try {
      const data = await scanPage(trimmed);
      setScanResult(data);
      setActiveTab('elements');
    } catch (e) {
      setError(e?.response?.data?.error || e.message || 'Scan thất bại');
    } finally {
      setScanLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!scanResult) return;
    setError('');
    setGenResult(null);
    setGenLoading(true);
    try {
      const data = await generateFromScan(scanResult);
      setGenResult(data);
      setActiveTab('objects');
    } catch (e) {
      setError(e?.response?.data?.error || e.message || 'Generate thất bại');
    } finally {
      setGenLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleScan();
  };

  const tagCounts = scanResult
    ? Object.fromEntries(
        ['input', 'textarea', 'select', 'button', 'a', 'form'].map((t) => [
          t,
          scanResult.elements.filter((e) => e.tag === t).length,
        ])
      )
    : {};

  return (
    <div className="scanner-root">
      {/* Header */}
      <div className="scanner-header">
        <div className="scanner-header-title">
          <ScanLine size={20} />
          <span>Website Scanner</span>
          <span className="scanner-feature-badge">Feature 8</span>
        </div>
        <p className="scanner-header-desc">
          Crawl bất kỳ trang web nào, trích xuất phần tử DOM và tự động sinh Katalon Object Repository + Groovy Script bằng AI.
        </p>
      </div>

      {/* URL input bar */}
      <div className="scanner-url-bar">
        <Globe size={16} style={{ color: '#64748b', flexShrink: 0 }} />
        <input
          ref={inputRef}
          className="scanner-url-input"
          type="url"
          placeholder="https://example.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={scanLoading || genLoading}
        />
        <button
          className="scanner-scan-btn"
          onClick={handleScan}
          disabled={!url.trim() || scanLoading || genLoading}
        >
          {scanLoading ? <Loader2 size={15} className="scanner-spin" /> : <ScanLine size={15} />}
          {scanLoading ? 'Scanning…' : 'Scan'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="scanner-error">
          <AlertCircle size={15} />
          <span>{error}</span>
        </div>
      )}

      {/* Scan loading state */}
      {scanLoading && (
        <div className="scanner-loading-state">
          <Loader2 size={28} className="scanner-spin" style={{ color: '#7c3aed' }} />
          <p>Đang crawl trang web và trích xuất phần tử DOM…</p>
          <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Có thể mất 10–30 giây</p>
        </div>
      )}

      {/* Results */}
      {scanResult && !scanLoading && (
        <div className="scanner-results">
          {/* Page info bar */}
          <div className="scanner-page-info">
            <div className="scanner-page-title">
              <Globe size={14} />
              <strong>{scanResult.title || '(no title)'}</strong>
              <a href={scanResult.url} target="_blank" rel="noreferrer" style={{ fontSize: '0.7rem', color: '#7c3aed' }}>
                {scanResult.url}
              </a>
            </div>
            <div className="scanner-tag-pills">
              {Object.entries(tagCounts).filter(([, v]) => v > 0).map(([tag, count]) => {
                const cfg = TAG_COLORS[tag] || {};
                return (
                  <span key={tag} style={{ background: cfg.bg, color: cfg.color, fontSize: '0.65rem', fontWeight: 700, borderRadius: 20, padding: '2px 8px' }}>
                    {cfg.label || tag.toUpperCase()} ×{count}
                  </span>
                );
              })}
            </div>
            <button
              className="scanner-gen-btn"
              onClick={handleGenerate}
              disabled={genLoading}
            >
              {genLoading ? <Loader2 size={14} className="scanner-spin" /> : <Zap size={14} />}
              {genLoading ? 'Generating…' : 'Generate Katalon Artifacts'}
            </button>
          </div>

          {/* Tab bar */}
          <div className="scanner-tabs">
            <button
              className={`scanner-tab ${activeTab === 'elements' ? 'active' : ''}`}
              onClick={() => setActiveTab('elements')}
            >
              DOM Elements ({scanResult.elements.length})
            </button>
            {genResult && (
              <>
                <button
                  className={`scanner-tab ${activeTab === 'objects' ? 'active' : ''}`}
                  onClick={() => setActiveTab('objects')}
                >
                  Object Repository ({genResult.objectRepository.length})
                </button>
                <button
                  className={`scanner-tab ${activeTab === 'script' ? 'active' : ''}`}
                  onClick={() => setActiveTab('script')}
                >
                  Groovy Script
                </button>
              </>
            )}
          </div>

          {/* Tab content */}
          <div className="scanner-tab-content">
            {activeTab === 'elements' && <ElementsTable elements={scanResult.elements} />}
            {activeTab === 'objects' && genResult && <ObjectRepoPanel objects={genResult.objectRepository} />}
            {activeTab === 'script' && genResult && <ScriptPanel script={genResult.katalonScript} />}
          </div>

          {/* Gen loading overlay */}
          {genLoading && (
            <div className="scanner-gen-loading">
              <Loader2 size={22} className="scanner-spin" style={{ color: '#7c3aed' }} />
              <span>AI đang phân tích và sinh Katalon artifacts…</span>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!scanResult && !scanLoading && !error && (
        <div className="scanner-empty-state">
          <ScanLine size={48} style={{ color: '#cbd5e1' }} />
          <p style={{ color: '#94a3b8', margin: '12px 0 4px' }}>Nhập URL và nhấn Scan để bắt đầu</p>
          <p style={{ color: '#cbd5e1', fontSize: '0.75rem' }}>Hỗ trợ: input, textarea, select, button, link, form</p>
        </div>
      )}
    </div>
  );
}
