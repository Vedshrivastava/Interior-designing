import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { FINANCE_MASTERS } from '../../config/financeMasters';
import { emptyFormFromFields, renderMasterField } from './masterFieldRenderer';
import DocumentUploadList from './DocumentUploadList';
import '../../styles/wizard.css';

const CONTRACTOR_PRESET = { vendorType: 'labour_contractor' };

/*
 * Quick-add a labour contractor (financeVendor, vendorType preset to
 * 'labour_contractor') from wherever a contractor picker's "+ Add New" is
 * clicked. Single-purpose — see AddLabourModal for the labour equivalent;
 * the two used to be one combined modal with a type toggle, but every
 * caller already knows which type it wants (the Add Work form has
 * separate Contractor(s) and Labour Team sections), so the toggle was
 * just an extra click to the same place.
 */
const AddContractorModal = ({ url, onClose, onContractorCreated }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const vendorResource = FINANCE_MASTERS.vendors;
    const visibleFields = vendorResource.fields.filter(f => !(f.key in CONTRACTOR_PRESET));

    const [vendorForm, setVendorForm] = useState({ ...emptyFormFromFields(vendorResource.fields), ...CONTRACTOR_PRESET });
    const [documentLines, setDocumentLines] = useState([]);
    const [saving, setSaving] = useState(false);

    const setVendorField = (key, value) => setVendorForm(prev => ({ ...prev, [key]: value }));

    const submit = async (e) => {
        e.preventDefault();
        if (!String(vendorForm.name || '').trim()) return toast.error('Name is required');
        setSaving(true);
        try {
            const validDocs = documentLines.filter(l => l.file);
            const data = new FormData();
            Object.entries(vendorForm).forEach(([key, value]) => data.append(key, value ?? ''));
            data.append('documentNotes', JSON.stringify(validDocs.map(l => l.note)));
            validDocs.forEach(l => data.append('documents', l.file));

            const res = await axios.post(`${url}/api/finance/vendors/add`, data, {
                headers: { ...authHeader.headers, 'Content-Type': 'multipart/form-data' },
            });
            if (res.data.success) {
                toast.success('Contractor added');
                onContractorCreated(res.data.data._id);
            } else toast.error(res.data.message);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error adding contractor');
        } finally { setSaving(false); }
    };

    return ReactDOM.createPortal(
        <div className="submit-loader-overlay" style={{ zIndex: 100000 }}>
            <div className="loader-modal-box edit-modal">
                <h2>Add Contractor</h2>
                <p className="admin-subtitle" style={{ marginBottom: '16px' }}>
                    Added as a labour contractor vendor, scoped to this Work's Contractor(s) list.
                </p>
                <form onSubmit={submit}>
                    <div className="wizard-field-grid">
                        {visibleFields.filter(f => !f.showIf || f.showIf(vendorForm)).map(f => (
                            <div key={f.key} className={`add-product-name flex-col${f.type === 'textarea' ? ' wizard-field-full' : ''}`}>
                                <p>{f.label}{f.required ? ' *' : ''}</p>
                                {renderMasterField(f, vendorForm, setVendorField, { url })}
                            </div>
                        ))}
                    </div>
                    <DocumentUploadList lines={documentLines} onChange={setDocumentLines} />
                    <div className="edit-modal-actions">
                        <button type="button" className="add-btn cancel-btn" onClick={onClose}>Cancel</button>
                        <button type="submit" className="add-btn" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
};

export default AddContractorModal;
