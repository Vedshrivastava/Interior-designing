import appointmentModel from "../models/appointments.js";
import cloudinary from 'cloudinary';
import { broadcast } from '../middlewares/webSocket.js';
import fs from 'fs';

cloudinary.v2.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.CLOUD_API_KEY,
    api_secret: process.env.CLOUD_API_SECRET
});

// Controller for adding a new appointment
const addAppointment = async (req, res) => {
    try {
        const { name, phoneNumber, message, address, email } = req.body;

        if (!name || !phoneNumber || !address || !email) {
            return res.status(400).json({ message: 'Name, phone number, and address are required.' });
        }

        const newAppointment = new appointmentModel({
            name,
            phoneNumber,
            message: message || "",
            address: address || "",
            email
        });

        await newAppointment.save();

        // Broadcast new appointment data
        broadcast({ type: 'newOrder', data: newAppointment });

        res.status(201).json({
            message: 'Appointment created successfully!',
            appointment: newAppointment,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error. Please try again later.' });
    }
};


const listAppointments = async (req, res) => {
    try {
        // Fetch appointments that are NOT quotes:
        // quotes have a non-empty images array and/or a non-empty image string.
        // Plain appointments have neither.
        const appointments = await appointmentModel.find({
            $and: [
                { $or: [{ image: { $exists: false } }, { image: '' }, { image: null }] },
                { $or: [{ images: { $exists: false } }, { images: { $size: 0 } }] }
            ]
        }).sort({ date: -1 });

        // Send success response with the list of appointments
        res.status(200).json({
            success: true,
            message: 'Appointments fetched successfully!',
            appointments,
        });
    } catch (error) {
        // Handle any errors
        console.error(error);
        res.status(500).json({ message: 'Server error. Please try again later.' });
    }
};


const updateStatus = async(req, res) => {
    const { orderId, status } = req.body;

  try {
    // Update the status directly in the database
    const updatedOrder = await appointmentModel.findByIdAndUpdate(
      orderId,
      { status }, // Assuming you have a 'status' field in your appointment schema
      { new: true } // Return the updated document
    );

    if (!updatedOrder) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    return res.json({ success: true, order: updatedOrder });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

const addQuote = async (req, res) => {
    try {
        // 1. Grab 'measurements' from req.body alongside standard details
        const { name, phoneNumber, message, address, email, consultData, measurements } = req.body;

        if (!name || !phoneNumber || !address || !email) {
            return res.status(400).json({ message: 'Name, phone number, and address are required.' });
        }

        // 2. Map fields to the schema model
        // Derive a reliable thumbnail: prefer explicit img, fall back to first image in array
        const thumbImg = consultData.img
            || (Array.isArray(consultData.images) && consultData.images.length > 0
                ? consultData.images[0]
                : undefined);

        const imagesArr = Array.isArray(consultData.images) && consultData.images.length > 0
            ? consultData.images
            : (thumbImg ? [thumbImg] : []);

        const newAppointment = new appointmentModel({
            name,
            phoneNumber,
            message: message || "",
            address: address || "",
            email,
            designName: consultData.name,
            image: thumbImg,   // always a real string, never undefined
            images: imagesArr, // always a populated array
            category: consultData.category,
            measurements: measurements || ""
        });

        await newAppointment.save();

        broadcast({ type: 'newQuote', data: newAppointment });

        res.status(201).json({
            message: 'Appointment created successfully!',
            appointment: newAppointment,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error. Please try again later.' });
    }
};

const listQuotes = async (req, res) => {
    try {
        // Fetch all quotes — documents that have either a non-empty images array
        // OR a non-empty legacy image string (covers old + new submissions)
        const appointments = await appointmentModel.find({
            $or: [
                { images: { $exists: true, $not: { $size: 0 } } }, // new: has at least one image in array
                { image: { $nin: [null, "", undefined] } }          // legacy: had a single image string
            ]
        }).sort({ date: -1 });

        // Send success response with the list of appointments
        res.status(200).json({
            success: true,
            message: 'Appointments fetched successfully!',
            appointments,
        });
    } catch (error) {
        // Handle any errors
        console.error(error);
        res.status(500).json({ message: 'Server error. Please try again later.' });
    }
};


export {addAppointment, listAppointments, updateStatus, addQuote, listQuotes}