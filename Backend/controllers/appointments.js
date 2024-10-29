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
        // Fetch all appointments where the image field is empty or null
        const appointments = await appointmentModel.find({
            $or: [
                { image: { $exists: false } },  // Image field doesn't exist
                { image: '' }                   // Image field is an empty string
            ]
        }).sort({date: -1});

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
        const { name, phoneNumber, message, address, email, consultData } = req.body;

        // Validation: Check if required fields are provided
        if (!name || !phoneNumber || !address || !email) {
            return res.status(400).json({ message: 'Name, phone number, and address are required.' });
        }

        // Create new appointment object
        const newAppointment = new appointmentModel({
            name,
            phoneNumber,
            message: message || "", // Optional message, defaults to empty string if not provided
            address: address || "",
            email,
            designName: consultData.name,
            image: consultData.img
        });

        // Save appointment to the database
        await newAppointment.save();

        broadcast({ type: 'newQuote', data: newAppointment });

        // Send success response
        res.status(201).json({
            message: 'Appointment created successfully!',
            appointment: newAppointment,
        });
    } catch (error) {
        // Handle any errors
        console.error(error);
        res.status(500).json({ message: 'Server error. Please try again later.' });
    }
};

const listQuotes = async (req, res) => {
    try {
        // Fetch all appointments from the database where productImage is not empty, null, or undefined
        const appointments = await appointmentModel.find({
            image: { $nin: [null, "", undefined] } // Exclude null, empty string, and undefined
        }).sort({date: -1});

        console.log(appointments);

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