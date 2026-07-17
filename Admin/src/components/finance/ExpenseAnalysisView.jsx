import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import StyledSelect from './StyledSelect';
import StyledDatePicker from './StyledDatePicker';
import { RELATED_TO_UI_OPTIONS, relatedToUiConfig } from '../../config/relatedToTypes';
import '../../styles/list.css';
import '../../styles/add.css';

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
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        axios.get(`${url}/api/finance/projects/list`, authHeader).then(res => { if (res.data.success) setProjects(res.data.data); }).catch(() => {});
        axios.get(`${url}/api/finance/settings/list`, { ...authHeader, params: { settingType: 'expense_category' } })
            .then(res => { if (res.data.success) setCategories(res.data.data.map(s => s.name)); }).catch(() => {});
    }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

    // "Related To" is normally a two-step filter — pick the category
    // (Employee/Contractor/Labourer/Vendor), then pick who, from that
    // category's own filtered list. "Company" is a singleton (there's only
    // one financeCompanySettings document), so it resolves straight to that
    // one record instead of listing anything to choose from.
    useEffect(() => {
        const config = relatedToUiConfig(relatedToUiType);
        if (!config) { setRelatedToId(''); setRelatedToOptions([]); return; }
        if (config.singleton) {
            axios.get(`${url}/api/finance/settings/company`, authHeader)
                .then(res => { if (res.data.success) setRelatedToId(res.data.data._id); }).catch(() => {});
            return;
        }
        setRelatedToId('');
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
            <p className="admin-subtitle" style={{ margin: '0 0 16px' }}>Every general/site expense, totalled by category, project, work, and person/entity — filter to narrow it down.</p>
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
                {relatedToUiType && !relatedToUiConfig(relatedToUiType).singleton && (
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
                    <div className="list-table" style={{ marginBottom: '24px' }}>
                        <div className="list-table-format title" style={{ gridTemplateColumns: '2fr 1fr' }}>
                            <b>Project</b><b>Amount</b>
                        </div>
                        {data.byProject.map(p => (
                            <div key={p.projectId || 'general'} className="list-table-format row-item" style={{ gridTemplateColumns: '2fr 1fr' }}>
                                <p>{p.projectName}</p><p>₹{p.amount.toLocaleString('en-IN')}</p>
                            </div>
                        ))}
                    </div>

                    {data.byWork.length > 0 && (
                        <>
                            <p className="admin-subtitle" style={{ marginBottom: '10px' }}>By work</p>
                            <div className="list-table" style={{ marginBottom: '24px' }}>
                                <div className="list-table-format title" style={{ gridTemplateColumns: '2fr 1fr' }}>
                                    <b>Work</b><b>Amount</b>
                                </div>
                                {data.byWork.map(w => (
                                    <div key={w.workId} className="list-table-format row-item" style={{ gridTemplateColumns: '2fr 1fr' }}>
                                        <p>{w.workType}</p><p>₹{w.amount.toLocaleString('en-IN')}</p>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {data.byRelatedTo.length > 0 && (
                        <>
                            <p className="admin-subtitle" style={{ marginBottom: '10px' }}>By person / entity</p>
                            <div className="list-table">
                                <div className="list-table-format title" style={{ gridTemplateColumns: '1.6fr 1fr 1fr' }}>
                                    <b>Name</b><b>Type</b><b>Amount</b>
                                </div>
                                {data.byRelatedTo.map(r => (
                                    <div key={r.relatedToId} className="list-table-format row-item" style={{ gridTemplateColumns: '1.6fr 1fr 1fr' }}>
                                        <p>{r.name}</p><p><span className="item-category">{r.relatedToType}</span></p><p>₹{r.amount.toLocaleString('en-IN')}</p>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </>
            )}
        </div>
    );
};

export default ExpenseAnalysisView;
