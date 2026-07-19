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
                conflicts.push({ projectName: r.workId?.projectId?.name || '-', workType: r.workId?.workType || '-' });
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
                        <span key={i}>{c.projectName} · {c.workType}, maintaining a labour team there</span>
                    ))}
                </p>
                <p className="bin-confirm-warning">A supervisor can run more than one team; assign them here too?</p>
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

/*
 * Project-level sibling of useSupervisorConflictCheck above — flags when
 * the Assigned Supervisor picked on a project (financeProject.
 * assignedSupervisorId) already runs a *different* project. A supervisor
 * has two distinct things that can conflict, not one: the projects they're
 * the overall assignedSupervisorId for, AND the individual Work labour
 * teams they run day-to-day (financeWorkLabourAssignment.supervisorId) —
 * both are checked and listed separately, since a supervisor can easily be
 * running a team inside a project that isn't even the one flagging them as
 * its assignedSupervisorId. Reused from the New Project wizard's Basic
 * Info step, where this field is first set.
 *
 * Purely informational, not a confirm gate: the picker applies the
 * selection immediately (see NewProjectWizard.jsx's onChange), and this
 * just fetches in the background and pops a heads-up afterwards if there
 * turns out to be a conflict. Gating the visible selection on this
 * network round-trip (GET /projects/list, unfiltered — no dedicated
 * endpoint exists, mirroring SupervisorsPage.jsx's own client-side filter
 * for a supervisor's "Assigned Projects") made picking a supervisor feel
 * like it had hung for a beat every time, for a check that's advisory
 * anyway — a supervisor running more than one project (or team) is normal,
 * this is just a nudge to notice.
 */
export const useProjectSupervisorConflictCheck = (url) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const [pending, setPending] = useState(null); // { supervisorName, projectConflicts, teamConflicts }

    // excludeProjectId: the project this assignment is FOR — already
    // supervising that one (or running a team inside it) isn't a conflict,
    // only a *different* project is.
    const checkProjectSupervisor = async (employeeId, excludeProjectId) => {
        if (!employeeId) return;
        try {
            const [projectsRes, assignmentsRes] = await Promise.all([
                axios.get(`${url}/api/finance/projects/list`, authHeader),
                axios.get(`${url}/api/finance/work-labour-assignments/list`, { ...authHeader, params: { supervisorId: employeeId } }),
            ]);

            const projects = projectsRes.data.success ? projectsRes.data.data : [];
            const projectMatches = projects.filter(p =>
                (p.assignedSupervisorId?._id || p.assignedSupervisorId) === employeeId
                && p._id !== excludeProjectId
                && p.status !== 'completed'
            );

            const rows = assignmentsRes.data.success ? assignmentsRes.data.data : [];
            const seenWorkIds = new Set();
            const teamConflicts = [];
            for (const r of rows) {
                const workId = r.workId?._id || r.workId;
                const projId = r.workId?.projectId?._id || r.workId?.projectId;
                if (!workId || seenWorkIds.has(workId) || projId === excludeProjectId) continue;
                seenWorkIds.add(workId);
                teamConflicts.push({ projectName: r.workId?.projectId?.name || '-', workType: r.workId?.workType || '-' });
            }

            if (!projectMatches.length && !teamConflicts.length) return;
            setPending({
                supervisorName: projectMatches[0]?.assignedSupervisorId?.name || rows[0]?.supervisorId?.name || 'This supervisor',
                projectConflicts: projectMatches.map(p => ({ projectName: p.name })),
                teamConflicts,
            });
        } catch { /* silent — purely informational, nothing to fail open from */ }
    };

    const modal = pending ? ReactDOM.createPortal(
        <div className="bin-confirm-backdrop" onClick={() => setPending(null)}>
            <div className="bin-confirm-modal" onClick={e => e.stopPropagation()}>
                <div className="bin-confirm-icon"><i className="fa-solid fa-triangle-exclamation" /></div>
                <h3>{pending.supervisorName} is already supervising elsewhere</h3>
                <p className="bin-confirm-name" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {pending.projectConflicts.map((c, i) => (
                        <span key={`p${i}`}>{c.projectName}</span>
                    ))}
                    {pending.teamConflicts.map((c, i) => (
                        <span key={`t${i}`}>Labour team in {c.workType} in {c.projectName}</span>
                    ))}
                </p>
                <p className="bin-confirm-warning">A supervisor can run more than one project (or team) — just flagging it.</p>
                <div className="bin-confirm-actions">
                    <button className="bin-btn-delete" onClick={() => setPending(null)}>Got it</button>
                </div>
            </div>
        </div>,
        document.body
    ) : null;

    return { checkProjectSupervisor, modal };
};
