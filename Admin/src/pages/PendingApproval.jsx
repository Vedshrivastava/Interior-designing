import React, { useContext } from 'react';
import { StoreContext } from '../context/StoreContext';

const PendingApproval = ({ setShowLogin }) => {
  const { logout } = useContext(StoreContext) || {};
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const handleLogout = () => {
    ['token', 'userId', 'userName', 'userEmail', 'user'].forEach(k => localStorage.removeItem(k));
    if (logout) logout();
    window.location.replace('/');
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0a1a1a',
      padding: '24px 16px',
      fontFamily: "'DM Sans', sans-serif",
      zIndex: 9999,
    }}>
      <div style={{
        background: '#f8f4ee',
        border: '1px solid rgba(201,168,124,0.35)',
        borderRadius: '16px',
        padding: '48px 40px',
        maxWidth: '480px',
        width: '100%',
        textAlign: 'center',
        boxShadow: '0 24px 64px rgba(10,20,20,0.35)',
      }}>

        {/* Icon */}
        <div style={{
          width: '64px', height: '64px', borderRadius: '50%',
          background: 'rgba(201,168,124,0.12)',
          border: '2px solid rgba(201,168,124,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 24px', fontSize: '1.6rem', color: '#c9a87c',
        }}>
          ⏳
        </div>

        {/* Badge */}
        <span style={{
          display: 'inline-block',
          fontFamily: "'DM Sans', sans-serif",
          fontSize: '0.62rem', fontWeight: 700,
          letterSpacing: '1.8px', textTransform: 'uppercase',
          color: '#c9a87c', background: 'rgba(201,168,124,0.1)',
          border: '1px solid rgba(201,168,124,0.3)',
          borderRadius: '20px', padding: '4px 12px', marginBottom: '16px',
        }}>
          Pending Approval
        </span>

        <h2 style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: '1.9rem', fontWeight: 600,
          color: '#102525', margin: '0 0 12px',
        }}>
          Access Pending
        </h2>

        <p style={{
          fontSize: '0.9rem', color: '#5a6a6a',
          lineHeight: 1.7, margin: '0 0 24px',
        }}>
          Your account <strong style={{ color: '#102525' }}>{user.email || ''}</strong> has been created and verified successfully.
          <br /><br />
          You're currently waiting for the master admin to grant you access to the dashboard. You'll be able to log in with full access once approved.
        </p>

        {/* Notice box */}
        <div style={{
          display: 'flex', gap: '10px', alignItems: 'flex-start',
          background: 'rgba(201,168,124,0.08)',
          borderLeft: '3px solid #c9a87c',
          borderRadius: '0 8px 8px 0',
          padding: '12px 14px', marginBottom: '32px', textAlign: 'left',
        }}>
          <span style={{ color: '#c9a87c', flexShrink: 0 }}>ℹ</span>
          <p style={{ fontSize: '0.82rem', color: '#5a6a6a', margin: 0, lineHeight: 1.5 }}>
            Contact the master admin and ask them to approve your account using the email above.
          </p>
        </div>

        <button
          onClick={handleLogout}
          style={{
            width: '100%', padding: '13px',
            background: 'linear-gradient(135deg, #c9a87c 0%, #e8c99a 50%, #c9a87c 100%)',
            backgroundSize: '200% auto',
            color: '#102525', border: 'none', borderRadius: '10px',
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '0.92rem', fontWeight: 700,
            cursor: 'pointer', letterSpacing: '0.5px',
          }}
        >
          Sign Out
        </button>
      </div>
    </div>
  );
};

export default PendingApproval;
