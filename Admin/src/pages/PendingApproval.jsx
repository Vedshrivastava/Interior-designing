import React, { useEffect, useState } from 'react';
import axios from 'axios';

const url = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const PendingApproval = () => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const token = localStorage.getItem('token');
  const [hasRequest, setHasRequest] = useState(null); // null = loading

  useEffect(() => {
    axios.get(`${url}/api/requests/my-status`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => setHasRequest(res.data.hasRequest))
      .catch(() => setHasRequest(false));
  }, []);

  const handleLogout = () => {
    ['token', 'userId', 'userName', 'userEmail', 'user'].forEach(k => localStorage.removeItem(k));
    window.location.replace('/');
  };

  const pageStyle = {
    position: 'fixed', inset: 0, display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    background: '#0d2020',
    backgroundImage: 'linear-gradient(rgba(201,168,124,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(201,168,124,0.06) 1px, transparent 1px)',
    backgroundSize: '36px 36px',
    padding: '24px 16px', fontFamily: "'DM Sans', sans-serif", zIndex: 9999,
  };

  const cardStyle = {
    background: '#f8f4ee',
    border: '1px solid rgba(201,168,124,0.35)',
    borderRadius: '20px', padding: '48px 40px',
    maxWidth: '480px', width: '100%', textAlign: 'center',
    boxShadow: '0 24px 64px rgba(10,20,20,0.35)',
  };

  const badgeStyle = {
    display: 'inline-block', fontFamily: "'DM Sans', sans-serif",
    fontSize: '0.62rem', fontWeight: 700, letterSpacing: '1.8px',
    textTransform: 'uppercase', color: '#c9a87c',
    background: 'rgba(201,168,124,0.1)', border: '1px solid rgba(201,168,124,0.3)',
    borderRadius: '20px', padding: '4px 12px', marginBottom: '16px',
  };

  const titleStyle = {
    fontFamily: "'Cormorant Garamond', serif", fontSize: '1.9rem',
    fontWeight: 600, color: '#102525', margin: '0 0 12px',
  };

  const subStyle = { fontSize: '0.88rem', color: '#5a6a6a', lineHeight: 1.7, margin: '0 0 24px' };

  const noticeStyle = {
    display: 'flex', gap: '10px', alignItems: 'flex-start',
    background: 'rgba(201,168,124,0.08)', borderLeft: '3px solid #c9a87c',
    borderRadius: '0 8px 8px 0', padding: '12px 14px', marginBottom: '32px', textAlign: 'left',
  };

  const btnStyle = {
    width: '100%', padding: '13px',
    background: 'linear-gradient(135deg, #c9a87c 0%, #e8c99a 50%, #c9a87c 100%)',
    backgroundSize: '200% auto', color: '#102525', border: 'none',
    borderRadius: '10px', fontFamily: "'DM Sans', sans-serif",
    fontSize: '0.92rem', fontWeight: 700, cursor: 'pointer', letterSpacing: '0.5px',
    marginBottom: '10px',
  };

  const ghostBtnStyle = {
    ...btnStyle,
    background: 'transparent',
    border: '1px solid rgba(201,168,124,0.4)',
    color: '#102525',
  };

  if (hasRequest === null) {
    return (
      <div style={pageStyle}>
        <div style={{ color: '#c9a87c', fontFamily: "'DM Sans', sans-serif", fontSize: '0.9rem' }}>
          Loading…
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>

        {hasRequest ? (
          /* ── Has sent a request — waiting for approval ── */
          <>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: 'rgba(201,168,124,0.12)', border: '2px solid rgba(201,168,124,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 24px', fontSize: '1.6rem', color: '#c9a87c',
            }}>⏳</div>

            <span style={badgeStyle}>Pending Approval</span>
            <h2 style={titleStyle}>Access Pending</h2>
            <p style={subStyle}>
              Your account <strong style={{ color: '#102525' }}>{user.email || ''}</strong> has been created and your access request has been submitted.
              <br /><br />
              The master admin will review your request and grant you access shortly.
            </p>

            <div style={noticeStyle}>
              <span style={{ color: '#c9a87c', flexShrink: 0 }}>ℹ</span>
              <p style={{ fontSize: '0.82rem', color: '#5a6a6a', margin: 0, lineHeight: 1.5 }}>
                Once approved, sign out and sign back in — your dashboard will be ready.
              </p>
            </div>

            <button style={btnStyle} onClick={handleLogout}>Sign Out</button>
          </>
        ) : (
          /* ── Has NOT sent a request yet ── */
          <>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: 'rgba(16,37,37,0.08)', border: '2px solid rgba(16,37,37,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 24px', fontSize: '1.6rem', color: '#102525',
            }}>🔒</div>

            <span style={badgeStyle}>No Access</span>
            <h2 style={titleStyle}>Request Admin Access</h2>
            <p style={subStyle}>
              Your account is verified but you don't have admin access yet.
              <br /><br />
              To get access, you need to send an access request. The master admin will review it and approve or reject it.
            </p>

            <div style={noticeStyle}>
              <span style={{ color: '#c9a87c', flexShrink: 0 }}>ℹ</span>
              <p style={{ fontSize: '0.82rem', color: '#5a6a6a', margin: 0, lineHeight: 1.5 }}>
                <strong style={{ color: '#102525' }}>How it works:</strong> Sign out → on the sign-in page click <em>"Request Admin Access"</em> → fill the form with your registered email → wait for master approval.
              </p>
            </div>

            <button style={ghostBtnStyle} onClick={handleLogout}>Sign Out & Request Access</button>
          </>
        )}

      </div>
    </div>
  );
};

export default PendingApproval;
