import React, { useState } from 'react';
import { FiUser, FiShield, FiLock, FiMail, FiArrowLeft, FiLogIn, FiAlertTriangle, FiMapPin } from 'react-icons/fi';
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';

function Login({ onLoginSuccess }) {
  const [step, setStep] = useState('role'); // 'role', 'code', 'credentials'
  const [role, setRole] = useState(null); // 'civilian', 'bmc_official'
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSelectRole = (selectedRole) => {
    setRole(selectedRole);
    setError('');
    if (selectedRole === 'bmc_official') {
      setStep('code');
    } else {
      setStep('credentials');
    }
  };

  const handleVerifyCode = (e) => {
    e.preventDefault();
    if (['deformation', 'crack'].includes(code.trim().toLowerCase())) {
      setError('');
      setStep('credentials');
    } else {
      setError('Invalid officer access code. Please try again.');
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }
    
    try {
      const usersStr = localStorage.getItem('nirmaan_users');
      const users = usersStr ? JSON.parse(usersStr) : [];
      const user = users.find(u => u.email === email && u.password === password);
      
      if (user) {
        onLoginSuccess({ email: user.email, role: user.role });
      } else {
        setError('Invalid credentials.');
      }
    } catch (err) {
      console.error('Login error', err);
      setError('An error occurred during login.');
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Email and Password are required.');
      return;
    }
    
    const assignedRole = ['deformation', 'crack'].includes(code.trim().toLowerCase()) ? 'BMC Official' : 'Civilian';
    
    try {
      const usersStr = localStorage.getItem('nirmaan_users');
      const users = usersStr ? JSON.parse(usersStr) : [];
      
      if (users.find(u => u.email === email)) {
        setError('User already exists.');
        return;
      }
      
      const newUser = { email, password, role: assignedRole };
      users.push(newUser);
      localStorage.setItem('nirmaan_users', JSON.stringify(users));
      
      onLoginSuccess({ email: newUser.email, role: newUser.role });
    } catch (err) {
      console.error('Registration error', err);
      setError('An error occurred during registration.');
    }
  };

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        const userInfoRes = await fetch(
          'https://www.googleapis.com/oauth2/v3/userinfo',
          { headers: { Authorization: `Bearer ${tokenResponse.access_token}` } }
        );
        const userInfo = await userInfoRes.json();
        
        onLoginSuccess({
          email: userInfo.email,
          role: role === 'bmc_official' ? 'BMC Official' : 'Civilian',
        });
      } catch (err) {
        console.error('Failed to fetch user info', err);
        setError('Failed to fetch user info from Google.');
      }
    },
    onError: () => setError('Google Sign-In failed.'),
  });

  const handleGoBack = () => {
    setError('');
    if (step === 'credentials' && role === 'bmc_official') {
      setStep('code');
    } else {
      setStep('role');
      setRole(null);
      setCode('');
    }
  };

  const roleLabel = role === 'bmc_official' ? 'BMC Official' : 'Civilian';
  const titles = {
    role: ['Welcome to Nirmaan', 'Choose how you want to use the app.'],
    code: ['Officer verification', 'Enter your BMC officer access code to continue.'],
    credentials: ['Sign in', `Continuing as ${roleLabel}.`],
    register: ['Create your account', 'Takes less than a minute.'],
  };

  return (
    <div className="auth">
      <aside className="auth-hero">
        <div className="auth-brand">
          <img src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" width="44" height="44" />
          <div>
            <div className="auth-name">Nirmaan</div>
            <div className="auth-tag">Road Inspector</div>
          </div>
        </div>
        <h1>Find road damage before it finds someone.</h1>
        <p>Point a camera at the road. Nirmaan flags deformations in real time, tags them with GPS, and alerts the people who can fix them.</p>
        <ul className="auth-points">
          <li><span><FiShield /></span> Instant on-device detection</li>
          <li><span><FiMapPin /></span> Every finding geo-tagged</li>
          <li><span><FiMail /></span> Automatic email alerts to engineers</li>
        </ul>
      </aside>

      <main className="auth-panel">
        <div className="auth-card">
          <div className="auth-mobile-brand">
            <img src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" width="32" height="32" />
            <span>Nirmaan</span>
          </div>

          <h2>{titles[step][0]}</h2>
          <p className="auth-sub">{titles[step][1]}</p>

          {error && (
            <div className="banner banner-bad" role="alert">
              <FiAlertTriangle style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {step === 'role' && (
            <div>
              <div className="role-grid">
                <button type="button" className="role-card" onClick={() => handleSelectRole('civilian')}>
                  <span className="role-ic"><FiUser /></span>
                  <span className="role-title">Civilian</span>
                  <span className="role-desc">Report road deformations in your neighbourhood</span>
                </button>
                <button type="button" className="role-card" onClick={() => handleSelectRole('bmc_official')}>
                  <span className="role-ic"><FiShield /></span>
                  <span className="role-title">BMC Official</span>
                  <span className="role-desc">Access the monitoring database</span>
                </button>
              </div>
              <button
                type="button"
                className="btn btn-light btn-block"
                onClick={() => { setStep('register'); setError(''); setCode(''); setEmail(''); setPassword(''); }}
              >
                Create an account
              </button>
            </div>
          )}

          {step === 'code' && (
            <form onSubmit={handleVerifyCode} className="form">
              <label className="label">
                BMC officer access code
                <span className="field">
                  <span className="field-ic"><FiLock /></span>
                  <input type="password" placeholder="Enter secret code" value={code} onChange={(e) => setCode(e.target.value)} autoFocus />
                </span>
              </label>
              <button type="submit" className="btn btn-accent btn-block">Verify code</button>
              <button type="button" className="btn btn-quiet btn-block" onClick={handleGoBack}><FiArrowLeft /> Back</button>
            </form>
          )}

          {step === 'credentials' && (
            <form onSubmit={handleLoginSubmit} className="form">
              <label className="label">
                Email address
                <span className="field">
                  <span className="field-ic"><FiMail /></span>
                  <input type="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </span>
              </label>
              <label className="label">
                Password
                <span className="field">
                  <span className="field-ic"><FiLock /></span>
                  <input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </span>
              </label>

              <button type="submit" className="btn btn-accent btn-block"><FiLogIn /> Sign in</button>

              <div className="divider"><span>or</span></div>

              <button type="button" className="btn btn-light btn-block" onClick={handleGoogleLogin}>
                <svg className="google-icon" viewBox="0 0 24 24" width="18" height="18">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                Continue with Google
              </button>

              <button type="button" className="btn btn-quiet btn-block" onClick={handleGoBack}><FiArrowLeft /> Change role</button>
            </form>
          )}

          {step === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="form">
              <label className="label">
                Email address
                <span className="field">
                  <span className="field-ic"><FiMail /></span>
                  <input type="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </span>
              </label>
              <label className="label">
                Password
                <span className="field">
                  <span className="field-ic"><FiLock /></span>
                  <input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </span>
              </label>
              <label className="label">
                Special code <small>(optional)</small>
                <span className="field">
                  <span className="field-ic"><FiShield /></span>
                  <input type="password" placeholder="Enter secret code if applicable" value={code} onChange={(e) => setCode(e.target.value)} />
                </span>
                <small className="hint">Have a BMC officer code? Enter it for official access. Otherwise leave blank for a Civilian account.</small>
              </label>

              <button type="submit" className="btn btn-accent btn-block"><FiUser /> Create account</button>
              <button type="button" className="btn btn-quiet btn-block" onClick={handleGoBack}><FiArrowLeft /> Back</button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}

const LoginWithGoogle = (props) => (
  <GoogleOAuthProvider clientId="690090122752-6gcpa1r0mr5lhltl3dj1nliu9r6bc8lj.apps.googleusercontent.com">
    <Login {...props} />
  </GoogleOAuthProvider>
);

export default LoginWithGoogle;
