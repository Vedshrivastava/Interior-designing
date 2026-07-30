import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons';
import StyledDatePicker from './StyledDatePicker';

const emptyForm = { date: '', amount: '', notes: '' };

/*
 * Add Quotation dialog — same "+ Add" button -> modal pattern as Add
 * Measurement/Add Movement. The file is optional; when chosen it uploads
 * through financeProjectDocument right after the quotation itself is
 * created (same two-call sequence the row-level Upload action already
 * used) — kept as a second call rather than a combined endpoint so the
 * quotation still gets saved even if the file upload fails.
 */
const AddQuotationModal = ({ url, projectId, onClose, onSaved }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [form, setForm] = useState(emptyForm);
    const [file, setFile] = useState(null);
    const [saving, setSaving] = useState(false);

    const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

    const submit = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!form.date) return toast.error('Date is required');
        if (form.amount === '') return toast.error('Amount is required');

        setSaving(true);
        try {
            const res = await axios.post(`${url}/api/finance/client-quotations/add`,
                { projectId, date: form.date, amount: form.amount, notes: form.notes }, authHeader);
            if (!res.data.success) { toast.error(res.data.message); return; }

            const quotation = res.data.data;
            if (file) {
                const formData = new FormData();
                formData.append('projectId', projectId);
                formData.append('quotationId', quotation._id);
                formData.append('name', `Quotation #${quotation.quotationNumber}`);
                formData.append('file', file);
                const uploadRes = await axios.post(`${url}/api/finance/project-documents/add`, formData, {
                    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
                });
                if (!uploadRes.data.success) toast.error(uploadRes.data.message || 'Quotation added, but file upload failed');
            }

            toast.success('Quotation added');
            onSaved?.();
            onClose();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error adding quotation');
        } finally { setSaving(false); }
    };

    return ReactDOM.createPortal(
        // aq-overlay/aq-modal are scoping hooks only — every other class here
        // (submit-loader-overlay/loader-modal-box/edit-modal/etc.) is the same
        // shared chrome every other modal in this app uses. The mobile-only
        // bottom-sheet rules in dashboard.css target .aq-overlay/.aq-modal
        // specifically (mirrors the frontend's Consult modal — anchored to
        // the bottom edge, full width, top corners only, slides up), so no
        // other modal — and no view of this one above 540px — is touched.
        <div className="submit-loader-overlay aq-overlay" style={{ zIndex: 100000 }}>
            <div className="loader-modal-box edit-modal aq-modal">
                <h2>Add Quotation</h2>
                <form onSubmit={submit}>
                    <div className="wizard-field-grid">
                        <div className="add-product-name flex-col">
                            <p>Date *</p>
                            <StyledDatePicker value={form.date} onChange={v => setField('date', v)} />
                        </div>
                        <div className="add-product-name flex-col">
                            <p>Amount (₹) *</p>
                            <input type="number" inputMode="decimal" onWheel={e => e.target.blur()} min="0" step="any" value={form.amount} onChange={e => setField('amount', e.target.value)} />
                        </div>
                        <div className="add-product-name flex-col wizard-field-full">
                            <p>Notes</p>
                            <input type="text" value={form.notes} onChange={e => setField('notes', e.target.value)} />
                        </div>
                        <div className="add-product-name flex-col wizard-field-full">
                            <p>Quotation File (optional)</p>
                            <input type="file" onChange={e => setFile(e.target.files[0] || null)} />
                        </div>
                    </div>
                    <div className="edit-modal-actions">
                        <button type="button" className="add-btn cancel-btn" onClick={onClose}>Cancel</button>
                        <button type="submit" className="add-btn" disabled={saving}>{saving ? 'Saving…' : <><FontAwesomeIcon icon={faCheck} className="pq-action-icon" /> Save Quotation</>}</button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
};

export default AddQuotationModal;
