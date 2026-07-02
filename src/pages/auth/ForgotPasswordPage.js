import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Logo from "../../assets/Images/haatzaSellerlogo.png";
import LoginVideo from "../../assets/videos/SignUpIn.mp4";
import { forgotPassword } from "../../services/sellerService";
import "../../components/auth/SignInForm/SignInForm.css";

function ForgotPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = true;
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    const tryPlay = () => {
      video.play().catch((err) => console.warn("Autoplay blocked:", err));
    };
    tryPlay();
    document.addEventListener("touchstart", tryPlay, { once: true });
    document.addEventListener("click", tryPlay, { once: true });
    return () => {
      document.removeEventListener("touchstart", tryPlay);
      document.removeEventListener("click", tryPlay);
    };
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleResetPassword();
    }
  };

  const handleResetPassword = async () => {
    const trimmed = email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      setError("Please enter a valid email address.");
      setSuccess("");
      return;
    }

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      await forgotPassword(trimmed);
      setSuccess("Password is sent to your mail, check it.");
    } catch (err) {
      console.error("Forgot Password Error:", err);
      const errorMsg = err.response?.data?.message || err.message || "Failed to send password reset request.";
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signin-page" style={{ overflow: "hidden" }}>
      {/* Left: Video Panel */}
      <div className="illustration-panel">
        <video
          ref={videoRef}
          className="side-image"
          src={LoginVideo}
          loop
          playsInline
          preload="auto"
          muted
        >
          <source src={LoginVideo} type="video/mp4" />
        </video>
      </div>

      {/* Right: Form Panel */}
      <div className="form-panel">
        <div className="form-inner">
          <div className="logo-wrapper">
            <img src={Logo} alt="Haatza Seller Logo" className="logo-image" />
          </div>

          <h1 style={{ marginBottom: "8px" }}>Forgot Password</h1>
          <p className="subtitle" style={{ textAlign: "left", marginBottom: "20px" }}>
            Enter your email ID to reset your password.
          </p>

          <div className="input-group">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              type="text"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value.replace(/[^a-zA-Z0-9@._\-+]/g, ""));
                setError("");
                setSuccess("");
              }}
              onKeyDown={handleKeyDown}
              placeholder="Email"
              disabled={loading}
            />
          </div>

          {error && <p className="error-text" style={{ marginTop: "8px" }}>{error}</p>}
          {success && <p className="success-message" style={{
            color: "#2e7d32",
            background: "#f1f8f1",
            border: "1px solid #c8e6c9",
            borderRadius: "8px",
            padding: "10px 14px",
            fontSize: "13.5px",
            marginTop: "8px",
            marginBottom: "8px",
            textAlign: "center"
          }}>{success}</p>}

          <button
            className="signin-btn"
            style={{ marginTop: "16px" }}
            onClick={handleResetPassword}
            disabled={loading}
          >
            {loading ? "Sending..." : "Reset Password"}
          </button>

          <div className="form-footer" style={{ marginTop: "24px", textAlign: "center" }}>
            <span
              style={{ color: "#2962ff", cursor: "pointer", fontWeight: "600" }}
              onClick={() => navigate("/signin", { state: location.state })}
            >
              Back to Login
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ForgotPasswordPage;
