
import React, { useState, useContext, useEffect } from 'react';
import '../styles/Login.css';
import { StoreContext } from '../context/StoreContext';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore.js';
import { jwtDecode } from 'jwt-decode';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faXmark, faArrowRightToBracket, faPaperPlane,
  faEnvelope, faLock, faUser,
} from '@fortawesome/free-solid-svg-icons';
import { PageLoader } from './Navbar';

/* ─── helpers ─────────────────────────────── */
const TITLES = {
  Login:            'Admin Login',
  'Sign Up':        'Create Account',
  'Forgot Password':'Reset Password',
};

const Login = ({ setShowLogin }) => {
  const { signup, isLoading, login, forgotPassword } = useAuthStore();
  const { setToken, setUserId, setUserName, setUserEmail, setIsLoggedIn } = useContext(StoreContext);

  const [currState, setCurrState]     = useState('Login');
  const [data, setData]               = useState({ name: '', email: '', password: '' });
  const [forgotEmail, setForgotEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  const [pageLoading, setPageLoading]   = useState(false);

  const navigate = useNavigate();

  /* ── token-expiry check on mount ── */
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const decoded = jwtDecode(token);
      const expiresIn = decoded.exp * 1000 - Date.now();
      if (expiresIn <= 0) {
        handleLogout();
      } else {
        const t = setTimeout(handleLogout, expiresIn);
        return () => clearTimeout(t);
      }
    } catch { handleLogout(); }
  }, []);

  const onChange = e => setData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  /* ── logout ── */
  const handleLogout = () => {
    setToken(null);
    setUserId(null); setUserName(null); setUserEmail(null);
    setIsLoggedIn(false);
    ['token','userId','userName','userEmail','user'].forEach(k => localStorage.removeItem(k));
    toast.info('Session expired. Please sign in again.');
    navigate('/');
  };

  /* ── submit ── */
  const onLogin = async e => {
    e.preventDefault();
    setPageLoading(true);

    try {
      /* ── Sign Up ── */
      if (currState === 'Sign Up') {
        await signup(data.email, data.password, data.name);
        toast.success('Account created! Please verify your email.');
        setShowLogin(false);
        navigate('/verify-email');

      /* ── Forgot Password ── */
      } else if (currState === 'Forgot Password') {
        const response = await forgotPassword(forgotEmail);
        if (response?.data?.success) {
          toast.success('Password reset link sent.');
          setIsSubmitted(true);
          setResetMessage('A reset link has been sent to your email.');
        } else {
          toast.error(response?.data?.message || 'Failed to send reset link.');
        }

      /* ── Login ── */
      } else {
        const response = await login(data.email, data.password);
        if (!response?.data?.success) {
          toast.error(response?.data?.message || 'Login failed.');
          return;
        }
        if (response.data.role !== 'ADMIN') {
          toast.error('Access Denied. You need authentication as an admin.');
          return;
        }

        const token = response.data.token;
        const decoded = jwtDecode(token);

        /* persist */
        setToken(token);
        setUserId(decoded.id);
        setUserName(decoded.name);
        setUserEmail(decoded.email);
        setIsLoggedIn(true);

        localStorage.setItem('token',     token);
        localStorage.setItem('userId',    decoded.id);
        localStorage.setItem('userName',  decoded.name);
        localStorage.setItem('userEmail', decoded.email);
        localStorage.setItem('user',      JSON.stringify({ role: response.data.role }));

        /* auto-logout on expiry */
        const expiresIn = decoded.exp * 1000 - Date.now();
        if (expiresIn > 0) setTimeout(handleLogout, expiresIn);

        toast.success('Logged in successfully!');
        setShowLogin(false);
        navigate('/');
      }
    } catch (err) {
      console.error(err);
      
      /* ── Intercept Admin Auth Failures ── */
      if (currState === 'Login' && err.response && err.response.status === 400) {
        toast.error('Access Denied. You need authentication as an admin.');
      } else {
        toast.error(err.response?.data?.message || err?.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setPageLoading(false);
    }
  };

  return (
    <>
      {/* buffering overlay */}
      <PageLoader visible={pageLoading} />

      <div className="login" onClick={e => e.target === e.currentTarget && setShowLogin(false)}>
        <form onSubmit={onLogin} className="login-container">

          {/* gold rule */}
          <div className="login-rule" />

          <div className="login-inner">

            {/* ── Title row ── */}
            <div className="login-title">
              <h2>{TITLES[currState]}</h2>
              <span
                className="close-btn"
                onClick={() => setShowLogin(false)}
                role="button"
                aria-label="Close"
              >
                <FontAwesomeIcon icon={faXmark} />
              </span>
            </div>

            <div className="login-divider" />

            {/* ── Inputs ── */}
            <div className="login-inputs">

              {currState === 'Sign Up' && (
                <div className="login-field">
                  <label>Full Name</label>
                  <input
                    name="name" type="text" placeholder="Your full name"
                    value={data.name} onChange={onChange} required
                  />
                </div>
              )}

              {currState === 'Forgot Password' ? (
                <div className="login-field">
                  <label>Email Address</label>
                  <input
                    name="forgotEmail" type="email" placeholder="your@email.com"
                    value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} required
                  />
                </div>
              ) : (
                <>
                  <div className="login-field">
                    <label>Email Address</label>
                    <input
                      name="email" type="email" placeholder="your@email.com"
                      value={data.email} onChange={onChange} required
                    />
                  </div>
                  <div className="login-field">
                    <label>Password</label>
                    <input
                      name="password" type="password" placeholder="Enter your password"
                      value={data.password} onChange={onChange} required
                    />
                  </div>
                </>
              )}

            </div>

            {/* ── Submit ── */}
            <button type="submit" disabled={isLoading || pageLoading}>
              {isLoading || pageLoading ? (
                'Please wait…'
              ) : currState === 'Sign Up' ? (
                <><FontAwesomeIcon icon={faUser} /> Create Account</>
              ) : currState === 'Forgot Password' ? (
                <><FontAwesomeIcon icon={faPaperPlane} /> Send Reset Link</>
              ) : (
                <><FontAwesomeIcon icon={faArrowRightToBracket} /> Login</>
              )}
            </button>

            {/* ── Footer links ── */}
            {currState === 'Login' && (
              <>
                <p>Forgot your password?{' '}
                  <span onClick={() => setCurrState('Forgot Password')}>Reset it</span>
                </p>
                <p>Don't have an account?{' '}
                  <span onClick={() => setCurrState('Sign Up')}>Sign Up</span>
                </p>
              </>
            )}
            {currState === 'Forgot Password' && (
              <p>Remembered it?{' '}
                <span onClick={() => setCurrState('Login')}>Back to Login</span>
              </p>
            )}
            {currState === 'Sign Up' && (
              <p>Already have an account?{' '}
                <span onClick={() => setCurrState('Login')}>Login</span>
              </p>
            )}

            {isSubmitted && resetMessage && (
              <div className="submitted-message">
                <p>{resetMessage}</p>
              </div>
            )}

          </div>
        </form>

        <ToastContainer
          position="bottom-center"
          autoClose={3000}
          theme="dark"
          toastStyle={{
            background: '#102525',
            color: '#f0e6d3',
            border: '1px solid rgba(201,168,124,0.25)',
          }}
        />
      </div>
    </>
  );
};

export default Login;