import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { FINANCE_SETTING_TYPES } from '../../config/financeMasters';
import '../../styles/list.css';
import '../../styles/wizard.css';
import '../../styles/add.css';

/* `lockedType` (optional): when set, this renders as a single-type list with
   no internal switcher pills — used now that each setting type (Work Types,
   Payment Modes, Expense Heads, TDS Sections) is its own Masters tab instead
   of living together under one dissolved "Settings & Lists" tab. */
const SettingsCrudList = ({ url, lockedType }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [activeType, setActiveType] = useState(lockedType || FINANCE_SETTING_TYPES[0].key);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [name, setName] = useState('');
    const [code, setCode] = useState('');
    const [rate, setRate] = useState('');
    const [saving, setSaving] = useState(false);
    const [query, setQuery] = useState('');

    const typeConfig = FINANCE_SETTING_TYPES.find(t => t.key === activeType);

    const fetchList = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${url}/api/finance/settings/list`, { ...authHeader, params: { settingType: activeType } });
            if (res.data.success) setItems(res.data.data);
        } catch {
            toast.error('Error fetching settings');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchList(); }, [activeType]); // eslint-disable-line react-hooks/exhaustive-deps

    const addItem = async () => {
        if (!name.trim()) { toast.error('Name is required'); return; }
        setSaving(true);
        try {
            const res = await axios.post(`${url}/api/finance/settings/add`, {
                settingType: activeType, name: name.trim(), code, rate: rate === '' ? null : Number(rate),
            }, authHeader);
            if (res.data.success) {
                toast.success(res.data.message);
                setName(''); setCode(''); setRate('');
                await fetchList();
            } else {
                toast.error(res.data.message);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error adding setting');
        } finally {
            setSaving(false);
        }
    };

    const removeItem = async (_id, itemName) => {
        try {
            const res = await axios.post(`${url}/api/finance/settings/remove`, { _id }, authHeader);
            if (res.data.success) {
                toast.success(`"${itemName}" removed`);
                await fetchList();
            } else {
                toast.error(res.data.message);
            }
        } catch {
            toast.error('Error removing setting');
        }
    };

    const visibleItems = items.filter(item => !query || item.name.toLowerCase().includes(query.toLowerCase()));

    return (
        <div>
            {!lockedType && (
                <div className="admin-category-scroll" style={{ paddingTop: 0 }}>
                    {FINANCE_SETTING_TYPES.map(t => (
                        <button key={t.key} className={`admin-cat-pill${activeType === t.key ? ' active' : ''}`} onClick={() => setActiveType(t.key)}>
                            {t.label}
                        </button>
                    ))}
                </div>
            )}

            <div className="wizard-step-body">
                <p className="wizard-section-label">Add {typeConfig.label.replace(/s$/, '')}</p>
                <div className="wizard-field-grid">
                    <div className="add-product-name flex-col">
                        <p>Name *</p>
                        <input type="text" placeholder={`New ${typeConfig.label.toLowerCase().replace(/s$/, '')} name`}
                            value={name} onChange={e => setName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') addItem(); }} />
                    </div>
                    {typeConfig.hasCode && (
                        <div className="add-product-name flex-col">
                            <p>Code</p>
                            <input type="text" placeholder="e.g. 194C-IND" value={code} onChange={e => setCode(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') addItem(); }} />
                        </div>
                    )}
                    {typeConfig.hasRate && (
                        <div className="add-product-name flex-col">
                            <p>Rate %</p>
                            <input type="number" onWheel={e => e.target.blur()} min="0" value={rate} onChange={e => setRate(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') addItem(); }} />
                        </div>
                    )}
                </div>
                <div className="wizard-actions" style={{ marginTop: '16px' }}>
                    <span />
                    <button type="button" className="add-btn" disabled={saving} onClick={addItem}>{saving ? 'Adding…' : '+ Add'}</button>
                </div>
            </div>

            <div className="admin-search-wrap" style={{ margin: '20px 0 16px' }}>
                <i className="fa-solid fa-magnifying-glass" />
                <input type="text" placeholder={`Search ${typeConfig.label.toLowerCase()}…`} value={query} onChange={e => setQuery(e.target.value)} />
                {query && <button className="admin-search-clear" onClick={() => setQuery('')}>×</button>}
            </div>

            <div className="list-table">
                <div className="list-table-format title" style={{ gridTemplateColumns: '2fr 1fr 1fr 140px' }}>
                    <b>Name</b><b>Code</b><b>Rate</b><b>Action</b>
                </div>
                {loading ? (
                    <div className="admin-empty-state"><p>Loading…</p></div>
                ) : visibleItems.length === 0 ? (
                    <div className="admin-empty-state"><p>{items.length === 0 ? `No ${typeConfig.label.toLowerCase()} yet.` : 'Nothing matches your search.'}</p></div>
                ) : (
                    visibleItems.map(item => (
                        <div key={item._id} className="list-table-format row-item" style={{ gridTemplateColumns: '2fr 1fr 1fr 140px' }}>
                            <p>{item.name}</p>
                            <p>{item.code || '-'}</p>
                            <p>{item.rate != null ? `${item.rate}%` : '-'}</p>
                            <div className="action-buttons">
                                <p onClick={() => removeItem(item._id, item.name)} className="cursor delete-action">X</p>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default SettingsCrudList;
