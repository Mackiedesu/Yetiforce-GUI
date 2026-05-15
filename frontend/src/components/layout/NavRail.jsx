import { Bot, ClipboardList, BookOpen, FolderOpen, LayoutDashboard, Zap } from 'lucide-react';

const NAV_ITEMS = [
  { id: 'home',       icon: FolderOpen,      label: 'Projects',    feature: '1' },
  { id: 'tests',      icon: BookOpen,        label: 'Test Suites', feature: '2' },
  { id: 'plans',      icon: ClipboardList,   label: 'Test Cases',  feature: '3' },
  { id: 'studio',     icon: Bot,             label: 'AI QA Studio',feature: '4' },
  { id: 'executions', icon: Zap,             label: 'Run Engine',  feature: '5' },
  { id: 'analytics',  icon: LayoutDashboard, label: 'Dashboard',   feature: '6' },
];

const NavRail = ({ activeNav, onNavigate, katalonRunning, liveRunning }) => {
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
          {id === 'executions' && katalonRunning && (
            <span className="nav-badge live">LIVE</span>
          )}
          {id === 'analytics' && liveRunning && (
            <span className="nav-badge live" style={{ background: 'var(--success-color)' }}>NEW</span>
          )}
        </button>
      ))}
    </nav>
  );
};

export default NavRail;
