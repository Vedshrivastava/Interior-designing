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
  const [requests, setRequests] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState('all');
  const token = localStorage.getItem('token');

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

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const handle = async (action, requestId, name) => {
    const label = action === 'approve' ? 'Approve' : 'Reject';
    try {
      const res = await axios.post(
        `${url}/api/requests/${action}`,
        { requestId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) {
        toast.success(res.data.message);
        fetchRequests();
      } else {
        toast.error(res.data.message);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || `Failed to ${label.toLowerCase()} request.`);
    }
  };

  const counts = {
    all:      requests.length,
    pending:  requests.filter(r => r.status === 'pending').length,
    approved: requests.filter(r => r.status === 'approved').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
  };

  const visible = filter === 'all' ? requests : requests.filter(r => r.status === filter);

  return (
    <div className="list add flex-col">
      <div className="admin-list-container">

        <div className="admin-header-split">
          <div>
            <h1>Admin Requests</h1>
            <p className="admin-subtitle">Review and manage admin access requests.</p>
          </div>
          <div className="admin-count-badge">{counts.pending} pending</div>
        </div>

        {/* Filter pills */}
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

        {/* Table */}
        <div className="list-table">
          <div className="list-table-format title req-grid">
            <b>Applicant</b>
            <b>Reason</b>
            <b>Date</b>
            <b>Status</b>
            <b>Action</b>
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

                  {/* Applicant */}
                  <div>
                    <p className="item-name">{req.name}</p>
                    <p style={{ fontFamily: '"DM Sans",sans-serif', fontSize: '0.78rem', color: 'var(--text-mid)', margin: '3px 0 0' }}>
                      {req.email}
                    </p>
                  </div>

                  {/* Reason */}
                  <p style={{ fontFamily: '"DM Sans",sans-serif', fontSize: '0.82rem', color: 'var(--text-mid)', margin: 0, lineHeight: 1.5 }}>
                    {req.reason || <em style={{ color: 'var(--text-lt)' }}>—</em>}
                  </p>

                  {/* Date */}
                  <p style={{ fontFamily: '"DM Sans",sans-serif', fontSize: '0.78rem', color: 'var(--text-lt)', margin: 0 }}>
                    {moment(req.createdAt).format('DD MMM YYYY')}
                  </p>

                  {/* Status badge */}
                  <span className={s.cls}>{s.text}</span>

                  {/* Actions */}
                  <div className="action-buttons">
                    {req.status === 'pending' ? (
                      <>
                        <p
                          className="cursor edit-action"
                          onClick={() => handle('approve', req._id, req.name)}
                          style={{ color: '#16a34a', borderColor: 'rgba(34,197,94,0.3)' }}
                        >
                          Approve
                        </p>
                        <p
                          className="cursor delete-action"
                          onClick={() => handle('reject', req._id, req.name)}
                        >
                          Reject
                        </p>
                      </>
                    ) : (
                      <span style={{ fontFamily: '"DM Sans",sans-serif', fontSize: '0.72rem', color: 'var(--text-lt)' }}>
                        {req.reviewedAt ? moment(req.reviewedAt).format('DD MMM') : '—'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Inline CSS for the request-specific classes */}
      <style>{`
        .req-grid {
          grid-template-columns: 1.6fr 1.8fr 0.9fr 0.8fr 160px !important;
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
          .req-grid { grid-template-columns: 1fr auto !important; }
        }
      `}</style>
    </div>
  );
};

export default AdminRequests;
