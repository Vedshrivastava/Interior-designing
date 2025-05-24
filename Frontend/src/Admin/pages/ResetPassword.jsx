import { useState } from "react";
import { motion } from "framer-motion";
import { useAuthStore } from "../store/authStore";
import { useNavigate, useParams } from "react-router-dom";
import { Lock } from "lucide-react";
import toast from "react-hot-toast";
import '../styles/resetPassword.css';

const ResetPasswordPage = ({setShowLogin}) => {
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const { resetPassword, error, isLoading, message } = useAuthStore();
	const { token } = useParams();
	const navigate = useNavigate();

	const handleSubmit = async (e) => {
		e.preventDefault();

		if (password !== confirmPassword) {
			alert("Passwords do not match");
			return;
		}
		try {
			await resetPassword(token, password);
			toast.success("Password reset successfully, redirecting to login page...");
			setTimeout(() => {
				navigate("/");
				setShowLogin(true);
			}, 2000);
		} catch (error) {
			console.error(error);
			toast.error(error.message || "Error resetting password");
		}
	};

	return (
		<motion.div
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.5 }}
			className='email-verification-page'
		>
			<div className='email-verification-container'>
				<h2 className='email-verification-title'>Reset Password</h2>
				{error && <p className='error-message'>{error}</p>}
				{message && <p className='email-verification-subtitle'>{message}</p>}

				<form className='email-verification-form' onSubmit={handleSubmit}>
					<div className='input-container'>
						<div className='icon-container'>
							<Lock className='lock-icon' />
						</div>
						<input
							type='password'
							placeholder='New Password'
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							required
							className='password-input'
						/>
					</div>

					<div className='input-container'>
						<div className='icon-container'>
							<Lock className='lock-icon' />
						</div>
						<input
							type='password'
							placeholder='Confirm New Password'
							value={confirmPassword}
							onChange={(e) => setConfirmPassword(e.target.value)}
							required
							className='password-input'
						/>
					</div>

					<motion.button
						whileHover={{ scale: 1.02 }}
						whileTap={{ scale: 0.98 }}
						className='verify-button'
						type='submit'
						disabled={isLoading}
					>
						{isLoading ? "Resetting..." : "Set New Password"}
					</motion.button>
				</form>
			</div>
		</motion.div>
	);
};

export default ResetPasswordPage;
