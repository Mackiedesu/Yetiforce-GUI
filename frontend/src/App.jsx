import React, { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Play, Square, Save, Settings,
  Folder, FileText, Code, CheckCircle,
  Terminal, Globe, Zap, AlertCircle,
  Search, Crosshair, Shield, Trash2,
  Eye, ChevronRight, ChevronDown, X,
  Database, Activity, RefreshCw, Pencil, Check,
  BarChart3, Clock, Monitor, Image, AlertTriangle,
  Paperclip, SendHorizontal, Sparkles, Home, ListTodo
} from 'lucide-react';
import './index.css';

const BACKEND_URL = 'http://localhost:5000';

const App = () => {
  const [activeTab, setActiveTab] = useState('manual');
  const [url, setUrl] = useState('https://example.com');
  const [testDescription, setTestDescription] = useState('');

  const [htmlContext, setHtmlContext] = useState('');
  const [generatedScript, setGeneratedScript] = useState('');

  const [logs, setLogs] = useState([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [activeFile, setActiveFile] = useState('TC_Search_Feature');

  // Object Repository states
  const [objects, setObjects] = useState([]);
  const [selectedObject, setSelectedObject] = useState(null);
  const [selectedObjectDetail, setSelectedObjectDetail] = useState(null);

  // Object Spy states
  const [spyActive, setSpyActive] = useState(false);
  const [spyUrl, setSpyUrl] = useState('');
  const [showSpyModal, setShowSpyModal] = useState(false);
  const [isStartingSpy, setIsStartingSpy] = useState(false);

  // Sidebar folders open/close
  const [openFolders, setOpenFolders] = useState({ testSuites: false, testCases: true, objectRepo: false });

  // Nav rail active section
  const [activeNav, setActiveNav] = useState('tests'); // home | plans | tests | objects | executions | analytics
  const [explorerOpen, setExplorerOpen] = useState(true);
  const [consoleOpen, setConsoleOpen] = useState(true);
  const [execDetailTab, setExecDetailTab] = useState('overview'); // 'overview' | 'tests'

  // Test Suites states
  const [suites, setSuites] = useState([]);
  const [showCreateSuiteModal, setShowCreateSuiteModal] = useState(false);
  const [newSuiteName, setNewSuiteName] = useState('');
  const [newSuiteDesc, setNewSuiteDesc] = useState('');

  // Self-Healing
  const [healingReport, setHealingReport] = useState(null);

  // Report Dashboard states
  const [latestReport, setLatestReport] = useState(null);
  const [realtimeStats, setRealtimeStats] = useState({ passed: 0, failed: 0, running: 0, total: 0 });
  const [realtimeSteps, setRealtimeSteps] = useState([]);
  const [realtimeEnv, setRealtimeEnv] = useState(null);
  const [reportHistory, setReportHistory] = useState([]);
  const [selectedTestCase, setSelectedTestCase] = useState(null);
  const [testRunning, setTestRunning] = useState(false);
  const [runStartTime, setRunStartTime] = useState(null);
  const [runElapsed, setRunElapsed] = useState(0);

  const consoleEndRef = useRef(null);
  const wsRef = useRef(null);

  // ==================== WebSocket ====================
  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:5000/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WS] Connected');
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'spy_started':
          setSpyActive(true);
          addLog(`🔍 Object Spy đã bắt đầu tại: ${data.url}`, 'success');
          break;
        case 'spy_stopped':
          setSpyActive(false);
          setIsStartingSpy(false);
          addLog(`🔍 Object Spy đã dừng. Đã capture ${data.capturedCount} phần tử.`, 'info');
          fetchObjects();
          break;
        case 'object_captured':
          addLog(`✅ Đã capture: ${data.object.objectId} <${data.object.tagName}> (${data.object.locatorCount} locators)`, 'success');
          fetchObjects();
          break;
        case 'spy_status':
          setSpyActive(data.active);
          break;
        case 'test_progress':
          handleTestProgress(data);
          break;
        case 'test_complete':
          handleTestComplete(data);
          break;
        default:
          break;
      }
    };

    ws.onclose = () => {
      console.log('[WS] Disconnected');
    };

    return () => {
      ws.close();
    };
  }, []);

  // ==================== Auto scroll console ====================
  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // ==================== Load objects on mount ====================
  useEffect(() => {
    fetchObjects();
    fetchReportHistory();
    fetchSuites();
  }, []);

  // ==================== Elapsed time ticker ====================
  useEffect(() => {
    let interval;
    if (testRunning && runStartTime) {
      interval = setInterval(() => {
        setRunElapsed(Math.floor((Date.now() - runStartTime) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [testRunning, runStartTime]);

  // ==================== Helper Functions ====================
  const addLog = useCallback((msg, type = 'info') => {
    setLogs(prev => [...prev, { text: msg, type, time: new Date().toLocaleTimeString() }]);
  }, []);

  const fetchObjects = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/objects`);
      if (response.data.success) {
        setObjects(response.data.objects);
      }
    } catch (error) {
      // Silently fail on initial load
    }
  };

  const fetchObjectDetail = async (objectId) => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/objects/${objectId}`);
      if (response.data.success) {
        setSelectedObjectDetail(response.data.object);
      }
    } catch (error) {
      addLog(`Lỗi khi tải chi tiết object: ${error.message}`, 'error');
    }
  };

  // Editing states
  const [isEditingObject, setIsEditingObject] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const handleDeleteObject = async (objectId) => {
    try {
      await axios.delete(`${BACKEND_URL}/api/objects/${objectId}`);
      addLog(`Đã xóa object: ${objectId}`, 'info');
      setSelectedObject(null);
      setSelectedObjectDetail(null);
      fetchObjects();
    } catch (error) {
      addLog(`Lỗi khi xóa: ${error.message}`, 'error');
    }
  };

  const handleStartEdit = () => {
    setEditName(selectedObjectDetail.objectId);
    setEditDescription(selectedObjectDetail.description || '');
    setIsEditingObject(true);
  };

  const handleSaveEdit = async () => {
    try {
      if (!editName.trim()) {
        addLog('Tên object không được để trống.', 'error');
        return;
      }
      await axios.put(`${BACKEND_URL}/api/objects/${selectedObjectDetail.objectId}`, {
        objectId: editName.trim(),
        description: editDescription
      });
      addLog(`Đã cập nhật object: ${editName.trim()}`, 'success');
      setIsEditingObject(false);
      setSelectedObject(editName.trim());
      fetchObjectDetail(editName.trim());
      fetchObjects();
    } catch (error) {
      addLog(`Lỗi khi cập nhật: ${error.response?.data?.error || error.message}`, 'error');
    }
  };

  const handleCancelEdit = () => {
    setIsEditingObject(false);
  };

  // ==================== Sidebar Click ====================
  const handleSidebarClick = (itemName) => {
    if (itemName === 'Test Cases') {
      setOpenFolders(prev => ({ ...prev, testCases: !prev.testCases }));
    } else if (itemName === 'Object Repository') {
      setOpenFolders(prev => ({ ...prev, objectRepo: !prev.objectRepo }));
      setActiveTab('objectRepo');
      fetchObjects();
    } else if (itemName.startsWith('TC_')) {
      setActiveFile(itemName);
      setActiveTab('manual');
      addLog(`Đã chuyển sang file: ${itemName}`, 'info');
    } else if (itemName.startsWith('OBJ_')) {
      const objectId = itemName.replace('OBJ_', '');
      setSelectedObject(objectId);
      setActiveTab('objectRepo');
      fetchObjectDetail(objectId);
      setIsEditingObject(false);
    } else {
      addLog(`Thư mục "${itemName}" đang được phát triển`, 'info');
    }
  };

  // ==================== Extract & Generate & Run (same as before) ====================
  const handleExtractPage = async () => {
    if (!url) { addLog('Vui lòng nhập URL trang web', 'error'); return; }

    setIsExtracting(true);
    addLog(`Đang khởi chạy trình duyệt ngầm để phân tích cấu trúc: ${url}...`);

    try {
      const response = await axios.post(`${BACKEND_URL}/api/extract`, { url });
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
    if (!htmlContext) { addLog('Chưa có thông tin HTML của trang web. Vui lòng bấm [Phân tích trang] trước.', 'error'); return; }
    if (!testDescription) { addLog('Vui lòng nhập mô tả kịch bản test bằng tiếng Việt.', 'error'); return; }

    setIsGenerating(true);
    addLog(`Đang gửi yêu cầu đến Gemini AI...`);

    try {
      const response = await axios.post(`${BACKEND_URL}/api/generate-script`, {
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
    if (!generatedScript) { addLog('Chưa có Test Script nào để chạy. Vui lòng tạo script trước!', 'error'); return; }

    setIsRunning(true);
    setTestRunning(true);
    setRunStartTime(Date.now());
    setRunElapsed(0);
    setRealtimeStats({ passed: 0, failed: 0, running: 0, total: 0 });
    setRealtimeSteps([]);
    setRealtimeEnv(null);
    setSelectedTestCase(null);
    setActiveTab('report');
    addLog('Bắt đầu khởi chạy Test Runner (Mocha/Mochawesome)...');

    try {
      const response = await axios.post(`${BACKEND_URL}/api/run-test`, { script: generatedScript });

      const { result } = response.data;
      if (result.success) {
        addLog('Test chạy THÀNH CÔNG ✅', 'success');
      } else {
        addLog('Test chạy THẤT BẠI ❌', 'error');
      }

      if (result.stdout) addLog(result.stdout, result.success ? 'info' : 'error');

      if (result.enhancedReport) {
        setLatestReport(result.enhancedReport);
      }

      fetchHealingReport();
      fetchReportHistory();

    } catch (error) {
      addLog(`Lỗi khi chạy test: ${error.response?.data?.error || error.message}`, 'error');
    } finally {
      setIsRunning(false);
      setTestRunning(false);
    }
  };

  // ==================== Realtime Test Event Handlers ====================
  const handleTestProgress = (data) => {
    switch (data.event) {
      case 'run_start':
        addLog('🚀 Test runner đã khởi động...', 'info');
        break;
      case 'suite_start':
        addLog(`📋 Bắt đầu suite: ${data.title}`, 'info');
        break;
      case 'env_collected':
        setRealtimeEnv(data.environment);
        addLog(`🖥️ Env: ${data.environment?.browser || 'Unknown'} | ${data.environment?.os || 'Unknown'}`, 'info');
        break;
      case 'test_case_start':
        addLog(`▶️ Đang chạy: ${data.title}`, 'info');
        setRealtimeStats(prev => ({ ...prev, running: prev.running + 1 }));
        break;
      case 'test_case_pass':
        addLog(`✅ PASSED: ${data.title} (${((data.duration || 0) / 1000).toFixed(1)}s)`, 'success');
        setRealtimeStats(prev => ({ ...prev, passed: prev.passed + 1, running: Math.max(0, prev.running - 1), total: prev.total + 1 }));
        setRealtimeSteps(prev => [...prev, { action: data.title, status: 'passed', duration: data.duration || 0 }]);
        break;
      case 'test_case_fail':
        addLog(`❌ FAILED: ${data.title} — ${data.error || ''}`, 'error');
        setRealtimeStats(prev => ({ ...prev, failed: prev.failed + 1, running: Math.max(0, prev.running - 1), total: prev.total + 1 }));
        setRealtimeSteps(prev => [...prev, { action: data.title, status: 'failed', duration: data.duration || 0, error: data.error }]);
        break;
      case 'step':
        setRealtimeSteps(prev => [...prev, data.step]);
        break;
      case 'screenshot':
        addLog(`📸 Screenshot captured: ${data.filename}`, 'info');
        break;
      case 'suite_end':
        addLog('✔️ Suite hoàn tất.', 'success');
        break;
      default:
        break;
    }
  };

  const handleTestComplete = (data) => {
    if (data.report) {
      setLatestReport(data.report);
      setRealtimeStats({
        passed: data.report.summary.passed,
        failed: data.report.summary.failed,
        running: 0,
        total: data.report.summary.total
      });
    }
  };

  const fetchReportHistory = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/reports`);
      if (response.data.success) setReportHistory(response.data.reports);
    } catch (error) { /* silently fail */ }
  };

  // ==================== Test Suites ====================
  const fetchSuites = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/suites`);
      if (response.data.success) setSuites(response.data.suites);
    } catch (error) { /* silently fail */ }
  };

  const handleCreateSuite = async () => {
    if (!newSuiteName.trim()) { addLog('Tên suite không được để trống.', 'error'); return; }
    try {
      const response = await axios.post(`${BACKEND_URL}/api/suites`, {
        name: newSuiteName.trim(),
        description: newSuiteDesc.trim()
      });
      if (response.data.success) {
        addLog(`Đã tạo Test Suite: ${newSuiteName}`, 'success');
        setShowCreateSuiteModal(false);
        setNewSuiteName('');
        setNewSuiteDesc('');
        fetchSuites();
      }
    } catch (error) {
      addLog(`Lỗi tạo suite: ${error.response?.data?.error || error.message}`, 'error');
    }
  };

  const handleAddCurrentScriptToSuite = async (suiteId) => {
    if (!generatedScript) { addLog('Chưa có script để thêm. Hãy tạo script trước.', 'error'); return; }
    try {
      const suite = (await axios.get(`${BACKEND_URL}/api/suites/${suiteId}`)).data.suite;
      const testCases = suite.testCases || [];
      testCases.push({
        name: testDescription || `Test Case ${testCases.length + 1}`,
        description: `URL: ${url}`,
        script: generatedScript,
        url: url
      });
      await axios.put(`${BACKEND_URL}/api/suites/${suiteId}`, { testCases });
      addLog(`Đã thêm test case vào suite: ${suite.name}`, 'success');
      fetchSuites();
    } catch (error) {
      addLog(`Lỗi: ${error.message}`, 'error');
    }
  };

  // ==================== Object Spy ====================
  const handleStartSpy = async () => {
    if (!spyUrl) { addLog('Vui lòng nhập URL để Spy.', 'error'); return; }

    setIsStartingSpy(true);
    addLog(`🔍 Đang khởi chạy Object Spy cho: ${spyUrl}...`);

    try {
      const response = await axios.post(`${BACKEND_URL}/api/spy/start`, { url: spyUrl });
      if (response.data.success) {
        setShowSpyModal(false);
        addLog(response.data.message, 'success');
      }
    } catch (error) {
      addLog(`Lỗi khi khởi chạy Spy: ${error.response?.data?.error || error.message}`, 'error');
      setIsStartingSpy(false);
    }
  };

  const handleStopSpy = async () => {
    try {
      await axios.post(`${BACKEND_URL}/api/spy/stop`);
    } catch (error) {
      addLog(`Lỗi khi dừng Spy: ${error.message}`, 'error');
    }
  };

  const fetchHealingReport = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/healing/report`);
      if (response.data.success) {
        setHealingReport(response.data.report);
        if (response.data.report.totalHealed > 0) {
          addLog(`⚕️ Self-Healing: ${response.data.report.totalHealed} phần tử đã được tự chữa lành. Xem chi tiết tại tab Object Repository.`, 'info');
        }
      }
    } catch (error) {
      // Silently fail
    }
  };

  // ==================== Locator type display mapping ====================
  const locatorTypeLabel = (type) => {
    const map = { id: 'ID', name: 'Name', className: 'Class', css: 'CSS', xpath: 'XPath', 'data-testid': 'TestID', linkText: 'LinkText' };
    return map[type] || type;
  };

  const locatorTypeBadgeClass = (type) => {
    const map = { id: 'badge-green', name: 'badge-blue', className: 'badge-purple', css: 'badge-orange', xpath: 'badge-yellow', 'data-testid': 'badge-cyan' };
    return map[type] || 'badge-default';
  };

  // ==================== Pie Chart Component ====================
  const PieChart = ({ passed = 0, failed = 0, pending = 0 }) => {
    const total = passed + failed + pending;
    if (total === 0) {
      return (
        <svg viewBox="0 0 120 120" className="pie-svg">
          <circle cx="60" cy="60" r="50" fill="none" stroke="var(--border-color)" strokeWidth="20" />
          <text x="60" y="60" textAnchor="middle" dy="0.35em" fill="var(--text-secondary)" fontSize="14">N/A</text>
        </svg>
      );
    }

    const radius = 50;
    const circumference = 2 * Math.PI * radius;
    const passedPct = passed / total;
    const failedPct = failed / total;
    const pendingPct = pending / total;

    const passedLen = passedPct * circumference;
    const failedLen = failedPct * circumference;
    const pendingLen = pendingPct * circumference;

    const passedOffset = 0;
    const failedOffset = -(passedLen);
    const pendingOffset = -(passedLen + failedLen);

    return (
      <svg viewBox="0 0 120 120" className="pie-svg">
        {passed > 0 && (
          <circle cx="60" cy="60" r={radius} fill="none" stroke="#4CAF50" strokeWidth="20"
            strokeDasharray={`${passedLen} ${circumference - passedLen}`}
            strokeDashoffset={passedOffset}
            transform="rotate(-90 60 60)"
          />
        )}
        {failed > 0 && (
          <circle cx="60" cy="60" r={radius} fill="none" stroke="#f44336" strokeWidth="20"
            strokeDasharray={`${failedLen} ${circumference - failedLen}`}
            strokeDashoffset={failedOffset}
            transform="rotate(-90 60 60)"
          />
        )}
        {pending > 0 && (
          <circle cx="60" cy="60" r={radius} fill="none" stroke="#FF9800" strokeWidth="20"
            strokeDasharray={`${pendingLen} ${circumference - pendingLen}`}
            strokeDashoffset={pendingOffset}
            transform="rotate(-90 60 60)"
          />
        )}
        <text x="60" y="55" textAnchor="middle" fill="var(--text-primary)" fontSize="18" fontWeight="700">{total}</text>
        <text x="60" y="72" textAnchor="middle" fill="var(--text-secondary)" fontSize="10">tests</text>
      </svg>
    );
  };

  // ==================== RENDER ====================
  return (
    <div id="root">
      {/* Header Toolbar */}
      <header className="app-header">
        <div className="app-header-left">
          <div className="logo">
            <Zap size={18} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} />
            QA Studio
          </div>
        </div>
        <div className="toolbar">
          {/* Spy Button */}
          {spyActive ? (
            <button className="toolbar-btn spy-active" onClick={handleStopSpy}>
              <Crosshair size={16} className="pulse-icon" /> Dừng Spy
            </button>
          ) : (
            <button className="toolbar-btn" onClick={() => { setSpyUrl(url); setShowSpyModal(true); }}>
              <Crosshair size={16} /> Object Spy
            </button>
          )}
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

        {/* ===== NAV RAIL ===== */}
        <nav className="nav-rail">
          {/* QA Studio AI (Top) */}
          <button className={`nav-rail-item ${activeNav === 'ai' ? 'active' : ''}`} onClick={() => { setActiveNav('ai'); setActiveTab('manual'); setExplorerOpen(false); }}>
            <Sparkles size={22} />
            <span style={{ fontSize: '0.55rem', textAlign: 'center', paddingTop: '2px', lineHeight: '1.2' }}>QA Studio AI</span>
          </button>
          
          <button className={`nav-rail-item ${activeNav === 'home' ? 'active' : ''}`} onClick={() => { setActiveNav('home'); setExplorerOpen(false); }}>
            <Home size={22} />
            <span>Home</span>
          </button>

          <button className={`nav-rail-item ${activeNav === 'plans' ? 'active' : ''}`} onClick={() => { setActiveNav('plans'); setExplorerOpen(false); }}>
            <ListTodo size={22} />
            <span>Plans</span>
          </button>

          <button className={`nav-rail-item ${activeNav === 'tests' ? 'active' : ''}`} onClick={() => { setActiveNav('tests'); setActiveTab('script'); setExplorerOpen(true); }}>
            <Folder size={22} />
            <span>Tests</span>
          </button>

          <button className={`nav-rail-item ${activeNav === 'objects' ? 'active' : ''}`} onClick={() => { setActiveNav('objects'); setActiveTab('objectRepo'); fetchObjects(); setExplorerOpen(true); }}>
            <Database size={22} />
            <span style={{ fontSize: '0.52rem', textAlign: 'center', paddingTop: '2px', lineHeight: '1.2' }}>Object Repository</span>
            {objects.length > 0 && <span className="nav-badge">{objects.length}</span>}
          </button>

          <button className={`nav-rail-item ${activeNav === 'executions' ? 'active' : ''}`} onClick={() => { setActiveNav('executions'); setActiveTab('report'); setExplorerOpen(false); }}>
            <Play size={22} />
            <span>Executions</span>
            {testRunning && <span className="nav-badge live">LIVE</span>}
          </button>

          <button className={`nav-rail-item ${activeNav === 'analytics' ? 'active' : ''}`} onClick={() => { setActiveNav('analytics'); setExplorerOpen(false); }}>
            <BarChart3 size={22} />
            <span>Analytics</span>
          </button>

          <div style={{ flex: 1 }}></div>

          <button className={`nav-rail-item ${activeNav === 'settings' ? 'active' : ''}`} onClick={() => { setActiveNav('settings'); setExplorerOpen(false); }}>
            <Settings size={22} />
            <span style={{ fontSize: '0.55rem', textAlign: 'center', paddingTop: '2px', lineHeight: '1.2' }}>Project Settings</span>
          </button>
        </nav>

        {/* ===== EXPLORER PANEL ===== */}
        {explorerOpen && (
          <div className="explorer-panel">
            <div className="explorer-header">
              <span className="explorer-title">Explorer</span>
              <button className="explorer-toggle" onClick={() => setExplorerOpen(false)}>
                <X size={16} />
              </button>
            </div>
            
            <div className="tree-view">
              {activeNav === 'tests' && (
                <>
                  <div className="tree-item" onClick={() => { setOpenFolders(prev => ({ ...prev, testSuites: !prev.testSuites })); fetchSuites(); }}>
                    {openFolders.testSuites ? <ChevronDown className="tree-icon" size={14} /> : <ChevronRight className="tree-icon" size={14} />}
                    <Folder className="tree-icon" /> Test Suites
                    {suites.length > 0 && <span className="badge-count">{suites.length}</span>}
                  </div>
                  {openFolders.testSuites && (
                    <div style={{ paddingLeft: 16 }}>
                      <div className="tree-item" style={{ color: 'var(--accent-color)', fontSize: '0.8rem' }} onClick={() => setShowCreateSuiteModal(true)}>
                        + Tạo Suite mới
                      </div>
                      {suites.map(s => (
                        <div key={s.suiteId} className="tree-item" onClick={() => { setActiveTab('report'); addLog(`Đã chọn suite: ${s.name}`, 'info'); }}>
                          <FileText className="tree-icon" />
                          <span className="tree-obj-name">{s.name}</span>
                          <span className="tree-obj-tag">{s.testCaseCount} TC</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Test Cases folder */}
                  <div className="tree-item" onClick={() => handleSidebarClick('Test Cases')}>
                    {openFolders.testCases ? <ChevronDown className="tree-icon" size={14} /> : <ChevronRight className="tree-icon" size={14} />}
                    <Folder className="tree-icon" /> Test Cases
                  </div>
                  {openFolders.testCases && (
                    <div style={{ paddingLeft: 16 }}>
                      <div
                        className={`tree-item ${activeFile === 'TC_Search_Feature' && activeTab !== 'objectRepo' ? 'active' : ''}`}
                        onClick={() => handleSidebarClick('TC_Search_Feature')}
                      >
                        <FileText className="tree-icon" /> TC_Search_Feature
                      </div>
                      <div
                        className={`tree-item ${activeFile === 'TC_Login_Flow' && activeTab !== 'objectRepo' ? 'active' : ''}`}
                        onClick={() => handleSidebarClick('TC_Login_Flow')}
                      >
                        <FileText className="tree-icon" /> TC_Login_Flow
                      </div>
                    </div>
                  )}
                </>
              )}

              {activeNav === 'objects' && (
                <>
                  <div className="tree-item" onClick={() => handleSidebarClick('Object Repository')}>
                    {openFolders.objectRepo ? <ChevronDown className="tree-icon" size={14} /> : <ChevronRight className="tree-icon" size={14} />}
                    <Database className="tree-icon" /> Object Repository
                    {objects.length > 0 && (
                      <span className="badge-count">{objects.length}</span>
                    )}
                  </div>
                  {openFolders.objectRepo && (
                    <div style={{ paddingLeft: 16 }}>
                      {objects.length === 0 ? (
                        <div className="tree-item empty-hint">
                          Chưa có object nào. Dùng Object Spy để capture.
                        </div>
                      ) : (
                        objects.map(obj => (
                          <div
                            key={obj.objectId}
                            className={`tree-item ${selectedObject === obj.objectId ? 'active' : ''}`}
                            onClick={() => handleSidebarClick(`OBJ_${obj.objectId}`)}
                            title={obj.description || obj.objectId}
                          >
                            <FileText className="tree-icon" />
                            <span className="tree-obj-name">{obj.objectId}</span>
                            <span className="tree-obj-tag">&lt;{obj.tagName}&gt;</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Editor Workspace */}
        <div className="workspace">


          <div className="editor-content">
            {/* ========== TAB: Manual ========== */}
            {activeTab === 'manual' && (
              <div className="ai-chat-layout">
                {/* URL Config row — compact top bar */}
                <div className="ai-url-bar">
                  <Globe size={14} className="ai-url-icon" />
                  <input
                    type="text"
                    className="ai-url-input"
                    value={url}
                    onChange={e => setUrl(e.target.value)}
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

                {/* Center hero area */}
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

                {/* Chat-style input box */}
                <div className="ai-input-wrapper">
                  <div className="ai-input-box">
                    <textarea
                      className="ai-textarea"
                      value={testDescription}
                      onChange={e => setTestDescription(e.target.value)}
                      placeholder="Mô tả kịch bản kiểm thử... Ví dụ: Kiểm thử đăng nhập với tài khoản user123, mật khẩu pass123 và xác nhận thông báo chào mừng."
                      rows={3}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                          e.preventDefault();
                          if (!isGenerating && htmlContext) handleGenerateScript();
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
                        {isGenerating ? (
                          <RefreshCw size={16} className="spin-icon" />
                        ) : (
                          <SendHorizontal size={16} />
                        )}
                      </button>
                    </div>
                  </div>
                  <p className="ai-disclaimer">
                    QA Studio AI có thể mắc lỗi. Vui lòng kiểm tra kỹ trước khi chạy.
                  </p>
                </div>
              </div>
            )}

            {/* ========== TAB: Script ========== */}
            {activeTab === 'script' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    <CheckCircle size={16} color="var(--success-color)" style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: 4 }} />
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

            {/* ========== TAB: Object Repository ========== */}
            {activeTab === 'objectRepo' && (
              <div className="object-repo-container">
                {/* Header */}
                <div className="object-repo-header">
                  <div className="object-repo-title">
                    <Database size={20} />
                    <h2>Object Repository</h2>
                    <span className="obj-count-label">{objects.length} objects</span>
                  </div>
                  <div className="object-repo-actions">
                    <button className="toolbar-btn" onClick={fetchObjects}>
                      <RefreshCw size={14} /> Làm mới
                    </button>
                    <button
                      className={`toolbar-btn ${spyActive ? 'spy-active' : ''}`}
                      onClick={() => spyActive ? handleStopSpy() : (setSpyUrl(url), setShowSpyModal(true))}
                    >
                      <Crosshair size={14} className={spyActive ? 'pulse-icon' : ''} />
                      {spyActive ? 'Dừng Spy' : 'Bắt đầu Spy'}
                    </button>
                  </div>
                </div>

                {/* Self-Healing Report Banner */}
                {healingReport && healingReport.totalHealed > 0 && (
                  <div className="healing-banner">
                    <Shield size={16} />
                    <span>
                      Self-Healing: <strong>{healingReport.totalHealed}</strong> phần tử đã được tự chữa lành trong lần chạy gần nhất.
                      {healingReport.totalFailed > 0 && (
                        <span className="healing-failed"> | {healingReport.totalFailed} phần tử thất bại hoàn toàn.</span>
                      )}
                    </span>
                  </div>
                )}

                {/* Content */}
                <div className="object-repo-body">
                  {/* Object List */}
                  <div className="object-list">
                    <div className="object-list-header">
                      <Search size={14} />
                      <span>Danh sách Objects</span>
                    </div>
                    {objects.length === 0 ? (
                      <div className="empty-state">
                        <Crosshair size={40} />
                        <p>Chưa có object nào</p>
                        <span>Sử dụng Object Spy để capture phần tử từ trang web</span>
                      </div>
                    ) : (
                      <div className="object-items">
                        {objects.map(obj => (
                          <div
                            key={obj.objectId}
                            className={`object-item ${selectedObject === obj.objectId ? 'selected' : ''}`}
                            onClick={() => {
                              setSelectedObject(obj.objectId);
                              fetchObjectDetail(obj.objectId);
                              setIsEditingObject(false);
                            }}
                          >
                            <div className="object-item-icon">
                              <FileText size={16} />
                            </div>
                            <div className="object-item-info">
                              <div className="object-item-name">{obj.objectId}</div>
                              <div className="object-item-meta">
                                <span className="obj-tag-badge">&lt;{obj.tagName}&gt;</span>
                                <span className="obj-locator-count">{obj.locatorCount} locators</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Object Detail */}
                  <div className="object-detail">
                    {!selectedObjectDetail ? (
                      <div className="empty-state">
                        <Eye size={40} />
                        <p>Chọn một object để xem chi tiết</p>
                      </div>
                    ) : (
                      <div className="object-detail-content">
                        <div className="object-detail-header">
                          {isEditingObject ? (
                            <input
                              type="text"
                              className="input-field edit-name-input editable"
                              value={editName}
                              onChange={e => setEditName(e.target.value)}
                            />
                          ) : (
                            <h3>{selectedObjectDetail.objectId}</h3>
                          )}
                          <div className="detail-header-actions">
                            {isEditingObject ? (
                              <>
                                <button className="toolbar-btn" onClick={handleSaveEdit}>
                                  <Check size={14} /> Lưu
                                </button>
                                <button className="toolbar-btn" onClick={handleCancelEdit}>
                                  <X size={14} /> Hủy
                                </button>
                              </>
                            ) : (
                              <>
                                <button className="toolbar-btn" onClick={handleStartEdit}>
                                  <Pencil size={14} /> Sửa
                                </button>
                                <button
                                  className="toolbar-btn delete-btn"
                                  onClick={() => handleDeleteObject(selectedObjectDetail.objectId)}
                                >
                                  <Trash2 size={14} /> Xóa
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Healing Warning */}
                        {selectedObjectDetail.healingStatus?.needsUpdate && (
                          <div className="healing-warning">
                            <Shield size={14} />
                            <span>
                              Locator chính đã hỏng! Đã tự chữa bằng: <strong>{selectedObjectDetail.healingStatus.usedFallback?.type}</strong>
                            </span>
                          </div>
                        )}

                        {/* Basic Info */}
                        <div className="detail-section">
                          <div className="detail-row">
                            <span className="detail-label">Tag</span>
                            <span className="detail-value">&lt;{selectedObjectDetail.tagName}&gt;</span>
                          </div>
                          <div className="detail-row">
                            <span className="detail-label">Text</span>
                            <span className="detail-value">{selectedObjectDetail.textContent || '—'}</span>
                          </div>
                          <div className="detail-row">
                            <span className="detail-label">Source URL</span>
                            <span className="detail-value url-value">{selectedObjectDetail.sourceUrl || '—'}</span>
                          </div>
                          {selectedObjectDetail.parentFrame && (
                            <div className="detail-row">
                              <span className="detail-label">Parent Frame</span>
                              <span className="detail-value">
                                {selectedObjectDetail.parentFrame.id || selectedObjectDetail.parentFrame.name || `Frame #${selectedObjectDetail.parentFrame.index}`}
                              </span>
                            </div>
                          )}
                          <div className="detail-row">
                            <span className="detail-label">Description</span>
                            {isEditingObject ? (
                              <textarea
                                className="input-field edit-desc-input"
                                value={editDescription}
                                onChange={e => setEditDescription(e.target.value)}
                                placeholder="Nhập mô tả cho phần tử này..."
                                rows={3}
                              />
                            ) : (
                              <span className="detail-value">{selectedObjectDetail.description || 'Chưa có mô tả'}</span>
                            )}
                          </div>
                        </div>

                        {/* Locators */}
                        <div className="detail-section">
                          <h4>
                            <Activity size={14} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: 4 }} />
                            Locators ({selectedObjectDetail.locators?.length || 0})
                          </h4>
                          <div className="locators-list">
                            {(selectedObjectDetail.locators || []).map((loc, idx) => (
                              <div key={idx} className={`locator-item ${loc.status === 'active' ? '' : 'inactive'}`}>
                                <div className="locator-priority">#{loc.priority}</div>
                                <span className={`locator-type-badge ${locatorTypeBadgeClass(loc.type)}`}>
                                  {locatorTypeLabel(loc.type)}
                                </span>
                                <code className="locator-value">{loc.value}</code>
                                <span className={`locator-status ${loc.status}`}>
                                  {loc.status === 'active' ? '✓' : '✗'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Screenshot */}
                        {selectedObjectDetail.screenshot && (
                          <div className="detail-section">
                            <h4>Screenshot</h4>
                            <div className="screenshot-container">
                              <img
                                src={selectedObjectDetail.screenshot}
                                alt={`Screenshot of ${selectedObjectDetail.objectId}`}
                                className="screenshot-img"
                              />
                            </div>
                          </div>
                        )}

                        {/* Timestamps */}
                        <div className="detail-section timestamps">
                          <span>Tạo: {new Date(selectedObjectDetail.createdAt).toLocaleString()}</span>
                          <span>Cập nhật: {new Date(selectedObjectDetail.updatedAt).toLocaleString()}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ========== TAB: Executions ========== */}
            {activeTab === 'report' && (
              <div className="exec-view">

                {/* ===== DETAIL SCREEN (khi chọn 1 run) ===== */}
                {selectedTestCase ? (() => {
                  const run = selectedTestCase;
                  const passed  = run.summary?.passed  ?? 0;
                  const failed  = run.summary?.failed  ?? 0;
                  const pending = run.summary?.pending ?? 0;
                  const total   = passed + failed + pending || 1;
                  const dur = run.environment?.duration
                    ? (run.environment.duration / 1000).toFixed(0) + 's'
                    : '—';
                  const ts = run.timestamp
                    ? new Date(run.timestamp).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                    : '—';
                  const hasFailure = failed > 0;
                  // SVG donut
                  const R = 120, stroke = 24, cx = 150, cy = 150;
                  const circ = 2 * Math.PI * R;
                  const passAngle  = (passed  / total) * circ;
                  const failAngle  = (failed  / total) * circ;
                  const skipAngle  = (pending / total) * circ;

                  return (
                    <>
                      {/* Breadcrumb bar */}
                      <div className="exec-detail-breadcrumb">
                        <button className="exec-back-btn" onClick={() => { setSelectedTestCase(null); setExecDetailTab('overview'); }}>
                          <ChevronRight size={14} style={{ transform: 'rotate(180deg)' }} />
                          Executions
                        </button>
                        <span className="exec-bc-sep">›</span>
                        <span className="exec-bc-name">{run.title || 'Test Run'}</span>
                        <div style={{ flex: 1 }} />
                        <span className={`exec-status-pill ${hasFailure ? 'fail' : 'pass'}`}>
                          {hasFailure ? 'FAILED' : 'PASSED'}
                        </span>
                        <span className="exec-bc-meta"><Clock size={12} /> {ts}</span>
                        <span className="exec-bc-meta">⏱ {dur}</span>
                      </div>

                      {/* Sub-tabs */}
                      <div className="exec-subtabs">
                        <button
                          className={`exec-subtab ${execDetailTab === 'overview' ? 'active' : ''}`}
                          onClick={() => setExecDetailTab('overview')}
                        >OVERVIEW</button>
                        <button
                          className={`exec-subtab ${execDetailTab === 'tests' ? 'active' : ''}`}
                          onClick={() => setExecDetailTab('tests')}
                        >TESTS</button>
                      </div>

                      {/* OVERVIEW tab */}
                      {execDetailTab === 'overview' && (
                        <div className="exec-overview">
                          <div className="exec-ov-card">
                            <div className="exec-ov-card-title">Test Execution Results Distribution</div>
                            <div className="exec-ov-chart-area">
                              {/* SVG Donut Chart */}
                              <svg width="300" height="300" viewBox="0 0 300 300">
                                {/* Background circle */}
                                <circle cx={cx} cy={cy} r={R}
                                  fill="none"
                                  stroke="var(--bg-hover)"
                                  strokeWidth={stroke}
                                />
                                {/* Pass arc */}
                                {passed > 0 && (
                                  <circle cx={cx} cy={cy} r={R}
                                    fill="none"
                                    stroke="#4CAF50"
                                    strokeWidth={stroke}
                                    strokeDasharray={`${passAngle} ${circ - passAngle}`}
                                    strokeDashoffset={circ * 0.25}
                                    strokeLinecap="butt"
                                  />
                                )}
                                {/* Fail arc */}
                                {failed > 0 && (
                                  <circle cx={cx} cy={cy} r={R}
                                    fill="none"
                                    stroke="#F44336"
                                    strokeWidth={stroke}
                                    strokeDasharray={`${failAngle} ${circ - failAngle}`}
                                    strokeDashoffset={circ * 0.25 - passAngle}
                                    strokeLinecap="butt"
                                  />
                                )}
                                {/* Skip arc */}
                                {pending > 0 && (
                                  <circle cx={cx} cy={cy} r={R}
                                    fill="none"
                                    stroke="#FF9800"
                                    strokeWidth={stroke}
                                    strokeDasharray={`${skipAngle} ${circ - skipAngle}`}
                                    strokeDashoffset={circ * 0.25 - passAngle - failAngle}
                                    strokeLinecap="butt"
                                  />
                                )}
                                {/* Center text */}
                                <text x={cx} y={cy - 12} textAnchor="middle" fill="var(--text-secondary)" fontSize="16">Total</text>
                                <text x={cx} y={cy + 16} textAnchor="middle" fill="var(--text-primary)" fontSize="40" fontWeight="700">{passed + failed + pending}</text>
                              </svg>

                              {/* Legend */}
                              <div className="exec-ov-legend">
                                {passed > 0 && (
                                  <div className="exec-ov-legend-item">
                                    <span className="exec-ov-dot" style={{ background: '#4CAF50' }} />
                                    <span>Passed — <strong>{passed}</strong> ({Math.round(passed/total*100)}%)</span>
                                  </div>
                                )}
                                {failed > 0 && (
                                  <div className="exec-ov-legend-item">
                                    <span className="exec-ov-dot" style={{ background: '#F44336' }} />
                                    <span>Failed — <strong>{failed}</strong> ({Math.round(failed/total*100)}%)</span>
                                  </div>
                                )}
                                {pending > 0 && (
                                  <div className="exec-ov-legend-item">
                                    <span className="exec-ov-dot" style={{ background: '#FF9800' }} />
                                    <span>Skipped — <strong>{pending}</strong> ({Math.round(pending/total*100)}%)</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* TESTS tab */}
                      {execDetailTab === 'tests' && (
                        <div className="exec-tests-view">
                          {/* Column header */}
                          <div className="exec-tests-header">
                            <div className="exec-tests-col-name">TESTS</div>
                            <div className="exec-tests-col-dur">DURATION</div>
                            <div className="exec-tests-col-status">STATUS</div>
                          </div>
                          {/* Rows */}
                          <div className="exec-tests-list">
                            {(run.testCases || []).length === 0 ? (
                              <div className="exec-empty" style={{ padding: '40px 20px' }}>
                                <p>Không có test case nào</p>
                              </div>
                            ) : (
                              (run.testCases || []).map((tc, i) => (
                                <div key={i} className={`exec-tests-row ${tc.status}`}>
                                  <div className="exec-tests-icon">
                                    <span className={`exec-icon ${tc.status === 'passed' ? 'pass' : tc.status === 'failed' ? 'fail' : 'skip'}`} style={{ width: 20, height: 20, fontSize: '0.65rem' }}>
                                      {tc.status === 'passed' ? '✓' : tc.status === 'failed' ? '✕' : '–'}
                                    </span>
                                  </div>
                                  <div className="exec-tests-info">
                                    <div className="exec-tests-name">{tc.title}</div>
                                    {tc.error && (
                                      <div className="exec-tests-error">{tc.error.message || tc.error}</div>
                                    )}
                                  </div>
                                  <div className="exec-tests-dur">
                                    <Clock size={11} /> {tc.duration ? (tc.duration / 1000).toFixed(1) + 's' : '—'}
                                  </div>
                                  <div className="exec-tests-status">
                                    <span className={`status-badge ${tc.status}`}>
                                      {tc.status === 'passed' ? 'PASS' : tc.status === 'failed' ? 'FAIL' : 'SKIP'}
                                    </span>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })() : (
                  /* ===== LIST SCREEN ===== */
                  <>
                    {/* Header */}
                    <div className="exec-header">
                      <div className="exec-header-left">
                        <Play size={18} />
                        <h2>Executions</h2>
                        {testRunning && (
                          <span className="running-indicator">
                            <span className="running-dot" /> Đang chạy... {runElapsed}s
                          </span>
                        )}
                      </div>
                      <button className="toolbar-btn" onClick={fetchReportHistory}>
                        <RefreshCw size={14} /> Làm mới
                      </button>
                    </div>

                    {/* Table header */}
                    <div className="exec-table-header">
                      <div className="exec-col-name">TEST RUN</div>
                      <div className="exec-col-results">RESULTS</div>
                    </div>

                    {/* Execution rows */}
                    <div className="exec-list">
                      {reportHistory.length === 0 && !testRunning ? (
                        <div className="exec-empty">
                          <Play size={36} />
                          <p>Chưa có lần chạy nào</p>
                          <span>Chạy test để xem lịch sử tại đây</span>
                        </div>
                      ) : (
                        [...reportHistory].reverse().slice(0, 10).map((run, idx) => {
                          const passed  = run.summary?.passed  ?? 0;
                          const failed  = run.summary?.failed  ?? 0;
                          const pending = run.summary?.pending ?? 0;
                          const dur = run.environment?.duration
                            ? (run.environment.duration / 1000).toFixed(0) + 's'
                            : '—';
                          const ts = run.timestamp
                            ? new Date(run.timestamp).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                            : '—';
                          const hasFailure = failed > 0;
                          const runId = reportHistory.length - idx;

                          return (
                            <div
                              key={idx}
                              className="exec-row"
                              onClick={() => { setSelectedTestCase({ ...run, runIdx: idx }); setExecDetailTab('overview'); }}
                            >
                              <div className="exec-status-icon">
                                {hasFailure
                                  ? <span className="exec-icon fail">✕</span>
                                  : <span className="exec-icon pass">✓</span>
                                }
                              </div>
                              <div className="exec-info">
                                <div className="exec-run-name">{run.title || `Test Run #${runId}`}</div>
                                <div className="exec-run-meta">
                                  <span><Clock size={12} /> {ts}</span>
                                  <span className="exec-meta-sep">·</span>
                                  <span>⏱ {dur}</span>
                                  {run.environment?.browser && (
                                    <><span className="exec-meta-sep">·</span><span>🌐 {run.environment.browser}</span></>
                                  )}
                                </div>
                              </div>
                              <div className="exec-results">
                                <span className="exec-badge pass">{passed}</span>
                                <span className="exec-badge-label">Pass</span>
                                <span className="exec-badge skip">{pending}</span>
                                <span className="exec-badge-label">Skip</span>
                                <span className="exec-badge fail">{failed}</span>
                                <span className="exec-badge-label">Fail</span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Console */}
      <div className={`console ${consoleOpen ? 'open' : 'collapsed'}`}>
        <div className="console-header" onClick={() => setConsoleOpen(prev => !prev)} style={{ cursor: 'pointer' }}>
          <span><Terminal size={14} style={{ display: 'inline', verticalAlign: 'text-bottom' }} /> Console
            {!consoleOpen && logs.length > 0 && (
              <span className="console-log-count">{logs.length}</span>
            )}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {consoleOpen && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Log Viewer</span>}
            <span className="console-toggle-icon">{consoleOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
          </div>
        </div>
        {consoleOpen && (
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
        )}
      </div>

      {/* ========== Object Spy Modal ========== */}
      {showSpyModal && (
        <div className="modal-overlay" onClick={() => setShowSpyModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3><Crosshair size={18} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: 6 }} /> Object Spy</h3>
              <button className="modal-close" onClick={() => setShowSpyModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <p className="modal-desc">
                Object Spy sẽ mở trình duyệt Chrome và inject công cụ spy vào trang web.
                Di chuột qua các phần tử để preview, <strong>Ctrl+Click</strong> để capture phần tử vào Object Repository.
                Nhấn <strong>ESC</strong> trên trình duyệt để thoát.
              </p>
              <div className="input-group">
                <label>URL trang web cần Spy</label>
                <input
                  type="text"
                  className="input-field"
                  value={spyUrl}
                  onChange={e => setSpyUrl(e.target.value)}
                  placeholder="https://example.com"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="toolbar-btn" onClick={() => setShowSpyModal(false)}>Hủy</button>
              <button
                className="toolbar-btn run"
                onClick={handleStartSpy}
                disabled={isStartingSpy || !spyUrl}
              >
                <Crosshair size={16} /> {isStartingSpy ? 'Đang mở...' : 'Bắt đầu Spy'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== Create Suite Modal ========== */}
      {showCreateSuiteModal && (
        <div className="modal-overlay" onClick={() => setShowCreateSuiteModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3><Folder size={18} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: 6 }} /> Tạo Test Suite</h3>
              <button className="modal-close" onClick={() => setShowCreateSuiteModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <p className="modal-desc">
                Test Suite là bộ tổng hợp nhiều Test Case. Sau khi tạo, bạn có thể thêm script vào suite và chạy toàn bộ để xem tỷ lệ % thành công.
              </p>
              <div className="input-group">
                <label>Tên Suite</label>
                <input type="text" className="input-field" value={newSuiteName} onChange={e => setNewSuiteName(e.target.value)} placeholder="VD: Login Flow Tests" />
              </div>
              <div className="input-group">
                <label>Mô tả (tùy chọn)</label>
                <textarea className="input-field" value={newSuiteDesc} onChange={e => setNewSuiteDesc(e.target.value)} placeholder="Mô tả bộ test..." rows={3} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="toolbar-btn" onClick={() => setShowCreateSuiteModal(false)}>Hủy</button>
              <button className="toolbar-btn run" onClick={handleCreateSuite} disabled={!newSuiteName.trim()}>
                Tạo Suite
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
