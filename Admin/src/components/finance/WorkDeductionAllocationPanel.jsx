import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import StyledSelect from './StyledSelect';
import StyledDatePicker from './StyledDatePicker';
import { useFinanceWsRefresh } from '../../hooks/useFinanceWsRefresh';
import '../../styles/list.css';
import '../../styles/wizard.css';
import '../../styles/add.css';

/*
 * Every contractor, labourer, and supervisor has their own share of a
 * Work's rejected sqft — never assumed equal, always a deliberate call.
 * This is that call: pick a Work with a rejected pool (from WorkReviewPanel
 * in Receivables) not yet fully attributed, and split it across whoever's
 * actually responsible. Contractors/labourers get a sqft cut (which
 * reduces their own Approved-earnings-adjacent Balance Payable via the
 * existing financeContractorDeduction/financeLabourDeduction records —
 * nothing new, this reuses the same deduction entry points Payables'
 * Ledger tabs already have); supervisors don't do measured work, so
 * theirs is a plain ₹ amount instead (financeSupervisorDeduction).
 *
 * "Remaining to allocate" only tracks the sqft side (contractor + labour)
 * — a supervisor's ₹ deduction is a separate penalty, not sqft the
 * rejected pool is made of.
 */
const WorkDeductionAllocationPanel = ({ url }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [projects, setProjects] = useState([]);
    const [projectId, setProjectId] = useState('');
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);

    const [target, setTarget] = useState(null); // the work row being allocated
    const [contractors, setContractors] = useState([]);
    const [labourers, setLabourers] = useState([]);
    const [supervisors, setSupervisors] = useState([]);
    const [loadingParties, setLoadingParties] = useState(false);
    const [sqftInputs, setSqftInputs] = useState({}); // key -> value (contractor/labour)
    const [amountInputs, setAmountInputs] = useState({}); // employeeId -> value (supervisor)
    const [reason, setReason] = useState('');
    const [date, setDate] = useState('');
    const [saving, setSaving] = useState(false);

    const fetchProjects = () => {
        axios.get(`${url}/api/finance/projects/list`, authHeader).then(res => { if (res.data.success) setProjects(res.data.data); }).catch(() => {});
    };
    useEffect(fetchProjects, [url]); // eslint-disable-line react-hooks/exhaustive-deps
    useFinanceWsRefresh(['financeProjectsChanged'], fetchProjects);

    const fetchRows = async () => {
        if (!projectId) { setRows([]); return; }
        setLoading(true);
        try {
            const res = await axios.get(`${url}/api/finance/work-reviews/project/${projectId}`, authHeader);
            if (res.data.success) setRows(res.data.data.rows.filter(r => r.unattributedAreaSqft > 0));
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error fetching rejected work'); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchRows(); }, [url, projectId]); // eslint-disable-line react-hooks/exhaustive-deps
    useFinanceWsRefresh(['financeWorkReviewChanged', 'financeContractorLedgerChanged', 'financeLabourLedgerChanged', 'financeSupervisorDeductionsChanged'], fetchRows);

    const openAllocate = async (row) => {
        setTarget(row);
        setSqftInputs({}); setAmountInputs({}); setReason(''); setDate(new Date().toISOString().slice(0, 10));
        setLoadingParties(true);
        try {
            const [cRes, lRes] = await Promise.all([
                axios.get(`${url}/api/finance/work-contractor-assignments/list`, { ...authHeader, params: { workId: row.workId } }),
                axios.get(`${url}/api/finance/work-labour-assignments/list`, { ...authHeader, params: { workId: row.workId } }),
            ]);
            setContractors(cRes.data.success ? cRes.data.data : []);
            const labourRows = lRes.data.success ? lRes.data.data : [];
            setLabourers(labourRows);
            const supervisorMap = new Map();
            for (const a of labourRows) {
                if (a.supervisorId?._id) supervisorMap.set(a.supervisorId._id, a.supervisorId.name);
            }
            setSupervisors([...supervisorMap.entries()].map(([employeeId, name]) => ({ employeeId, name })));
        } catch { toast.error('Error fetching workers for this work'); }
        finally { setLoadingParties(false); }
    };
    const closeAllocate = () => setTarget(null);

    const sqftEnteredTotal = Object.values(sqftInputs).reduce((sum, v) => sum + (Number(v) || 0), 0);
    const remaining = target ? Math.round(((target.unattributedAreaSqft - sqftEnteredTotal) + Number.EPSILON) * 100) / 100 : 0;

    const saveAllocations = async () => {
        if (!reason.trim()) return toast.error('Reason is required');
        if (!date) return toast.error('Date is required');
        const sqftEntries = Object.entries(sqftInputs).filter(([, v]) => Number(v) > 0);
        const amountEntries = Object.entries(amountInputs).filter(([, v]) => Number(v) > 0);
        if (!sqftEntries.length && !amountEntries.length) return toast.error('Enter at least one allocation');
        if (sqftEnteredTotal > target.unattributedAreaSqft) return toast.error(`Cannot allocate more than the ${target.unattributedAreaSqft} sqft remaining`);

        setSaving(true);
        try {
            await Promise.all([
                ...sqftEntries.map(([key, areaSqft]) => {
                    const [partyType, partyId] = key.split('|');
                    const endpoint = partyType === 'contractor' ? 'contractor-deductions' : 'labour-deductions';
                    const payload = partyType === 'contractor'
                        ? { vendorId: partyId, workId: target.workId, areaSqft, reason: reason.trim(), date }
                        : { labourerId: partyId, workId: target.workId, areaSqft, reason: reason.trim(), date, source: 'engineer_review' };
                    return axios.post(`${url}/api/finance/${endpoint}/add`, payload, authHeader);
                }),
                ...amountEntries.map(([employeeId, amount]) => axios.post(`${url}/api/finance/supervisor-deductions/add`, {
                    employeeId, projectId, workId: target.workId, amount, reason: reason.trim(), date,
                }, authHeader)),
            ]);
            toast.success('Allocations saved');
            closeAllocate();
            await fetchRows();
        } catch (err) { toast.error(err.response?.data?.message || 'Error saving allocations'); }
        finally { setSaving(false); }
    };

    return (
        <div>
            <p className="admin-subtitle" style={{ marginBottom: '16px' }}>
                Works with a rejected pool (from Receivables' Work Review) not yet attributed to anyone specific. Split it across whoever's actually responsible — contractors and labourers get a sqft cut, supervisors a ₹ amount, since they don't do measured work.
            </p>

            <div className="add-product-name flex-col" style={{ marginBottom: '20px', maxWidth: '360px' }}>
                <p>Project</p>
                <StyledSelect
                    value={projectId} onChange={setProjectId} placeholder="Select project…"
                    options={projects.map(p => ({ value: p._id, label: p.name }))}
                />
            </div>

            {!projectId ? (
                <div className="admin-empty-state"><p>Select a project to see its unattributed rejected work.</p></div>
            ) : loading ? (
                <div className="admin-empty-state"><p>Loading…</p></div>
            ) : rows.length === 0 ? (
                <div className="admin-empty-state"><p>Nothing outstanding — every rejected sqft on this project has been attributed.</p></div>
            ) : (
                <div className="list-table finance-table">
                    <div className="list-table-format title" style={{ gridTemplateColumns: '1.5fr 1fr 1fr 130px' }}>
                        <b>Work Type</b><b>Rejected</b><b>Unattributed</b><b>Action</b>
                    </div>
                    {rows.map(row => (
                        <div key={row.workId} className="list-table-format row-item" style={{ gridTemplateColumns: '1.5fr 1fr 1fr 130px' }}>
                            <p>{row.workType}</p>
                            <p>{row.rejectedAreaSqft} sqft</p>
                            <p style={{ color: '#c0392b', fontWeight: 600 }}>{row.unattributedAreaSqft} sqft</p>
                            <div className="action-buttons">
                                <p onClick={() => openAllocate(row)} className="cursor edit-action">Allocate</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {target && ReactDOM.createPortal(
                <div className="submit-loader-overlay" style={{ zIndex: 100000 }}>
                    <div className="loader-modal-box edit-modal">
                        <h2>Allocate Rejected Sqft — {target.workType}</h2>
                        <p className="admin-subtitle" style={{ margin: '4px 0 16px' }}>
                            {target.unattributedAreaSqft} sqft rejected and not yet attributed to anyone specific.
                        </p>

                        {loadingParties ? (
                            <div className="admin-empty-state"><p>Loading…</p></div>
                        ) : (
                            <>
                                <div className="list-table finance-table" style={{ marginBottom: '16px' }}>
                                    <div className="list-table-format title" style={{ gridTemplateColumns: '1fr 0.8fr 140px' }}>
                                        <b>Name</b><b>Type</b><b>Sqft to Deduct</b>
                                    </div>
                                    {contractors.map(a => {
                                        const key = `contractor|${a.contractorVendorId._id}`;
                                        return (
                                            <div key={key} className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 0.8fr 140px' }}>
                                                <p>{a.contractorVendorId?.name || '—'}</p>
                                                <p><span className="item-category">Contractor</span></p>
                                                <input type="number" onWheel={e => e.target.blur()} min="0" step="any" value={sqftInputs[key] || ''} onChange={e => setSqftInputs(p => ({ ...p, [key]: e.target.value }))} />
                                            </div>
                                        );
                                    })}
                                    {[...new Map(labourers.map(a => [a.labourerId._id, a])).values()].map(a => {
                                        const key = `labour|${a.labourerId._id}`;
                                        return (
                                            <div key={key} className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 0.8fr 140px' }}>
                                                <p>{a.labourerId?.name || '—'}</p>
                                                <p><span className="item-category">Labour</span></p>
                                                <input type="number" onWheel={e => e.target.blur()} min="0" step="any" value={sqftInputs[key] || ''} onChange={e => setSqftInputs(p => ({ ...p, [key]: e.target.value }))} />
                                            </div>
                                        );
                                    })}
                                    {contractors.length === 0 && labourers.length === 0 && (
                                        <div className="admin-empty-state"><p>No contractors or labourers assigned to this work.</p></div>
                                    )}
                                </div>

                                {supervisors.length > 0 && (
                                    <div className="list-table finance-table" style={{ marginBottom: '16px' }}>
                                        <div className="list-table-format title" style={{ gridTemplateColumns: '1fr 0.8fr 140px' }}>
                                            <b>Name</b><b>Type</b><b>₹ to Deduct</b>
                                        </div>
                                        {supervisors.map(s => (
                                            <div key={s.employeeId} className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 0.8fr 140px' }}>
                                                <p>{s.name}</p>
                                                <p><span className="item-category">Supervisor</span></p>
                                                <input type="number" onWheel={e => e.target.blur()} min="0" step="any" value={amountInputs[s.employeeId] || ''} onChange={e => setAmountInputs(p => ({ ...p, [s.employeeId]: e.target.value }))} />
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <p className="admin-subtitle" style={{ marginBottom: '12px', fontWeight: 600, color: remaining > 0 ? '#c0392b' : 'var(--moss)' }}>
                                    {remaining > 0 ? `${remaining} sqft still left to allocate` : 'Fully allocated'}
                                </p>

                                <div className="wizard-field-grid">
                                    <div className="add-product-name flex-col">
                                        <p>Date *</p>
                                        <StyledDatePicker value={date} onChange={setDate} />
                                    </div>
                                    <div className="add-product-name flex-col wizard-field-full">
                                        <p>Reason *</p>
                                        <input type="text" value={reason} onChange={e => setReason(e.target.value)} placeholder="What went wrong" />
                                    </div>
                                </div>
                            </>
                        )}

                        <div className="edit-modal-actions">
                            <button type="button" className="add-btn cancel-btn" onClick={closeAllocate}>Cancel</button>
                            <button type="button" className="add-btn" disabled={saving || loadingParties} onClick={saveAllocations}>{saving ? 'Saving…' : 'Save Allocations'}</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default WorkDeductionAllocationPanel;
