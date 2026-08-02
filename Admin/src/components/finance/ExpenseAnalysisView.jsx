import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import StyledSelect from './StyledSelect';
import StyledDatePicker from './StyledDatePicker';
import { RELATED_TO_UI_OPTIONS, relatedToUiConfig } from '../../config/relatedToTypes';
import '../../styles/list.css';
import '../../styles/add.css';

// Which single breakdown table to show — previously all four rendered
// stacked at once regardless of what you actually wanted to look at, which
// only got noisier as byWork/byRelatedTo filled in. "All" keeps the old
// stacked view for anyone who still wants the full picture in one scroll.
const GROUP_BY_OPTIONS = [
    { value: 'all',       label: 'All' },
    { value: 'category',  label: 'By Category' },
    { value: 'project',   label: 'By Project' },
    { value: 'work',      label: 'By Work' },
    { value: 'relatedTo', label: 'By Person / Entity' },
];

const ExpenseAnalysisView = ({ url }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const [projects, setProjects] = useState([]);
    const [categories, setCategories] = useState([]);
    const [projectId, setProjectId] = useState('');
    const [category, setCategory] = useState('');
    const [relatedToUiType, setRelatedToUiType] = useState('');
    const [relatedToId, setRelatedToId] = useState('');
    const [relatedToOptions, setRelatedToOptions] = useState([]);
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [groupBy, setGroupBy] = useState('category');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        axios.get(`${url}/api/finance/projects/list`, authHeader).then(res => { if (res.data.success) setProjects(res.data.data); }).catch(() => {});
        axios.get(`${url}/api/finance/settings/list`, { ...authHeader, params: { settingType: 'expense_category' } })
            .then(res => { if (res.data.success) setCategories(res.data.data.map(s => s.name)); }).catch(() => {});
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    // "Related To" is a two-step filter — pick the category (Employee/
    // Contractor/Labourer/Vendor), then pick who, from that category's own
    // filtered list.
    useEffect(() => {
        setRelatedToId('');
        const config = relatedToUiConfig(relatedToUiType);
        if (!config) { setRelatedToOptions([]); return; }
        axios.get(`${url}/api/finance/${config.resourceKey}/list`, authHeader)
            .then(res => {
                if (!res.data.success) return;
                const list = config.filter ? res.data.data.filter(config.filter) : res.data.data;
                setRelatedToOptions(list);
            }).catch(() => {});
    }, [url, relatedToUiType]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        setLoading(true);
        const params = {};
        if (projectId) params.projectId = projectId;
        if (category) params.category = category;
        if (relatedToId) params.relatedToId = relatedToId;
        if (from) params.from = from;
        if (to) params.to = to;
        axios.get(`${url}/api/finance/reports/expense-analysis`, { ...authHeader, params })
            .then(res => { if (res.data.success) setData(res.data.data); })
            .catch(() => toast.error('Error fetching expense analysis'))
            .finally(() => setLoading(false));
    }, [url, projectId, category, relatedToId, from, to]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div>
            <h3 style={{ margin: '0 0 4px' }}>Expense Analysis</h3>
            <p className="admin-subtitle" style={{ margin: '0 0 16px' }}>Every general/site expense, totalled by category, project, work, and person/entity; filter to narrow it down.</p>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '20px' }}>
                <div className="add-product-name flex-col" style={{ maxWidth: '260px' }}>
                    <p>Project</p>
                    <StyledSelect value={projectId} onChange={setProjectId} placeholder="All projects" options={projects.map(p => ({ value: p._id, label: p.name }))} />
                </div>
                <div className="add-product-name flex-col" style={{ maxWidth: '220px' }}>
                    <p>Category</p>
                    <StyledSelect value={category} onChange={setCategory} placeholder="All categories" options={categories.map(c => ({ value: c, label: c }))} />
                </div>
                <div className="add-product-name flex-col" style={{ maxWidth: '200px' }}>
                    <p>Related To</p>
                    <StyledSelect value={relatedToUiType} onChange={setRelatedToUiType} placeholder="Any" options={RELATED_TO_UI_OPTIONS} />
                </div>
                {relatedToUiType && (
                    <div className="add-product-name flex-col" style={{ maxWidth: '220px' }}>
                        <p>{relatedToUiConfig(relatedToUiType).label}</p>
                        <StyledSelect
                            value={relatedToId} onChange={setRelatedToId} placeholder={`All ${relatedToUiConfig(relatedToUiType).label.toLowerCase()}s`}
                            options={relatedToOptions.map(o => ({ value: o._id, label: o.name }))}
                        />
                    </div>
                )}
                <div className="add-product-name flex-col" style={{ maxWidth: '180px' }}>
                    <p>From</p>
                    <StyledDatePicker value={from} onChange={setFrom} />
                </div>
                <div className="add-product-name flex-col" style={{ maxWidth: '180px' }}>
                    <p>To</p>
                    <StyledDatePicker value={to} onChange={setTo} align="right" />
                </div>
                <div className="add-product-name flex-col" style={{ maxWidth: '200px' }}>
                    <p>Group By</p>
                    <StyledSelect value={groupBy} onChange={setGroupBy} options={GROUP_BY_OPTIONS} />
                </div>
            </div>

            {loading ? (
                <div className="admin-empty-state"><p>Loading…</p></div>
            ) : !data || data.total === 0 ? (
                <div className="admin-empty-state"><p>No expenses match this filter.</p></div>
            ) : (
                <>
                    <p className="admin-subtitle" style={{ marginBottom: '16px' }}>Total: ₹{data.total.toLocaleString('en-IN')}</p>

                    {(groupBy === 'all' || groupBy === 'category') && (
                        <>
                            <p className="admin-subtitle" style={{ marginBottom: '10px' }}>By category</p>
                            <div className="dash-chart-card exa-pair-card" style={{ marginBottom: '24px' }}>
                                <div className="exa-pair-row exa-pair-header">
                                    <b className="exa-pair-name">Category</b>
                                    <b className="exa-pair-amount">Amount</b>
                                </div>
                                {data.byCategory.map(c => (
                                    <div key={c.category} className="exa-pair-row">
                                        <p className="exa-pair-name">{c.category}</p>
                                        <p className="exa-pair-amount">₹{c.amount.toLocaleString('en-IN')}</p>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {(groupBy === 'all' || groupBy === 'project') && (
                        <>
                            <p className="admin-subtitle" style={{ marginBottom: '10px' }}>By project</p>
                            <div className="dash-chart-card exa-pair-card" style={{ marginBottom: '24px' }}>
                                <div className="exa-pair-row exa-pair-header">
                                    <b className="exa-pair-name">Project</b>
                                    <b className="exa-pair-amount">Amount</b>
                                </div>
                                {data.byProject.map(p => (
                                    <div key={p.projectId || 'general'} className="exa-pair-row">
                                        <p className="exa-pair-name">{p.projectName}</p>
                                        <p className="exa-pair-amount">₹{p.amount.toLocaleString('en-IN')}</p>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {(groupBy === 'all' || groupBy === 'work') && (
                        data.byWork.length > 0 ? (
                            <>
                                <p className="admin-subtitle" style={{ marginBottom: '10px' }}>By work</p>
                                <div className="dash-chart-card exa-pair-card" style={{ marginBottom: '24px' }}>
                                    <div className="exa-pair-row exa-pair-header">
                                        <b className="exa-pair-name">Work</b>
                                        <b className="exa-pair-amount">Amount</b>
                                    </div>
                                    {data.byWork.map(w => (
                                        <div key={w.workId} className="exa-pair-row">
                                            <p className="exa-pair-name">{w.workType}</p>
                                            <p className="exa-pair-amount">₹{w.amount.toLocaleString('en-IN')}</p>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : groupBy === 'work' && (
                            <div className="admin-empty-state"><p>No expenses in this filter are tied to a specific Work.</p></div>
                        )
                    )}

                    {(groupBy === 'all' || groupBy === 'relatedTo') && (
                        data.byRelatedTo.length > 0 ? (
                            <>
                                <p className="admin-subtitle" style={{ marginBottom: '10px' }}>By person / entity</p>
                                <div className="dash-chart-card exa-rel-card" style={{ marginBottom: '24px' }}>
                                    <div className="exa-rel-row exa-rel-header">
                                        <b className="exa-rel-name">Name</b>
                                        <b className="exa-rel-type">Type</b>
                                        <b className="exa-rel-amount">Amount</b>
                                    </div>
                                    {data.byRelatedTo.map(r => (
                                        <div key={r.relatedToId} className="exa-rel-row">
                                            <p className="exa-rel-name">{r.name}</p>
                                            <p className="exa-rel-type"><span className="item-category">{r.relatedToType}</span></p>
                                            <p className="exa-rel-amount"><span className="pq-group-label">Amount</span>₹{r.amount.toLocaleString('en-IN')}</p>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : groupBy === 'relatedTo' && (
                            <div className="admin-empty-state"><p>No expenses in this filter are tied to a person or entity.</p></div>
                        )
                    )}
                </>
            )}
        </div>
    );
};

export default ExpenseAnalysisView;
