import AdminRequest from "../models/adminRequest.js";
import userModel    from "../models/user.js";
import validator    from "validator";

/* ── Public: submit a request — account must already exist ── */
const submitRequest = async (req, res) => {
    const { name, email, reason } = req.body;
    try {
        if (!name || !email)
            return res.status(400).json({ success: false, message: 'Name and email are required.' });

        if (!validator.isEmail(email))
            return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });

        // Must have a registered account first
        const account = await userModel.findOne({ email });
        if (!account)
            return res.status(400).json({
                success: false,
                message: 'No account found for this email. Please create an account first, then request admin access.',
            });

        // Already an admin or master — no need to request
        if (account.role === 'ADMIN' || account.role === 'MASTER')
            return res.status(400).json({ success: false, message: 'This account already has admin access.' });

        // Prevent duplicate pending requests
        const existing = await AdminRequest.findOne({ email, status: 'pending' });
        if (existing)
            return res.status(409).json({ success: false, message: 'A pending request for this email already exists.' });

        const request = new AdminRequest({ name, email, reason: reason || '' });
        await request.save();

        return res.status(201).json({ success: true, message: 'Request submitted. The master admin will review it shortly.' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

/* ── MASTER: list all requests ── */
const listRequests = async (req, res) => {
    try {
        const requests = await AdminRequest.find().sort({ createdAt: -1 });
        return res.json({ success: true, data: requests });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

/* ── MASTER: approve → promote existing account to ADMIN ── */
const approveRequest = async (req, res) => {
    const { requestId } = req.body;
    try {
        const request = await AdminRequest.findById(requestId);
        if (!request)
            return res.status(404).json({ success: false, message: 'Request not found.' });
        if (request.status !== 'pending')
            return res.status(400).json({ success: false, message: 'Request has already been processed.' });

        const user = await userModel.findOne({ email: request.email });
        if (!user)
            return res.status(400).json({
                success: false,
                message: 'No account found for this email. The requester must create an account first.',
            });

        user.role = 'ADMIN';
        await user.save();

        request.status     = 'approved';
        request.reviewedAt = new Date();
        await request.save();

        return res.json({ success: true, message: `Request approved. ${request.name} can now sign in as Admin.` });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

/* ── MASTER: reject ── */
const rejectRequest = async (req, res) => {
    const { requestId } = req.body;
    try {
        const request = await AdminRequest.findById(requestId);
        if (!request) return res.status(404).json({ success: false, message: 'Request not found.' });
        if (request.status !== 'pending')
            return res.status(400).json({ success: false, message: 'Request has already been processed.' });

        request.status     = 'rejected';
        request.reviewedAt = new Date();
        await request.save();

        return res.json({ success: true, message: 'Request rejected.' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

/* ── MASTER: delete a request record ── */
const deleteRequest = async (req, res) => {
    const { requestId } = req.body;
    try {
        const request = await AdminRequest.findByIdAndDelete(requestId);
        if (!request) return res.status(404).json({ success: false, message: 'Request not found.' });
        return res.json({ success: true, message: 'Request deleted.' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

export { submitRequest, listRequests, approveRequest, rejectRequest, deleteRequest };
