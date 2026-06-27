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
  faEnvelope, faLock, faUser, faEye, faEyeSlash,
} from '@fortawesome/free-solid-svg-icons';
import { PageLoader } from './Navbar';

const TITLES = {
  Login:            'Admin Login',
  'Sign Up':        'Create Account',
  'Forgot Password':'Reset Password',
};

const Login = ({ setShowLogin, authType = 'Login' }) => {
  const { signup, isLoading, login, forgotPassword } = useAuthStore();
  const { token, setToken, setUserId, setUserName, setUserEmail, setIsLoggedIn } = useContext(StoreContext);

  // Read ?reason=expired from URL — set once on mount, never changes
  const sessionExpired = new URLSearchParams(window.location.search).get('reason') === 'expired';

  const [currState, setCurrState]       = useState(authType);
  const [data, setData]                 = useState({ name: '', email: '', password: '' });
  const [forgotEmail, setForgotEmail]   = useState('');
  const [isSubmitted, setIsSubmitted]   = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  const [pageLoading, setPageLoading]   = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    setCurrState(authType);
  }, [authType]);

  // NOTE: token-expiry check and handleLogout have been removed from here.
  // The Navbar now owns all expiry logic (3-layer: mount check, setTimeout, setInterval).
  // The axios interceptor in StoreContext handles backend 401s.

  const onChange = e => setData(prev => ({ ...prev, [e.target.name]: e.target.value }));

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
          const msg = response?.data?.message;
          if (msg === 'no_account') {
            toast.error("No account found with this email. Please create an account first, then request admin access.");
          } else if (msg === 'not_admin') {
            toast.error("This account doesn't have admin access. Contact an existing admin to get your access approved.");
          } else {
            toast.error(msg || 'Login failed. Please try again.');
          }
          return;
        }

        const userToken = response.data.token;
        const decoded = jwtDecode(userToken);

        /* Persist session data */
        setToken(userToken);
        setUserId(decoded.id);
        setUserName(decoded.name);
        setUserEmail(decoded.email);
        setIsLoggedIn(true);

        localStorage.setItem('token',     userToken);
        localStorage.setItem('userId',    decoded.id);
        localStorage.setItem('userName',  decoded.name);
        localStorage.setItem('userEmail', decoded.email);
        localStorage.setItem('user',      JSON.stringify({
          role:       response.data.role,
          name:       response.data.name,
          email:      response.data.email,
          isVerified: response.data.user?.isVerified ?? false,
        }));

        /* ── Role check — allow ADMIN and MASTER, kick everyone else ── */
        const allowedRoles = ['ADMIN', 'MASTER'];
        if (!allowedRoles.includes(response.data.role)) {
          ['token','userId','userName','userEmail','user'].forEach(k => localStorage.removeItem(k));
          setToken(null);
          setIsLoggedIn(false);
          window.location.replace('/');
          return;
        }

        toast.success('Logged in successfully!');
        setShowLogin(false);
        navigate('/welcome');
      }
    } catch (err) {
      console.error(err);
      if (currState === 'Login') {
        const status  = err.response?.status;
        const message = err.response?.data?.message;
        if (status === 404 || message === 'no_account') {
          toast.error("No account found with this email. Please create an account first, then request admin access.");
        } else if (status === 403 || message === 'not_admin') {
          toast.error("This account doesn't have admin access. Contact an existing admin to get your access approved.");
        } else {
          toast.error(err.response?.data?.message || err?.message || 'Login failed. Please try again.');
        }
      } else if (currState === 'Sign Up') {
        const msg = err.response?.data?.message || err?.message || '';
        if (msg.toLowerCase().includes('verification email') || msg.toLowerCase().includes('failed to send')) {
          toast.error('Could not send verification email. Please check your email address and try again.');
        } else {
          toast.error(msg || 'Something went wrong. Please try again.');
        }
      } else {
        toast.error(err.response?.data?.message || err?.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setPageLoading(false);
    }
  };

  return (
    <>
      <PageLoader visible={pageLoading} />

      <div className="login" onClick={e => e.target === e.currentTarget && setShowLogin(false)}>
        <form onSubmit={onLogin} className="login-container">
          <div className="login-rule" />
          <div className="login-inner">

            {/* ── Session expired banner ── */}
            {sessionExpired && (
              <div className="session-expired-banner">
                ⏱ Your session has expired. Please sign in again.
              </div>
            )}

            <div className="login-title">
              <h2>{TITLES[currState]}</h2>
              <span className="close-btn" onClick={() => setShowLogin(false)} role="button" aria-label="Close">
                <FontAwesomeIcon icon={faXmark} />
              </span>
            </div>

            <div className="login-divider" />

            <div className="login-inputs">
              {currState === 'Sign Up' && (
                <div className="login-field">
                  <label>Full Name</label>
                  <input name="name" type="text" placeholder="Your full name" value={data.name} onChange={onChange} required />
                </div>
              )}

              {currState === 'Forgot Password' ? (
                <div className="login-field">
                  <label>Email Address</label>
                  <input name="forgotEmail" type="email" placeholder="your@email.com" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} required />
                </div>
              ) : (
                <>
                  <div className="login-field">
                    <label>Email Address</label>
                    <input name="email" type="email" placeholder="your@email.com" value={data.email} onChange={onChange} required />
                  </div>
                  <div className="login-field">
                    <label>Password</label>
                    <div className="login-password-wrap">
                      <input name="password" type={showPassword ? 'text' : 'password'} placeholder="Enter your password" value={data.password} onChange={onChange} required />
                      <button type="button" className="login-password-toggle" onClick={() => setShowPassword(p => !p)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                        <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

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

            {currState === 'Login' && (
              <>
                <p>Forgot your password? <span onClick={() => setCurrState('Forgot Password')}>Reset it</span></p>
                <p>Don't have an account? <span onClick={() => setCurrState('Sign Up')}>Sign Up</span></p>
              </>
            )}
            {currState === 'Forgot Password' && (
              <p>Remembered it? <span onClick={() => setCurrState('Login')}>Back to Login</span></p>
            )}
            {currState === 'Sign Up' && (
              <p>Already have an account? <span onClick={() => setCurrState('Login')}>Login</span></p>
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
