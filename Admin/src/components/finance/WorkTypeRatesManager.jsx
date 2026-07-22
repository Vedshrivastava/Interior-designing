import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import AddWorkModal from './AddWorkModal';
import '../../styles/list.css';
import '../../styles/wizard.css';
import '../../styles/add.css';

/* Manages financeWorkTypeRate rows for one project — used identically on
   both Project Detail's Works & Rates tab and the New Project wizard's
   Team & Rates step. Owns its own "Work Type Rates" heading, so both pages
   render this section byte-for-byte the same way instead of each supplying
   their own wrapper markup.

   A work type rate only ever makes sense once this project has a real Work
   of that type — there's no free "pick any work type and rate it" path
   (there used to be one, a settings-master-list picker, but every caller
   already passes worksVersion, so that path was permanently unreachable
   dead code, not an actual fallback). So before any real Work exists, this
   is just a nudge to add one (opens the same AddWorkModal every other
   "Add Work" trigger uses); once real Works exist, one row per real work
   type: a saved rate shows read-only + Remove, an unset one shows inline
   Client/Referral inputs + Save — mirroring ContractorRatesManager/
   WorkersManager's own grids exactly. */
const WorkTypeRatesManager = ({ url, projectId, worksVersion, referralVendorName }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [items, setItems] = useState([]);
    // null until this project has at least one real Work — gates the grid
    // vs. empty-state choice below. Deliberately distinct from loading
    // below: null must only ever mean "checked, there genuinely aren't
    // any", never "haven't checked yet".
    const [realWorkTypes, setRealWorkTypes] = useState(null);
    const [loading, setLoading] = useState(true);
    const [addWorkOpen, setAddWorkOpen] = useState(false);

    // Pending rate per unset work type, keyed by workType, and which one
    // is currently being saved.
    const [pending, setPending] = useState({});
    const [savingKey, setSavingKey] = useState(null);

    const fetchList = async () => {
        try {
            const res = await axios.get(`${url}/api/finance/work-type-rates/list`, { ...authHeader, params: { projectId } });
            if (res.data.success) setItems(res.data.data);
        } catch { toast.error('Error fetching work type rates'); }
    };

    const refreshRealWorkTypes = async () => {
        if (!projectId) return;
        try {
            const res = await axios.get(`${url}/api/finance/works/list`, { ...authHeader, params: { projectId } });
            const fromWorks = res.data.success ? [...new Set(res.data.data.map(w => w.workType))] : [];
            setRealWorkTypes(fromWorks.length ? new Set(fromWorks) : null);
        } catch { /* leave as-is */ }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchList(); refreshRealWorkTypes(); }, [projectId, worksVersion]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleWorkCreated = async () => {
        setAddWorkOpen(false);
        await refreshRealWorkTypes();
    };

    const setPendingField = (workType, field, value) =>
        setPending(prev => ({ ...prev, [workType]: { ...(prev[workType] || { clientRate: '', referralRate: '' }), [field]: value } }));

    const saveGridRate = async (workType) => {
        const entry = pending[workType] || { clientRate: '', referralRate: '' };
        if (entry.clientRate === '') { toast.error('Client rate is required'); return; }
        setSavingKey(workType);
        try {
            const payload = { projectId, workType, clientRatePerSqft: entry.clientRate, referralRatePerSqft: entry.referralRate || 0 };
            const res = await axios.post(`${url}/api/finance/work-type-rates/add`, payload, authHeader);
            if (res.data.success) {
                toast.success(res.data.message || 'Rate saved');
                setPending(prev => { const next = { ...prev }; delete next[workType]; return next; });
                await fetchList();
            } else toast.error(res.data.message);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error saving rate');
        } finally { setSavingKey(null); }
    };

    const removeRate = async (_id) => {
        try {
            const res = await axios.post(`${url}/api/finance/work-type-rates/remove`, { _id }, authHeader);
            if (res.data.success) { toast.success(res.data.message); await fetchList(); }
            else toast.error(res.data.message);
        } catch { toast.error('Error removing rate'); }
    };

    const findExisting = (workType) => items.find(i => i.workType === workType);

    return (
        <div>
            <div className="wt-rates-header">
                <h3 style={{ margin: 0 }}>Work Type Rates</h3>
                {!loading && realWorkTypes === null && (
                    <button type="button" className="add-btn" onClick={() => setAddWorkOpen(true)}>+ Add Work</button>
                )}
            </div>
            <p className="admin-subtitle" style={{ margin: '4px 0 12px' }}>
                Referral Person: {referralVendorName || 'None'}
            </p>

            {loading ? (
                <div className="admin-empty-state"><p>Loading…</p></div>
            ) : realWorkTypes === null ? (
                <div className="admin-empty-state"><p>No Works added to this project yet; add one to set its client rate and referral cut.</p></div>
            ) : (
                <>
                    <p className="admin-subtitle" style={{ marginBottom: '16px' }}>
                        One row per work type this project actually has; fill in a rate to confirm it.
                    </p>
                    <div className="list-table finance-table">
                        <div className="list-table-format title" style={{ gridTemplateColumns: '1.2fr 1.2fr 1.2fr 1fr' }}>
                            <b>Work Type</b><b>Client Rate</b><b>Referral Cut</b><b>Action</b>
                        </div>
                        {[...realWorkTypes].map(workType => {
                            const existing = findExisting(workType);
                            const entry = pending[workType] || { clientRate: '', referralRate: '' };
                            return (
                                <div
                                    key={workType} className="list-table-format row-item"
                                    style={{ gridTemplateColumns: '1.2fr 1.2fr 1.2fr 1fr', alignItems: 'start' }}
                                >
                                    <p>{workType}</p>
                                    {existing ? (
                                        <>
                                            <p className="rate-entry-saved">₹{existing.clientRatePerSqft}/sqft</p>
                                            <p className="rate-entry-saved">₹{existing.referralRatePerSqft}/sqft</p>
                                            <div className="action-buttons">
                                                <p onClick={() => removeRate(existing._id)} className="cursor delete-action">Remove</p>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <input
                                                type="number" onWheel={e => e.target.blur()} min="0" step="any" className="rate-entry-input" placeholder="₹/sqft" value={entry.clientRate} style={{ width: '100%' }}
                                                onChange={e => setPendingField(workType, 'clientRate', e.target.value)}
                                            />
                                            <input
                                                type="number" onWheel={e => e.target.blur()} min="0" step="any" className="rate-entry-input" placeholder="₹/sqft" value={entry.referralRate} style={{ width: '100%' }}
                                                onChange={e => setPendingField(workType, 'referralRate', e.target.value)}
                                            />
                                            <div className="action-buttons">
                                                <button
                                                    type="button" className="add-point-btn" disabled={savingKey === workType}
                                                    onClick={() => saveGridRate(workType)}
                                                >
                                                    {savingKey === workType ? 'Saving…' : 'Save'}
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {addWorkOpen && (
                <AddWorkModal url={url} projectId={projectId} onClose={() => setAddWorkOpen(false)} onSaved={handleWorkCreated} />
            )}
        </div>
    );
};

export default WorkTypeRatesManager;
