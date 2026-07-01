import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { toast, ToastContainer } from "react-toastify";
import "../styles/email_verification.css";

const EmailVerificationPage = ({ setShowLogin, setAuthType, setAutoOpenRequest, setAutoOpenEmail, setAutoOpenName }) => {
    const [code, setCode] = useState(["", "", "", "", "", ""]);
    const inputRefs = useRef([]);
    const isSubmitting = useRef(false);
    const navigate = useNavigate();
    const { error, isLoading, verifyEmail } = useAuthStore();
    const [success, setSuccess] = useState(false);
    const [shake, setShake] = useState(false);
    const [countdown, setCountdown] = useState(3);

    const handleChange = (index, value) => {
        const newCode = [...code];
        if (value.length > 1) {
            const pastedCode = value.slice(0, 6).split("");
            for (let i = 0; i < 6; i++) newCode[i] = pastedCode[i] || "";
            setCode(newCode);
            const lastFilled = newCode.findLastIndex((d) => d !== "");
            inputRefs.current[Math.min(lastFilled + 1, 5)]?.focus();
        } else {
            newCode[index] = value;
            setCode(newCode);
            if (value && index < 5) inputRefs.current[index + 1]?.focus();
        }
    };

    const handleKeyDown = (index, e) => {
        if (e.key === "Backspace" && !code[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handleSubmit = async (e) => {
        e?.preventDefault();
        if (isSubmitting.current) return;
        isSubmitting.current = true;
        const verificationCode = code.join("");
        try {
            await verifyEmail(verificationCode);
            toast.success("Email verified successfully");
            setSuccess(true);
        } catch (err) {
            isSubmitting.current = false;
            setShake(true);
            setCode(["", "", "", "", "", ""]);
            setTimeout(() => {
                setShake(false);
                inputRefs.current[0]?.focus();
            }, 600);
            toast.error(err?.response?.data?.message || err?.message || "Incorrect code, please try again.");
        }
    };

    useEffect(() => {
        if (code.every((d) => d !== "") && !isSubmitting.current) handleSubmit();
    }, [code]);

    // Once verified, count down 3s then open the Request Access modal so the
    // user can request admin approval before they sign in.
    useEffect(() => {
        if (!success) return;
        if (countdown === 0) {
            const email = sessionStorage.getItem('pendingEmail') || '';
            const name  = sessionStorage.getItem('pendingName')  || '';
            sessionStorage.removeItem('pendingEmail');
            sessionStorage.removeItem('pendingName');
            navigate("/");
            if (setAutoOpenEmail) setAutoOpenEmail(email);
            if (setAutoOpenName)  setAutoOpenName(name);
            if (setAutoOpenRequest) setAutoOpenRequest(true);
            return;
        }
        const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
        return () => clearTimeout(timer);
    }, [success, countdown, navigate, setAutoOpenRequest, setAutoOpenEmail, setAutoOpenName]);

    return (
        <div className="ev-page">
            <ToastContainer
                position="top-center"
                autoClose={3000}
                closeOnClick
                pauseOnHover={false}
                style={{ zIndex: 10001 }}
                toastStyle={{
                    background: '#102525',
                    color: '#f0e6d3',
                    border: '1px solid rgba(201,168,124,0.3)',
                    borderRadius: '12px',
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: '0.88rem',
                    fontWeight: 500,
                    boxShadow: '0 8px 32px rgba(10,20,20,0.4)',
                    padding: '14px 18px',
                }}
            />

            <div className="ev-card">
                {success ? (
                    <div className="ev-success">
                        <div className="ev-success-ring">
                            <svg viewBox="0 0 52 52" className="ev-checkmark">
                                <circle className="ev-checkmark-circle" cx="26" cy="26" r="25" fill="none" />
                                <path className="ev-checkmark-path" fill="none" d="M14 26 l8 8 l16-16" />
                            </svg>
                        </div>
                        <h2 className="ev-success-title">Email Verified!</h2>
                        <p className="ev-success-sub">Your account has been created successfully.</p>
                        <div className="ev-redirect-pill">
                            Redirecting to login in {countdown}s
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Top icon */}
                        <div className="ev-icon-wrap">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"/>
                            </svg>
                        </div>

                        {/* Steps */}
                        <div className="ev-steps">
                            <div className="ev-step ev-step--done">
                                <span className="ev-step-dot">✓</span>
                                <span>Create Account</span>
                            </div>
                            <div className="ev-step-line" />
                            <div className="ev-step ev-step--active">
                                <span className="ev-step-dot ev-step-dot--active">2</span>
                                <span>Verify Email</span>
                            </div>
                        </div>

                        <h2 className="ev-title">Check your inbox</h2>
                        <p className="ev-sub">
                            We sent a 6-digit code to your email address.<br />
                            Enter it below to verify your account.
                        </p>

                        <form onSubmit={handleSubmit} className="ev-form">
                            <div className={`ev-inputs${shake ? " ev-inputs--shake" : ""}`}>
                                {code.map((digit, index) => (
                                    <input
                                        key={index}
                                        ref={(el) => (inputRefs.current[index] = el)}
                                        type="text"
                                        inputMode="numeric"
                                        maxLength="6"
                                        value={digit}
                                        onChange={(e) => handleChange(index, e.target.value)}
                                        onKeyDown={(e) => handleKeyDown(index, e)}
                                        className={`ev-input${digit ? " ev-input--filled" : ""}`}
                                        autoFocus={index === 0}
                                    />
                                ))}
                            </div>

                            {error && (
                                <div className="ev-error-box">
                                    <span>⚠</span> {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                className="ev-submit"
                                disabled={isLoading || code.some((d) => !d)}
                            >
                                {isLoading ? (
                                    <><span className="ev-spinner" /> Verifying…</>
                                ) : (
                                    "Verify Email"
                                )}
                            </button>
                        </form>

                        <p className="ev-footer-hint">
                            Didn't receive the code?{" "}
                            <span>Check your spam folder or create a new account.</span>
                        </p>
                    </>
                )}
            </div>
        </div>
    );
};

export default EmailVerificationPage;
