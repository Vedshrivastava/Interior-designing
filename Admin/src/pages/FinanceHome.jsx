import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { FINANCE_NAV_SECTIONS } from '../config/financeNav';
import '../styles/welcome.css';

const FinanceHome = () => {
    const navigate = useNavigate();

    // Every item except the Dashboard link itself (Overview section, which is this page)
    const shortcuts = FINANCE_NAV_SECTIONS
        .filter(({ label }) => label !== 'Overview')
        .flatMap(({ items }) => items);

    return (
        <div className="welcome-container">
            <span className="welcome-badge">Finance</span>
            <h1>Your <em>finance</em> workspace</h1>
            <p>Daily data entry, expense tracking, and monthly CA-ready exports — built out phase by phase.</p>
            <div className="welcome-divider">
                <span /><i className="ti ti-leaf" /><span />
            </div>
            <div className="welcome-cards">
                {shortcuts.map(({ icon, label, description, to }) => (
                    <div key={to} className="welcome-card" onClick={() => navigate(to)}>
                        <div className="welcome-card-icon">
                            <FontAwesomeIcon icon={icon} />
                        </div>
                        <h3>{label}</h3>
                        <p>{description}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default FinanceHome;
