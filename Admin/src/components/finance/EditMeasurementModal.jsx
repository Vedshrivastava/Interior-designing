import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons';

/*
 * Edit a measurement already logged. Area Covered and Material Used ARE
 * editable here — updateMeasurement/updateLabourMeasurement (Backend/
 * controllers/financeMeasurement.js, financeLabourMeasurement.js)
 * reconcile both side effects a change would otherwise desync: the work's
 * completedAreaSqft is adjusted by the delta, and the old consume stock
 * movements are reversed and replaced with new ones sized to the new
 * materialUsed (checked against stock the same way addMeasurement does).
 * Blocked server-side once a contractor measurement is part of an issued
 * running bill — that's enforced by the backend, not re-implemented here.
 *
 * Field set mirrors exactly what each backend endpoint accepts: contractor
 * → supervisorName, remarks, engineerApproved, areaCoveredSqft,
 * materialUsed; labour → remarks, areaCoveredSqft, materialUsed (no
 * engineerApproved — financeLabourMeasurement has no such field).
 *
 * Reuses AddMeasurementModal's amm-overlay/amm-modal/amm-modal-header/
 * -body/-footer scoping classes rather than defining new em- ones — the
 * shape (bottom sheet on mobile, header/body/footer split) is mechanically
 * identical, so the existing CSS (dashboard.css) already covers this
 * modal with zero changes.
 */
const EditMeasurementModal = ({ url, record, onClose, onSaved }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const { kind, data: m } = record;
    const isContractor = kind === 'contractor';

    const [supervisorName, setSupervisorName] = useState(isContractor ? (m.supervisorName || '') : '');
    const [remarks, setRemarks] = useState(m.remarks || '');
    const [engineerApproved, setEngineerApproved] = useState(isContractor ? !!m.engineerApproved : false);
    const [areaCoveredSqft, setAreaCoveredSqft] = useState(String(m.areaCoveredSqft ?? ''));
    const [saving, setSaving] = useState(false);

    const [materialTrackingEnabled, setMaterialTrackingEnabled] = useState(false);
    const [materials, setMaterials] = useState([]);
    const [materialLines, setMaterialLines] = useState([]);
    const [materialsLoading, setMaterialsLoading] = useState(true);

    const partyName = isContractor ? (m.contractorVendorId?.name || '-') : (m.labourerId?.name || '-');
    const workType = m.workId?.workType;
    const workLabel = `${workType || '-'}${m.workId?.workOrderNumber ? ` (${m.workId.workOrderNumber})` : ''}`;

    // Which materials apply to this Work is fixed by its work type
    // (financeMaterial.workTypes), same derivation as AddMeasurementModal —
    // the checklist starts from that fixed set, pre-filled with whatever
    // quantity this measurement already has recorded for each.
    useEffect(() => {
        Promise.all([
            axios.get(`${url}/api/finance/materials/list`, authHeader),
            axios.get(`${url}/api/finance/projects/${m.projectId?._id || m.projectId}`, authHeader),
        ]).then(([materialsRes, projectRes]) => {
            const allMaterials = materialsRes.data.success ? materialsRes.data.data : [];
            setMaterials(allMaterials);
            const tracking = !!projectRes.data?.data?.project?.materialTrackingEnabled;
            setMaterialTrackingEnabled(tracking);

            const applicable = allMaterials.filter(mat => !mat.workTypes?.length || mat.workTypes.includes(workType));
            const existingByMaterial = new Map((m.materialUsed || []).map(l => [(l.materialId?._id || l.materialId), l.quantity]));
            setMaterialLines(applicable.map(mat => ({
                materialId: mat._id,
                quantity: existingByMaterial.has(mat._id) ? String(existingByMaterial.get(mat._id)) : '',
            })));
        }).catch(() => {}).finally(() => setMaterialsLoading(false));
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    const setMaterialLine = (idx, key, value) => setMaterialLines(prev => prev.map((l, i) => i === idx ? { ...l, [key]: value } : l));

    const submit = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!areaCoveredSqft || Number(areaCoveredSqft) <= 0) return toast.error('Area covered must be greater than zero');
        if (materialTrackingEnabled && !materialLines.some(l => l.materialId && Number(l.quantity) > 0)) {
            return toast.error('At least one material used is required');
        }

        const payload = {
            _id: m._id,
            remarks,
            areaCoveredSqft: Number(areaCoveredSqft),
            materialUsed: materialLines.filter(l => l.materialId && Number(l.quantity) > 0),
        };
        if (isContractor) { payload.supervisorName = supervisorName; payload.engineerApproved = engineerApproved; }

        setSaving(true);
        try {
            const res = await axios.post(
                isContractor ? `${url}/api/finance/measurements/update` : `${url}/api/finance/labour-measurements/update`,
                payload, authHeader
            );
            if (res.data.success) {
                toast.success(res.data.message || 'Measurement updated');
                onSaved?.();
                onClose();
            } else toast.error(res.data.message);
        } catch (err) {
            const data = err.response?.data;
            if (data?.code === 'INSUFFICIENT_STOCK') {
                toast.error(
                    <div>
                        <p style={{ margin: '0 0 8px' }}>{data.message}</p>
                        <a
                            href={`/finance/procurement?projectId=${data.projectId}&material=${data.materialId}`}
                            target="_blank" rel="noreferrer"
                            style={{ fontWeight: 700, color: 'var(--gold, #c9a87c)', textDecoration: 'underline' }}
                        >
                            Record a Purchase →
                        </a>
                    </div>,
                    { autoClose: 12000 }
                );
            } else {
                toast.error(data?.message || 'Error updating measurement');
            }
        } finally { setSaving(false); }
    };

    return ReactDOM.createPortal(
        <div className="submit-loader-overlay amm-overlay" style={{ zIndex: 100000 }}>
            <div className="loader-modal-box edit-modal amm-modal">
                <div className="amm-modal-header">
                    <h2>Edit Measurement</h2>
                </div>

                <div className="amm-modal-body">
                    <form id="edit-measurement-form" onSubmit={submit}>
                        <div className="wizard-field-grid">
                            <div className="add-product-name flex-col">
                                <p>Work</p>
                                <p style={{ fontWeight: 600, margin: 0 }}>{workLabel}</p>
                            </div>
                            <div className="add-product-name flex-col">
                                <p>{isContractor ? 'Contractor' : 'Labourer'}</p>
                                <p style={{ fontWeight: 600, margin: 0 }}>{partyName}</p>
                            </div>
                            <div className="add-product-name flex-col wizard-field-full">
                                <p>Date</p>
                                <p style={{ fontWeight: 600, margin: 0 }}>{new Date(m.date).toLocaleDateString()}</p>
                            </div>

                            <div className="add-product-name flex-col">
                                <p>Area Covered (sqft) *</p>
                                <input type="number" onWheel={e => e.target.blur()} min="0" step="any" value={areaCoveredSqft} onChange={e => setAreaCoveredSqft(e.target.value)} />
                            </div>

                            {isContractor && (
                                <div className="add-product-name flex-col">
                                    <p>Supervisor Name</p>
                                    <input type="text" value={supervisorName} onChange={e => setSupervisorName(e.target.value)} />
                                </div>
                            )}

                            <div className="add-product-name flex-col wizard-field-full">
                                <p>Remarks</p>
                                <textarea rows="2" value={remarks} onChange={e => setRemarks(e.target.value)} />
                            </div>

                            {isContractor && (
                                <div className="add-product-name flex-col wizard-field-full" style={{ flexDirection: 'row', alignItems: 'center', gap: '10px' }}>
                                    <input
                                        type="checkbox" id="edit-measurement-approved"
                                        checked={engineerApproved} onChange={e => setEngineerApproved(e.target.checked)}
                                    />
                                    <label htmlFor="edit-measurement-approved" style={{ margin: 0, cursor: 'pointer' }}>Engineer Approved</label>
                                </div>
                            )}
                        </div>

                        {materialTrackingEnabled && (
                            <div className="amm-materials" style={{ margin: '4px 0 20px' }}>
                                <p className="admin-subtitle" style={{ marginBottom: '8px' }}>
                                    Material Used {materialLines.length > 0 && `(for ${areaCoveredSqft || '?'} sqft covered above, not per material)`}
                                </p>
                                {materialsLoading ? (
                                    <p className="admin-subtitle">Loading…</p>
                                ) : materialLines.length === 0 ? (
                                    <p className="admin-subtitle">
                                        No materials are tagged to this work type; add them from Masters → Material Master.
                                    </p>
                                ) : materialLines.map((line, idx) => {
                                    const material = materials.find(mat => mat._id === line.materialId);
                                    return (
                                        <div key={line.materialId} className="amm-material-line" style={{ display: 'flex', gap: '10px', marginBottom: '8px', alignItems: 'center' }}>
                                            <p className="amm-material-name" style={{ flex: 2, margin: 0 }}>{material?.name || '-'}</p>
                                            <div className="amm-material-qty" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <input type="number" onWheel={e => e.target.blur()} min="0" step="any" placeholder="Quantity" value={line.quantity} onChange={e => setMaterialLine(idx, 'quantity', e.target.value)} style={{ width: '100%' }} />
                                                {material?.unit && <span className="admin-subtitle" style={{ whiteSpace: 'nowrap' }}>{material.unit}</span>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </form>
                </div>

                <div className="edit-modal-actions amm-modal-footer">
                    <button type="button" className="add-btn cancel-btn" onClick={onClose}>Cancel</button>
                    <button type="submit" form="edit-measurement-form" className="add-btn" disabled={saving}>
                        {saving ? 'Saving…' : <><FontAwesomeIcon icon={faCheck} className="pq-action-icon" /> Save Changes</>}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default EditMeasurementModal;
