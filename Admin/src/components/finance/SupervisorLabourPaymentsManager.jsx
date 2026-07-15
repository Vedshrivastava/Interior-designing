import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import '../../styles/list.css';

const emptyFilters = { dateFrom: '', dateTo: '', projectId: '' };
const emptySettlement = { date: '', paymentMode: '', bankOrCashLabel: '', bankAccountId: '', utrNumber: '', notes: '' };

/*
 * Bulk labour settlement for one supervisor — the real-world process is one
 * payment covering many financeDailyLabour entries, not each paid
 * individually (see financeSupervisorLabourPayment). Pick unsettled
 * entries (optionally narrowed by date range/project), preview the total,
 * confirm — the selected entries flip to settled and the Labour Payable
 * KPI drops by exactly that amount.
 */
const SupervisorLabourPaymentsManager = ({ url, employeeId }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [payable, setPayable] = useState(null);
    const [projects, setProjects] = useState([]);
    const [bankAccounts, setBankAccounts] = useState([]);
    const [unsettled, setUnsettled] = useState([]);
    const [selectedIds, setSelectedIds] = useState([]);
    const [filters, setFilters] = useState(emptyFilters);
    const [settlement, setSettlement] = useState(emptySettlement);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const fetchPayable = async () => {
        try {
            const res = await axios.get(`${url}/api/finance/supervisors/${employeeId}/labour-payable`, authHeader);
            if (res.data.success) setPayable(res.data.data);
        } catch { /* KPI just stays blank */ }
    };

    const fetchUnsettled = async () => {
        setLoading(true);
        try {
            const params = { supervisorId: employeeId, unsettledOnly: 'true' };
            if (filters.dateFrom) params.dateFrom = filters.dateFrom;
            if (filters.dateTo) params.dateTo = filters.dateTo;
            if (filters.projectId) params.projectId = filters.projectId;
            const res = await axios.get(`${url}/api/finance/daily-labour/list`, { ...authHeader, params });
            if (res.data.success) { setUnsettled(res.data.data); setSelectedIds([]); }
        } catch { toast.error('Error fetching unsettled entries'); }
        finally { setLoading(false); }
    };

    const fetchHistory = async () => {
        try {
            const res = await axios.get(`${url}/api/finance/supervisor-labour-payments/list`, { ...authHeader, params: { supervisorId: employeeId } });
            if (res.data.success) setHistory(res.data.data);
        } catch { toast.error('Error fetching settlement history'); }
    };

    useEffect(() => { if (employeeId) { fetchPayable(); fetchHistory(); } }, [employeeId]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { if (employeeId) fetchUnsettled(); }, [employeeId, filters]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        axios.get(`${url}/api/finance/projects/list`, authHeader).then(res => { if (res.data.success) setProjects(res.data.data); }).catch(() => {});
        axios.get(`${url}/api/finance/bank-accounts/list`, authHeader).then(res => { if (res.data.success) setBankAccounts(res.data.data); }).catch(() => {});
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    const setFilterField = (key, value) => setFilters(prev => ({ ...prev, [key]: value }));
    const setSettlementField = (key, value) => setSettlement(prev => ({ ...prev, [key]: value }));

    const approvedUnsettled = unsettled.filter(e => e.engineerApproved);

    const toggleSelected = (id) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    const toggleSelectAll = () => setSelectedIds(prev => prev.length === approvedUnsettled.length ? [] : approvedUnsettled.map(e => e._id));

    const selectedTotal = unsettled.filter(e => selectedIds.includes(e._id)).reduce((sum, e) => sum + e.amount, 0);

    const generateSettlement = async (e) => {
        e.preventDefault();
        if (selectedIds.length === 0) return toast.error('Select at least one entry to settle');
        if (!settlement.date) return toast.error('Date is required');
        setSaving(true);
        try {
            const res = await axios.post(`${url}/api/finance/supervisor-labour-payments/add`, {
                supervisorId: employeeId, coveredDailyLabourIds: selectedIds, ...settlement,
            }, authHeader);
            if (res.data.success) {
                toast.success(res.data.message);
                setSettlement(emptySettlement);
                await Promise.all([fetchPayable(), fetchUnsettled(), fetchHistory()]);
            } else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error recording settlement'); }
        finally { setSaving(false); }
    };

    const removeSettlement = async (id) => {
        try {
            const res = await axios.delete(`${url}/api/finance/supervisor-labour-payments/remove`, { ...authHeader, data: { _id: id } });
            if (res.data.success) {
                toast.success(res.data.message);
                await Promise.all([fetchPayable(), fetchUnsettled(), fetchHistory()]);
            } else toast.error(res.data.message);
        } catch { toast.error('Error removing settlement'); }
    };

    return (
        <div>
            <div className="list-table" style={{ marginBottom: '8px' }}>
                <div className="list-table-format title" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                    <b>Labour Payable (Approved)</b><b>Neglected (Unapproved)</b><b>Approved Unsettled</b>
                </div>
                <div className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                    <p style={{ fontWeight: 700, color: (payable?.payable || 0) > 0 ? '#c0392b' : 'var(--moss)' }}>₹{(payable?.payable || 0).toLocaleString('en-IN')}</p>
                    <p style={{ color: (payable?.neglected || 0) > 0 ? '#c0392b' : 'var(--text-lt)' }}>₹{(payable?.neglected || 0).toLocaleString('en-IN')}</p>
                    <p>{payable?.unsettledCount ?? '—'}</p>
                </div>
            </div>
            {(payable?.neglected || 0) > 0 && (
                <p className="admin-subtitle" style={{ marginBottom: '20px' }}>
                    ₹{payable.neglected.toLocaleString('en-IN')} across {payable.neglectedCount} entr{payable.neglectedCount === 1 ? 'y' : 'ies'} is still pending engineer approval — excluded from what's payable and can't be settled until approved.
                </p>
            )}

            <h3 style={{ marginBottom: '8px' }}>Generate Settlement</h3>
            <div className="wizard-field-grid" style={{ marginBottom: '12px' }}>
                <div className="add-product-name flex-col">
                    <p>From</p>
                    <input type="date" value={filters.dateFrom} onChange={e => setFilterField('dateFrom', e.target.value)} />
                </div>
                <div className="add-product-name flex-col">
                    <p>To</p>
                    <input type="date" value={filters.dateTo} onChange={e => setFilterField('dateTo', e.target.value)} />
                </div>
                <div className="add-product-name flex-col">
                    <p>Project</p>
                    <select value={filters.projectId} onChange={e => setFilterField('projectId', e.target.value)}>
                        <option value="">All Projects</option>
                        {projects.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                    </select>
                </div>
            </div>

            <div className="list-table" style={{ marginBottom: '16px' }}>
                <div className="list-table-format title" style={{ gridTemplateColumns: '40px 1fr 1.2fr 1fr 1fr 1fr 110px' }}>
                    <input type="checkbox" checked={approvedUnsettled.length > 0 && selectedIds.length === approvedUnsettled.length} onChange={toggleSelectAll} />
                    <b>Date</b><b>Project</b><b>Labourer</b><b>Type</b><b>Amount</b><b>Approved</b>
                </div>
                {loading ? (
                    <div className="admin-empty-state"><p>Loading…</p></div>
                ) : unsettled.length === 0 ? (
                    <div className="admin-empty-state"><p>No unsettled entries for this supervisor.</p></div>
                ) : unsettled.map(en => (
                    <div key={en._id} className="list-table-format row-item" style={{ gridTemplateColumns: '40px 1fr 1.2fr 1fr 1fr 1fr 110px', opacity: en.engineerApproved ? 1 : 0.55 }}>
                        <input type="checkbox" checked={selectedIds.includes(en._id)} disabled={!en.engineerApproved} title={en.engineerApproved ? '' : 'Not yet engineer-approved'} onChange={() => toggleSelected(en._id)} />
                        <p>{new Date(en.date).toLocaleDateString()}</p>
                        <p>{en.projectId?.name || '—'}</p>
                        <p>{en.labourerName}</p>
                        <p>{en.attendanceType}</p>
                        <p>₹{en.amount.toLocaleString('en-IN')}</p>
                        <p style={{ color: en.engineerApproved ? 'var(--moss)' : '#c0392b' }}>{en.engineerApproved ? '✓ Approved' : 'Pending'}</p>
                    </div>
                ))}
            </div>

            <form onSubmit={generateSettlement} style={{ marginBottom: '28px' }}>
                <div className="wizard-field-grid">
                    <div className="add-product-name flex-col">
                        <p>Selected Total (auto)</p>
                        <input type="text" value={`₹${selectedTotal.toLocaleString('en-IN')} (${selectedIds.length} entries)`} disabled />
                    </div>
                    <div className="add-product-name flex-col">
                        <p>Settlement Date *</p>
                        <input type="date" value={settlement.date} onChange={e => setSettlementField('date', e.target.value)} />
                    </div>
                    <div className="add-product-name flex-col">
                        <p>Payment Mode</p>
                        <input type="text" value={settlement.paymentMode} onChange={e => setSettlementField('paymentMode', e.target.value)} />
                    </div>
                    <div className="add-product-name flex-col">
                        <p>Bank Account</p>
                        <select value={settlement.bankAccountId} onChange={e => setSettlementField('bankAccountId', e.target.value)}>
                            <option value="">— Cash —</option>
                            {bankAccounts.map(a => <option key={a._id} value={a._id}>{a.accountName} — {a.bankName}</option>)}
                        </select>
                    </div>
                    <div className="add-product-name flex-col">
                        <p>UTR Number</p>
                        <input type="text" value={settlement.utrNumber} onChange={e => setSettlementField('utrNumber', e.target.value)} />
                    </div>
                    <div className="add-product-name flex-col wizard-field-full">
                        <p>Notes</p>
                        <textarea rows="2" value={settlement.notes} onChange={e => setSettlementField('notes', e.target.value)} />
                    </div>
                </div>
                <div className="wizard-actions" style={{ marginTop: '16px' }}>
                    <span />
                    <button type="submit" className="add-btn" disabled={saving || selectedIds.length === 0}>
                        {saving ? 'Saving…' : `Settle ${selectedIds.length} Entries`}
                    </button>
                </div>
            </form>

            <h3 style={{ marginBottom: '8px' }}>Settlement History</h3>
            <div className="list-table">
                <div className="list-table-format title" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 100px' }}>
                    <b>Date</b><b>Total</b><b>Entries</b><b>Mode</b><b>Account</b><b>Action</b>
                </div>
                {history.length === 0 ? (
                    <div className="admin-empty-state"><p>No settlements recorded yet.</p></div>
                ) : history.map(p => (
                    <div key={p._id} className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 100px' }}>
                        <p>{new Date(p.date).toLocaleDateString()}</p>
                        <p>₹{p.totalAmount.toLocaleString('en-IN')}</p>
                        <p>{p.coveredDailyLabourIds.length}</p>
                        <p>{p.paymentMode || '—'}</p>
                        <p>{p.bankAccountId?.accountName || 'Cash'}</p>
                        <div className="action-buttons"><p onClick={() => removeSettlement(p._id)} className="cursor delete-action">X</p></div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SupervisorLabourPaymentsManager;
