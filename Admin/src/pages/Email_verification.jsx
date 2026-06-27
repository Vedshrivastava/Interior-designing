import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { toast } from "react-toastify";
import "../styles/email_verification.css";

const EmailVerificationPage = () => {
    const [code, setCode] = useState(["", "", "", "", "", ""]);
    const inputRefs = useRef([]);
    const navigate = useNavigate();
    const { error, isLoading, verifyEmail } = useAuthStore();
    const [success, setSuccess] = useState(false);
    const [shake, setShake] = useState(false);

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
        const verificationCode = code.join("");
        try {
            await verifyEmail(verificationCode);
            toast.success("Email verified successfully");
            setSuccess(true);
            setTimeout(() => navigate("/"), 2000);
        } catch (err) {
            setShake(true);
            setTimeout(() => setShake(false), 600);
            toast.error(err?.response?.data?.message || "Invalid code. Please try again.");
        }
    };

    useEffect(() => {
        if (code.every((d) => d !== "")) handleSubmit();
    }, [code]);

    return (
        <div className="ev-page">

            {/* Background decoration */}
            <div className="ev-bg-orb ev-bg-orb--1" />
            <div className="ev-bg-orb ev-bg-orb--2" />

            <div className="ev-card">
                {success ? (
                    <div className="ev-success">
                        <div className="ev-success-ring">
                            <svg viewBox="0 0 52 52" className="ev-checkmark">
                                <circle className="ev-checkmark-circle" cx="26" cy="26" r="25" fill="none" />
                                <path className="ev-checkmark-path" fill="none" d="M14 26 l8 8 l16-16" />
                            </svg>
                        </div>
                        <h2 className="ev-success-title">Verified!</h2>
                        <p className="ev-success-sub">Redirecting to your dashboard…</p>
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
