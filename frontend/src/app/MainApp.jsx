import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';

import { BACKEND_URL, WS_URL } from '../config/endpoints';
import HeaderToolbar from '../components/layout/HeaderToolbar';
import NavRail from '../components/layout/NavRail';
import ExplorerPanel from '../components/layout/ExplorerPanel';
import ConsolePanel from '../components/layout/ConsolePanel';
import ManualTab from '../features/manual/ManualTab';
import ScriptTab from '../features/script/ScriptTab';
import ObjectRepositoryTab from '../features/objects/ObjectRepositoryTab';
import ExecutionsTab from '../features/executions/ExecutionsTab';
import ExecutionDashboard from '../features/executions/ExecutionDashboard';
import AIAgentStudio from '../features/ai-studio/AIAgentStudio';
import ProjectsPage from '../features/projects/ProjectsPage';
import SuitesPage from '../features/suites/SuitesPage';
import TestCasesPage from '../features/test-cases/TestCasesPage';
import ObjectSpyModal from '../components/modals/ObjectSpyModal';
import AIGeneratorTab from '../features/ai-generator/AIGeneratorTab';
// WebsiteScanner removed — functionality merged into AIAgentStudio

const MainApp = ({ authUser, onLogout }) => {
  const [activeTab, setActiveTab] = useState('manual');
  const [url, setUrl] = useState('https://example.com');
  const [testDescription, setTestDescription] = useState('');

  const [htmlContext, setHtmlContext] = useState('');
  const [generatedScript, setGeneratedScript] = useState('');

  const [logs, setLogs] = useState([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  const [objects, setObjects] = useState([]);
  const [selectedObject, setSelectedObject] = useState(null);
  const [selectedObjectDetail, setSelectedObjectDetail] = useState(null);

  const [spyActive, setSpyActive] = useState(false);
  const [spyUrl, setSpyUrl] = useState('');
  const [showSpyModal, setShowSpyModal] = useState(false);
  const [isStartingSpy, setIsStartingSpy] = useState(false);

  const [openFolders, setOpenFolders] = useState({ objectRepo: false });
  const [activeNav, setActiveNav] = useState('tests');
  const [explorerOpen, setExplorerOpen] = useState(true);
  const [consoleOpen, setConsoleOpen] = useState(true);
  const [execDetailTab, setExecDetailTab] = useState('overview');

  const [healingReport, setHealingReport] = useState(null);

  const [, setRealtimeStats] = useState({ passed: 0, failed: 0, running: 0, total: 0 });
  const [, setRealtimeSteps] = useState([]);
  const [, setRealtimeEnv] = useState(null);
  const [reportHistory, setReportHistory] = useState([]);
  const [selectedTestCase, setSelectedTestCase] = useState(null);
  const [testRunning, setTestRunning] = useState(false);
  const [runStartTime, setRunStartTime] = useState(null);
  const [runElapsed, setRunElapsed] = useState(0);

  const [isEditingObject, setIsEditingObject] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const [aiGeneratorResult, setAiGeneratorResult] = useState(null);
  const [aiGeneratorError, setAiGeneratorError] = useState(null);
  const [isGeneratingKatalon, setIsGeneratingKatalon] = useState(false);

  const [katalonWsEvent, setKatalonWsEvent] = useState(null);
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);
  const [execPreselect, setExecPreselect] = useState(null);

  const consoleEndRef = useRef(null);
  const wsRef = useRef(null);

  const addLog = useCallback((msg, type = 'info') => {
    setLogs((prev) => [...prev, { text: msg, type, time: new Date().toLocaleTimeString() }]);
  }, []);

  const fetchObjects = useCallback(async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/objects`);
      if (response.data.success) {
        setObjects(response.data.objects);
      }
    } catch {
      // Silently fail on initial load
    }
  }, []);

  const fetchReportHistory = useCallback(async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/reports`);
      if (response.data.success) {
        setReportHistory(response.data.reports);
      }
    } catch {
      // Silently fail
    }
  }, []);

  const handleTestProgress = useCallback((data) => {
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
        setRealtimeStats((prev) => ({ ...prev, running: prev.running + 1 }));
        break;
      case 'test_case_pass':
        addLog(`✅ PASSED: ${data.title} (${((data.duration || 0) / 1000).toFixed(1)}s)`, 'success');
        setRealtimeStats((prev) => ({ ...prev, passed: prev.passed + 1, running: Math.max(0, prev.running - 1), total: prev.total + 1 }));
        setRealtimeSteps((prev) => [...prev, { action: data.title, status: 'passed', duration: data.duration || 0 }]);
        break;
      case 'test_case_fail':
        addLog(`❌ FAILED: ${data.title} — ${data.error || ''}`, 'error');
        setRealtimeStats((prev) => ({ ...prev, failed: prev.failed + 1, running: Math.max(0, prev.running - 1), total: prev.total + 1 }));
        setRealtimeSteps((prev) => [...prev, { action: data.title, status: 'failed', duration: data.duration || 0, error: data.error }]);
        break;
      case 'step':
        setRealtimeSteps((prev) => [...prev, data.step]);
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
  }, [addLog]);

  const handleTestComplete = useCallback((data) => {
    if (data.report) {
      setRealtimeStats({
        passed: data.report.summary.passed,
        failed: data.report.summary.failed,
        running: 0,
        total: data.report.summary.total
      });
    }
  }, []);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
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
        case 'katalon_start':
        case 'katalon_log':
          setKatalonWsEvent({ ...data, _ts: Date.now() });
          break;
        case 'katalon_complete':
          setKatalonWsEvent({ ...data, _ts: Date.now() });
          setDashboardRefreshKey((k) => k + 1);
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
  }, [addLog, fetchObjects, handleTestComplete, handleTestProgress]);

  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchObjects();
      fetchReportHistory();
    }, 0);

    return () => clearTimeout(timer);
  }, [fetchObjects, fetchReportHistory]);

  useEffect(() => {
    let interval;
    if (testRunning && runStartTime) {
      interval = setInterval(() => {
        setRunElapsed(Math.floor((Date.now() - runStartTime) / 1000));
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [testRunning, runStartTime]);

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

  const handleSidebarClick = (itemName) => {
    if (itemName === 'Object Repository') {
      setOpenFolders((prev) => ({ ...prev, objectRepo: !prev.objectRepo }));
      setActiveTab('objectRepo');
      fetchObjects();
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

  const handleExtractPage = async () => {
    if (!url) {
      addLog('Vui lòng nhập URL trang web', 'error');
      return;
    }

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
    if (!htmlContext) {
      addLog('Chưa có thông tin HTML của trang web. Vui lòng bấm [Phân tích trang] trước.', 'error');
      return;
    }
    if (!testDescription) {
      addLog('Vui lòng nhập mô tả kịch bản test bằng tiếng Việt.', 'error');
      return;
    }

    setIsGenerating(true);
    addLog('Đang gửi yêu cầu đến Gemini AI...');

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
    if (!generatedScript) {
      addLog('Chưa có Test Script nào để chạy. Vui lòng tạo script trước!', 'error');
      return;
    }

    setIsRunning(true);
    setTestRunning(true);
    setRunStartTime(() => new Date().getTime());
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

      if (result.stdout) {
        addLog(result.stdout, result.success ? 'info' : 'error');
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

  const handleStartSpy = async () => {
    if (!spyUrl) {
      addLog('Vui lòng nhập URL để Spy.', 'error');
      return;
    }

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
          addLog('⚕️ Self-Healing: ' + response.data.report.totalHealed + ' phần tử đã được tự chữa lành. Xem chi tiết tại tab Object Repository.', 'info');
        }
      }
    } catch {
      // Silently fail
    }
  };

  const handleGenerateKatalonTest = async (requirement) => {
    setIsGeneratingKatalon(true);
    setAiGeneratorError(null);
    addLog('🤖 Đang gửi yêu cầu đến AI để tạo Katalon test...');

    try {
      const response = await axios.post(`${BACKEND_URL}/api/generate-katalon-test`, { requirement });
      if (response.data.success) {
        setAiGeneratorResult({
          testSteps: response.data.testSteps,
          expectedResults: response.data.expectedResults,
          testData: response.data.testData,
          katalonScript: response.data.katalonScript,
        });
        addLog(`✅ AI đã tạo xong: ${response.data.testSteps?.length || 0} bước test, ${(response.data.katalonScript || '').split('\n').length} dòng Katalon script.`, 'success');
      }
    } catch (error) {
      const msg = error.response?.data?.error || error.message;
      setAiGeneratorError(msg);
      addLog(`❌ Lỗi khi tạo Katalon test: ${msg}`, 'error');
    } finally {
      setIsGeneratingKatalon(false);
    }
  };

  const locatorTypeLabel = (type) => {
    const map = { id: 'ID', name: 'Name', className: 'Class', css: 'CSS', xpath: 'XPath', 'data-testid': 'TestID', linkText: 'LinkText' };
    return map[type] || type;
  };

  const locatorTypeBadgeClass = (type) => {
    const map = { id: 'badge-green', name: 'badge-blue', className: 'badge-purple', css: 'badge-orange', xpath: 'badge-yellow', 'data-testid': 'badge-cyan' };
    return map[type] || 'badge-default';
  };

  const handleNavigate = (nextNav) => {
    setActiveNav(nextNav);

    switch (nextNav) {
      case 'ai':
        setActiveTab('aiGenerator');
        setExplorerOpen(false);
        break;
      case 'home':
        setActiveTab('projects');
        setExplorerOpen(false);
        break;
      case 'plans':
        setActiveTab('testCases');
        setExplorerOpen(false);
        break;
      case 'tests':
        setActiveTab('suites');
        setExplorerOpen(false);
        break;
      case 'objects':
        setActiveTab('objectRepo');
        fetchObjects();
        setExplorerOpen(true);
        break;
      case 'executions':
        setActiveTab('report');
        setExplorerOpen(false);
        break;
      case 'studio':
        setActiveTab('aiStudio');
        setExplorerOpen(false);
        break;
      case 'analytics':
        setActiveTab('dashboard');
        setDashboardRefreshKey((k) => k + 1);
        setExplorerOpen(false);
        break;
      case 'scanner':
        // Deprecated — redirect to AI QA Studio
        setActiveTab('aiStudio');
        setExplorerOpen(false);
        break;
      default:
        setExplorerOpen(false);
        break;
    }
  };

  const openSpyModal = () => {
    setSpyUrl(url);
    setShowSpyModal(true);
  };

  return (
    <div id="root">
      <HeaderToolbar
        spyActive={spyActive}
        onStopSpy={handleStopSpy}
        onOpenSpy={openSpyModal}
        onSave={() => addLog('Đã lưu kịch bản tạm thời.')}
        onRunTest={handleRunTest}
        isRunning={isRunning}
        generatedScript={generatedScript}
        authUser={authUser}
        onLogout={onLogout}
      />

      <div className="main-container">
        <NavRail
          activeNav={activeNav}
          onNavigate={handleNavigate}
          objectsCount={objects.length}
          testRunning={testRunning}
          liveRunning={katalonWsEvent?.type === 'katalon_complete' && activeTab !== 'dashboard'}
        />

        <ExplorerPanel
          explorerOpen={explorerOpen}
          setExplorerOpen={setExplorerOpen}
          activeNav={activeNav}
          openFolders={openFolders}
          handleSidebarClick={handleSidebarClick}
          objects={objects}
          selectedObject={selectedObject}
        />

        <div className="workspace">
          <div className="editor-content">
            {activeTab === 'aiStudio' && (
              <AIAgentStudio
                onNavigateToTestCases={() => handleNavigate('plans')}
              />
            )}

            {activeTab === 'aiGenerator' && (
              <AIGeneratorTab
                onGenerate={handleGenerateKatalonTest}
                isGenerating={isGeneratingKatalon}
                result={aiGeneratorResult}
                error={aiGeneratorError}
              />
            )}

            {activeTab === 'manual' && (
              <ManualTab
                url={url}
                setUrl={setUrl}
                isExtracting={isExtracting}
                htmlContext={htmlContext}
                handleExtractPage={handleExtractPage}
                testDescription={testDescription}
                setTestDescription={setTestDescription}
                isGenerating={isGenerating}
                handleGenerateScript={handleGenerateScript}
              />
            )}

            {activeTab === 'script' && (
              <ScriptTab generatedScript={generatedScript} setGeneratedScript={setGeneratedScript} />
            )}

            {activeTab === 'objectRepo' && (
              <ObjectRepositoryTab
                objects={objects}
                selectedObject={selectedObject}
                setSelectedObject={setSelectedObject}
                setIsEditingObject={setIsEditingObject}
                selectedObjectDetail={selectedObjectDetail}
                fetchObjectDetail={fetchObjectDetail}
                isEditingObject={isEditingObject}
                editName={editName}
                setEditName={setEditName}
                editDescription={editDescription}
                setEditDescription={setEditDescription}
                handleStartEdit={handleStartEdit}
                handleSaveEdit={handleSaveEdit}
                handleCancelEdit={handleCancelEdit}
                handleDeleteObject={handleDeleteObject}
                fetchObjects={fetchObjects}
                spyActive={spyActive}
                handleStopSpy={handleStopSpy}
                openSpyModal={openSpyModal}
                healingReport={healingReport}
                locatorTypeLabel={locatorTypeLabel}
                locatorTypeBadgeClass={locatorTypeBadgeClass}
              />
            )}

            {activeTab === 'dashboard' && (
              <ExecutionDashboard
                refreshTrigger={dashboardRefreshKey}
                onSelectRun={(run) => {
                  setExecPreselect(run.id);
                  handleNavigate('executions');
                }}
              />
            )}

            {activeTab === 'report' && (
              <ExecutionsTab
                katalonWsEvent={katalonWsEvent}
                initialRunId={execPreselect}
                onInitialRunConsumed={() => setExecPreselect(null)}
                onOpenDashboard={() => handleNavigate('analytics')}
              />
            )}

            {activeTab === 'projects' && (
              <ProjectsPage addLog={addLog} />
            )}

            {activeTab === 'suites' && (
              <SuitesPage addLog={addLog} />
            )}

            {activeTab === 'testCases' && (
              <TestCasesPage addLog={addLog} />
            )}

            {/* scanner tab removed — merged into AI QA Studio */}
          </div>
        </div>
      </div>

      <ConsolePanel
        consoleOpen={consoleOpen}
        setConsoleOpen={setConsoleOpen}
        logs={logs}
        consoleEndRef={consoleEndRef}
      />

      <ObjectSpyModal
        show={showSpyModal}
        onClose={() => setShowSpyModal(false)}
        spyUrl={spyUrl}
        setSpyUrl={setSpyUrl}
        handleStartSpy={handleStartSpy}
        isStartingSpy={isStartingSpy}
      />
    </div>
  );
};

export default MainApp;
