import React, { useState } from 'react';
import { api } from '../services/api';

export default function OnboardingSection({ currentUser, setCurrentUser, setView }) {
  const [name, setName] = useState(currentUser?.name || '');
  const [company, setCompany] = useState(currentUser?.company || '');
  const [services, setServices] = useState(currentUser?.services || '');
  const [loading, setLoading] = useState(false);

  const isNewUser = !currentUser?.company;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const data = await api.updateProfile(currentUser.user_id, name, company, services);
      if (data.status === 'success') {
        const updatedUser = { ...currentUser, name, company, services };
        setCurrentUser(updatedUser);
        setView('input');
      } else {
        alert("Error saving profile: " + data.message);
      }
    } catch (err) {
      alert("Server error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="active fade-in">
      <div className="review-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2>{isNewUser ? "Welcome! Let's get started" : "Update Profile"}</h2>
          <p style={{ color: '#a1a1aa', fontSize: '0.9rem', marginTop: '0.5rem' }}>Please provide some details so our agents can better assist you.</p>
        </div>
        {!isNewUser && (
          <button type="button" className="back-home-btn btn-outline-small" onClick={() => setView('input')}>Back to Home</button>
        )}
      </div>

      <form className="premium-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Your Name</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} required />
        </div>
        <div className="form-group">
          <label>Company Name</label>
          <input type="text" value={company} onChange={e => setCompany(e.target.value)} required />
        </div>
        <div className="form-group">
          <label>Main Services</label>
          <textarea rows="3" placeholder="e.g. Web design, AI automation, SEO..." value={services} onChange={e => setServices(e.target.value)} required></textarea>
        </div>
        <button type="submit" className="btn-primary mt-2" disabled={loading}>
          <span>{loading ? "Saving..." : "Save Details"}</span>
          {loading && <div className="loader"></div>}
        </button>
      </form>
    </section>
  );
}
