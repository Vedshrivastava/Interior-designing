import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { FINANCE_MASTERS } from '../../config/financeMasters';
import { emptyFormFromFields, renderMasterField, groupFieldsBySection } from './masterFieldRenderer';
import DocumentUploadList from './DocumentUploadList';
import '../../styles/wizard.css';

/*
 * Quick-add a labourer (financeLabourer — a plain, company-wide name, not
 * owned by any supervisor) from wherever a labour picker's "+ Add New" is
 * clicked. Single-purpose — see AddContractorModal for the contractor
 * equivalent, and the reason this now shares its field config with
 * Masters > Labourers instead of its own hand-picked list: an earlier
 * version only collected Name + Notes, silently missing the bank details
 * financeLabourer has actually required since — every submit failed with
 * "Bank account holder name, bank name, account number, and IFSC code are
 * all required" and no way to see why from this modal. Driving off the
 * same FINANCE_MASTERS.labourers.fields MasterCrudTable itself uses means
 * this can't go stale like that again.
 */
const AddLabourModal = ({ url, onClose, onLabourerCreated }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const labourerResource = FINANCE_MASTERS.labourers;

    const [form, setForm] = useState(emptyFormFromFields(labourerResource.fields));
    const [documentLines, setDocumentLines] = useState([]);
    const [saving, setSaving] = useState(false);

    const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

    const submit = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const requiredField = labourerResource.fields.find(f => f.required && !String(form[f.key] || '').trim());
        if (requiredField) return toast.error(`${requiredField.label} is required`);
        const mismatchField = labourerResource.fields.find(f => f.type === 'confirmText' && form[f.key] !== form[f.matchKey]);
        if (mismatchField) return toast.error(`${mismatchField.label} doesn't match`);

        setSaving(true);
        try {
            const validDocs = documentLines.filter(l => l.file);
            const data = new FormData();
            Object.entries(form).forEach(([key, value]) => data.append(key, value ?? ''));
            data.append('documentNotes', JSON.stringify(validDocs.map(l => l.note)));
            validDocs.forEach(l => data.append('documents', l.file));

            const res = await axios.post(`${url}/api/finance/labourers/add`, data, {
                headers: { ...authHeader.headers, 'Content-Type': 'multipart/form-data' },
            });
            if (res.data.success) {
                toast.success('Labourer added');
                onLabourerCreated?.(res.data.data._id);
            } else toast.error(res.data.message);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error adding labourer');
        } finally { setSaving(false); }
    };

    return ReactDOM.createPortal(
        <div className="submit-loader-overlay" style={{ zIndex: 100000 }}>
            <div className="loader-modal-box edit-modal">
                <h2>Add Labourer</h2>
                <p className="admin-subtitle" style={{ marginBottom: '16px' }}>
                    Hired directly by the company, paid per sqft. Not owned by any supervisor; pick who runs their crew when you add them to a Work's team, and that can change project to project.
                </p>
                <form onSubmit={submit}>
                    {groupFieldsBySection(labourerResource.fields).map((group, gi) => (
                        <React.Fragment key={gi}>
                            {group.section && <p className="wizard-section-label">{group.section}</p>}
                            <div className="wizard-field-grid">
                                {group.fields.map(f => (
                                    <div key={f.key} className={`add-product-name flex-col${f.type === 'textarea' ? ' wizard-field-full' : ''}`}>
                                        <p>{f.label}{f.required ? ' *' : ''}</p>
                                        {renderMasterField(f, form, setField, { url })}
                                    </div>
                                ))}
                            </div>
                        </React.Fragment>
                    ))}
                    <DocumentUploadList lines={documentLines} onChange={setDocumentLines} />
                    <div className="edit-modal-actions" style={{ marginTop: '16px' }}>
                        <button type="button" className="add-btn cancel-btn" onClick={onClose}>Cancel</button>
                        <button type="submit" className="add-btn" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
};

export default AddLabourModal;
