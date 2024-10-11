import React, { useState, useContext, useEffect } from 'react';
import '../styles/Login.css';
import { assets_frontend } from '../assets/frontend_assets/assets';
import { StoreContext } from '../context/StoreContext';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore.js';
import { jwtDecode } from 'jwt-decode'; // Import jwt-decode

const Login = ({ setShowLogin }) => {
    const { signup, isLoading, login, forgotPassword } = useAuthStore();
    const { setToken, setUserId, setUserName, setUserEmail, setIsLoggedIn } = useContext(StoreContext);

    const [currState, setCurrState] = useState("Login");
    const [data, setData] = useState({
        name: "",
        email: "",
        password: ""
    });
    const [forgotEmail, setForgotEmail] = useState("");
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [resetMessage, setResetMessage] = useState(""); 

    const navigate = useNavigate();

    const onChangeHandler = (event) => {
        const name = event.target.name;
        const value = event.target.value;
        setData(data => ({ ...data, [name]: value }));
    };

    const onForgotEmailChange = (event) => {
        setForgotEmail(event.target.value);
    };

    const onLogin = async (event) => {
        event.preventDefault();

        if (currState === "Sign Up") {
            try {
                await signup(data.email, data.password, data.name);
                toast.success("Account created! Please verify your email.");
                setShowLogin(false);
                navigate('/verify-email');
            } catch (error) {
                toast.error(error.message || "Error during sign-up");
            }
        } else if (currState === "Forgot Password") {
            try {
                const response = await forgotPassword(forgotEmail);
                if (response.data.success) {
                    toast.success("Password reset link sent to your email.");
                    setIsSubmitted(true);
                    setResetMessage("A password reset link has been sent to your email.");
                } else {
                    toast.error(response.data.message || "Failed to send password reset link");
                }
            } catch (error) {
                toast.error("Error sending password reset link");
                console.log(error);
            }
        } else {
            try {
                const response = await login(data.email, data.password);
                if (response.data.success) {
                    // Check if the user is an admin
                    if (response.data.role !== "ADMIN") {
                        toast.error("You do not have permission to log in.");
                        return; 
                    }

                    // Proceed with the login process if the user is an admin
                    const token = response.data.token;
                    setToken(token);
                    localStorage.setItem("token", token);

                    // Decode the token to get user info
                    const decodedToken = jwtDecode(token); 
                    console.log("Decoded Token:", decodedToken);

                    localStorage.setItem("userId", decodedToken.id);
                    localStorage.setItem("userName", decodedToken.name);
                    localStorage.setItem("userEmail", decodedToken.email);

                    // Set user information in context
                    setUserId(decodedToken.id);
                    setUserName(decodedToken.name);
                    setUserEmail(decodedToken.email);
                    setIsLoggedIn(true);

                    toast.success("Logged in successfully!");
                    setShowLogin(false);
                    navigate('/');

                    // Set logout timer
                    const expirationTime = decodedToken.exp * 1000;
                    const logoutTime = expirationTime - Date.now();

                    if (logoutTime > 0) {
                        setTimeout(() => {
                            handleLogout();
                        }, logoutTime);
                    }
                } else {
                    toast.error(response.data.message || "Login failed");
                }
            } catch (error) {
                console.log(error);
                toast.error('Something went wrong during login');
            }
        }
    };

    const handleLogout = () => {
        setToken(null);
        localStorage.removeItem("token");
        localStorage.removeItem("userId");
        localStorage.removeItem("userName");
        localStorage.removeItem("userEmail");
        setIsLoggedIn(false);
        toast.info("You have been logged out due to inactivity.");
        navigate('/login'); // Redirect to login or any other page
    };

    return (
        <div className='login'>
            <form onSubmit={onLogin} className='login-container'>
                <div className="login-title">
                    <h2>{currState}</h2>
                    <img onClick={() => setShowLogin(false)} src={assets_frontend.cross_icon} alt="Close" />
                </div>
                <div className="login-inputs">
                    {currState === 'Sign Up' ? (
                        <>
                            <input
                                name='name'
                                onChange={onChangeHandler}
                                value={data.name}
                                type='text'
                                placeholder='Your name'
                                required
                            />
                            <input
                                name='email'
                                onChange={onChangeHandler}
                                value={data.email}
                                type='email'
                                placeholder='Your Email'
                                required
                            />
                            <input
                                name='password'
                                onChange={onChangeHandler}
                                value={data.password}
                                type='password'
                                placeholder='Enter your password'
                                required
                            />
                        </>
                    ) : currState === 'Forgot Password' ? (
                        <input
                            name='forgotEmail'
                            onChange={onForgotEmailChange}
                            value={forgotEmail}
                            type='email'
                            placeholder='Enter your Email for reset'
                            required
                        />
                    ) : (
                        <>
                            <input
                                name='email'
                                onChange={onChangeHandler}
                                value={data.email}
                                type='email'
                                placeholder='Your Email'
                                required
                            />
                            <input
                                name='password'
                                onChange={onChangeHandler}
                                value={data.password}
                                type='password'
                                placeholder='Enter your password'
                                required
                            />
                        </>
                    )}
                </div>
                <button type='submit' disabled={isLoading}>
                    {currState === 'Sign Up' ? (isLoading ? "Creating Account..." : "Create Account") :
                        currState === 'Forgot Password' ? "Send Reset Link" : "Login"}
                </button>
                {currState === 'Login' && (
                    <>
                        <p>Forgot your password? <span onClick={() => setCurrState("Forgot Password")}>Reset</span></p>
                        <p>Don't have an account? <span onClick={() => setCurrState("Sign Up")}>Sign Up</span></p>
                    </>
                )}
                {currState === 'Forgot Password' && (
                    <p>Remembered your password? <span onClick={() => setCurrState("Login")}>Login</span></p>
                )}
                {currState === 'Sign Up' && (
                    <p>Already have an account? <span onClick={() => setCurrState("Login")}>Login</span></p>
                )}
                {isSubmitted && resetMessage && (
                    <div className='submitted-message'>
                        <p>{resetMessage}</p>
                    </div>
                )}
            </form>
            <ToastContainer />
        </div>
    );
};

export default Login;
