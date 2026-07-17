import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useFinanceWsRefresh } from '../../hooks/useFinanceWsRefresh';
import '../../styles/list.css';
import '../../styles/wizard.css';
import '../../styles/add.css';

const emptyContractorForm = { workId: '', vendorId: '', areaSqft: '', reason: '', date: '' };
const emptyLabourForm = { workId: '', labourerId: '', areaSqft: '', reason: '', date: '' };
const emptySupervisorForm = { workId: '', employeeId: '', amount: '', reason: '', date: '' };

/*
 * Reconciles the gap between what got logged and what actually made it
 * into an issued bill (Total − Approved = Unapproved, computed everywhere
 * else in Payables/Ledgers) — for one project's one work type at a time,
 * since a Putty rate and a Paint rate aren't comparable. "Who's at fault"
 * is never automatic ("everyone has different shares of mistakes"), so an
 * admin manually allocates sqft of the shortfall to whichever specific
 * contractor/labourer is responsible; the ₹ amount is always derived from
 * that party's own configured rate, never typed directly. Supervisors
 * don't measure area, so their side stays a plain ₹ amount.
 */
const DeductionPanel = ({ url }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [projects, setProjects] = useState([]);
    const [projectId, setProjectId] = useState('');
    const [works, setWorks] = useState([]);
    const [workType, setWorkType] = useState('');
    const [pool, setPool] = useState(null);
    const [loading, setLoading] = useState(false);
    const [employees, setEmployees] = useState([]);

    const [contractorForm, setContractorForm] = useState(emptyContractorForm);
    const [labourForm, setLabourForm] = useState(emptyLabourForm);
    const [supervisorForm, setSupervisorForm] = useState(emptySupervisorForm);
    const [saving, setSaving] = useState('');

    useEffect(() => {
        axios.get(`${url}/api/finance/projects/list`, authHeader).then(res => { if (res.data.success) setProjects(res.data.data); }).catch(() => {});
        axios.get(`${url}/api/finance/employees/list`, authHeader).then(res => { if (res.data.success) setEmployees(res.data.data); }).catch(() => {});
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    // Work Type options come from this project's own works — no reason to
    // offer a type this project doesn't have.
    useEffect(() => {
        setWorkType(''); setWorks([]); setPool(null);
        if (!projectId) return;
        axios.get(`${url}/api/finance/works/list`, { ...authHeader, params: { projectId } })
            .then(res => { if (res.data.success) setWorks(res.data.data); }).catch(() => {});
    }, [url, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

    const fetchPool = () => {
        if (!projectId || !workType) { setPool(null); return; }
        setLoading(true);
        axios.get(`${url}/api/finance/reports/deduction-pool`, { ...authHeader, params: { projectId, workType } })
            .then(res => { if (res.data.success) setPool(res.data.data); })
            .catch(() => toast.error('Error fetching deduction pool'))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        setContractorForm(emptyContractorForm); setLabourForm(emptyLabourForm); setSupervisorForm(emptySupervisorForm);
        fetchPool();
    }, [url, projectId, workType]); // eslint-disable-line react-hooks/exhaustive-deps

    useFinanceWsRefresh(['financeContractorLedgerChanged', 'financeLabourLedgerChanged', 'financeRunningBillsChanged', 'financeWorksChanged'], fetchPool);

    const workTypes = [...new Set(works.map(w => w.workType))];
    const contractorWorks = (pool?.works || []).filter(w => w.contractors.length > 0);
    const labourWorks = (pool?.works || []).filter(w => w.labourers.length > 0);

    const submitContractor = async (e) => {
        e.preventDefault();
        if (!contractorForm.workId || !contractorForm.vendorId) return toast.error('Work and Vendor are required');
        if (!contractorForm.areaSqft || Number(contractorForm.areaSqft) <= 0) return toast.error('Sqft to deduct must be greater than zero');
        if (!contractorForm.reason.trim()) return toast.error('Reason is required');
        if (!contractorForm.date) return toast.error('Date is required');
        setSaving('contractor');
        try {
            const res = await axios.post(`${url}/api/finance/contractor-deductions/add`, contractorForm, authHeader);
            if (res.data.success) { toast.success(res.data.message); setContractorForm(emptyContractorForm); fetchPool(); }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error recording deduction'); }
        finally { setSaving(''); }
    };

    const submitLabour = async (e) => {
        e.preventDefault();
        if (!labourForm.workId || !labourForm.labourerId) return toast.error('Work and Labourer are required');
        if (!labourForm.areaSqft || Number(labourForm.areaSqft) <= 0) return toast.error('Sqft to deduct must be greater than zero');
        if (!labourForm.reason.trim()) return toast.error('Reason is required');
        if (!labourForm.date) return toast.error('Date is required');
        setSaving('labour');
        try {
            const res = await axios.post(`${url}/api/finance/labour-deductions/add`, { ...labourForm, source: 'engineer_review' }, authHeader);
            if (res.data.success) { toast.success(res.data.message); setLabourForm(emptyLabourForm); fetchPool(); }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error recording deduction'); }
        finally { setSaving(''); }
    };

    const submitSupervisor = async (e) => {
        e.preventDefault();
        if (!supervisorForm.employeeId) return toast.error('Supervisor is required');
        if (!supervisorForm.amount || Number(supervisorForm.amount) <= 0) return toast.error('Amount must be greater than zero');
        if (!supervisorForm.reason.trim()) return toast.error('Reason is required');
        if (!supervisorForm.date) return toast.error('Date is required');
        setSaving('supervisor');
        try {
            const res = await axios.post(`${url}/api/finance/supervisor-deductions/add`, { ...supervisorForm, projectId }, authHeader);
            if (res.data.success) { toast.success(res.data.message); setSupervisorForm(emptySupervisorForm); }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error recording deduction'); }
        finally { setSaving(''); }
    };

    const contractorRate = contractorForm.workId && contractorForm.vendorId
        ? pool?.works.find(w => w.workId === contractorForm.workId)?.contractors.find(c => c.vendorId === contractorForm.vendorId)?.rate
        : null;
    const labourRate = labourForm.workId && labourForm.labourerId
        ? pool?.works.find(w => w.workId === labourForm.workId)?.labourers.find(l => l.labourerId === labourForm.labourerId)?.rate
        : null;

    return (
        <div>
            <p className="admin-subtitle" style={{ marginBottom: '16px' }}>
                Pick a project and work type to see how much logged work never made it into an issued bill, then allocate sqft of that gap to whoever's responsible — the ₹ amount is always derived from their rate, never typed directly.
            </p>

            <div className="wizard-field-grid" style={{ marginBottom: '20px' }}>
                <div className="add-product-name flex-col">
                    <p>Project</p>
                    <select value={projectId} onChange={e => setProjectId(e.target.value)}>
                        <option value="">Select project…</option>
                        {projects.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                    </select>
                </div>
                {projectId && (
                    <div className="add-product-name flex-col">
                        <p>Work Type</p>
                        <select value={workType} onChange={e => setWorkType(e.target.value)}>
                            <option value="">Select work type…</option>
                            {workTypes.map(wt => <option key={wt} value={wt}>{wt}</option>)}
                        </select>
                    </div>
                )}
            </div>

            {!projectId || !workType ? (
                <div className="admin-empty-state"><p>Select a project and work type to see its reconciliation pool.</p></div>
            ) : loading ? (
                <div className="admin-empty-state"><p>Loading…</p></div>
            ) : !pool ? (
                <div className="admin-empty-state"><p>Unable to load pool.</p></div>
            ) : (
                <>
                    <div className="list-table" style={{ marginBottom: '24px' }}>
                        <div className="list-table-format title" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                            <b>Logged but Never Billed</b><b>Already Allocated</b><b>Remaining to Deduct</b>
                        </div>
                        <div className="list-table-format row-item" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                            <p>{pool.grossUnapprovedSqft.toLocaleString('en-IN')} sqft</p>
                            <p>{pool.alreadyDeductedSqft.toLocaleString('en-IN')} sqft</p>
                            <p style={{ fontWeight: 700, color: pool.remainingSqft > 0 ? '#c0392b' : 'var(--moss)' }}>{pool.remainingSqft.toLocaleString('en-IN')} sqft</p>
                        </div>
                    </div>

                    {pool.remainingSqft === 0 ? (
                        <p className="admin-subtitle" style={{ marginBottom: '20px' }}>Nothing outstanding for {workType} on this project right now.</p>
                    ) : (
                        <>
                            {contractorWorks.length > 0 && (
                                <>
                                    <h3 style={{ marginBottom: '8px' }}>Contractor</h3>
                                    <form onSubmit={submitContractor} style={{ marginBottom: '24px' }}>
                                        <div className="wizard-field-grid">
                                            <div className="add-product-name flex-col">
                                                <p>Work *</p>
                                                <select value={contractorForm.workId} onChange={e => setContractorForm(p => ({ ...p, workId: e.target.value, vendorId: '' }))}>
                                                    <option value="">Select work…</option>
                                                    {contractorWorks.map(w => <option key={w.workId} value={w.workId}>{w.workType} ({w.unapprovedAreaSqft} sqft unapproved)</option>)}
                                                </select>
                                            </div>
                                            {contractorForm.workId && (
                                                <div className="add-product-name flex-col">
                                                    <p>Vendor *</p>
                                                    <select value={contractorForm.vendorId} onChange={e => setContractorForm(p => ({ ...p, vendorId: e.target.value }))}>
                                                        <option value="">Select vendor…</option>
                                                        {pool.works.find(w => w.workId === contractorForm.workId)?.contractors.map(c => (
                                                            <option key={c.vendorId} value={c.vendorId}>{c.vendorName} (₹{c.rate}/sqft)</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}
                                            <div className="add-product-name flex-col">
                                                <p>Sqft to Deduct *</p>
                                                <input type="number" value={contractorForm.areaSqft} onChange={e => setContractorForm(p => ({ ...p, areaSqft: e.target.value }))} />
                                            </div>
                                            <div className="add-product-name flex-col">
                                                <p>Date *</p>
                                                <input type="date" value={contractorForm.date} onChange={e => setContractorForm(p => ({ ...p, date: e.target.value }))} />
                                            </div>
                                            <div className="add-product-name flex-col wizard-field-full">
                                                <p>Reason *</p>
                                                <input type="text" value={contractorForm.reason} onChange={e => setContractorForm(p => ({ ...p, reason: e.target.value }))} placeholder="What went wrong, who's responsible" />
                                            </div>
                                        </div>
                                        {contractorRate != null && contractorForm.areaSqft > 0 && (
                                            <p className="admin-subtitle" style={{ marginTop: '8px' }}>≈ ₹{(contractorRate * Number(contractorForm.areaSqft)).toLocaleString('en-IN')} at ₹{contractorRate}/sqft</p>
                                        )}
                                        <div className="wizard-actions" style={{ marginTop: '16px' }}>
                                            <span />
                                            <button type="submit" className="add-btn" disabled={saving === 'contractor'}>{saving === 'contractor' ? 'Saving…' : '+ Deduct from Contractor'}</button>
                                        </div>
                                    </form>
                                </>
                            )}

                            {labourWorks.length > 0 && (
                                <>
                                    <h3 style={{ marginBottom: '8px' }}>Labour</h3>
                                    <form onSubmit={submitLabour} style={{ marginBottom: '24px' }}>
                                        <div className="wizard-field-grid">
                                            <div className="add-product-name flex-col">
                                                <p>Work *</p>
                                                <select value={labourForm.workId} onChange={e => setLabourForm(p => ({ ...p, workId: e.target.value, labourerId: '' }))}>
                                                    <option value="">Select work…</option>
                                                    {labourWorks.map(w => <option key={w.workId} value={w.workId}>{w.workType} ({w.unapprovedAreaSqft} sqft unapproved)</option>)}
                                                </select>
                                            </div>
                                            {labourForm.workId && (
                                                <div className="add-product-name flex-col">
                                                    <p>Labourer *</p>
                                                    <select value={labourForm.labourerId} onChange={e => setLabourForm(p => ({ ...p, labourerId: e.target.value }))}>
                                                        <option value="">Select labourer…</option>
                                                        {pool.works.find(w => w.workId === labourForm.workId)?.labourers.map(l => (
                                                            <option key={l.labourerId} value={l.labourerId}>{l.labourerName} (₹{l.rate}/sqft)</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}
                                            <div className="add-product-name flex-col">
                                                <p>Sqft to Deduct *</p>
                                                <input type="number" value={labourForm.areaSqft} onChange={e => setLabourForm(p => ({ ...p, areaSqft: e.target.value }))} />
                                            </div>
                                            <div className="add-product-name flex-col">
                                                <p>Date *</p>
                                                <input type="date" value={labourForm.date} onChange={e => setLabourForm(p => ({ ...p, date: e.target.value }))} />
                                            </div>
                                            <div className="add-product-name flex-col wizard-field-full">
                                                <p>Reason *</p>
                                                <input type="text" value={labourForm.reason} onChange={e => setLabourForm(p => ({ ...p, reason: e.target.value }))} placeholder="What went wrong, who's responsible" />
                                            </div>
                                        </div>
                                        {labourRate != null && labourForm.areaSqft > 0 && (
                                            <p className="admin-subtitle" style={{ marginTop: '8px' }}>≈ ₹{(labourRate * Number(labourForm.areaSqft)).toLocaleString('en-IN')} at ₹{labourRate}/sqft</p>
                                        )}
                                        <div className="wizard-actions" style={{ marginTop: '16px' }}>
                                            <span />
                                            <button type="submit" className="add-btn" disabled={saving === 'labour'}>{saving === 'labour' ? 'Saving…' : '+ Deduct from Labourer'}</button>
                                        </div>
                                    </form>
                                </>
                            )}
                        </>
                    )}

                    <h3 style={{ marginBottom: '8px' }}>Supervisor</h3>
                    <p className="admin-subtitle" style={{ marginBottom: '12px' }}>
                        Supervisors don't measure area — this stays a plain ₹ amount, entered manually.
                    </p>
                    <form onSubmit={submitSupervisor}>
                        <div className="wizard-field-grid">
                            <div className="add-product-name flex-col">
                                <p>Supervisor *</p>
                                <select value={supervisorForm.employeeId} onChange={e => setSupervisorForm(p => ({ ...p, employeeId: e.target.value }))}>
                                    <option value="">Select supervisor…</option>
                                    {employees.map(emp => <option key={emp._id} value={emp._id}>{emp.name}</option>)}
                                </select>
                            </div>
                            <div className="add-product-name flex-col">
                                <p>Work (optional)</p>
                                <select value={supervisorForm.workId} onChange={e => setSupervisorForm(p => ({ ...p, workId: e.target.value }))}>
                                    <option value="">— Not tied to a specific work —</option>
                                    {(pool.works || []).map(w => <option key={w.workId} value={w.workId}>{w.workType}</option>)}
                                </select>
                            </div>
                            <div className="add-product-name flex-col">
                                <p>Amount (₹) *</p>
                                <input type="number" value={supervisorForm.amount} onChange={e => setSupervisorForm(p => ({ ...p, amount: e.target.value }))} />
                            </div>
                            <div className="add-product-name flex-col">
                                <p>Date *</p>
                                <input type="date" value={supervisorForm.date} onChange={e => setSupervisorForm(p => ({ ...p, date: e.target.value }))} />
                            </div>
                            <div className="add-product-name flex-col wizard-field-full">
                                <p>Reason *</p>
                                <input type="text" value={supervisorForm.reason} onChange={e => setSupervisorForm(p => ({ ...p, reason: e.target.value }))} />
                            </div>
                        </div>
                        <div className="wizard-actions" style={{ marginTop: '16px' }}>
                            <span />
                            <button type="submit" className="add-btn" disabled={saving === 'supervisor'}>{saving === 'supervisor' ? 'Saving…' : '+ Deduct from Supervisor'}</button>
                        </div>
                    </form>
                </>
            )}
        </div>
    );
};

export default DeductionPanel;
