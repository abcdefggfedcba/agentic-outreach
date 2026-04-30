import React, { useState } from 'react';
import { User, Clock, Settings } from 'lucide-react';
import { api } from '../services/api';

export default function InputSection({ currentUser, onLogout, setView, threadId, setApprovalData }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("Run Intelligence Agent");
  
  const isProfileComplete = currentUser && currentUser.company && currentUser.services;

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
        currentUser.services || ""
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
