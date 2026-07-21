import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import StyledDatePicker from './StyledDatePicker';
import AddStockMovementModal from './AddStockMovementModal';
import '../../styles/list.css';
import '../../styles/wizard.css';
import '../../styles/add.css';

const MOVEMENT_LABEL = { dump: 'Dump', consume: 'Consume', return: 'Return', waste: 'Waste' };

/* Site Inventory ledger for one project — current stock (computed on the
   fly server-side, never stored), a "+ Add Movement" dialog for manual
   Dump/Return/Waste entries, and the full movement history including the
   `consume` rows the measurement-save automation creates (read-only
   here). From/To date filters keep the history from just growing
   forever unscoped — "From Project Start" jumps straight to the
   project's own startDate instead of hunting for it on the calendar.
   Consume rows link through to the Work they belong to, same "Details"
   pattern as Works/Measurements. */
const StockMovementsManager = ({ url, projectId, autoOpenAddForMaterialId }) => {
    const navigate = useNavigate();
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [stock, setStock] = useState([]);
    const [movements, setMovements] = useState([]);
    const [loadingStock, setLoadingStock] = useState(true);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [projectStartDate, setProjectStartDate] = useState('');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    // Opens straight into "Record a Dump" pre-filled with the material a
    // measurement's insufficient-stock error just named — e.g. arriving
    // via that toast's "Open Site Inventory" link — instead of landing on
    // a blank page the user then has to search the material back out on.
    const [addModalOpen, setAddModalOpen] = useState(!!autoOpenAddForMaterialId);

    const fetchStock = async () => {
        setLoadingStock(true);
        try {
            const res = await axios.get(`${url}/api/finance/stock-movements/current-stock`, { ...authHeader, params: { projectId } });
            if (res.data.success) setStock(res.data.data);
        } catch { toast.error('Error fetching current stock'); }
        finally { setLoadingStock(false); }
    };

    const fetchHistory = async () => {
        setLoadingHistory(true);
        try {
            const res = await axios.get(`${url}/api/finance/stock-movements/list`, { ...authHeader, params: { projectId } });
            if (res.data.success) setMovements(res.data.data);
        } catch { toast.error('Error fetching stock movements'); }
        finally { setLoadingHistory(false); }
    };

    useEffect(() => {
        if (!projectId) return;
        fetchStock();
        fetchHistory();
        axios.get(`${url}/api/finance/projects/${projectId}`, authHeader)
            .then(res => { if (res.data.success && res.data.data.project?.startDate) setProjectStartDate(res.data.data.project.startDate.slice(0, 10)); })
            .catch(() => {});
    }, [url, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

    const filteredMovements = movements.filter(m => {
        const dateKey = new Date(m.date).toISOString().slice(0, 10);
        if (fromDate && dateKey < fromDate) return false;
        if (toDate && dateKey > toDate) return false;
        return true;
    });

    const removeMovement = async (item) => {
        try {
            const res = await axios.delete(`${url}/api/finance/stock-movements/remove`, { ...authHeader, data: { _id: item._id } });
            if (res.data.success) { toast.success(res.data.message); await Promise.all([fetchStock(), fetchHistory()]); }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error removing movement'); }
    };

    return (
        <div>
            <h3 style={{ marginBottom: '4px' }}>Current Stock</h3>
            <p className="admin-subtitle" style={{ margin: '0 0 12px' }}>Always current: SUM(dump) − SUM(consume) − SUM(return) − SUM(waste), computed fresh, never stored.</p>
            <div className="list-table" style={{ marginBottom: '32px' }}>
                <div className="list-table-format title" style={{ gridTemplateColumns: '1.5fr 1fr 1fr' }}>
                    <b>Material</b><b>Unit</b><b>Current Stock</b>
                </div>
                {loadingStock ? (
                    <div className="admin-empty-state"><p>Loading…</p></div>
                ) : stock.length === 0 ? (
                    <div className="admin-empty-state"><p>No stock movements recorded yet.</p></div>
                ) : (
                    stock.map(row => (
                        <div key={row.materialId} className="list-table-format row-item" style={{ gridTemplateColumns: '1.5fr 1fr 1fr' }}>
                            <p>{row.materialName || '-'}</p>
                            <p>{row.unit || '-'}</p>
                            <p style={{ color: row.currentStock < 0 ? '#c0392b' : undefined }}>{row.currentStock}</p>
                        </div>
                    ))
                )}
            </div>

            <h3 style={{ marginBottom: '4px' }}>Movement History</h3>
            <p className="admin-subtitle" style={{ margin: '0 0 12px' }}>Every dump, consume, return, and waste movement ever recorded at this project; filter by date to narrow it down.</p>
            <div className="wizard-field-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0,220px))', marginBottom: '10px', alignItems: 'end' }}>
                <div className="add-product-name flex-col">
                    <p>From</p>
                    <StyledDatePicker value={fromDate} onChange={setFromDate} />
                </div>
                <div className="add-product-name flex-col">
                    <p>To</p>
                    <StyledDatePicker value={toDate} onChange={setToDate} />
                </div>
                <div className="add-product-name flex-col">
                    <p aria-hidden="true" style={{ visibility: 'hidden' }}>Add</p>
                    <button type="button" className="add-btn" style={{ width: '100%', boxSizing: 'border-box', border: '1px solid transparent', margin: 0 }} onClick={() => setAddModalOpen(true)}>
                        + Add Movement
                    </button>
                </div>
            </div>

            {projectStartDate && (
                <div style={{ marginBottom: '16px' }}>
                    <button
                        type="button"
                        className={`labour-chip${fromDate === projectStartDate ? ' active' : ''}`}
                        onClick={() => setFromDate(projectStartDate)}
                    >
                        From Project Start
                    </button>
                </div>
            )}

            {addModalOpen && (
                <AddStockMovementModal
                    url={url} projectId={projectId} defaultMaterialId={autoOpenAddForMaterialId}
                    onClose={() => setAddModalOpen(false)}
                    onSaved={() => { fetchStock(); fetchHistory(); }}
                />
            )}

            <div className="list-table">
                <div className="list-table-format title" style={{ gridTemplateColumns: '1fr 1.2fr 1fr 1fr 1fr 1fr 130px' }}>
                    <b>Date</b><b>Material</b><b>Type</b><b>Vendor / Work</b><b>Quantity</b><b>Notes</b><b>Action</b>
                </div>
                {loadingHistory ? (
                    <div className="admin-empty-state"><p>Loading…</p></div>
                ) : filteredMovements.length === 0 ? (
                    <div className="admin-empty-state"><p>{movements.length === 0 ? 'No movements yet.' : 'No movements in this date range.'}</p></div>
                ) : (
                    filteredMovements.map(m => (
                        <div key={m._id} className="list-table-format row-item" style={{ gridTemplateColumns: '1fr 1.2fr 1fr 1fr 1fr 1fr 130px' }}>
                            <p>{new Date(m.date).toLocaleDateString()}</p>
                            <p>{m.materialId?.name || '-'}</p>
                            <p><span className="item-category">{MOVEMENT_LABEL[m.movementType]}{m.relatedMeasurementId ? ' (auto)' : ''}</span></p>
                            <p>{m.vendorId?.name || m.workId?.workType || '-'}</p>
                            <p>{m.quantity} {m.materialId?.unit || ''}</p>
                            <p>{m.notes || '-'}</p>
                            <div className="action-buttons">
                                {m.workId && <p onClick={() => navigate(`/finance/projects/${projectId}/works/${m.workId._id}`)} className="cursor edit-action">Details</p>}
                                {!m.relatedMeasurementId && <p onClick={() => removeMovement(m)} className="cursor delete-action">X</p>}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default StockMovementsManager;
