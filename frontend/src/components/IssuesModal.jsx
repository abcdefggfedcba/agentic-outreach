import React from 'react';
import { Target, X } from 'lucide-react';

export default function IssuesModal({ text, onClose }) {
  const handleBackdropClick = (e) => {
    if (e.target.className === 'modal-overlay') {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={handleBackdropClick}>
      <div style={{
          width: '90%',
          maxWidth: 580,
          maxHeight: '80vh',
          background: 'var(--panel-bg)',
          border: '1px solid var(--border-color)',
          borderRadius: 16,
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
          backdropFilter: 'blur(20px)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '1rem', fontWeight: 600, color: '#fff' }}>
            <Target size={18} color="#ffffff" />
            Identified Opportunities
          </div>
          <button type="button" onClick={onClose} style={{ width: 'auto', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, color: '#a1a1aa', cursor: 'pointer', padding: '0.3rem 0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} />
          </button>
        </div>
        
        <div style={{ overflowY: 'auto', flex: 1, paddingRight: '0.25rem' }}>
          <p style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: '0.9rem', color: '#d4d4d8', lineHeight: 1.7 }}>
            {text}
          </p>
        </div>
      </div>
    </div>
  );
}
