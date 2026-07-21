import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { FINANCE_MASTERS } from '../../config/financeMasters';
import { emptyFormFromFields, renderMasterField, groupFieldsBySection, FieldNote } from './masterFieldRenderer';
import { registerSettingIfNew } from './SettingSelectField';
import StyledSelect from './StyledSelect';
import '../../styles/list.css';
import '../../styles/wizard.css';

/*
 * Reusable "search or create" control for entity references (Client,
 * Vendor, Team, Employee) — a plain select backed by FINANCE_MASTERS'
 * existing minimal-field config, plus a "+ Add New" that opens the same
 * inline-modal shape MasterCrudTable already uses, auto-selecting the new
 * record on save instead of navigating away to Masters.
 *
 * `presetValues` (optional): fields silently set on the quick-add form and
 * hidden from it — e.g. { vendorType: 'labour_contractor' } from the
 * Contractors picker, so the new vendor immediately satisfies whatever
 * `filter` this same picker applies to its dropdown.
 */
const QuickAddPicker = ({ url, resourceKey, value, onChange, filter, presetValues = {}, placeholder, disabled }) => {
    const resource = FINANCE_MASTERS[resourceKey];
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [list, setList] = useState([]);
    const [modalOpen, setModalOpen] = useState(false);
    const [form, setForm] = useState({ ...emptyFormFromFields(resource.fields), ...presetValues });
    const [settingOptions, setSettingOptions] = useState({});
    const [saving, setSaving] = useState(false);

    const settingSelectFields = resource.fields.filter(f => f.type === 'settingSelect');
    // Also covers workTypeMultiSelect — same options-fetch, just no
    // register-if-new on submit (that stays scoped to settingSelectFields).
    const settingFetchFields = resource.fields.filter(f => f.settingType);
    const visibleFields = resource.fields.filter(f => !(f.key in presetValues));

    const fetchList = async () => {
        try {
            const res = await axios.get(`${url}${resource.apiBase}/list`, authHeader);
            if (res.data.success) setList(res.data.data);
        } catch { /* dropdown just stays empty */ }
    };

    useEffect(() => { fetchList(); }, [url, resourceKey]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        settingFetchFields.forEach(f => {
            axios.get(`${url}/api/finance/settings/list`, { ...authHeader, params: { settingType: f.settingType } })
                .then(res => { if (res.data.success) setSettingOptions(prev => ({ ...prev, [f.settingType]: res.data.data })); })
                .catch(() => {});
        });
    }, [url, resourceKey]); // eslint-disable-line react-hooks/exhaustive-deps

    const setField = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

    const openAdd = () => { setForm({ ...emptyFormFromFields(resource.fields), ...presetValues }); setModalOpen(true); };
    const closeModal = () => setModalOpen(false);

    const submit = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const requiredField = resource.fields.find(f => f.required && !String(form[f.key] || '').trim());
        if (requiredField) { toast.error(`${requiredField.label} is required`); return; }
        const mismatchField = resource.fields.find(f => f.type === 'confirmText' && form[f.key] !== form[f.matchKey]);
        if (mismatchField) { toast.error(`${mismatchField.label} doesn't match`); return; }

        setSaving(true);
        try {
            const res = await axios.post(`${url}${resource.apiBase}/add`, form, authHeader);
            if (res.data.success) {
                toast.success(res.data.message || `${resource.label} added`);
                await Promise.all(settingSelectFields.map(f =>
                    registerSettingIfNew(url, authHeader, f.settingType, form[f.key], settingOptions[f.settingType] || [])
                ));
                await fetchList();
                onChange(res.data.data._id);
                closeModal();
            } else {
                toast.error(res.data.message);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || `Error adding ${resource.label.toLowerCase()}`);
        } finally {
            setSaving(false);
        }
    };

    const displayList = filter ? list.filter(filter) : list;

    return (
        <>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                    <StyledSelect
                        value={value} onChange={onChange} disabled={disabled}
                        placeholder={placeholder || `Select ${resource.label.toLowerCase()}…`}
                        options={displayList.map(item => ({ value: item._id, label: item.name }))}
                    />
                </div>
                <button type="button" className="add-point-btn" style={{ whiteSpace: 'nowrap' }} onClick={openAdd} disabled={disabled}>+ Add New</button>
            </div>

            {modalOpen && ReactDOM.createPortal(
                <div className="submit-loader-overlay" style={{ zIndex: 100000 }}>
                    <div className="loader-modal-box edit-modal">
                        <h2>Add {resource.label}</h2>
                        <form onSubmit={submit}>
                            {groupFieldsBySection(visibleFields.filter(f => !f.showIf || f.showIf(form))).map((group, gi) => (
                                <React.Fragment key={gi}>
                                    {group.section && <p className="wizard-section-label">{group.section}</p>}
                                    <div className="wizard-field-grid">
                                        {group.fields.map(f => (
                                            <div key={f.key} className={`add-product-name flex-col${f.type === 'textarea' ? ' wizard-field-full' : ''}`}>
                                                <p>{f.label}{f.required ? ' *' : ''}</p>
                                                {renderMasterField(f, form, setField, { url, settingOptions })}
                                                <FieldNote note={f.note} />
                                            </div>
                                        ))}
                                    </div>
                                </React.Fragment>
                            ))}
                            <div className="edit-modal-actions">
                                <button type="button" className="add-btn cancel-btn" onClick={closeModal}>Cancel</button>
                                <button type="submit" className="add-btn" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};

export default QuickAddPicker;
