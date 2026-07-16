import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import QuickAddPicker from './QuickAddPicker';
import { FINANCE_MASTERS } from '../../config/financeMasters';
import { emptyFormFromFields, renderMasterField } from './masterFieldRenderer';

const CONTRACTOR_PRESET = { vendorType: 'labour_contractor' };

/*
 * A Work's contractor assignment / a Contractor Rate row can only ever
 * reference a financeVendor with vendorType 'labour_contractor' — that's
 * what drives the rate x area billing engine. Daily-wage labour has no
 * workId at all (deliberately — a labourer can help across several Works
 * in a day) and is paid per day, not by rate, so it structurally can't be
 * "assigned" the same way or shown in that picker's own dropdown.
 *
 * What CAN be unified is the "+ Add New" entry point: pick a type up
 * front, and the Labour branch does the whole add-a-crew-member task
 * right here (pick/create a Supervisor, see their roster, add a member)
 * instead of silently assuming Contractor. Only the Contractor branch
 * calls onContractorCreated — the Labour branch never feeds back into
 * whatever picker opened this, since there's nothing for it to select.
 */
const AddContractorOrLabourModal = ({ url, onClose, onContractorCreated }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const vendorResource = FINANCE_MASTERS.vendors;
    const visibleFields = vendorResource.fields.filter(f => !(f.key in CONTRACTOR_PRESET));

    const [type, setType] = useState('contractor');

    const [vendorForm, setVendorForm] = useState({ ...emptyFormFromFields(vendorResource.fields), ...CONTRACTOR_PRESET });
    const [savingVendor, setSavingVendor] = useState(false);

    const [supervisorId, setSupervisorId] = useState('');
    const [roster, setRoster] = useState([]);
    const [loadingRoster, setLoadingRoster] = useState(false);
    const [memberName, setMemberName] = useState('');
    const [memberRate, setMemberRate] = useState('');
    const [memberNotes, setMemberNotes] = useState('');
    const [savingMember, setSavingMember] = useState(false);

    const setVendorField = (key, value) => setVendorForm(prev => ({ ...prev, [key]: value }));

    const fetchRoster = (supId) => {
        setLoadingRoster(true);
        axios.get(`${url}/api/finance/labourers/list`, { ...authHeader, params: { supervisorId: supId } })
            .then(res => { if (res.data.success) setRoster(res.data.data); })
            .catch(() => {})
            .finally(() => setLoadingRoster(false));
    };

    useEffect(() => {
        if (supervisorId) fetchRoster(supervisorId); else setRoster([]);
    }, [supervisorId]); // eslint-disable-line react-hooks/exhaustive-deps

    const submitContractor = async (e) => {
        e.preventDefault();
        if (!String(vendorForm.name || '').trim()) return toast.error('Name is required');
        setSavingVendor(true);
        try {
            const res = await axios.post(`${url}/api/finance/vendors/add`, vendorForm, authHeader);
            if (res.data.success) {
                toast.success('Contractor added');
                onContractorCreated(res.data.data._id);
            } else toast.error(res.data.message);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error adding contractor');
        } finally { setSavingVendor(false); }
    };

    const addMember = async (e) => {
        e.preventDefault();
        if (!supervisorId) return toast.error('Select a supervisor first');
        if (!memberName.trim()) return toast.error('Name is required');
        setSavingMember(true);
        try {
            const res = await axios.post(`${url}/api/finance/labourers/add`, {
                supervisorId, name: memberName.trim(), defaultRate: memberRate || 0, notes: memberNotes,
            }, authHeader);
            if (res.data.success) {
                toast.success('Labourer added to roster');
                setMemberName(''); setMemberRate(''); setMemberNotes('');
                fetchRoster(supervisorId);
            } else toast.error(res.data.message);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error adding labourer');
        } finally { setSavingMember(false); }
    };

    return ReactDOM.createPortal(
        <div className="submit-loader-overlay" style={{ zIndex: 100000 }}>
            <div className="loader-modal-box edit-modal">
                <h2>Add Contractor or Labour</h2>

                <div className="add-cat-list" style={{ position: 'static', boxShadow: 'none', animation: 'none', display: 'flex', gap: '6px', marginBottom: '18px', padding: 0 }}>
                    <div
                        className={`add-cat-option${type === 'contractor' ? ' active' : ''}`}
                        style={{ flex: 1, justifyContent: 'center', border: '1px solid rgba(201,168,124,0.28)' }}
                        onClick={() => setType('contractor')}
                    >
                        <span>Contractor</span>
                    </div>
                    <div
                        className={`add-cat-option${type === 'labour' ? ' active' : ''}`}
                        style={{ flex: 1, justifyContent: 'center', border: '1px solid rgba(201,168,124,0.28)' }}
                        onClick={() => setType('labour')}
                    >
                        <span>Labour Crew</span>
                    </div>
                </div>

                {type === 'contractor' ? (
                    <form className="flex-col" onSubmit={submitContractor}>
                        {visibleFields.filter(f => !f.showIf || f.showIf(vendorForm)).map(f => (
                            <div key={f.key} className="add-product-name flex-col">
                                <p>{f.label}{f.required ? ' *' : ''}</p>
                                {renderMasterField(f, vendorForm, setVendorField, { url })}
                            </div>
                        ))}
                        <div className="edit-modal-actions">
                            <button type="button" className="add-btn cancel-btn" onClick={onClose}>Cancel</button>
                            <button type="submit" className="add-btn" disabled={savingVendor}>{savingVendor ? 'Saving…' : 'Save'}</button>
                        </div>
                    </form>
                ) : (
                    <div className="flex-col">
                        <p className="admin-subtitle" style={{ marginBottom: '16px' }}>
                            Casual daily-wage labour is paid per day via Daily Labour entries, not a rate — this crew won't need (or show up in) Contractor Rates.
                        </p>
                        <div className="add-product-name flex-col">
                            <p>Supervisor *</p>
                            <QuickAddPicker url={url} resourceKey="employees" value={supervisorId} onChange={setSupervisorId} placeholder="Select or add a supervisor…" />
                        </div>

                        {supervisorId && (
                            <>
                                <p style={{ fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.4px', textTransform: 'uppercase', color: 'var(--text-lt)', margin: '18px 0 8px' }}>
                                    Roster
                                </p>
                                {loadingRoster ? (
                                    <p className="admin-subtitle">Loading…</p>
                                ) : roster.length === 0 ? (
                                    <p className="admin-subtitle">No labourers under this supervisor yet.</p>
                                ) : (
                                    <ul style={{ margin: '0 0 12px', paddingLeft: '18px', fontSize: '0.85rem', color: 'var(--text-mid)' }}>
                                        {roster.map(l => (
                                            <li key={l._id}>{l.name}{l.defaultRate ? ` — ₹${l.defaultRate}/day` : ''}</li>
                                        ))}
                                    </ul>
                                )}
                                <form onSubmit={addMember}>
                                    <div className="wizard-field-grid">
                                        <div className="add-product-name flex-col">
                                            <p>Member Name *</p>
                                            <input type="text" value={memberName} onChange={e => setMemberName(e.target.value)} />
                                        </div>
                                        <div className="add-product-name flex-col">
                                            <p>Default Rate (₹/day)</p>
                                            <input type="number" value={memberRate} onChange={e => setMemberRate(e.target.value)} />
                                        </div>
                                        <div className="add-product-name flex-col wizard-field-full">
                                            <p>Notes</p>
                                            <input type="text" value={memberNotes} onChange={e => setMemberNotes(e.target.value)} />
                                        </div>
                                    </div>
                                    <div className="wizard-actions" style={{ marginTop: '12px' }}>
                                        <span />
                                        <button type="submit" className="add-btn" disabled={savingMember}>{savingMember ? 'Adding…' : '+ Add Member'}</button>
                                    </div>
                                </form>
                            </>
                        )}

                        <div className="edit-modal-actions" style={{ marginTop: '18px' }}>
                            <span />
                            <button type="button" className="add-btn" onClick={onClose}>Done</button>
                        </div>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};

export default AddContractorOrLabourModal;
