import React from 'react';
import { Check, Plus } from 'lucide-react';

export default function SuccessSection({ setView }) {
  return (
    <section className="active fade-in text-center">
      <div className="success-animation">
        <div className="icon-circle">
          <Check size={32} />
        </div>
      </div>
      <h2 style={{ marginBottom: '0.5rem', fontWeight: 600 }}>Campaign Launched</h2>
      <p style={{ color: '#a1a1aa', fontSize: '0.95rem', marginBottom: '2rem' }}>
        The outreach draft has been successfully stored in your Gmail and database.
      </p>
      <button className="btn-secondary w-full" onClick={() => setView('input')}>
        <Plus size={16} /> Start New Campaign
      </button>
    </section>
  );
}
