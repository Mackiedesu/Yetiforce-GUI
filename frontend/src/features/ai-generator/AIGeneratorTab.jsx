import { useState } from 'react';
import {
  Sparkles, Copy, Check, ChevronRight, FlaskConical,
  ClipboardList, Target, Database, Code2, AlertCircle, Loader2
} from 'lucide-react';

const EXAMPLE_REQUIREMENTS = [
  'Kiểm thử đăng nhập với email user@gmail.com và mật khẩu hợp lệ. Sau khi đăng nhập thành công, chuyển hướng đến trang chủ.',
  'Kiểm thử chức năng tìm kiếm sản phẩm: nhập từ khóa "laptop", nhấn tìm kiếm và xác nhận kết quả hiển thị.',
  'Kiểm thử đăng ký tài khoản mới với đầy đủ thông tin hợp lệ và xác nhận email chào mừng.',
];

const OUTPUT_TABS = [
  { id: 'steps', label: 'Test Steps', icon: ClipboardList },
  { id: 'results', label: 'Expected Results', icon: Target },
  { id: 'data', label: 'Test Data', icon: Database },
  { id: 'script', label: 'Katalon Script', icon: Code2 },
];

const SkeletonLine = ({ width = '100%' }) => (
  <div className="ai-gen-skeleton-line" style={{ width }} />
);

const LoadingSkeleton = () => (
  <div className="ai-gen-skeleton">
    <SkeletonLine width="85%" />
    <SkeletonLine width="70%" />
    <SkeletonLine width="90%" />
    <SkeletonLine width="60%" />
    <SkeletonLine width="78%" />
    <SkeletonLine width="65%" />
  </div>
);

const AIGeneratorTab = ({ onGenerate, isGenerating, result, error }) => {
  const [requirement, setRequirement] = useState('');
  const [activeOutputTab, setActiveOutputTab] = useState('steps');
  const [copied, setCopied] = useState(false);

  const handleGenerate = () => {
    if (!requirement.trim() || isGenerating) return;
    onGenerate(requirement);
  };

  const handleCopy = async () => {
    if (!result?.katalonScript) return;
    try {
      await navigator.clipboard.writeText(result.katalonScript);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleExampleClick = (example) => {
    setRequirement(example);
  };

  const hasResult = result && (
    result.testSteps?.length > 0 ||
    result.expectedResults?.length > 0 ||
    result.katalonScript
  );

  const parseErrorMessage = (raw) => {
    if (!raw) return '';
    try {
      const outer = JSON.parse(raw);
      if (outer?.error) {
        const inner = typeof outer.error === 'string' ? JSON.parse(outer.error) : outer.error;
        return inner?.error?.message || inner?.message || String(outer.error);
      }
    } catch { /* not JSON */ }
    return raw;
  };

  const friendlyError = parseErrorMessage(error);
  const isOverload = friendlyError && (
    friendlyError.toLowerCase().includes('high demand') ||
    friendlyError.toLowerCase().includes('unavailable') ||
    friendlyError.toLowerCase().includes('quá tải') ||
    friendlyError.toLowerCase().includes('503') ||
    friendlyError.toLowerCase().includes('429')
  );

  return (
    <div className="ai-gen-layout">
      {/* ── Left Panel: Input ── */}
      <div className="ai-gen-input-panel">
        <div className="ai-gen-input-header">
          <div className="ai-gen-header-icon">
            <FlaskConical size={18} />
          </div>
          <div>
            <h2 className="ai-gen-title">AI Test Generator</h2>
            <p className="ai-gen-subtitle">Nhập yêu cầu kiểm thử bằng ngôn ngữ tự nhiên</p>
          </div>
        </div>

        <div className="ai-gen-textarea-wrapper">
          <textarea
            id="ai-gen-requirement"
            className="ai-gen-textarea"
            value={requirement}
            onChange={(e) => setRequirement(e.target.value)}
            placeholder="Mô tả yêu cầu kiểm thử...&#10;&#10;Ví dụ:&#10;Kiểm thử đăng nhập với email hợp lệ và mật khẩu đúng.&#10;Sau khi đăng nhập thành công, chuyển hướng đến trang chủ."
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                handleGenerate();
              }
            }}
          />
          <div className="ai-gen-textarea-footer">
            <span className="ai-gen-char-count">{requirement.length} ký tự</span>
            <span className="ai-gen-hint">Ctrl+Enter để tạo</span>
          </div>
        </div>

        <button
          id="ai-gen-generate-btn"
          className={`ai-gen-btn-primary ${isGenerating ? 'loading' : ''}`}
          onClick={handleGenerate}
          disabled={isGenerating || !requirement.trim()}
        >
          {isGenerating ? (
            <>
              <Loader2 size={16} className="ai-gen-spin" />
              Đang tạo test...
            </>
          ) : (
            <>
              <Sparkles size={16} />
              Tạo Test Case
            </>
          )}
        </button>

        {/* Examples */}
        <div className="ai-gen-examples">
          <p className="ai-gen-examples-label">
            <ChevronRight size={12} /> Ví dụ nhanh
          </p>
          {EXAMPLE_REQUIREMENTS.map((ex, i) => (
            <button
              key={i}
              className="ai-gen-example-item"
              onClick={() => handleExampleClick(ex)}
              title={ex}
            >
              {ex.length > 80 ? ex.slice(0, 80) + '...' : ex}
            </button>
          ))}
        </div>

        {/* Output overview when available */}
        {hasResult && !isGenerating && (
          <div className="ai-gen-overview">
            <div className="ai-gen-overview-title">Kết quả tạo:</div>
            <div className="ai-gen-overview-stats">
              <div className="ai-gen-stat">
                <span className="ai-gen-stat-num">{result.testSteps?.length || 0}</span>
                <span className="ai-gen-stat-label">Bước test</span>
              </div>
              <div className="ai-gen-stat">
                <span className="ai-gen-stat-num">{result.expectedResults?.length || 0}</span>
                <span className="ai-gen-stat-label">Kết quả</span>
              </div>
              <div className="ai-gen-stat">
                <span className="ai-gen-stat-num">{Object.keys(result.testData || {}).length}</span>
                <span className="ai-gen-stat-label">Data fields</span>
              </div>
              <div className="ai-gen-stat">
                <span className="ai-gen-stat-num">{result.katalonScript ? result.katalonScript.split('\n').length : 0}</span>
                <span className="ai-gen-stat-label">Dòng script</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Right Panel: Output ── */}
      <div className="ai-gen-output-panel">
        {/* Sub-tab bar */}
        <div className="ai-gen-output-tabs">
          {OUTPUT_TABS.map((tab) => {
            const TabIcon = tab.icon;
            return (
              <button
                key={tab.id}
                id={`ai-gen-tab-${tab.id}`}
                className={`ai-gen-output-tab ${activeOutputTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveOutputTab(tab.id)}
              >
                <TabIcon size={14} />
                {tab.label}
                {tab.id === 'script' && result?.katalonScript && (
                  <span className="ai-gen-tab-badge">✓</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="ai-gen-output-body">
          {/* Error state */}
          {error && !isGenerating && (
            <div className="ai-gen-error">
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <strong>
                  {isOverload ? '⏳ AI đang quá tải' : 'Lỗi khi tạo test'}
                </strong>
                <p>
                  {isOverload
                    ? 'Gemini AI đang có lượng truy cập cao. Hệ thống sẽ tự thử lại với model dự phòng. Nếu vẫn lỗi, vui lòng thử lại sau vài giây.'
                    : friendlyError}
                </p>
                {isOverload && (
                  <button
                    className="ai-gen-retry-btn"
                    onClick={handleGenerate}
                    disabled={!requirement.trim()}
                  >
                    Thử lại ngay
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Empty / initial state */}
          {!isGenerating && !hasResult && !error && (
            <div className="ai-gen-empty">
              <div className="ai-gen-empty-icon">
                <Sparkles size={40} />
              </div>
              <h3>Chưa có kết quả</h3>
              <p>Nhập yêu cầu kiểm thử ở bên trái và nhấn <strong>Tạo Test Case</strong></p>
              <div className="ai-gen-empty-features">
                <div className="ai-gen-feature-chip"><ClipboardList size={13} /> Test Steps</div>
                <div className="ai-gen-feature-chip"><Target size={13} /> Expected Results</div>
                <div className="ai-gen-feature-chip"><Database size={13} /> Test Data</div>
                <div className="ai-gen-feature-chip"><Code2 size={13} /> Katalon Groovy Script</div>
              </div>
            </div>
          )}

          {/* Loading state */}
          {isGenerating && (
            <div className="ai-gen-loading-wrapper">
              <div className="ai-gen-loading-header">
                <div className="ai-gen-loading-icon">
                  <Sparkles size={20} className="ai-gen-spin-slow" />
                </div>
                <div>
                  <p className="ai-gen-loading-title">AI đang phân tích yêu cầu...</p>
                  <p className="ai-gen-loading-sub">Đang tạo test steps, expected results và Katalon script</p>
                </div>
              </div>
              <LoadingSkeleton />
              <LoadingSkeleton />
            </div>
          )}

          {/* ── Results ── */}
          {hasResult && !isGenerating && (
            <>
              {/* Test Steps */}
              {activeOutputTab === 'steps' && (
                <div className="ai-gen-section">
                  <div className="ai-gen-section-header">
                    <ClipboardList size={15} />
                    <span>Test Steps</span>
                    <span className="ai-gen-count-badge">{result.testSteps.length} bước</span>
                  </div>
                  <ol className="ai-gen-steps-list">
                    {result.testSteps.map((step, i) => (
                      <li key={i} className="ai-gen-step-item">
                        <span className="ai-gen-step-num">{i + 1}</span>
                        <span className="ai-gen-step-text">
                          {step.replace(/^Bước\s*\d+[:：]?\s*/i, '')}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Expected Results */}
              {activeOutputTab === 'results' && (
                <div className="ai-gen-section">
                  <div className="ai-gen-section-header">
                    <Target size={15} />
                    <span>Expected Results</span>
                    <span className="ai-gen-count-badge">{result.expectedResults.length} kết quả</span>
                  </div>
                  <ol className="ai-gen-results-list">
                    {result.expectedResults.map((res, i) => (
                      <li key={i} className="ai-gen-result-item">
                        <span className="ai-gen-result-icon">✓</span>
                        <span className="ai-gen-result-text">
                          {res.replace(/^Kết quả kỳ vọng bước\s*\d+[:：]?\s*/i, '')}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Test Data */}
              {activeOutputTab === 'data' && (
                <div className="ai-gen-section">
                  <div className="ai-gen-section-header">
                    <Database size={15} />
                    <span>Test Data</span>
                    <span className="ai-gen-count-badge">{Object.keys(result.testData || {}).length} fields</span>
                  </div>
                  {Object.keys(result.testData || {}).length === 0 ? (
                    <div className="ai-gen-data-empty">Không có dữ liệu test cụ thể được trích xuất.</div>
                  ) : (
                    <table className="ai-gen-data-table">
                      <thead>
                        <tr>
                          <th>Field</th>
                          <th>Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(result.testData).map(([key, value]) => (
                          <tr key={key}>
                            <td className="ai-gen-data-key">
                              <code>{key}</code>
                            </td>
                            <td className="ai-gen-data-value">{String(value)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* Katalon Script */}
              {activeOutputTab === 'script' && (
                <div className="ai-gen-section ai-gen-script-section">
                  <div className="ai-gen-section-header">
                    <Code2 size={15} />
                    <span>Katalon Groovy Script</span>
                    <div className="ai-gen-script-actions">
                      <span className="ai-gen-lang-badge">Groovy</span>
                      <button
                        id="ai-gen-copy-btn"
                        className={`ai-gen-copy-btn ${copied ? 'copied' : ''}`}
                        onClick={handleCopy}
                        title="Sao chép script"
                      >
                        {copied ? <><Check size={13} /> Đã sao chép</> : <><Copy size={13} /> Sao chép</>}
                      </button>
                    </div>
                  </div>
                  <div className="ai-gen-code-wrapper">
                    <pre className="ai-gen-code-block">
                      <code>{result.katalonScript}</code>
                    </pre>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIGeneratorTab;
