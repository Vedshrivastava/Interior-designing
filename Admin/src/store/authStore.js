import { create } from "zustand";
import axios from "axios";

export const useAuthStore = create((set) => ({
    isAuthenticated: localStorage.getItem('isAuthenticated') === 'true' || false,
    error: null,
    isLoading: false,
    isCheckingAuth: true,

    signup: async (email, password, name) => {
        set({ isLoading: true, error: null });
        console.log("isLoading (signup start):", true); 
        try {
            const response = await axios.post(`http://localhost:3000/api/admin/register-admin`, { email, password, name });
            
            if (response.data && response.data.success === false) {
                set({ error: response.data.message, isLoading: false });
                console.log("isLoading (signup error):", false);
                throw new Error(response.data.message); 
            }

            const { user } = response.data;
            localStorage.setItem('user', JSON.stringify(user));
            localStorage.setItem('isAuthenticated', 'true');
            
            set({ user, isAuthenticated: true, isLoading: false });
            console.log("Signup response :--->> ", response.data);
            console.log("isLoading (signup end):", false); 

            return response;
        } catch (error) {
            console.log("Full error object:", error);
            const errorMessage = error.response?.data?.message || error.message || "Error signing up";
            set({ error: errorMessage, isLoading: false });
            throw error; 
        }
    },

    login: async (email, password) => {
        set({ isLoading: true, error: null });
        console.log("isLoading (login start):", true); 
        try {
            const response = await axios.post(`http://localhost:3000/api/admin/login-admin`, { email, password });
            const { user } = response.data;

            localStorage.setItem('user', JSON.stringify(user));
            localStorage.setItem('isAuthenticated', 'true');

            set({ user, isAuthenticated: true, isLoading: false });
            console.log("Login response :--->> ", response.data);
            console.log("isLoading (login end):", false); 

            return response;
        } catch (error) {
            set({ error: error.response?.data?.message || "Error logging in", isLoading: false });
            console.log("isLoading (login error):", false); 
            throw error;
        }
    },

    verifyEmail: async (code) => {
        set({ isLoading: true, error: null });
        console.log("isLoading (verifyEmail start):", true); 
        try {
            const response = await axios.post(`http://localhost:3000/api/user/verify-email`, { code });
            const { user } = response.data;

            localStorage.setItem('user', JSON.stringify(user));
            localStorage.setItem('isAuthenticated', 'true');
            
            set({ user, isAuthenticated: true, isLoading: false });
            console.log("Email verification response :--->> ", response.data);
            console.log("isLoading (verifyEmail end):", false); 

            return response;
        } catch (error) {
            set({ error: error.response?.data?.message || "Error verifying email", isLoading: false });
            console.log("isLoading (verifyEmail error):", false); 
            throw error;
        }
    },

    // 💡 FIXED: Pass the token cleanly into the function argument
    checkAuth: async (token) => {
        set({ isCheckingAuth: true, error: null });
        console.log("isCheckingAuth (start):", true); 
        try {
            const response = await axios.get(`http://localhost:3000/api/user/check-auth`, { 
                headers: { Authorization: `Bearer ${token}` } 
            });
            const { user } = response.data;

            localStorage.setItem('user', JSON.stringify(user));
            localStorage.setItem('isAuthenticated', 'true');
            
            set({ user, isAuthenticated: true, isCheckingAuth: false });
            console.log("CheckAuth response :--->> ", response.data);
            console.log("isCheckingAuth (end):", false); 

            return response;
        } catch (error) {
            const errorMessage = error.response?.data?.message || "An unexpected error occurred";
            console.log("Error from auth :===>>>", error);
            set({ error: errorMessage, isCheckingAuth: false, isAuthenticated: false });
            console.log("isCheckingAuth (error):", false); 
            return error;
        }
    },

    forgotPassword: async (email) => {
        set({ isLoading: true, error: null });
        try {
            const response = await axios.post(`http://localhost:3000/api/user/forgot-password`, { email });
            set({ message: response.data.message, isLoading: false });
            return response;
        } catch (error) {
            const message = error.response?.data?.message  
                || (error.request ? "Cannot reach server — is the backend running?" : "Error sending reset password email");
            set({ isLoading: false, error: message });
            throw error;
        }
    },

    resetPassword: async (token, password) => {
        set({ isLoading: true, error: null });
        console.log("isLoading (resetPassword start):", true); 
        try {
            const response = await axios.post(`http://localhost:3000/api/user/reset-password/${token}`, { password });
            set({ message: response.data.message });
            console.log("isLoading (resetPassword end):", false); 
            return response;
        } catch (error) {
            set({ error: error.response?.data?.message || "Error resetting password" });
            console.log("isLoading (resetPassword error):", false); 
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