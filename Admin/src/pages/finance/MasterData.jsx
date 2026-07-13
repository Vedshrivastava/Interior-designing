import React, { useEffect, useState } from 'react';
import axios from 'axios';
import MasterCrudTable from '../../components/finance/MasterCrudTable';
import SettingsCrudList from '../../components/finance/SettingsCrudList';
import SalaryLedgerView from '../../components/finance/SalaryLedgerView';
import '../../styles/list.css';

/*
 * Clients and Vendors moved out to their own top-level pages (Clients,
 * Procurement, Contractors) — see financeNav.js's "Old → new mapping"
 * comment. The old combined "Settings & Lists" tab is dissolved: every
 * setting type is now a named tab in its own right, each rendering
 * SettingsCrudList locked to one settingType instead of switching between
 * them internally. Units/Cities/Commission Types joined the original four
 * as real tabs in the Masters Completion build; Banks was removed
 * entirely in that same build — Bank Accounts already exists as its own
 * real top-level section (from the Bank + Cash Book build), so a second,
 * simpler list here would only go stale next to it.
 *
 * Salary Ledger is a sibling tab here rather than a routed per-employee
 * detail page — same "picker on the same page" pattern already used for
 * Contractors' Ledger and Procurement's Ledger/Commission Ledger tabs.
 */
const TABS = [
    { key: 'materials',         label: 'Material Master' },
    { key: 'work_type',         label: 'Work Types' },
    { key: 'payment_mode',      label: 'Payment Modes' },
    { key: 'expense_category',  label: 'Expense Heads' },
    { key: 'tds_section',       label: 'TDS Sections' },
    { key: 'unit',              label: 'Units' },
    { key: 'city',              label: 'Cities' },
    { key: 'commission_type',   label: 'Commission Types' },
    { key: 'employees',         label: 'Employees' },
    { key: 'salary_ledger',     label: 'Salary Ledger' },
    { key: 'teams',             label: 'Labour Teams' },
];

const SETTING_TYPE_KEYS = ['work_type', 'payment_mode', 'expense_category', 'tds_section', 'unit', 'city', 'commission_type'];

const EmployeePicker = ({ url, selectedEmployeeId, onChange }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const [employees, setEmployees] = useState([]);

    useEffect(() => {
        axios.get(`${url}/api/finance/employees/list`, authHeader).then(res => { if (res.data.success) setEmployees(res.data.data); }).catch(() => {});
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div className="add-product-name flex-col" style={{ marginBottom: '20px', maxWidth: '360px' }}>
            <p>Employee</p>
            <select value={selectedEmployeeId} onChange={e => onChange(e.target.value)}>
                <option value="">Select employee…</option>
                {employees.map(e => <option key={e._id} value={e._id}>{e.name}</option>)}
            </select>
        </div>
    );
};

const MasterData = ({ url }) => {
    const [activeTab, setActiveTab] = useState(TABS[0].key);
    const [selectedEmployeeId, setSelectedEmployeeId] = useState('');

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

                {activeTab === 'salary_ledger' ? (
                    <>
                        <EmployeePicker url={url} selectedEmployeeId={selectedEmployeeId} onChange={setSelectedEmployeeId} />
                        {selectedEmployeeId
                            ? <SalaryLedgerView url={url} employeeId={selectedEmployeeId} />
                            : <div className="admin-empty-state"><p>Select an employee to view their salary ledger.</p></div>}
                    </>
                ) : SETTING_TYPE_KEYS.includes(activeTab) ? (
                    <SettingsCrudList key={activeTab} url={url} lockedType={activeTab} />
                ) : (
                    <MasterCrudTable url={url} resourceKey={activeTab} />
                )}
            </div>
        </div>
    );
};

export default MasterData;
