import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { FINANCE_MASTERS } from '../../config/financeMasters';
import { emptyFormFromFields, renderMasterField, groupFieldsBySection, FieldNote } from './masterFieldRenderer';
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
 *
 * al-overlay/al-modal are scoping hooks only, same pattern as
 * AddWorkModal's aw-overlay/aw-modal (dashboard.css) — mobile-only
 * bottom-sheet rules target these classes specifically, so no other
 * modal is touched. Header/body/footer are split into their own wrapper
 * divs so the sheet can scroll its fields while Cancel/Save stay pinned
 * at the bottom edge on mobile — Save is wired to the form via
 * form="add-labour-form" since it now lives outside the <form> itself.
 * The Documents list is wrapped in .al-group purely as a styling hook
 * for a mobile-only section divider above it; the per-section field
 * groups above stay in a bare Fragment (not .al-group) since
 * .wizard-section-label:not(:first-child) (wizard.css) already gives
 * each one its own 24px divider gap and depends on the label being a
 * direct child of the form to detect "not first" — wrapping it would
 * silently break that spacing.
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
        <div className="submit-loader-overlay al-overlay" style={{ zIndex: 100000 }}>
            <div className="loader-modal-box edit-modal al-modal">
                <div className="al-modal-header">
                    <h2>Add Labourer</h2>
                    <p className="admin-subtitle" style={{ marginBottom: '16px' }}>
                        Hired directly by the company, paid per sqft. Not owned by any supervisor; pick who runs their crew when you add them to a Work's team, and that can change project to project.
                    </p>
                </div>

                <div className="al-modal-body">
                    <form id="add-labour-form" onSubmit={submit}>
                        {groupFieldsBySection(labourerResource.fields.filter(f => !f.showIf || f.showIf(form))).map((group, gi) => (
                            <React.Fragment key={gi}>
                                {group.section && <p className="wizard-section-label">{group.section}</p>}
                                <div className="wizard-field-grid">
                                    {group.fields.map(f => (
                                        <div key={f.key} className={`add-product-name flex-col${f.type === 'textarea' ? ' wizard-field-full' : ''}`}>
                                            <p>{f.label}{f.required ? ' *' : ''}</p>
                                            {renderMasterField(f, form, setField, { url })}
                                            <FieldNote note={f.note} />
                                        </div>
                                    ))}
                                </div>
                            </React.Fragment>
                        ))}
                        <div className="al-group">
                            <DocumentUploadList lines={documentLines} onChange={setDocumentLines} />
                        </div>
                    </form>
                </div>

                <div className="edit-modal-actions al-modal-footer">
                    <button type="button" className="add-btn cancel-btn" onClick={onClose}>Cancel</button>
                    <button type="submit" form="add-labour-form" className="add-btn" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default AddLabourModal;
