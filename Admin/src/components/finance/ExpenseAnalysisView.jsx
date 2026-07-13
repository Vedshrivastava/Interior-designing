import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import '../../styles/list.css';

const ExpenseAnalysisView = ({ url }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const [projects, setProjects] = useState([]);
    const [categories, setCategories] = useState([]);
    const [projectId, setProjectId] = useState('');
    const [category, setCategory] = useState('');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        axios.get(`${url}/api/finance/projects/list`, authHeader).then(res => { if (res.data.success) setProjects(res.data.data); }).catch(() => {});
        axios.get(`${url}/api/finance/settings/list`, { ...authHeader, params: { settingType: 'expense_category' } })
            .then(res => { if (res.data.success) setCategories(res.data.data.map(s => s.name)); }).catch(() => {});
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        setLoading(true);
        const params = {};
        if (projectId) params.projectId = projectId;
        if (category) params.category = category;
        if (from) params.from = from;
        if (to) params.to = to;
        axios.get(`${url}/api/finance/reports/expense-analysis`, { ...authHeader, params })
            .then(res => { if (res.data.success) setData(res.data.data); })
            .catch(() => toast.error('Error fetching expense analysis'))
            .finally(() => setLoading(false));
    }, [url, projectId, category, from, to]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '20px' }}>
                <div className="add-product-name flex-col">
                    <p>Project</p>
                    <select value={projectId} onChange={e => setProjectId(e.target.value)}>
                        <option value="">All projects</option>
                        {projects.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                    </select>
                </div>
                <div className="add-product-name flex-col">
                    <p>Category</p>
                    <select value={category} onChange={e => setCategory(e.target.value)}>
                        <option value="">All categories</option>
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <div className="add-product-name flex-col">
                    <p>From</p>
                    <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
                </div>
                <div className="add-product-name flex-col">
                    <p>To</p>
                    <input type="date" value={to} onChange={e => setTo(e.target.value)} />
                </div>
            </div>

            {loading ? (
                <div className="admin-empty-state"><p>Loading…</p></div>
            ) : !data || data.total === 0 ? (
                <div className="admin-empty-state"><p>No expenses match this filter.</p></div>
            ) : (
                <>
                    <p className="admin-subtitle" style={{ marginBottom: '16px' }}>Total: ₹{data.total.toLocaleString('en-IN')}</p>

                    <p className="admin-subtitle" style={{ marginBottom: '10px' }}>By category</p>
                    <div className="list-table" style={{ marginBottom: '24px' }}>
                        <div className="list-table-format title" style={{ gridTemplateColumns: '2fr 1fr' }}>
                            <b>Category</b><b>Amount</b>
                        </div>
                        {data.byCategory.map(c => (
                            <div key={c.category} className="list-table-format row-item" style={{ gridTemplateColumns: '2fr 1fr' }}>
                                <p>{c.category}</p><p>₹{c.amount.toLocaleString('en-IN')}</p>
                            </div>
                        ))}
                    </div>

                    <p className="admin-subtitle" style={{ marginBottom: '10px' }}>By project</p>
                    <div className="list-table">
                        <div className="list-table-format title" style={{ gridTemplateColumns: '2fr 1fr' }}>
                            <b>Project</b><b>Amount</b>
                        </div>
                        {data.byProject.map(p => (
                            <div key={p.projectId || 'general'} className="list-table-format row-item" style={{ gridTemplateColumns: '2fr 1fr' }}>
                                <p>{p.projectName}</p><p>₹{p.amount.toLocaleString('en-IN')}</p>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

export default ExpenseAnalysisView;
