import React, { useState } from 'react';
import MasterCrudTable from '../../components/finance/MasterCrudTable';
import SettingsCrudList from '../../components/finance/SettingsCrudList';
import '../../styles/list.css';

const TABS = [
    { key: 'clients',   label: 'Clients' },
    { key: 'vendors',   label: 'Vendors' },
    { key: 'employees', label: 'Employees' },
    { key: 'materials', label: 'Materials' },
    { key: 'teams',     label: 'Labour Teams' },
    { key: 'settings',  label: 'Settings & Lists' },
];

const MasterData = ({ url }) => {
    const [activeTab, setActiveTab] = useState(TABS[0].key);

    return (
        <div className="list add flex-col">
            <div className="admin-list-container">
                <div className="admin-header-split">
                    <div>
                        <h1>Master Data</h1>
                        <p className="admin-subtitle">Clients, vendors, employees, materials, labour teams, and the dropdown lists everything else references.</p>
                    </div>
                </div>

                <div className="admin-category-scroll">
                    {TABS.map(t => (
                        <button key={t.key} className={`admin-cat-pill${activeTab === t.key ? ' active' : ''}`} onClick={() => setActiveTab(t.key)}>
                            {t.label}
                        </button>
                    ))}
                </div>

                {activeTab === 'settings'
                    ? <SettingsCrudList url={url} />
                    : <MasterCrudTable url={url} resourceKey={activeTab} />}
            </div>
        </div>
    );
};

export default MasterData;
