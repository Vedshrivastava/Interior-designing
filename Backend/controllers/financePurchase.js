import FinancePurchase from '../models/financePurchase.js';
import FinanceStockMovement from '../models/financeStockMovement.js';
import { broadcast } from '../middlewares/webSocket.js';

// projectId/vendorId/materialId are optional narrowing filters, not
// required — Procurement's Purchases/Returns tabs list everything;
// vendor/project detail views narrow it down.
const listPurchases = async (req, res) => {
    try {
        const { projectId, vendorId, materialId, transactionType } = req.query;
        const filter = { deleted: { $ne: true } };
        if (projectId) filter.projectId = projectId;
        if (vendorId) filter.vendorId = vendorId;
        if (materialId) filter.materialId = materialId;
        if (transactionType) filter.transactionType = transactionType;
        const items = await FinancePurchase.find(filter)
            .populate('vendorId', 'name')
            .populate('materialId', 'name unit')
            .sort({ date: -1, createdAt: -1 });
        res.json({ success: true, data: items });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching purchases' });
    }
};

/*
 * A purchase auto-creates a `dump` stock movement; a return auto-creates a
 * `return` movement — both carry relatedPurchaseId. This is the one other
 * place (besides the measurement automation) allowed to create dump/return
 * movements automatically; manual entry through Site Inventory still works
 * independently for anything not tied to a formal purchase.
 */
const addPurchase = async (req, res) => {
    try {
        const { vendorId, projectId, materialId, quantity, ratePerUnit, transactionType, date, referenceNumber, notes, gstRate } = req.body;
        if (!vendorId || !projectId || !materialId) {
            return res.status(400).json({ success: false, message: 'Vendor, project, and material are required' });
        }
        if (!quantity || Number(quantity) <= 0) return res.status(400).json({ success: false, message: 'Quantity must be greater than zero' });
        if (!ratePerUnit || Number(ratePerUnit) <= 0) return res.status(400).json({ success: false, message: 'Rate per unit must be greater than zero' });
        if (!date) return res.status(400).json({ success: false, message: 'Date is required' });
        const type = transactionType === 'return' ? 'return' : 'purchase';

        const totalAmount = Number(quantity) * Number(ratePerUnit);
        const hasGst = gstRate !== undefined && gstRate !== null && gstRate !== '';
        const purchase = new FinancePurchase({
            vendorId, projectId, materialId,
            quantity: Number(quantity), ratePerUnit: Number(ratePerUnit), totalAmount,
            transactionType: type, date, referenceNumber: referenceNumber || '', notes: notes || '',
            gstRate: hasGst ? Number(gstRate) : null,
            gstAmount: hasGst ? totalAmount * (Number(gstRate) / 100) : null,
        });
        await purchase.save();

        await FinanceStockMovement.create({
            projectId, materialId,
            movementType: type === 'return' ? 'return' : 'dump',
            quantity: Number(quantity), date,
            relatedPurchaseId: purchase._id,
        });

        broadcast({ type: 'financePurchasesChanged', projectId, vendorId });
        broadcast({ type: 'financeStockChanged', projectId });
        res.json({ success: true, message: `${type === 'return' ? 'Return' : 'Purchase'} recorded`, data: purchase });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error recording purchase' });
    }
};

// Unlike removeMeasurement/removeWork (historical artifacts left as-is on
// delete), removing a purchase DOES reverse its stock movement — a
// purchase and the dump/return it generated are two records of the same
// event, not independent facts, so leaving the movement behind after
// deleting the purchase would misstate current stock.
const removePurchase = async (req, res) => {
    try {
        const { _id } = req.body;
        const item = await FinancePurchase.findById(_id);
        if (!item) return res.status(404).json({ success: false, message: 'Not found' });

        item.deleted = true; item.deletedAt = new Date(); item.deletedBy = req.userName || 'Admin';
        await item.save();
        await FinanceStockMovement.updateMany(
            { relatedPurchaseId: item._id },
            { deleted: true, deletedAt: new Date(), deletedBy: req.userName || 'Admin' }
        );

        broadcast({ type: 'financePurchasesChanged', projectId: item.projectId, vendorId: item.vendorId });
        broadcast({ type: 'financeStockChanged', projectId: item.projectId });
        res.json({ success: true, message: `${item.transactionType === 'return' ? 'Return' : 'Purchase'} removed` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing purchase' });
    }
};

export { listPurchases, addPurchase, removePurchase };
