import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';

export default function AuthSection({ onLogin }) {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const googleBtnRef = useRef(null);

  useEffect(() => {
    const initGoogle = () => {
      if (window.google && googleBtnRef.current) {
        window.google.accounts.id.initialize({
          client_id: "842703581435-jn55ranuqnu5r872qqq57va435bi91tm.apps.googleusercontent.com",
          callback: handleGoogleLogin,
          context: "signin",
          auto_prompt: false
        });
        window.google.accounts.id.renderButton(
          googleBtnRef.current,
          { type: "standard", shape: "rectangular", theme: "outline", text: "continue_with", size: "large", width: 280 }
        );
      }
    };

    if (window.google) {
      initGoogle();
    } else {
      // If script is not yet loaded, wait for it
      const interval = setInterval(() => {
        if (window.google) {
          clearInterval(interval);
          initGoogle();
        }
      }, 100);
      // Clean up interval on unmount
      return () => clearInterval(interval);
    }
  }, []);

  const handleGoogleLogin = async (response) => {
    setError('');
    setLoading(true);
    try {
      const data = await api.googleLogin(response.credential);
      if (data.status === 'success') {
        onLogin({ user_id: data.user_id, name: data.name, picture: data.picture, company: data.company, services: data.services });
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError("Google Sign-In failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let data;
      if (isLoginMode) {
        data = await api.login(email, password);
      } else {
        data = await api.signup(name, email, password);
      }

      if (data.status === 'success') {
        onLogin({ user_id: data.user_id, name: data.name, email, company: data.company, services: data.services });
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError("Server error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="active fade-in">
      <div className="auth-toggle">
        <button type="button" className={`toggle-btn ${isLoginMode ? 'active' : ''}`} onClick={() => { setIsLoginMode(true); setError(''); }}>Log In</button>
        <button type="button" className={`toggle-btn ${!isLoginMode ? 'active' : ''}`} onClick={() => { setIsLoginMode(false); setError(''); }}>Sign Up</button>
      </div>

      <form className="premium-form" onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'center' }}>
            <div ref={googleBtnRef}></div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.5rem' }}>
          <hr style={{ flex: 1, borderColor: 'rgba(255,255,255,0.1)' }} />
          <span style={{ padding: '0 1rem', color: '#a1a1aa', fontSize: '0.8rem' }}>OR CONTINUE WITH EMAIL</span>
          <hr style={{ flex: 1, borderColor: 'rgba(255,255,255,0.1)' }} />
        </div>

        {!isLoginMode && (
          <div className="form-group">
            <label>Your Name</label>
            <input type="text" placeholder="John Doe" value={name} onChange={e => setName(e.target.value)} required />
          </div>
        )}
        <div className="form-group">
          <label>Email Address</label>
          <input type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
        </div>
        <div className="form-group">
          <label>Password</label>
          <input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
        </div>

        <button type="submit" className="btn-primary w-full mt-2" disabled={loading}>
          <span>{loading ? "Authenticating..." : (isLoginMode ? "Log In" : "Sign Up")}</span>
          {loading && <div className="loader"></div>}
        </button>

        {error && <p style={{ color: '#ef4444', marginTop: '1rem', textAlign: 'center', fontSize: '0.85rem' }}>{error}</p>}
      </form>
    </section>
  );
}
