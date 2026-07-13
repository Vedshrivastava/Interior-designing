import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { FINANCE_ROUTES } from '../config/financeNav';
import '../styles/welcome.css';

const FinanceHome = ({ url }) => {
    const navigate = useNavigate();

    // Check-on-load, not a background job — no cron infrastructure exists
    // in this codebase. Silent: de-duplication (24h cooldown per
    // material/bill) and the actual notification happen server-side via
    // email; there's nothing for the dashboard itself to display.
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) return;
        axios.get(`${url}/api/finance/settings/check-alerts`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    }, [url]);

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
