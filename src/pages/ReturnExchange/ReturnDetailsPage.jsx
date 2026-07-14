import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { ArrowLeft, CheckCircle, AlertOctagon, XCircle, Download, Truck } from "lucide-react";
import { sellerService } from "../../services/sellerService";
import {
  ReturnDetails,
  ExchangeShipmentModal,
  RejectReturnModal,
  TrackShipmentModal
} from "../../components/ReturnExchange";
import "./ReturnExchange.css";

const extractPincode = (address) => {
  if (!address) return "";
  const match = address.match(/\b\d{6}\b/);
  return match ? match[0] : "";
};

const ReturnDetailsPage = () => {
  const { user } = useAuth();
  const { tableId } = useParams();
  const navigate = useNavigate();

  // State Management
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showTrackModal, setShowTrackModal] = useState(false);
  const [creatingShipment, setCreatingShipment] = useState(false);

  const [trackingId, setTrackingId] = useState("");
  const [awbNumber, setAwbNumber] = useState("");
  const [trackingDetails, setTrackingDetails] = useState(null);
  const [loadingTracking, setLoadingTracking] = useState(false);

  // Estimates state
  const [shippingCost, setShippingCost] = useState(null);
  const [tatDays, setTatDays] = useState(null);
  const [loadingEstimates, setLoadingEstimates] = useState(false);

  // Custom Toast state
  const [toast, setToast] = useState(null);

  // Fetch sellerId from storage
  const sellerId = useMemo(() => {
    const canonical = sessionStorage.getItem("__haatza_sellerId") || localStorage.getItem("__haatza_sellerId");
    if (canonical) return canonical;

    try {
      const stored = JSON.parse(localStorage.getItem("haatzaSeller"));
      return user?.sellerId || stored?.sellerId || stored?.data?.sellerId || localStorage.getItem("sellerId") || sessionStorage.getItem("sellerId") || "";
    } catch {
      return user?.sellerId || localStorage.getItem("sellerId") || sessionStorage.getItem("sellerId") || "";
    }
  }, [user]);

  // Show toast helper
  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Fetch return request details
  const fetchDetails = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await sellerService.fetchReturnDetails(tableId);
      if (response && response.status === "success") {
        const details = response.message || response.data || null;
        setSelectedReturn(details);
        
        // Populate tracking / awb details if present
        if (details?.trackingId || details?.waybill || details?.awb) {
          const tid = details.trackingId || details.waybill || details.awb || "";
          setTrackingId(tid);
          setAwbNumber(tid);
        }
      } else {
        setError("Return request not found.");
      }
    } catch (err) {
      console.error("Error loading return details:", err);
      setError("Failed to fetch return details. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tableId) {
      fetchDetails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId]);

  // Fetch estimates and open modal workflow
  const handleOpenApproveModal = async () => {
    if (!selectedReturn) return;

    const dPin = extractPincode(selectedReturn.customerAddress);
    const oPin = sellerService.getCachedSellerPinCode() || "110001";

    if (!dPin) {
      showToast("Unable to extract a valid 6-digit pincode from the delivery address.", "error");
      return;
    }

    setLoadingEstimates(true);
    setShippingCost(null);
    setTatDays(null);

    try {
      const weight = selectedReturn.weight || 500;
      
      const [costRes, tatRes] = await Promise.all([
        sellerService.getDeliveryAmount(oPin, dPin, weight),
        sellerService.expectedTat(oPin, dPin)
      ]);

      let cost = null;
      if (costRes && costRes.status === "success") {
        cost = costRes.amount || costRes.data?.amount || costRes.message?.amount || costRes.message || null;
      } else if (costRes) {
        cost = costRes.amount || costRes.data?.amount || costRes.message || null;
      }

      let tat = null;
      if (tatRes && tatRes.status === "success") {
        tat = tatRes.tat || tatRes.data?.tat || tatRes.expectedTat || tatRes.message?.expectedTat || tatRes.message || null;
      } else if (tatRes) {
        tat = tatRes.tat || tatRes.data?.tat || tatRes.expectedTat || tatRes.message || null;
      }

      // If either returned value is invalid, we notify user instead of failing silently or crashing
      if (cost === null || cost === undefined || isNaN(Number(cost))) {
        throw new Error("Could not retrieve valid shipping rates from Delhivery API.");
      }

      setShippingCost(Number(cost));
      setTatDays(tat || "3-5");
      setShowApproveModal(true);
    } catch (err) {
      console.error("Estimates prefetch failure handled gracefully:", err);
      showToast("Failed to fetch shipping estimates from Delhivery. Please try again.", "error");
    } finally {
      setLoadingEstimates(false);
    }
  };

  // Phase 5 – Create Exchange Shipment
  const handleCreateExchangeShipment = async () => {
    if (!sellerId) {
      showToast("Seller ID not found. Unable to create shipment.", "error");
      return;
    }
    if (!selectedReturn || !selectedReturn.exchangeOrderId) {
      showToast("Missing Exchange Order ID. Unable to create shipment.", "error");
      return;
    }

    setCreatingShipment(true);
    // Console log request as required by specs
    console.log("createExchangeShipment Request Initiated:", {
      sellerId,
      exchangeOrderId: selectedReturn.exchangeOrderId
    });

    try {
      const response = await sellerService.createExchangeShipment(
        sellerId,
        selectedReturn.exchangeOrderId
      );

      // Console log response
      console.log("createExchangeShipment Response Received:", response);

      if (response && (response.status === "success" || response.status === "Shipped")) {
        const data = response.message || response.data || {};
        const tid = data.trackingId || data.awb || "";
        
        setTrackingId(tid);
        setAwbNumber(tid);
        
        showToast("Exchange shipment created successfully!");
        setShowApproveModal(false);
        
        // Wait briefly and refetch return details to update UI
        setTimeout(() => {
          fetchDetails();
        }, 1000);
      } else {
        // Handle specific server error messages gracefully
        const errMsg = response?.message || "Delhivery exchange shipment failed";
        console.warn("Delhivery exchange shipment failed error handled gracefully:", errMsg);
        showToast("Exchange shipment creation failed", "error");
      }
    } catch (err) {
      console.error("Error creating exchange shipment:", err);
      showToast("Exchange shipment creation failed", "error");
    } finally {
      setCreatingShipment(false);
    }
  };

  // Phase 6 – Track Shipment
  const handleTrackShipment = async () => {
    const activeWaybill = trackingId || awbNumber || (selectedReturn?.trackingId);
    if (!activeWaybill) {
      showToast("Tracking ID / AWB not available for this shipment.", "error");
      return;
    }

    setLoadingTracking(true);
    setShowTrackModal(true);
    setTrackingDetails(null);
    try {
      const response = await sellerService.handleTrackShipment(activeWaybill);
      console.log("trackshipping Response:", response);
      setTrackingDetails(response);
    } catch (err) {
      console.error("Error tracking shipment:", err);
      showToast("Unable to fetch tracking history details.", "error");
    } finally {
      setLoadingTracking(false);
    }
  };

  // Phase 6 – Download Packing Slip
  const handleDownloadPackingSlip = () => {
    const activeWaybill = trackingId || awbNumber || (selectedReturn?.trackingId);
    if (!activeWaybill) {
      showToast("AWB Number not found. Packing slip unavailable.", "error");
      return;
    }
    
    try {
      sellerService.handleDownloadPackingSlip(activeWaybill);
      showToast("Opening packing slip PDF in new tab...");
    } catch (err) {
      console.error("Error downloading packing slip:", err);
      showToast("Failed to retrieve packing slip.", "error");
    }
  };

  // Reject Request handler placeholder
  const handleRejectReturn = () => {
    // TODO:
    // Integrate reject return API when backend is available
    console.log("handleRejectReturn Placeholder triggered for tableId:", tableId);
    showToast("Return request has been rejected successfully.");
    setShowRejectModal(false);
    
    // Simulate updating status in frontend UI since no backend exists
    if (selectedReturn) {
      setSelectedReturn({
        ...selectedReturn,
        status: "Rejected"
      });
    }
  };

  // Back button navigation
  const handleBack = () => {
    navigate("/returns");
  };

  const getStatusBadgeClass = (status = "") => {
    const s = status.toLowerCase();
    if (s.includes("requested")) {
      if (s.includes("exchange")) return "requested exchange";
      return "requested";
    }
    if (s.includes("approved")) return "approved";
    if (s.includes("rejected")) return "rejected";
    if (s.includes("shipped")) return "shipped";
    return "requested";
  };

  if (loading) {
    return (
      <div className="ret-container">
        <div className="ret-card ret-loading-box">
          <div className="ret-spinner ret-spinner-dark" />
          <p>Fetching detailed return info...</p>
        </div>
      </div>
    );
  }

  if (error || !selectedReturn) {
    return (
      <div className="ret-container">
        <div className="ret-card ret-empty-state">
          <div className="ret-empty-icon-wrap" style={{ color: "#EF4444", background: "rgba(239, 68, 68, 0.05)" }}>
            <AlertOctagon size={32} />
          </div>
          <h3>Failed to Load Request</h3>
          <p>{error || "No return details found for this request ID."}</p>
          <button className="ret-btn ret-btn-secondary" style={{ marginTop: "16px" }} onClick={handleBack}>
            <ArrowLeft size={16} /> Back to Returns
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ret-container">
      {/* Toast Alert */}
      {toast && (
        <div className={`ret-toast ${toast.type}`}>
          {toast.type === "success" ? <CheckCircle size={18} /> : <AlertOctagon size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header Panel */}
      <div className="ret-header ret-card" style={{ padding: "16px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button className="ret-btn ret-btn-secondary" onClick={handleBack} style={{ padding: "10px 16px", borderRadius: "12px" }}>
            <ArrowLeft size={16} />
          </button>
          <div>
            <span style={{ fontSize: 12, color: "#64748B", fontWeight: 700, textTransform: "uppercase" }}>Return Details</span>
            <h1 style={{ fontSize: 20, margin: 0, fontWeight: 700, color: "#0F172A" }}>Order #{selectedReturn.orderId}</h1>
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {loadingEstimates && <div className="ret-spinner ret-spinner-dark" style={{ width: "16px", height: "16px" }} />}
          <span className={`ret-badge ${getStatusBadgeClass(selectedReturn.status)}`}>
            {selectedReturn.status || "Return Requested"}
          </span>
        </div>
      </div>

      {/* Render modular ReturnDetails component */}
      <ReturnDetails item={selectedReturn} />



      {/* Modals */}
      <ExchangeShipmentModal 
        isOpen={showApproveModal}
        orderId={selectedReturn.orderId}
        loading={creatingShipment}
        shippingCost={shippingCost}
        expectedTat={tatDays}
        onClose={() => setShowApproveModal(false)}
        onConfirm={handleCreateExchangeShipment}
      />

      <RejectReturnModal 
        isOpen={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        onConfirm={handleRejectReturn}
      />

      <TrackShipmentModal 
        isOpen={showTrackModal}
        onClose={() => setShowTrackModal(false)}
        trackingId={trackingId || awbNumber}
        loading={loadingTracking}
        details={trackingDetails}
      />
    </div>
  );
};

export default ReturnDetailsPage;
