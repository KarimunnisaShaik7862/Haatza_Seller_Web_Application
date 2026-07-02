import React, { useRef, useEffect } from "react";
import "./SignInForm.css";
import Logo from "../../../assets/Images/haatzaSellerlogo.png";
import LoginVideo from "../../../assets/videos/SignUpIn.mp4";
import { Link } from "react-router-dom";

/**
 * SignInForm — pure UI component
 *
 * Props:
 *   contact          {string}   controlled value for the contact field
 *   onContactChange  {fn}       called with new string value when contact input changes
 *   password         {string}   controlled value for the password field
 *   onPasswordChange {fn}       called with new string value when password input changes
 *   showPassword     {bool}     whether to render the password input
 *   loading          {bool}     disables inputs & changes button label
 *   error            {string}   inline error message (empty string = no error)
 *   onContinue       {fn}       called when "Continue" button is clicked / Enter pressed
 *   onSignIn         {fn}       called when "Sign In" button is clicked / Enter pressed
 *   onRegister       {fn}       called when "Register for New Account" link is clicked
 */
function SignInForm({
  contact,
  onContactChange,
  password,
  onPasswordChange,
  showPassword,
  loading,
  error,
  onContinue,
  onSignIn,
  onRegister,
  onForgotPasswordToggle,
  showForgotPasswordConfirm,
  onForgotPasswordConfirm,
  forgotPasswordLoading,
  forgotPasswordError,
  onChangeEmail,
}) {
  const videoRef = useRef(null);
  const passwordRef = useRef(null);

  // ─── Video Autoplay ──────────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = true;
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");

    const tryPlay = () => {
      video.play().catch((err) => {
        console.warn("Autoplay blocked:", err);
      });
    };

    tryPlay();
    document.addEventListener("touchstart", tryPlay, { once: true });
    document.addEventListener("click", tryPlay, { once: true });

    return () => {
      document.removeEventListener("touchstart", tryPlay);
      document.removeEventListener("click", tryPlay);
    };
  }, []);

  // ─── Auto-focus password field when it appears ───────────────────────────
  useEffect(() => {
    if (showPassword && passwordRef.current) {
      passwordRef.current.focus();
    }
  }, [showPassword]);

  // ─── Enter Key Support ───────────────────────────────────────────────────
  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      if (showPassword) {
        onSignIn();
      } else {
        onContinue();
      }
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────
  return React.createElement(
    "div",
    { className: "signin-page", style: { overflow: "hidden" } },

    // Left: Video Panel
    React.createElement(
      "div",
      { className: "illustration-panel" },
      React.createElement(
        "video",
        {
          ref: videoRef,
          className: "side-image",
          src: LoginVideo,
          loop: true,
          playsInline: true,
          preload: "auto",
          muted: true,
        },
        React.createElement("source", {
          src: LoginVideo,
          type: "video/mp4",
        })
      )
    ),

    // Right: Form Panel
    React.createElement(
      "div",
      { className: "form-panel" },
      React.createElement(
        "div",
        { className: "form-inner" },

       React.createElement(
  "div",
  { className: "logo-wrapper" },
  React.createElement("img", {
    src: Logo,
    alt: "Haatza Seller Logo",
    className: "logo-image",
  })
),

        // ── Heading ─────────────────────────────────────────────────────────
        React.createElement("h1", null, "Welcome Back to Login"),

        // ── Email / Phone Input ──────────────────────────────────────────────
        React.createElement(
          "div",
          { className: "input-group" },
          React.createElement(
            "label",
            { htmlFor: "contact" },
            "Enter your Email or Mobile Number"
          ),
          React.createElement(
            "div",
            { style: { position: "relative" } },
            React.createElement("input", {
              id: "contact",
              type: "text",
              value: contact,
              onChange: (e) => onContactChange(e.target.value),
              onKeyDown: handleKeyDown,
              placeholder: "Enter your Email or Mobile Number",
              disabled: loading || showPassword, // lock contact field once password shown
              style: { paddingRight: contact && !showPassword ? "36px" : "12px" },
            }),
            contact && !showPassword
              ? React.createElement(
                  "button",
                  {
                    type: "button",
                    onClick: () => onContactChange(""),
                    style: {
                      position: "absolute",
                      right: "10px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "transparent",
                      border: "none",
                      color: "#999",
                      fontSize: "16px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "4px",
                      zIndex: 2,
                    },
                  },
                  "✕"
                )
              : null
          )
        ),

        // ── Password Input (appears after email verification) ────────────────
        showPassword
          ? React.createElement(
              "div",
              { className: "input-group password-field-animate", style: { position: "relative" } },
              React.createElement(
                "label",
                { htmlFor: "password" },
                "Enter your Password"
              ),
              React.createElement("input", {
                id: "password",
                ref: passwordRef,
                type: "password",
                value: password,
                onChange: (e) => onPasswordChange(e.target.value),
                onKeyDown: handleKeyDown,
                placeholder: "Enter your password",
                disabled: loading,
              }),
              /* Flex Container to Align Change Email (Left) & Forgot Password (Right) */
              React.createElement(
                "div",
                {
                  style: {
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: "8px",
                    width: "100%",
                  },
                },
                React.createElement(
                  "button",
                  {
                    type: "button",
                    className: "change-email-btn",
                    onClick: (e) => {
                      e.preventDefault();
                      onChangeEmail();
                    },
                    style: {
                      background: "transparent",
                      border: "none",
                      color: "#2962ff",
                      fontSize: "13px",
                      cursor: "pointer",
                      fontWeight: "500",
                      padding: 0,
                    },
                  },
                  "Change Email"
                ),
                React.createElement(
                  "button",
                  {
                    type: "button",
                    className: "forgot-password-link",
                    onClick: (e) => {
                      e.preventDefault();
                      onForgotPasswordToggle();
                    },
                    style: {
                      background: "transparent",
                      border: "none",
                      color: "#2962ff",
                      fontSize: "13px",
                      cursor: "pointer",
                      fontWeight: "500",
                      padding: 0,
                    },
                  },
                  "Forgot Password?"
                )
              ),
              showForgotPasswordConfirm
                ? React.createElement(
                    "div",
                    { className: "forgot-confirm-popup" },
                    React.createElement(
                      "div",
                      { className: "forgot-confirm-header" },
                      React.createElement("h4", null, "Reset Password"),
                      React.createElement(
                        "button",
                        {
                          type: "button",
                          className: "forgot-confirm-close",
                          onClick: onForgotPasswordToggle,
                        },
                        "✕"
                      )
                    ),
                    React.createElement(
                      "p",
                      { className: "forgot-confirm-msg" },
                      "Are you sure you want to reset your password?"
                    ),
                    forgotPasswordError
                      ? React.createElement(
                          "div",
                          { className: "forgot-confirm-error" },
                          forgotPasswordError
                        )
                      : null,
                    React.createElement(
                      "div",
                      { className: "forgot-confirm-actions" },
                      React.createElement(
                        "button",
                        {
                          type: "button",
                          className: "forgot-confirm-btn no",
                          onClick: onForgotPasswordToggle,
                          disabled: forgotPasswordLoading,
                        },
                        "No"
                      ),
                      React.createElement(
                        "button",
                        {
                          type: "button",
                          className: "forgot-confirm-btn yes",
                          onClick: onForgotPasswordConfirm,
                          disabled: forgotPasswordLoading,
                        },
                        forgotPasswordLoading ? "Sending..." : "Yes"
                      )
                    )
                  )
                : null
            )
          : null,

        // ── Inline Error Message ─────────────────────────────────────────────
        error
          ? React.createElement("p", { className: "error-text" }, error)
          : null,

        // ── Terms ────────────────────────────────────────────────────────────
        React.createElement(
          "p",
          { className: "terms-text" },
          "By continuing, you agree to our ",
          React.createElement("a", { href: "/terms", target: "_blank", rel: "noopener noreferrer", className: "terms-link" }, "Terms of Use"),
          " and ",
          React.createElement("a", { href: "/privacy", target: "_blank", rel: "noopener noreferrer", className: "terms-link" }, "Privacy Policy"),
          "."
        ),

        // ── Continue / Sign In Button ────────────────────────────────────────
        React.createElement(
          "button",
          {
            className: "signin-btn",
            onClick: showPassword ? onSignIn : onContinue,
            disabled: loading,
          },
          loading ? "Checking..." : showPassword ? "Sign In" : "Continue"
        ),

        // ── Register Link ────────────────────────────────────────────────────
        React.createElement(
          "div",
          { className: "form-footer" },
          React.createElement(
            "a",
            {
              href: "#",
              className: "register-link",
              onClick: (e) => {
                e.preventDefault();
                onRegister();
              },
            },
            "Register for New Account"
          )
        )
      )
    )
  );
}

export default SignInForm;