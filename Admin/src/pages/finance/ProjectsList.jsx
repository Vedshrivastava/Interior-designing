import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import '../../styles/list.css';

const CONTRACT_TYPE_LABEL = { with_material: 'With Material', without_material: 'Without Material', advance: 'Advance' };
const STATUS_LABEL = { draft: 'Draft', active: 'Active', completed: 'Completed' };

const ProjectsList = ({ url }) => {
    const navigate = useNavigate();
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [list, setList] = useState([]);
    const [loading, setLoading] = useState(false);
    const [confirmItem, setConfirmItem] = useState(null);
    const [deleting, setDeleting] = useState(false);

    const fetchList = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${url}/api/finance/projects/list`, authHeader);
            if (res.data.success) setList(res.data.data);
        } catch { toast.error('Error fetching projects'); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchList(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const confirmDelete = async () => {
        if (!confirmItem) return;
        setDeleting(true);
        try {
            const res = await axios.post(`${url}/api/finance/projects/remove`, { _id: confirmItem._id }, authHeader);
            if (res.data.success) { toast.success(res.data.message); setConfirmItem(null); await fetchList(); }
            else toast.error(res.data.message);
        } catch { toast.error('Error removing project'); }
        finally { setDeleting(false); }
    };

    return (
        <div className="list add flex-col">
            <div className="admin-list-container">
                <div className="admin-header-split">
                    <div>
                        <h1>All Projects</h1>
                        <p className="admin-subtitle">Finance-tracked projects — contract type, rates, and readiness to go live.</p>
                    </div>
                    <button type="button" className="add-point-btn" onClick={() => navigate('/finance/projects/new')}>+ New Project</button>
                </div>

                <div className="list-table">
                    <div className="list-table-format title" style={{ gridTemplateColumns: '2fr 1.3fr 1fr 1fr 1fr 100px' }}>
                        <b>Name</b><b>Client</b><b>Contract Type</b><b>Status</b><b>Readiness</b><b>Action</b>
                    </div>
                    {loading ? (
                        <div className="admin-empty-state"><p>Loading…</p></div>
                    ) : list.length === 0 ? (
                        <div className="admin-empty-state"><p>No projects yet — start with "+ New Project".</p></div>
                    ) : (
                        list.map(item => (
                            <div key={item._id} className="list-table-format row-item" style={{ gridTemplateColumns: '2fr 1.3fr 1fr 1fr 1fr 100px' }}>
                                <p className="item-name" style={{ cursor: 'pointer' }} onClick={() => navigate(`/finance/projects/${item._id}`)}>{item.name}</p>
                                <p>{item.clientId?.name || '—'}</p>
                                <p><span className="item-category">{CONTRACT_TYPE_LABEL[item.contractType]}</span></p>
                                <p><span className="item-category">{STATUS_LABEL[item.status]}</span></p>
                                <p>
                                    {item.readiness?.ready
                                        ? <span style={{ color: 'var(--moss)' }}>✓ Ready</span>
                                        : <span title={item.readiness?.missing?.join(', ')} style={{ color: '#c0392b' }}>⚠ Missing {item.readiness?.missing?.length}</span>}
                                </p>
                                <div className="action-buttons">
                                    <p onClick={() => navigate(`/finance/projects/${item._id}`)} className="cursor edit-action">View</p>
                                    <p onClick={() => setConfirmItem(item)} className="cursor delete-action">X</p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {confirmItem && ReactDOM.createPortal(
                <div className="bin-confirm-backdrop" onClick={() => !deleting && setConfirmItem(null)}>
                    <div className="bin-confirm-modal" onClick={e => e.stopPropagation()}>
                        <div className="bin-confirm-icon"><i className="fa-solid fa-triangle-exclamation" /></div>
                        <h3>Remove Project?</h3>
                        <p className="bin-confirm-name">"{confirmItem.name}"</p>
                        <p className="bin-confirm-warning">Moved to Recovery Bin.</p>
                        <div className="bin-confirm-actions">
                            <button className="bin-btn-cancel" onClick={() => setConfirmItem(null)} disabled={deleting}>Cancel</button>
                            <button className="bin-btn-delete" onClick={confirmDelete} disabled={deleting}>{deleting ? 'Removing…' : 'Yes, Remove'}</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default ProjectsList;
