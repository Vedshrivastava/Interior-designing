import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import '../../styles/list.css';
import '../../styles/wizard.css';
import '../../styles/add.css';

const pairKey = (workType, vendorId) => `${workType}::${vendorId}`;

/* Manages financeContractorRate rows for one project — mirrors
   WorkersManager's grid exactly. Every (work type, contractor) pair is
   already fully determined by those Works' contractor assignments — there
   is nothing to freely "select", so this renders one row per real pair,
   grouped by work type: a saved rate shows read-only + Remove, an unset
   one shows an inline rate input. No fallback add-your-own form here (this
   used to have one, before this project had any real Work) — a contractor
   is only ever "on" a work type via a real assignment now, made from the
   Works table's "Contractors" action, exactly like labour already works;
   this stays purely a rate-confirmation panel for whatever's real. */
const ContractorRatesManager = ({ url, projectId, worksVersion }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    // Who's actually assigned to a Work of a given type on this project
    // (from financeWorkContractorAssignment, via GET /projects/:id's own
    // `contractors` field) — not the entire vendor master. Map<workType,
    // Array<{vendorId, vendorName}>>; a Work can have more than one
    // contractor, and a contractor can appear under more than one work type.
    const [contractorsByWorkType, setContractorsByWorkType] = useState(new Map());

    // Pending rate per unset (workType, vendorId) pair, keyed by pairKey,
    // and which key is currently being saved.
    const [pending, setPending] = useState({});
    const [savingKey, setSavingKey] = useState(null);

    const fetchList = async () => {
        try {
            const res = await axios.get(`${url}/api/finance/contractor-rates/list`, { ...authHeader, params: { projectId } });
            if (res.data.success) setItems(res.data.data);
        } catch { toast.error('Error fetching contractor rates'); }
    };

    // project.contractors is computeProjectContractors' output — one row
    // per vendor actually assigned to >=1 Work here, each carrying every
    // work type they're assigned to.
    const fetchProjectContractors = async () => {
        try {
            const res = await axios.get(`${url}/api/finance/projects/${projectId}`, authHeader);
            if (!res.data.success) return;
            const contractors = res.data.data.contractors || [];
            if (!contractors.length) { setContractorsByWorkType(new Map()); return; }

            const byType = new Map();
            for (const c of contractors) {
                for (const wt of c.workTypes) {
                    if (!byType.has(wt)) byType.set(wt, []);
                    byType.get(wt).push({ vendorId: c.vendorId, vendorName: c.vendorName });
                }
            }
            setContractorsByWorkType(byType);
        } catch { /* leave as-is */ }
    };

    useEffect(() => {
        if (!projectId) return;
        setLoading(true);
        fetchList();
        fetchProjectContractors().finally(() => setLoading(false));
    }, [projectId, worksVersion]); // eslint-disable-line react-hooks/exhaustive-deps

    const setPendingField = (key, field, value) =>
        setPending(prev => ({ ...prev, [key]: { ...(prev[key] || { rate: '' }), [field]: value } }));

    const saveGridRate = async (workType, contractorVendorId, key) => {
        const entry = pending[key] || { rate: '' };
        if (entry.rate === '') { toast.error('Rate is required'); return; }
        setSavingKey(key);
        try {
            const payload = { projectId, contractorVendorId, workType, ratePerSqft: entry.rate };
            const res = await axios.post(`${url}/api/finance/contractor-rates/add`, payload, authHeader);
            if (res.data.success) {
                toast.success(res.data.message || 'Rate saved');
                setPending(prev => { const next = { ...prev }; delete next[key]; return next; });
                await fetchList();
            } else toast.error(res.data.message);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error saving rate');
        } finally { setSavingKey(null); }
    };

    const removeRate = async (_id) => {
        try {
            const res = await axios.post(`${url}/api/finance/contractor-rates/remove`, { _id }, authHeader);
            if (res.data.success) { toast.success(res.data.message); await fetchList(); }
            else toast.error(res.data.message);
        } catch { toast.error('Error removing contractor rate'); }
    };

    const findExisting = (workType, vendorId) => items.find(i =>
        i.workType === workType && (i.contractorVendorId?._id || i.contractorVendorId) === vendorId);

    if (loading) return <div className="admin-empty-state"><p>Loading…</p></div>;

    return (
        <div>
            <p className="admin-subtitle" style={{ marginBottom: '16px' }}>
                One row per contractor actually assigned to each work type; fill in a rate to confirm it.
            </p>
            {contractorsByWorkType.size === 0 ? (
                <div className="admin-empty-state"><p>No contractors assigned to any Work yet; add one from a Work's "Contractors" action under the Works tab.</p></div>
            ) : (
                <div className="list-table finance-table">
                    {[...contractorsByWorkType.entries()].map(([workType, contractors]) => (
                        <div key={workType}>
                            <div className="rate-group-header"><span className="rate-group-bar" /><b>{workType}</b></div>
                            {contractors.map(c => {
                                const existing = findExisting(workType, c.vendorId);
                                const key = pairKey(workType, c.vendorId);
                                const entry = pending[key] || { rate: '' };
                                return (
                                    <div key={key} className="list-table-format row-item rate-row" style={{ gridTemplateColumns: '1.6fr 1.1fr 130px' }}>
                                        <p>{c.vendorName}</p>
                                        {existing ? (
                                            <span className="rate-entry-saved">₹{existing.ratePerSqft} / sqft</span>
                                        ) : (
                                            <input
                                                type="number" onWheel={e => e.target.blur()} min="0" step="any" className="rate-entry-input" placeholder="Rate ₹/sqft" value={entry.rate}
                                                onChange={e => setPendingField(key, 'rate', e.target.value)}
                                            />
                                        )}
                                        <div className="rate-entry-action">
                                            {existing ? (
                                                <p onClick={() => removeRate(existing._id)} className="cursor delete-action" style={{ margin: 0 }}>Remove</p>
                                            ) : (
                                                <button
                                                    type="button" className="add-point-btn" disabled={savingKey === key}
                                                    onClick={() => saveGridRate(workType, c.vendorId, key)}
                                                >
                                                    {savingKey === key ? 'Saving…' : 'Save'}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ContractorRatesManager;
