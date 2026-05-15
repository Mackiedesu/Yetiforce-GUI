import { LogOut, User, Zap } from 'lucide-react';

const HeaderToolbar = ({ authUser, onLogout }) => {
  return (
    <header className="app-header">
      <div className="app-header-left">
        <div className="logo">
          <Zap size={18} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} />
          QA Studio
        </div>
      </div>
      <div className="toolbar">
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
