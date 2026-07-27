import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { FINANCE_SETTING_TYPES } from '../../config/financeMasters';
import ToggleSwitch from './ToggleSwitch';
import StyledSelect from './StyledSelect';
import { useFinanceWsRefresh } from '../../hooks/useFinanceWsRefresh';
import '../../styles/list.css';
import '../../styles/wizard.css';
import '../../styles/add.css';

// "Cities" -> "City", "Categories" -> "Category" — plain .replace(/s$/, '')
// mangled anything ending "-ies" into "-ie" (e.g. "Citie", "Categorie").
const singularize = (s) => (s.endsWith('ies') ? `${s.slice(0, -3)}y` : s.replace(/s$/, ''));

const emptyForm = { name: '', code: '', rate: '', deductFromClientBill: true, deductFromWorkerPayout: false, tdsSectionId: '' };

/* `lockedType` (optional): when set, this renders as a single-type list with
   no internal switcher pills — used now that each setting type (Work Types,
   Payment Modes, Expense Heads, TDS Sections) is its own Masters tab instead
   of living together under one dissolved "Settings & Lists" tab.

   Add/Edit lives in the same "+ Add X" button -> themed modal pattern
   MasterCrudTable and every other Manager in this app use — this used to be
   a form permanently pinned open at the top of every tab instead, which
   both ate vertical space on every visit and was the one Masters surface
   that didn't match the rest of the app's look. */
const SettingsCrudList = ({ url, lockedType }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [activeType, setActiveType] = useState(lockedType || FINANCE_SETTING_TYPES[0].key);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [query, setQuery] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [confirmItem, setConfirmItem] = useState(null);
    const [deleting, setDeleting] = useState(false);
    // work_type only — the TDS Section picker's own options list.
    const [tdsSections, setTdsSections] = useState([]);

    const typeConfig = FINANCE_SETTING_TYPES.find(t => t.key === activeType);
    const typeLabelSingular = singularize(typeConfig.label);

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

    const fetchTdsSections = () => {
        axios.get(`${url}/api/finance/settings/list`, { ...authHeader, params: { settingType: 'tds_section' } })
            .then(res => { if (res.data.success) setTdsSections(res.data.data); }).catch(() => {});
    };
    useEffect(() => {
        if (!typeConfig.hasTdsSection) return;
        fetchTdsSections();
    }, [url, activeType]); // eslint-disable-line react-hooks/exhaustive-deps

    // A setting added/edited/removed elsewhere (another tab, another admin,
    // or this same list's own form saving) wouldn't otherwise show up here
    // until the tab was reselected or the page reloaded — this list never
    // subscribed to the financeSettingsChanged broadcast the backend
    // already sends on every add/update/remove. Only refetch when it's
    // this list's own settingType (or, for a type whose form references
    // TDS Sections in its own picker — Work Types — when tds_section
    // itself changed, so that picker's options stay live too).
    useFinanceWsRefresh(['financeSettingsChanged'], (msg) => {
        if (!msg.settingType || msg.settingType === activeType) fetchList();
        if (msg.settingType === 'tds_section' && typeConfig.hasTdsSection) fetchTdsSections();
    });

    const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
    const openAdd = () => { setForm(emptyForm); setEditingId(null); setModalOpen(true); };
    const openEdit = (item) => {
        setForm({
            name: item.name, code: item.code || '', rate: item.rate ?? '',
            deductFromClientBill: item.deductFromClientBill ?? true, deductFromWorkerPayout: item.deductFromWorkerPayout ?? false,
            tdsSectionId: item.tdsSectionId?._id || item.tdsSectionId || '',
        });
        setEditingId(item._id);
        setModalOpen(true);
    };
    const closeModal = () => { setModalOpen(false); setEditingId(null); };

    const submit = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!form.name.trim()) { toast.error('Name is required'); return; }
        setSaving(true);
        try {
            const payload = {
                settingType: activeType, name: form.name.trim(), code: form.code, rate: form.rate === '' ? null : Number(form.rate),
                deductFromClientBill: form.deductFromClientBill, deductFromWorkerPayout: form.deductFromWorkerPayout,
                tdsSectionId: form.tdsSectionId || null,
            };
            const res = editingId
                ? await axios.post(`${url}/api/finance/settings/update`, { _id: editingId, ...payload }, authHeader)
                : await axios.post(`${url}/api/finance/settings/add`, payload, authHeader);
            if (res.data.success) {
                toast.success(res.data.message);
                closeModal();
                await fetchList();
            } else {
                toast.error(res.data.message);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || `Error ${editingId ? 'updating' : 'adding'} setting`);
        } finally {
            setSaving(false);
        }
    };

    const confirmDelete = async () => {
        if (!confirmItem) return;
        setDeleting(true);
        try {
            const res = await axios.post(`${url}/api/finance/settings/remove`, { _id: confirmItem._id }, authHeader);
            if (res.data.success) {
                toast.success(`"${confirmItem.name}" removed`);
                setConfirmItem(null);
                await fetchList();
            } else {
                toast.error(res.data.message);
            }
        } catch {
            toast.error('Error removing setting');
        } finally {
            setDeleting(false);
        }
    };

    const visibleItems = items.filter(item => !query || item.name.toLowerCase().includes(query.toLowerCase()));

    // Only the columns this type actually collects — Work Types/Payment
    // Modes/Units/Cities/Commission Types/Expense Categories have neither
    // code nor rate, so the table used to show two permanently-empty
    // "Code"/"Rate" columns for every one of them regardless.
    const extraCols = typeConfig.hasDeductFlags
        ? [
            { key: 'deductFromClientBill', label: 'Cut from Client Bill', render: item => (item.deductFromClientBill ? 'Yes' : 'No') },
            { key: 'deductFromWorkerPayout', label: 'Cut from Worker Payout', render: item => (item.deductFromWorkerPayout ? 'Yes' : 'No') },
        ]
        : [
            ...(typeConfig.hasCode ? [{ key: 'code', label: 'Code', render: item => item.code || '-' }] : []),
            ...(typeConfig.hasRate ? [{ key: 'rate', label: 'Rate', render: item => (item.rate != null ? `${item.rate}%` : '-') }] : []),
            ...(typeConfig.hasTdsSection ? [{ key: 'tdsSection', label: 'TDS Section', render: item => item.tdsSectionId?.name || 'No TDS' }] : []),
        ];
    const gridCols = `${extraCols.length > 0 ? '1.6fr' : '1fr'} ${extraCols.map(() => '1fr').join(' ')} 140px`.trim().replace(/\s+/g, ' ');

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

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <div className="admin-search-wrap">
                    <i className="fa-solid fa-magnifying-glass" />
                    <input type="text" placeholder={`Search ${typeConfig.label.toLowerCase()}…`} value={query} onChange={e => setQuery(e.target.value)} />
                    {query && <button className="admin-search-clear" onClick={() => setQuery('')}>×</button>}
                </div>
                <button type="button" className="add-point-btn" onClick={openAdd}>+ Add {typeLabelSingular}</button>
            </div>

            <div className="list-table finance-table">
                <div className="list-table-format title" style={{ gridTemplateColumns: gridCols }}>
                    <b>Name</b>
                    {extraCols.map(c => <b key={c.key}>{c.label}</b>)}
                    <b>Action</b>
                </div>
                {loading ? (
                    <div className="admin-empty-state"><p>Loading…</p></div>
                ) : visibleItems.length === 0 ? (
                    <div className="admin-empty-state"><p>{items.length === 0 ? `No ${typeConfig.label.toLowerCase()} yet.` : 'Nothing matches your search.'}</p></div>
                ) : (
                    visibleItems.map(item => (
                        <div key={item._id} className="list-table-format row-item" style={{ gridTemplateColumns: gridCols }}>
                            <p>{item.name}</p>
                            {extraCols.map(c => <p key={c.key}>{c.render(item)}</p>)}
                            <div className="action-buttons">
                                <p onClick={() => openEdit(item)} className="cursor edit-action">Edit</p>
                                <p onClick={() => setConfirmItem(item)} className="cursor delete-action">X</p>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {modalOpen && ReactDOM.createPortal(
                <div className="submit-loader-overlay" style={{ zIndex: 99999 }}>
                    <div className="loader-modal-box edit-modal">
                        <h2>{editingId ? 'Edit' : 'Add'} {typeLabelSingular}</h2>
                        <form onSubmit={submit}>
                            <div className="wizard-field-grid">
                                <div className="add-product-name flex-col wizard-field-full">
                                    <p>Name *</p>
                                    <input type="text" placeholder={`New ${typeLabelSingular.toLowerCase()} name`}
                                        value={form.name} onChange={e => setField('name', e.target.value)} autoFocus />
                                </div>
                                {typeConfig.hasCode && (
                                    <div className="add-product-name flex-col">
                                        <p>Code</p>
                                        <input type="text" placeholder="e.g. 194C-IND" value={form.code} onChange={e => setField('code', e.target.value)} />
                                    </div>
                                )}
                                {typeConfig.hasRate && (
                                    <div className="add-product-name flex-col">
                                        <p>Rate %</p>
                                        <input type="number" onWheel={e => e.target.blur()} min="0" step="any" value={form.rate} onChange={e => setField('rate', e.target.value)} />
                                    </div>
                                )}
                                {typeConfig.hasTdsSection && (
                                    <div className="add-product-name flex-col wizard-field-full">
                                        <p>TDS Section</p>
                                        <StyledSelect
                                            value={form.tdsSectionId} onChange={v => setField('tdsSectionId', v)} placeholder="No TDS"
                                            options={tdsSections.map(s => ({ value: s._id, label: `${s.name}${s.rate != null ? ` (${s.rate}%)` : ''}` }))}
                                        />
                                    </div>
                                )}
                            </div>
                            {typeConfig.hasTdsSection && (
                                <p className="admin-subtitle" style={{ margin: '-8px 0 12px' }}>
                                    When set, a Contractor/Labour payment for a Work of this type auto-suggests this section and calculates TDS from its rate. Leave as "No TDS" if this work type doesn't attract any.
                                </p>
                            )}

                            {typeConfig.hasDeductFlags && (
                                <>
                                    <p className="wizard-section-label">When a payment under this category is recorded</p>
                                    {/* Deliberately NOT .add-product-name — that class's own
                                        `> label` rule is styled for a real field label (tiny,
                                        uppercase, letter-spaced) and would otherwise catch
                                        ToggleSwitch's own <label> wrapper too, forcing "Cut
                                        from Client Bill" into that same micro-label look
                                        instead of reading as a switch's own name. */}
                                    <div className="settings-deduct-rule">
                                        <ToggleSwitch checked={form.deductFromClientBill} onChange={v => setField('deductFromClientBill', v)} label="Cut from Client Bill" />
                                        <p className="admin-subtitle settings-deduct-rule-note">
                                            Reduces this project's Outstanding balance by the amount paid — the client owes that much less.
                                        </p>
                                    </div>
                                    <div className="settings-deduct-rule">
                                        <ToggleSwitch checked={form.deductFromWorkerPayout} onChange={v => setField('deductFromWorkerPayout', v)} label="Cut from Contractor/Labour Payout" />
                                        <p className="admin-subtitle settings-deduct-rule-note">
                                            Reduces what the company still owes the specific contractor/labourer paid — turn this off for something like Ration, which isn't part of their earnings.
                                        </p>
                                    </div>
                                </>
                            )}

                            <div className="edit-modal-actions">
                                <button type="button" className="add-btn cancel-btn" onClick={closeModal}>Cancel</button>
                                <button type="submit" className="add-btn" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {confirmItem && ReactDOM.createPortal(
                <div className="bin-confirm-backdrop" onClick={() => !deleting && setConfirmItem(null)}>
                    <div className="bin-confirm-modal" onClick={e => e.stopPropagation()}>
                        <div className="bin-confirm-icon"><i className="fa-solid fa-triangle-exclamation" /></div>
                        <h3>Remove {typeLabelSingular}?</h3>
                        <p className="bin-confirm-name">"{confirmItem.name}"</p>
                        <p className="bin-confirm-warning">Moved to Recovery Bin.</p>
                        <div className="bin-confirm-actions">
                            <button className="bin-btn-cancel" onClick={() => setConfirmItem(null)} disabled={deleting}>Cancel</button>
                            <button className="bin-btn-delete" onClick={confirmDelete} disabled={deleting}>
                                {deleting ? 'Removing…' : 'Yes, Remove'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default SettingsCrudList;
