import React, { useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import SignUpForm from "../../components/auth/SignUpForm/SignUpForm";
import { checkSeller, checkOnboardStatus, loginUser } from "../../services/sellerService";
import { saveUser } from '../../utils/userStore';
import { useAuth } from "../../context/AuthContext";
export let registeredEmail = '';

function SignUpPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [form, setForm] = useState(() => {
    const routeState = location.state || {};
    const contact = routeState.prefillContact || "";
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact);
    const isPhone = /^[6-9]\d{9}$/.test(contact);

    return {
      fullName: "",
      phone: isPhone ? contact : "",
      email: isEmail ? contact : "",
      password: "",
    };
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({ phone: "", email: "" });

  const checkPhoneAvailability = async (phoneVal) => {
    const trimmed = phoneVal.trim();
    if (!/^[6-9]\d{9}$/.test(trimmed)) {
      setFieldErrors(prev => ({ ...prev, phone: "" }));
      return;
    }
    try {
      const res = await checkSeller(trimmed);
      if (res.userExists) {
        setFieldErrors(prev => ({
          ...prev,
          phone: "This phone number is already registered. Please use another phone number."
        }));
      } else {
        setFieldErrors(prev => ({ ...prev, phone: "" }));
      }
    } catch (err) {
      setFieldErrors(prev => ({ ...prev, phone: "" }));
    }
  };

  const checkEmailAvailability = async (emailVal) => {
    const trimmed = emailVal.toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setFieldErrors(prev => ({ ...prev, email: "" }));
      return;
    }
    try {
      const res = await checkSeller(trimmed);
      if (res.userExists) {
        setFieldErrors(prev => ({
          ...prev,
          email: "This email address is already registered. Please use another email address."
        }));
      } else {
        setFieldErrors(prev => ({ ...prev, email: "" }));
      }
    } catch (err) {
      setFieldErrors(prev => ({ ...prev, email: "" }));
    }
  };

  // ─── Field change handler ─────────────────────────────────────────────────
  const handleFormChange = (field, value) => {
    setError("");
    let cleaned = value;
    if (field === "fullName") {
      cleaned = value.replace(/[^a-zA-Z\s.\-]/g, "");
    } else if (field === "phone") {
      cleaned = value.replace(/\D/g, "").slice(0, 10);
      setFieldErrors(prev => ({ ...prev, phone: "" }));
      if (cleaned.length === 10) {
        checkPhoneAvailability(cleaned);
      }
    } else if (field === "email") {
      cleaned = value.replace(/[^a-zA-Z0-9@._\-+]/g, "");
      setFieldErrors(prev => ({ ...prev, email: "" }));
    } else if (field === "password") {
      cleaned = value.replace(/[\s]/g, "").replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, "");
    }
    setForm((prev) => ({ ...prev, [field]: cleaned }));
  };

  const handlePhoneBlur = () => {
    checkPhoneAvailability(form.phone);
  };

  const handleEmailBlur = () => {
    checkEmailAvailability(form.email);
  };

  // ─── Register handler ─────────────────────────────────────────────────────
 const isSubmitting = useRef(false);

const handleRegister = async () => {
  if (isSubmitting.current) return;
  isSubmitting.current = true;

  setError("");
  setSuccess("");
  setLoading(true);

  const emailTrimmed = form.email.toLowerCase().trim();
  const phoneTrimmed = form.phone.trim();

  if (fieldErrors.phone) {
    setError(fieldErrors.phone);
    setLoading(false);
    isSubmitting.current = false;
    return;
  }
  if (fieldErrors.email) {
    setError(fieldErrors.email);
    setLoading(false);
    isSubmitting.current = false;
    return;
  }

  try {
    // Step 1: Validate fields locally (no DB writes yet)
    if (!form.fullName?.trim()) {
      setError("Please enter your full name.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!/^[6-9]\d{9}$/.test(phoneTrimmed)) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }
    if (!form.password || form.password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    // Step 2: Check if email or phone already exists (single source of truth)
    let emailExists = false;
    let phoneExists = false;

    try {
      const emailCheck = await checkSeller(emailTrimmed);
      emailExists = !!emailCheck.userExists;
    } catch {
      // If checkseller fails for email, treat as not existing
    }

    if (emailExists) {
      setError("This email address is already registered. Please use another email address.");
      return;
    }

    try {
      const phoneCheck = await checkSeller(phoneTrimmed);
      phoneExists = !!phoneCheck.userExists;
    } catch {
      // If checkseller fails for phone, treat as not existing
    }

    if (phoneExists) {
      setError("This phone number is already registered. Please use another phone number.");
      return;
    }

    // Step 3: DO NOT create the account yet.
    // Just move to OTP verification, carrying the unsaved form data.
    // The account will only be created in OtpPage after OTP is verified.
    setSuccess("OTP sent. Please verify your mobile number to complete registration.");

    setTimeout(() => {
      navigate("/otp", {
        state: {
          contact:      phoneTrimmed,
          contactType:  "phone",
          email:        emailTrimmed,
          phone:        phoneTrimmed,
          fullName:     form.fullName.trim(),
          // Carry pending registration data — account not yet created
          pendingRegistration: {
            fullName: form.fullName.trim(),
            phone:    phoneTrimmed,
            email:    emailTrimmed,
            password: form.password,
          },
        }
      });
    }, 800);

  } catch (err) {
    setError(err.message || "Registration failed. Please try again.");
  } finally {
    setLoading(false);
    isSubmitting.current = false;
  }
};
  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <SignUpForm
      form={form}
      onFormChange={handleFormChange}
      loading={loading}
      error={error}
      success={success}
      phoneError={fieldErrors.phone}
      emailError={fieldErrors.email}
      onPhoneBlur={handlePhoneBlur}
      onEmailBlur={handleEmailBlur}
      onRegister={handleRegister}
      onNavigateSignIn={() => navigate("/signin")}
    />
  );
}

export default SignUpPage;