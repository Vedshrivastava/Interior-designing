import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons';
import { FINANCE_MASTERS } from '../../config/financeMasters';
import { emptyFormFromFields, renderMasterField, groupFieldsBySection, FieldNote, isFullWidthField, SectionLabel, RequiredMark } from './masterFieldRenderer';
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
 *
 * Field rendering mirrors AddLabourModal: groupFieldsBySection splits the
 * vendor resource's 11 fields into their tagged sections (Contact / Bank
 * Details / Other), still grouped into separate field grids so mobile
 * doesn't read as one undivided wall of fields — but only Bank Details
 * gets a visible wizard-section-label heading; Contact and Other read
 * fine without one (Contact is the form's first, self-evident group, and
 * Other is just the single Notes field), so those two are suppressed.
 *
 * ac-overlay/ac-modal are scoping hooks only, same pattern as
 * AddWorkModal's aw-overlay/aw-modal (dashboard.css) — mobile-only
 * bottom-sheet rules target these classes specifically, so no other
 * modal is touched. Header/body/footer are split into their own wrapper
 * divs so the sheet can scroll its fields while Cancel/Save stay pinned
 * at the bottom edge on mobile — Save is wired to the form via
 * form="add-contractor-form" since it now lives outside the <form>
 * itself. The per-section field groups stay in a bare Fragment (not
 * .ac-group) since wizard-section-label:not(:first-child) (wizard.css)
 * already gives each one its own 24px divider gap and depends on the
 * label being a direct child of the form to detect "not first" —
 * wrapping it would silently break that spacing (same reasoning as
 * AddLabourModal's own comment on this). .ac-group stays only around the
 * Documents list, which has no section tag of its own to hook into.
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
        e.stopPropagation();
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
        <div className="submit-loader-overlay ac-overlay" style={{ zIndex: 100000 }}>
            <div className="loader-modal-box edit-modal ac-modal">
                <div className="ac-modal-header">
                    <h2>Add Contractor</h2>
                    <p className="admin-subtitle" style={{ marginBottom: '16px' }}>
                        Added as a labour contractor vendor, scoped to this Work's Contractor(s) list.
                    </p>
                </div>

                <div className="ac-modal-body">
                    <form id="add-contractor-form" onSubmit={submit}>
                        {groupFieldsBySection(visibleFields.filter(f => !f.showIf || f.showIf(vendorForm))).map((group, gi) => (
                            <React.Fragment key={gi}>
                                {group.section && group.section !== 'Contact' && group.section !== 'Other' && <SectionLabel section={group.section} />}
                                <div className="wizard-field-grid">
                                    {group.fields.map(f => (
                                        <div key={f.key} className={`add-product-name flex-col${isFullWidthField(f, group) ? ' wizard-field-full' : ''}`}>
                                            <p>{f.label}{f.required && <RequiredMark />}</p>
                                            {renderMasterField(f, vendorForm, setVendorField, { url })}
                                            <FieldNote note={f.note} />
                                        </div>
                                    ))}
                                </div>
                            </React.Fragment>
                        ))}
                        <div className="ac-group">
                            <DocumentUploadList lines={documentLines} onChange={setDocumentLines} />
                        </div>
                    </form>
                </div>

                <div className="edit-modal-actions ac-modal-footer">
                    <button type="button" className="add-btn cancel-btn" onClick={onClose}>Cancel</button>
                    <button type="submit" form="add-contractor-form" className="add-btn" disabled={saving}>{saving ? 'Saving…' : <><FontAwesomeIcon icon={faCheck} className="pq-action-icon" /> Save</>}</button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default AddContractorModal;
