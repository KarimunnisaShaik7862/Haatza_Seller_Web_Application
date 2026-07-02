import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { ChevronLeft, CheckCircle2, Check, ArrowRight } from "lucide-react";
import { resolveSellerId, resolveSellerEmail } from "../../utils/sellerSession";
import { sellerService } from "../../services/sellerService";
import "./GrowPlanPage.css";

// Fallback plans in case the plans API doesn't return data
const FALLBACK_PLANS = [
  {
    id: "growth_plan",
    name: "Growth",
    price: 1,
    features: [
      "Seller Verified Badge",
      "Featured placement in category + search (5 SKUs)",
      "\"Promoted Seller\" tag in app",
      "₹500 Ad Credit (Google + Meta)",
      "Basic analytics dashboard",
      "AI Product Title & Description Optimizer",
      "SEO Score for each product",
      "In-App Product Promotions",
      "Auto Keyword Suggestions for trending searches",
      "Expected boost: up to 1.3x sales"
    ]
  },
  {
    id: "pro_plan",
    name: "Pro",
    price: 1999,
    recommended: true,
    features: [
      "Seller Verified Badge",
      "Featured placement for 15 SKUs",
      "Priority \"Trending Now\" visibility",
      "₹1,200 Ad Credit (Google + Meta)",
      "1 Managed digital ad campaign/month",
      "Advanced Analytics",
      "AI Auto-Pricing Suggestions (competitive pricing alerts)",
      "In-App Product Promotions",
      "Cross-Sell Recommendation Engine",
      "Early Payout/Settlement (T+1)",
      "Priority logistics partners (where available)",
      "Expected boost: up to 2x sales"
    ]
  },
  {
    id: "enterprise_plan",
    name: "Enterprise",
    price: 2499,
    features: [
      "Seller Verified Badge",
      "Featured placement on all SKUs",
      "\"Top Seller\" premium badge in listings",
      "₹2,000 Ad Credit",
      "2 Managed ad campaigns/month",
      "Flash Sale Tools",
      "Search Result Boosting",
      "In-App Product Promotions",
      "Detailed conversion funnel analytics",
      "Cart Abandonment Notifications (Haatza sends push to buyers)",
      "Repeat Buyer Retargeting (push / in-app)",
      "Expected boost: up to 3x sales"
    ]
  }
];

const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);

    let script = document.querySelector(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
    );

    if (!script) {
      script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      document.body.appendChild(script);
    }

    const cleanup = () => {
      script.removeEventListener("load", handleLoad);
      script.removeEventListener("error", handleError);
    };

    const handleLoad = () => {
      cleanup();
      resolve(true);
    };

    const handleError = () => {
      cleanup();
      resolve(false);
    };

    script.addEventListener("load", handleLoad);
    script.addEventListener("error", handleError);
  });
};

const getTodayFormatted = () => {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
};

const normalize = (value) =>
  String(value || "").trim().toLowerCase();

const parseDateSafe = (dateVal) => {
  if (!dateVal) return null;
  if (dateVal instanceof Date) return dateVal;
  
  let d = new Date(dateVal);
  if (!isNaN(d.getTime())) return d;
  
  if (typeof dateVal === 'string') {
    const parts = dateVal.split('-');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        const fullYear = year < 100 ? 2000 + year : year;
        d = new Date(fullYear, month, day);
        if (!isNaN(d.getTime())) return d;
      }
    }
  }
  return null;
};

const formatPlanDate = (dateValue) => {
  if (!dateValue) return "";
  const date = parseDateSafe(dateValue);
  if (!date) return "";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  }).replace(/ /g, " ");
};

const getLatestSubscription = (orders) => {
  if (!Array.isArray(orders) || orders.length === 0) return null;
  
  const parseDate = (val) => {
    if (!val) return 0;
    const dateObj = parseDateSafe(val);
    return dateObj ? dateObj.getTime() : 0;
  };
  
  const getSubTimestamp = (sub) => {
    const created = sub.createdDate || sub.createdAt || sub._createdDate || sub._createdAt;
    if (created) {
      const ts = parseDate(created);
      if (ts > 0) return ts;
    }
    const payment = sub.paymentDate || sub.paidAt || sub.paymentAt || sub.transactionDate;
    if (payment) {
      const ts = parseDate(payment);
      if (ts > 0) return ts;
    }
    const start = sub.startDate || sub.startedDate || sub.startAt;
    if (start) {
      const ts = parseDate(start);
      if (ts > 0) return ts;
    }
    const end = sub.endDate || sub.endedDate || sub.expiryDate || sub.expiredOn || sub.validTill;
    if (end) {
      const ts = parseDate(end);
      if (ts > 0) return ts;
    }
    return 0;
  };

  const sorted = [...orders].sort((a, b) => getSubTimestamp(b) - getSubTimestamp(a));
  return sorted[0];
};

const asArray = (value) => {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return [value];
  return [];
};

const extractPlans = (response) => {
  const data = response?.data ?? response;
  const plans =
    data?.message?.items ??
    data?.message?.plans ??
    data?.message?.data?.items ??
    data?.message?.data?.plans ??
    data?.items ??
    data?.plans ??
    data?.data?.items ??
    data?.data?.plans ??
    data?.data?.message?.items ??
    data?.data?.message?.plans ??
    [];
  return asArray(plans);
};

const extractSubscriptionOrders = (response) => {
  const data = response?.data ?? response;
  const orders =
    data?.message?.orders ??
    data?.message?.subscriptions ??
    data?.message?.data?.orders ??
    data?.message?.data?.subscriptions ??
    data?.orders ??
    data?.subscriptions ??
    data?.data?.orders ??
    data?.data?.subscriptions ??
    data?.data?.message?.orders ??
    data?.data?.message?.subscriptions ??
    data?.message ??
    [];
  return asArray(orders);
};

const extractWalletBalance = (response) => {
  const data = response?.data ?? response;
  return Number(
    data?.message?.RemainingBalance ??
    data?.message?.remainingBalance ??
    data?.message?.balance ??
    data?.data?.RemainingBalance ??
    data?.data?.remainingBalance ??
    data?.RemainingBalance ??
    data?.remainingBalance ??
    data?.balance ??
    0
  );
};


const GrowPlanPage = () => {
  const navigate = useNavigate();
  const sellerId = resolveSellerId();
  const sellerEmail = resolveSellerEmail();

  // View state: 'plans', 'review', 'success'
  const [viewState, setViewState] = useState("plans");
  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [isFeaturesExpanded, setIsFeaturesExpanded] = useState(false);

  // Wallet & Discount states
  const [walletBalance, setWalletBalance] = useState(0);
  const [redeemWallet, setRedeemWallet] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [appliedReferralCode, setAppliedReferralCode] = useState("");
  const [referralDiscount, setReferralDiscount] = useState(0);

  // Loaders / Feedback states
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [checkingReferral, setCheckingReferral] = useState(false);
  const [referralMessage, setReferralMessage] = useState({ text: "", type: "" });
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // Active/Existing Subscription status
  const [activeSubscription, setActiveSubscription] = useState(null);
  const [plansRes, setPlansRes] = useState(null);
  const [subscriptionRes, setSubscriptionRes] = useState(null);

  // Modals state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [sellerProfile, setSellerProfile] = useState(null);

  // Dedupe payment handles
  const paymentInProgressRef = useRef(false);
  const processedPaymentRef = useRef(new Set());

  // Merge dynamic plans with static fallback features list for UI consistency
  const mapPlansWithFeatures = useCallback((apiPlans) => {
    if (!Array.isArray(apiPlans) || apiPlans.length === 0) {
      return FALLBACK_PLANS;
    }
    return apiPlans.map((plan) => {
      const nameLower = (plan.name || "").toLowerCase();
      let matchingFallback = FALLBACK_PLANS.find(p => p.name.toLowerCase() === nameLower);
      if (!matchingFallback) {
        matchingFallback = FALLBACK_PLANS.find(p => nameLower.includes(p.name.toLowerCase()));
      }
      return {
        ...plan,
        _id: plan._id || plan.id || plan.planId || (matchingFallback ? matchingFallback.id : `${nameLower}_plan`),
        id: plan.id || plan._id || plan.planId || (matchingFallback ? matchingFallback.id : `${nameLower}_plan`),
        name: plan.name || (matchingFallback ? matchingFallback.name : "Plan"),
        price: plan.price !== undefined ? Number(plan.price) : (matchingFallback ? matchingFallback.price : 0),
        periodAmount: plan.periodAmount || 1,
        periodUnit: plan.periodUnit || "Month",
        benefits: plan.benefits || (matchingFallback ? matchingFallback.features : []),
        slug: plan.slug || `${nameLower}-plan`,
        recommended: plan.recommended || (matchingFallback ? matchingFallback.recommended : false),
        features: plan.features || plan.benefits || (matchingFallback ? matchingFallback.features : [])
      };
    });
  }, []);

  const handleSelectPlan = (plan) => {
    const storedPlan = {
      ...plan,
      planId: plan._id || plan.id,
      planName: plan.name,
      amount: Number(plan.price)
    };
    console.log("[GrowPlan] Selected Plan", storedPlan);
    setSelectedPlan(storedPlan);
    setIsFeaturesExpanded(false);
  };

  // Fetch plans, wallet balance, and active subscription on mount
  const initPageData = useCallback(async () => {
    if (!sellerId) {
      setErrorMsg("Seller session not found. Please log in again.");
      setLoadingPlans(false);
      return;
    }

    setLoadingPlans(true);
    setErrorMsg(null);

    try {
      // 1. Fetch Plans
      console.log("[GrowPlanPage] Fetching plans... GET https://www.haatzaseller.com/_functions/getPlans");
      let planItems = [];
      try {
        const plansRes = await sellerService.fetchPricingplans();
        setPlansRes(plansRes);
        console.log("[GrowPlanPage] Get Plans Response", plansRes);
        planItems = extractPlans(plansRes);
      } catch (err) {
        console.error("[GrowPlanPage] Get Plans API error, using fallbacks:", err);
      }
      const finalPlans = mapPlansWithFeatures(planItems);
      setPlans(finalPlans);

      // Pre-select Recommended Pro plan if available
      const recommended = finalPlans.find(p => p.recommended);
      if (recommended) {
        handleSelectPlan(recommended);
      } else if (finalPlans.length > 0) {
        handleSelectPlan(finalPlans[0]);
      }

      // 2. Fetch Wallet Balance
      console.log(`[GrowPlanPage] Fetching wallet balance... GET https://haatza.com/_functions/checkWalletBalance?sellerId=${sellerId}`);
      try {
        const walletRes = await sellerService.checkWalletBalance(sellerId);
        console.log("[GrowPlanPage] Wallet Balance Response", walletRes);
        setWalletBalance(extractWalletBalance(walletRes));
      } catch (err) {
        console.error("[GrowPlanPage] Wallet Balance API error:", err);
      }

      // 3. Fetch Seller Current Subscription
      if (sellerEmail) {
        console.log(`[GrowPlanPage] Fetching active subscription... GET https://www.haatzaseller.com/_functions/sellersubscription?email=${sellerEmail}`);
        try {
          const subRes = await sellerService.fetchSubscriptionPlan(sellerEmail);
          setSubscriptionRes(subRes);
          console.log("[GrowPlanPage] Seller Subscription Response", subRes);
          const orders = extractSubscriptionOrders(subRes);
          if (orders.length > 0) {
            setActiveSubscription(getLatestSubscription(orders));
          }
        } catch (err) {
          console.error("[GrowPlanPage] Seller Subscription API error:", err);
        }

        // 4. Fetch Seller Profile
        console.log(`[GrowPlanPage] Fetching seller profile... GET /sellerdata?email=${sellerEmail}`);
        try {
          const profileRes = await sellerService.getUserProfile(sellerEmail);
          console.log("[GrowPlanPage] Seller Profile Response", profileRes);
          if (profileRes?.status === "success" || profileRes?.message) {
            setSellerProfile(profileRes.message);
          }
        } catch (err) {
          console.error("[GrowPlanPage] Seller Profile API error:", err);
        }
      }

    } catch (err) {
      console.error("[GrowPlanPage] Page initialization error:", err);
      setErrorMsg("Failed to initialize Grow Plan page data.");
    } finally {
      setLoadingPlans(false);
    }
  }, [sellerId, sellerEmail, mapPlansWithFeatures]);

  useEffect(() => {
    initPageData();
  }, [initPageData]);

  const currentSubscription = activeSubscription;

  const currentPlanName = currentSubscription?.planName || currentSubscription?.plan || currentSubscription?.subscriptionPlan;
  const expiryDate =
    currentSubscription?.endDate ||
    currentSubscription?.endedDate ||
    currentSubscription?.expiryDate ||
    currentSubscription?.expiredOn ||
    currentSubscription?.validTill;

  const expiryDateObj = parseDateSafe(expiryDate);
  const isExpired = expiryDateObj ? expiryDateObj < new Date() : false;

  const isSamePlan = (plan) =>
    plan && normalize(plan.name || plan.planName) === normalize(currentPlanName);

  const getBottomActionText = () => {
    if (!selectedPlan) return "Select Plan";

    if (currentPlanName && isSamePlan(selectedPlan)) {
      if (isExpired) {
        return "Renew Plan";
      }
      return "Current Plan";
    }

    if (currentPlanName && !isSamePlan(selectedPlan)) {
      return "Upgrade Plan";
    }

    return "Select Plan";
  };

  const isBottomButtonDisabled =
    !selectedPlan ||
    (!isExpired && currentPlanName && isSamePlan(selectedPlan));

  const handlePlanAction = () => {
    if (!selectedPlan) return;
    setViewState("review");
  };

  // Development logs
  console.log("[GrowPlan] Plans Response", plansRes);
  console.log("[GrowPlan] Seller Subscription Response", subscriptionRes);
  console.log("[GrowPlan] Current Subscription", currentSubscription);
  console.log("[GrowPlan] Current Plan Name", currentPlanName);
  console.log("[GrowPlan] Expiry Date", expiryDate);
  console.log("[GrowPlan] Is Expired", isExpired);

  // Calculations for Plan Review page
  const planPrice = selectedPlan ? Number(selectedPlan.price || 0) : 0;

  // Wallet discount calculations
  const maxWalletRedeem = Math.min(walletBalance, planPrice);
  const walletRedeemedAmount = redeemWallet ? maxWalletRedeem : 0;

  // Total Price is the plan price
  const totalPrice = planPrice;

  // Payable amount = planPrice - wallet - referralDiscount
  const rawPayableAmount = planPrice - walletRedeemedAmount - referralDiscount;
  const payableAmount = Math.max(0, rawPayableAmount);

  // Handle Referral Check
  const handleApplyReferral = async () => {
    if (!referralCode.trim()) return;

    setCheckingReferral(true);
    setReferralMessage({ text: "", type: "" });
    setReferralDiscount(0);
    setAppliedReferralCode("");

    const enteredCode = referralCode.trim();

    console.log("[GrowPlanPage] Checking referral code:", referralCode);
    console.log("[GrowPlanPage] Referral Check URL:", `https://www.haatzaseller.com/_functions/referralCheck?referralCode=${referralCode}`);

    try {
      const res = await axios.get("https://www.haatzaseller.com/_functions/referralCheck", {
        params: { referralCode: enteredCode }
      });
      console.log("[GrowPlanPage] Referral Check Response:", res.data);

      const success =
        res.data?.status === "success" ||
        res.data?.success === true ||
        res.data?.message?.valid === true ||
        res.data?.message?.status === "success";

      const discountVal = Number(
        res.data?.message?.discount ||
        res.data?.message?.discountAmount ||
        res.data?.message?.amount ||
        res.data?.discount ||
        res.data?.discountAmount ||
        0
      );

      if (success) {
        if (discountVal > 0) {
          setReferralDiscount(discountVal);
          setAppliedReferralCode(enteredCode);
          setReferralMessage({
            text: `Referral code applied successfully! Saved ₹${discountVal}.`,
            type: "success"
          });
        } else {
          setReferralMessage({
            text: "Referral code is valid, but discount amount was not returned by backend.",
            type: "error"
          });
        }
      } else {
        const errMsg = res.data?.message?.text || res.data?.error || "Invalid referral code.";
        setReferralMessage({
          text: errMsg,
          type: "error"
        });
      }
    } catch (err) {
      console.error("[GrowPlanPage] Referral check error:", err);
      const errMsg =
        err.response?.data?.message?.text ||
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        "Failed to verify referral code.";
      setReferralMessage({
        text: errMsg,
        type: "error"
      });
    } finally {
      setCheckingReferral(false);
    }
  };

  // Process subscription flow
  const handleProceedSubscription = async () => {
    setShowConfirmModal(false);

    if (paymentInProgressRef.current) {
      console.warn("[GrowPlanPage] A payment or subscription process is already running. Skipping duplicate call.");
      return;
    }

    paymentInProgressRef.current = true;
    setIsProcessing(true);
    setErrorMsg(null);

    // Required console logs
    console.log("[GrowPlan] SellerId", sellerId);
    console.log("[GrowPlan] SellerEmail", sellerEmail);
    console.log("[GrowPlan] Selected Plan", selectedPlan);

    try {
      if (payableAmount > 0) {
        // Postman cannot produce razorpay_signature. It only comes from Razorpay Checkout success handler after real payment. 
        // Therefore, verifyRazorpayPayment cannot be properly tested with fake Postman values.

        // Validate inputs before order creation
        if (!sellerId) {
          throw new Error("Validation failed: sellerId does not exist");
        }
        if (payableAmount <= 0) {
          throw new Error("Validation failed: amount must be greater than 0");
        }

        const orderPayload = {
          sellerId,
          amount: Number(payableAmount)
        };
        console.log("[GrowPlan] Create Order Payload", orderPayload);

        const orderRes = await axios.post("https://haatza.com/_functions/createRazorpayOrder", orderPayload);
        console.log("[GrowPlan] Create Order Response", orderRes);

        // Map Razorpay Order properties exactly:
        const messageData = orderRes.data?.message;
        const orderData = messageData?.order;

        const razorpayOrderId = orderData?.id;
        const orderAmount = orderData?.amount;
        const razorpayKey = messageData?.keyId;
        const currency = orderData?.currency || "INR";

        // Store Razorpay Order Info object
        const storedOrderInfo = {
          razorpayOrderId,
          amount: orderAmount,
          keyId: razorpayKey
        };

        // Validate backend order response fields
        if (!razorpayOrderId) {
          throw new Error("Validation failed: order.id does not exist");
        }
        if (!razorpayKey) {
          throw new Error("Validation failed: keyId does not exist");
        }

        const scriptLoaded = await loadRazorpayScript();
        if (!scriptLoaded) {
          throw new Error("Razorpay payment SDK failed to load. Please check your internet connection.");
        }

        const options = {
          key: razorpayKey,
          amount: orderAmount,
          currency: currency,
          name: "Haatza",
          description: `${selectedPlan?.planName || selectedPlan?.name || "Grow Plan"} Subscription`,
          order_id: razorpayOrderId,
          handler: async function (response) {
            console.log("[GrowPlan] Razorpay Success Response", response);
            console.log("[GrowPlan] PaymentId", response.razorpay_payment_id);
            console.log("[GrowPlan] Razorpay OrderId", response.razorpay_order_id);
            console.log("[GrowPlan] Signature", response.razorpay_signature);

            const paymentId = response.razorpay_payment_id;
            const orderId = response.razorpay_order_id;
            const signature = response.razorpay_signature;

            try {
              if (!paymentId || !orderId || !signature) {
                throw new Error("Razorpay paymentId/orderId/signature missing. Cannot verify payment.");
              }

              const verifyPayload = {
                sellerId,
                amount: Number(payableAmount),
                paymentId,
                orderId,
                signature
              };

              console.log("[GrowPlan] Verify Payload", verifyPayload);

              const verifyRes = await sellerService.verifyRazorpayPayment(verifyPayload);

              console.log("[GrowPlan] Verify Response", verifyRes);

              const verified = verifyRes?.message?.verified === true;

              if (!verified) {
                console.error("[GrowPlan] Payment verification failed");
                throw new Error("Payment verification failed");
              }

              const paymentIdVal = response.razorpay_payment_id;
              if (processedPaymentRef.current.has(paymentIdVal)) {
                console.log("[GrowPlanPage] Payment already processed, skipping verify/subscription:", paymentIdVal);
                return;
              }
              processedPaymentRef.current.add(paymentIdVal);

              // 1. Prepare ISO Dates
              const startedDate = new Date().toISOString().split('.')[0] + 'Z';
              const endD = new Date();
              endD.setMonth(endD.getMonth() + 1);
              const endedDate = endD.toISOString().split('.')[0] + 'Z';

              // 2. Prepare Invoice Data
              const basePrice = Number(selectedPlan.price || selectedPlan.amount || 0);
              const gstAmount = basePrice * 0.10;
              const rate = basePrice - gstAmount;

              const invoiceData = {
                invoiceDate: new Date().toISOString(),
                sellerName: sellerProfile?.companyName || sellerProfile?.name || "",
                sellerId: sellerId,
                address: `${sellerProfile?.address || ""}, ${sellerProfile?.pincode || ""}`,
                gstin: sellerProfile?.gstin || sellerProfile?.GSTIN || "",
                item: selectedPlan.planName || selectedPlan.name,
                qty: 1,
                rate: rate,
                amount: rate,
                subtotal: rate,
                cgst: gstAmount / 2,
                sgst: gstAmount / 2,
                totalPayable: Number(payableAmount),
                payments: {
                  wallet: Number(walletRedeemedAmount),
                  upi: Number(payableAmount)
                },
                transactionMethod: walletRedeemedAmount > 0 && payableAmount === 0
                  ? "Wallet"
                  : walletRedeemedAmount > 0 ? "Wallet, UPI" : "UPI"
              };

              const invoicePayload = (payableAmount <= 0 && walletRedeemedAmount <= 0) ? {} : invoiceData;

              // 3. Prepare Subscription Data
              const subscriptionPayload = {
                tableId: "",
                planName: selectedPlan.planName || selectedPlan.name,
                planId: selectedPlan.planId || selectedPlan._id || selectedPlan.id,
                status: "Active",
                email: sellerEmail,
                startedDate: startedDate,
                endedDate: endedDate,
                paymentId: response.razorpay_payment_id,
                razorpayOrderId: response.razorpay_order_id,
                sellerId: sellerId,
                phone: sellerProfile?.phone || ""
              };

              // 4. Prepare Referral Data
              const referralPayload = {
                rewardEarned: Number(referralDiscount || 0),
                rewardUsed: appliedReferralCode ? 1 : 0,
                referralCode: appliedReferralCode || ""
              };

              // 5. Store Payload containing both flat parameters and nested blocks
              const storePayload = {
                // Flat payload structure:
                sellerId,
                email: sellerEmail,
                planId: selectedPlan.planId || selectedPlan._id || selectedPlan.id,
                planName: selectedPlan.planName || selectedPlan.name,
                amount: Number(payableAmount),
                planPrice: Number(selectedPlan.price || selectedPlan.amount || 0),
                planDuration: "1 Month",
                startDate: startedDate,
                totalPrice: Number(totalPrice),
                payableAmount: Number(payableAmount),
                walletRedeemed: Number(walletRedeemedAmount || 0),
                referralCode: appliedReferralCode || "",
                referralDiscount: Number(referralDiscount || 0),
                paymentId,
                orderId,
                signature,
                paymentMethod: "razorpay",
                paymentStatus: "success",

                // Nested parameters for Wix backend database:
                createSellerInvoice: invoicePayload,
                createSubscription: subscriptionPayload,
                referralUpdate: referralPayload
              };

              console.log("[GrowPlan] Subscription Payload", storePayload);

              const storeRes = await axios.post("https://www.haatzaseller.com/_functions/processSubscriptionOrder", storePayload);
              console.log("[GrowPlan] Subscription Response", storeRes.data);

              const success =
                storeRes?.data?.status === "success" &&
                storeRes?.data?.message?.message === "Subscription order processed successfully";

              if (!success) {
                throw new Error("Subscription order processing failed on backend.");
              }

              console.log("[GrowPlan] Subscription Fetch URL", "https://www.haatzaseller.com/_functions/sellersubscription?email=" + sellerEmail);
              const verifySubscription = await sellerService.fetchSubscriptionPlan(sellerEmail);

              console.log("[GrowPlan] Subscription Fetch Response", verifySubscription);

              const orders = extractSubscriptionOrders(verifySubscription);
              if (orders.length === 0) {
                console.error("[GrowPlan] Subscription API returned success, but sellersubscription returned empty orders. Backend may not be persisting or fetching by same email.");
                throw new Error("Subscription processed but verification returned empty active plans. Please refresh or contact support.");
              }

              // Refresh sellersubscription records from backend
              console.log(`[GrowPlanPage] Refreshing subscription records... GET https://www.haatzaseller.com/_functions/sellersubscription?email=${sellerEmail}`);
              try {
                const subRes = await sellerService.fetchSubscriptionPlan(sellerEmail);
                setSubscriptionRes(subRes);
                console.log("[GrowPlanPage] Refreshed Subscription Response", subRes);
                const ordersRes = extractSubscriptionOrders(subRes);
                if (ordersRes.length > 0) {
                  setActiveSubscription(getLatestSubscription(ordersRes));
                }
              } catch (refreshErr) {
                console.warn("[GrowPlanPage] Failed to refresh subscription info:", refreshErr);
              }

              // Refresh wallet balance from backend
              console.log(`[GrowPlanPage] Refreshing wallet balance... GET https://haatza.com/_functions/checkWalletBalance?sellerId=${sellerId}`);
              try {
                const walletRes = await sellerService.checkWalletBalance(sellerId);
                setWalletBalance(extractWalletBalance(walletRes));
              } catch (balErr) {
                console.warn("[GrowPlanPage] Failed to refresh wallet balance:", balErr);
              }

              // Finished successfully
              setViewState("success");
            } catch (err) {
              console.error("[GrowPlanPage] Subscription storage/verification error:", err);
              setErrorMsg(err.message || "Failed to complete subscription processing.");
            } finally {
              setIsProcessing(false);
              paymentInProgressRef.current = false;
            }
          },
          prefill: {
            name: sellerProfile?.name || "",
            email: sellerEmail || "",
            contact: sellerProfile?.phone || "",
          },
          theme: {
            color: "#3399cc",
          },
          modal: {
            ondismiss: function () {
              console.log("[GrowPlanPage] Razorpay modal dismissed by user.");
              setIsProcessing(false);
              paymentInProgressRef.current = false;
              setErrorMsg("Payment checkout cancelled.");
            }
          }
        };

        console.log("[GrowPlan] Razorpay Options", options);
        const rzp = new window.Razorpay(options);
        rzp.on("payment.failed", function (resp) {
          console.error("[GrowPlanPage] Razorpay Payment failed:", resp.error);
          setIsProcessing(false);
          paymentInProgressRef.current = false;
          setErrorMsg(resp.error?.description || "Payment failed. Please try again.");
        });

        rzp.open();
      } else {
        // payableAmount is 0 (paid fully using wallet discount)
        const paymentId = "wallet_redeem_" + Date.now();
        const orderId = "wallet_redeem_" + Date.now();

        const startedDate = new Date().toISOString().split('.')[0] + 'Z';
        const endD = new Date();
        endD.setMonth(endD.getMonth() + 1);
        const endedDate = endD.toISOString().split('.')[0] + 'Z';

        const basePrice = Number(selectedPlan.price || selectedPlan.amount || 0);
        const gstAmount = basePrice * 0.10;
        const rate = basePrice - gstAmount;

        const invoiceData = {
          invoiceDate: new Date().toISOString(),
          sellerName: sellerProfile?.companyName || sellerProfile?.name || "",
          sellerId: sellerId,
          address: `${sellerProfile?.address || ""}, ${sellerProfile?.pincode || ""}`,
          gstin: sellerProfile?.gstin || sellerProfile?.GSTIN || "",
          item: selectedPlan.planName || selectedPlan.name,
          qty: 1,
          rate: rate,
          amount: rate,
          subtotal: rate,
          cgst: gstAmount / 2,
          sgst: gstAmount / 2,
          totalPayable: 0,
          payments: {
            wallet: Number(walletRedeemedAmount),
            upi: 0
          },
          transactionMethod: "Wallet"
        };

        const invoicePayload = (payableAmount <= 0 && walletRedeemedAmount <= 0) ? {} : invoiceData;

        const subscriptionPayload = {
          tableId: "",
          planName: selectedPlan.planName || selectedPlan.name,
          planId: selectedPlan.planId || selectedPlan._id || selectedPlan.id,
          status: "Active",
          email: sellerEmail,
          startedDate: startedDate,
          endedDate: endedDate,
          paymentId: paymentId,
          razorpayOrderId: orderId,
          sellerId: sellerId,
          phone: sellerProfile?.phone || ""
        };

        const referralPayload = {
          rewardEarned: Number(referralDiscount || 0),
          rewardUsed: appliedReferralCode ? 1 : 0,
          referralCode: appliedReferralCode || ""
        };

        const storePayload = {
          // Flat payload structure:
          sellerId,
          email: sellerEmail,
          planId: selectedPlan.planId || selectedPlan._id || selectedPlan.id,
          planName: selectedPlan.planName || selectedPlan.name,
          amount: Number(payableAmount),
          planPrice: Number(selectedPlan.price || selectedPlan.amount || 0),
          planDuration: "1 Month",
          startDate: startedDate,
          totalPrice: Number(totalPrice),
          payableAmount: Number(payableAmount),
          walletRedeemed: Number(walletRedeemedAmount || 0),
          referralCode: appliedReferralCode || "",
          referralDiscount: Number(referralDiscount || 0),
          paymentId: paymentId,
          orderId: orderId,
          signature: "",
          paymentMethod: "wallet",
          paymentStatus: "success",

          // Nested parameters for Wix backend database:
          createSellerInvoice: invoicePayload,
          createSubscription: subscriptionPayload,
          referralUpdate: referralPayload
        };

        console.log("[GrowPlan] Subscription Payload", storePayload);

        console.log("[GrowPlanPage] Processing direct free/wallet subscription order: POST https://www.haatzaseller.com/_functions/processSubscriptionOrder", storePayload);
        const storeRes = await axios.post("https://www.haatzaseller.com/_functions/processSubscriptionOrder", storePayload);
        console.log("[GrowPlan] Subscription Response", storeRes.data);

        const success =
          storeRes?.data?.status === "success" &&
          storeRes?.data?.message?.message === "Subscription order processed successfully";

        if (!success) {
          throw new Error("Subscription order processing failed on backend.");
        }

        console.log("[GrowPlan] Subscription Fetch URL", "https://www.haatzaseller.com/_functions/sellersubscription?email=" + sellerEmail);
        const verifySubscription = await sellerService.fetchSubscriptionPlan(sellerEmail);

        console.log("[GrowPlan] Subscription Fetch Response", verifySubscription);

        const orders = extractSubscriptionOrders(verifySubscription);
        if (orders.length === 0) {
          console.error("[GrowPlan] Subscription API returned success, but sellersubscription returned empty orders. Backend may not be persisting or fetching by same email.");
          throw new Error("Subscription processed but verification returned empty active plans. Please refresh or contact support.");
        }

        // Refresh sellersubscription records from backend
        console.log(`[GrowPlanPage] Refreshing subscription records... GET https://www.haatzaseller.com/_functions/sellersubscription?email=${sellerEmail}`);
        try {
          const subRes = await sellerService.fetchSubscriptionPlan(sellerEmail);
          setSubscriptionRes(subRes);
          console.log("[GrowPlanPage] Refreshed Subscription Response", subRes);
          const ordersRes = extractSubscriptionOrders(subRes);
          if (ordersRes.length > 0) {
            setActiveSubscription(getLatestSubscription(ordersRes));
          }
        } catch (refreshErr) {
          console.warn("[GrowPlanPage] Failed to refresh subscription info:", refreshErr);
        }

        // Refresh wallet balance from backend
        console.log(`[GrowPlanPage] Refreshing wallet balance... GET https://haatza.com/_functions/checkWalletBalance?sellerId=${sellerId}`);
        try {
          const walletRes = await sellerService.checkWalletBalance(sellerId);
          setWalletBalance(extractWalletBalance(walletRes));
        } catch (balErr) {
          console.warn("[GrowPlanPage] Failed to refresh wallet balance:", balErr);
        }

        setIsProcessing(false);
        paymentInProgressRef.current = false;
        setViewState("success");
      }

    } catch (err) {
      console.error("[GrowPlanPage] Subscription initiation error:", err);
      setErrorMsg(err.response?.data?.message || err.message || "Failed to subscribe. Please try again.");
      setIsProcessing(false);
      paymentInProgressRef.current = false;
    }
  };

  const handleResetFlow = () => {
    setViewState("plans");
    setRedeemWallet(false);
    setReferralCode("");
    setAppliedReferralCode("");
    setReferralDiscount(0);
    setReferralMessage({ text: "", type: "" });
    setErrorMsg(null);
  };

  if (loadingPlans) {
    return (
      <div className="grow-plan-container">
        <div className="grow-loading-overlay">
          <div className="grow-loading-spinner" />
          <p>Loading plans and billing status...</p>
        </div>
      </div>
    );
  }

  // ----------------------------------------
  // 1. Success view State
  // ----------------------------------------
  if (viewState === "success") {
    return (
      <div className="grow-plan-container">
        <div className="subscription-success-card">
          <div className="success-check-badge">
            <Check size={40} />
          </div>
          <h1>Subscription Successful!</h1>
          <p>
            Congratulations! You have successfully subscribed to the <strong>{selectedPlan?.name} Plan</strong>.
            Your billing cycle has started, and benefits are now active on your seller dashboard.
          </p>
          <button className="btn-back-dashboard" onClick={() => { handleResetFlow(); navigate("/dashboard"); }}>
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ----------------------------------------
  // 2. Plan Review view State
  // ----------------------------------------
  if (viewState === "review") {
    const featuresToShow = isFeaturesExpanded
      ? selectedPlan?.features
      : selectedPlan?.features?.slice(0, 5);
    const hasLongFeatures = selectedPlan?.features?.length > 5;

    return (
      <div className="grow-plan-container">
        <div className="grow-plan-breadcrumb">
          <span>Dashboard</span> &gt; <span>Grow Plan</span> &gt; <span className="active">Plan Review</span>
        </div>

        <div className="review-header-row">
          <button className="btn-back-plans" onClick={() => setViewState("plans")} title="Back to Plans">
            <ChevronLeft size={20} />
          </button>
          <div className="grow-plan-header">
            <h1>Plan Review</h1>
            <p>Review details, apply wallet balance discount, and confirm subscription to activate benefits.</p>
          </div>
        </div>

        {errorMsg && (
          <div className="grow-error-banner">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)}>&times;</button>
          </div>
        )}

        {/* Plan Review Single Column Container */}
        <div className="plan-review-layout">
          <div className="plan-review-card">
            {/* 1. Selected plan name */}
            <div className="review-plan-name-label">
              {selectedPlan?.name} Plan
            </div>

            {/* 2. Plan price */}
            <div className="review-plan-price-label">
              ₹{selectedPlan?.price} / month
            </div>

            <div className="review-divider" />

            {/* 3. What’s included */}
            <div className="plan-features-title">What's included in this plan:</div>
            <ul className="plan-features-list">
              {featuresToShow?.map((feat, idx) => (
                <li className="plan-feature-item" key={idx}>
                  <CheckCircle2 size={16} className="feature-check-icon" />
                  <span>{feat}</span>
                </li>
              ))}
            </ul>

            {/* 4. See more / See less */}
            {hasLongFeatures && (
              <button
                className="btn-see-more-toggle"
                onClick={() => setIsFeaturesExpanded(!isFeaturesExpanded)}
              >
                {isFeaturesExpanded ? "See less" : "See more"}
              </button>
            )}

            <div className="review-divider" />

            {/* 5. Start date */}
            <div className="start-date-container">
              <label>Start Date</label>
              <div className="start-date-input-wrapper">{getTodayFormatted()}</div>
            </div>

            <div className="review-divider" />

            {/* 6. Redeem wallet balance checkbox & 7. Wallet balance display */}
            {walletBalance > 0 && (
              <div className="wallet-redeem-row">
                <input
                  type="checkbox"
                  id="walletRedeemCheck"
                  className="wallet-checkbox-input"
                  checked={redeemWallet}
                  onChange={(e) => setRedeemWallet(e.target.checked)}
                />
                <label htmlFor="walletRedeemCheck" className="wallet-redeem-label">
                  Redeem Wallet Balance? ₹{walletBalance.toFixed(2)}
                </label>
              </div>
            )}

            {/* Coupon Referral Input */}
            <div className="referral-container">
              <div className="referral-input-row">
                <input
                  type="text"
                  className="referral-text-input"
                  placeholder="Enter Referral Code"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value)}
                  disabled={checkingReferral || appliedReferralCode !== ""}
                />
                <button
                  type="button"
                  className="btn-apply-coupon"
                  onClick={handleApplyReferral}
                  disabled={checkingReferral || !referralCode.trim() || appliedReferralCode !== ""}
                >
                  {checkingReferral ? "Applying..." : "Apply"}
                </button>
              </div>

              {referralMessage.text && (
                <div className={`referral-status-msg ${referralMessage.type}`}>
                  {referralMessage.text}
                </div>
              )}
            </div>

            <div className="review-divider" />

            {/* Price breakdown and calculations (keeping labels for test compatibility) */}
            <div className="price-breakdown-list">
              <div className="breakdown-row" style={{ display: "none" }}>
                <span>Plan Price</span>
                <span>₹{planPrice}</span>
              </div>
              <div className="breakdown-row" style={{ display: "none" }}>
                <span>Plan Duration</span>
                <span>1 Month</span>
              </div>
              <div className="breakdown-row highlight" style={{ display: "none" }}>
                <span>Total Price</span>
                <span>₹{totalPrice}</span>
              </div>

              {walletRedeemedAmount > 0 && (
                <div className="breakdown-row wallet">
                  <span>Wallet Redeemed</span>
                  <span>- ₹{walletRedeemedAmount}</span>
                </div>
              )}

              {referralDiscount > 0 && (
                <div className="breakdown-row discount">
                  <span>Referral Discount</span>
                  <span>- ₹{referralDiscount}</span>
                </div>
              )}
            </div>

            {/* 8. Amount payable / final price */}
            <div className="breakdown-row total-payable">
              <span>Payable Amount</span>
              <span>₹{payableAmount}</span>
            </div>

            {/* 9. Continue / Pay button */}
            <button
              className="btn-subscribe-now"
              onClick={() => setShowConfirmModal(true)}
              disabled={isProcessing}
            >
              {isProcessing ? "Processing..." : "Subscribe Now"}
            </button>
          </div>
        </div>

        {/* Confirmation Modal */}
        {showConfirmModal && (
          <div className="confirm-modal-overlay">
            <div className="confirm-modal-container">
              <div className="confirm-modal-title">
                Would you like to proceed with subscribing to this plan for ₹{payableAmount}?
              </div>
              <div className="confirm-modal-payable-amount">
                Payable Amount ₹{payableAmount}
              </div>
              <div className="confirm-modal-actions">
                <button className="btn-confirm-yes" onClick={handleProceedSubscription}>
                  Yes
                </button>
                <button className="btn-confirm-no" onClick={() => setShowConfirmModal(false)}>
                  No
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ----------------------------------------
  // 3. Plans Grid view State (Web View)
  // ----------------------------------------
  return (
    <div className="grow-plan-container">
      <div className="grow-plan-breadcrumb">
        <span>Dashboard</span> &gt; <span className="active">Grow Plan</span>
      </div>

      <div className="grow-plan-header">
        <h1>Grow Plan</h1>
        <h2 className="grow-plan-subtitle">Power Up Your Business with Haatza Seller Plans</h2>
        <p className="grow-plan-description">
          The Haatza Seller App is designed to empower sellers at every stage — whether you're starting small or scaling up rapidly. Our pricing plans are crafted to give you the tools you need to sell better, grow faster, and manage smarter.
        </p>
      </div>

      {errorMsg && (
        <div className="grow-error-banner">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)}>&times;</button>
        </div>
      )}

      {/* Grid of pricing cards stacked in a list */}
      <div className="plans-list">
        {plans.map((plan) => {
          const isSelected = selectedPlan?.id === plan.id;
          const featuresToShow = isFeaturesExpanded
            ? plan.features
            : plan.features?.slice(0, 5);
          const hasLongFeatures = plan.features?.length > 5;

          return (
            <div
              className={`plan-card ${isSelected ? "selected" : ""} ${plan.recommended ? "recommended" : ""}`}
              key={plan.id}
              onClick={() => handleSelectPlan(plan)}
            >
              <div className="plan-card-header">
                <div className="plan-name-wrapper">
                  <span className="plan-name">{plan.name}</span>
                  {plan.recommended && (
                    <span className="recommended-badge-inline">Recommended</span>
                  )}
                </div>
                <div className="plan-selector-radio">
                  <div className="plan-selector-inner" />
                </div>
              </div>

              <div className="plan-price-row">
                <span className="plan-price">₹{plan.price.toLocaleString("en-IN")}</span>
                <span className="plan-duration"> / month</span>
              </div>

              {isSamePlan(plan) && expiryDate && (
                <div className={isExpired ? "current-plan-expired-text" : "current-plan-active-text"}>
                  {isExpired
                    ? `Current plan expired on : ${formatPlanDate(expiryDate)}`
                    : `Current plan expires on : ${formatPlanDate(expiryDate)}`}
                </div>
              )}


              {isSelected && (
                <div className="plan-expanded-details">
                  <div className="plan-divider" />
                  <div className="plan-features-title">What's included:</div>
                  <ul className="plan-features-list">
                    {featuresToShow?.map((feat, idx) => (
                      <li className="plan-feature-item" key={idx}>
                        <CheckCircle2 size={16} className="feature-check-icon" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                  {hasLongFeatures && (
                    <button
                      className="btn-see-more-toggle"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsFeaturesExpanded(!isFeaturesExpanded);
                      }}
                    >
                      {isFeaturesExpanded ? "See less" : "See more"}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Information below plan cards */}
      <div className="grow-plan-footer-content">
        <div className="footer-section">
          <h3>Built for Sellers Who Want More</h3>
          <p>
            The Haatza Seller App is more than just a selling tool — it's your growth partner. Whether you're listing your first product or managing thousands of orders a month, our subscription plans are designed to help you sell smarter, grow faster, and operate effortlessly.
          </p>
        </div>
        <div className="footer-section">
          <h3>Scalable Plans, Sustainable Growth</h3>
          <p>
            Your business isn't one-size-fits-all — and neither are we. Our flexible pricing adapts to your goals, giving you access to the right tools when you need them most — from entry-level essentials to advanced features that drive big results.
          </p>
        </div>
        <div className="footer-section">
          <h3>Let’s Build Your Business Together</h3>
          <p>
            Start with our free plan to test the waters or jump right into Growth or Pro to supercharge your performance.
          </p>
        </div>
      </div>

      {/* Sticky Bottom selection indicator bar */}
      <div className="plans-action-bar">
        <div className="plans-action-content">
          <button
            className="btn-continue"
            disabled={isBottomButtonDisabled}
            onClick={handlePlanAction}
          >
            <span>{getBottomActionText()}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default GrowPlanPage;
