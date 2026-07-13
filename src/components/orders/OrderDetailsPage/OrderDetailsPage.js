import React, { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, CheckCircle2, XCircle, Truck, Info, CreditCard, User } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { fetchOrderDetails, updateOrdersstatus, getDeliveryAmount, expectedTat, createShipment, fetchPackingSlip, getCachedSellerPinCode, getCachedSellerId, cancelShipment } from "../../../services/sellerService";
import "../theme.css";
import "./OrderDetailsPage.css";

const formatOrderedDate = (dateString) => {
  if (!dateString) return "-";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  } catch {
    return dateString;
  }
};

const renderProductOption = (option) => {
  if (!option) return "-";
  if (typeof option === "object") {
    return option.Size || option.size || Object.values(option)[0] || "-";
  }
  return String(option);
};

const renderExpectedDelivery = (est) => {
  if (!est) return "-";
  if (/^\d+$/.test(String(est).trim())) {
    return `${est} days`;
  }
  try {
    const d = new Date(est);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString("en-GB", { day: 'numeric', month: 'short', year: 'numeric' });
    }
  } catch {}
  return est;
};

const OrderDetailsPage = () => {
  const { tableId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const fromTab = location.state?.fromTab;

  const handleBackToOrders = () => {
    navigate("/dashboard/orders", { state: { fromTab } });
  };

  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [orderStatus, setOrderStatus] = useState("");
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [showShipmentModal, setShowShipmentModal] = useState(false);
  const [shippingCost, setShippingCost] = useState(0);
  const [expectedDays, setExpectedDays] = useState(0);
  const [loadingShippingData, setLoadingShippingData] = useState(false);
  const [creatingShipment, setCreatingShipment] = useState(false);

  const [trackingId, setTrackingId] = useState("");
  const [trackerError, setTrackerError] = useState(false);
  const [resolvedSellerPin, setResolvedSellerPin] = useState("");
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  const [cancelling, setCancelling] = useState(false);
  const [slipLoading, setSlipLoading] = useState(false);
const [pdfDownloadLink, setPdfDownloadLink] = useState("");
const [showSlipPopup, setShowSlipPopup] = useState(false);


  const showToastMsg = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, show: false }));
    }, 3000);
  };

  const getCalculatedDeliveryDate = () => {
    if (!details) return "-";
    if (expectedDays && details.createdDate) {
      try {
        const date = new Date(details.createdDate);
        if (!isNaN(date.getTime())) {
          date.setDate(date.getDate() + Number(expectedDays));
          return date.toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric"
          });
        }
      } catch (err) {
        console.error("Error calculating delivery date:", err);
      }
    }
    return renderExpectedDelivery(details.estimatedDelivery);
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

  const sellerPinCode = getCachedSellerPinCode() || (() => {
    try {
      const storedProfile = JSON.parse(sessionStorage.getItem("sellerProfile") || "{}");
      return (
        storedProfile?.pincode ||
        storedProfile?.pinCode ||
        storedProfile?.sellerPinCode ||
        sessionStorage.getItem("__haatza_sellerPinCode") ||
        localStorage.getItem("__haatza_sellerPinCode") ||
        sessionStorage.getItem("sellerPinCode") ||
        localStorage.getItem("sellerPinCode") ||
        "636808"
      );
    } catch {
      return (
        sessionStorage.getItem("__haatza_sellerPinCode") ||
        localStorage.getItem("__haatza_sellerPinCode") ||
        sessionStorage.getItem("sellerPinCode") ||
        localStorage.getItem("sellerPinCode") ||
        "636808"
      );
    }
  })();


  const loadOrderDetails = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const response = await fetchOrderDetails(tableId);
      console.log("Order Details Response", response);
      
      const data = response?.message?.data || response?.data || response;
      if (data) {
        setDetails(data);
        setOrderStatus(data.status || "Order Placed");
        setTrackingId((data.trackingId || "").trim());
        setTrackerError(false);
        return data;
      }
    } catch (err) {
      console.error("Error fetching order details", err);
    } finally {
      if (showLoader) setLoading(false);
    }
  };
  useEffect(() => {
    if (!tableId) {
      navigate("/dashboard/orders");
      return;
    }
    loadOrderDetails(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId, navigate]);
  useEffect(() => {
    const email = sessionStorage.getItem("pendingEmail") || localStorage.getItem("userEmail") || "";
    if (!email) return;

    const getProfile = async () => {
      try {
        const res = await fetch(`https://www.haatzaseller.com/_functions/checkseller?email=${encodeURIComponent(email)}`);
        if (res.ok) {
          const data = await res.json();
          const sellerObj = data.message?.seller || data.message || {};
          const pin = sellerObj.pincode || sellerObj.pinCode || sellerObj.sellerPinCode || "";
          if (pin && /^\d{6}$/.test(String(pin).trim())) {
            const cleanPin = String(pin).trim();
            sessionStorage.setItem("__haatza_sellerPinCode", cleanPin);
            localStorage.setItem("__haatza_sellerPinCode", cleanPin);
            sessionStorage.setItem("sellerPinCode", cleanPin);
            localStorage.setItem("sellerPinCode", cleanPin);
            setResolvedSellerPin(cleanPin);
            console.log("[OrderDetailsPage] Self-healed sellerPinCode:", cleanPin);
          }
        }
      } catch (err) {
        console.warn("[OrderDetailsPage] Failed to fetch seller profile pincode:", err);
      }
    };
    getProfile();
  }, []);

  useEffect(() => {
    const dPin = String(details?.deliverpincode || details?.deliveryPincode || details?.deliveryPinCode || details?.toPincode || details?.pincode || "").trim();
    const weightVal = Math.min(parseFloat(details?.shippingWeight || details?.cgm || details?.weight) || 150, 5000);
    const pinToUse = resolvedSellerPin || sellerPinCode || "636808";

    if (dPin && pinToUse && pinToUse !== "000000") {
      console.log("[OrderDetailsPage:reactiveFetch] Fetching for pinCode:", pinToUse, "deliveryPinCode:", dPin, "weight:", weightVal);
      expectedTat(pinToUse, dPin)
        .then(res => {
          console.log("[OrderDetailsPage:reactiveFetch:expectedTat] Response:", res);
          const tatVal = res?.message?.tat?.data?.tat || res?.tat || res?.data?.tat || 3;
          setExpectedDays(tatVal);
        })
        .catch(err => {
          console.error("[OrderDetailsPage:reactiveFetch:expectedTat] Error:", err);
          setExpectedDays(3);
        });

      getDeliveryAmount(pinToUse, dPin, weightVal)
        .then(res => {
          console.log("[OrderDetailsPage:reactiveFetch:getDeliveryAmount] Response:", res);
          setShippingCost(res?.total_amount || 62);
        })
        .catch(err => {
          console.error("[OrderDetailsPage:reactiveFetch:getDeliveryAmount] Error:", err);
          setShippingCost(62);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedSellerPin, details]);

  const handleAcceptOrder = async () => {
    try {
      console.log(`[handleAcceptOrder] Call updateOrdersstatus for Order ID: ${details?.orderId}, Seller ID: ${sellerId}`);
      const res = await updateOrdersstatus(details?.orderId, sellerId, "Order Confirmed");
      console.log("[handleAcceptOrder] API Response:", res);
      
      showToastMsg("Order Confirmed Successfully!", "success");
      setShowAcceptModal(false);
      
      // Refetch order details and update UI immediately
      await loadOrderDetails(false);
    } catch (error) {
      console.error("[handleAcceptOrder] Error:", error);
      showToastMsg("Failed to accept order. Please try again.", "error");
    }
  };

  const handleCancelOrder = () => {
    setOrderStatus("Order Cancelled");
  };

  const fetchShippingCost = async () => {
    const dPin = String(details?.deliverpincode || details?.deliveryPincode || details?.deliveryPinCode || details?.toPincode || details?.pincode || "").trim();
    const weightVal = Math.min(parseFloat(details?.shippingWeight || details?.cgm || details?.weight) || 150, 5000);
    const pinToUse = resolvedSellerPin || sellerPinCode || "636808";
    console.log("[fetchShippingCost] Inputs:", { sellerPinCode: pinToUse, dPin, weightVal });
    if (!dPin) {
      console.warn("[fetchShippingCost] Empty delivery pincode, using fallback");
      return 62;
    }
    try {
      const res = await getDeliveryAmount(pinToUse, dPin, weightVal);
      console.log("[fetchShippingCost] API Response:", res);
      return res?.total_amount || 62;
    } catch (err) {
      console.error("[fetchShippingCost] Error, using fallback 62:", err);
      return 62;
    }
  };

  const fetchExpectedTat = async () => {
    const dPin = String(details?.deliverpincode || details?.deliveryPincode || details?.deliveryPinCode || details?.toPincode || details?.pincode || "").trim();
    const pinToUse = resolvedSellerPin || sellerPinCode || "636808";
    console.log("[fetchExpectedTat] Inputs:", { sellerPinCode: pinToUse, dPin });
    if (!dPin) {
      console.warn("[fetchExpectedTat] Empty delivery pincode, using fallback");
      return 3;
    }
    try {
      const res = await expectedTat(pinToUse, dPin);
      console.log("[fetchExpectedTat] API Response:", res);
      const tatVal = res?.message?.tat?.data?.tat || res?.tat || res?.data?.tat || 3;
      return tatVal;
    } catch (err) {
      console.error("[fetchExpectedTat] Error, using fallback 3:", err);
      return 3;
    }
  };

  const handleOpenShipmentModal = async () => {
    const dPin = String(details?.deliverpincode || details?.deliveryPincode || details?.deliveryPinCode || details?.toPincode || details?.pincode || "").trim();
    if (!dPin) {
      showToastMsg("Delivery pincode is missing for this order", "error");
      return;
    }
    setLoadingShippingData(true);
    try {
      console.log("[handleOpenShipmentModal] Fetching shipping details...");
      const [cost, tat] = await Promise.all([
        fetchShippingCost(),
        fetchExpectedTat()
      ]);
      setShippingCost(cost);
      setExpectedDays(tat);
      setShowShipmentModal(true);
    } catch (err) {
      console.error("[handleOpenShipmentModal] Error:", err);
      showToastMsg("Failed to load shipping details", "error");
    } finally {
      setLoadingShippingData(false);
    }
  };

  const handleCreateShipment = async () => {
    const dPin = String(details?.deliverpincode || details?.deliveryPincode || details?.deliveryPinCode || details?.toPincode || details?.pincode || "").trim();
    const weightVal = parseFloat(details?.shippingWeight || details?.cgm || details?.weight) || 0;
    const pinToUse = resolvedSellerPin || sellerPinCode || "";
    const customerPhone = String(details?.customerPhone || details?.phone || "").trim();
    const customerAddress = String(details?.customerAddress || details?.address || "").trim();
    const customerName = String(details?.customerName || details?.name || "").trim();
    const currentStatus = details?.status || orderStatus;

    // Console logs before createShipment
    console.log("Seller ID:", sellerId);
    console.log("Order Details:", details);
    
    const payloadForLog = {
      orderId: Number(details?.orderId),
      sellerId,
      OrderId: Number(details?.orderId),
      SellerId: sellerId,
      trackingId: "",
      tracking_id: "",
      waybill: "",
      awb: "",
      AWB: ""
    };
    console.log("Shipment Payload:", payloadForLog);

    // Validation checks
    if (!sellerId) {
      showToastMsg("Error: Invalid or missing Seller ID. Please log in again.", "error");
      return;
    }
    if (!details?.orderId) {
      showToastMsg("Error: Missing Order ID.", "error");
      return;
    }
    if (!customerPhone) {
      showToastMsg("Error: Missing Customer Phone Number.", "error");
      return;
    }
    if (!customerAddress) {
      showToastMsg("Error: Missing Customer Delivery Address.", "error");
      return;
    }
    if (!dPin) {
      showToastMsg("Error: Missing Customer Delivery Pincode.", "error");
      return;
    }
    if (!pinToUse) {
      showToastMsg("Error: Missing Seller Pickup Pincode.", "error");
      return;
    }
    if (weightVal <= 0) {
      showToastMsg("Error: Shipping weight must be greater than 0.", "error");
      return;
    }
    if (currentStatus !== "Order Confirmed") {
      showToastMsg(`Error: Shipment can only be created for 'Order Confirmed' status (current: ${currentStatus}).`, "error");
      return;
    }

    setCreatingShipment(true);
    console.log("[handleCreateShipment] Call createShipment for Order ID:", details?.orderId);
    
    try {
      const resolvedTrackingId = 
        details?.trackingId || 
        details?.tracking_id || 
        details?.waybill || 
        details?.awb || 
        details?.AWB || 
        "";
      const res = await createShipment(details?.orderId, sellerId, resolvedTrackingId);
      console.log("[handleCreateShipment] API Response:", res);

      const newAwb = String(
        res?.message?.body?.waybill ||
        res?.message?.trackingId ||
        res?.message?.awb ||
        res?.message?.waybill ||
        res?.trackingId ||
        res?.AWB ||
        res?.waybill ||
        res?.awb ||
        ""
      ).trim();

      if (newAwb) {
        setTrackingId(newAwb);
        showToastMsg("Shipment created successfully!", "success");
        setShowShipmentModal(false);

        // Do NOT call createShipment again here — only update status.
        try {
          await updateOrdersstatus(details?.orderId, sellerId, "Shipping Pickup Scheduled");
        } catch (statusErr) {
          console.error("[handleCreateShipment] Failed to update order status:", statusErr);
        }
        setOrderStatus("Shipping Pickup Scheduled");

        setSlipLoading(true);
        try {
          const slipRes = await fetchPackingSlip(newAwb);
          if (slipRes?.pdf_download_link) {
            setPdfDownloadLink(slipRes.pdf_download_link);
          } else {
            setPdfDownloadLink("");
            showToastMsg("Shipment created, but the packing slip isn't ready yet.", "error");
          }
        } catch (slipErr) {
          console.error("[handleCreateShipment] Packing slip fetch failed:", slipErr);
          setPdfDownloadLink("");
        } finally {
          setSlipLoading(false);
        }

        setShowSlipPopup(true);
        await loadOrderDetails(false);
      } else {
        const errMsg =
          (typeof res?.message === "string" && res.message) ||
          res?.message?.body?.message ||
          res?.message?.message ||
          res?.error ||
          "Delhivery shipment creation failed";
        console.warn("[handleCreateShipment] API did not return waybill:", errMsg);
        showToastMsg(`Error: ${errMsg}`, "error");
        setShowShipmentModal(false);
      }
    } catch (err) {
      console.error("[handleCreateShipment] Exception:", err);
      showToastMsg("Failed to create shipment. Please check the Orders list — it may have still succeeded.", "error");
      setShowShipmentModal(false);
    } finally {
      setCreatingShipment(false);
    }
  };

 const handleOpenPackageSlip = async () => {
    if (pdfDownloadLink) {
      setShowSlipPopup(true);
      return;
    }
    setSlipLoading(true);
    try {
      const res = await fetchPackingSlip(trackingId);
      if (res?.pdf_download_link) {
        setPdfDownloadLink(res.pdf_download_link);
        setShowSlipPopup(true);
      } else {
        showToastMsg("Package slip is not available yet. Please try again shortly.", "error");
      }
    } catch (err) {
      console.error("[handleOpenPackageSlip] Error:", err);
      showToastMsg("Failed to load package slip.", "error");
    } finally {
      setSlipLoading(false);
    }
  };

  const handleDownloadSlip = async () => {
    if (!pdfDownloadLink) {
      showToastMsg("Package slip link not available yet.", "error");
      return;
    }
    try {
      const response = await fetch(pdfDownloadLink);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `PackingSlip-${trackingId || details?.orderId || "order"}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("[handleDownloadSlip] Blob download failed, falling back to opening in browser:", err);
      window.open(pdfDownloadLink, "_blank");
      showToastMsg("Couldn't force download — opened the PDF instead.", "error");
    }
  };
  const handleTrackOrderClick = () => {
    const trimmedId = (trackingId || "").trim();
    if (trimmedId) {
      navigate(`/dashboard/orders/tracking/${trimmedId}`);
    } else {
      setTrackerError(true);
      showToastMsg("Tracking ID is not available.", "error");
    }
  };

  if (loading) {
    return (
      <div className="haatza-page order-details-page">
        <div className="order-details-skeleton">
          {[1, 2, 3].map((i) => (
            <div className="glass-card skeleton-block" key={i}>
              <div className="skeleton skeleton-line short" />
              <div className="skeleton skeleton-line medium" />
              <div className="skeleton skeleton-line medium" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!details) {
    return (
      <div className="haatza-page order-details-page">
        <div className="empty-state glass-card">
          <Info size={48} color="#2962FF" />
          <h3>Order Not Found</h3>
          <p>We couldn't load this order's details.</p>
          <button className="btn-primary" onClick={() => navigate("/dashboard/orders")}>
            <ArrowLeft size={16} />
            Back to Orders
          </button>
        </div>
      </div>
    );
  }

const isPlaced = orderStatus === "Order Placed";
  const isConfirmed = orderStatus === "Order Confirmed";
  const isPickupScheduled = orderStatus === "Shipping Pickup Scheduled";
  const isShipped = orderStatus === "Shipped" || isPickupScheduled;
  const isCancelled = orderStatus === "Order Cancelled";

  return (
    <div className="haatza-page order-details-page">
      
      {/* ─── DESKTOP HEADER ──────────────────────────────────────────────── */}
      <div className="desktop-only details-header-desktop">
        <button className="back-btn" onClick={handleBackToOrders}>
          <ArrowLeft size={18} />
          Back to Orders
        </button>
        <div className="order-title-section glass-card">
          <div>
            <h1>Order #{details.orderId}</h1>
            <p>Placed on {details.createdDate ? new Date(details.createdDate).toLocaleDateString() : "-"}</p>
          </div>
          <span className={`status-badge ${statusClassFor(orderStatus)}`}>{orderStatus}</span>
        </div>
      </div>

      {/* ─── MOBILE HEADER ───────────────────────────────────────────────── */}
      <div className="mobile-only details-header-mobile">
        <button className="mobile-back-btn" onClick={handleBackToOrders}>
          <ArrowLeft size={24} />
        </button>
      </div>

      {/* ─── DESKTOP VIEW LAYOUT ────────────────────────────────────────── */}
      <div className="desktop-only desktop-layout-container">
        <div className="desktop-details-grid">
          
          <Section title="Order Information" icon={Info}>
            <Row label="Order ID" value={details.orderId} />
            <Row label="Ordered Date" value={details.createdDate ? new Date(details.createdDate).toLocaleDateString() : "-"} />
            <Row label="Invoice Number" value={details.invoiceNumber || "-"} />
            <Row label="Order Status" value={orderStatus} />
          </Section>

          <Section title="Customer Details" icon={User}>
            <Row label="Customer Name" value={details.customerName || "-"} />
            <Row label="Customer Phone" value={details.customerPhone || "-"} />
            <Row label="Customer Address" value={details.customerAddress || "-"} />
            <Row label="Delivery Pincode" value={details.deliveryPincode || "-"} />
          </Section>

          <Section title="Product Information" icon={Truck}>
            <div className="desktop-product-card glass-card">
              <img src={details.productimage || "https://via.placeholder.com/80"} alt={details.items} />
              <div className="product-details-body">
                <h4>{details.items}</h4>
                <div className="product-details-meta">
                  <span><strong>Quantity:</strong> {details.quantity}</span>
                  <span><strong>Size:</strong> {renderProductOption(details.productOption)}</span>
                  <span><strong>Price:</strong> ₹{details.itemPrice}</span>
                </div>
              </div>
            </div>
          </Section>

          <Section title="Payment & Shipping" icon={CreditCard}>
            <Row label="Total Amount" value={`₹${details.totalAmount}`} />
            <Row label="Payment Status" value={details.paymentStatus || "-"} />
            <Row label="Expected Delivery" value={getCalculatedDeliveryDate()} />
            {isShipped && <Row label="Tracking ID" value={trackingId || "-"} />}
            {isShipped && trackingId && (
              <div className="barcode-container" style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', background: '#FAFBFF', padding: '12px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                <img 
                  src={`https://barcode.tec-it.com/barcode.ashx?data=${trackingId}&code=Code128`} 
                  alt={`Barcode for ${trackingId}`}
                  style={{ maxWidth: '100%', height: '55px' }}
                />
                <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-dark)' }}>{trackingId}</span>
              </div>
            )}
          </Section>

        </div>

        {/* Desktop Actions Footer */}
        <div className="desktop-actions-panel glass-card">
          {isPlaced && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
              <div className="actions-buttons-wrap">
                <button className="btn-primary" onClick={() => setShowAcceptModal(true)} disabled={cancelling}>Accept Order</button>
                <button className="btn-secondary btn-danger-outline" onClick={() => navigate(`/dashboard/orders/cancel/${tableId}`, { state: { fromTab } })} disabled={cancelling}>Cancel Order</button>
              </div>
              {!trackingId.trim() && trackerError && (
                <p className="tracker-error-msg" style={{ margin: 0 }}>Tracker is not available for this product</p>
              )}
            </div>
          )}
          {isConfirmed && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
              <div className="actions-buttons-wrap">
                <button 
                  className="btn-primary" 
                  onClick={handleOpenShipmentModal}
                  disabled={loadingShippingData || cancelling}
                >
                  {loadingShippingData ? (
                    <span className="spinner-btn-wrap">
                      <span className="loading-spinner-small"></span> Loading...
                    </span>
                  ) : "Create Shipment"}
                </button>
                <button className="btn-secondary btn-danger-outline" onClick={() => navigate(`/dashboard/orders/cancel/${tableId}`, { state: { fromTab } })} disabled={loadingShippingData || cancelling}>Cancel Order</button>
              </div>
              {!trackingId.trim() && trackerError && (
                <p className="tracker-error-msg" style={{ margin: 0 }}>Tracker is not available for this product</p>
              )}
            </div>
          )}
          {isShipped && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div className="actions-read-only green">
                  <CheckCircle2 size={20} />
                  <span>Shipment Status: <strong>Shipped</strong> {trackingId ? `| Tracking ID: ${trackingId}` : ""}</span>
                </div>
                {trackingId && (
                  <button 
                    className="btn-secondary" 
                    onClick={handleOpenPackageSlip}
                    disabled={slipLoading}
                  >
                    {slipLoading ? "Loading..." : "Package Slip"}
                  </button>
                )}
                <button
                  className="btn-secondary"
                  onClick={handleTrackOrderClick}
                >
                  Tracking ID
                </button>
              </div>
              {trackingId && (
                <div style={{ marginTop: '8px', background: '#FAFBFF', padding: '10px 16px', borderRadius: '10px', border: '1px solid #ECEFF5', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <img 
                    src={`https://barcode.tec-it.com/barcode.ashx?data=${trackingId}&code=Code128`} 
                    alt={`Barcode for ${trackingId}`}
                    style={{ height: '48px', maxWidth: '100%' }}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>{trackingId}</span>
                </div>
              )}
              {!trackingId.trim() && trackerError && (
                <p className="tracker-error-msg" style={{ margin: 0 }}>Tracking ID is not available.</p>
              )}
            </div>
          )}
          {isCancelled && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div className="actions-read-only red" style={{ margin: 0 }}>
                  <XCircle size={20} />
                  <span>Order Cancelled</span>
                </div>
                <button className="btn-primary" onClick={handleTrackOrderClick}>
                  Track Order
                </button>
              </div>
              {!trackingId.trim() && trackerError && (
                <p className="tracker-error-msg" style={{ margin: 0 }}>Tracker is not available for this product</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─── MOBILE VIEW LAYOUT ─────────────────────────────────────────── */}
      <div className="mobile-only mobile-layout-container">
        
        {/* Detail List Rows */}
        <div className="mobile-details-section">
          <div className="mobile-detail-row">
            <span className="label">Order ID :</span>
            <span className="value">{details.orderId}</span>
          </div>
          <div className="mobile-detail-row">
            <span className="label">Total Items :</span>
            <span className="value">{details.quantity}</span>
          </div>
          <div className="mobile-detail-row">
            <span className="label">Ordered Date :</span>
            <span className="value">{formatOrderedDate(details.createdDate)}</span>
          </div>
          <div className="mobile-detail-row">
            <span className="label">Expected Delivery :</span>
            <span className="value">{getCalculatedDeliveryDate()}</span>
          </div>
          <div className="mobile-detail-row">
            <span className="label">Total Amount :</span>
            <span className="value">₹{details.totalAmount}</span>
          </div>
          <div className="mobile-detail-row">
            <span className="label">Order Status :</span>
            <span className="value">{orderStatus}</span>
          </div>
          <div className="mobile-detail-row">
            <span className="label">Invoice :</span>
            <span className="value">{details.invoiceNumber || "-"}</span>
          </div>
          <div className="mobile-detail-row">
            <span className="label">Payment Status :</span>
            <span className="value">{details.paymentStatus || "-"}</span>
          </div>
          <div className="mobile-detail-row">
            <span className="label">Name :</span>
            <span className="value">{details.customerName || "-"}</span>
          </div>
          <div className="mobile-detail-row align-start">
            <span className="label">Address :</span>
            <span className="value address-text">{details.customerAddress || "-"}</span>
          </div>
        </div>

        {/* Mobile Product Card */}
        <div className="mobile-product-card-wrap">
          <div className="mobile-product-thumbnail-img">
            <img src={details.productimage || "https://via.placeholder.com/60"} alt={details.items} />
          </div>
          <div className="mobile-product-details">
            <p className="product-title-price">
              <span className="title">{details.items}</span>
              <span className="price">₹{details.itemPrice}</span>
            </p>
            <p className="product-quantity">Quantity : {details.quantity}</p>
            <p className="product-size">Size: {renderProductOption(details.productOption)}</p>
          </div>
        </div>


        {/* Mobile Action Buttons in flow */}
        <div className="mobile-actions-in-flow">
          {isPlaced && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
              <div className="mobile-actions-flex">
                <button className="mobile-btn-accept" onClick={() => setShowAcceptModal(true)} disabled={cancelling}>Accept Order</button>
                <button className="mobile-btn-cancel" onClick={() => navigate(`/dashboard/orders/cancel/${tableId}`, { state: { fromTab } })} disabled={cancelling}>Cancel Order</button>
              </div>
              {!trackingId.trim() && trackerError && (
                <p className="tracker-error-msg" style={{ textAlign: 'center', margin: 0 }}>Tracker is not available for this product</p>
              )}
            </div>
          )}
          {isConfirmed && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
              <div className="mobile-actions-flex">
                <button 
                  className="mobile-btn-accept" 
                  onClick={handleOpenShipmentModal}
                  disabled={loadingShippingData || cancelling}
                >
                  {loadingShippingData ? "Loading..." : "Create Shipment"}
                </button>
                <button className="mobile-btn-cancel" onClick={() => navigate(`/dashboard/orders/cancel/${tableId}`, { state: { fromTab } })} disabled={loadingShippingData || cancelling}>Cancel Order</button>
              </div>
              {!trackingId.trim() && trackerError && (
                <p className="tracker-error-msg" style={{ textAlign: 'center', margin: 0 }}>Tracker is not available for this product</p>
              )}
            </div>
          )}
          {isShipped && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
              <div className="mobile-actions-flex" style={{ gap: '12px', flexWrap: 'wrap' }}>
                <div className="mobile-actions-status shipped" style={{ flex: '1 1 100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '8px' }}>
                  <p className="status-title" style={{ margin: 0 }}>Shipped</p>
                  {trackingId && <p className="tracking-title" style={{ margin: 0 }}>ID: {trackingId}</p>}
                </div>
                {trackingId && (
                  <button 
                    className="mobile-btn-cancel" 
                    onClick={handleOpenPackageSlip}
                    disabled={slipLoading}
                    style={{ flex: 1, height: '48px', margin: 0, whiteSpace: 'nowrap', fontSize: '12px' }}
                  >
                    {slipLoading ? "Loading..." : "Package Slip"}
                  </button>
                )}
                <button
                  className="mobile-btn-cancel"
                  onClick={handleTrackOrderClick}
                  style={{ flex: 1, height: '48px', margin: 0, whiteSpace: 'nowrap', fontSize: '12px' }}
                >
                  Tracking ID
                </button>
              </div>
              {trackingId && (
                <div className="mobile-barcode-wrap" style={{ textAlign: 'center', marginTop: '8px', background: '#FAFBFF', padding: '10px', borderRadius: '8px', border: '1px solid #ECEFF5', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <img 
                    src={`https://barcode.tec-it.com/barcode.ashx?data=${trackingId}&code=Code128`} 
                    alt={`Barcode for ${trackingId}`}
                    style={{ maxHeight: '50px', maxWidth: '100%' }}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>{trackingId}</span>
                </div>
              )}
              {!trackingId.trim() && trackerError && (
                <p className="tracker-error-msg" style={{ textAlign: 'center', margin: 0 }}>Tracking ID is not available.</p>
              )}
            </div>
          )}
          {isCancelled && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
              <div className="mobile-actions-flex" style={{ gap: '12px' }}>
                <div className="mobile-actions-status cancelled" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <p className="status-title" style={{ margin: 0 }}>Order Cancelled</p>
                </div>
                <button 
                  className="mobile-btn-accept" 
                  onClick={handleTrackOrderClick}
                  style={{ flex: 1, height: '48px', margin: 0 }}
                >
                  Track Order
                </button>
              </div>
              {!trackingId.trim() && trackerError && (
                <p className="tracker-error-msg" style={{ textAlign: 'center', margin: 0 }}>Tracker is not available for this product</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─── CONFIRMATION MODALS (BOTTOM SHEET ANIMATED STYLE) ───────────── */}
      
      {/* Accept Order Modal */}
      {showAcceptModal && (
        <div className="modal-overlay">
          <div className="bottom-sheet-modal">
            <h3>Are you sure you want to accept this order?</h3>
            <p className="order-sheet-id">ID: {details.orderId}</p>
            <div className="sheet-modal-actions">
              <button className="btn-sheet-confirm" onClick={handleAcceptOrder}>Yes</button>
              <button className="btn-sheet-cancel" onClick={() => setShowAcceptModal(false)}>No</button>
            </div>
          </div>
        </div>
      )}

      {/* Create Shipment Modal */}
      {showShipmentModal && (
        <div className="modal-overlay">
          <div className="bottom-sheet-modal">
            <h3>Are you sure you want to ship by Haatza?</h3>
            <p className="sheet-desc">This will initiate the shipping process.</p>
            
            {shippingCost > 0 && (
              <p className="sheet-cost-info">Total shipping cost <strong>₹{shippingCost}</strong></p>
            )}
            
            <p className="sheet-delivery-info">
              Expected Delivery: <strong>{expectedDays} days</strong>
            </p>
            
            <div className="sheet-modal-actions">
              <button className="btn-sheet-confirm" onClick={handleCreateShipment} disabled={creatingShipment}>
                {creatingShipment ? "Processing..." : "Yes"}
              </button>
              <button className="btn-sheet-cancel" onClick={() => setShowShipmentModal(false)} disabled={creatingShipment}>No</button>
            </div>
          </div>
        </div>
      )}



      {/* Toast Notification */}
      {toast.show && (
        <div className={`haatza-toast ${toast.type}`}>
          <span>{toast.type === "success" ? "✓" : "❌"}</span>
          <span>{toast.message}</span>
        </div>
      )}

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
              ×
            </button>

            <h3 style={{ margin: "0 0 8px", fontSize: "18px", fontWeight: 800, color: "#1E293B" }}>
              Shipment Created Successfully
            </h3>
            <p style={{ margin: "0 0 4px", fontSize: "14px", color: "#475569" }}>
              Waybill Number: <strong>{trackingId}</strong>
            </p>
            <p style={{ margin: "0 0 20px", fontSize: "14px", color: "#16A34A", fontWeight: 600 }}>
              Package Slip Ready
            </p>

            <button
              onClick={handleDownloadSlip}
              style={{
                width: "100%", padding: "12px 16px", borderRadius: "10px", border: "none",
                background: "#2962FF", color: "#fff", fontWeight: 700, fontSize: "14px", cursor: "pointer"
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
const Section = ({ title, icon: Icon, children }) => (
  <div className="glass-card details-section">
    <div className="details-section-title">
      <Icon size={18} />
      <h3>{title}</h3>
    </div>
    <div className="details-section-body">{children}</div>
  </div>
);

const Row = ({ label, value }) => (
  <div className="details-row">
    <span className="details-label">{label}</span>
    <span className="details-value">{value}</span>
  </div>
);

const statusClassFor = (status) => {
  switch (status) {
    case "Order Confirmed":
      return "status-confirmed";
    case "Shipped":
      return "status-shipped";
    case "Order Cancelled":
      return "status-cancelled";
    default:
      return "status-pending";
  }
};

export default OrderDetailsPage;
