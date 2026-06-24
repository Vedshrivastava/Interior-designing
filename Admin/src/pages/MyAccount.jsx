import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUser, faShield, faCircleCheck,
  faLock, faKey, faEnvelope, faAt,
} from '@fortawesome/free-solid-svg-icons';
import '../styles/account.css';

const getInitials = (name = '') =>
  name.trim().split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join('');

const MyAccount = ({ url }) => {
  const token = localStorage.getItem('token');

  // Profile is read entirely from localStorage — no API call needed.
  // localStorage is kept in sync by the login flow and by the Change Email handler below.
  const cached = JSON.parse(localStorage.getItem('user') || '{}');
  const [profile, setProfile] = useState({
    name:       cached.name       || 'Admin',
    email:      cached.email      || '',
    role:       cached.role       || 'ADMIN',
    isVerified: cached.isVerified ?? false,
  });

  const [form, setForm]                 = useState({ current: '', next: '', confirm: '' });
  const [loading, setLoading]           = useState(false);
  const [resetSent, setResetSent]       = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [emailForm, setEmailForm]       = useState({ newEmail: '', password: '' });
  const [emailLoading, setEmailLoading] = useState(false);

  const onChange = e => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const onEmailChange = e =>
    setEmailForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const onEmailSubmit = async e => {
    e.preventDefault();
    setEmailLoading(true);
    try {
      const res = await axios.post(
        `${url}/api/admin/change-email`,
        { newEmail: emailForm.newEmail, password: emailForm.password },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data.success) {
        toast.success(res.data.message);
        // Update profile state and localStorage
        setProfile(prev => ({ ...prev, email: emailForm.newEmail, isVerified: false }));
        const stored = JSON.parse(localStorage.getItem('user') || '{}');
        localStorage.setItem('user', JSON.stringify({ ...stored, email: emailForm.newEmail, isVerified: false }));
        setEmailForm({ newEmail: '', password: '' });
      } else {
        toast.error(res.data.message || 'Failed to update email.');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Something went wrong.');
    } finally {
      setEmailLoading(false);
    }
  };

  const sendResetLink = async () => {
    if (!profile.email) { toast.error('No email address found.'); return; }
    setResetLoading(true);
    try {
      const res = await axios.post(`${url}/api/admin/forgot-password`, { email: profile.email });
      if (res.data.success) {
        setResetSent(true);
        toast.success('Reset link sent — check your email.');
      } else {
        toast.error(res.data.message || 'Failed to send reset link.');
      }
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

  const onSubmit = async e => {
    e.preventDefault();

    if (form.next !== form.confirm) {
      toast.error('New passwords do not match.');
      return;
    }
    if (form.next.length < 8) {
      toast.error('New password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(
        `${url}/api/admin/change-password`,
        { currentPassword: form.current, newPassword: form.next },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data.success) {
        toast.success('Password updated successfully.');
        setForm({ current: '', next: '', confirm: '' });
      } else {
        toast.error(res.data.message || 'Failed to update password.');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="account-page">
      <div className="account-inner">

        {/* ── Profile card ── */}
        <div>
          <p className="account-section-title">
            <FontAwesomeIcon icon={faUser} /> Profile
          </p>

          <div className="account-profile-card">
            <div className="account-avatar">
              <span className="account-avatar-initials">{getInitials(profile.name)}</span>
            </div>

            <div className="account-profile-info">
              <h2 className="account-profile-name">{profile.name}</h2>
              <p className="account-profile-email">{profile.email}</p>

              <div className="account-profile-badges">
                <span className="account-badge account-badge--role">
                  <FontAwesomeIcon icon={faShield} />
                  {profile.role}
                </span>

                {/* Only show the verified badge when actually verified — no "Unverified" label */}
                {profile.isVerified && (
                  <span className="account-badge account-badge--verified">
                    <FontAwesomeIcon icon={faCircleCheck} />
                    Verified
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Change password ── */}
        <div>
          <p className="account-section-title">
            <FontAwesomeIcon icon={faLock} /> Change Password
          </p>

          <div className="account-form-card">
            <form className="account-form" onSubmit={onSubmit}>

              <div className="account-field">
                <label htmlFor="current">Current Password</label>
                <input
                  id="current"
                  name="current"
                  type="password"
                  placeholder="Enter your current password"
                  value={form.current}
                  onChange={onChange}
                  required
                  autoComplete="current-password"
                />
              </div>

              <div className="account-field">
                <label htmlFor="next">New Password</label>
                <input
                  id="next"
                  name="next"
                  type="password"
                  placeholder="At least 8 characters"
                  value={form.next}
                  onChange={onChange}
                  required
                  autoComplete="new-password"
                />
              </div>

              <div className="account-field">
                <label htmlFor="confirm">Confirm New Password</label>
                <input
                  id="confirm"
                  name="confirm"
                  type="password"
                  placeholder="Repeat your new password"
                  value={form.confirm}
                  onChange={onChange}
                  required
                  autoComplete="new-password"
                />
              </div>

              <button type="submit" className="account-submit" disabled={loading}>
                {loading ? 'Updating…' : <><FontAwesomeIcon icon={faKey} /> Update Password</>}
              </button>

            </form>
          </div>
        </div>

        {/* ── Change email ── */}
        <div>
          <p className="account-section-title">
            <FontAwesomeIcon icon={faAt} /> Change Email
          </p>

          <div className="account-form-card">
            <form className="account-form" onSubmit={onEmailSubmit}>

              <div className="account-field">
                <label htmlFor="newEmail">New Email Address</label>
                <input
                  id="newEmail"
                  name="newEmail"
                  type="email"
                  placeholder="your@newemail.com"
                  value={emailForm.newEmail}
                  onChange={onEmailChange}
                  required
                  autoComplete="email"
                />
              </div>

              <div className="account-field">
                <label htmlFor="emailPassword">Confirm with Password</label>
                <input
                  id="emailPassword"
                  name="password"
                  type="password"
                  placeholder="Enter your current password to confirm"
                  value={emailForm.password}
                  onChange={onEmailChange}
                  required
                  autoComplete="current-password"
                />
              </div>

              <button type="submit" className="account-submit" disabled={emailLoading}>
                {emailLoading ? 'Updating…' : <><FontAwesomeIcon icon={faAt} /> Update Email</>}
              </button>

            </form>
          </div>
        </div>

        {/* ── Forgot password ── */}
        <div>
          <p className="account-section-title">
            <FontAwesomeIcon icon={faEnvelope} /> Forgot Password
          </p>

          <div className="account-form-card">
            <div className="account-forgot-body">
              <div className="account-forgot-text">
                <p className="account-forgot-title">Reset via email</p>
                <p className="account-forgot-desc">
                  Can't remember your current password? We'll send a reset link to
                  <strong> {profile.email}</strong>.
                </p>
              </div>

              {resetSent ? (
                <div className="account-forgot-sent">
                  <FontAwesomeIcon icon={faCircleCheck} />
                  Reset link sent — check your inbox.
                </div>
              ) : (
                <button
                  className="account-reset-btn"
                  onClick={sendResetLink}
                  disabled={resetLoading}
                >
                  {resetLoading ? 'Sending…' : <><FontAwesomeIcon icon={faEnvelope} /> Send Reset Link</>}
                </button>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default MyAccount;
