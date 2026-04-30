import React, { useState, useEffect } from 'react';
import { Clock, Save, Target, Maximize2, Mail } from 'lucide-react';
import { api } from '../services/api';

export default function HistorySection({ currentUser, setView, openModal }) {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingIds, setSavingIds] = useState({});

  useEffect(() => {
    async function loadHistory() {
      try {
        const data = await api.getHistory(currentUser.user_id);
        if (data.status === 'success') {
          setCampaigns(data.campaigns || []);
        }
      } catch (err) {
        console.error("Failed to load history", err);
      } finally {
        setLoading(false);
      }
    }
    loadHistory();
  }, [currentUser.user_id]);

  const handleSaveToGmail = async (subject, body, index) => {
    setSavingIds(prev => ({ ...prev, [index]: 'saving' }));
    
    try {
      const data = await api.saveDraftToGmail(subject, body);
      if (data.status === 'success') {
        setSavingIds(prev => ({ ...prev, [index]: 'saved' }));
        setTimeout(() => {
          setSavingIds(prev => {
            const next = { ...prev };
            delete next[index];
            return next;
          });
        }, 3000);
      } else {
        alert('Error saving draft: ' + data.message);
        setSavingIds(prev => {
          const next = { ...prev };
          delete next[index];
          return next;
        });
      }
    } catch (err) {
      alert('Failed to save draft to Gmail.');
      setSavingIds(prev => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
    }
  };

  return (
    <section className="active fade-in">
      <div className="user-profile-bar" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#a1a1aa', fontSize: '0.9rem' }}>
          <Clock size={16} />
          <span>Saved Campaigns</span>
        </div>
        <button type="button" className="back-home-btn btn-outline-small" onClick={() => setView('input')}>Back to Home</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '45vh', overflowY: 'auto', paddingRight: '0.5rem' }}>
        {loading ? (
          <p style={{ textAlign: 'center', color: '#a1a1aa', padding: '2rem' }}>Loading history...</p>
        ) : campaigns.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#a1a1aa', padding: '2rem' }}>No saved campaigns found.</p>
        ) : (
          campaigns.map((camp, i) => {
            const issueStr = camp.ux_issue || 'No specific issue described.';
            const count = issueStr.split('\n\n').filter(Boolean).length;

            return (
              <div key={i} className="review-block">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <div style={{ fontWeight: 600, color: '#fff', wordBreak: 'break-all', paddingRight: '1rem' }}>{camp.target_url}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '0.1rem 0.4rem', borderRadius: 4, whiteSpace: 'nowrap' }}>{camp.status}</span>
                    <button type="button" className="btn-outline-small" onClick={() => handleSaveToGmail(camp.email_subject, camp.email_body, i)} title="Save to Gmail Drafts" disabled={savingIds[i] === 'saving'}>
                      {savingIds[i] === 'saving' ? (
                        <><div className="spinner" style={{ width: 12, height: 12, borderWidth: 2, margin: 0 }}></div> Saving...</>
                      ) : savingIds[i] === 'saved' ? (
                        <>Saved!</>
                      ) : (
                        <><Save size={14} /> Save</>
                      )}
                    </button>
                  </div>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '0.5rem 0.75rem', borderRadius: 6, marginBottom: '1rem', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.85rem', color: '#10b981', fontWeight: 500, display: 'flex', alignItems: 'center' }}>
                    <Target size={14} style={{ marginRight: '0.4rem' }} />
                    Found {count} opportunities or problems
                  </div>
                  <button type="button" className="btn-outline-small" style={{ padding: '0.2rem 0.4rem' }} title="View all issues" onClick={() => openModal(issueStr)}>
                    <Maximize2 size={12} style={{ margin: 0 }} />
                  </button>
                </div>

                <div className="block-title" style={{ marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                  <Mail size={16} /> Draft Email
                </div>
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: 6, fontSize: '0.85rem', color: '#d4d4d8', whiteSpace: 'pre-wrap' }}>
                  <strong>Subject:</strong> {camp.email_subject}
                  <br /><br />
                  {camp.email_body}
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
