import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { FINANCE_ROUTES } from '../config/financeNav';
import '../styles/welcome.css';

const FinanceHome = () => {
    const navigate = useNavigate();

    // Every page except this one (Dashboard, the Overview section's only item)
    const shortcuts = FINANCE_ROUTES.filter(({ to }) => to !== '/finance');

    return (
        <div className="welcome-container">
            <span className="welcome-badge">Finance</span>
            <h1>Your <em>finance</em> workspace</h1>
            <p>Daily data entry, expense tracking, and monthly CA-ready exports — built out phase by phase.</p>
            <div className="welcome-divider">
                <span /><i className="ti ti-leaf" /><span />
            </div>
            <div className="welcome-cards">
                {shortcuts.map(({ icon, label, phase, tabs, to }) => (
                    <div key={to} className="welcome-card" onClick={() => navigate(to)}>
                        <div className="welcome-card-icon">
                            <FontAwesomeIcon icon={icon} />
                        </div>
                        <h3>{label}</h3>
                        <p>{phase ? `${phase} · ` : ''}{tabs.length > 1 ? `${tabs.length} sections` : tabs[0]?.description}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default FinanceHome;
