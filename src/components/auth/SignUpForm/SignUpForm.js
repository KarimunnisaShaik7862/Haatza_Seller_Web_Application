import React, { useState, useRef, useEffect } from "react";
import "./SignUpForm.css";
import LoginVideo from "../../../assets/videos/SignUpIn.mp4";
import Logo from "../../../assets/Images/haatzaSellerlogo.png";
import { Link } from "react-router-dom";
/**
 * SignUpForm — pure UI component
 *
 * Props:
 *   form           {object}  { fullName, phone, email, password }
 *   onFormChange   {fn}      called with (field, value) when any input changes
 *   loading        {bool}    disables inputs & changes button label
 *   error          {string}  error message to display (empty string = none)
 *   success        {string}  success message to display (empty string = none)
 *   onRegister     {fn}      called when "Register" button is clicked / Enter pressed
 *   onNavigateSignIn {fn}    called when "Sign In" link is clicked
 */
function SignUpForm({
  form,
  onFormChange,
  loading,
  error,
  success,
  phoneError,
  emailError,
  onPhoneBlur,
  onEmailBlur,
  onRegister,
  onNavigateSignIn,
}) {
  const [showPassword, setShowPassword] = useState(false);
  const videoRef = useRef(null);

  // ─── Video autoplay (handles mobile browsers) ────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = true;
    const tryPlay = () => video.play().catch(() => {});
    tryPlay();
    document.addEventListener("touchstart", tryPlay, { once: true });
    document.addEventListener("click", tryPlay, { once: true });
    return () => {
      document.removeEventListener("touchstart", tryPlay);
      document.removeEventListener("click", tryPlay);
    };
  }, []);

  // ─── Enter key support ───────────────────────────────────────────────────
  const handleKeyDown = (e) => {
    if (e.key === "Enter") onRegister();
  };

  // ─── SVG Icons ───────────────────────────────────────────────────────────
  const EyeOpenIcon = React.createElement(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      width: "16",
      height: "16",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
    },
    React.createElement("path", { d: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" }),
    React.createElement("circle", { cx: "12", cy: "12", r: "3" })
  );

  const EyeClosedIcon = React.createElement(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      width: "16",
      height: "16",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
    },
    React.createElement("path", {
      d: "M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94",
    }),
    React.createElement("path", {
      d: "M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19",
    }),
    React.createElement("line", { x1: "1", y1: "1", x2: "23", y2: "23" })
  );

  // ─── Render ──────────────────────────────────────────────────────────────
  return React.createElement(
    "div",
    { className: "container" },

    // LEFT VIDEO PANEL
    React.createElement(
      "div",
      { className: "illustration-panel" },
      React.createElement("video", {
        ref: videoRef,
        className: "side-video",
        src: LoginVideo,
        loop: true,
        playsInline: true,
        preload: "auto",
        muted: true,
      })
    ),

    // RIGHT FORM PANEL
    React.createElement(
      "div",
      { className: "form-panel" },
      React.createElement(
        "div",
        { className: "form-inner" },

        // LOGO
        React.createElement(
        "div",
        { className: "logo-wrapper" },
        React.createElement("img", { src: Logo, alt: "Haatza Seller Logo", className: "logo-image" })
        ),

        // TITLE
        React.createElement("h2", { className: "title blue" }, "Register"),

        // SUBTITLE
        React.createElement(
          "p",
          { className: "subtitle" },
          "Reach Millions of Customers — Become a Haatza Seller Today"
        ),

        // ERROR BANNER
        error
          ? React.createElement("p", { className: "error-message" }, error)
          : null,

        // SUCCESS BANNER
        success
          ? React.createElement("p", { className: "success-message" }, success)
          : null,

        // FULL NAME
        React.createElement("input", {
          type: "text",
          placeholder: "Full Name",
          className: "input-box",
          value: form.fullName,
          onChange: (e) => onFormChange("fullName", e.target.value),
          onKeyDown: handleKeyDown,
          disabled: loading,
        }),

        // PHONE
        React.createElement(
          "div",
          { className: "phone-box" },
          React.createElement("span", { className: "country-code" }, "+91"),
          React.createElement("input", {
            type: "text",
            placeholder: "Phone Number",
            className: "phone-input",
            value: form.phone,
            maxLength: 10,
            onChange: (e) => onFormChange("phone", e.target.value),
            onBlur: () => onPhoneBlur && onPhoneBlur(),
            onKeyDown: handleKeyDown,
            disabled: loading,
          })
        ),
        phoneError
          ? React.createElement(
              "p",
              {
                style: {
                  color: "#e53935",
                  fontSize: "12.5px",
                  margin: "-8px 0 8px 4px",
                  textAlign: "left",
                  width: "100%",
                },
              },
              phoneError
            )
          : null,

        // EMAIL
        React.createElement("input", {
          type: "email",
          placeholder: "Email Address",
          className: "input-box",
          value: form.email,
          onChange: (e) => onFormChange("email", e.target.value),
          onBlur: () => onEmailBlur && onEmailBlur(),
          onKeyDown: handleKeyDown,
          disabled: loading,
        }),
        emailError
          ? React.createElement(
              "p",
              {
                style: {
                  color: "#e53935",
                  fontSize: "12.5px",
                  margin: "-8px 0 8px 4px",
                  textAlign: "left",
                  width: "100%",
                },
              },
              emailError
            )
          : null,

        // PASSWORD
        React.createElement(
          "div",
          { className: "password-box" },
          React.createElement("input", {
            type: showPassword ? "text" : "password",
            placeholder: "Password (min 8 characters)",
            className: "password-input",
            value: form.password,
            onChange: (e) => onFormChange("password", e.target.value),
            onKeyDown: handleKeyDown,
            disabled: loading,
          }),
          React.createElement(
            "span",
            {
              className: "eye-icon",
              onClick: () => setShowPassword((v) => !v),
            },
            showPassword ? EyeOpenIcon : EyeClosedIcon
          )
        ),

        // TERMS
        React.createElement(
          "p",
          { className: "terms" },
          "By continuing, you agree to our ",
          React.createElement(Link, { to: "/terms", className: "link" }, "Terms of Use"),
          " and ",
          React.createElement(Link, { to: "/privacy", className: "link" }, "Privacy Policy"),
          "."
        ),

        // REGISTER BUTTON
        React.createElement(
          "button",
          {
            className: "btn",
            onClick: onRegister,
            disabled: loading,
          },
          loading ? "Registering..." : "Register"
        ),

        // SIGN IN LINK
        React.createElement(
          "p",
          { className: "signin-text" },
          "Already a Seller? ",
          React.createElement(
            "span",
            { className: "link", onClick: onNavigateSignIn },
            "Sign In"
          )
        )
      )
    )
  );
}

export default SignUpForm;