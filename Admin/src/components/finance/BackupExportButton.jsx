import React from 'react';
import { useFileDownload } from '../../hooks/useFileDownload';
import DownloadButton from './DownloadButton';

const BackupExportButton = ({ url }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const { downloading, progress, run } = useFileDownload(authHeader);

    const exportBackup = () => run(
        url, '/api/finance/settings/backup/export', `finance-backup-${new Date().toISOString().slice(0, 10)}.zip`, {}, 'Error exporting backup'
    );

    return (
        <div>
            <p className="admin-subtitle" style={{ marginBottom: '16px' }}>
                One zip containing one JSON file per finance collection: clients, vendors, projects, works, measurements,
                stock movements, running bills, receipts, contractor/vendor payments, purchases, bank accounts, cash entries,
                salary/commission payments, expenses, daily labour, supervisor attendance/incentives, and settings.
                Soft-deleted records are excluded.
            </p>
            <DownloadButton
                downloading={downloading} progress={progress}
                idleLabel="Export All Finance Data" onClick={exportBackup} className="add-btn"
            />
        </div>
    );
};

export default BackupExportButton;
