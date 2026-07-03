import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Trash2 } from "lucide-react";
import { resolveSellerEmail, resolveSellerId } from "../../../utils/sellerSession";
import "./DeleteAccount.css";

const DELETE_ACCOUNT_API = "https://haatzaseller.com/_functions/deleteAccount";

/**
 * Reusable Delete Account button + confirmation popup.
 *
 * Self-contained: renders its own trigger button, its own modal
 * (center on desktop / bottom sheet on mobile via CSS), and handles
 * the full delete flow end-to-end. Drop <DeleteAccount /> anywhere
 * it's needed (Navbar, Settings page, etc.) — no props required.
 */
function DeleteAccount() {
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState({ show: false, message: "" });

  const openModal = () => {
    setError("");
    setIsOpen(true);
  };

  // Cancel / outside click / ESC all route through this — but never
  // allow closing while a delete request is in flight.
  const closeModal = useCallback(() => {
    if (loading) return;
    setIsOpen(false);
    setError("");
  }, [loading]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") closeModal();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, closeModal]);

  const showToast = (message) => {
    setToast({ show: true, message });
    setTimeout(() => setToast({ show: false, message: "" }), 4000);
  };

  const handleConfirmDelete = async () => {
    setError("");

    // ── Validation: never call the API without a resolvable seller email ──
    const sellerEmail = resolveSellerEmail();
    if (!sellerEmail || !sellerEmail.trim()) {
      setError("Unable to identify your account. Please log in again.");
      return;
    }

    setLoading(true);
    try {
      const sellerId = resolveSellerId();

      const res = await fetch(DELETE_ACCOUNT_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: sellerEmail.trim(), sellerId: sellerId || "" }),
      });

      const data = await res.json().catch(() => ({}));

      // Treat any HTTP 200 response as successful
      if (!res.ok) {
        console.error("[DeleteAccount] Server responded with error body:", data);
        const serverMsg =
          data?.message?.error ||
          data?.message ||
          data?.error ||
          `Delete account failed with status ${res.status}`;
        throw new Error(typeof serverMsg === "string" ? serverMsg : JSON.stringify(serverMsg));
      }

      // ── Success: wipe every trace of the session ──
      localStorage.clear();
      sessionStorage.clear();

      setLoading(false);
      setIsOpen(false);
      showToast("Your account has been deleted successfully.");

      // Small delay so the success toast is visible before redirect
      setTimeout(() => navigate("/signin"), 1200);
    } catch (err) {
      console.error("[DeleteAccount] Failed to delete account:", err);
      // ── Failure: do NOT log out, do NOT clear any data ──
      setLoading(false);
      setError(err.message || "Unable to delete your account. Please try again later.");
    }
};

  return (
    <>
      <button
        type="button"
        className="delete-account-trigger"
        onClick={openModal}
      >
        <Trash2 size={16} className="delete-account-trigger-icon" />
        <span>Delete Account</span>
      </button>

      {isOpen && (
        <div
          className="delete-account-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div
            className="delete-account-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
          >
            <div className="delete-account-modal-handle" />

            <h3 id="delete-account-title" className="delete-account-title">
              Delete Account
            </h3>

            <p className="delete-account-message">
              Are you sure you want to delete your seller account?
            </p>

            <p className="delete-account-support-text">
              This action is permanent and cannot be undone.
              <br />
              Your listed products will be unpublished from Haatza and your
              seller account will be permanently deleted.
            </p>

            {error && <div className="delete-account-error">{error}</div>}

            <div className="delete-account-actions">
              <button
                type="button"
                className="delete-account-btn cancel"
                onClick={closeModal}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="delete-account-btn confirm"
                onClick={handleConfirmDelete}
                disabled={loading}
              >
                {loading ? <span className="delete-account-spinner" /> : "Delete Account"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast.show && (
        <div className="delete-account-toast">{toast.message}</div>
      )}
    </>
  );
}

export default DeleteAccount;