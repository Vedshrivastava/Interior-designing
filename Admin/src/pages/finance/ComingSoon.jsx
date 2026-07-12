import React from 'react';
import '../../styles/welcome.css';

const ComingSoon = ({ label, phase, description }) => (
    <div className="welcome-container">
        {phase && <span className="welcome-badge">{phase} — coming soon</span>}
        <h1>{label}</h1>
        <p>{description || "This section isn't built yet — it's on the roadmap."}</p>
        <div className="welcome-divider">
            <span /><i className="ti ti-leaf" /><span />
        </div>
    </div>
);

export default ComingSoon;
