import { create } from "zustand";
import axios from "axios";
import { useContext } from "react";
import { StoreContext } from "../context/StoreContext";

export const useAuthStore = create((set) => ({
    isAuthenticated: localStorage.getItem('isAuthenticated') === 'true' || false,
    error: null,
    isLoading: false,
    isCheckingAuth: true,

    signup: async (email, password, name) => {
        set({
            isLoading: true,
            error: null
        });
        console.log("isLoading (signup start):", true); // Log when isLoading is true
        try {
            const response = await axios.post(`http://localhost:3000/api/admin/register-admin`, { email, password, name });
            const { user } = response.data;
            
            localStorage.setItem('user', JSON.stringify(user));
            localStorage.setItem('isAuthenticated', 'true');
            
            set({ user, isAuthenticated: true, isLoading: false });
            console.log("Signup response :--->> ", response.data);
            console.log("isLoading (signup end):", false); // Log when isLoading is false

            return response;
        } catch (error) {
            set({ error: error.response.data.message || "Error signing up", isLoading: false });
            console.log("isLoading (signup error):", false); // Log when isLoading becomes false due to an error
            throw error;
        }
    },

    login: async (email, password) => {
        set({ isLoading: true, error: null });
        console.log("isLoading (login start):", true); // Log when isLoading is true
        try {
            const response = await axios.post(`http://localhost:3000/api/admin/login-admin`, { email, password });
            const { user } = response.data;

            localStorage.setItem('user', JSON.stringify(user));
            localStorage.setItem('isAuthenticated', 'true');

            set({ user, isAuthenticated: true, isLoading: false });
            console.log("Login response :--->> ", response.data);
            console.log("isLoading (login end):", false); // Log when isLoading is false

            return response;
        } catch (error) {
            set({ error: error.response.data.message || "Error logging in", isLoading: false });
            console.log("isLoading (login error):", false); // Log when isLoading becomes false due to an error
            throw error;
        }
    },

    verifyEmail: async (code) => {
        set({ isLoading: true, error: null });
        console.log("isLoading (verifyEmail start):", true); // Log when isLoading is true
        try {
            const response = await axios.post(`http://localhost:3000/api/user/verify-email`, { code });
            const { user } = response.data;

            localStorage.setItem('user', JSON.stringify(user));
            localStorage.setItem('isAuthenticated', 'true');
            
            set({ user, isAuthenticated: true, isLoading: false });
            console.log("Email verification response :--->> ", response.data);
            console.log("isLoading (verifyEmail end):", false); // Log when isLoading is false

            return response;
        } catch (error) {
            set({ error: error.response.data.message || "Error verifying email", isLoading: false });
            console.log("isLoading (verifyEmail error):", false); // Log when isLoading becomes false due to an error
            throw error;
        }
    },

    checkAuth: async () => {
        set({ isCheckingAuth: true, error: null });
        console.log("isCheckingAuth (start):", true); // Log when checking authentication starts
        try {
            const { token } = useContext(StoreContext);
            const response = await axios.get(`http://localhost:3000/api/user/check-auth`, { 
                headers: { Authorization: `Bearer ${token}` } 
            });
            const { user } = response.data;

            localStorage.setItem('user', JSON.stringify(user));
            localStorage.setItem('isAuthenticated', 'true');
            
            set({ user, isAuthenticated: true, isCheckingAuth: false });
            console.log("CheckAuth response :--->> ", response.data);
            console.log("isCheckingAuth (end):", false); // Log when authentication checking ends

            return response;
        } catch (error) {
            const errorMessage = error.response?.data?.message || "An unexpected error occurred";
            console.log("Error from auth :===>>>", error);
            set({ error: errorMessage, isCheckingAuth: false, isAuthenticated: false });
            console.log("isCheckingAuth (error):", false); // Log when checking authentication encounters an error
            return error;
        }
    },

    forgotPassword: async (email) => {
        set({ isLoading: true, error: null });
        console.log("isLoading (forgotPassword start):", true); // Log when isLoading is true
        try {
            const response = await axios.post(`http://localhost:3000/api/user/forgot-password`, { email });
            set({ message: response.data.message, isLoading: false });
            console.log("isLoading (forgotPassword end):", false); // Log when isLoading is false
            return response;
        } catch (error) {
            set({ isLoading: false, error: error.response.data.message || "Error sending reset password email" });
            console.log("isLoading (forgotPassword error):", false); // Log when isLoading becomes false due to an error
            throw error;
        }
    },

    resetPassword: async (token, password) => {
        set({ isLoading: true, error: null });
        console.log("isLoading (resetPassword start):", true); // Log when isLoading is true
        try {
            const response = await axios.post(`http://localhost:3000/api/user/reset-password/${token}`, { password });
            set({ message: response.data.message });
            console.log("isLoading (resetPassword end):", false); // Log when isLoading is false
            return response;
        } catch (error) {
            set({ error: error.response.data.message || "Error resetting password" });
            console.log("isLoading (resetPassword error):", false); // Log when isLoading becomes false due to an error
            throw error;
        } finally {
            set({ isLoading: false });
        }
    },

    logout: () => {
        localStorage.removeItem('user');
        localStorage.removeItem('isAuthenticated');
        set({ user: null, isAuthenticated: false });
        console.log("User logged out");
    }
}));
