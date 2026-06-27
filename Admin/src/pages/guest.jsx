import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import '../styles/guest.css';

const url = 'http://localhost:3000';

const WelcomeGuest = ({ setShowLogin, setAuthType }) => {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm]     = useState({ name: '', email: '', reason: '' });
  const [loading, setLoading]   = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [noAccount, setNoAccount] = useState(false);

  const handleOpenAuth = (type) => {
    if (setAuthType) setAuthType(type);
    setShowLogin(true);
  };

  const onChange = e => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const onSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post(`${url}/api/requests/submit`, form);
      if (res.data.success) {
        setSubmitted(true);
        toast.success('Request submitted successfully!');
      } else {
        toast.error(res.data.message || 'Failed to submit request.');
      }
    } catch (err) {
      const msg = err.response?.data?.message || '';
      if (err.response?.status === 400 && msg.toLowerCase().includes('no account')) {
        setNoAccount(true);
      } else {
        toast.error(msg || 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setSubmitted(false);
    setNoAccount(false);
    setForm({ name: '', email: '', reason: '' });
  };

  return (
    <div className="welcome-container">

      {/* Top Context Badge */}
      <div className="welcome-badge">Guest Portal</div>

      {/* Editorial Header */}
      <h1>Welcome to a <em>refined</em> digital experience.</h1>

      <p>
        You are currently browsing as a guest. Please sign in to unlock your
        dashboard or explore public areas below.
      </p>

      {/* Quick Action CTAs */}
      <div className="welcome-cta-group">
        <button className="btn btn-primary" onClick={() => handleOpenAuth('Login')}>
          Sign In
        </button>
        <button className="btn btn-secondary" onClick={() => handleOpenAuth('Sign Up')}>
          Create Account
        </button>
      </div>

      {/* Request for Admin */}
      <button className="btn-request-admin" onClick={() => setShowModal(true)}>
        Request Admin Access
      </button>

      {/* ── Modal ── */}
      {showModal && (
        <div className="request-backdrop" onClick={closeModal}>
          <div className="request-modal" onClick={e => e.stopPropagation()}>

            {submitted ? (
              /* ── Success state ── */
              <div className="request-success">
                <div className="request-success-icon">✓</div>
                <h3>Request Submitted</h3>
                <p>
                  Your request has been received. The master admin will review
                  it and notify you once a decision is made.
                </p>
                <button className="request-close-btn" onClick={closeModal}>Close</button>
              </div>

            ) : noAccount ? (
              /* ── No account state ── */
              <div className="request-no-account">
                <button className="request-modal-x request-modal-x--top" onClick={closeModal} aria-label="Close">✕</button>
                <div className="request-no-account-icon">!</div>
                <h3>No Account Found</h3>
                <p>
                  There's no account registered with <strong>{form.email || 'this email'}</strong>.
                  You need to create an account first before you can request admin access.
                </p>
                <div className="request-no-account-actions">
                  <button
                    className="request-auth-btn request-auth-btn--primary"
                    onClick={() => { closeModal(); handleOpenAuth('Sign Up'); }}
                  >
                    Create Account
                  </button>
                  <button
                    className="request-auth-btn request-auth-btn--ghost"
                    onClick={() => { closeModal(); handleOpenAuth('Login'); }}
                  >
                    Sign In
                  </button>
                </div>
                <p className="request-no-account-hint">
                  Once your account is set up, come back here and submit the request using the same email.
                </p>
              </div>

            ) : (
              <>
                {/* ── Sticky header ── */}
                <div className="request-modal-header">
                  <div className="request-modal-header-left">
                    <span className="request-modal-badge">Admin Access</span>
                    <h2>Request Access</h2>
                  </div>
                  <button className="request-modal-x" onClick={closeModal} aria-label="Close">✕</button>
                </div>

                {/* ── Scrollable body ── */}
                <div className="request-modal-body">

                  {/* Steps */}
                  <div className="request-steps">
                    <div className="request-step">
                      <span className="request-step-num">1</span>
                      <span className="request-step-label">Create Account</span>
                    </div>
                    <div className="request-step-line" />
                    <div className="request-step request-step--active">
                      <span className="request-step-num request-step-num--active">2</span>
                      <span className="request-step-label request-step-label--active">Request Access</span>
                    </div>
                  </div>

                  {/* Notice */}
                  <div className="request-notice">
                    <span className="request-notice-icon">ℹ</span>
                    <p>
                      You must <strong>create an account first</strong> using the same email below.
                      Your password stays unchanged when approved.
                    </p>
                  </div>

                  {/* Form */}
                  <form className="request-form" onSubmit={onSubmit}>
                    <div className="request-field-row">
                      <div className="request-field">
                        <label>Full Name</label>
                        <input
                          name="name" type="text" placeholder="Your full name"
                          value={form.name} onChange={onChange} required
                        />
                      </div>
                      <div className="request-field">
                        <label>Email Address</label>
                        <input
                          name="email" type="email" placeholder="your@email.com"
                          value={form.email} onChange={onChange} required
                        />
                      </div>
                    </div>

                    <div className="request-field">
                      <label>Reason <span>(optional)</span></label>
                      <textarea
                        name="reason"
                        placeholder="Briefly explain your role and why you need admin access…"
                        value={form.reason} onChange={onChange} rows="3"
                      />
                    </div>

                    <button type="submit" className="request-submit-btn" disabled={loading}>
                      {loading ? 'Submitting…' : 'Submit Request'}
                    </button>
                  </form>

                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default WelcomeGuest;
