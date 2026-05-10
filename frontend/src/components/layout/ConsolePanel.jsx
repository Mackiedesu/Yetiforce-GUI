import { ChevronDown, ChevronRight, Terminal } from 'lucide-react';

const ConsolePanel = ({ consoleOpen, setConsoleOpen, logs, consoleEndRef }) => {
  return (
    <div className={`console ${consoleOpen ? 'open' : 'collapsed'}`}>
      <div className="console-header" onClick={() => setConsoleOpen((prev) => !prev)} style={{ cursor: 'pointer' }}>
        <span>
          <Terminal size={14} style={{ display: 'inline', verticalAlign: 'text-bottom' }} /> Console
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
  );
};

export default ConsolePanel;
