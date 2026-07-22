import React, { useState } from 'react';
import FinanceTabShell from '../../components/finance/FinanceTabShell';
import MasterCrudTable from '../../components/finance/MasterCrudTable';
import QuickAddPicker from '../../components/finance/QuickAddPicker';
import CommissionLedgerView from '../../components/finance/CommissionLedgerView';
import '../../styles/list.css';

const TABS = [
    { key: 'overview',         label: 'Overview' },
    { key: 'commissionLedger', label: 'Commission Ledger' },
];

/* Shared by the Commission Ledger tab — a referral is its own collection
   (financeReferral), not a vendor, so this is a plain picker with no
   vendorType filter needed. */
const ReferralPicker = ({ url, selectedReferralId, onChange }) => (
    <div className="add-product-name flex-col" style={{ marginBottom: '20px', maxWidth: '480px' }}>
        <p>Referral</p>
        <QuickAddPicker url={url} resourceKey="referrals" value={selectedReferralId} onChange={onChange} placeholder="Select referral…" />
    </div>
);

/* Relocated out of Procurement — a referral earns a commission cut for
   referring clients/projects, it isn't a vendor and doesn't fit under
   "material vendors and purchasing". Own top-level People page instead,
   same picker + ledger shape Contractors/Labourers already use. Commission
   Ledger = financeWork completedAreaSqft × financeWorkTypeRate's
   referralRatePerSqft across the projects this referral brought in, minus
   financeCommissionPayment payments — see CommissionLedgerView. */
const ReferralsPage = ({ url }) => {
    const [activeTab, setActiveTab] = useState(TABS[0].key);
    const [selectedReferralId, setSelectedReferralId] = useState('');

    return (
        <FinanceTabShell
            label="Referrals"
            subtitle="People who earn a commission cut for referring clients or projects."
            tabs={TABS}
            activeKey={activeTab}
            onTabChange={setActiveTab}
        >
            {activeTab === 'overview' && <MasterCrudTable url={url} resourceKey="referrals" />}
            {activeTab === 'commissionLedger' && (
                <>
                    <ReferralPicker url={url} selectedReferralId={selectedReferralId} onChange={setSelectedReferralId} />
                    {selectedReferralId
                        ? <CommissionLedgerView url={url} referralId={selectedReferralId} />
                        : <div className="admin-empty-state"><p>Select a referral to view their commission ledger.</p></div>}
                </>
            )}
        </FinanceTabShell>
    );
};

export default ReferralsPage;
