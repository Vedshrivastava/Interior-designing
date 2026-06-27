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

    const handleChange = (index, value) => {
        const newCode = [...code];
        if (value.length > 1) {
            const pastedCode = value.slice(0, 6).split("");
            for (let i = 0; i < 6; i++) newCode[i] = pastedCode[i] || "";
            setCode(newCode);
            const lastFilled = newCode.findLastIndex((d) => d !== "");
            const focusIndex = lastFilled < 5 ? lastFilled + 1 : 5;
            inputRefs.current[focusIndex]?.focus();
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
            setSuccess(true);
            setTimeout(() => {
                navigate("/");
                toast.success("Email verified successfully");
            }, 1800);
        } catch (err) {
            toast.error(err?.response?.data?.message || err?.message || "Invalid code. Please try again.");
        }
    };

    useEffect(() => {
        if (code.every((d) => d !== "")) handleSubmit();
    }, [code]);

    return (
        <div className="ev-page">
            <div className="ev-card">

                {success ? (
                    <div className="ev-success">
                        <div className="ev-success-icon">✓</div>
                        <h2 className="ev-success-title">Verified!</h2>
                        <p className="ev-success-sub">Taking you to your dashboard…</p>
                    </div>
                ) : (
                    <>
                        {/* Header */}
                        <div className="ev-header">
                            <span className="ev-badge">Email Verification</span>
                            <h2 className="ev-title">Verify Your Email</h2>
                            <p className="ev-sub">Enter the 6-digit code sent to your email address.</p>
                        </div>

                        {/* Notice */}
                        <div className="ev-notice">
                            <span className="ev-notice-icon">ℹ</span>
                            <p>Check your inbox — the code expires in <strong>15 minutes</strong>.</p>
                        </div>

                        {/* OTP inputs */}
                        <form onSubmit={handleSubmit} className="ev-form">
                            <div className="ev-inputs">
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

                            {error && <p className="ev-error">{error}</p>}

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
                    </>
                )}
            </div>
        </div>
    );
};

export default EmailVerificationPage;
