import React, { useRef, useEffect } from "react";
import "./OtpScreen.css";
import Logo from "../../../assets/Images/haatzaSellerlogo.png";
import LoginVideo from "../../../assets/videos/SignUpIn.mp4";

const OTP_LENGTH = 6;

/**
 * OtpScreen — pure UI component
 *
 * Props:
 *   phone          {string}   the phone number OTP was sent to
 *   otp            {string[]} array of OTP_LENGTH digit strings (controlled)
 *   onOtpChange    {fn}       called with (newOtpArray) when digits change
 *   timeLeft       {number}   seconds remaining on resend countdown
 *   timerActive    {bool}     true while countdown is running
 *   loading        {bool}     verify button loading state
 *   resendLoading  {bool}     resend button loading state
 *   error          {string}   error message (empty = none)
 *   successMsg     {string}   success message (empty = none)
 *   onVerify       {fn}       called when "Verify OTP" is clicked
 *   onResend       {fn}       called when "Resend OTP" is clicked
 *   onChangeNumber {fn}       called when "Change Number" is clicked
 */
function OtpScreen({
  phone,
  otp,
  onOtpChange,
  timeLeft,
  timerActive,
  loading,
  resendLoading,
  error,
  successMsg,
  onVerify,
  onResend,
  onChangeNumber,
}) {
  const inputRefs = useRef([]);
  const videoRef = useRef(null);

  // ─── Video Autoplay ──────────────────────────────────────────────────────
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

  // ─── OTP Input: Change ───────────────────────────────────────────────────
  const handleChange = (index, e) => {
    const value = e.target.value;
    if (!/^\d*$/.test(value)) return;
    const digit = value.slice(-1);

    const newOtp = [...otp];
    newOtp[index] = digit;
    onOtpChange(newOtp);

    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1].focus();
    }
  };

  // ─── OTP Input: Backspace ────────────────────────────────────────────────
  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace") {
      if (otp[index]) {
        const newOtp = [...otp];
        newOtp[index] = "";
        onOtpChange(newOtp);
      } else if (index > 0) {
        inputRefs.current[index - 1].focus();
      }
    } else if (e.key === "Enter") {
      onVerify();
    }
  };

  // ─── OTP Input: Paste ────────────────────────────────────────────────────
  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!pasted) return;
    const newOtp = Array(OTP_LENGTH).fill("");
    for (let i = 0; i < pasted.length; i++) {
      newOtp[i] = pasted[i];
    }
    onOtpChange(newOtp);
    inputRefs.current[Math.min(pasted.length, OTP_LENGTH - 1)].focus();
  };

  // ─── Timer Display ───────────────────────────────────────────────────────
  const seconds = timeLeft % 60;
  const timerDisplay = (seconds < 10 ? "0" + seconds : seconds) + "s";

  // ─── Render ──────────────────────────────────────────────────────────────
  return React.createElement(
    "div",
    { className: "otp-page" },

    // ── Left Video Panel ───────────────────────────────────────────────────
    React.createElement(
      "div",
      { className: "otp-illustration-panel" },
      React.createElement(
        "video",
        {
          ref: videoRef,
          className: "otp-side-video",
          src: LoginVideo,
          loop: true,
          playsInline: true,
          preload: "auto",
          muted: true,
        },
        React.createElement("source", { src: LoginVideo, type: "video/mp4" })
      )
    ),

    // ── Right Form Panel ───────────────────────────────────────────────────
    React.createElement(
      "div",
      { className: "otp-form-panel" },
      React.createElement(
        "div",
        { className: "otp-form-inner" },

        // Logo
        React.createElement("img", {
          src: Logo,
          alt: "Haatza Logo",
          className: "otp-logo",
        }),

        // Heading
        React.createElement("h2", { className: "otp-title" }, "Welcome Back to Login"),

        // Subtitle
        React.createElement(
          "p",
          { className: "otp-subtitle" },
          "OTP sent to ",
          React.createElement("span", null, phone),
          ". Please enter it below."
        ),

        // OTP Input Section
        React.createElement(
          "div",
          { className: "otp-input-section" },
          React.createElement("label", { className: "otp-label" }, "Enter Your OTP"),
          React.createElement(
            "div",
            { className: "otp-boxes" },
            otp.map((digit, index) =>
              React.createElement("input", {
                key: index,
                ref: (el) => { inputRefs.current[index] = el; },
                className: "otp-box" + (digit ? " filled" : ""),
                type: "text",
                inputMode: "numeric",
                maxLength: 1,
                value: digit,
                // Only the in-flight verify request should lock the boxes.
                // The 60s value here only ever drove the Resend cooldown —
                // OTPs stay valid in the DB for 5 minutes, so the digit
                // boxes must never be disabled just because the on-screen
                // countdown hit 0. Users can keep typing, or hit Resend.
                disabled: loading,
                onChange: (e) => handleChange(index, e),
                onKeyDown: (e) => handleKeyDown(index, e),
                onPaste: handlePaste,
              })
            )
          )
        ),

        // Actions Row (contains Change Number on left, and Timer/Resend button on right)
        React.createElement(
          "div",
          { className: "otp-actions" },
          React.createElement(
            "button",
            { className: "otp-change-number", onClick: onChangeNumber },
            "Change Number"
          ),
          timeLeft > 0
            ? React.createElement(
                "span",
                { className: "otp-timer" },
                "Resend OTP in " + timerDisplay
              )
            : React.createElement(
                "button",
                {
                  className: "otp-resend",
                  onClick: onResend,
                  disabled: resendLoading,
                },
                resendLoading ? "Resending..." : "Resend OTP"
              )
        ),

        // Error Message
        error
          ? React.createElement("p", { className: "otp-error" }, error)
          : null,

        // Success Message
        successMsg
          ? React.createElement("p", { className: "otp-success" }, successMsg)
          : null,

        // Verify Button
        React.createElement(
          "button",
          {
            className: "otp-verify-btn",
            onClick: onVerify,
            disabled: loading || otp.join("").length < OTP_LENGTH,
          },
          loading ? "Verifying..." : "Verify OTP"
        )
      )
    )
  );
}

export default OtpScreen;