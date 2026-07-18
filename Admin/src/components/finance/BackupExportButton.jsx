import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';

const BackupExportButton = ({ url }) => {
    const token = localStorage.getItem('token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const [downloading, setDownloading] = useState(false);

    const exportBackup = async () => {
        setDownloading(true);
        try {
            const res = await axios.get(`${url}/api/finance/settings/backup/export`, { ...authHeader, responseType: 'blob' });
            const blobUrl = URL.createObjectURL(new Blob([res.data], { type: 'application/zip' }));
            const a = document.createElement('a');
            a.href = blobUrl; a.download = `finance-backup-${new Date().toISOString().slice(0, 10)}.zip`;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);
            toast.success('Backup downloaded');
        } catch { toast.error('Error exporting backup'); }
        finally { setDownloading(false); }
    };

    return (
        <div>
            <p className="admin-subtitle" style={{ marginBottom: '16px' }}>
                One zip containing one JSON file per finance collection: clients, vendors, projects, works, measurements,
                stock movements, running bills, receipts, contractor/vendor payments, purchases, bank accounts, cash entries,
                salary/commission payments, expenses, daily labour, supervisor attendance/incentives, and settings.
                Soft-deleted records are excluded.
            </p>
            <button type="button" className="add-btn" onClick={exportBackup} disabled={downloading}>
                {downloading ? 'Exporting…' : 'Export All Finance Data'}
            </button>
        </div>
    );
};

export default BackupExportButton;
