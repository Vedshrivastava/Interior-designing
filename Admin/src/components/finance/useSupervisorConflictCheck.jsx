import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';

/*
 * Supervisors can legitimately run more than one Work/team at once — this
 * never blocks that, it just surfaces it before committing so nobody
 * double-books by accident (mirrors the harder block already in place for
 * labourers themselves, see assertLabourersAvailable — a person can only
 * be on one Work, but a supervisor overseeing several is normal). Reused
 * everywhere a supervisor gets tied to a Work: AddMeasurementModal.jsx's
 * labour Supervisor field, and WorksManager.jsx's two team-assignment
 * pickers (creating a Work with an initial team, and "Manage Labour"'s
 * add-another-team flow).
 *
 * GET /work-labour-assignments/list?supervisorId= already populates
 * workId with { workType, projectId: { name } } and supervisorId with
 * { name } — nothing extra needed from the backend.
 */
export const useSupervisorConflictCheck = (url) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const [pending, setPending] = useState(null); // { supervisorName, conflicts, onProceed }

    // excludeWorkId: the Work this assignment is FOR — a supervisor already
    // running a different team on that same Work isn't a conflict worth
    // flagging, only a *different* Work is.
    const checkSupervisor = async (employeeId, excludeWorkId, onProceed) => {
        if (!employeeId) return;
        try {
            const res = await axios.get(`${url}/api/finance/work-labour-assignments/list`, { ...authHeader, params: { supervisorId: employeeId } });
            const rows = res.data.success ? res.data.data : [];
            const seenWorkIds = new Set();
            const conflicts = [];
            for (const r of rows) {
                const workId = r.workId?._id || r.workId;
                if (!workId || workId === excludeWorkId || seenWorkIds.has(workId)) continue;
                seenWorkIds.add(workId);
                conflicts.push({ projectName: r.workId?.projectId?.name || '—', workType: r.workId?.workType || '—' });
            }
            if (!conflicts.length) { onProceed(); return; }
            setPending({ supervisorName: rows[0]?.supervisorId?.name || 'This supervisor', conflicts, onProceed });
        } catch {
            onProceed(); // fail open — a failed check shouldn't block the real action
        }
    };

    const modal = pending ? ReactDOM.createPortal(
        <div className="bin-confirm-backdrop" onClick={() => setPending(null)}>
            <div className="bin-confirm-modal" onClick={e => e.stopPropagation()}>
                <div className="bin-confirm-icon"><i className="fa-solid fa-triangle-exclamation" /></div>
                <h3>{pending.supervisorName} is already assigned elsewhere</h3>
                <p className="bin-confirm-name" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {pending.conflicts.map((c, i) => (
                        <span key={i}>{c.projectName} — {c.workType}, maintaining a labour team there</span>
                    ))}
                </p>
                <p className="bin-confirm-warning">A supervisor can run more than one team — assign them here too?</p>
                <div className="bin-confirm-actions">
                    <button className="bin-btn-cancel" onClick={() => setPending(null)}>Cancel</button>
                    <button className="bin-btn-delete" onClick={() => { pending.onProceed(); setPending(null); }}>Yes, Assign</button>
                </div>
            </div>
        </div>,
        document.body
    ) : null;

    return { checkSupervisor, modal };
};
