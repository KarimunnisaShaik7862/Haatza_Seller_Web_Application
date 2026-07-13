import React, { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Info, Clock, MapPin, Circle, PackageSearch, X, FileText } from "lucide-react";
import axios from "axios";
import { fetchPackingSlip } from "../../../services/sellerService";
import "../theme.css";
import "./TrackingPage.css";

const formatExpectedDelivery = (dateString) => {
  if (!dateString) return "Not Available";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  } catch {
    return dateString;
  }
};

const formatScanTime = (dateTimeStr) => {
  if (!dateTimeStr) return "";
  try {
    const d = new Date(dateTimeStr);
    if (isNaN(d.getTime())) return dateTimeStr;
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    });
  } catch {
    return dateTimeStr;
  }
};
const formatScanDate = (dateTimeStr) => {
  if (!dateTimeStr) return "";
  try {
    const d = new Date(dateTimeStr);
    if (isNaN(d.getTime())) return dateTimeStr;
    const dateStr = d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
    const weekdayStr = d.toLocaleDateString("en-US", { weekday: "short" });
    return `${dateStr} (${weekdayStr})`;
  } catch {
    return dateTimeStr;
  }
};

const TrackingPage = () => {
  const { waybill } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [trackingData, setTrackingData] = useState(null);

 const [showSlipPopup, setShowSlipPopup] = useState(false);
  const [pdfDownloadLink, setPdfDownloadLink] = useState(location.state?.pdfDownloadLink || "");
  const [slipLoading, setSlipLoading] = useState(false);
  const [slipError, setSlipError] = useState("");
  // Button stays hidden until the popup has been shown & closed once
  // (or immediately visible if the user didn't arrive via a fresh shipment creation)
  const [slipButtonVisible, setSlipButtonVisible] = useState(!location.state?.shipmentJustCreated);

  const closeSlipPopup = () => {
    setShowSlipPopup(false);
    setSlipButtonVisible(true);
  };
  const fetchTrackingDetails = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `https://haatza.com/_functions/trackshipping?waybill=${waybill}`
      );

      console.log(
        "Tracking Details Response",
        response.data
      );

      setTrackingData(response.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrackingDetails();
  }, []);

  useEffect(() => {
    if (!loading && location.state?.shipmentJustCreated) {
      setShowSlipPopup(true);
      // Clear the flag so a manual refresh or back/forward doesn't reopen the popup
      window.history.replaceState({}, document.title);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const handleOpenPackageSlip = async () => {
    if (pdfDownloadLink) {
      setSlipError("");
      setShowSlipPopup(true);
      return;
    }
    setSlipLoading(true);
    try {
      const res = await fetchPackingSlip(waybill);
      if (res?.pdf_download_link) {
        setPdfDownloadLink(res.pdf_download_link);
        setSlipError("");
      } else {
        setSlipError("Packing slip is not available yet. Please try again shortly.");
      }
      setShowSlipPopup(true);
    } catch (err) {
      console.error("[TrackingPage] Failed to fetch packing slip:", err);
      setSlipError("Failed to load packing slip. Please try again.");
      setShowSlipPopup(true);
    } finally {
      setSlipLoading(false);
    }
  };

  const handleDownloadSlip = async () => {
    if (!pdfDownloadLink) {
      console.error("[TrackingPage] No pdf_download_link available.");
      setSlipError("Packing slip link is not available yet.");
      return;
    }
    try {
      const response = await fetch(pdfDownloadLink);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `PackingSlip-${waybill}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("[TrackingPage] Blob download failed, falling back to opening in browser:", err);
      window.open(pdfDownloadLink, "_blank");
      setSlipError("Couldn't force download — opened the PDF instead.");
    }
  };

  const handleBack = () => {
    navigate(-1);
  };

  // Extract shipment object from dynamic response mapping
  const shipment = trackingData?.message?.result?.data?.ShipmentData?.[0]?.Shipment;

  // Sorting scans: show latest event first
  const scans = shipment?.Scans || [];
  const sortedScans = [...scans].sort(
    (a, b) =>
      new Date(b.ScanDetail.ScanDateTime) -
      new Date(a.ScanDetail.ScanDateTime)
  );

  // Expected Delivery format
  // Expected Delivery format
  const expectedDeliveryText = shipment?.ExpectedDeliveryDate
    ? formatExpectedDelivery(shipment.ExpectedDeliveryDate)
    : "Not Available";

  // Detect a cancelled shipment from its scan history (e.g. "Seller cancelled the order").
  // Package Slip should never be offered for a cancelled shipment.
  const isCancelledShipment = sortedScans.some((scan) =>
    /cancel/i.test(scan?.ScanDetail?.Instructions || "")
  );

  // Loading skeleton state
  if (loading) {
    return (
      <div className="haatza-page tracking-page">
        <div className="tracking-container">
          <div className="tracking-header-wrap">
            <div className="skeleton-button skeleton" />
            <div className="skeleton-title skeleton" />
          </div>
          <div className="glass-card skeleton-card">
            <div className="skeleton skeleton-text short" />
            <div className="skeleton skeleton-text medium" />
          </div>
          <div className="skeleton-info-banner skeleton" />
          <div className="glass-card skeleton-card">
            <div className="skeleton skeleton-text short" />
            <div className="skeleton skeleton-text medium" />
          </div>
          <div className="glass-card timeline-card">
            {[1, 2, 3].map((i) => (
              <div className="skeleton-timeline-item" key={i}>
                <div className="skeleton skeleton-time" />
                <div className="skeleton-dot-wrapper">
                  <div className="skeleton-dot" />
                  {i < 3 && <div className="skeleton-line" />}
                </div>
                <div className="skeleton-details">
                  <div className="skeleton skeleton-status" />
                  <div className="skeleton skeleton-location" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Empty/Error state
  if (!shipment || sortedScans.length === 0) {
    return (
      <div className="haatza-page tracking-page">
        <div className="tracking-container">
          <div className="tracking-header-wrap">
            <button className="back-button-circle" onClick={handleBack}>
              <ArrowLeft size={20} />
            </button>
            <h1 className="tracking-main-title">Order Tracking</h1>
          </div>

          <div className="empty-state glass-card tracking-empty-card">
            <div className="empty-state-icon-wrap">
              <PackageSearch size={56} />
            </div>
            <h3>Tracking Information Not Available</h3>
            <p>We couldn't retrieve tracking information for waybill #{waybill}.</p>
            <button className="back-to-orders-btn" onClick={() => navigate("/dashboard/orders")}>
              Back to Orders
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="haatza-page tracking-page">
      <div className="tracking-container">
        
        {/* Header */}
        <div className="tracking-header-wrap">
          <button className="back-button-circle" onClick={handleBack}>
            <ArrowLeft size={20} />
          </button>
          <h1 className="tracking-main-title">Order Tracking</h1>
          {waybill && slipButtonVisible && !isCancelledShipment && (
            <button
              className="back-button-circle"
              style={{ marginLeft: "auto", width: "auto", padding: "0 14px", display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: 600 }}
              onClick={handleOpenPackageSlip}
              disabled={slipLoading}
            >
              <FileText size={16} />
              {slipLoading ? "Loading..." : "Download Package Slip"}
            </button>
          )}
        </div>

        {/* Top Summary Card */}
        <div className="glass-card tracking-top-card">
          <span className="carrier-badge">Delivery by Haatza</span>
          <span className="tracking-id-text">Tracking ID: {shipment.AWB}</span>
        </div>

        {/* Info Message */}
        <div className="tracking-info-banner">
          <Info size={18} className="info-icon" />
          <span className="info-text">
            This is the latest tracking information available for your order.
          </span>
        </div>

        {/* Expected Delivery Date Card */}
        <div className="glass-card expected-delivery-card">
          <div className="expected-label">Expected Delivery Date</div>
          <div className="expected-date">{expectedDeliveryText}</div>
        </div>

        {/* Timeline Card */}
        <div className="glass-card timeline-card">
          <div className="timeline-container">
            {sortedScans.map((scan, index) => {
              const isActive = index === 0; // The latest event has the active styling
              return (
                <div className="timeline-item" key={index}>
                  
                  {/* Time Column on Left */}
                  <div className="timeline-time-col">
                    <span className="time-text-wrap">
                      <Clock size={12} className="timeline-icon-small" />
                      {formatScanTime(scan.ScanDetail.ScanDateTime)}
                    </span>
                    <span className="date-text-wrap">
                      {formatScanDate(scan.ScanDetail.ScanDateTime)}
                    </span>
                  </div>

                  {/* Indicator Column */}
                  <div className="timeline-indicator-col">
                    {isActive ? (
                      <div className="timeline-dot active" />
                    ) : (
                      <Circle size={10} className="timeline-circle-icon" />
                    )}
                    {index < sortedScans.length - 1 && (
                      <div className="timeline-connector-line" />
                    )}
                  </div>

                  {/* Details Column on Right */}
                  <div className="timeline-details-col">
                    <div className="status-text">{scan.ScanDetail.Instructions}</div>
                    <div className="location-text">
                      <MapPin size={12} className="timeline-icon-small" />
                      {scan.ScanDetail.ScannedLocation}
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Package Slip Popup */}
      {showSlipPopup && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: "16px"
          }}
          onClick={() => setShowSlipPopup(false)}
        >
          <div
            style={{
              background: "#fff", borderRadius: "16px", padding: "28px",
              maxWidth: "380px", width: "100%", position: "relative",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowSlipPopup(false)}
              style={{
                position: "absolute", top: "14px", right: "14px", background: "transparent",
                border: "none", cursor: "pointer", color: "#64748B", padding: "4px"
              }}
              aria-label="Close"
            >
              <X size={20} />
            </button>

            <h3 style={{ margin: "0 0 8px", fontSize: "18px", fontWeight: 800, color: "#1E293B" }}>
              Shipment Created Successfully
            </h3>
            <p style={{ margin: "0 0 4px", fontSize: "14px", color: "#475569" }}>
              Waybill Number: <strong>{waybill}</strong>
            </p>
            {pdfDownloadLink ? (
              <p style={{ margin: "0 0 20px", fontSize: "14px", color: "#16A34A", fontWeight: 600 }}>
                Package Slip Ready
              </p>
            ) : (
              <p style={{ margin: "0 0 20px", fontSize: "14px", color: "#DC2626", fontWeight: 600 }}>
                {slipError || "Packing slip not available yet."}
              </p>
            )}

            <button
              onClick={handleDownloadSlip}
              disabled={!pdfDownloadLink}
              style={{
                width: "100%", padding: "12px 16px", borderRadius: "10px", border: "none",
                background: pdfDownloadLink ? "#2962FF" : "#94A3B8", color: "#fff", fontWeight: 700,
                fontSize: "14px", cursor: pdfDownloadLink ? "pointer" : "not-allowed"
              }}
            >
              Download Package Slip
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrackingPage;