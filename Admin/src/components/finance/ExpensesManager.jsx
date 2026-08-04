import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import StyledSelect from './StyledSelect';
import StyledDatePicker from './StyledDatePicker';
import SettingSelectField, { registerSettingIfNew } from './SettingSelectField';
import QuickAddPicker from './QuickAddPicker';
import { RELATED_TO_UI_OPTIONS, relatedToUiConfig } from '../../config/relatedToTypes';
import { useFinanceWsRefresh } from '../../hooks/useFinanceWsRefresh';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash, faCheck } from '@fortawesome/free-solid-svg-icons';
import '../../styles/list.css';
import '../../styles/wizard.css';
import '../../styles/add.css';

const emptyForm = { expenseCategory: '', projectId: '', workId: '', relatedToUiType: '', relatedToId: '', amount: '', date: '', paymentMode: '', bankOrCashLabel: '', bankAccountId: '', notes: '', gstRate: '' };
const emptySettleForm = { amount: '', date: '', paymentMode: '', bankAccountId: '' };
// An expense tagged to the person who actually paid it out of pocket is a
// reimbursement claim — it needs a bill/receipt attached (hard-enforced on
// the backend too, see controllers/financeExpense.js) and rolls up into
// the person's own "left to pay" total below.
const REIMBURSEMENT_TYPES = ['financeEmployee', 'financeLabourer'];
const PAID_STATUS_OPTIONS = [
    { value: 'paid', label: 'Paid now' },
    { value: 'pending', label: 'Record as pending, settle later' },
];
const workLabel = (w) => `${w.workType}${w.workOrderNumber ? ` · ${w.workOrderNumber}` : ''} (${w.completedAreaSqft}/${w.estimatedAreaSqft} sqft)`;

/*
 * General company/site expenses. Two ways an expense's cash side can play
 * out, both supported by the same form:
 *   - Paid now (default) — exactly the original behavior: amount + payment
 *     info recorded together, a cash/bank entry fires immediately.
 *   - Record as pending — amount is logged as accrued with no payment info
 *     at all; it shows a balance until settled (partially or fully) via one
 *     or more financeExpensePayment rows, added through the Settle action.
 *
 * Every expense can optionally link to a Work (scoped to whichever project
 * it's under) and a "Related To" person/entity — Employee/Supervisor,
 * Contractor, Labourer, or Vendor/Supplier (Contractor and Vendor both save
 * as the same financeVendor ref, just filtered differently). Company isn't
 * one of the RELATED_TO_UI_OPTIONS choices here — Payables' Company
 * Expenses tab already covers that exact case via `fixedRelatedTo`, so
 * offering it again in this dropdown too would just be two paths to the
 * same outcome. Notes stays free text for whatever the links don't capture.
 *
 * Reused five ways, each hiding whichever fields/columns its own scoping
 * already answers so the form only ever asks what it doesn't already know:
 *   - Unscoped on Payments' Miscellaneous tab and Payables' own Expenses
 *     tab (own heading comes from FinanceTabShell there — this is also the
 *     one place every column shows, since it's meant to be the "detail"
 *     view; a full-detail modal covers whatever still doesn't fit in the
 *     table, e.g. Notes).
 *   - Scoped to one project via `projectId` on Project Detail's Expenses
 *     tab — Project field/column disappear, each row gets a "Details" link
 *     back to Payables' Expenses tab instead, via `highlightId`.
 *   - Scoped to one category via `fixedCategory` on Payables' Other
 *     Expenses tab (e.g. "Others") — Category, Work, and Related To
 *     fields/columns all disappear too, since that tab is deliberately for
 *     quick, unlinked entries ("just a note is enough").
 *   - Scoped to one Related To target via `fixedRelatedTo` on Payables'
 *     Company Expenses tab — Related To field/column disappears, always
 *     posting that fixed type+id (e.g. every director hotel stay tagged
 *     straight to the company, no picker step).
 *
 * exp-row/exp-header: main list mobile card hooks. Category/Project/Work/
 * Related To are conditionally rendered depending on the four scoping
 * props — each optional field carries its own inline .exp-field-label
 * (hidden on desktop, shown on mobile), same self-labeling pattern as
 * ProjectOverviewTab's .ov-field-label, since a single fixed
 * grid-template-areas layout can't account for a variable column set.
 * exp-overlay/exp-modal: "Record Expense" bottom sheet.
 * exps-overlay/exps-modal: "Settle Expense" bottom sheet; esh-row is the
 * mobile card hook for its nested payment-history table.
 * expv-overlay/expv-modal: "View Expense" detail bottom sheet — kv-row is
 * the mobile hook for its label:value rows.
 */
const STATUS_FILTERS = [
    { key: 'all',     label: 'All' },
    // "Payment Left" = pending + partially paid combined (balance > 0) —
    // matches the Dashboard's Expense Payables total exactly, so that KPI
    // card can link straight into this filter and the two numbers agree.
    { key: 'unpaid',  label: 'Payment Left' },
    { key: 'pending', label: 'Pending' },
    { key: 'partial', label: 'Partially Paid' },
    { key: 'paid',    label: 'Paid' },
];

const ExpensesManager = ({ url, projectId: fixedProjectId, fixedCategory, fixedRelatedTo, highlightId, defaultStatusFilter }) => {
    const navigate = useNavigate();
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };

    const [projects, setProjects] = useState([]);
    const [projectsLoading, setProjectsLoading] = useState(!fixedProjectId);
    const [categories, setCategories] = useState([]);
    const [bankAccounts, setBankAccounts] = useState([]);
    const [refDataLoading, setRefDataLoading] = useState(true);
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [flashId, setFlashId] = useState(highlightId || null);
    // Defaults to whatever the caller asks for — the Dashboard's Expense
    // Payables KPI links in with defaultStatusFilter="pending" so landing
    // here already shows just what needs chasing; every other entry point
    // (opening this tab directly, a project's own Expenses tab) starts on
    // All, same as before.
    const [statusFilter, setStatusFilter] = useState(defaultStatusFilter || 'all');

    const [modalOpen, setModalOpen] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [worksForProject, setWorksForProject] = useState([]);
    const [worksLoading, setWorksLoading] = useState(false);
    const [paidNow, setPaidNow] = useState(true);
    const [file, setFile] = useState(null);
    const [saving, setSaving] = useState(false);

    const [settleTarget, setSettleTarget] = useState(null);
    const [settleForm, setSettleForm] = useState(emptySettleForm);
    const [settling, setSettling] = useState(false);
    const [payments, setPayments] = useState([]);
    const [paymentsLoading, setPaymentsLoading] = useState(false);

    const [viewTarget, setViewTarget] = useState(null);
    const [confirmItem, setConfirmItem] = useState(null);
    const [deleting, setDeleting] = useState(false);

    // The four scoping props are independent — a caller can combine them
    // (though today only one is ever set at a time) — so the fetch/columns/
    // form logic below all key off these four flags rather than one big
    // "which of the five modes am I" switch.
    const hideProjectField = !!fixedProjectId;
    const hideCategoryField = !!fixedCategory;
    const hideWorkField = !!fixedCategory;
    const hideRelatedToField = !!fixedCategory || !!fixedRelatedTo;

    const fetchExpenses = async () => {
        setLoading(true);
        try {
            const params = {};
            if (fixedProjectId) params.projectId = fixedProjectId;
            if (fixedCategory) params.expenseCategory = fixedCategory;
            if (fixedRelatedTo) params.relatedToId = fixedRelatedTo.id;
            const res = await axios.get(`${url}/api/finance/expenses/list`, { ...authHeader, params });
            if (res.data.success) setExpenses(res.data.data);
        } catch { toast.error('Error fetching expenses'); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchExpenses(); }, [fixedProjectId, fixedCategory, fixedRelatedTo?.id]); // eslint-disable-line react-hooks/exhaustive-deps
    const fetchProjects = () => {
        if (!fixedProjectId) {
            axios.get(`${url}/api/finance/projects/list`, authHeader).then(res => { if (res.data.success) setProjects(res.data.data); }).catch(() => {}).finally(() => setProjectsLoading(false));
        }
    };
    useEffect(() => {
        fetchProjects();
        Promise.all([
            axios.get(`${url}/api/finance/settings/list`, { ...authHeader, params: { settingType: 'expense_category' } })
                .then(res => { if (res.data.success) setCategories(res.data.data.map(s => s.name)); }).catch(() => {}),
            axios.get(`${url}/api/finance/bank-accounts/list`, authHeader).then(res => { if (res.data.success) setBankAccounts(res.data.data); }).catch(() => {}),
        ]).finally(() => setRefDataLoading(false));
    }, [url, fixedProjectId]); // eslint-disable-line react-hooks/exhaustive-deps
    useFinanceWsRefresh(['financeProjectsChanged'], fetchProjects);

    // Work options are scoped to whichever project is currently relevant —
    // the fixed one, or whatever's picked in the unscoped form right now.
    const effectiveProjectId = fixedProjectId || form.projectId;
    const fetchWorksForProject = () => {
        if (!effectiveProjectId) { setWorksForProject([]); return; }
        setWorksLoading(true);
        axios.get(`${url}/api/finance/works/list`, { ...authHeader, params: { projectId: effectiveProjectId } })
            .then(res => { if (res.data.success) setWorksForProject(res.data.data); }).catch(() => {}).finally(() => setWorksLoading(false));
    };
    useEffect(fetchWorksForProject, [url, effectiveProjectId]); // eslint-disable-line react-hooks/exhaustive-deps
    useFinanceWsRefresh(['financeWorksChanged'], fetchWorksForProject);

    // Scroll to + briefly flash the row a "Details" link arrived for.
    useEffect(() => {
        if (!highlightId || loading) return;
        const el = document.getElementById(`expense-row-${highlightId}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const t = setTimeout(() => setFlashId(null), 2500);
        return () => clearTimeout(t);
    }, [highlightId, loading]);

    const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
    const setProjectField = (value) => setForm(prev => ({ ...prev, projectId: value, workId: '' }));
    const setRelatedToUiType = (value) => setForm(prev => ({ ...prev, relatedToUiType: value, relatedToId: '' }));

    const openAdd = () => {
        setForm({ ...emptyForm, projectId: fixedProjectId || '', expenseCategory: fixedCategory || '' });
        setPaidNow(true); setFile(null); setModalOpen(true);
    };
    const closeModal = () => setModalOpen(false);

    // Which relatedToType this form is currently pointed at — either fixed
    // by the caller (fixedRelatedTo) or whatever's picked in the Related To
    // dropdown right now — decides whether an attachment is required.
    const effectiveRelatedToType = fixedRelatedTo ? fixedRelatedTo.type : (form.relatedToId ? relatedToUiConfig(form.relatedToUiType)?.backendType : null);
    const isReimbursement = REIMBURSEMENT_TYPES.includes(effectiveRelatedToType);

    const submit = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!form.amount || Number(form.amount) <= 0) return toast.error('Amount must be greater than zero');
        if (!form.date) return toast.error('Date is required');
        if (isReimbursement && !file) return toast.error('A bill/receipt attachment is required for employee and labourer reimbursement claims');
        setSaving(true);
        try {
            const { relatedToUiType, ...rest } = form;
            const payload = {
                ...rest,
                relatedToType: fixedRelatedTo ? fixedRelatedTo.type : (form.relatedToId ? relatedToUiConfig(relatedToUiType)?.backendType || null : null),
                relatedToId: fixedRelatedTo ? fixedRelatedTo.id : form.relatedToId,
                ...(paidNow ? {} : { paymentMode: '', bankOrCashLabel: '', bankAccountId: '' }),
            };
            const data = new FormData();
            Object.entries(payload).forEach(([k, v]) => data.append(k, v ?? ''));
            if (file) data.append('attachment', file);
            const res = await axios.post(`${url}/api/finance/expenses/add`, data, {
                headers: { ...authHeader.headers, 'Content-Type': 'multipart/form-data' },
            });
            if (res.data.success) {
                toast.success(res.data.message);
                await registerSettingIfNew(url, authHeader, 'expense_category', form.expenseCategory, categories.map(c => ({ name: c })));
                closeModal();
                await fetchExpenses();
            }
            else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error recording expense'); }
        finally { setSaving(false); }
    };

    const confirmDelete = async () => {
        if (!confirmItem) return;
        setDeleting(true);
        try {
            const res = await axios.delete(`${url}/api/finance/expenses/remove`, { ...authHeader, data: { _id: confirmItem._id } });
            if (res.data.success) { toast.success(res.data.message); setConfirmItem(null); await fetchExpenses(); }
            else toast.error(res.data.message || 'Error removing expense');
        } catch (err) { toast.error(err.response?.data?.message || 'Error removing expense'); }
        finally { setDeleting(false); }
    };

    const openSettle = async (expense) => {
        setSettleTarget(expense);
        setSettleForm({ ...emptySettleForm, amount: expense.balance });
        setPaymentsLoading(true);
        try {
            const res = await axios.get(`${url}/api/finance/expense-payments/list`, { ...authHeader, params: { expenseId: expense._id } });
            if (res.data.success) setPayments(res.data.data);
        } catch { /* history just stays empty */ }
        finally { setPaymentsLoading(false); }
    };
    const closeSettle = () => { setSettleTarget(null); setPayments([]); };
    const setSettleField = (key, value) => setSettleForm(prev => ({ ...prev, [key]: value }));

    const submitSettle = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!settleForm.amount || Number(settleForm.amount) <= 0) return toast.error('Amount must be greater than zero');
        if (!settleForm.date) return toast.error('Date is required');
        setSettling(true);
        try {
            const res = await axios.post(`${url}/api/finance/expense-payments/add`,
                { ...settleForm, expenseId: settleTarget._id }, authHeader);
            if (res.data.success) {
                toast.success(res.data.message);
                await fetchExpenses();
                await openSettle({ ...settleTarget, balance: settleTarget.balance - Number(settleForm.amount) });
                setSettleForm(emptySettleForm);
            } else toast.error(res.data.message);
        } catch (err) { toast.error(err.response?.data?.message || 'Error recording payment'); }
        finally { setSettling(false); }
    };

    const statusFor = (e) => {
        if (e.balance <= 0) return { key: 'paid', label: 'Paid', color: 'var(--moss)' };
        if (e.paidAmount > 0) return { key: 'partial', label: 'Partially Paid', color: '#b8860b' };
        return { key: 'pending', label: 'Pending', color: '#c0392b' };
    };

    const visibleExpenses = statusFilter === 'all' ? expenses
        : statusFilter === 'unpaid' ? expenses.filter(e => e.balance > 0)
        : expenses.filter(e => statusFor(e).key === statusFilter);
    const pendingOrPartialCount = expenses.filter(e => e.balance > 0).length;

    // Same type-label logic as the backend's Expense Analysis breakdown
    // (financeReports.js) — kept in sync by hand since this is the only
    // other place a raw relatedToType needs to read as "Contractor" vs
    // plain "Vendor".
    const relatedToTypeLabel = (e) => {
        if (!e.relatedToType) return null;
        if (e.relatedToType === 'financeEmployee') return 'Employee';
        if (e.relatedToType === 'financeLabourer') return 'Labourer';
        if (e.relatedToType === 'financeCompanySettings') return 'Company';
        return e.relatedToId?.vendorType === 'labour_contractor' ? 'Contractor' : 'Vendor';
    };

    const columns = [
        '1fr',
        !hideCategoryField && '1.1fr',
        !hideProjectField && '1.2fr',
        !hideWorkField && '1.2fr',
        !hideRelatedToField && '1.3fr',
        '1fr', '1fr', '1fr', '230px',
    ].filter(Boolean).join(' ');

    const heading = fixedRelatedTo
        ? { title: fixedRelatedTo.label, subtitle: fixedRelatedTo.subtitle || 'Expenses tied to the company itself: director travel, hotel stays, and similar. Use Notes to say what it was, e.g. matched against a bank statement line.' }
        : fixedCategory
        ? { title: `${fixedCategory} Expenses`, subtitle: `Quick, unlinked entries under the "${fixedCategory}" category: an amount, a date, and a note is enough.` }
        : hideProjectField
        ? { title: 'Expenses', subtitle: 'Site expenses logged against this project: paid now, or recorded pending and settled later.' }
        : null;

    // Only meaningful once scoped to one person — a company-wide total
    // already exists as the Dashboard's Reimbursement Payables KPI
    // (computeReimbursementRows on the backend); this is that same figure
    // for just the person currently in view, computed client-side from the
    // list already fetched rather than a second round-trip.
    const totalLeftToPay = fixedRelatedTo && REIMBURSEMENT_TYPES.includes(fixedRelatedTo.type)
        ? expenses.reduce((s, e) => s + Math.max(0, e.balance), 0)
        : null;

    return (
        <div>
            <div className="exp-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                {heading ? (
                    <div>
                        <h3 style={{ margin: '0 0 4px' }}>{heading.title}</h3>
                        <p className="admin-subtitle" style={{ margin: 0 }}>{heading.subtitle}</p>
                        {totalLeftToPay !== null && (
                            <p className="exp-left-to-pay" style={{ color: totalLeftToPay > 0 ? '#c0392b' : 'var(--moss)' }}>
                                Total left to pay: ₹{totalLeftToPay.toLocaleString('en-IN')}
                            </p>
                        )}
                    </div>
                ) : <span />}
                <button type="button" className="add-btn" onClick={openAdd}>+ Record Expense</button>
            </div>

            {pendingOrPartialCount > 0 && (
                <div className="admin-category-scroll" style={{ paddingTop: 0 }}>
                    {STATUS_FILTERS.map(f => (
                        <button key={f.key} className={`admin-cat-pill${statusFilter === f.key ? ' active' : ''}`} onClick={() => setStatusFilter(f.key)}>
                            {f.label}
                        </button>
                    ))}
                </div>
            )}

            {modalOpen && ReactDOM.createPortal(
                <div className="submit-loader-overlay exp-overlay" style={{ zIndex: 100000 }}>
                    <div className="loader-modal-box edit-modal exp-modal">
                        <div className="exp-modal-header">
                            <h2>Record Expense</h2>
                        </div>

                        <div className="exp-modal-body">
                            <form id="record-expense-form" onSubmit={submit}>
                                <div className="wizard-field-grid">
                                    {!hideCategoryField && (
                                        <div className="add-product-name flex-col">
                                            <p>Category</p>
                                            <SettingSelectField
                                                settingType="expense_category" options={categories.map(c => ({ _id: c, name: c }))}
                                                value={form.expenseCategory} onChange={v => setField('expenseCategory', v)} placeholder="e.g. Fuel, Tools, Site Snacks…"
                                            />
                                        </div>
                                    )}
                                    {!hideProjectField && (
                                        <div className="add-product-name flex-col">
                                            <p>Project (optional, general overhead if blank)</p>
                                            <StyledSelect
                                                value={form.projectId} onChange={setProjectField} placeholder="General / overhead" loading={projectsLoading}
                                                options={projects.map(p => ({ value: p._id, label: p.name }))}
                                            />
                                        </div>
                                    )}
                                    {!hideWorkField && (
                                        <div className="add-product-name flex-col">
                                            <p>Work (optional{effectiveProjectId ? '' : ', pick a project first'})</p>
                                            <StyledSelect
                                                value={form.workId} onChange={v => setField('workId', v)} placeholder="Not tied to a Work"
                                                disabled={!effectiveProjectId} loading={worksLoading} options={worksForProject.map(w => ({ value: w._id, label: workLabel(w) }))}
                                            />
                                        </div>
                                    )}
                                    {!hideRelatedToField && (
                                        <div className="add-product-name flex-col">
                                            <p>Related To (optional)</p>
                                            <StyledSelect
                                                value={form.relatedToUiType} onChange={setRelatedToUiType} placeholder="None"
                                                options={RELATED_TO_UI_OPTIONS}
                                            />
                                        </div>
                                    )}
                                    {!hideRelatedToField && form.relatedToUiType && (
                                        <div className="add-product-name flex-col">
                                            <p>{relatedToUiConfig(form.relatedToUiType).label}</p>
                                            <QuickAddPicker
                                                url={url} resourceKey={relatedToUiConfig(form.relatedToUiType).resourceKey}
                                                filter={relatedToUiConfig(form.relatedToUiType).filter}
                                                presetValues={relatedToUiConfig(form.relatedToUiType).presetValues}
                                                value={form.relatedToId} onChange={v => setField('relatedToId', v)}
                                            />
                                        </div>
                                    )}
                                    {isReimbursement && (
                                        <div className="add-product-name flex-col">
                                            <p>Bill / Receipt *</p>
                                            <input type="file" onChange={e => setFile(e.target.files[0] || null)} />
                                        </div>
                                    )}
                                    <div className="add-product-name flex-col">
                                        <p>Amount (₹) *</p>
                                        <input type="number" onWheel={e => e.target.blur()} min="0" step="any" value={form.amount} onChange={e => setField('amount', e.target.value)} />
                                    </div>
                                    <div className="add-product-name flex-col">
                                        <p>GST Rate % (optional, if claimable)</p>
                                        <input type="number" onWheel={e => e.target.blur()} min="0" step="any" value={form.gstRate} onChange={e => setField('gstRate', e.target.value)} />
                                    </div>
                                    <div className="add-product-name flex-col">
                                        <p>Date *</p>
                                        <StyledDatePicker value={form.date} onChange={v => setField('date', v)} />
                                    </div>
                                    <div className="add-product-name flex-col">
                                        <p>Payment Status</p>
                                        <StyledSelect value={paidNow ? 'paid' : 'pending'} onChange={v => setPaidNow(v === 'paid')} options={PAID_STATUS_OPTIONS} />
                                    </div>
                                    {paidNow && (
                                        <div className="add-product-name flex-col">
                                            <p>Bank Account (leave blank if cash)</p>
                                            <StyledSelect
                                                value={form.bankAccountId} onChange={v => setField('bankAccountId', v)} placeholder="Cash" loading={refDataLoading}
                                                options={bankAccounts.map(a => ({ value: a._id, label: `${a.accountName} · ${a.bankName}` }))}
                                            />
                                        </div>
                                    )}
                                    <div className="add-product-name flex-col wizard-field-full">
                                        <p>Notes</p>
                                        <textarea rows="2" value={form.notes} onChange={e => setField('notes', e.target.value)} placeholder="What was this actually for?" />
                                    </div>
                                </div>
                            </form>
                        </div>

                        <div className="edit-modal-actions exp-modal-footer">
                            <button type="button" className="add-btn cancel-btn" onClick={closeModal}>Cancel</button>
                            <button type="submit" form="record-expense-form" className="add-btn" disabled={saving}>{saving ? 'Saving…' : <><FontAwesomeIcon icon={faCheck} className="pq-action-icon" /> Record Expense</>}</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {loading ? (
                <div className="admin-empty-state"><p>Loading…</p></div>
            ) : expenses.length === 0 ? (
                <div className="admin-empty-state"><p>No expenses recorded yet.</p></div>
            ) : visibleExpenses.length === 0 ? (
                <div className="admin-empty-state"><p>Nothing matches this filter.</p></div>
            ) : (
                <div className="list-table finance-table">
                    <div className="list-table-format title exp-row exp-header" style={{ gridTemplateColumns: columns }}>
                        <b>Date</b>
                        {!hideCategoryField && <b>Category</b>}
                        {!hideProjectField && <b>Project</b>}
                        {!hideWorkField && <b>Work</b>}
                        {!hideRelatedToField && <b>Related To</b>}
                        <b>Amount</b><b>Paid</b><b>Status</b><b>Action</b>
                    </div>
                    {visibleExpenses.map(e => {
                            const status = statusFor(e);
                            return (
                                <div
                                    key={e._id} id={`expense-row-${e._id}`} className="list-table-format row-item exp-row"
                                    style={{ gridTemplateColumns: columns, ...(flashId === e._id ? { background: 'rgba(201,168,124,0.28)', transition: 'background 2s ease' } : {}) }}
                                >
                                    <p className="exp-date">{new Date(e.date).toLocaleDateString()}</p>
                                    <div className="exp-fields">
                                        {!hideCategoryField && (
                                            <p className="exp-field exp-category"><span className="exp-field-label">Category</span>{e.expenseCategory || '-'}</p>
                                        )}
                                        {!hideProjectField && (
                                            <p className="exp-field exp-project"><span className="exp-field-label">Project</span>{e.projectId?.name || 'General'}</p>
                                        )}
                                        {!hideWorkField && (
                                            <p className="exp-field exp-work"><span className="exp-field-label">Work</span>{e.workId?.workType || '-'}</p>
                                        )}
                                        {!hideRelatedToField && (
                                            <p className="exp-field exp-relatedto"><span className="exp-field-label">Related To</span>{e.relatedToId?.name || e.relatedToId?.companyName || '-'}</p>
                                        )}
                                    </div>
                                    <p className="exp-amount"><span className="exp-field-label">Amount</span>₹{e.amount.toLocaleString('en-IN')}</p>
                                    <p className="exp-paid"><span className="exp-field-label">Paid</span>₹{e.paidAmount.toLocaleString('en-IN')}</p>
                                    <p className="exp-status"><span className="item-category" style={{ color: status.color }}>{status.label}</span></p>
                                    <div className="action-buttons exp-actions" style={{ flexWrap: 'wrap', rowGap: '6px' }}>
                                        <p onClick={() => setViewTarget(e)} className="cursor edit-action">View</p>
                                        {fixedProjectId && (
                                            <p onClick={() => navigate(`/finance/payables?tab=expenses&expenseId=${e._id}`)} className="cursor edit-action">Details</p>
                                        )}
                                        {e.balance > 0 && <p onClick={() => openSettle(e)} className="cursor edit-action">Settle</p>}
                                        <button type="button" onClick={() => setConfirmItem(e)} className="pq-btn-ghost-danger" title="Remove expense" aria-label="Remove expense">
                                            <FontAwesomeIcon icon={faTrash} className="pq-action-icon" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                </div>
            )}

            {settleTarget && ReactDOM.createPortal(
                <div className="submit-loader-overlay exps-overlay" style={{ zIndex: 99999 }}>
                    <div className="loader-modal-box edit-modal exps-modal">
                        <div className="exps-modal-header">
                            <h2>Settle Expense: {settleTarget.expenseCategory || 'General'}</h2>
                            <p className="admin-subtitle" style={{ margin: '4px 0 16px' }}>
                                Amount ₹{settleTarget.amount.toLocaleString('en-IN')} · Paid ₹{settleTarget.paidAmount?.toLocaleString('en-IN') ?? '0'} · Balance ₹{settleTarget.balance.toLocaleString('en-IN')}
                            </p>
                        </div>

                        <div className="exps-modal-body">
                            {paymentsLoading ? (
                                <div className="admin-empty-state"><p>Loading…</p></div>
                            ) : payments.length > 0 && (
                                <div className="list-table finance-table" style={{ marginBottom: '16px' }}>
                                    <div className="list-table-format title esh-row esh-header" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                                        <b>Date</b><b>Amount</b><b>Mode</b>
                                    </div>
                                    {payments.map(p => (
                                        <div key={p._id} className="list-table-format row-item esh-row" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                                            <p className="esh-date">{new Date(p.date).toLocaleDateString()}</p>
                                            <p className="esh-amount">₹{p.amount.toLocaleString('en-IN')}</p>
                                            <p className="esh-mode">{p.bankAccountId?.accountName || 'Cash'}</p>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <form id="settle-expense-form" onSubmit={submitSettle}>
                                <div className="wizard-field-grid">
                                    <div className="add-product-name flex-col">
                                        <p>Payment Amount (₹) *</p>
                                        <input type="number" onWheel={e => e.target.blur()} min="0" step="any" value={settleForm.amount} onChange={e => setSettleField('amount', e.target.value)} />
                                    </div>
                                    <div className="add-product-name flex-col">
                                        <p>Date *</p>
                                        <StyledDatePicker value={settleForm.date} onChange={v => setSettleField('date', v)} />
                                    </div>
                                    <div className="add-product-name flex-col wizard-field-full">
                                        <p>Bank Account (leave blank if cash)</p>
                                        <StyledSelect
                                            value={settleForm.bankAccountId} onChange={v => setSettleField('bankAccountId', v)} placeholder="Cash" loading={refDataLoading}
                                            options={bankAccounts.map(a => ({ value: a._id, label: `${a.accountName} · ${a.bankName}` }))}
                                        />
                                    </div>
                                </div>
                            </form>
                        </div>

                        <div className="edit-modal-actions exps-modal-footer">
                            <button type="button" className="add-btn cancel-btn" onClick={closeSettle}>Close</button>
                            <button type="submit" form="settle-expense-form" className="add-btn" disabled={settling}>{settling ? 'Saving…' : <><FontAwesomeIcon icon={faCheck} className="pq-action-icon" /> Add Payment</>}</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {viewTarget && ReactDOM.createPortal(
                <div className="submit-loader-overlay expv-overlay" style={{ zIndex: 99999 }} onClick={() => setViewTarget(null)}>
                    <div className="loader-modal-box edit-modal expv-modal" onClick={e => e.stopPropagation()}>
                        <div className="expv-modal-header">
                            <h2>{viewTarget.expenseCategory || 'General'} · ₹{viewTarget.amount.toLocaleString('en-IN')}</h2>
                        </div>

                        <div className="expv-modal-body">
                            <div className="list-table finance-table" style={{ marginTop: '12px' }}>
                                {/* Amount/Status/Paid/Balance/GST/Date are the figures
                                    someone opening this modal actually wants at a glance —
                                    grouped into their own block (expv-stat-grid) so mobile
                                    can pair them two-per-line instead of 6 full-width rows
                                    in a row; desktop is untouched (display:contents below
                                    keeps every .kv-row a normal direct list-table child,
                                    identical to before). The remaining fields are lower-
                                    priority metadata (links, payment plumbing, recording
                                    timestamp) and stay a plain stacked list. */}
                                <div className="expv-stat-grid">
                                    {[
                                        ['Amount', `₹${viewTarget.amount.toLocaleString('en-IN')}`, null, true],
                                        ['Status', statusFor(viewTarget).label, statusFor(viewTarget).color, true],
                                        ['Paid', `₹${viewTarget.paidAmount.toLocaleString('en-IN')}`],
                                        ['Balance', `₹${viewTarget.balance.toLocaleString('en-IN')}`, null, true],
                                        ['GST Claimable', viewTarget.gstAmount ? `₹${viewTarget.gstAmount.toLocaleString('en-IN')} (${viewTarget.gstRate}%)` : 'None'],
                                        ['Date', new Date(viewTarget.date).toLocaleDateString()],
                                    ].map(([label, value, color, emphasize]) => (
                                        <div key={label} className={`list-table-format row-item kv-row${emphasize ? ' expv-stat-emphasis' : ''}`} style={{ gridTemplateColumns: '1fr 1.4fr' }}>
                                            <p><b>{label}</b></p><p style={color ? { color } : undefined}>{value}</p>
                                        </div>
                                    ))}
                                </div>
                                <div className="expv-details-list">
                                    {[
                                        ['Category', viewTarget.expenseCategory || '-'],
                                        ['Project', viewTarget.projectId?.name || 'General / overhead'],
                                        ['Work', viewTarget.workId?.workType || 'Not tied to a Work'],
                                        ['Related To', viewTarget.relatedToId ? `${relatedToTypeLabel(viewTarget)}: ${viewTarget.relatedToId.name || viewTarget.relatedToId.companyName}` : 'None'],
                                        ['Payment Mode', viewTarget.paymentMode || '-'],
                                        ['Bank Account', viewTarget.bankAccountId?.accountName || (viewTarget.paymentMode ? 'Cash' : '-')],
                                        ['Bank / Cash Label', viewTarget.bankOrCashLabel || '-'],
                                        ['Recorded', viewTarget.createdAt ? new Date(viewTarget.createdAt).toLocaleString() : '-'],
                                    ].map(([label, value]) => (
                                        <div key={label} className="list-table-format row-item kv-row" style={{ gridTemplateColumns: '1fr 1.4fr' }}>
                                            <p><b>{label}</b></p><p>{value}</p>
                                        </div>
                                    ))}
                                </div>
                                {REIMBURSEMENT_TYPES.includes(viewTarget.relatedToType) && (
                                    <div className="list-table-format row-item kv-row" style={{ gridTemplateColumns: '1fr 1.4fr' }}>
                                        <p><b>Bill / Receipt</b></p>
                                        <p>{viewTarget.attachmentUrl ? <a href={viewTarget.attachmentUrl} target="_blank" rel="noopener noreferrer">View attachment</a> : 'None'}</p>
                                    </div>
                                )}
                                <div className="list-table-format row-item kv-row expv-notes-row" style={{ gridTemplateColumns: '1fr 1.4fr', alignItems: 'start' }}>
                                    <p><b>Notes</b></p><p style={{ whiteSpace: 'pre-wrap' }}>{viewTarget.notes || '-'}</p>
                                </div>
                            </div>
                        </div>

                        <div className="edit-modal-actions expv-modal-footer">
                            <button type="button" className="add-btn cancel-btn" onClick={() => setViewTarget(null)}>Close</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {confirmItem && ReactDOM.createPortal(
                <div className="bin-confirm-backdrop" onClick={() => !deleting && setConfirmItem(null)}>
                    <div className="bin-confirm-modal" onClick={e => e.stopPropagation()}>
                        <div className="bin-confirm-icon"><i className="fa-solid fa-triangle-exclamation" /></div>
                        <h3>Remove this expense?</h3>
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

export default ExpensesManager;
