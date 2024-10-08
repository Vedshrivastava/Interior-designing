import mongoose from "mongoose";

const appointmentSchema = new mongoose.Schema({
    name: { type: String, required: true }, // Name is required
    email: { type: String, required: true }, // Email is required
    phoneNumber: { type: String, required: true }, // Phone number is required
    message: { type: String }, // Message is optional
    address: { type: String, required: true }, // Address is required
    status: { type: String, default: "pending" }, // Status defaults to "pending"
    date: { type: Date, default: Date.now }, // Date defaults to now
    image: { type: String }, // Image is optional
    designName: { type: String } // Design name is optional
});

const appointmentModel = mongoose.models.appointments || mongoose.model("appointment", appointmentSchema);
export default appointmentModel;
