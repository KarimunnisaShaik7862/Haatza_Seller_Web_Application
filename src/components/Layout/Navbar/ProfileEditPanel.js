import React, { useState, useRef, useCallback, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import { sellerService } from "../../../services/sellerService";
import "../../../pages/Settings/SettingsPage.css"; // reuse existing popup/otp/password styles

function ProfileEditPanel({ showToast = () => {}, onClose = () => {}, variant = "popup" }) {
  const { user, updateUser } = useAuth();
  const sellerData = user || {};

  const profileName =
    sellerData.fullName || sellerData.name || sellerData.sellerName ||
    sellerData.userName || sellerData.firstName || sellerData.nickname ||
    localStorage.getItem("sellerName") || localStorage.getItem("sellerFullName") ||
    sellerData.companyName || "";
  const sellerEmail = sellerData.email || "";
  const sellerPhone = sellerData.phone || "";

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editProfileName, setEditProfileName] = useState(profileName);
  const [editProfileEmail, setEditProfileEmail] = useState(sellerEmail);
  const [editProfilePhone, setEditProfilePhone] = useState(sellerPhone);
  const [profileError, setProfileError] = useState("");
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [passwordResetLoading, setPasswordResetLoading] = useState(false);
  const [passwordResetError, setPasswordResetError] = useState("");

  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpDigits, setOtpDigits] = useState(Array(6).fill(""));
  const [otpTimeLeft, setOtpTimeLeft] = useState(0);
  const [, setOtpTimerActive] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpResendLoading, setOtpResendLoading] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [otpSuccess, setOtpSuccess] = useState("");

  const otpTimerRef = useRef(null);
  const otpInputRefs = useRef([]);

  const startOtpTimer = useCallback(() => {
    clearInterval(otpTimerRef.current);
    setOtpTimeLeft(60);
    setOtpTimerActive(true);
    otpTimerRef.current = setInterval(() => {
      setOtpTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(otpTimerRef.current);
          setOtpTimerActive(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => () => clearInterval(otpTimerRef.current), []);

  const handleOtpDigitChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const digit = value.slice(-1);
    const newOtp = [...otpDigits];
    newOtp[index] = digit;
    setOtpDigits(newOtp);
    if (otpError) setOtpError("");
    if (digit && index < 5) otpInputRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace") {
      if (otpDigits[index]) {
        const newOtp = [...otpDigits];
        newOtp[index] = "";
        setOtpDigits(newOtp);
      } else if (index > 0) {
        otpInputRefs.current[index - 1]?.focus();
      }
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const newOtp = Array(6).fill("");
    for (let i = 0; i < pasted.length; i++) newOtp[i] = pasted[i];
    setOtpDigits(newOtp);
    otpInputRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const handleCancelOtp = () => {
    clearInterval(otpTimerRef.current);
    setOtpTimerActive(false);
    setShowOtpModal(false);
    setOtpError("");
    setOtpSuccess("");
  };

  const handleResendOtp = async () => {
    setOtpResendLoading(true);
    setOtpError("");
    setOtpSuccess("");
    setOtpDigits(Array(6).fill(""));
    const newPhoneVal = (editProfilePhone || "").trim();
    try {
      await sellerService.resendOtp(newPhoneVal);
      setOtpSuccess("OTP resent successfully!");
      startOtpTimer();
    } catch (err) {
      setOtpError(err.message || "Could not resend OTP. Please try again.");
    } finally {
      setOtpResendLoading(false);
    }
  };

  const handleVerifyOtpSubmit = async () => {
    const code = otpDigits.join("");
    if (code.length < 6) {
      setOtpError("Please enter all 6 digits.");
      return;
    }
    setOtpLoading(true);
    setOtpError("");
    setOtpSuccess("");
    const newPhoneVal = (editProfilePhone || "").trim();
    try {
      const verifyResponse = await sellerService.verifyOtp(newPhoneVal, code);
      let verifiedPhone = newPhoneVal;
      try {
        const sellerObj =
          verifyResponse?.message?.seller || verifyResponse?.seller ||
          verifyResponse?.message || verifyResponse || {};
        const resolvedPhone =
          sellerObj.phone || sellerObj.phonenumber || sellerObj.phone_number ||
          sellerObj.mobile_number || sellerObj.contact || sellerObj.mobile ||
          verifyResponse?.phone || verifyResponse?.phonenumber || "";
        if (resolvedPhone) verifiedPhone = String(resolvedPhone).trim();
      } catch { /* ignore */ }

      if (newPhoneVal === verifiedPhone) {
        await sellerService.updateSellerOnboarding(sellerEmail, {
          phone: verifiedPhone,
          phoneNumber: verifiedPhone,
        });
        updateUser({ name: editProfileName, email: editProfileEmail, phone: verifiedPhone });
        setShowOtpModal(false);
        setIsEditingProfile(false);
        onClose();
        showToast("Profile details and phone number updated successfully.", "success");
      } else {
        throw new Error("Verification mismatch: The verified number does not match the entered phone number.");
      }
    } catch (err) {
      const errorMsg = err.message || err.response?.data?.message || "Invalid OTP. Please try again.";
      setOtpError(errorMsg);
      showToast(errorMsg, "error");
    } finally {
      setOtpLoading(false);
    }
  };

  const handleProfileEditToggle = () => {
    setEditProfileName(profileName);
    setEditProfileEmail(sellerEmail);
    setEditProfilePhone(sellerPhone);
    setProfileError("");
    setIsEditingProfile(true);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    const nameStr = String(editProfileName || "").trim();
    const emailStr = String(editProfileEmail || "").trim();
    const phoneStr = String(editProfilePhone || "").trim();

    if (!nameStr) { setProfileError("Name is required"); return; }
    if (!emailStr) { setProfileError("Email is required"); return; }

    const oldPhoneVal = (sellerPhone || "").trim();
    const newPhoneVal = phoneStr;

    if (newPhoneVal !== oldPhoneVal) {
      setProfileError("");
      setOtpError("");
      setOtpSuccess("");
      setOtpDigits(Array(6).fill(""));

      const isPhone = /^[6-9]\d{9}$/.test(newPhoneVal);
      if (!isPhone) { setProfileError("Enter a valid 10-digit mobile number."); return; }

      setOtpLoading(true);
      try {
        const checkResult = await sellerService.checkSeller(newPhoneVal);
        if (checkResult && checkResult.userExists) {
          setProfileError("This phone number is already registered. Please use a different phone number.");
          setOtpLoading(false);
          return;
        }
        setShowOtpModal(true);
        await sellerService.generateOtp(newPhoneVal);
        setOtpSuccess("Verification OTP sent to your new phone number!");
        startOtpTimer();
      } catch (err) {
        setProfileError(err.message || "Failed to check or send OTP. Please try again.");
      } finally {
        setOtpLoading(false);
      }
    } else {
      updateUser({ name: nameStr, email: emailStr, phone: phoneStr });
      setIsEditingProfile(false);
      onClose();
    }
  };

  const handleResetPassword = async () => {
    setPasswordResetLoading(true);
    setPasswordResetError("");
    try {
      const response = await sellerService.forgotPassword(sellerEmail);
      if (response && (response.status === false || response.success === false ||
          (typeof response === "string" && response.toLowerCase().includes("failed")))) {
        throw new Error(response.message || response || "Failed to send password reset request.");
      }
      showToast("Password is sent to your mail, check it.", "success");
      setShowPasswordConfirm(false);
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message || "Failed to send password reset request.";
      setPasswordResetError(errorMsg);
      showToast(errorMsg, "error");
    } finally {
      setPasswordResetLoading(false);
    }
  };

  return (
    <div className={`profile-edit-panel ${variant}`}>
      {isEditingProfile ? (
        <form onSubmit={handleSaveProfile} className="popup-form">
          {profileError && <div className="popup-error">{profileError}</div>}
          <div className="popup-field">
            <label>Name</label>
            <input type="text" value={editProfileName} disabled required />
          </div>
          <div className="popup-field">
            <label>Email Address</label>
            <input type="email" value={editProfileEmail} disabled required />
          </div>
          <div className="popup-field">
            <label>Phone Number</label>
            <input
              type="tel"
              value={editProfilePhone}
              onChange={(e) => setEditProfilePhone(e.target.value)}
              placeholder="N/A"
            />
          </div>
          <div className="popup-actions">
            <button type="button" className="popup-btn cancel" onClick={() => setIsEditingProfile(false)}>
              Cancel
            </button>
            <button type="submit" className="popup-btn save">Save Changes</button>
          </div>
        </form>
      ) : (
        <div className="popup-view">
          <div className="popup-detail-row">
            <span className="popup-label">Name</span>
            <span className="popup-value">{profileName}</span>
          </div>
          <div className="popup-detail-row">
            <span className="popup-label">Email</span>
            <span className="popup-value">{sellerEmail}</span>
          </div>
          <div className="popup-detail-row">
            <span className="popup-label">Phone</span>
            <span className="popup-value">{sellerPhone}</span>
          </div>

          <div className="popup-actions-footer" style={{ position: "relative" }}>
            <button className="popup-edit-trigger" onClick={handleProfileEditToggle}>
              Edit Profile
            </button>
            <button
              type="button"
              className="popup-edit-trigger secondary"
              onClick={() => setShowPasswordConfirm((p) => !p)}
            >
              Change Password
            </button>

            {showPasswordConfirm && (
              <div className="password-confirm-popup">
                <div className="password-confirm-header">
                  <h4>Reset Password</h4>
                  <button
                    type="button"
                    className="password-confirm-close"
                    onClick={() => { setShowPasswordConfirm(false); setPasswordResetError(""); }}
                  >
                    ✕
                  </button>
                </div>
                <p className="password-confirm-msg">Are you sure want to reset password?</p>
                {passwordResetError && <div className="password-confirm-error">{passwordResetError}</div>}
                <div className="password-confirm-actions">
                  <button
                    type="button"
                    className="password-confirm-btn no"
                    onClick={() => { setShowPasswordConfirm(false); setPasswordResetError(""); }}
                    disabled={passwordResetLoading}
                  >
                    No
                  </button>
                  <button
                    type="button"
                    className="password-confirm-btn yes"
                    onClick={handleResetPassword}
                    disabled={passwordResetLoading}
                  >
                    {passwordResetLoading ? "Sending..." : "Yes"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showOtpModal && (
        <div className="otp-modal-overlay">
          <div className="otp-modal-card">
            <div className="otp-modal-header">
              <h3>Verify Phone Number</h3>
              <button type="button" className="otp-modal-close" onClick={handleCancelOtp} disabled={otpLoading}>✕</button>
            </div>
            <div className="otp-modal-body">
              <p className="otp-modal-instruction">
                We have sent a 6-digit OTP verification code to <span className="otp-highlight-phone">{editProfilePhone}</span>.
              </p>
              {otpError && <div className="otp-modal-error">{otpError}</div>}
              {otpSuccess && <div className="otp-modal-success">{otpSuccess}</div>}
              <div className="otp-inputs-wrapper">
                <label>Enter OTP</label>
                <div className="otp-digits-container">
                  {otpDigits.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => (otpInputRefs.current[index] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      disabled={otpLoading}
                      onChange={(e) => handleOtpDigitChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      onPaste={handleOtpPaste}
                      className={`otp-digit-input ${digit ? "filled" : ""}`}
                    />
                  ))}
                </div>
              </div>
              <div className="otp-modal-timer-row">
                {otpTimeLeft > 0 ? (
                  <span className="otp-timer-text">Resend OTP in <strong>{otpTimeLeft}s</strong></span>
                ) : (
                  <span className="otp-timer-text expired">Didn't receive the code?</span>
                )}
                <button
                  type="button"
                  className="otp-resend-btn"
                  onClick={handleResendOtp}
                  disabled={otpTimeLeft > 0 || otpResendLoading}
                >
                  {otpResendLoading ? "Resending..." : "Resend OTP"}
                </button>
              </div>
            </div>
            <div className="otp-modal-actions">
              <button type="button" className="otp-modal-btn cancel" onClick={handleCancelOtp} disabled={otpLoading}>
                Cancel
              </button>
              <button
                type="button"
                className="otp-modal-btn verify"
                onClick={handleVerifyOtpSubmit}
                disabled={otpLoading || otpDigits.join("").length < 6}
              >
                {otpLoading ? "Verifying..." : "Verify & Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProfileEditPanel;