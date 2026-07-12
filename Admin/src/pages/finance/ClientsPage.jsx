import React from 'react';
import FinanceTabShell from '../../components/finance/FinanceTabShell';
import MasterCrudTable from '../../components/finance/MasterCrudTable';

/* Relocated out of Master Data — same MasterCrudTable list/add/edit/remove
   this tab always used, just mounted at its own top-level route. Client
   names now link into ClientDetail. */
const ClientsPage = ({ url }) => (
    <FinanceTabShell
        label="Clients"
        subtitle="Client master — name, contact, billing details. Click a client to open their detail view."
    >
        <MasterCrudTable url={url} resourceKey="clients" getDetailLink={(item) => `/finance/clients/${item._id}`} />
    </FinanceTabShell>
);

export default ClientsPage;
