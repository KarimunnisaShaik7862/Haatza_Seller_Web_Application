import React, { useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import ProfileEditPanel from "./ProfileEditPanel";
import DeleteAccount from "./DeleteAccount";
import { Mail, Phone, ShieldCheck, KeyRound, AlertTriangle, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import "../../../pages/Settings/SettingsPage.css";
import "./Profile.css";

function Profile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const handleClose = () => navigate(-1);
  const sellerData = user || {};

  const profileName =
    sellerData.fullName || sellerData.name || sellerData.sellerName ||
    sellerData.userName || sellerData.firstName || sellerData.nickname ||
    localStorage.getItem("sellerName") || localStorage.getItem("sellerFullName") ||
    sellerData.companyName || "";
  const initials = profileName ? profileName.charAt(0).toUpperCase() : "";
  const logoUrl = sellerData.logoUrl || null;
  const sellerEmail = sellerData.email || "";
  const sellerPhone = sellerData.phone || "";

  const [toast, setToast] = useState({ show: false, message: "", type: "success" });
  const showToastMsg = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast((prev) => ({ ...prev, show: false })), 4000);
  };

  return (
<div className="profile-page">

      <button
        type="button"
        className="profile-close-btn"
        onClick={handleClose}
        aria-label="Close profile"
      >
        <X size={22} />
      </button>

      {/* ── Hero ── */}
      {/* ── Hero ── */}
      <div className="profile-hero">
        <div className="profile-hero-glow" />
        <div className="profile-hero-content">
          <div className="profile-hero-avatar-ring">
            <div className="profile-hero-avatar">
              {logoUrl ? (
                <img src={logoUrl} alt={profileName} />
              ) : (
                <span>{initials}</span>
              )}
            </div>
          </div>

          <div className="profile-hero-text">
            <h1 className="profile-hero-name">{profileName || "Seller"}</h1>

            <div className="profile-hero-meta">
              {sellerEmail && (
                <span className="profile-meta-chip">
                  <Mail size={13} />
                  {sellerEmail}
                  <ShieldCheck size={13} className="verified-icon" />
                </span>
              )}
              {sellerPhone && (
                <span className="profile-meta-chip">
                  <Phone size={13} />
                  {sellerPhone}
                  <ShieldCheck size={13} className="verified-icon" />
                </span>
              )}
            </div>
          </div>
        </div>

        <p className="profile-hero-subtitle">Manage your personal information</p>
      </div>

      {/* ── Personal Information ── */}
      <div className="profile-card">
        <div className="profile-card-header">
          <div className="profile-card-header-icon info-icon">
            <KeyRound size={16} />
          </div>
          <div>
            <h3>Personal Information</h3>
            <p>Your profile details and password</p>
          </div>
        </div>
        <div className="profile-card-body">
          <ProfileEditPanel showToast={showToastMsg} variant="page" />
        </div>
      </div>

      {/* ── Danger Zone ── */}
      <div className="profile-card danger-card">
        <div className="profile-card-header">
          <div className="profile-card-header-icon danger-icon">
            <AlertTriangle size={16} />
          </div>
          <div>
            <h3>Danger Zone</h3>
            <p>Permanently delete your seller account</p>
          </div>
        </div>
        <div className="profile-card-body">
          <DeleteAccount />
        </div>
      </div>

      {toast.show && (
        <div className={`settings-toast ${toast.type}`}>{toast.message}</div>
      )}
    </div>
  );
}

export default Profile;