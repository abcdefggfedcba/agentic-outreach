import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { Mail, ArrowLeft, RefreshCw } from 'lucide-react';

export default function AuthSection({ onLogin, onGmailToken }) {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // OTP flow state
  const [otpStep, setOtpStep] = useState(false); // true = show OTP input
  const [otp, setOtp] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const googleBtnRef = useRef(null);

  // Countdown timer for resend OTP
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

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
      const interval = setInterval(() => {
        if (window.google) { clearInterval(interval); initGoogle(); }
      }, 100);
      return () => clearInterval(interval);
    }
  }, []);

  const requestGmailToken = (user, callback) => {
    const savedToken = localStorage.getItem('gmail_token');
    if (savedToken) {
      onGmailToken(savedToken);
      if (callback) callback();
      return;
    }
    if (!window.google?.accounts?.oauth2) {
      if (callback) callback();
      return;
    }
    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: "842703581435-jn55ranuqnu5r872qqq57va435bi91tm.apps.googleusercontent.com",
      scope: 'https://www.googleapis.com/auth/gmail.compose',
      callback: (tokenResponse) => {
        if (tokenResponse?.access_token) {
          onGmailToken(tokenResponse.access_token);
          localStorage.setItem('gmail_token', tokenResponse.access_token);
        }
        if (callback) callback();
      },
      error_callback: () => { if (callback) callback(); }
    });
    tokenClient.requestAccessToken({ prompt: '' });
  };

  const handleGoogleLogin = async (response) => {
    setError('');
    setLoading(true);
    try {
      const data = await api.googleLogin(response.credential);
      if (data.status === 'success') {
        const user = { user_id: data.user_id, name: data.name, picture: data.picture, company: data.company, services: data.services };
        requestGmailToken(user, () => onLogin(user));
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError("Google Sign-In failed.");
    } finally {
      setLoading(false);
    }
  };

  // Step 1: Send OTP
  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError('');
    setOtpSending(true);
    try {
      const data = await api.sendOtp(name, email);
      if (data.status === 'success') {
        setOtpStep(true);
        setCountdown(60);
      } else {
        setError(data.message);
      }
    } catch {
      setError("Failed to send OTP. Please try again.");
    } finally {
      setOtpSending(false);
    }
  };

  // Step 2: Verify OTP & create account
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.signup(name, email, password, otp);
      if (data.status === 'success') {
        onLogin({ user_id: data.user_id, name: data.name, email, company: data.company, services: data.services });
      } else {
        setError(data.message);
      }
    } catch {
      setError("Signup failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Login (unchanged)
  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.login(email, password);
      if (data.status === 'success') {
        onLogin({ user_id: data.user_id, name: data.name, email, company: data.company, services: data.services });
      } else {
        setError(data.message);
      }
    } catch {
      setError("Server error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const resetSignup = () => {
    setOtpStep(false);
    setOtp('');
    setError('');
    setCountdown(0);
  };

  const switchMode = (loginMode) => {
    setIsLoginMode(loginMode);
    setError('');
    setOtpStep(false);
    setOtp('');
    setCountdown(0);
  };

  return (
    <section className="active fade-in">
      <div className="auth-toggle">
        <button type="button" className={`toggle-btn ${isLoginMode ? 'active' : ''}`} onClick={() => switchMode(true)}>Log In</button>
        <button type="button" className={`toggle-btn ${!isLoginMode ? 'active' : ''}`} onClick={() => switchMode(false)}>Sign Up</button>
      </div>

      {/* ── LOGIN FORM ── */}
      {isLoginMode && (
        <form className="premium-form" onSubmit={handleLogin}>
          <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'center' }}>
            <div ref={googleBtnRef}></div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.5rem' }}>
            <hr style={{ flex: 1, borderColor: 'rgba(255,255,255,0.1)' }} />
            <span style={{ padding: '0 1rem', color: '#a1a1aa', fontSize: '0.8rem' }}>OR CONTINUE WITH EMAIL</span>
            <hr style={{ flex: 1, borderColor: 'rgba(255,255,255,0.1)' }} />
          </div>
          <div className="form-group">
            <label>Email Address</label>
            <input type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="btn-primary w-full mt-2" disabled={loading}>
            <span>{loading ? "Authenticating..." : "Log In"}</span>
            {loading && <div className="loader"></div>}
          </button>
          {error && <p style={{ color: '#ef4444', marginTop: '1rem', textAlign: 'center', fontSize: '0.85rem' }}>{error}</p>}
        </form>
      )}

      {/* ── SIGNUP STEP 1: Details form ── */}
      {!isLoginMode && !otpStep && (
        <form className="premium-form" onSubmit={handleSendOtp}>
          <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'center' }}>
            <div ref={googleBtnRef}></div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.5rem' }}>
            <hr style={{ flex: 1, borderColor: 'rgba(255,255,255,0.1)' }} />
            <span style={{ padding: '0 1rem', color: '#a1a1aa', fontSize: '0.8rem' }}>OR CONTINUE WITH EMAIL</span>
            <hr style={{ flex: 1, borderColor: 'rgba(255,255,255,0.1)' }} />
          </div>
          <div className="form-group">
            <label>Your Name</label>
            <input type="text" placeholder="John Doe" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Email Address</label>
            <input type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" placeholder="Min 6 characters" value={password} onChange={e => setPassword(e.target.value)} minLength={6} required />
          </div>
          <button type="submit" className="btn-primary w-full mt-2" disabled={otpSending}>
            <span>{otpSending ? "Sending Code..." : "Send Verification Code"}</span>
            {otpSending && <div className="loader"></div>}
          </button>
          {error && <p style={{ color: '#ef4444', marginTop: '1rem', textAlign: 'center', fontSize: '0.85rem' }}>{error}</p>}
        </form>
      )}

      {/* ── SIGNUP STEP 2: OTP verification ── */}
      {!isLoginMode && otpStep && (
        <form className="premium-form" onSubmit={handleVerifyOtp}>
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
              <Mail size={22} color="#6366f1" />
            </div>
            <h3 style={{ color: '#fff', margin: '0 0 6px', fontSize: '1.1rem' }}>Check your inbox</h3>
            <p style={{ color: '#a1a1aa', fontSize: '0.85rem', margin: 0 }}>
              We sent a 6-digit code to <strong style={{ color: '#e4e4e7' }}>{email}</strong>
            </p>
          </div>

          <div className="form-group">
            <label>Verification Code</label>
            <input
              type="text"
              placeholder="000000"
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
              style={{ letterSpacing: '0.5rem', fontSize: '1.4rem', textAlign: 'center', fontWeight: 700 }}
              required
              autoFocus
            />
          </div>

          <button type="submit" className="btn-primary w-full mt-2" disabled={loading || otp.length < 6}>
            <span>{loading ? "Verifying..." : "Verify & Create Account"}</span>
            {loading && <div className="loader"></div>}
          </button>

          {error && <p style={{ color: '#ef4444', marginTop: '1rem', textAlign: 'center', fontSize: '0.85rem' }}>{error}</p>}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.2rem' }}>
            <button type="button" onClick={resetSignup} style={{ background: 'none', border: 'none', color: '#a1a1aa', fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <ArrowLeft size={13} /> Change email
            </button>
            <button
              type="button"
              onClick={handleSendOtp}
              disabled={countdown > 0 || otpSending}
              style={{ background: 'none', border: 'none', color: countdown > 0 ? '#52525b' : '#6366f1', fontSize: '0.82rem', cursor: countdown > 0 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <RefreshCw size={13} />
              {countdown > 0 ? `Resend in ${countdown}s` : 'Resend Code'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
