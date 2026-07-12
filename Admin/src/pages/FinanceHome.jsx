import React from 'react';
import '../styles/welcome.css';

const FinanceHome = () => {
    return (
        <div className="welcome-container">
            <span className="welcome-badge">Finance</span>
            <h1>Your <em>finance</em> workspace</h1>
            <p>Daily data entry, expense tracking, and monthly CA-ready exports — coming together here.</p>
            <div className="welcome-divider">
                <span /><i className="ti ti-leaf" /><span />
            </div>
        </div>
    );
};

export default FinanceHome;
