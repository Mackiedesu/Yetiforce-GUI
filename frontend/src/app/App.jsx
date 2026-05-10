import { useState } from 'react';
import LoginPage from '../features/auth/LoginPage';
import MainApp from './MainApp';

const App = () => {
  const [authUser, setAuthUser] = useState(() => localStorage.getItem('auth_user'));

  const handleLogin = (username) => setAuthUser(username);

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    setAuthUser(null);
  };

  if (!authUser) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return <MainApp authUser={authUser} onLogout={handleLogout} />;
};

export default App;
