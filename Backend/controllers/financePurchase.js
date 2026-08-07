import FinancePurchase from '../models/financePurchase.js';
import FinanceStockMovement from '../models/financeStockMovement.js';
import FinanceVendor from '../models/financeVendor.js';
import FinanceMaterial from '../models/financeMaterial.js';
import FinanceProject from '../models/financeProject.js';
import { broadcast } from '../middlewares/webSocket.js';
import { logActivity } from '../utils/financeActivityLog.js';
import { computeCurrentStock } from './financeStockMovement.js';

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

        const movement = await FinanceStockMovement.create({
            projectId, materialId, vendorId,
            movementType: type === 'return' ? 'return' : 'dump',
            quantity: Number(quantity), date,
            relatedPurchaseId: purchase._id,
        });

        broadcast({ type: 'financePurchasesChanged', projectId, vendorId });
        broadcast({ type: 'financeStockChanged', projectId });

        const [vendor, material, project] = await Promise.all([
            FinanceVendor.findById(vendorId).select('name'),
            FinanceMaterial.findById(materialId).select('name unit'),
            FinanceProject.findById(projectId).select('name'),
        ]);
        if (type === 'return') {
            await logActivity({
                eventType: 'stock_returned',
                entityType: 'financeStockMovement',
                entityId: movement._id,
                projectId,
                summary: `${Number(quantity)} ${material?.unit || ''} of ${material?.name || 'material'} returned at ${project?.name || 'project'}`,
                req,
            });
        } else {
            await logActivity({
                eventType: 'material_purchased',
                entityType: 'financePurchase',
                entityId: purchase._id,
                projectId,
                summary: `${Number(quantity)} ${material?.unit || ''} of ${material?.name || 'material'} purchased from ${vendor?.name || 'vendor'}`,
                entityNames: vendor?.name ? [vendor.name] : [],
                amount: totalAmount,
                req,
            });
        }

        res.json({ success: true, message: `${type === 'return' ? 'Return' : 'Purchase'} recorded`, data: purchase });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error recording purchase' });
    }
};

// Same fields/validation as addPurchase, but re-saved onto both the
// purchase AND its linked stock movement — a purchase and the dump/return
// it generated are two records of the same event, not independent facts
// (see removePurchase's own comment below), so an edit that only touched
// the purchase document would leave stock computed from a now-stale
// quantity/material/project. transactionType is intentionally not
// editable here: PurchaseOrReturnManager always submits the tab's own
// fixed type, same as addPurchase.
const updatePurchase = async (req, res) => {
    try {
        const { _id, vendorId, projectId, materialId, quantity, ratePerUnit, date, referenceNumber, notes, gstRate } = req.body;
        const existing = await FinancePurchase.findById(_id);
        if (!existing) return res.status(404).json({ success: false, message: 'Not found' });
        if (!vendorId || !projectId || !materialId) {
            return res.status(400).json({ success: false, message: 'Vendor, project, and material are required' });
        }
        if (!quantity || Number(quantity) <= 0) return res.status(400).json({ success: false, message: 'Quantity must be greater than zero' });
        if (!ratePerUnit || Number(ratePerUnit) <= 0) return res.status(400).json({ success: false, message: 'Rate per unit must be greater than zero' });
        if (!date) return res.status(400).json({ success: false, message: 'Date is required' });

        // A purchase's dump is what site usage draws against (see
        // financeMeasurement.js's own INSUFFICIENT_STOCK guard) — shrinking
        // it, or moving it to a different material/project, can't be
        // allowed to pull stock that's already been consumed/returned/
        // wasted out from under those measurements. Only checked for an
        // actual purchase — a return subtracts from stock, so editing one
        // down (or moving it away) only ever gives stock back, never risks
        // this. movingAway covers both "same material/project, smaller
        // quantity" and "different material/project entirely" with one
        // check: either way, this purchase's old contribution there drops
        // to (at most) the new quantity, or to zero if it no longer
        // applies to that pair at all.
        if (existing.transactionType !== 'return') {
            const stayingOnSamePair = projectId === existing.projectId.toString() && materialId === existing.materialId.toString();
            const oldStockRows = await computeCurrentStock(existing.projectId, existing.materialId);
            const oldCurrent = oldStockRows[0]?.currentStock || 0;
            const remainingContribution = stayingOnSamePair ? Number(quantity) : 0;
            const afterStock = oldCurrent - existing.quantity + remainingContribution;
            if (afterStock < 0) {
                const [material, project] = await Promise.all([
                    FinanceMaterial.findById(existing.materialId).select('name unit'),
                    FinanceProject.findById(existing.projectId).select('name'),
                ]);
                const unit = material?.unit ? ` ${material.unit}` : '';
                const message = stayingOnSamePair
                    ? `Only ${oldCurrent}${unit} of ${material?.name || 'this material'} is still unused at ${project?.name || 'this project'} — can't reduce this purchase below ${(existing.quantity - oldCurrent)}${unit}.`
                    : `Can't move this purchase off ${material?.name || 'this material'} at ${project?.name || 'this project'} — only ${oldCurrent}${unit} of the ${existing.quantity}${unit} it added is still unused there.`;
                return res.status(400).json({ success: false, message, code: 'INSUFFICIENT_STOCK' });
            }
        }

        const totalAmount = Number(quantity) * Number(ratePerUnit);
        const hasGst = gstRate !== undefined && gstRate !== null && gstRate !== '';
        await FinancePurchase.findByIdAndUpdate(_id, {
            vendorId, projectId, materialId,
            quantity: Number(quantity), ratePerUnit: Number(ratePerUnit), totalAmount,
            date, referenceNumber: referenceNumber || '', notes: notes || '',
            gstRate: hasGst ? Number(gstRate) : null,
            gstAmount: hasGst ? totalAmount * (Number(gstRate) / 100) : null,
        });
        await FinanceStockMovement.updateMany(
            { relatedPurchaseId: _id },
            { projectId, materialId, vendorId, quantity: Number(quantity), date }
        );

        broadcast({ type: 'financePurchasesChanged', projectId, vendorId });
        broadcast({ type: 'financeStockChanged', projectId });
        // Old project's stock also shifts (the movement just left it) if
        // the edit re-scoped this purchase to a different project.
        if (projectId.toString() !== existing.projectId.toString()) {
            broadcast({ type: 'financeStockChanged', projectId: existing.projectId });
        }

        res.json({ success: true, message: `${existing.transactionType === 'return' ? 'Return' : 'Purchase'} updated` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error updating purchase' });
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

        const [vendor, material] = await Promise.all([
            FinanceVendor.findById(item.vendorId).select('name'),
            FinanceMaterial.findById(item.materialId).select('name unit'),
        ]);
        await logActivity({
            eventType: item.transactionType === 'return' ? 'stock_return_deleted' : 'purchase_deleted',
            entityType: 'financePurchase',
            entityId: item._id,
            projectId: item.projectId || null,
            summary: `${item.quantity} ${material?.unit || ''} of ${material?.name || 'material'} — ${item.transactionType === 'return' ? 'return' : 'purchase'} deleted`,
            entityNames: vendor?.name ? [vendor.name] : [],
            amount: item.totalAmount,
            req,
        });

        res.json({ success: true, message: `${item.transactionType === 'return' ? 'Return' : 'Purchase'} removed` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error removing purchase' });
    }
};

export { listPurchases, addPurchase, updatePurchase, removePurchase };
