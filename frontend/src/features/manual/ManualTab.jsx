import { CheckCircle, Globe, Paperclip, RefreshCw, SendHorizontal, Sparkles } from 'lucide-react';

const ManualTab = ({
  url,
  setUrl,
  isExtracting,
  htmlContext,
  handleExtractPage,
  testDescription,
  setTestDescription,
  isGenerating,
  handleGenerateScript
}) => {
  return (
    <div className="ai-chat-layout">
      <div className="ai-url-bar">
        <Globe size={14} className="ai-url-icon" />
        <input
          type="text"
          className="ai-url-input"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://example.com"
        />
        <button
          className={`ai-analyze-btn ${isExtracting ? 'loading' : ''} ${htmlContext ? 'analyzed' : ''}`}
          onClick={handleExtractPage}
          disabled={isExtracting}
          title="Phân tích cấu trúc trang web"
        >
          {isExtracting ? (
            <><RefreshCw size={13} className="spin-icon" /> Đang quét...</>
          ) : htmlContext ? (
            <><CheckCircle size={13} /> Đã phân tích</>
          ) : (
            <><Sparkles size={13} /> Phân tích trang</>
          )}
        </button>
      </div>

      <div className="ai-hero">
        <div className="ai-hero-icon">
          <svg width="52" height="52" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="aiGrad" x1="0" y1="0" x2="52" y2="52" gradientUnits="userSpaceOnUse">
                <stop stopColor="#7C3AED" />
                <stop offset="1" stopColor="#5865F2" />
              </linearGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
                <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            <path d="M26 4L31.5 20.5L48 26L31.5 31.5L26 48L20.5 31.5L4 26L20.5 20.5L26 4Z" fill="url(#aiGrad)" filter="url(#glow)" />
            <path d="M40 8L42.5 14.5L49 17L42.5 19.5L40 26L37.5 19.5L31 17L37.5 14.5L40 8Z" fill="white" opacity="0.7" />
          </svg>
        </div>
        <h1 className="ai-hero-title">Bạn muốn kiểm thử điều gì?</h1>
        {!htmlContext && (
          <p className="ai-hero-hint">Phân tích trang web ở trên trước, rồi mô tả kịch bản kiểm thử bên dưới</p>
        )}
        {htmlContext && (
          <p className="ai-hero-hint analyzed">✅ Đã sẵn sàng — mô tả kịch bản kiểm thử của bạn bên dưới</p>
        )}
      </div>

      <div className="ai-input-wrapper">
        <div className="ai-input-box">
          <textarea
            className="ai-textarea"
            value={testDescription}
            onChange={(event) => setTestDescription(event.target.value)}
            placeholder="Mô tả kịch bản kiểm thử... Ví dụ: Kiểm thử đăng nhập với tài khoản user123, mật khẩu pass123 và xác nhận thông báo chào mừng."
            rows={3}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                event.preventDefault();
                if (!isGenerating && htmlContext) {
                  handleGenerateScript();
                }
              }
            }}
          />
          <div className="ai-input-actions">
            <button className="ai-attach-btn" title="Đính kèm file">
              <Paperclip size={16} />
            </button>
            <button
              className={`ai-send-btn ${isGenerating ? 'loading' : ''}`}
              onClick={handleGenerateScript}
              disabled={isGenerating || !htmlContext || !testDescription.trim()}
              title={!htmlContext ? 'Phân tích trang trước' : 'Tạo Test Script (Ctrl+Enter)'}
            >
              {isGenerating ? <RefreshCw size={16} className="spin-icon" /> : <SendHorizontal size={16} />}
            </button>
          </div>
        </div>
        <p className="ai-disclaimer">
          QA Studio AI có thể mắc lỗi. Vui lòng kiểm tra kỹ trước khi chạy.
        </p>
      </div>
    </div>
  );
};

export default ManualTab;
