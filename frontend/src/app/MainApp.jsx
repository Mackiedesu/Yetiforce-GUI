import { useCallback, useEffect, useRef, useState } from 'react';

import { WS_URL } from '../config/endpoints';
import HeaderToolbar from '../components/layout/HeaderToolbar';
import NavRail from '../components/layout/NavRail';
import ConsolePanel from '../components/layout/ConsolePanel';
import ExecutionsTab from '../features/executions/ExecutionsTab';
import ExecutionDashboard from '../features/executions/ExecutionDashboard';
import AIAgentStudio from '../features/ai-studio/AIAgentStudio';
import ProjectsPage from '../features/projects/ProjectsPage';
import SuitesPage from '../features/suites/SuitesPage';
import TestCasesPage from '../features/test-cases/TestCasesPage';

const MainApp = ({ authUser, onLogout }) => {
  const [activeTab, setActiveTab]   = useState('projects');
  const [activeNav, setActiveNav]   = useState('home');
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [logs, setLogs]             = useState([]);

  const [katalonWsEvent, setKatalonWsEvent]     = useState(null);
  const [katalonRunning, setKatalonRunning]      = useState(false);
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);
  const [execPreselect, setExecPreselect]       = useState(null);

  const consoleEndRef = useRef(null);
  const wsRef         = useRef(null);

  const addLog = useCallback((msg, type = 'info') => {
    setLogs((prev) => [...prev, { text: msg, type, time: new Date().toLocaleTimeString() }]);
  }, []);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen  = () => console.log('[WS] Connected');
    ws.onclose = () => console.log('[WS] Disconnected');

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      switch (data.type) {
        case 'katalon_start':
          setKatalonRunning(true);
          setKatalonWsEvent({ ...data, _ts: Date.now() });
          break;
        case 'katalon_log':
          setKatalonWsEvent({ ...data, _ts: Date.now() });
          break;
        case 'katalon_complete':
          setKatalonRunning(false);
          setKatalonWsEvent({ ...data, _ts: Date.now() });
          setDashboardRefreshKey((k) => k + 1);
          break;
        default:
          break;
      }
    };

    return () => ws.close();
  }, []);

  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleNavigate = (nextNav) => {
    setActiveNav(nextNav);
    switch (nextNav) {
      case 'home':
        setActiveTab('projects');
        break;
      case 'plans':
        setActiveTab('testCases');
        break;
      case 'tests':
        setActiveTab('suites');
        break;
      case 'executions':
        setActiveTab('report');
        break;
      case 'studio':
        setActiveTab('aiStudio');
        break;
      case 'analytics':
        setActiveTab('dashboard');
        setDashboardRefreshKey((k) => k + 1);
        break;
      default:
        break;
    }
  };

  // Derived: show NEW badge on analytics when a Katalon run just finished
  const showNewOnDashboard = katalonWsEvent?.type === 'katalon_complete' && activeTab !== 'dashboard';

  return (
    <div id="root">
      <HeaderToolbar
        authUser={authUser}
        onLogout={onLogout}
      />

      <div className="main-container">
        <NavRail
          activeNav={activeNav}
          onNavigate={handleNavigate}
          katalonRunning={katalonRunning}
          liveRunning={showNewOnDashboard}
        />

        <div className="workspace">
          <div className="editor-content">
            {activeTab === 'projects' && (
              <ProjectsPage addLog={addLog} />
            )}

            {activeTab === 'suites' && (
              <SuitesPage addLog={addLog} />
            )}

            {activeTab === 'testCases' && (
              <TestCasesPage addLog={addLog} />
            )}

            <div style={activeTab !== 'aiStudio' ? { display: 'none' } : undefined}>
              <AIAgentStudio
                onNavigateToTestCases={() => handleNavigate('plans')}
              />
            </div>

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
          </div>
        </div>
      </div>

      <ConsolePanel
        consoleOpen={consoleOpen}
        setConsoleOpen={setConsoleOpen}
        logs={logs}
        consoleEndRef={consoleEndRef}
      />
    </div>
  );
};

export default MainApp;
