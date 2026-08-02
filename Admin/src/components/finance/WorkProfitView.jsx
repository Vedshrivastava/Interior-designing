import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useFinanceWsRefresh } from '../../hooks/useFinanceWsRefresh';
import StyledSelect from './StyledSelect';
import { KpiCard, KpiGrid } from './DashboardWidgets';
import '../../styles/list.css';

// Same dashboardCache idea as FinanceHome.jsx, keyed by workId.
const workProfitCache = new Map();

/* Most often reached by drilling in from a project's Works tab
   (WorksManager's "View Profit" link) or from Project Profit's own Works
   list, both of which pass a workId straight in — but also owns its own
   Project + Work picker below, for landing on this tab directly without
   having drilled in from anywhere. `workId` itself stays lifted in
   ReportsPage (via `onSelectWork`) rather than living as local state here,
   same as Project/Client Profit's own pickers, so the choice survives a
   tab switch instead of resetting every time this component remounts. */
const WorkProfitView = ({ url, workId, onSelectWork }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const [data, setData] = useState(workProfitCache.get(workId) || null);
    const [loading, setLoading] = useState(!!workId && !workProfitCache.has(workId));

    const [projects, setProjects] = useState([]);
    const [projectsLoading, setProjectsLoading] = useState(true);
    const [pickerProjectId, setPickerProjectId] = useState('');
    const [works, setWorks] = useState([]);
    const [worksLoading, setWorksLoading] = useState(false);

    useEffect(() => {
        axios.get(`${url}/api/finance/projects/list`, authHeader).then(res => { if (res.data.success) setProjects(res.data.data); }).catch(() => {}).finally(() => setProjectsLoading(false));
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    // Keeps the Project dropdown in sync when a work arrives via drill-in
    // (a URL link or Project Profit's own Works list) rather than picked
    // here — without this the picker would sit empty above data that's
    // already showing for a different project entirely.
    useEffect(() => {
        if (data?.projectId) setPickerProjectId(prev => prev || data.projectId);
    }, [data?.projectId]);

    useEffect(() => {
        if (!pickerProjectId) { setWorks([]); return; }
        setWorksLoading(true);
        axios.get(`${url}/api/finance/works/list`, { ...authHeader, params: { projectId: pickerProjectId } })
            .then(res => { if (res.data.success) setWorks(res.data.data); }).catch(() => {}).finally(() => setWorksLoading(false));
    }, [url, pickerProjectId]); // eslint-disable-line react-hooks/exhaustive-deps

    const onPickProject = (id) => {
        setPickerProjectId(id);
        onSelectWork(''); // switching projects invalidates whichever work was showing
    };

    const fetchData = () => {
        axios.get(`${url}/api/finance/reports/work-profit`, { ...authHeader, params: { workId } })
            .then(res => { if (res.data.success) { setData(res.data.data); workProfitCache.set(workId, res.data.data); } })
            .catch(() => toast.error('Error fetching work profit'))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        if (!workId) { setData(null); return; }
        const existing = workProfitCache.get(workId);
        if (existing) { setData(existing); setLoading(false); }
        else setLoading(true);
        fetchData();
    }, [url, workId]); // eslint-disable-line react-hooks/exhaustive-deps

    useFinanceWsRefresh([
        'financeWorksChanged', 'financeRunningBillsChanged', 'financeMeasurementsChanged',
        'financeWorkContractorAssignmentsChanged', 'financeContractorRatesChanged',
        'financeLabourMeasurementsChanged', 'financeLabourRatesChanged', 'financeWorkTypeRatesChanged',
    ], () => { if (workId) fetchData(); });

    const picker = (
        <div className="wizard-field-grid" style={{ marginBottom: '20px' }}>
            <div className="add-product-name flex-col">
                <p>Project</p>
                <StyledSelect value={pickerProjectId} onChange={onPickProject} placeholder="Select project…" loading={projectsLoading} options={projects.map(p => ({ value: p._id, label: p.name }))} />
            </div>
            <div className="add-product-name flex-col">
                <p>Work</p>
                <StyledSelect
                    value={workId} onChange={onSelectWork} placeholder={pickerProjectId ? 'Select work…' : 'Pick a project first'}
                    disabled={!pickerProjectId} loading={worksLoading} options={works.map(w => ({ value: w._id, label: w.workType }))}
                />
            </div>
        </div>
    );

    if (!workId) {
        return (
            <div>
                {picker}
                <div className="admin-empty-state"><p>Select a project and work above (or open a project's Works tab and click "View Profit" on one) to see it here.</p></div>
            </div>
        );
    }
    if (loading) return <div>{picker}<div className="admin-empty-state"><p>Loading…</p></div></div>;
    if (!data) return <div>{picker}<div className="admin-empty-state"><p>Work not found.</p></div></div>;

    // data.totalAmount (computeWorkExpectedPay's own figure) is contractor
    // + labour combined and, when a Work has more than one contractor or
    // labourer, sums each one's rate × the full logged area rather than a
    // real per-party split (see that function's own KNOWN LIMITATION
    // comment) — not the right source for a "Total logged" caption placed
    // specifically under Contractor Cost or Labour Cost. The breakdown
    // arrays are already correctly per-party, so sum those instead.
    const totalContractorAmount = data.contractorBreakdown.reduce((s, b) => s + b.totalAmount, 0);
    const totalLabourAmount = data.labourBreakdown.reduce((s, b) => s + b.totalAmount, 0);
    const contractorSub = data.unapprovedContractorCost > 0
        ? `Total logged: ₹${totalContractorAmount.toLocaleString('en-IN')}`
        : (data.rejectedContractorCost > 0 ? `₹${data.rejectedContractorCost.toLocaleString('en-IN')} rejected (already settled)` : undefined);
    const labourSub = data.unapprovedLabourCost > 0
        ? `Total logged: ₹${totalLabourAmount.toLocaleString('en-IN')}`
        : (data.rejectedLabourCost > 0 ? `₹${data.rejectedLabourCost.toLocaleString('en-IN')} rejected (already settled)` : undefined);

    return (
        <div>
            {picker}
            <p className="admin-subtitle" style={{ marginBottom: '16px' }}>
                {data.workType} · {data.completedAreaSqft} / {data.estimatedAreaSqft} sqft completed, {data.areaBilledSqft} sqft billed
            </p>
            <KpiGrid>
                <KpiCard label="Revenue" value={`₹${data.revenue.toLocaleString('en-IN')}`} />
                <KpiCard
                    label="Contractor Cost"
                    value={data.contractorCost > 0 ? `₹${data.contractorCost.toLocaleString('en-IN')}` : (totalContractorAmount > 0 ? 'Unapproved' : '₹0')}
                    tone={data.contractorCost === 0 && totalContractorAmount > 0 ? 'danger' : undefined}
                    sub={contractorSub}
                />
                <KpiCard label="Labour Cost" value={`₹${data.labourCost.toLocaleString('en-IN')}`} sub={labourSub} />
                <KpiCard label="Material Cost" value={`₹${data.materialCost.toLocaleString('en-IN')}`} sub="Weighted avg" />
                <KpiCard label="Material Waste Cost" value={`₹${data.materialWasteCost.toLocaleString('en-IN')}`} tone={data.materialWasteCost > 0 ? 'danger' : undefined} />
                <KpiCard label="Commission Cost" value={`₹${data.commissionCost.toLocaleString('en-IN')}`} />
                <KpiCard label="Profit" value={`₹${data.profit.toLocaleString('en-IN')}`} tone={data.profit >= 0 ? 'good' : 'danger'} />
            </KpiGrid>

            {(data.unapprovedAreaSqft > 0 || data.unapprovedCommissionAmount > 0) && (
                <>
                    <p className="admin-subtitle" style={{ margin: '24px 0 10px' }}>
                        {data.heldForAttribution ? 'Unapproved — Held Pending Rejection Attribution' : 'Unapproved (Pending Review)'}
                    </p>
                    <KpiGrid>
                        <KpiCard label="Area" value={`${data.unapprovedAreaSqft.toLocaleString('en-IN')} sqft`} />
                        <KpiCard label="Contractor Unapproved" value={`₹${data.unapprovedContractorCost.toLocaleString('en-IN')}`} />
                        <KpiCard label="Labour Unapproved" value={`₹${data.unapprovedLabourCost.toLocaleString('en-IN')}`} />
                        <KpiCard label="Commission" value={`₹${data.unapprovedCommissionAmount.toLocaleString('en-IN')}`} />
                        <KpiCard label="Revenue" value={`₹${data.unapprovedRevenue.toLocaleString('en-IN')}`} />
                        <KpiCard label="Profit" value={`₹${data.unapprovedProfit.toLocaleString('en-IN')}`} tone={data.unapprovedProfit >= 0 ? 'good' : 'danger'} />
                    </KpiGrid>
                    {data.heldForAttribution ? (
                        <p className="admin-subtitle" style={{ margin: '10px 0 4px', color: '#c0392b' }}>
                            ⚠ This Work was reviewed — {data.rejectedAreaSqft.toLocaleString('en-IN')} sqft rejected — but that rejection isn't fully attributed to specific contractors/labourers yet (Payables/Receivables → Deductions). Until it is, ALL logged work here shows as Unapproved, not just the rejected portion.
                        </p>
                    ) : (
                        <p className="admin-subtitle" style={{ margin: '10px 0 4px' }}>
                            Logged work on this Work whose cost isn't counted in Profit yet.
                            {data.rejectedAreaSqft > 0 && ` Of this, ${data.rejectedAreaSqft.toLocaleString('en-IN')} sqft is permanently rejected (already attributed); the rest is simply pending its first review.`}
                        </p>
                    )}
                    <p className="admin-subtitle" style={{ marginBottom: '24px', fontWeight: 600, color: data.totalProjectedProfit >= 0 ? 'var(--moss)' : '#c0392b' }}>
                        Total Projected Profit (Approved + Unapproved): ₹{data.totalProjectedProfit.toLocaleString('en-IN')}
                    </p>
                </>
            )}

            {(data.contractorDirectPaymentTotal > 0 || data.labourDirectPaymentTotal > 0) && (
                <>
                    <p className="admin-subtitle" style={{ marginBottom: '10px' }}>Direct Payments (Client → Workers)</p>
                    <div className="dash-chart-card rwp-dp-card" style={{ marginBottom: '8px' }}>
                        <div className="rwp-dp-row rwp-dp-header">
                            <b className="rwp-dp-party">Party</b>
                            <b className="rwp-dp-total">Total</b>
                        </div>
                        {data.contractorDirectPaymentTotal > 0 && (
                            <div className="rwp-dp-row">
                                <p className="rwp-dp-party">Contractor</p>
                                <p className="rwp-dp-total">₹{data.contractorDirectPaymentTotal.toLocaleString('en-IN')}</p>
                            </div>
                        )}
                        {data.labourDirectPaymentTotal > 0 && (
                            <div className="rwp-dp-row">
                                <p className="rwp-dp-party">Labour</p>
                                <p className="rwp-dp-total">₹{data.labourDirectPaymentTotal.toLocaleString('en-IN')}</p>
                            </div>
                        )}
                    </div>
                    <p className="admin-subtitle" style={{ marginBottom: '24px' }}>
                        Amounts the client paid directly to a worker on this Work — an advance, not tied to specific sqft, so it's a flat reduction against that worker's overall Balance Payable (see their Ledger), not netted against this Work's own Approved/Unapproved split.
                    </p>
                </>
            )}

            {data.contractorBreakdown.length > 0 && (
                <>
                    <p className="admin-subtitle" style={{ marginBottom: '10px' }}>Contractor breakdown</p>
                    <div className="dash-chart-card rwp-cb-card" style={{ marginBottom: '24px' }}>
                        <div className="rwp-cb-row rwp-cb-header">
                            <b className="rwp-cb-contractor">Contractor</b>
                            <b className="rwp-cb-area">Area</b>
                            <b className="rwp-cb-rate">Rate</b>
                            <b className="rwp-cb-amount">Amount</b>
                        </div>
                        {data.contractorBreakdown.map(r => (
                            <div key={r.vendorId} className="rwp-cb-row">
                                <p className="rwp-cb-contractor">{r.vendorName}</p>
                                <p className="rwp-cb-area"><span className="pq-group-label">Area</span>{r.areaSqft.toLocaleString('en-IN')} sqft</p>
                                <p className="rwp-cb-rate"><span className="pq-group-label">Rate</span>₹{r.rate}/sqft</p>
                                <p className="rwp-cb-amount"><span className="pq-group-label">Amount</span>₹{r.approvedAmount.toLocaleString('en-IN')}</p>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {data.labourBreakdown.length > 0 && (
                <>
                    <p className="admin-subtitle" style={{ marginBottom: '10px' }}>Labour breakdown</p>
                    <div className="dash-chart-card rwp-lb-card">
                        <div className="rwp-lb-row rwp-lb-header">
                            <b className="rwp-lb-labourer">Labourer</b>
                            <b className="rwp-lb-area">Area</b>
                            <b className="rwp-lb-rate">Rate</b>
                            <b className="rwp-lb-amount">Amount</b>
                        </div>
                        {data.labourBreakdown.map(r => (
                            <div key={r.labourerId} className="rwp-lb-row">
                                <p className="rwp-lb-labourer">{r.labourerName}</p>
                                <p className="rwp-lb-area"><span className="pq-group-label">Area</span>{r.areaSqft.toLocaleString('en-IN')} sqft</p>
                                <p className="rwp-lb-rate"><span className="pq-group-label">Rate</span>₹{r.rate}/sqft</p>
                                <p className="rwp-lb-amount"><span className="pq-group-label">Amount</span>₹{r.approvedAmount.toLocaleString('en-IN')}</p>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

export default WorkProfitView;
