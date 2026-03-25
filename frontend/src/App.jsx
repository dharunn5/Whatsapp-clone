import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Login from './components/Login';
import ChatInterface from './components/ChatInterface';

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('chatUser');
    if (savedUser) {
      try { setCurrentUser(JSON.parse(savedUser)); } catch { localStorage.removeItem('chatUser'); }
    }
    setLoading(false);
  }, []);

  const handleLogin = (user) => {
    localStorage.setItem('chatUser', JSON.stringify(user));
    setCurrentUser(user);
  };

  const handleLogout = () => {
    localStorage.removeItem('chatUser');
    setCurrentUser(null);
  };

  if (loading) return null;

  return (
    <Router>
      <Routes>
        <Route
          path="/login"
          element={!currentUser ? <Login onLogin={handleLogin} /> : <Navigate to="/" />}
        />
        <Route
          path="/"
          element={
            currentUser ? (
              <div className="w-full h-screen flex flex-col md:flex-row md:items-center md:justify-center md:bg-[#111b21]">
                <div className="w-full h-full md:h-[95vh] md:max-w-[1400px] md:rounded-xl overflow-hidden md:shadow-2xl flex flex-row">
                  <ChatInterface currentUser={currentUser} onLogout={handleLogout} />
                </div>
              </div>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
