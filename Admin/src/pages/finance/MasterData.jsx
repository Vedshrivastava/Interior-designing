import React, { useState } from 'react';
import MasterCrudTable from '../../components/finance/MasterCrudTable';
import SettingsCrudList from '../../components/finance/SettingsCrudList';
import PlaceholderTab from '../../components/finance/PlaceholderTab';
import '../../styles/list.css';

/*
 * Clients and Vendors moved out to their own top-level pages (Clients,
 * Procurement, Contractors) — see financeNav.js's "Old → new mapping"
 * comment. The old combined "Settings & Lists" tab is dissolved: its four
 * setting types are now named tabs in their own right, each rendering
 * SettingsCrudList locked to one settingType instead of switching between
 * them internally.
 */
const TABS = [
    { key: 'materials',         label: 'Material Master' },
    { key: 'work_type',         label: 'Work Types' },
    { key: 'payment_mode',      label: 'Payment Modes' },
    { key: 'expense_category',  label: 'Expense Heads' },
    { key: 'tds_section',       label: 'TDS Sections' },
    { key: 'units',             label: 'Units' },
    { key: 'banks',             label: 'Banks' },
    { key: 'cities',            label: 'Cities' },
    { key: 'commission_types',  label: 'Commission Types' },
    { key: 'employees',         label: 'Employees' },
    { key: 'teams',             label: 'Labour Teams' },
];

const SETTING_TYPE_KEYS = ['work_type', 'payment_mode', 'expense_category', 'tds_section'];
const EMPTY_TAB_KEYS = ['units', 'banks', 'cities', 'commission_types'];

const MasterData = ({ url }) => {
    const [activeTab, setActiveTab] = useState(TABS[0].key);

    return (
        <div className="list add flex-col">
            <div className="admin-list-container">
                <div className="admin-header-split">
                    <div>
                        <h1>Master Data</h1>
                        <p className="admin-subtitle">Material catalog, dropdown lists, employees, and labour teams — the data everything else references.</p>
                    </div>
                </div>

                <div className="admin-category-scroll">
                    {TABS.map(t => (
                        <button key={t.key} className={`admin-cat-pill${activeTab === t.key ? ' active' : ''}`} onClick={() => setActiveTab(t.key)}>
                            {t.label}
                        </button>
                    ))}
                </div>

                {SETTING_TYPE_KEYS.includes(activeTab) ? (
                    <SettingsCrudList key={activeTab} url={url} lockedType={activeTab} />
                ) : EMPTY_TAB_KEYS.includes(activeTab) ? (
                    <PlaceholderTab text="No backing data type exists for this yet — coming soon." />
                ) : (
                    <MasterCrudTable url={url} resourceKey={activeTab} />
                )}
            </div>
        </div>
    );
};

export default MasterData;
