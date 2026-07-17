import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import '../../styles/wizard.css';

/*
 * Quick-add a labourer (financeLabourer — a plain, company-wide name, not
 * owned by any supervisor) from wherever a labour picker's "+ Add New" is
 * clicked. Single-purpose — see AddContractorModal for the contractor
 * equivalent. Which supervisor runs this person's crew is decided later,
 * when they're actually put on a Work's team, not here.
 */
const AddLabourModal = ({ url, onClose, onLabourerCreated }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [name, setName] = useState('');
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        if (!name.trim()) return toast.error('Name is required');
        setSaving(true);
        try {
            const res = await axios.post(`${url}/api/finance/labourers/add`, { name: name.trim(), notes }, authHeader);
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
                    Hired directly by the company, paid per sqft. Not owned by any supervisor — pick who runs their crew when you add them to a Work's team, and that can change project to project.
                </p>
                <form onSubmit={submit}>
                    <div className="wizard-field-grid">
                        <div className="add-product-name flex-col">
                            <p>Name *</p>
                            <input type="text" value={name} onChange={e => setName(e.target.value)} />
                        </div>
                        <div className="add-product-name flex-col wizard-field-full">
                            <p>Notes</p>
                            <input type="text" value={notes} onChange={e => setNotes(e.target.value)} />
                        </div>
                    </div>
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
