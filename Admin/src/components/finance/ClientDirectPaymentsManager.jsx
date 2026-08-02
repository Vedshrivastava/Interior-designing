import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash } from '@fortawesome/free-solid-svg-icons';
import StyledSelect from './StyledSelect';
import StyledDatePicker from './StyledDatePicker';
import { useFinanceWsRefresh } from '../../hooks/useFinanceWsRefresh';
import '../../styles/list.css';
import '../../styles/wizard.css';
import '../../styles/add.css';

const emptyForm = { projectId: '', workId: '', partyType: '', partyId: '', categoryId: '', amount: '', date: '', notes: '' };

/*
 * Records money the CLIENT paid directly to a contractor/labourer on-site,
 * bypassing the company — scoped to Project + Work, same granularity as
 * Deductions. The category (Masters → Direct Payment Categories) decides
 * the actual financial effect: every entry always reduces this project's
 * Outstanding balance (the client already paid this much toward the work),
 * and additionally reduces the party's own Balance Payable when the chosen
 * category's "Cut from Worker Payout" flag is set — see
 * Backend/controllers/financeClientDirectPayment.js for the math this feeds.
 */
const ClientDirectPaymentsManager = ({ url }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [projects, setProjects] = useState([]);
    const [projectsLoading, setProjectsLoading] = useState(true);
    const [works, setWorks] = useState([]);
    const [worksLoading, setWorksLoading] = useState(false);
    const [contractors, setContractors] = useState([]);
    const [labourers, setLabourers] = useState([]);
    const [partiesLoading, setPartiesLoading] = useState(false);
    const [categories, setCategories] = useState([]);
    const [categoriesLoading, setCategoriesLoading] = useState(true);
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [confirmItem, setConfirmItem] = useState(null);
    const [deleting, setDeleting] = useState(false);

    const fetchProjects = () => {
        axios.get(`${url}/api/finance/projects/list`, authHeader).then(res => { if (res.data.success) setProjects(res.data.data); }).catch(() => {}).finally(() => setProjectsLoading(false));
    };
    useEffect(fetchProjects, [url]); // eslint-disable-line react-hooks/exhaustive-deps
    useFinanceWsRefresh(['financeProjectsChanged'], fetchProjects);

    const fetchCategories = () => {
        axios.get(`${url}/api/finance/settings/list`, { ...authHeader, params: { settingType: 'direct_payment_category' } })
            .then(res => { if (res.data.success) setCategories(res.data.data); }).catch(() => {}).finally(() => setCategoriesLoading(false));
    };
    useEffect(fetchCategories, [url]); // eslint-disable-line react-hooks/exhaustive-deps
    useFinanceWsRefresh(['financeSettingsChanged'], fetchCategories);

    const fetchEntries = async () => {
        if (!form.projectId) { setEntries([]); setLoading(false); return; }
        setLoading(true);
        try {
            const res = await axios.get(`${url}/api/finance/client-direct-payments/list`, { ...authHeader, params: { projectId: form.projectId } });
            if (res.data.success) setEntries(res.data.data);
        } catch { toast.error('Error fetching client direct payments'); }
        finally { setLoading(false); }
    };
    useEffect(() => { fetchEntries(); }, [url, form.projectId]); // eslint-disable-line react-hooks/exhaustive-deps
    useFinanceWsRefresh(['clientDirectPaymentsChanged'], fetchEntries);

    // Work picker scoped to whichever project is picked — an entry only
    // ever makes sense pinned to a work within that same project.
    const fetchWorksForProject = () => {
        if (!form.projectId) { setWorks([]); return; }
        setWorksLoading(true);
        axios.get(`${url}/api/finance/works/list`, { ...authHeader, params: { projectId: form.projectId } })
            .then(res => { if (res.data.success) setWorks(res.data.data); }).catch(() => {}).finally(() => setWorksLoading(false));
    };
    useEffect(fetchWorksForProject, [url, form.projectId]); // eslint-disable-line react-hooks/exhaustive-deps
    useFinanceWsRefresh(['financeWorksChanged'], fetchWorksForProject);

    // Party picker scoped to whoever is actually assigned to the selected
    // Work — same two endpoints WorkDeductionAllocationPanel.jsx already
    // uses for the identical "who's really on this work" question.
    const fetchPartiesForWork = () => {
        if (!form.workId) { setContractors([]); setLabourers([]); return; }
        setPartiesLoading(true);
        Promise.all([
            axios.get(`${url}/api/finance/work-contractor-assignments/list`, { ...authHeader, params: { workId: form.workId } }),
            axios.get(`${url}/api/finance/work-labour-assignments/list`, { ...authHeader, params: { workId: form.workId } }),
        ]).then(([cRes, lRes]) => {
            setContractors(cRes.data.success ? cRes.data.data : []);
            setLabourers(lRes.data.success ? lRes.data.data : []);
        }).catch(() => {}).finally(() => setPartiesLoading(false));
    };
    useEffect(fetchPartiesForWork, [url, form.workId]); // eslint-disable-line react-hooks/exhaustive-deps

    const setField = (key, value) => setForm(prev => {
        const next = { ...prev, [key]: value };
        if (key === 'projectId') { next.workId = ''; next.partyType = ''; next.partyId = ''; }
        if (key === 'workId') { next.partyType = ''; next.partyId = ''; }
        if (key === 'partyType') next.partyId = '';
        return next;
    });

    const openModal = () => {
        setForm(prev => ({ ...emptyForm, projectId: prev.projectId }));
        setModalOpen(true);
    };

    const submit = async (e) => {
        e.preventDefault();
        if (!form.projectId) return toast.error('Project is required');
        if (!form.workId) return toast.error('Work is required');
        if (!form.partyType) return toast.error('Pick Contractor or Labour');
        if (!form.partyId) return toast.error('A contractor or labourer is required');
        if (!form.categoryId) return toast.error('Category is required');
        if (!form.amount || Number(form.amount) <= 0) return toast.error('Amount must be greater than zero');
        if (!form.date) return toast.error('Date is required');
        setSaving(true);
        try {
            const res = await axios.post(`${url}/api/finance/client-direct-payments/add`, form, authHeader);
            if (res.data.success) {
                toast.success(res.data.message);
                setModalOpen(false);
                await fetchEntries();
            } else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error recording client direct payment'); }
        finally { setSaving(false); }
    };

    const confirmDelete = async () => {
        if (!confirmItem) return;
        setDeleting(true);
        try {
            const res = await axios.delete(`${url}/api/finance/client-direct-payments/remove`, { ...authHeader, data: { _id: confirmItem._id } });
            if (res.data.success) { toast.success(res.data.message); setConfirmItem(null); await fetchEntries(); }
            else toast.error(res.data.message);
        } catch { toast.error('Error removing entry'); }
        finally { setDeleting(false); }
    };

    const projectOptions = projects.map(p => ({ value: p._id, label: p.name }));
    const workOptions = works.map(w => ({ value: w._id, label: w.workType }));
    const partyOptions = form.partyType === 'contractor'
        ? contractors.map(c => ({ value: c.contractorVendorId?._id || c.contractorVendorId, label: c.contractorVendorId?.name || '—' }))
        : labourers.map(l => ({ value: l.labourerId?._id || l.labourerId, label: l.labourerId?.name || '—' }));
    const categoryOptions = categories.map(c => ({ value: c._id, label: c.name }));
    const selectedCategory = categories.find(c => c._id === form.categoryId);

    return (
        <div>
            <div className="add-product-name flex-col" style={{ marginBottom: '20px', maxWidth: '480px' }}>
                <p>Project</p>
                <StyledSelect value={form.projectId} onChange={v => setField('projectId', v)} options={projectOptions} placeholder="Select project…" loading={projectsLoading} />
            </div>

            {!form.projectId ? (
                <div className="admin-empty-state"><p>Select a project to view its client direct payments.</p></div>
            ) : (
                <>
                    <div className="pq-section-header" style={{ marginBottom: '8px' }}>
                        <h3 style={{ margin: 0 }}>Client Direct Payments</h3>
                        <button type="button" className="add-btn" onClick={openModal}>+ Add Entry</button>
                    </div>
                    {loading ? (
                        <div className="admin-empty-state"><p>Loading…</p></div>
                    ) : entries.length === 0 ? (
                        <div className="admin-empty-state"><p>No client direct payments recorded yet for this project.</p></div>
                    ) : (
                        <div className="dash-chart-card cdp-card">
                            <div className="cdp-row cdp-header">
                                <b className="cdp-date">Date</b>
                                <b className="cdp-work">Work</b>
                                <b className="cdp-party">Party</b>
                                <b className="cdp-category">Category</b>
                                <b className="cdp-amount">Amount</b>
                                <b className="cdp-client">Cuts Client Bill?</b>
                                <b className="cdp-worker">Cuts Worker Pay?</b>
                                <b className="cdp-action">Action</b>
                            </div>
                            {entries.map(e => (
                                <div key={e._id} className="cdp-row">
                                    <p className="cdp-date">{new Date(e.date).toLocaleDateString()}</p>
                                    <p className="cdp-work"><span className="pq-group-label">Work</span>{e.workId?.workType || '-'}</p>
                                    <p className="cdp-party"><span className="pq-group-label">Party</span>{e.partyType === 'contractor' ? 'Contractor' : 'Labour'}</p>
                                    <p className="cdp-category"><span className="pq-group-label">Category</span>{e.categoryId?.name || '-'}</p>
                                    <p className="cdp-amount"><span className="pq-group-label">Amount</span>₹{e.amount.toLocaleString('en-IN')}</p>
                                    <p className="cdp-client"><span className="pq-group-label">Cuts Client Bill?</span>{e.categoryId?.deductFromClientBill ? 'Yes' : 'No'}</p>
                                    <p className="cdp-worker"><span className="pq-group-label">Cuts Worker Pay?</span>{e.categoryId?.deductFromWorkerPayout ? 'Yes' : 'No'}</p>
                                    <div className="cdp-action">
                                        <button type="button" className="pq-btn-ghost-danger" onClick={() => setConfirmItem(e)} title="Remove entry" aria-label="Remove entry">
                                            <FontAwesomeIcon icon={faTrash} className="pq-action-icon" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {modalOpen && ReactDOM.createPortal(
                <div className="submit-loader-overlay cdp-overlay" style={{ zIndex: 99999 }}>
                    <div className="loader-modal-box edit-modal cdp-modal">
                        <div className="cdp-modal-header">
                            <h2>Add Client Direct Payment</h2>
                        </div>
                        <div className="cdp-modal-body">
                            <form id="cdp-form" onSubmit={submit}>
                                <p className="wizard-section-label">Who Was Paid</p>
                                <div className="wizard-field-grid">
                                    <div className="add-product-name flex-col">
                                        <p>Work *</p>
                                        <StyledSelect value={form.workId} onChange={v => setField('workId', v)} options={workOptions} placeholder="Select work…" loading={worksLoading} />
                                    </div>
                                    <div className="add-product-name flex-col">
                                        <p>Party Type *</p>
                                        <StyledSelect value={form.partyType} onChange={v => setField('partyType', v)}
                                            options={[{ value: 'contractor', label: 'Contractor' }, { value: 'labour', label: 'Labour' }]}
                                            placeholder="Contractor or Labour…" disabled={!form.workId} />
                                    </div>
                                    <div className="add-product-name flex-col wizard-field-full">
                                        <p>{form.partyType === 'labour' ? 'Labourer *' : form.partyType === 'contractor' ? 'Contractor *' : 'Contractor/Labourer *'}</p>
                                        <StyledSelect value={form.partyId} onChange={v => setField('partyId', v)} options={partyOptions}
                                            placeholder="Select…" disabled={!form.partyType} loading={partiesLoading} />
                                    </div>
                                </div>

                                <p className="wizard-section-label">What &amp; How Much</p>
                                <div className="wizard-field-grid">
                                    <div className="add-product-name flex-col">
                                        <p>Category *</p>
                                        <StyledSelect value={form.categoryId} onChange={v => setField('categoryId', v)} options={categoryOptions} placeholder="Select category…" loading={categoriesLoading} />
                                    </div>
                                    <div className="add-product-name flex-col">
                                        <p>Amount (₹) *</p>
                                        <input type="number" onWheel={e => e.target.blur()} min="0" step="any" value={form.amount} onChange={e => setField('amount', e.target.value)} />
                                    </div>
                                </div>

                                {selectedCategory && (
                                    <div className="wizard-advance-summary">
                                        <p className="admin-subtitle">This will record</p>
                                        <p className="wizard-advance-amount">{form.amount ? `₹${Number(form.amount).toLocaleString('en-IN')}` : '₹0'}</p>
                                        <div style={{ display: 'flex', gap: '24px', marginTop: '12px' }}>
                                            <p style={{ margin: 0, fontSize: '0.82rem', color: selectedCategory.deductFromClientBill ? 'var(--moss)' : 'var(--text-lt)' }}>
                                                {selectedCategory.deductFromClientBill ? '✓' : '✕'} Reduces Client Bill
                                            </p>
                                            <p style={{ margin: 0, fontSize: '0.82rem', color: selectedCategory.deductFromWorkerPayout ? '#c0392b' : 'var(--text-lt)' }}>
                                                {selectedCategory.deductFromWorkerPayout ? '✓' : '✕'} Reduces {form.partyType === 'labour' ? 'Labourer' : 'Contractor'} Payout
                                            </p>
                                        </div>
                                    </div>
                                )}

                                <p className="wizard-section-label">When</p>
                                <div className="wizard-field-grid">
                                    <div className="add-product-name flex-col">
                                        <p>Date *</p>
                                        <StyledDatePicker value={form.date} onChange={v => setField('date', v)} />
                                    </div>
                                    <div className="add-product-name flex-col">
                                        <p>Notes</p>
                                        <input type="text" value={form.notes} onChange={e => setField('notes', e.target.value)} />
                                    </div>
                                </div>
                            </form>
                        </div>

                        <div className="edit-modal-actions cdp-modal-footer">
                            <button type="button" className="add-btn cancel-btn" onClick={() => setModalOpen(false)}>Cancel</button>
                            <button type="submit" form="cdp-form" className="add-btn" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {confirmItem && ReactDOM.createPortal(
                <div className="bin-confirm-backdrop" onClick={() => !deleting && setConfirmItem(null)}>
                    <div className="bin-confirm-modal" onClick={e => e.stopPropagation()}>
                        <div className="bin-confirm-icon"><i className="fa-solid fa-triangle-exclamation" /></div>
                        <h3>Remove this entry?</h3>
                        <p className="bin-confirm-warning">Moved to Recovery Bin.</p>
                        <div className="bin-confirm-actions">
                            <button className="bin-btn-cancel" onClick={() => setConfirmItem(null)} disabled={deleting}>Cancel</button>
                            <button className="bin-btn-delete" onClick={confirmDelete} disabled={deleting}>{deleting ? 'Removing…' : 'Yes, Remove'}</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default ClientDirectPaymentsManager;
