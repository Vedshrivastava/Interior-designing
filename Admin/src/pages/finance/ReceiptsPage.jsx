import React from 'react';
import FinanceTabShell from '../../components/finance/FinanceTabShell';
import ReceiptsManager from '../../components/finance/ReceiptsManager';

const ReceiptsPage = ({ url }) => (
    <FinanceTabShell
        label="Receipts"
        subtitle="Money received from clients — entry form and full history, filterable by project."
    >
        <ReceiptsManager url={url} />
    </FinanceTabShell>
);

export default ReceiptsPage;
