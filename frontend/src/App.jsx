import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { 
  Play, Square, Save, Settings, 
  Folder, FileText, Code, CheckCircle, 
  Terminal, Globe, Zap, AlertCircle
} from 'lucide-react';
import './index.css';

const App = () => {
  const [activeTab, setActiveTab] = useState('manual');
  const [url, setUrl] = useState('https://example.com');
  const [testDescription, setTestDescription] = useState('Kiểm tra xem thẻ h1 có chứa chữ "Example" hay không.');
  
  const [htmlContext, setHtmlContext] = useState('');
  const [generatedScript, setGeneratedScript] = useState('');
  
  const [logs, setLogs] = useState([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  const consoleEndRef = useRef(null);

  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const addLog = (msg, type = 'info') => {
    setLogs(prev => [...prev, { text: msg, type, time: new Date().toLocaleTimeString() }]);
  };

  const handleExtractPage = async () => {
    if (!url) {
      addLog('Vui lòng nhập URL trang web', 'error');
      return;
    }
    
    setIsExtracting(true);
    addLog(`Đang khởi chạy trình duyệt ngầm để phân tích cấu trúc: ${url}...`);
    
    try {
      const response = await axios.post('http://localhost:5000/api/extract', { url });
      if (response.data.success) {
        setHtmlContext(response.data.html);
        addLog(`Đã tải xong trang: "${response.data.title}"`, 'success');
        addLog(`Đã lấy được ${response.data.html.length} ký tự HTML DOM. Sẵn sàng tạo Script.`, 'success');
      }
    } catch (error) {
      addLog(`Lỗi khi trích xuất web: ${error.response?.data?.error || error.message}`, 'error');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleGenerateScript = async () => {
    if (!htmlContext) {
      addLog('Chưa có thông tin HTML của trang web. Vui lòng bấm [Phân tích trang] trước.', 'error');
      return;
    }
    if (!testDescription) {
      addLog('Vui lòng nhập mô tả kịch bản test bằng tiếng Việt.', 'error');
      return;
    }

    setIsGenerating(true);
    addLog(`Đang gửi yêu cầu đến Gemini AI...`);

    try {
      const response = await axios.post('http://localhost:5000/api/generate-script', {
        html: htmlContext,
        description: testDescription,
        url
      });
      
      if (response.data.success) {
        setGeneratedScript(response.data.script);
        setActiveTab('script');
        addLog('AI đã tạo xong mã nguồn Test Script bằng Mocha/Selenium.', 'success');
      }
    } catch (error) {
      addLog(`Lỗi khi gọi AI: ${error.response?.data?.error || error.message}`, 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRunTest = async () => {
    if (!generatedScript) {
      addLog('Chưa có Test Script nào để chạy. Vui lòng tạo script trước!', 'error');
      return;
    }

    setIsRunning(true);
    addLog('Bắt đầu khởi chạy Test Runner (Mocha/Mochawesome)...');
    
    try {
      const response = await axios.post('http://localhost:5000/api/run-test', {
        script: generatedScript
      });
      
      const { result } = response.data;
      if (result.success) {
        addLog('Test chạy THÀNH CÔNG \u2705', 'success');
      } else {
        addLog('Test chạy THẤT BẠI \u274c', 'error');
      }
      
      addLog(result.stdout, result.success ? 'info' : 'error');
      
      if (result.reportHtml) {
        addLog(`Báo cáo đã được lưu tại: ${result.reportHtml}`, 'success');
      }
      
    } catch (error) {
      addLog(`Lỗi khi chạy test: ${error.response?.data?.error || error.message}`, 'error');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div id="root">
      {/* Header Toolbar */}
      <header className="app-header">
        <div className="app-header-left">
          <div className="logo">
            <Zap size={18} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }}/> 
            QA Studio
          </div>
        </div>
        <div className="toolbar">
          <button className="toolbar-btn" onClick={() => addLog('Đã lưu kịch bản tạm thời.')}>
            <Save size={16} /> Lưu
          </button>
          <button 
            className="toolbar-btn run" 
            onClick={handleRunTest}
            disabled={isRunning || !generatedScript}
            style={{ opacity: (isRunning || !generatedScript) ? 0.5 : 1 }}
          >
            {isRunning ? <Square size={16} fill="white" /> : <Play size={16} fill="white" />}
            {isRunning ? 'Đang chạy...' : 'Chạy Test'}
          </button>
          <button className="toolbar-btn">
            <Settings size={16} /> Cài đặt
          </button>
        </div>
      </header>

      {/* Main Body */}
      <div className="main-container">
        
        {/* Sidebar */}
        <div className="sidebar">
          <div className="sidebar-header">Test Explorer</div>
          <div className="tree-view">
            <div className="tree-item"><Folder className="tree-icon" /> Test Suites</div>
            <div className="tree-item"><Folder className="tree-icon" /> Data Files</div>
            <div className="tree-item"><Folder className="tree-icon" /> Test Cases</div>
            <div style={{ paddingLeft: 16 }}>
              <div className="tree-item active"><FileText className="tree-icon" /> TC_Search_Feature</div>
              <div className="tree-item"><FileText className="tree-icon" /> TC_Login_Flow</div>
            </div>
            <div className="tree-item"><Folder className="tree-icon" /> Object Repository</div>
          </div>
        </div>

        {/* Editor Workspace */}
        <div className="workspace">
          <div className="tabs">
            <div 
              className={`tab ${activeTab === 'manual' ? 'active' : ''}`}
              onClick={() => setActiveTab('manual')}
            >
              Cấu hình & Natural Language
            </div>
            <div 
              className={`tab ${activeTab === 'script' ? 'active' : ''}`}
              onClick={() => setActiveTab('script')}
            >
              Mã nguồn tự động (Script)
            </div>
          </div>
          
          <div className="editor-content">
            {activeTab === 'manual' && (
              <div>
                <div className="input-group">
                  <label><Globe size={16} style={{ display: 'inline', verticalAlign: 'text-bottom' }}/> URL Trang Web</label>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <input 
                      type="text" 
                      className="input-field" 
                      value={url} 
                      onChange={e => setUrl(e.target.value)} 
                    />
                    <button 
                      className="toolbar-btn" 
                      onClick={handleExtractPage}
                      disabled={isExtracting}
                      style={{ minWidth: 160, background: 'var(--bg-tertiary)' }}
                    >
                      {isExtracting ? 'Đang quét...' : 'Phân tích trang (AI)'}
                    </button>
                  </div>
                </div>

                <div className="input-group">
                  <label><AlertCircle size={16} style={{ display: 'inline', verticalAlign: 'text-bottom' }}/> Viết Test Case bằng Tiếng Việt (Ngôn ngữ tự nhiên)</label>
                  <textarea 
                    className="input-field" 
                    value={testDescription} 
                    onChange={e => setTestDescription(e.target.value)} 
                    placeholder="Ví dụ: Kiểm thử luồng đăng nhập. Điền vào ô tài khoản user123, ở ô password gõ pass123. Bấm vào nút Đăng nhập và hy vọng nhìn thấy thẻ h2 chứa chữ 'Welcome'."
                  />
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
                  <button 
                    className="toolbar-btn" 
                    onClick={handleGenerateScript}
                    disabled={isGenerating || !htmlContext}
                    style={{ background: 'var(--accent-color)', color: 'white', border: 'none', padding: '10px 20px' }}
                  >
                    <Code size={18} /> {isGenerating ? 'Đang sinh code...' : 'AI Sinh Test Script'}
                  </button>
                </div>
              </div>
            )}
            
            {activeTab === 'script' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    <CheckCircle size={16} color="var(--success-color)" style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: 4 }}/> 
                    Mã nguồn đã được tạo sẵn bởi Gemini AI
                  </div>
                </div>
                <textarea 
                  className="input-field" 
                  style={{ height: 'calc(100vh - 400px)', fontFamily: 'monospace', whiteSpace: 'pre' }}
                  value={generatedScript}
                  onChange={e => setGeneratedScript(e.target.value)}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Console */}
      <div className="console">
        <div className="console-header">
          <span><Terminal size={14} style={{ display: 'inline', verticalAlign: 'text-bottom' }}/> Console</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Log Viewer</span>
        </div>
        <div className="console-body">
          {logs.length === 0 ? (
            <div style={{ color: 'var(--border-color)' }}>Chưa có log hệ thống.</div>
          ) : (
            logs.map((log, idx) => (
              <div key={idx} className={`log-entry ${log.type}`}>
                <span style={{ color: 'var(--text-secondary)' }}>[{log.time}]</span>{' '}
                {log.text}
              </div>
            ))
          )}
          <div ref={consoleEndRef} />
        </div>
      </div>
    </div>
  );
};

export default App;
