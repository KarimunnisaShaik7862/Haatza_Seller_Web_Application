import React, { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { fetchOrderDetails, updateOrdersstatus, getCachedSellerId, cancelShipment } from "../../../services/sellerService";
import "./CancelShipmentPage.css";

const FALLBACK_IMG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'%3E%3Crect width='80' height='80' fill='%23f1f3f6' rx='8'/%3E%3Ctext x='40' y='46' text-anchor='middle' fill='%23b0b7c3' font-size='26'%3E%F0%9F%93%A6%3C/text%3E%3C/svg%3E";

const REASONS = [
  "Incorrect Listing Information",
  "Customer Requested Cancellation",
  "Restricted or Prohibited Item",
  "Inventory Mismatch",
  "Unable to Ship to Customer's Address",
  "Logistics/Carrier Issue",
  "Other"
];

const renderProductOption = (option) => {
  if (!option) return "-";
  if (typeof option === "object") {
    return option.Size || option.size || Object.values(option)[0] || "-";
  }
  return String(option);
};

export default function CancelShipmentPage() {
  const { tableId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const fromTab = location.state?.fromTab;

  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelComments, setCancelComments] = useState("");
  const [showReasonDropdown, setShowReasonDropdown] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  const dropdownRef = useRef(null);

  const showToastMsg = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3000);
  };

  const { user } = useAuth();
  const sellerId = useMemo(() => {
    const cached = getCachedSellerId();
    if (cached) return cached;

    try {
      const stored = JSON.parse(localStorage.getItem("haatzaSeller"));
      return (
        user?.sellerId ||
        stored?.sellerId ||
        stored?.data?.sellerId ||
        sessionStorage.getItem("__haatza_sellerId") ||
        localStorage.getItem("sellerId") ||
        sessionStorage.getItem("sellerId") ||
        ""
      );
    } catch {
      return (
        user?.sellerId ||
        sessionStorage.getItem("__haatza_sellerId") ||
        localStorage.getItem("sellerId") ||
        sessionStorage.getItem("sellerId") ||
        ""
      );
    }
  }, [user]);

  useEffect(() => {
    if (!tableId) {
      navigate("/dashboard/orders");
      return;
    }

    const loadDetails = async () => {
      setLoading(true);
      try {
        const response = await fetchOrderDetails(tableId);
        const data = response?.message?.data || response?.data || response;
        if (data) {
          setDetails(data);
        } else {
          showToastMsg("Order not found", "error");
        }
      } catch (err) {
        console.error("Error loading order details for cancellation", err);
        showToastMsg("Failed to load order info", "error");
      } finally {
        setLoading(false);
      }
    };

    loadDetails();
  }, [tableId, navigate]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowReasonDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleBackToDetails = () => {
    navigate(`/dashboard/orders/details/${tableId}`, { state: { fromTab } });
  };

  // "Cancel Shipment" button just opens the confirmation modal.
  const handleCancelSubmit = () => {
    if (!cancelReason) return;
    setShowConfirmModal(true);
  };

  // Called when the user taps "Yes" in the confirmation modal.
  // Per requirement: no API calls here — just mark it cancelled locally
  // and route straight into the Cancelled Orders view.
  // Called when the user taps "Yes" in the confirmation modal.
  // Only updates order status to "Order Cancelled" — cancelShipment API is NOT called.
  const handleConfirmCancelYes = async () => {
    setShowConfirmModal(false);
    setCancelling(true);

    try {
      await updateOrdersstatus(details?.orderId, sellerId, "Order Cancelled");
      showToastMsg("Order cancelled successfully", "success"); 

      setTimeout(() => {
        navigate("/dashboard/orders", { state: { fromTab: "cancelled" } });
      }, 800);
    } catch (err) {
      console.error("[CancelShipmentPage] Failed to update order status:", err);
      const backendErrMsg = err?.response?.data?.message || err?.message || "";
      showToastMsg(backendErrMsg || "Unable to cancel order. Please try again.", "error");
    } finally {
      setCancelling(false);
    }
  };

  const handleConfirmCancelNo = () => {
    setShowConfirmModal(false);
  };

  if (loading) {
    return (
      <div className="csp-container loading">
        <div className="csp-spinner"></div>
        <p>Loading order details...</p>
      </div>
    );
  }

  if (!details) {
    return (
      <div className="csp-container error">
        <p>Order details could not be found.</p>
        <button onClick={() => navigate("/dashboard/orders")} className="csp-btn-back">Back to Orders</button>
      </div>
    );
  }

  // Cancel Shipment button enable validation logic:
  // Optional for all reasons, but mandatory when user selects "Other"
  const isSubmitDisabled = 
    !cancelReason || 
    cancelling || 
    (cancelReason === "Other" && !cancelComments.trim());

  return (
    <div className="csp-page-wrapper">
      {/* Back Button outside card container */}
      <div className="csp-top-navigation">
        <button className="csp-back-action-btn" onClick={handleBackToDetails}>
          <ArrowLeft size={16} />
          <span>Back to Order Details</span>
        </button>
      </div>

      <div className="csp-cards-container">
        {/* Card 1: Product Details Card */}
        <div className="csp-card csp-product-card-redesigned">
          <div className="csp-img-container-redesigned">
            <img src={details.productimage || FALLBACK_IMG} alt={details.items} />
          </div>
          <div className="csp-product-info-redesigned">
            <h2 className="csp-product-name-redesigned">{details.items}</h2>
            <p className="csp-product-variant">
              Variant: <span>{renderProductOption(details.productOption)}</span>
            </p>
            <div className="csp-product-stats-row">
              <span className="csp-stat-item">Quantity: <strong>{details.quantity}</strong></span>
              <span className="csp-stat-item">Price: <strong>₹{details.itemPrice}</strong></span>
            </div>
          </div>
        </div>

        {/* Card 2: Reason Selection Card */}
        <div className="csp-card csp-reason-card">
          <h3 className="csp-card-title">Cancellation Reason</h3>
          <div className="csp-reason-dropdown-wrapper" ref={dropdownRef}>
            <button className="csp-reason-dropdown-trigger" onClick={() => setShowReasonDropdown(!showReasonDropdown)}>
              <span className={cancelReason ? "csp-dropdown-selected" : "csp-dropdown-placeholder"}>
                {cancelReason || "Select Reason"}
              </span>
              <ChevronDown size={18} className="csp-dropdown-arrow" />
            </button>

            {showReasonDropdown && (
              <div className="csp-dropdown-menu">
                {REASONS.map((reason) => (
                  <button
                    key={reason}
                    className={`csp-dropdown-item ${cancelReason === reason ? "active" : ""}`}
                    onClick={() => {
                      setCancelReason(reason);
                      setShowReasonDropdown(false);
                    }}
                  >
                    {reason}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Card 3: Additional Comments Card */}
        <div className="csp-card csp-comments-card">
          <label className="csp-comments-label-redesigned" htmlFor="csp-comments-textarea">
            Could you tell us a reason for cancelling? {cancelReason === "Other" && <span className="required-star">*</span>}
          </label>
          <textarea
            id="csp-comments-textarea"
            className="csp-comments-textarea-redesigned"
            placeholder={cancelReason === "Other" ? "Reason is required when selecting 'Other'" : "Tell us more about the reason..."}
            value={cancelComments}
            onChange={(e) => setCancelComments(e.target.value.slice(0, 1000))}
          />
          <div className="csp-char-counter-redesigned">
            {cancelComments.length}/1000 characters
          </div>
        </div>

        {/* Card 4: Action Section Card */}
        <div className="csp-action-card">
          <button
            className={`csp-submit-btn-redesigned ${isSubmitDisabled ? "disabled" : ""}`}
            onClick={handleCancelSubmit}
            disabled={isSubmitDisabled}
          >
            {cancelling ? "Processing..." : "Cancel Shipment"}
          </button>
        </div>
      </div>

      {/* Cancel Confirmation Modal */}
      {showConfirmModal && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)",
            display: "flex", alignItems: "flex-end", justifyContent: "center",
            zIndex: 2000
          }}
          onClick={handleConfirmCancelNo}
        >
          <div
            style={{
              background: "#fff", width: "100%", maxWidth: "480px",
              borderTopLeftRadius: "20px", borderTopRightRadius: "20px",
              padding: "36px 24px 28px", textAlign: "center",
              boxShadow: "0 -8px 30px rgba(0,0,0,0.15)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p style={{ margin: "0 0 8px", fontSize: "17px", color: "#1E293B" }}>
              Are you sure want to cancel shipment.
            </p>
            <p style={{ margin: "0 0 28px", fontSize: "17px", color: "#1E293B" }}>
              Reason: {cancelReason}
            </p>

            <div style={{ display: "flex", gap: "16px" }}>
              <button
                onClick={handleConfirmCancelYes}
                style={{
                  flex: 1, padding: "16px", borderRadius: "12px",
                  border: "2px solid #2962FF", background: "#fff",
                  color: "#2962FF", fontWeight: 600, fontSize: "16px", cursor: "pointer"
                }}
              >
                Yes
              </button>
              <button
                onClick={handleConfirmCancelNo}
                style={{
                  flex: 1, padding: "16px", borderRadius: "12px",
                  border: "none", background: "#2962FF",
                  color: "#fff", fontWeight: 600, fontSize: "16px", cursor: "pointer"
                }}
              >
                No
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast.show && (
        <div className={`csp-toast ${toast.type}`}>
          <span>{toast.type === "success" ? "✓" : "❌"}</span>
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
