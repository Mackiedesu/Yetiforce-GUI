import { Crosshair, LogOut, Play, Save, Settings, Square, User, Zap } from 'lucide-react';

const HeaderToolbar = ({
  spyActive,
  onStopSpy,
  onOpenSpy,
  onSave,
  onRunTest,
  isRunning,
  generatedScript,
  authUser,
  onLogout
}) => {
  return (
    <header className="app-header">
      <div className="app-header-left">
        <div className="logo">
          <Zap size={18} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} />
          QA Studio
        </div>
      </div>
      <div className="toolbar">
        {spyActive ? (
          <button className="toolbar-btn spy-active" onClick={onStopSpy}>
            <Crosshair size={16} className="pulse-icon" /> Dừng Spy
          </button>
        ) : (
          <button className="toolbar-btn" onClick={onOpenSpy}>
            <Crosshair size={16} /> Object Spy
          </button>
        )}
        <button className="toolbar-btn" onClick={onSave}>
          <Save size={16} /> Lưu
        </button>
        <button
          className="toolbar-btn run"
          onClick={onRunTest}
          disabled={isRunning || !generatedScript}
          style={{ opacity: isRunning || !generatedScript ? 0.5 : 1 }}
        >
          {isRunning ? <Square size={16} fill="white" /> : <Play size={16} fill="white" />}
          {isRunning ? 'Đang chạy...' : 'Chạy Test'}
        </button>
        <button className="toolbar-btn">
          <Settings size={16} /> Cài đặt
        </button>
        {authUser && (
          <>
            <div className="toolbar-user">
              <User size={14} />
              <span>{authUser}</span>
            </div>
            <button className="toolbar-btn toolbar-btn-logout" onClick={onLogout} title="Sign out">
              <LogOut size={16} />
            </button>
          </>
        )}
      </div>
    </header>
  );
};

export default HeaderToolbar;
