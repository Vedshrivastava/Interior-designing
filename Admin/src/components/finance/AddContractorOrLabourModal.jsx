import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { FINANCE_MASTERS } from '../../config/financeMasters';
import { emptyFormFromFields, renderMasterField } from './masterFieldRenderer';

const CONTRACTOR_PRESET = { vendorType: 'labour_contractor' };

/*
 * Both branches create a real, individually assignable, individually
 * rated entity — a financeVendor (contractor) or a financeLabourer (hired
 * directly, paid per sqft via financeLabourRate). Pick a type up front.
 * A labourer is a plain, company-wide name here — not owned by any
 * supervisor; which supervisor runs their crew is decided fresh each time
 * they're put on a Work's team (see WorksManager's team-assignment
 * modal), not at creation time. Feeds the new id back via
 * onLabourerCreated / onContractorCreated so whichever picker opened this
 * can select it immediately.
 */
const AddContractorOrLabourModal = ({ url, onClose, onContractorCreated, onLabourerCreated, initialType = 'contractor' }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const vendorResource = FINANCE_MASTERS.vendors;
    const visibleFields = vendorResource.fields.filter(f => !(f.key in CONTRACTOR_PRESET));

    const [type, setType] = useState(initialType);

    const [vendorForm, setVendorForm] = useState({ ...emptyFormFromFields(vendorResource.fields), ...CONTRACTOR_PRESET });
    const [savingVendor, setSavingVendor] = useState(false);

    const [memberName, setMemberName] = useState('');
    const [memberNotes, setMemberNotes] = useState('');
    const [savingMember, setSavingMember] = useState(false);

    const setVendorField = (key, value) => setVendorForm(prev => ({ ...prev, [key]: value }));

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
        if (!memberName.trim()) return toast.error('Name is required');
        setSavingMember(true);
        try {
            const res = await axios.post(`${url}/api/finance/labourers/add`, {
                name: memberName.trim(), notes: memberNotes,
            }, authHeader);
            if (res.data.success) {
                toast.success('Labourer added');
                setMemberName(''); setMemberNotes('');
                onLabourerCreated?.(res.data.data._id);
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
                        <span>Labour</span>
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
                            Hired directly by the company, paid per sqft. Not owned by any supervisor — pick who runs their crew when you add them to a Work's team, and that can change project to project.
                        </p>
                        <form onSubmit={addMember}>
                            <div className="wizard-field-grid">
                                <div className="add-product-name flex-col">
                                    <p>Name *</p>
                                    <input type="text" value={memberName} onChange={e => setMemberName(e.target.value)} />
                                </div>
                                <div className="add-product-name flex-col wizard-field-full">
                                    <p>Notes</p>
                                    <input type="text" value={memberNotes} onChange={e => setMemberNotes(e.target.value)} />
                                </div>
                            </div>
                            <div className="edit-modal-actions" style={{ marginTop: '16px' }}>
                                <button type="button" className="add-btn cancel-btn" onClick={onClose}>Cancel</button>
                                <button type="submit" className="add-btn" disabled={savingMember}>{savingMember ? 'Saving…' : 'Save'}</button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};

export default AddContractorOrLabourModal;
