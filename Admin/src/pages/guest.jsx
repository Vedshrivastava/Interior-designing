import React from 'react';
import '../styles/guest.css';

const WelcomeGuest = ({ setShowLogin, setAuthType }) => {
  
  // Helper function to set the state and open the modal
  const handleOpenAuth = (type) => {
    if (setAuthType) setAuthType(type);
    setShowLogin(true);
  };

  return (
    <div className="welcome-container">
      {/* Top Context Badge */}
      <div className="welcome-badge">Guest Portal</div>

      {/* Editorial Header */}
      <h1>Welcome to a <em>refined</em> digital experience.</h1>
      
      {/* Subtitle explaining state */}
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
    </div>
  );
};

export default WelcomeGuest;