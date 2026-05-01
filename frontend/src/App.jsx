import React, { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import AuthSection from './components/AuthSection';
import InputSection from './components/InputSection';
import OnboardingSection from './components/OnboardingSection';
import ApprovalSection from './components/ApprovalSection';
import HistorySection from './components/HistorySection';
import SuccessSection from './components/SuccessSection';
import IssuesModal from './components/IssuesModal';

function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('agentic_user');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [activeView, setActiveView] = useState(currentUser ? 'input' : 'auth');
  const [currentThreadId] = useState("thread_" + Math.random().toString(36).substr(2, 9));
  
  const [approvalData, setApprovalData] = useState({ issue: {}, email: {} });
  const [modalOpen, setModalOpen] = useState(false);
  const [modalText, setModalText] = useState("");
  const [gmailToken, setGmailToken] = useState(() => localStorage.getItem('gmail_token') || "");

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('agentic_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('agentic_user');
    }
  }, [currentUser]);

  // Keep Render free tier server warm — ping every 10 minutes to prevent cold starts
  useEffect(() => {
    const ping = () => fetch('/api/ping').catch(() => {});
    ping(); // Ping immediately on load
    const interval = setInterval(ping, 10 * 60 * 1000); // Every 10 minutes
    return () => clearInterval(interval);
  }, []);

  const handleLogin = (user) => {
    setCurrentUser(user);
    setActiveView('input');
  };

  const handleSetGmailToken = (token) => {
    setGmailToken(token);
    localStorage.setItem('gmail_token', token);
  };

  const handleLogout = () => {
    if (window.google?.accounts?.id) {
        window.google.accounts.id.disableAutoSelect();
    }
    setCurrentUser(null);
    setGmailToken("");
    localStorage.removeItem('gmail_token');
    setActiveView('auth');
  };

  const openModal = (text) => {
    setModalText(text);
    setModalOpen(true);
  };

  return (
    <>
      <div className="ambient-glow glow-1"></div>
      <div className="ambient-glow glow-2"></div>

      <div className="app-container">
        <header className="app-header">
          <div className="logo-wrapper">
            <Sparkles className="logo-icon" />
          </div>
          <h1>Agentic Outreach</h1>
          <p className="subtitle">AI-powered service-specific intelligence and cold outreach.</p>
        </header>

        <main id="main-content" className="glass-panel">
          {activeView === 'auth' && <AuthSection onLogin={handleLogin} onGmailToken={handleSetGmailToken} />}
          {activeView === 'input' && <InputSection currentUser={currentUser} onLogout={handleLogout} setView={setActiveView} threadId={currentThreadId} setApprovalData={setApprovalData} gmailToken={gmailToken} onGmailToken={handleSetGmailToken} />}
          {activeView === 'onboarding' && <OnboardingSection currentUser={currentUser} setCurrentUser={setCurrentUser} setView={setActiveView} />}
          {activeView === 'approval' && <ApprovalSection approvalData={approvalData} threadId={currentThreadId} setView={setActiveView} setApprovalData={setApprovalData} openModal={openModal} gmailToken={gmailToken} />}
          {activeView === 'success' && <SuccessSection setView={setActiveView} />}
          {activeView === 'history' && <HistorySection currentUser={currentUser} setView={setActiveView} openModal={openModal} />}
        </main>
      </div>

      {modalOpen && <IssuesModal text={modalText} onClose={() => setModalOpen(false)} />}
    </>
  );
}

export default App;
