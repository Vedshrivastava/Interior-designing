import React, { useEffect, useState } from 'react';
import axios from 'axios';
import FinanceTabShell from '../../components/finance/FinanceTabShell';
import StockMovementsManager from '../../components/finance/StockMovementsManager';

/* Inventory is tracked per project (site) — pick a project, then see its
   current stock, record a manual Dump/Return/Waste movement, and browse
   the full history (including the `consume` rows measurements generate). */
const SiteInventoryPage = ({ url }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const [projects, setProjects] = useState([]);
    const [selectedProjectId, setSelectedProjectId] = useState('');

    useEffect(() => {
        axios.get(`${url}/api/finance/projects/list`, authHeader).then(res => { if (res.data.success) setProjects(res.data.data); }).catch(() => {});
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <FinanceTabShell
            label="Site Inventory"
            subtitle="Stock movement — dumped, consumed, returned, wasted, and current balance per material per project."
        >
            <div className="add-product-name flex-col" style={{ marginBottom: '20px', maxWidth: '360px' }}>
                <p>Project</p>
                <select value={selectedProjectId} onChange={e => setSelectedProjectId(e.target.value)}>
                    <option value="">Select project…</option>
                    {projects.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                </select>
            </div>

            {selectedProjectId
                ? <StockMovementsManager url={url} projectId={selectedProjectId} />
                : <div className="admin-empty-state"><p>Select a project to view its site inventory.</p></div>}
        </FinanceTabShell>
    );
};

export default SiteInventoryPage;
