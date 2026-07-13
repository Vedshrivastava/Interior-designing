import React, { useState } from 'react';
import FinanceTabShell from '../../components/finance/FinanceTabShell';
import FinancialYearForm from '../../components/finance/FinancialYearForm';
import CompanySettingsForm from '../../components/finance/CompanySettingsForm';
import PermissionsManager from '../../components/finance/PermissionsManager';
import GstSettingsForm from '../../components/finance/GstSettingsForm';
import NotificationsSettingsForm from '../../components/finance/NotificationsSettingsForm';
import PdfTemplateSettingsForm from '../../components/finance/PdfTemplateSettingsForm';
import BackupExportButton from '../../components/finance/BackupExportButton';

const TABS = [
    { key: 'fy',            label: 'Financial Year' },
    { key: 'company',       label: 'Company' },
    { key: 'permissions',   label: 'Permissions' },
    { key: 'gst',           label: 'GST' },
    { key: 'notifications', label: 'Notifications' },
    { key: 'pdf',           label: 'PDF Templates' },
    { key: 'backup',        label: 'Backup' },
];

/*
 * Bespoke component, real as of the Settings build. Financial Year /
 * Company / GST / Notifications / PDF Templates all edit the same
 * financeCompanySettings singleton — each tab's own form only sends the
 * fields it owns (see each component), so switching tabs never risks
 * clobbering another tab's unsaved-elsewhere data. Permissions edits
 * user.allowedFinanceModules directly instead.
 */
const SettingsPage = ({ url }) => {
    const [activeTab, setActiveTab] = useState(TABS[0].key);

    return (
        <FinanceTabShell
            label="Settings"
            subtitle="System-level configuration — company profile, permissions, GST defaults, alert notifications, PDF branding, and data export."
            tabs={TABS}
            activeKey={activeTab}
            onTabChange={setActiveTab}
        >
            {activeTab === 'fy' && <FinancialYearForm url={url} />}
            {activeTab === 'company' && <CompanySettingsForm url={url} />}
            {activeTab === 'permissions' && <PermissionsManager url={url} />}
            {activeTab === 'gst' && <GstSettingsForm url={url} />}
            {activeTab === 'notifications' && <NotificationsSettingsForm url={url} />}
            {activeTab === 'pdf' && <PdfTemplateSettingsForm url={url} />}
            {activeTab === 'backup' && <BackupExportButton url={url} />}
        </FinanceTabShell>
    );
};

export default SettingsPage;
