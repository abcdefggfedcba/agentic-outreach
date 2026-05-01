import React, { useState } from 'react';
import { User, Clock, Settings, Mail, CheckCircle } from 'lucide-react';
import { api } from '../services/api';

const GOOGLE_CLIENT_ID = "842703581435-jn55ranuqnu5r872qqq57va435bi91tm.apps.googleusercontent.com";

export default function InputSection({ currentUser, onLogout, setView, threadId, setApprovalData, gmailToken, onGmailToken }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("Run Intelligence Agent");
  const [gmailConnecting, setGmailConnecting] = useState(false);

  const isProfileComplete = currentUser && currentUser.company && currentUser.services;
  const isGmailConnected = !!gmailToken;

  const handleConnectGmail = () => {
    if (!window.google?.accounts?.oauth2) {
      alert("Google script not loaded. Please refresh the page.");
      return;
    }
    setGmailConnecting(true);
    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/gmail.compose',
      callback: (tokenResponse) => {
        setGmailConnecting(false);
        if (tokenResponse?.access_token) {
          onGmailToken(tokenResponse.access_token);
        } else {
          alert("Gmail permission was denied. Draft saving will not work.");
        }
      },
      error_callback: (err) => {
        setGmailConnecting(false);
        alert("Gmail connection failed: " + (err?.message || "Unknown error"));
      }
    });
    // Use 'consent' to always show the permission screen properly
    tokenClient.requestAccessToken({ prompt: 'consent' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isProfileComplete) return;

    setLoading(true);
    setLoadingText("Agent Analyzing URL...");

    const agentPhases = [
      "Agent Analyzing URL...",
      "Identifying Opportunities...",
      "Drafting Cold Email...",
      "Finding Contact Leads...",
      "Finalizing Report..."
    ];
    
    let phaseIndex = 0;
    const progressInterval = setInterval(() => {
      phaseIndex++;
      if (phaseIndex < agentPhases.length) {
        setLoadingText(agentPhases[phaseIndex]);
      }
    }, 6000);

    try {
      const data = await api.startPipeline(
        url,
        currentUser.services || "UX Design and Optimization",
        threadId,
        currentUser.user_id,
        currentUser.name,
        currentUser.company || "",
        currentUser.services || "",
        gmailToken || ""
      );

      clearInterval(progressInterval);
      
      if (data.status === 'pending_approval') {
        setApprovalData({ issue: data.issue, email: data.email });
        setView('approval');
      } else {
        alert("Unexpected response: " + data.status);
      }
    } catch (err) {
      clearInterval(progressInterval);
      alert("Error running pipeline. Check terminal logs.");
    } finally {
      setLoading(false);
      setLoadingText("Run Intelligence Agent");
    }
  };

  return (
    <section className="active fade-in">
      <div className="user-profile-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#a1a1aa', fontSize: '0.9rem' }}>
          {currentUser.picture ? (
            <img src={currentUser.picture} alt="Profile" style={{ width: 24, height: 24, borderRadius: '50%' }} />
          ) : (
            <User size={16} />
          )}
          <span>{currentUser.name}</span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="button" className="btn-outline-small" onClick={onLogout}>Logout</button>
          <button type="button" className="btn-outline-small" style={{ padding: '0.25rem 0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="History" onClick={() => setView('history')}>
            <Clock size={16} />
          </button>
          <button type="button" className="btn-outline-small" style={{ padding: '0.25rem 0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Settings" onClick={() => setView('onboarding')}>
            <Settings size={16} />
          </button>
        </div>
      </div>

      {/* Gmail Connection Banner */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: isGmailConnected ? 'rgba(16, 185, 129, 0.08)' : 'rgba(251, 191, 36, 0.08)',
        border: `1px solid ${isGmailConnected ? 'rgba(16, 185, 129, 0.3)' : 'rgba(251, 191, 36, 0.3)'}`,
        borderRadius: 8, padding: '0.6rem 0.9rem', marginBottom: '1.2rem',
        gap: '0.75rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem' }}>
          {isGmailConnected
            ? <><CheckCircle size={14} color="#10b981" /><span style={{ color: '#10b981', fontWeight: 500 }}>Gmail Connected — drafts will save automatically</span></>
            : <><Mail size={14} color="#fbbf24" /><span style={{ color: '#fbbf24', fontWeight: 500 }}>Connect Gmail to save email drafts automatically</span></>
          }
        </div>
        {!isGmailConnected && (
          <button
            type="button"
            className="btn-outline-small"
            onClick={handleConnectGmail}
            disabled={gmailConnecting}
            style={{ whiteSpace: 'nowrap', fontSize: '0.78rem' }}
          >
            {gmailConnecting ? 'Connecting...' : 'Connect Gmail'}
          </button>
        )}
      </div>

      <form className="premium-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Target URL</label>
          <input 
            type="url" 
            placeholder={isProfileComplete ? "https://example.com" : "Please update your profile settings first."} 
            value={url} 
            onChange={e => setUrl(e.target.value)} 
            required 
            disabled={!isProfileComplete}
          />
        </div>

        <button type="submit" className="btn-primary mt-2" disabled={!isProfileComplete || loading}>
          <span>{loadingText}</span>
          {loading && <div className="loader"></div>}
        </button>
      </form>
    </section>
  );
}
