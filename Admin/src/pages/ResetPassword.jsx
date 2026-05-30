import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAuthStore } from "../store/authStore";
import { useNavigate, useParams } from "react-router-dom";
import { Lock, AlertTriangle, CheckCircle } from "lucide-react";
import toast from "react-hot-toast";
import '../styles/resetPassword.css';

const ResetPasswordPage = ({ setShowLogin }) => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [tokenStatus, setTokenStatus] = useState("checking"); // "checking" | "valid" | "expired"
  const [succeeded, setSucceeded] = useState(false);

  const { resetPassword, error, isLoading } = useAuthStore();
  const { token } = useParams();
  const navigate = useNavigate();

  // Check token validity on mount by pinging the backend
  useEffect(() => {
    const checkToken = async () => {
      try {
        const res = await fetch(
          `http://localhost:3000/api/user/verify-reset-token/${token}`
        );
        const data = await res.json();
        setTokenStatus(data.success ? "valid" : "expired");
      } catch {
        setTokenStatus("expired");
      }
    };
    checkToken();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    try {
      await resetPassword(token, password);
      setSucceeded(true);
      toast.success("Password reset successfully!");
      setTimeout(() => {
        navigate("/");
        setShowLogin(true);
      }, 2500);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Error resetting password");
    }
  };

  // ── Checking state ──────────────────────────────────────────
  if (tokenStatus === "checking") {
    return (
      <div className="email-verification-page">
        <div className="email-verification-container" style={{ textAlign: "center" }}>
          <div className="loader-ring" style={{ margin: "0 auto 16px" }} />
          <p className="email-verification-subtitle">Verifying your link…</p>
        </div>
      </div>
    );
  }

  // ── Expired / invalid token ─────────────────────────────────
  if (tokenStatus === "expired") {
    return (
      <div className="email-verification-page">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="email-verification-container"
          style={{ textAlign: "center" }}
        >
          <AlertTriangle size={48} color="#c9a87c" style={{ marginBottom: 16 }} />
          <h2 className="email-verification-title">Link Expired</h2>
          <p className="email-verification-subtitle">
            This password reset link has expired or is invalid.<br />
            Reset links are only valid for <strong>1 hour</strong>.
          </p>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="verify-button"
            style={{ marginTop: 24 }}
            onClick={() => { navigate("/"); setShowLogin(true); }}
          >
            Back to Login
          </motion.button>
        </motion.div>
      </div>
    );
  }

  // ── Success state ───────────────────────────────────────────
  if (succeeded) {
    return (
      <div className="email-verification-page">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="email-verification-container"
          style={{ textAlign: "center" }}
        >
          <CheckCircle size={52} color="#4CAF50" style={{ marginBottom: 16 }} />
          <h2 className="email-verification-title">Password Reset!</h2>
          <p className="email-verification-subtitle">
            Your password has been updated successfully.<br />
            Redirecting you to login…
          </p>
        </motion.div>
      </div>
    );
  }

  // ── Reset form ──────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="email-verification-page"
    >
      <div className="email-verification-container">
        <h2 className="email-verification-title">Reset Password</h2>
        <p className="email-verification-subtitle">Choose a strong new password.</p>

        {error && <p className="error-message">{error}</p>}

        <form className="email-verification-form" onSubmit={handleSubmit}>
          <div className="input-container">
            <div className="icon-container">
              <Lock className="lock-icon" />
            </div>
            <input
              type="password"
              placeholder="New Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="password-input"
            />
          </div>

          <div className="input-container">
            <div className="icon-container">
              <Lock className="lock-icon" />
            </div>
            <input
              type="password"
              placeholder="Confirm New Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="password-input"
            />
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="verify-button"
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? "Resetting…" : "Set New Password"}
          </motion.button>
        </form>
      </div>
    </motion.div>
  );
};

export default ResetPasswordPage;
