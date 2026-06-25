import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import moment from 'moment';
import '../styles/list.css';
import '@fortawesome/fontawesome-free/css/all.min.css';

const STATUS_LABEL = {
  pending:  { text: 'Pending',  cls: 'req-badge req-badge--pending'  },
  approved: { text: 'Approved', cls: 'req-badge req-badge--approved' },
  rejected: { text: 'Rejected', cls: 'req-badge req-badge--rejected' },
};

const AdminRequests = ({ url }) => {
  const [activeTab, setActiveTab]   = useState('requests');
  const [requests,  setRequests]    = useState([]);
  const [admins,    setAdmins]      = useState([]);
  const [loading,   setLoading]     = useState(true);
  const [filter,    setFilter]      = useState('all');
  const [query,     setQuery]       = useState('');
  const token = localStorage.getItem('token');

  /* ── Fetch requests ── */
  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${url}/api/requests/list`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.success) setRequests(res.data.data);
      else toast.error('Failed to load requests.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load requests.');
    } finally {
      setLoading(false);
    }
  }, [url, token]);

  /* ── Fetch admins ── */
  const fetchAdmins = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${url}/api/admin/list-admins`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.success) setAdmins(res.data.data);
      else toast.error('Failed to load admins.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load admins.');
    } finally {
      setLoading(false);
    }
  }, [url, token]);

  useEffect(() => {
    fetchRequests();
    fetchAdmins();
  }, [fetchRequests, fetchAdmins]);

  /* ── Approve / Reject ── */
  const handle = async (action, requestId) => {
    if (action === 'reject' && !window.confirm('Reject this request? The applicant will not be notified.')) return;
    try {
      const res = await axios.post(
        `${url}/api/requests/${action}`,
        { requestId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) {
        toast.success(res.data.message);
        fetchRequests();
        if (action === 'approve') fetchAdmins();
      } else {
        toast.error(res.data.message);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || `Failed to ${action} request.`);
    }
  };

  /* ── Delete request ── */
  const deleteRequest = async (requestId) => {
    try {
      const res = await axios.delete(`${url}/api/requests/delete`, {
        data: { requestId },
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.success) {
        toast.success(res.data.message);
        setRequests(prev => prev.filter(r => r._id !== requestId));
      } else {
        toast.error(res.data.message);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete request.');
    }
  };

  /* ── Remove admin ── */
  const removeAdmin = async (userId, name) => {
    if (!window.confirm(`Revoke admin access for "${name}"? They will lose all admin privileges immediately.`)) return;
    try {
      const res = await axios.post(
        `${url}/api/admin/remove-admin`,
        { userId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) {
        toast.success(res.data.message);
        setAdmins(prev => prev.filter(a => a._id !== userId));
      } else {
        toast.error(res.data.message);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove admin.');
    }
  };

  const counts = {
    all:      requests.length,
    pending:  requests.filter(r => r.status === 'pending').length,
    approved: requests.filter(r => r.status === 'approved').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
  };

  const q = query.toLowerCase();
  const visible = requests
    .filter(r => filter === 'all' || r.status === filter)
    .filter(r => !q || r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q));
  const visibleAdmins = admins
    .filter(a => !q || a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q));

  return (
    <div className="list add flex-col">
      <div className="admin-list-container">

        <div className="admin-header-split">
          <div>
            <h1>Master Panel</h1>
            <p className="admin-subtitle">Manage admin access requests and current admin accounts.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div className="admin-search-wrap">
              <i className="fa-solid fa-magnifying-glass" />
              <input
                type="text"
                placeholder="Search by name or email…"
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
              {query && <button className="admin-search-clear" onClick={() => setQuery('')}>×</button>}
            </div>
            <div className="admin-count-badge">{counts.pending} pending</div>
          </div>
        </div>

        {/* ── Top tab switcher ── */}
        <div className="admin-category-scroll" style={{ marginBottom: '8px' }}>
          <button
            className={`admin-cat-pill${activeTab === 'requests' ? ' active' : ''}`}
            onClick={() => setActiveTab('requests')}
          >
            Access Requests ({counts.all})
          </button>
          <button
            className={`admin-cat-pill${activeTab === 'admins' ? ' active' : ''}`}
            onClick={() => setActiveTab('admins')}
          >
            Admin Users ({admins.length})
          </button>
        </div>

        {/* ══════════════════ REQUESTS TAB ══════════════════ */}
        {activeTab === 'requests' && (
          <>
            {/* Status filter pills */}
            <div className="admin-category-scroll">
              {[
                { key: 'all',      label: `All (${counts.all})`           },
                { key: 'pending',  label: `Pending (${counts.pending})`   },
                { key: 'approved', label: `Approved (${counts.approved})` },
                { key: 'rejected', label: `Rejected (${counts.rejected})` },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  className={`admin-cat-pill${filter === key ? ' active' : ''}`}
                  onClick={() => setFilter(key)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="list-table">
              <div className="list-table-format title req-grid">
                <b>Applicant</b>
                <b>Reason</b>
                <b>Date</b>
                <b>Status</b>
                <b>Actions</b>
              </div>

              {loading ? (
                <div className="admin-empty-state">Loading…</div>
              ) : visible.length === 0 ? (
                <div className="admin-empty-state">No requests found.</div>
              ) : (
                visible.map((req) => {
                  const s = STATUS_LABEL[req.status];
                  return (
                    <div key={req._id} className="list-table-format row-item req-grid">

                      <div>
                        <p className="item-name">{req.name}</p>
                        <p style={{ fontFamily: '"DM Sans",sans-serif', fontSize: '0.78rem', color: 'var(--text-mid)', margin: '3px 0 0' }}>
                          {req.email}
                        </p>
                      </div>

                      <p style={{ fontFamily: '"DM Sans",sans-serif', fontSize: '0.82rem', color: 'var(--text-mid)', margin: 0, lineHeight: 1.5 }}>
                        {req.reason || <em style={{ color: 'var(--text-lt)' }}>—</em>}
                      </p>

                      <p style={{ fontFamily: '"DM Sans",sans-serif', fontSize: '0.78rem', color: 'var(--text-lt)', margin: 0 }}>
                        {moment(req.createdAt).format('DD MMM YYYY')}
                      </p>

                      <span className={s.cls}>{s.text}</span>

                      <div className="action-buttons">
                        {req.status === 'pending' ? (
                          <>
                            <p
                              className="cursor edit-action"
                              onClick={() => handle('approve', req._id)}
                              style={{ color: '#16a34a', borderColor: 'rgba(34,197,94,0.3)' }}
                            >
                              Approve
                            </p>
                            <p
                              className="cursor delete-action"
                              onClick={() => handle('reject', req._id)}
                            >
                              Reject
                            </p>
                          </>
                        ) : (
                          <p
                            className="cursor delete-action"
                            onClick={() => deleteRequest(req._id)}
                            title="Delete this request"
                          >
                            Delete
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* ══════════════════ ADMINS TAB ══════════════════ */}
        {activeTab === 'admins' && (
          <div className="list-table">
            <div className="list-table-format title admin-grid">
              <b>Name</b>
              <b>Email</b>
              <b>Added</b>
              <b>Action</b>
            </div>

            {loading ? (
              <div className="admin-empty-state">Loading…</div>
            ) : admins.length === 0 ? (
              <div className="admin-empty-state">No admins found.</div>
            ) : (
              visibleAdmins.map((admin) => (
                <div key={admin._id} className="list-table-format row-item admin-grid">

                  <p className="item-name">{admin.name}</p>

                  <p style={{ fontFamily: '"DM Sans",sans-serif', fontSize: '0.82rem', color: 'var(--text-mid)', margin: 0 }}>
                    {admin.email}
                  </p>

                  <p style={{ fontFamily: '"DM Sans",sans-serif', fontSize: '0.78rem', color: 'var(--text-lt)', margin: 0 }}>
                    {moment(admin.createdAt).format('DD MMM YYYY')}
                  </p>

                  <div className="action-buttons">
                    <p
                      className="cursor delete-action"
                      onClick={() => removeAdmin(admin._id, admin.name)}
                    >
                      Revoke
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

      </div>

      <style>{`
        .req-grid {
          grid-template-columns: 1.6fr 1.8fr 0.9fr 0.8fr 160px !important;
        }
        .admin-grid {
          grid-template-columns: 1.4fr 2fr 1fr 120px !important;
        }
        .req-badge {
          display: inline-flex;
          align-items: center;
          padding: 4px 12px;
          border-radius: 20px;
          font-family: "DM Sans", sans-serif;
          font-size: 0.7rem;
          font-weight: 700;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          width: fit-content;
        }
        .req-badge--pending  { background: rgba(245,158,11,0.1);  border: 1px solid rgba(245,158,11,0.3);  color: #b45309; }
        .req-badge--approved { background: rgba(34,197,94,0.1);   border: 1px solid rgba(34,197,94,0.3);   color: #15803d; }
        .req-badge--rejected { background: rgba(239,68,68,0.08);  border: 1px solid rgba(239,68,68,0.25);  color: #dc2626; }

        @media (max-width: 768px) {
          .req-grid   { grid-template-columns: 1fr auto !important; }
          .admin-grid { grid-template-columns: 1fr auto !important; }
        }
      `}</style>
    </div>
  );
};

export default AdminRequests;
