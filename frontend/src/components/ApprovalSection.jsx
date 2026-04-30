import React, { useState } from 'react';
import { Target, Maximize2, Mail, Send, Bookmark, Edit, AlertCircle } from 'lucide-react';
import { api } from '../services/api';

export default function ApprovalSection({ approvalData, threadId, setView, setApprovalData, openModal }) {
  const [loading, setLoading] = useState(false);
  const [editedEmail, setEditedEmail] = useState(approvalData.email?.email_body || "");
  const [subjectLine, setSubjectLine] = useState(approvalData.email?.subject_line || "");

  const problemText = approvalData.issue?.problem || "No specific issue described.";
  const issuesList = problemText.split('\n\n').filter(Boolean);
  const count = issuesList.length;

  const handleAction = async (actionType) => {
    setLoading(true);
    
    try {
      const data = await api.handleAction(threadId, actionType, actionType === 'edit' ? editedEmail : "");
      
      if (data.status === 'completed') {
        setView('success');
      } else if (data.status === 'pending_approval') {
        // Update approval data with new issue/email from regeneration
        setApprovalData({ issue: data.issue, email: data.email });
        setEditedEmail(data.email?.email_body || "");
        setSubjectLine(data.email?.subject_line || "");
      }
    } catch (err) {
      alert("Error executing action.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="active fade-in">
      <div className="review-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Review Outreach</h2>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span className="badge badge-warning">Pending Approval</span>
          <button type="button" className="back-home-btn btn-outline-small" onClick={() => setView('input')}>Back to Home</button>
        </div>
      </div>

      <div className="review-block">
        <div className="block-title" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Target size={16} /> Identified Opportunity</div>
          <button type="button" className="btn-outline-small" style={{ padding: '0.25rem 0.5rem' }} title="View all issues" onClick={() => openModal(problemText)}>
            <Maximize2 size={14} style={{ margin: 0 }} />
          </button>
        </div>
        <p className="text-content" style={{ textAlign: 'center', fontWeight: 500, fontSize: '1rem', color: '#10b981', padding: '1.5rem' }}>
          Found {count} opportunities or problems
        </p>
      </div>

      <div className="review-block">
        <div className="block-title">
          <Mail size={16} /> Draft Email
        </div>
        <input type="text" className="premium-input seamless-top" value={subjectLine} readOnly />
        <textarea rows="7" className="premium-input seamless-bottom" value={editedEmail} onChange={e => setEditedEmail(e.target.value)}></textarea>
      </div>

      <div className="action-buttons">
        <button className="btn-primary success" onClick={() => handleAction('approve')} disabled={loading}><Send size={16} /> Send & Save</button>
        <button className="btn-secondary" onClick={() => handleAction('save_history_only')} disabled={loading}><Bookmark size={16} /> Save to History</button>
        <button className="btn-secondary" onClick={() => handleAction('edit')} disabled={loading}><Edit size={16} /> Edit Draft</button>
        <button className="btn-secondary danger" onClick={() => handleAction('new_ux_issue')} disabled={loading}><AlertCircle size={16} /> New Issue</button>
      </div>

      {loading && (
        <div className="loader-overlay">
          <div className="spinner"></div>
          <span style={{ color: '#a1a1aa', fontSize: '0.85rem', fontWeight: 500 }}>Processing action...</span>
        </div>
      )}
    </section>
  );
}
