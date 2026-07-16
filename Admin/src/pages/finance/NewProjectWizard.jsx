import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import WorkTypeRatesManager from '../../components/finance/WorkTypeRatesManager';
import ContractorRatesManager from '../../components/finance/ContractorRatesManager';
import SettingSelectField, { registerSettingIfNew } from '../../components/finance/SettingSelectField';
import QuickAddPicker from '../../components/finance/QuickAddPicker';
import '../../styles/list.css';
import '../../styles/wizard.css';

const CONTRACT_TYPES = [
    { value: 'with_material', label: 'With Material', desc: 'You supply both labour and material; client billed per sqft, by work type.' },
    { value: 'without_material', label: 'Without Material', desc: "Labour only; client billed per sqft, by work type — same billing as With Material, you just don't supply material." },
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
    const [contractPercentage, setContractPercentage] = useState('');
    const [advanceNotes, setAdvanceNotes] = useState('');

    const [cityOptions, setCityOptions] = useState([]);
    const [stepKey, setStepKey] = useState('basic');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        axios.get(`${url}/api/finance/settings/list`, { ...authHeader, params: { settingType: 'city' } }).then(res => { if (res.data.success) setCityOptions(res.data.data); }).catch(() => {});
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    const steps = ['basic', 'type', 'setup', 'contractors', ...(contractType === 'advance' ? ['advance'] : []), 'activate'];
    const stepLabels = { basic: 'Basic Info', type: 'Contract Type', setup: 'Setup', contractors: 'Contractor Rates', advance: 'Advance Payment', activate: 'Activate' };
    const stepIndex = steps.indexOf(stepKey);

    const advanceAmount = (Number(totalEstimatedCost) || 0) * (Number(contractPercentage) || 0) / 100;

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
        if (contractType === 'advance' && (!totalEstimatedCost || !contractPercentage)) {
            return toast.error('Total estimated cost and contract percentage are required for Advance projects');
        }
        setSaving(true);
        try {
            const res = await axios.post(`${url}/api/finance/projects/update`, {
                _id: projectId,
                ...basic,
                contractType,
                referralVendorId: contractType === 'advance' ? null : (referralVendorId || null),
                materialTrackingEnabled,
                totalEstimatedCost: contractType === 'advance' ? totalEstimatedCost : 0,
                contractPercentage: contractType === 'advance' ? contractPercentage : 0,
            }, authHeader);
            if (!res.data.success) { toast.error(res.data.message); return; }
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
            const res = await axios.post(`${url}/api/finance/projects/advance-received`, { _id: projectId, notes: advanceNotes }, authHeader);
            if (res.data.success) { toast.success(res.data.message); setProject(res.data.data); }
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

    return (
        <div className="list add flex-col">
            <div className="admin-list-container">
                <div className="admin-header-split">
                    <div>
                        <h1>New Project</h1>
                        <p className="admin-subtitle">
                            {projectId
                                ? 'Draft saved as you go — you can leave and come back any time from All Projects.'
                                : 'A guided setup — rates and teams get configured before this project can go live.'}
                        </p>
                    </div>
                    {projectId && (
                        <button type="button" className="add-point-btn" onClick={() => navigate('/finance/projects')}>Save & Exit</button>
                    )}
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

                <div className="edit-modal" style={{ boxShadow: 'none', maxWidth: '100%' }}>

                    {/* ── Step 1: Basic Info ── */}
                    {stepKey === 'basic' && (
                        <>
                            <h2>Basic Info</h2>
                            <div className="wizard-field-grid">
                                <div className="add-product-name flex-col">
                                    <p>Project Name *</p>
                                    <input type="text" value={basic.name} onChange={e => setBasicField('name', e.target.value)} />
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
                                    />
                                </div>
                                <div className="add-product-name flex-col">
                                    <p>Assigned Supervisor</p>
                                    <QuickAddPicker url={url} resourceKey="employees" value={basic.assignedSupervisorId}
                                        onChange={v => setBasicField('assignedSupervisorId', v)} placeholder="— None —" />
                                </div>
                                <div className="add-product-name flex-col">
                                    <p>Assigned Supervisor (free text, legacy)</p>
                                    <input type="text" value={basic.assignedSupervisor} onChange={e => setBasicField('assignedSupervisor', e.target.value)} placeholder="Only used if no supervisor is picked above" />
                                </div>
                                <div className="add-product-name flex-col">
                                    <p>Start Date</p>
                                    <input type="date" value={basic.startDate} onChange={e => setBasicField('startDate', e.target.value)} />
                                </div>
                                <div className="add-product-name flex-col">
                                    <p>Estimated Area (sqft)</p>
                                    <input type="number" value={basic.estimatedAreaSqft} onChange={e => setBasicField('estimatedAreaSqft', e.target.value)} />
                                </div>
                                <div className="add-product-name flex-col wizard-field-full">
                                    <p>Notes</p>
                                    <textarea rows="3" value={basic.notes} onChange={e => setBasicField('notes', e.target.value)} />
                                </div>
                            </div>
                            <div className="wizard-actions">
                                <span />
                                <button type="button" className="add-btn" onClick={goToType}>Next: Contract Type</button>
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
                            <div className="wizard-actions">
                                <button type="button" className="add-btn cancel-btn" onClick={back}>Back</button>
                                <button type="button" className="add-btn" disabled={saving} onClick={goToSetup}>
                                    {saving ? 'Saving…' : 'Next: Setup'}
                                </button>
                            </div>
                        </>
                    )}

                    {/* ── Step 3: Conditional setup ── */}
                    {stepKey === 'setup' && (
                        <>
                            <h2>Setup — {CONTRACT_TYPES.find(c => c.value === contractType)?.label}</h2>

                            <WorkTypeRatesManager url={url} projectId={projectId} />

                            {contractType !== 'advance' && (
                                <div className="add-product-name flex-col" style={{ marginTop: '24px' }}>
                                    <p>Referral Vendor (middleman) — optional</p>
                                    <QuickAddPicker url={url} resourceKey="vendors" value={referralVendorId}
                                        onChange={setReferralVendorId}
                                        filter={v => v.vendorType === 'referral' || v.vendorType === 'other'}
                                        presetValues={{ vendorType: 'referral' }} placeholder="— None —" />
                                </div>
                            )}
                            {contractType === 'advance' && (
                                <p className="wizard-hidden-note" style={{ marginTop: '24px' }}>Referral vendor isn't applicable to Advance contracts.</p>
                            )}

                            {contractType === 'without_material' ? (
                                <p className="wizard-hidden-note">Material tracking isn't applicable — this contract is labour only.</p>
                            ) : contractType === 'with_material' ? (
                                <p className="wizard-hidden-note">Material tracking is on for this contract (With Material always tracks material).</p>
                            ) : (
                                <label className="featured-toggle" style={{ margin: '16px 0', display: 'flex' }}>
                                    <input type="checkbox" checked={materialTrackingEnabled} onChange={e => setMaterialTrackingEnabled(e.target.checked)} />
                                    <span className="toggle-slider"></span>
                                    <span className="toggle-label">Track material for this project too</span>
                                </label>
                            )}

                            {contractType === 'advance' && (
                                <div className="wizard-field-grid" style={{ marginTop: '20px' }}>
                                    <div className="add-product-name flex-col">
                                        <p>Total Estimated Cost (₹) *</p>
                                        <input type="number" value={totalEstimatedCost} onChange={e => setTotalEstimatedCost(e.target.value)} />
                                    </div>
                                    <div className="add-product-name flex-col">
                                        <p>Contract Percentage (%) *</p>
                                        <input type="number" value={contractPercentage} onChange={e => setContractPercentage(e.target.value)} />
                                    </div>
                                    <div className="wizard-advance-summary wizard-field-full">
                                        <p className="admin-subtitle" style={{ margin: 0 }}>Advance Amount (auto-computed)</p>
                                        <p className="wizard-advance-amount">₹{advanceAmount.toLocaleString('en-IN')}</p>
                                    </div>
                                </div>
                            )}

                            <div className="wizard-actions">
                                <button type="button" className="add-btn cancel-btn" onClick={back}>Back</button>
                                <button type="button" className="add-btn" disabled={saving} onClick={goToContractors}>
                                    {saving ? 'Saving…' : 'Next: Contractor Rates'}
                                </button>
                            </div>
                        </>
                    )}

                    {/* ── Step 4: Contractor assignment & rates ── */}
                    {stepKey === 'contractors' && (
                        <>
                            <h2>Contractor Assignment &amp; Rates</h2>
                            <ContractorRatesManager url={url} projectId={projectId} />
                            <div className="wizard-actions">
                                <button type="button" className="add-btn cancel-btn" onClick={back}>Back</button>
                                <button type="button" className="add-btn" onClick={goToAdvanceOrActivate}>
                                    {contractType === 'advance' ? 'Next: Advance Payment' : 'Next: Activate'}
                                </button>
                            </div>
                        </>
                    )}

                    {/* ── Step 5: Advance-only — book the upfront payment ── */}
                    {stepKey === 'advance' && (
                        <>
                            <h2>Record the Advance Invoice &amp; Receipt</h2>
                            <div className="wizard-advance-summary">
                                <p className="admin-subtitle" style={{ margin: 0 }}>Advance Amount</p>
                                <p className="wizard-advance-amount">₹{Number(totalEstimatedCost * contractPercentage / 100 || 0).toLocaleString('en-IN')}</p>
                            </div>

                            <div className="add-product-name flex-col" style={{ margin: '16px 0' }}>
                                <p>Receipt Notes</p>
                                <textarea rows="3" value={advanceNotes} onChange={e => setAdvanceNotes(e.target.value)} placeholder="e.g. Cheque #, bank, date received…" />
                            </div>

                            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                <button type="button" className="add-point-btn" disabled={project?.advanceInvoiced} onClick={markInvoiced}>
                                    {project?.advanceInvoiced ? '✓ Marked Invoiced' : 'Mark Advance Invoiced'}
                                </button>
                                <button type="button" className="add-point-btn" disabled={project?.advanceReceived} onClick={markReceived}>
                                    {project?.advanceReceived ? '✓ Payment Recorded' : 'Record Advance Received'}
                                </button>
                            </div>

                            <div className="wizard-actions">
                                <button type="button" className="add-btn cancel-btn" onClick={back}>Back</button>
                                <button type="button" className="add-btn" onClick={() => setStepKey('activate')}>Next: Activate</button>
                            </div>
                        </>
                    )}

                    {/* ── Step 6: Activate ── */}
                    {stepKey === 'activate' && (
                        <>
                            <h2>Project Goes Live</h2>
                            <p className="admin-subtitle">
                                Activating unlocks Daily Work Report entry for this project. If anything required is
                                still missing — a work type rate, a contractor rate, or (for Advance) the payment — activation
                                will tell you exactly what's left.
                            </p>
                            <div className="wizard-actions">
                                <button type="button" className="add-btn cancel-btn" onClick={back}>Back</button>
                                <button type="button" className="add-btn" disabled={saving} onClick={activate}>
                                    {saving ? 'Activating…' : 'Activate Project'}
                                </button>
                            </div>
                        </>
                    )}

                </div>
            </div>
        </div>
    );
};

export default NewProjectWizard;
