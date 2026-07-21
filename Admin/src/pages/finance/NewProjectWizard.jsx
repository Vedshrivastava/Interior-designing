import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useWebSocket } from '../../hooks/useWebSocket';
import WorkTypeRatesManager from '../../components/finance/WorkTypeRatesManager';
import WorksManager from '../../components/finance/WorksManager';
import ContractorRatesManager from '../../components/finance/ContractorRatesManager';
import WorkersManager from '../../components/finance/WorkersManager';
import { useProjectSupervisorConflictCheck } from '../../components/finance/useSupervisorConflictCheck';
import SettingSelectField, { registerSettingIfNew } from '../../components/finance/SettingSelectField';
import SettingPicker from '../../components/finance/SettingPicker';
import QuickAddPicker from '../../components/finance/QuickAddPicker';
import StyledSelect from '../../components/finance/StyledSelect';
import StyledDatePicker from '../../components/finance/StyledDatePicker';
import '../../styles/list.css';
import '../../styles/wizard.css';

const CONTRACT_TYPES = [
    { value: 'with_material', label: 'With Material', desc: 'You supply both labour and material; client billed per sqft, by work type.' },
    { value: 'without_material', label: 'Without Material', desc: "Labour only; client billed per sqft, by work type, same billing as With Material, you just don't supply material." },
    { value: 'advance', label: 'Advance', desc: 'Client pays an upfront advance (a % of an estimated total cost); billing then proceeds per sqft by work type exactly like With Material, with the advance drawn down against it before further cash changes hands.' },
];

const emptyBasic = {
    name: '', clientId: '', siteLocation: '', assignedSupervisor: '', assignedSupervisorId: '',
    startDate: '', estimatedAreaSqft: '', notes: '',
};

const NewProjectWizard = ({ url }) => {
    const navigate = useNavigate();
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [projectId, setProjectId] = useState(null);
    const [project, setProject] = useState(null); // full record once created, for status/flags
    const [basic, setBasic] = useState(emptyBasic);
    const [contractType, setContractType] = useState('');
    const [referralVendorId, setReferralVendorId] = useState('');
    const [materialTrackingEnabled, setMaterialTrackingEnabled] = useState(true);
    const [totalEstimatedCost, setTotalEstimatedCost] = useState('');
    const [advanceAmount, setAdvanceAmount] = useState('');
    const [advanceNotes, setAdvanceNotes] = useState('');
    const [advancePaymentMode, setAdvancePaymentMode] = useState('');
    const [advanceBankAccountId, setAdvanceBankAccountId] = useState('');
    const [advanceUtrNumber, setAdvanceUtrNumber] = useState('');
    const [paymentModes, setPaymentModes] = useState([]);
    const [bankAccounts, setBankAccounts] = useState([]);

    const { checkProjectSupervisor, modal: supervisorConflictModal } = useProjectSupervisorConflictCheck(url);

    const [cityOptions, setCityOptions] = useState([]);
    const [stepKey, setStepKey] = useState('basic');
    const [saving, setSaving] = useState(false);
    // Bumped by WorksManager (via onWorksChanged) whenever a Work or its
    // contractor/labour assignments change — same signal Project Detail's
    // Works & Rates tab uses to keep ContractorRatesManager/WorkersManager
    // in sync, since Step 4 now embeds the exact same trio of components.
    const [worksVersion, setWorksVersion] = useState(0);

    // Same WebSocket subscription Project Detail's Works & Rates tab uses —
    // without it, a Work created via WorkTypeRatesManager's or
    // ContractorRatesManager's own "+ Add Work" quick-add nudge (not
    // WorksManager's main button) never told this page's worksVersion to
    // bump, so the new Work just silently didn't appear in the Works table
    // until something else happened to trigger a refetch. Every relevant
    // controller already broadcasts its own projectId-scoped event; this
    // just needs to listen the same way Project Detail already does.
    const WORKS_SECTION_EVENTS = ['financeWorksChanged', 'financeWorkContractorAssignmentsChanged', 'financeWorkTypeRatesChanged', 'financeContractorRatesChanged', 'financeWorkLabourAssignmentsChanged'];
    useWebSocket(useCallback((msg) => {
        if (!projectId || msg.projectId !== projectId || !WORKS_SECTION_EVENTS.includes(msg.type)) return;
        setWorksVersion(v => v + 1);
    }, [projectId])); // eslint-disable-line react-hooks/exhaustive-deps

    const fetchPaymentModes = () =>
        axios.get(`${url}/api/finance/settings/list`, { ...authHeader, params: { settingType: 'payment_mode' } }).then(res => { if (res.data.success) setPaymentModes(res.data.data.map(s => s.name)); }).catch(() => {});

    useEffect(() => {
        axios.get(`${url}/api/finance/settings/list`, { ...authHeader, params: { settingType: 'city' } }).then(res => { if (res.data.success) setCityOptions(res.data.data); }).catch(() => {});
        fetchPaymentModes();
        axios.get(`${url}/api/finance/bank-accounts/list`, authHeader).then(res => { if (res.data.success) setBankAccounts(res.data.data); }).catch(() => {});
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    const steps = ['basic', 'type', 'setup', 'contractors', ...(contractType === 'advance' ? ['advance'] : []), 'activate'];
    const stepLabels = { basic: 'Basic Info', type: 'Contract Type', setup: 'Setup', contractors: 'Team & Rates', advance: 'Advance Payment', activate: 'Activate' };
    const stepIndex = steps.indexOf(stepKey);

    const setBasicField = (key, value) => setBasic(prev => ({ ...prev, [key]: value }));

    /* Step 1 → 2: just client-side validation, no API call yet */
    const goToType = () => {
        if (!basic.name.trim()) return toast.error('Project name is required');
        if (!basic.clientId) return toast.error('Client is required');
        setStepKey('type');
    };

    /* Step 2 → 3: creates (or updates) the draft project */
    const goToSetup = async () => {
        if (!contractType) return toast.error('Select a contract type');
        setSaving(true);
        try {
            const payload = { ...basic, contractType };
            await registerSettingIfNew(url, authHeader, 'city', basic.siteLocation, cityOptions);
            if (projectId) {
                await axios.post(`${url}/api/finance/projects/update`, { _id: projectId, ...payload }, authHeader);
            } else {
                const res = await axios.post(`${url}/api/finance/projects/add`, payload, authHeader);
                if (!res.data.success) { toast.error(res.data.message); return; }
                setProjectId(res.data.data._id);
                setProject(res.data.data);
                setMaterialTrackingEnabled(contractType !== 'without_material');
                toast.success('Project draft created');
            }
            setStepKey('setup');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error saving project');
        } finally { setSaving(false); }
    };

    /* Step 3 → 4: persist the conditional setup fields */
    const goToContractors = async () => {
        if (contractType === 'advance' && !advanceAmount) {
            return toast.error('Advance amount is required for Advance projects');
        }
        setSaving(true);
        try {
            const res = await axios.post(`${url}/api/finance/projects/update`, {
                _id: projectId,
                ...basic,
                contractType,
                referralVendorId: referralVendorId || null,
                materialTrackingEnabled,
                totalEstimatedCost: contractType === 'advance' ? totalEstimatedCost : 0,
                advanceAmount: contractType === 'advance' ? advanceAmount : 0,
            }, authHeader);
            if (!res.data.success) { toast.error(res.data.message); return; }
            // /update only returns {success, message}, not the saved record —
            // Team & Rates needs referralVendorId populated with a name (same
            // "Referral Person: X" line Project Detail's own Works & Rates tab
            // shows), so re-fetch the real, populated project here.
            const projectRes = await axios.get(`${url}/api/finance/projects/${projectId}`, authHeader);
            if (projectRes.data.success) setProject(projectRes.data.data.project);
            setStepKey('contractors');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error saving setup');
        } finally { setSaving(false); }
    };

    const goToAdvanceOrActivate = () => setStepKey(contractType === 'advance' ? 'advance' : 'activate');

    const markInvoiced = async () => {
        try {
            const res = await axios.post(`${url}/api/finance/projects/advance-invoiced`, { _id: projectId }, authHeader);
            if (res.data.success) { toast.success(res.data.message); setProject(res.data.data); }
            else toast.error(res.data.message);
        } catch { toast.error('Error updating advance status'); }
    };

    const markReceived = async () => {
        try {
            const res = await axios.post(`${url}/api/finance/projects/advance-received`, {
                _id: projectId, notes: advanceNotes,
                paymentMode: advancePaymentMode, bankAccountId: advanceBankAccountId, utrNumber: advanceUtrNumber,
            }, authHeader);
            if (res.data.success) {
                toast.success(res.data.message);
                setProject(res.data.data);
            }
            else toast.error(res.data.message);
        } catch { toast.error('Error recording advance payment'); }
    };

    const activate = async () => {
        setSaving(true);
        try {
            const res = await axios.post(`${url}/api/finance/projects/activate`, { _id: projectId }, authHeader);
            if (res.data.success) {
                toast.success(res.data.message);
                navigate(`/finance/projects/${projectId}`);
            } else {
                toast.error(res.data.message);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error activating project');
        } finally { setSaving(false); }
    };

    const back = () => setStepKey(steps[Math.max(0, stepIndex - 1)]);

    // Single source of truth for the primary (right-most) action per step —
    // rendered once in the header instead of repeated at the bottom of
    // every step block, now that there's no more boxed card giving each
    // step its own visual "footer."
    const primaryAction = {
        basic:       { label: 'Next: Contract Type',   onClick: goToType },
        type:        { label: saving ? 'Saving…' : 'Next: Setup',              onClick: goToSetup,           disabled: saving },
        setup:       { label: saving ? 'Saving…' : 'Next: Team & Rates',       onClick: goToContractors,     disabled: saving },
        contractors: { label: contractType === 'advance' ? 'Next: Advance Payment' : 'Next: Activate', onClick: goToAdvanceOrActivate },
        advance:     { label: 'Next: Activate',        onClick: () => setStepKey('activate') },
        activate:    { label: saving ? 'Activating…' : 'Activate Project',     onClick: activate,            disabled: saving },
    }[stepKey];

    return (
        <div className="list add flex-col">
            <div className="admin-list-container">
                <div className="admin-header-split">
                    <div>
                        <h1>New Project</h1>
                        <p className="admin-subtitle">
                            {projectId
                                ? 'Draft saved as you go; you can leave and come back any time from All Projects.'
                                : 'A guided setup: rates and teams get configured before this project can go live.'}
                        </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                        {projectId && (
                            <button type="button" className="add-btn cancel-btn" onClick={() => navigate('/finance/projects')}>Save & Exit</button>
                        )}
                        {stepIndex > 0 && (
                            <button type="button" className="add-btn cancel-btn" onClick={back}>Back</button>
                        )}
                        <button type="button" className="add-btn" disabled={primaryAction.disabled} onClick={primaryAction.onClick}>
                            {primaryAction.label}
                        </button>
                    </div>
                </div>

                <div className="wizard-steps">
                    {steps.map((s, i) => (
                        <React.Fragment key={s}>
                            <div className={`wizard-step${s === stepKey ? ' active' : i < stepIndex ? ' done' : ''}`}>
                                <span className="wizard-step-dot">{i + 1}</span>
                                {stepLabels[s]}
                            </div>
                            {i < steps.length - 1 && <div className="wizard-step-sep" />}
                        </React.Fragment>
                    ))}
                </div>

                <div className="wizard-step-body">

                    {/* ── Step 1: Basic Info ── */}
                    {stepKey === 'basic' && (
                        <>
                            <h2>Basic Info</h2>
                            <p className="wizard-section-label">Project</p>
                            <div className="wizard-field-grid">
                                <div className="add-product-name flex-col">
                                    <p>Project Name *</p>
                                    <input type="text" value={basic.name} onChange={e => setBasicField('name', e.target.value)} placeholder="e.g. Malhotra Residence, Phase 1" />
                                </div>
                                <div className="add-product-name flex-col">
                                    <p>Client *</p>
                                    <QuickAddPicker url={url} resourceKey="clients" value={basic.clientId}
                                        onChange={v => setBasicField('clientId', v)} placeholder="Select client…" />
                                </div>
                                <div className="add-product-name flex-col">
                                    <p>Site Location</p>
                                    <SettingSelectField
                                        settingType="city" options={cityOptions}
                                        value={basic.siteLocation} onChange={v => setBasicField('siteLocation', v)}
                                        placeholder="City or area…"
                                    />
                                </div>
                                <div className="add-product-name flex-col">
                                    <p>Assigned Supervisor</p>
                                    <QuickAddPicker url={url} resourceKey="employees" value={basic.assignedSupervisorId}
                                        onChange={v => {
                                            setBasicField('assignedSupervisorId', v);
                                            if (v) checkProjectSupervisor(v, projectId);
                                        }}
                                        filter={e => e.role === 'supervisor'} presetValues={{ role: 'supervisor' }}
                                        placeholder="None" />
                                </div>
                            </div>

                            <p className="wizard-section-label">Scope</p>
                            <div className="wizard-field-grid">
                                <div className="add-product-name flex-col">
                                    <p>Start Date</p>
                                    <StyledDatePicker value={basic.startDate} onChange={v => setBasicField('startDate', v)} />
                                </div>
                                <div className="add-product-name flex-col">
                                    <p>Estimated Area</p>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <input type="number" onWheel={e => e.target.blur()} min="0" value={basic.estimatedAreaSqft} onChange={e => setBasicField('estimatedAreaSqft', e.target.value)} placeholder="0" style={{ flex: 1 }} />
                                        <span className="admin-subtitle" style={{ whiteSpace: 'nowrap' }}>sqft</span>
                                    </div>
                                </div>
                                <div className="add-product-name flex-col wizard-field-full">
                                    <p>Notes</p>
                                    <textarea rows="3" value={basic.notes} onChange={e => setBasicField('notes', e.target.value)} placeholder="Anything worth knowing before this project is set up…" />
                                </div>
                            </div>
                        </>
                    )}

                    {/* ── Step 2: Contract Type ── */}
                    {stepKey === 'type' && (
                        <>
                            <h2>Select Contract Type</h2>
                            <div className="wizard-type-grid">
                                {CONTRACT_TYPES.map(ct => (
                                    <button type="button" key={ct.value}
                                        className={`wizard-type-card${contractType === ct.value ? ' active' : ''}`}
                                        onClick={() => setContractType(ct.value)}>
                                        <h4>{ct.label}</h4>
                                        <p>{ct.desc}</p>
                                    </button>
                                ))}
                            </div>
                        </>
                    )}

                    {/* ── Step 3: Conditional setup ── */}
                    {stepKey === 'setup' && (
                        <>
                            <h2>Setup: {CONTRACT_TYPES.find(c => c.value === contractType)?.label}</h2>

                            <p className="wizard-section-label">Referral</p>
                            <div className="add-product-name flex-col" style={{ maxWidth: '420px' }}>
                                <p>Referral Vendor (middleman, optional)</p>
                                <QuickAddPicker url={url} resourceKey="vendors" value={referralVendorId}
                                    onChange={setReferralVendorId}
                                    filter={v => v.vendorType === 'referral' || v.vendorType === 'other'}
                                    presetValues={{ vendorType: 'referral' }} placeholder="None" />
                            </div>
                            {contractType === 'advance' && referralVendorId && (
                                <p className="wizard-hidden-note" style={{ marginTop: '10px' }}>Commission for an Advance project's referral is a flat amount, entered manually when this project is marked Completed, not computed from sqft.</p>
                            )}

                            <p className="wizard-section-label">Material Tracking</p>
                            {contractType === 'without_material' ? (
                                <p className="wizard-hidden-note">Material tracking isn't applicable: this contract is labour only.</p>
                            ) : contractType === 'with_material' ? (
                                <p className="wizard-hidden-note">Material tracking is on for this contract (With Material always tracks material).</p>
                            ) : (
                                <>
                                    <p className="admin-subtitle" style={{ margin: '0 0 12px' }}>Advance clients don't always get material supplied by the studio; your call, per project.</p>
                                    <label className="featured-toggle" style={{ margin: 0, display: 'flex' }}>
                                        <input type="checkbox" checked={materialTrackingEnabled} onChange={e => setMaterialTrackingEnabled(e.target.checked)} />
                                        <span className="toggle-slider"></span>
                                        <span className="toggle-label">Track material for this project too</span>
                                    </label>
                                </>
                            )}

                            {contractType === 'advance' && (
                                <>
                                    <p className="wizard-section-label">Advance Details</p>
                                    <div className="wizard-field-grid">
                                        <div className="add-product-name flex-col">
                                            <p>Total Estimated Cost (₹, optional context)</p>
                                            <input type="number" onWheel={e => e.target.blur()} min="0" value={totalEstimatedCost} onChange={e => setTotalEstimatedCost(e.target.value)} placeholder="0" />
                                        </div>
                                        <div className="add-product-name flex-col">
                                            <p>Advance Amount (₹) *</p>
                                            <input type="number" onWheel={e => e.target.blur()} min="0" value={advanceAmount} onChange={e => setAdvanceAmount(e.target.value)} placeholder="0" />
                                        </div>
                                    </div>
                                </>
                            )}
                        </>
                    )}

                    {/* ── Step 4: Team & Rates — the exact same Works, Work Type
                         Rates, Contractor Rates, and Labour Rates components
                         Project Detail's own Works & Rates tab uses (WorksManager's
                         Add Work/Manage Contractors/Manage Labour modals included),
                         so Works can be created with their contractor + labour
                         teams right here instead of waiting until after
                         activation. Setup (Step 3) no longer has its own Work
                         Type Rates section — this is the only place that sets it,
                         same as Project Detail. ── */}
                    {stepKey === 'contractors' && (
                        <>
                            <h2>Team &amp; Rates</h2>
                            <WorksManager url={url} projectId={projectId} worksVersion={worksVersion} onWorksChanged={() => setWorksVersion(v => v + 1)} />
                            <div style={{ marginTop: '32px' }}>
                                <WorkTypeRatesManager url={url} projectId={projectId} worksVersion={worksVersion} referralVendorName={project?.referralVendorId?.name} />
                            </div>
                            <h3 style={{ margin: '28px 0 8px' }}>Contractor Rates</h3>
                            <ContractorRatesManager url={url} projectId={projectId} worksVersion={worksVersion} />
                            <h3 style={{ margin: '28px 0 8px' }}>Labour Rates</h3>
                            <WorkersManager url={url} projectId={projectId} worksVersion={worksVersion} />
                        </>
                    )}

                    {/* ── Step 5: Advance-only — book the upfront payment ── */}
                    {stepKey === 'advance' && (
                        <>
                            <h2>Record the Advance Invoice &amp; Receipt</h2>
                            <div className="wizard-advance-summary">
                                <p className="admin-subtitle" style={{ margin: 0 }}>Advance Amount</p>
                                <p className="wizard-advance-amount">₹{(Number(advanceAmount) || 0).toLocaleString('en-IN')}</p>
                            </div>

                            <p className="wizard-section-label">Step 1 · Invoice</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                                <p className="admin-subtitle" style={{ margin: 0 }}>Once the advance invoice has been sent to the client, mark it here.</p>
                                <button type="button" className="add-point-btn" disabled={project?.advanceInvoiced} onClick={markInvoiced}>
                                    {project?.advanceInvoiced ? '✓ Marked Invoiced' : 'Mark Advance Invoiced'}
                                </button>
                            </div>

                            <p className="wizard-section-label">Step 2 · Receipt</p>
                            <p className="admin-subtitle" style={{ margin: '0 0 16px' }}>How the client actually paid it; this becomes a real receipt against this project.</p>
                            <div className="add-product-name flex-col" style={{ marginBottom: '20px' }}>
                                <p>Payment Mode</p>
                                <SettingPicker
                                    url={url} settingType="payment_mode" options={paymentModes} onAdded={fetchPaymentModes}
                                    value={advancePaymentMode} onChange={setAdvancePaymentMode} placeholder="Cash, Bank Transfer, Cheque…"
                                />
                            </div>
                            <div className="wizard-field-grid">
                                <div className="add-product-name flex-col">
                                    <p>Received Into (Your Bank Account)</p>
                                    <StyledSelect
                                        value={advanceBankAccountId} onChange={setAdvanceBankAccountId} placeholder="Cash, no bank account"
                                        options={bankAccounts.map(a => ({ value: a._id, label: `${a.accountName} · ${a.bankName}` }))}
                                    />
                                </div>
                                <div className="add-product-name flex-col">
                                    <p>UTR / Cheque Number</p>
                                    <input type="text" value={advanceUtrNumber} onChange={e => setAdvanceUtrNumber(e.target.value)} placeholder="Optional, reference number for this payment" />
                                </div>
                                <div className="add-product-name flex-col wizard-field-full">
                                    <p>Receipt Notes</p>
                                    <textarea rows="3" value={advanceNotes} onChange={e => setAdvanceNotes(e.target.value)} placeholder="Any other detail worth keeping on record" />
                                </div>
                            </div>
                            <button type="button" className="add-btn" style={{ marginTop: '4px' }} disabled={project?.advanceReceived} onClick={markReceived}>
                                {project?.advanceReceived ? '✓ Payment Recorded' : 'Record Advance Received'}
                            </button>
                        </>
                    )}

                    {/* ── Step 6: Activate ── */}
                    {stepKey === 'activate' && (
                        <>
                            <h2>Project Goes Live</h2>
                            <p className="admin-subtitle">
                                Activating unlocks Daily Work Report entry for this project. If anything required is
                                still missing (a work type rate, a contractor rate, or, for Advance, the payment),
                                activation will tell you exactly what's left.
                            </p>
                        </>
                    )}

                </div>
            </div>
            {supervisorConflictModal}
        </div>
    );
};

export default NewProjectWizard;
