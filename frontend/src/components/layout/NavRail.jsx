import { BarChart2, BookOpen, Bot, ClipboardList, Database, FolderOpen, LayoutDashboard, Settings, Sparkles, Zap } from 'lucide-react';

const NAV_ITEMS = [
  { id: 'home',       icon: FolderOpen,      label: 'Projects',    feature: '1' },
  { id: 'tests',      icon: BookOpen,        label: 'Test Suites', feature: '2' },
  { id: 'plans',      icon: ClipboardList,   label: 'Test Cases',  feature: '3' },
  { id: 'ai',         icon: Sparkles,        label: 'AI Generator',feature: '4' },
  { id: 'studio',     icon: Bot,             label: 'AI QA Studio',feature: '7' },
  { id: 'objects',    icon: Database,        label: 'Objects',     feature: null },
  { id: 'executions', icon: Zap,             label: 'Run Engine',  feature: '5' },
  { id: 'analytics',  icon: LayoutDashboard, label: 'Dashboard',   feature: '6' },
];

const NavRail = ({ activeNav, onNavigate, objectsCount, testRunning, liveRunning }) => {
  return (
    <nav className="nav-rail">
      {NAV_ITEMS.map(({ id, icon: Icon, label, feature }) => (
        <button
          key={id}
          className={`nav-rail-item ${activeNav === id ? 'active' : ''}`}
          onClick={() => onNavigate(id)}
          title={`${label}${feature ? ` (Feature ${feature})` : ''}`}
        >
          <Icon size={22} />
          <span style={{ fontSize: '0.54rem', textAlign: 'center', lineHeight: 1.2, paddingTop: 2 }}>
            {label}
          </span>
          {id === 'objects' && objectsCount > 0 && (
            <span className="nav-badge">{objectsCount}</span>
          )}
          {id === 'executions' && testRunning && (
            <span className="nav-badge live">LIVE</span>
          )}
          {id === 'analytics' && liveRunning && (
            <span className="nav-badge live" style={{ background: 'var(--success-color)' }}>NEW</span>
          )}
        </button>
      ))}

      <div style={{ flex: 1 }} />

      <button
        className={`nav-rail-item ${activeNav === 'settings' ? 'active' : ''}`}
        onClick={() => onNavigate('settings')}
        title="Project Settings"
      >
        <Settings size={22} />
        <span style={{ fontSize: '0.54rem', textAlign: 'center', lineHeight: 1.2, paddingTop: 2 }}>Settings</span>
      </button>
    </nav>
  );
};

export default NavRail;
