import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { ChevronLeft, CheckCircle2, Check, ArrowRight } from "lucide-react";
import { resolveSellerId, resolveSellerEmail, resolveSellerPhone } from "../../utils/sellerSession";
import { sellerService } from "../../services/sellerService";
import {
  parseLocalDate,
  getDurationMultiplier,
  calculateInclusiveEndDate,
  getInclusiveEffectiveEndDate,
  getPlanRank,
  daysBetween,
  calculateExactMonths,
  calculatePlanPricing,
  getDurationMonthsCount
} from "../../utils/pricingUtils";
import "./GrowPlanPage.css";

// Fallback plans in case the plans API doesn't return data
const FALLBACK_PLANS = [
  {
    id: "growth_plan",
    name: "Growth",
    price: 999,
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

const toApiDateOnlyIso = (date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T00:00:00.000Z`;
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

// "Active till" display for the current plan card — always shows the
// corrected inclusive end date, capped to one day before the scheduled
// plan's start date when an overlap would otherwise exist.
const formatCurrentPlanActiveTill = (subscription, scheduledSub) => {
  let effectiveEnd = getInclusiveEffectiveEndDate(subscription);
  if (!effectiveEnd) return "";

  // Cap to scheduled.startedDate − 1 day when overlap exists.
  const scheduledStart = parseDateSafe(
    scheduledSub?.startedDate || scheduledSub?.startDate
  );
  if (scheduledStart && scheduledStart <= effectiveEnd) {
    effectiveEnd = new Date(
      scheduledStart.getFullYear(),
      scheduledStart.getMonth(),
      scheduledStart.getDate() - 1
    );
  }

  return effectiveEnd.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  }).replace(/ /g, " ");
};

const getLatestSubscription = (orders) => {
  if (!Array.isArray(orders) || orders.length === 0) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const parseDate = (value) => {
    if (!value) return null;
    const d = parseDateSafe(value) || new Date(value);
    return isNaN(d.getTime()) ? null : d;
  };

  const getDateTime = (sub) => {
    const d = parseDate(
      sub?.startedDate ||
      sub?.startDate ||
      sub?.endedDate ||
      sub?.endDate ||
      sub?.createdDate ||
      sub?.createdAt ||
      0
    );
    return d ? d.getTime() : 0;
  };

  const isActiveNow = (sub) => {
    const status = String(sub?.status || "").toLowerCase();
    const start = parseDate(sub?.startedDate || sub?.startDate);
    const end = parseDate(sub?.endedDate || sub?.endDate);
    if (!start || !end) return false;

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    return status === "active" && today >= start && today <= end;
  };

  const activeNow = orders.find(isActiveNow);
  if (activeNow) return activeNow;

  const active = orders.find(
    (sub) => String(sub?.status || "").toLowerCase() === "active"
  );
  if (active) return active;

  const scheduled = orders
    .filter((sub) => String(sub?.status || "").toLowerCase() === "scheduled")
    .sort((a, b) => getDateTime(b) - getDateTime(a))[0];

  if (scheduled) return scheduled;

  return [...orders].sort((a, b) => getDateTime(b) - getDateTime(a))[0];
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
  return data?.message?.orders || [];
};

const applyLocalScheduledOverride = (orders, sellerKey) => {
  if (!Array.isArray(orders) || !sellerKey) return orders;

  try {
    const stored = window.localStorage.getItem(`growPlanScheduledOverride:${sellerKey}`);
    if (!stored) return orders;

    const override = JSON.parse(stored);
    const overrideId = override?.TableID || override?.tableId || override?._id || override?.subscriptionId;
    const overridePlan = normalize(override?.planName || override?.plan || override?.subscriptionPlan);

    let applied = false;
    const merged = orders.map((subscription) => {
      if (normalize(subscription?.status) !== "scheduled") return subscription;
      const subscriptionId =
        subscription?.TableID || subscription?.tableId || subscription?._id || subscription?.subscriptionId;
      const subscriptionPlan = normalize(
        subscription?.planName || subscription?.plan || subscription?.subscriptionPlan
      );
      const isMatch = overrideId
        ? String(subscriptionId || "") === String(overrideId)
        : Boolean(overridePlan && subscriptionPlan === overridePlan);
      if (!isMatch) return subscription;

      applied = true;
      return {
        ...subscription,
        startedDate: override.startedDate,
        endedDate: override.endedDate
      };
    });

    return applied ? merged : orders;
  } catch (error) {
    console.warn("[GrowPlan] Unable to apply local schedule override:", error);
    return orders;
  }
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

  // Mobile-Aligned States
  const [currentSubscription, setCurrentSubscription] = useState(null);
  const [planDuration, setPlanDuration] = useState("1 Month");
  const [baseAmount, setBaseAmount] = useState(0);
  const [originalTotal, setOriginalTotal] = useState(0);
  const [totalPayableAmount, setTotalPayableAmount] = useState(0);
  const [remainingAmount, setRemainingAmount] = useState(0);
  const [availableBalance, setAvailableBalance] = useState(0);
  const [useWallet, setUseWallet] = useState(false);
  const [walletUsedAmount, setWalletUsedAmount] = useState(0);
  const [isCouponApplied, setIsCouponApplied] = useState(false);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [couponCode, setCouponCode] = useState("");
  const [startedDate, setStartedDate] = useState("");
  const [endedDate, setEndedDate] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Legacy Mappings
  const activeSubscription = currentSubscription;
  const setActiveSubscription = setCurrentSubscription;
  const walletBalance = availableBalance;
  const setWalletBalance = setAvailableBalance;
  const redeemWallet = useWallet;
  const setRedeemWallet = setUseWallet;
  const referralCode = couponCode;
  const setReferralCode = setCouponCode;
  const referralDiscount = discountAmount;
  const setReferralDiscount = setDiscountAmount;
  const isProcessing = isProcessingPayment;
  const setIsProcessing = setIsProcessingPayment;

  const [appliedReferralCode, setAppliedReferralCode] = useState("");

  // Loaders / Feedback states
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [checkingReferral, setCheckingReferral] = useState(false);
  const [referralMessage, setReferralMessage] = useState({ text: "", type: "" });
  const [processingMessage, setProcessingMessage] = useState("");
  const [errorMsg, setErrorMsg] = useState(null);

  // Active/Existing Subscription status
  const [plansRes, setPlansRes] = useState(null);
  const [subscriptionRes, setSubscriptionRes] = useState(null);
  const [subscriptionList, setSubscriptionList] = useState([]);

  // Warning & Toast notification states
  const [subscriptionWarning, setSubscriptionWarning] = useState("");
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

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
      console.log("[GrowPlanPage] Fetching plans... GET https://haatzaseller.com/_functions/getPlans");
      let planItems = [];
      try {
        const plansRes = await sellerService.getPlans();
        setPlansRes(plansRes);
        console.log("[GrowPlanPage] Get Plans Response", plansRes);
        planItems = extractPlans(plansRes);
      } catch (err) {
        console.error("[GrowPlanPage] Get Plans API error, using fallbacks:", err);
      }
      const finalPlans = mapPlansWithFeatures(planItems);
      setPlans(finalPlans);

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
        console.log(`[GrowPlanPage] Fetching active subscription... GET https://haatzaseller.com/_functions/sellersubscription?email=${sellerEmail}`);
        try {
          const subRes = await sellerService.getSellerSubscription(sellerEmail);
          setSubscriptionRes(subRes);
          console.log("[GrowPlanPage] Seller Subscription Response", subRes);
          const orders = applyLocalScheduledOverride(
            extractSubscriptionOrders(subRes),
            sellerId || sellerEmail
          );
          setSubscriptionList(orders);
          const latest = getLatestSubscription(orders);
          console.log("[GrowPlan] subscription orders:", orders);
          console.log("[GrowPlan] selected current subscription:", latest);
          setActiveSubscription(latest);
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

  // ─── Auto-correct pre-existing active/scheduled overlap in the database ───
  // Runs once after subscriptions are loaded. When the active plan's stored
  // end date overlaps the scheduled plan's start date, fires a background
  // processSubscriptionOrder call to trim the active record in the DB.
  // This handles data that existed before the PlanReviewPage fix was deployed.
  useEffect(() => {
    if (!subscriptionList || subscriptionList.length === 0) return;
    if (!sellerId || !sellerEmail) return;

    const activeSub = subscriptionList.find(
      (s) => String(s?.status || "").toLowerCase() === "active"
    );
    const scheduledSub = subscriptionList.find(
      (s) => String(s?.status || "").toLowerCase() === "scheduled"
    );

    if (!activeSub || !scheduledSub) return;

    const activeExpiry = getInclusiveEffectiveEndDate(activeSub);
    const scheduledStart = parseDateSafe(
      scheduledSub.startedDate || scheduledSub.startDate
    );

    // No overlap → nothing to fix.
    if (!activeExpiry || !scheduledStart || scheduledStart > activeExpiry) return;

    const activeTableId =
      activeSub.TableID || activeSub.tableId || activeSub._id || "";
    if (!activeTableId) return;

    // Compute the corrected active end date: one day before scheduled start.
    const correctedEndDay = new Date(
      scheduledStart.getFullYear(),
      scheduledStart.getMonth(),
      scheduledStart.getDate() - 1
    );
    const yyyy = correctedEndDay.getFullYear();
    const mm = String(correctedEndDay.getMonth() + 1).padStart(2, "0");
    const dd = String(correctedEndDay.getDate()).padStart(2, "0");
    const correctedEndIso = `${yyyy}-${mm}-${dd}T00:00:00.000Z`;

    const activeStartIso = (() => {
      const d = parseDateSafe(
        activeSub.startedDate || activeSub.startDate
      ) || new Date();
      const sy = d.getFullYear();
      const sm = String(d.getMonth() + 1).padStart(2, "0");
      const sd = String(d.getDate()).padStart(2, "0");
      return `${sy}-${sm}-${sd}T00:00:00.000Z`;
    })();

    console.log("[GrowPlan] Overlap detected on page load — auto-correcting DB:", {
      activeExpiry: activeExpiry.toISOString(),
      scheduledStart: scheduledStart.toISOString(),
      correctedEndIso
    });

    const activeInvoiceData = {
      invoiceDate: new Date().toISOString(),
      sellerName: sellerProfile?.companyName || sellerProfile?.name || sellerEmail || "Seller",
      sellerId: sellerId || "",
      address: sellerProfile?.address || "NA",
      gstin: sellerProfile?.gstin || sellerProfile?.GSTIN || "NA",
      item: activeSub.planName || activeSub.plan || "Trimmed Plan",
      qty: 1,
      rate: Number(activeSub.amount || activeSub.originalPlanAmount || 999),
      amount: Number(activeSub.amount || activeSub.originalPlanAmount || 999),
      originalPlanAmount: Number(activeSub.originalPlanAmount || activeSub.amount || 999),
      waivedAmount: Number(activeSub.waivedAmount || 0),
      remainingSubscriptionValue: Number(activeSub.remainingSubscriptionValue || 0),
      discountAmount: Number(activeSub.discountAmount || 0),
      subtotal: Number(activeSub.subtotal || activeSub.amount || 999),
      totalPayable: Number(activeSub.totalPayable || activeSub.amount || 999),
      payableAmount: Number(activeSub.payableAmount || 0),
      cgst: 0,
      sgst: 0,
      payments: {
        wallet: Number(activeSub.walletAmount || 0),
        upi: Number(activeSub.razorpayAmount || 0)
      },
      paymentMethod: activeSub.paymentMethod || "UPI",
      transactionMethod: activeSub.paymentMethod || "UPI",
      paymentId: activeSub.paymentId || "WALLET_FULL_PAYMENT",
      razorpayOrderId: activeSub.razorpayOrderId || ""
    };

    const trimPayload = {
      createSellerInvoice: activeInvoiceData,
      createSubscription: {
        tableId: activeTableId,
        planName:
          activeSub.planName ||
          activeSub.plan ||
          activeSub.subscriptionPlan ||
          "",
        planId:
          activeSub.planId ||
          activeSub._id ||
          activeSub.id ||
          "",
        status: "Active",
        email: sellerEmail,
        sellerId: sellerId,
        startedDate: activeStartIso,
        endedDate: correctedEndIso,
        schedulingAction: "activate", // active plan update action
        existingScheduledTableId: "",
        cancelScheduledTableId: "",
        // Preserve all original payment and billing fields
        phone: sellerProfile?.phone || sellerProfile?.phoneNo || resolveSellerPhone() || activeSub.phone || "",
        amount: activeSub.amount || activeSub.originalPlanAmount || 0,
        originalPlanAmount: activeSub.originalPlanAmount || activeSub.amount || 0,
        payableAmount: activeSub.payableAmount || 0,
        waivedAmount: activeSub.waivedAmount || 0,
        remainingSubscriptionValue: activeSub.remainingSubscriptionValue || 0,
        subtotal: activeSub.subtotal || 0,
        totalPayable: activeSub.totalPayable || 0,
        walletAmount: activeSub.walletAmount || 0,
        razorpayAmount: activeSub.razorpayAmount || 0,
        paymentMethod: activeSub.paymentMethod || "UPI",
        paidAmount: activeSub.paidAmount || 0,
        paymentId: activeSub.paymentId || "WALLET_FULL_PAYMENT",
        razorpayOrderId: activeSub.razorpayOrderId || ""
      },
      referralUpdate: null
    };

    sellerService.processSubscriptionOrder(trimPayload)
      .then((res) => {
        console.log("[GrowPlan] Auto-corrected active plan end date in DB:", res);
      })
      .catch((err) => {
        console.error("[GrowPlan] Non-fatal: auto-correct DB trim failed:", err);
      });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscriptionList]);


  const currentPlanName = currentSubscription?.planName || currentSubscription?.plan || currentSubscription?.subscriptionPlan;
  const expiryDate =
    currentSubscription?.endedDate ||
    currentSubscription?.endDate ||
    currentSubscription?.expiryDate ||
    currentSubscription?.expiredOn ||
    currentSubscription?.validTill;

  const expiryDateObj = parseDateSafe(expiryDate);
  const isExpired = expiryDateObj ? expiryDateObj < new Date() : false;

  const scheduledSubscription = subscriptionList.find(
    (s) => String(s?.status || "").toLowerCase() === "scheduled"
  );

  const isScheduledPlan = (plan) =>
    Boolean(
      scheduledSubscription &&
      normalize(plan?.name || plan?.planName) === normalize(scheduledSubscription.planName || scheduledSubscription.plan)
    );

  const isCurrentActivePlan = (plan) =>
    Boolean(
      currentSubscription &&
      String(currentSubscription.status || "").toLowerCase() === "active" &&
      normalize(plan?.name || plan?.planName) === normalize(currentSubscription.planName || currentSubscription.plan)
    );

  const isSelectedDowngrade = Boolean(
    selectedPlan &&
    currentSubscription &&
    String(currentSubscription.status || "").toLowerCase() === "active" &&
    getPlanRank(selectedPlan.name || selectedPlan.planName) <
    getPlanRank(currentSubscription.planName || currentSubscription.plan || currentSubscription.subscriptionPlan)
  );

  function getPlanActionLabel(selectedPlan, currentSubscription) {
    if (!selectedPlan) return "";

    if (
      scheduledSubscription &&
      normalize(selectedPlan.name || selectedPlan.planName) ===
      normalize(scheduledSubscription.planName || scheduledSubscription.plan)
    ) {
      return "Reschedule Plan";
    }

    const currentStatus = String(currentSubscription?.status || "").toLowerCase();
    const currentRank = getPlanRank(
      currentSubscription?.planName ||
      currentSubscription?.plan ||
      currentSubscription?.subscriptionPlan
    );

    const selectedRank = getPlanRank(selectedPlan.name || selectedPlan.planName);

    const currentExpiry =
      currentSubscription?.endedDate ||
      currentSubscription?.endDate ||
      currentSubscription?.expiryDate ||
      currentSubscription?.expiredOn ||
      currentSubscription?.validTill;

    const expiryDate = parseDateSafe(currentExpiry);
    const isExpired = expiryDate ? expiryDate < new Date() : false;
    const hasActivePlan = currentSubscription && currentStatus === "active" && !isExpired;

    if (!currentSubscription || !hasActivePlan) {
      if (currentSubscription && selectedRank === currentRank) return "Renew Plan";
      return "Subscribe Plan";
    }

    if (selectedRank > currentRank) return "Upgrade Plan";
    if (selectedRank < currentRank) return "Schedule Downgrade";
    if (selectedRank === currentRank) return "Current Plan";

    return "Subscribe Plan";
  }

  function isActionDisabled(selectedPlan, currentSubscription, isProcessing) {
    if (!selectedPlan || isProcessing) return true;

    const label = getPlanActionLabel(selectedPlan, currentSubscription);
    return label === "Current Plan";
  }

  const handlePlanAction = () => {
    if (!selectedPlan) return;
    navigate("/dashboard/growplan/review", { state: { selectedPlan, currentSubscription, plans, subscriptionList, walletBalance: availableBalance } });
  };

  // Development logs
  console.log("[GrowPlan] Plans Response", plansRes);
  console.log("[GrowPlan] Seller Subscription Response", subscriptionRes);
  console.log("[GrowPlan] Current Subscription", currentSubscription);
  console.log("[GrowPlan] Current Plan Name", currentPlanName);
  console.log("[GrowPlan] Expiry Date", expiryDate);
  console.log("[GrowPlan] Is Expired", isExpired);

  // Calculations effect
  useEffect(() => {
    if (!selectedPlan) return;

    // Find oldPlan corresponding to current subscription
    const oldPlan = plans?.find(p =>
      p.id === currentSubscription?.planId ||
      p._id === currentSubscription?.planId ||
      normalize(p.name) === normalize(currentSubscription?.planName || currentSubscription?.plan)
    );

    // startedDate and endedDate (inclusive end-date business rule:
    // endDate = startDate + durationMonths - 1 day)
    let startD = new Date();
    const isRenew = currentSubscription &&
      normalize(selectedPlan.name) === normalize(currentSubscription.planName || currentSubscription.plan || currentSubscription.subscriptionPlan);

    const oldExpiry = currentSubscription ? parseLocalDate(
      currentSubscription.endDate ||
      currentSubscription.endedDate ||
      currentSubscription.expiryDate ||
      currentSubscription.expiredOn ||
      currentSubscription.validTill
    ) : null;
    const isOldActive = oldExpiry ? oldExpiry >= new Date() : false;

    if (isRenew && isOldActive) {
      // Use the TRUE (inclusive) old expiry so legacy exclusive backend
      // records don't push the renewal start date out by an extra day.
      const effectiveOldEnd = getInclusiveEffectiveEndDate(currentSubscription) || oldExpiry;
      startD = new Date(effectiveOldEnd.getTime());
      startD.setDate(startD.getDate() + 1);
    }

    const pricing = calculatePlanPricing({
      selectedPlan,
      planDuration,
      currentSubscription,
      oldPlan,
      selectedStartDate: startD,
      discountAmount,
      useWallet,
      walletBalance: availableBalance,
      plans
    });

    const {
      basePrice,
      totalPrice,
      remainingAmount,
      walletUsedAmount,
      payableAmount
    } = pricing;

    setBaseAmount(basePrice);
    setOriginalTotal(totalPrice);
    setRemainingAmount(remainingAmount);
    setWalletUsedAmount(walletUsedAmount);
    setTotalPayableAmount(payableAmount);

    const startIso = toApiDateOnlyIso(startD);
    setStartedDate(startIso);

    const calculatedEndDate = calculateInclusiveEndDate(startD, planDuration);
    const endIso = toApiDateOnlyIso(calculatedEndDate);
    setEndedDate(endIso);

    console.log("[GrowPlan Date Debug]", {
      startDate: startIso,
      planDuration,
      calculatedEndDate: endIso,
      apiStartedDate: startIso,
      apiEndedDate: endIso
    });

  }, [selectedPlan, currentSubscription, planDuration, useWallet, discountAmount, availableBalance, plans]);

  const payableAmount = totalPayableAmount;

  // Handle Referral Check
  const handleApplyReferral = async () => {
    if (!referralCode.trim()) return;

    setCheckingReferral(true);
    setReferralMessage({ text: "", type: "" });
    setReferralDiscount(0);
    setAppliedReferralCode("");
    setIsCouponApplied(false);

    const enteredCode = referralCode.trim();

    console.log("[GrowPlanPage] Checking referral code:", enteredCode);

    try {
      const res = await sellerService.referralCheck(enteredCode);
      console.log("[GrowPlanPage] Referral Check Response:", res);

      const isValid = res?.message?.valid === true || res?.valid === true;
      const discountVal = Number(res?.message?.rewardAmount || res?.message?.discount || res?.message?.amount || res?.rewardAmount || res?.discount || 0);

      if (isValid) {
        setReferralDiscount(discountVal);
        setAppliedReferralCode(enteredCode);
        setIsCouponApplied(true);
        setReferralMessage({
          text: `Referral code applied successfully! Saved ₹${discountVal}.`,
          type: "success"
        });
        showToast("Coupon applied successfully");
      } else {
        setReferralMessage({
          text: "Invalid referral code.",
          type: "error"
        });
        showToast("Invalid coupon");
      }
    } catch (err) {
      console.error("[GrowPlanPage] Referral check error:", err);
      setReferralMessage({
        text: "Failed to verify referral code.",
        type: "error"
      });
      showToast("Invalid coupon");
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

    // Validation
    if (!selectedPlan) {
      setErrorMsg("Validation failed: selectedPlan is missing");
      return;
    }
    if (!sellerId || !sellerEmail) {
      setErrorMsg("Validation failed: sellerId or sellerEmail is missing");
      return;
    }
    if (isNaN(totalPayableAmount) || totalPayableAmount < 0) {
      setErrorMsg("Validation failed: totalPayableAmount is invalid");
      return;
    }

    paymentInProgressRef.current = true;
    setIsProcessingPayment(true);
    setPaymentStatus("processing");
    setErrorMsg(null);

    console.log("[GrowPlan] selectedPlan:", selectedPlan);
    console.log("[GrowPlan] calculated amount:", totalPayableAmount);

    try {
      // Step 4 of Validation: If totalPayableAmount is 0 and walletUsedAmount > 0, skip Razorpay
      if (totalPayableAmount === 0 && walletUsedAmount > 0) {
        await completeSubscriptionActivation("wallet_payment", "wallet_order");
        return;
      }

      // Otherwise, proceed with Razorpay payment
      setProcessingMessage("Creating payment order...");

      const paymentAmountForRazorpay = Math.round(totalPayableAmount);
      const createOrderPayload = {
        amount: paymentAmountForRazorpay,
        currency: "INR",
        receipt: `rcpt_${Date.now()}`
      };

      console.log("[GrowPlan] createRazorpayOrder payload:", createOrderPayload);
      const orderRes = await sellerService.createRazorpayOrder(createOrderPayload);
      console.log("[GrowPlan] Razorpay order response:", orderRes);

      const orderData = orderRes?.message?.order;
      const razorpayOrderId = orderData?.id;
      const razorpayKey = orderRes?.message?.keyId;
      const currency = orderData?.currency || "INR";

      if (!razorpayOrderId || !razorpayKey) {
        throw new Error("Razorpay order creation failed: keyId or order id is missing.");
      }

      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error("Razorpay payment SDK failed to load.");
      }

      const options = {
        key: razorpayKey,
        amount: orderData.amount,
        name: "Haatza India Private Limited",
        order_id: razorpayOrderId,
        description: sellerId,
        handler: async function (razorpayResponse) {
          console.log("[GrowPlan] Razorpay Success Response:", razorpayResponse);

          setPaymentStatus("updating_subscription");
          setViewState("success");
          setProcessingMessage("Verifying payment...");

          try {
            const verifyPayload = {
              orderId: razorpayResponse.razorpay_order_id,
              paymentId: razorpayResponse.razorpay_payment_id,
              signature: razorpayResponse.razorpay_signature
            };

            console.log("[GrowPlan] verify payment payload:", verifyPayload);
            const verifyRes = await sellerService.verifyRazorpayPayment(verifyPayload);
            console.log("[GrowPlan] verify payment response:", verifyRes);

            const verified = verifyRes?.status === "success" && verifyRes?.message?.verified === true;
            if (!verified) {
              throw new Error("Payment verification failed");
            }

            await completeSubscriptionActivation(
              razorpayResponse.razorpay_payment_id,
              razorpayResponse.razorpay_order_id
            );

          } catch (verifyErr) {
            console.error("[GrowPlan] Verification/Activation error:", verifyErr);
            setPaymentStatus("refund");
            setSubscriptionWarning("Payment received but subscription was not activated. Please contact support.");
            setIsProcessingPayment(false);
            paymentInProgressRef.current = false;
          }
        },
        prefill: {
          name: sellerProfile?.name || sellerProfile?.companyName || "",
          email: sellerEmail || "",
          contact: sellerProfile?.phone || "",
        },
        theme: {
          color: "#3399cc",
        },
        modal: {
          ondismiss: function () {
            console.log("[GrowPlanPage] Razorpay modal dismissed by user.");
            setIsProcessingPayment(false);
            paymentInProgressRef.current = false;
            setErrorMsg("Payment checkout cancelled.");
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", function (resp) {
        console.error("[GrowPlanPage] Razorpay Payment failed:", resp.error);
        setIsProcessingPayment(false);
        paymentInProgressRef.current = false;
        setErrorMsg(resp.error?.description || "Payment failed. Please try again.");
      });

      rzp.open();

    } catch (err) {
      console.error("[GrowPlanPage] Subscription initiation error:", err);
      setErrorMsg(err.message || "Failed to subscribe. Please try again.");
      setIsProcessingPayment(false);
      paymentInProgressRef.current = false;
    }
  };

  const completeSubscriptionActivation = async (paymentId, orderId) => {
    try {
      setProcessingMessage("Activating subscription...");

      const safeText = (value, fallback = "NA") => {
        if (value === undefined || value === null) return fallback;
        const textValue = String(value).trim();
        return textValue.length > 0 ? textValue : fallback;
      };

      const toApiMidnightIso = (value) => {
        if (!value) {
          const now = new Date();
          const yyyy = now.getFullYear();
          const mm = String(now.getMonth() + 1).padStart(2, "0");
          const dd = String(now.getDate()).padStart(2, "0");
          return `${yyyy}-${mm}-${dd}T00:00:00.000Z`;
        }

        if (typeof value === "string") {
          const datePart = value.includes("T") ? value.split("T")[0] : value;
          const parts = datePart.split("-");
          if (parts.length === 3) {
            // yyyy-mm-dd
            if (parts[0].length === 4) {
              return `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}T00:00:00.000Z`;
            }
            // dd-mm-yyyy
            return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}T00:00:00.000Z`;
          }
        }

        const parsed = parseDateSafe(value) || new Date(value);
        if (Number.isNaN(parsed.getTime())) {
          const now = new Date();
          const yyyy = now.getFullYear();
          const mm = String(now.getMonth() + 1).padStart(2, "0");
          const dd = String(now.getDate()).padStart(2, "0");
          return `${yyyy}-${mm}-${dd}T00:00:00.000Z`;
        }

        const yyyy = parsed.getFullYear();
        const mm = String(parsed.getMonth() + 1).padStart(2, "0");
        const dd = String(parsed.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}T00:00:00.000Z`;
      };

      const addDaysToApiIso = (value, days) => {
        const parsed = parseDateSafe(value) || new Date(value);
        parsed.setDate(parsed.getDate() + days);
        return toApiMidnightIso(parsed);
      };

      const toApiEndOfDayIso = (value) => {
        const startIso = toApiMidnightIso(value);
        return `${startIso.split("T")[0]}T00:00:00.000Z`;
      };

      const calculateEndApiIso = (startIso, durationVal) => {
        const start = parseDateSafe(startIso) || new Date(startIso);
        const monthsToAdd = getDurationMonthsCount(durationVal);
        const end = new Date(start.getTime());
        end.setMonth(end.getMonth() + monthsToAdd);
        end.setDate(end.getDate() - 1);
        return toApiEndOfDayIso(end);
      };

      const sellerName = safeText(
        sellerProfile?.companyName ||
        sellerProfile?.businessName ||
        sellerProfile?.sellerName ||
        sellerProfile?.nickname ||
        sellerProfile?.name ||
        sellerEmail,
        sellerId
      );

      const sellerAddress = safeText(
        [
          sellerProfile?.address,
          sellerProfile?.city,
          sellerProfile?.state,
          sellerProfile?.pincode
        ]
          .filter(Boolean)
          .map((value) => String(value).trim())
          .filter((value) => value.length > 0)
          .join(", "),
        "NA"
      );

      const sellerGstin = safeText(sellerProfile?.gstin || sellerProfile?.GSTIN, "NA");
      const sellerPhone = safeText(sellerProfile?.phone || sellerProfile?.phoneNo || "", "");

      const selectedPlanId =
        selectedPlan?.planId ||
        selectedPlan?._id ||
        selectedPlan?.id ||
        "";

      const currentTableId =
        currentSubscription?.TableID ||
        currentSubscription?.tableId ||
        currentSubscription?._id ||
        "";

      const oldExpiry = currentSubscription ? parseLocalDate(
        currentSubscription.endDate ||
        currentSubscription.endedDate ||
        currentSubscription.expiryDate ||
        currentSubscription.expiredOn ||
        currentSubscription.validTill
      ) : null;

      const effectiveOldExpiry = currentSubscription ? getInclusiveEffectiveEndDate(currentSubscription) : null;

      const isOldActive = oldExpiry ? oldExpiry >= new Date() : false;

      const currentPlanRank = getPlanRank(
        currentSubscription?.planName ||
        currentSubscription?.plan ||
        currentSubscription?.subscriptionPlan
      );
      const selectedPlanRank = getPlanRank(selectedPlan?.name);

      const isSamePlan = Boolean(currentSubscription && selectedPlanRank === currentPlanRank);
      const isRenewPlan = Boolean(currentSubscription && isSamePlan);
      const isUpgradePlan = Boolean(currentSubscription && isOldActive && selectedPlanRank > currentPlanRank);
      const isDowngradePlan = Boolean(currentSubscription && isOldActive && selectedPlanRank < currentPlanRank);
      const flowType = isDowngradePlan
        ? "downgrade"
        : isUpgradePlan
          ? "upgrade"
          : isRenewPlan
            ? "renew"
            : "subscribe";

      let finalStartedDate = toApiMidnightIso(startedDate || new Date());
      let finalEndedDate = endedDate ? toApiEndOfDayIso(endedDate) : calculateEndApiIso(finalStartedDate, planDuration);

      // Downgrade and renewal must start after current plan expiry.
      if ((isDowngradePlan || isRenewPlan) && effectiveOldExpiry) {
        finalStartedDate = addDaysToApiIso(effectiveOldExpiry, 1);
        finalEndedDate = calculateEndApiIso(finalStartedDate, planDuration);
      }

      console.log("[GrowPlan Date Debug]", {
        startDate: finalStartedDate,
        planDuration,
        calculatedEndDate: finalEndedDate,
        apiStartedDate: finalStartedDate,
        apiEndedDate: finalEndedDate
      });

      const subStatus = isDowngradePlan ? "Scheduled" : "Active";

      const tableIdToUse =
        (isUpgradePlan || isRenewPlan)
          ? currentTableId
          : "";

      const totalPayableBeforeWallet = totalPayableAmount + walletUsedAmount;
      const walletPaymentAmount = Number(walletUsedAmount || 0);
      const upiPaymentAmount = Number(totalPayableAmount || 0);
      const paidAmount = walletPaymentAmount + upiPaymentAmount;

      const invoiceData = {
        invoiceDate: new Date().toISOString(),
        sellerName: sellerName,
        sellerId: sellerId,
        address: sellerAddress,
        gstin: sellerGstin,
        item: selectedPlan.name,
        qty: 1,
        rate: totalPayableBeforeWallet,
        amount: originalTotal,
        originalPlanAmount: originalTotal,
        waivedAmount: remainingAmount,
        remainingSubscriptionValue: remainingAmount,
        discountAmount: discountAmount,
        subtotal: totalPayableBeforeWallet,
        totalPayable: totalPayableBeforeWallet,
        payableAmount: totalPayableAmount,
        payments: {
          wallet: walletPaymentAmount,
          upi: upiPaymentAmount
        },
        paymentMethod: walletPaymentAmount > 0 && upiPaymentAmount === 0
          ? "Wallet"
          : walletPaymentAmount > 0 && upiPaymentAmount > 0
            ? "Wallet + UPI"
            : "UPI",
        transactionMethod: walletPaymentAmount > 0 && upiPaymentAmount === 0
          ? "Wallet"
          : walletPaymentAmount > 0 && upiPaymentAmount > 0
            ? "Wallet + UPI"
            : "UPI"
      };

      const subPayload = {
        tableId: tableIdToUse,
        planName: selectedPlan.name,
        planId: selectedPlanId,
        status: subStatus,
        email: sellerEmail,
        startedDate: finalStartedDate,
        endedDate: finalEndedDate,
        paymentId: paymentId,
        razorpayOrderId: orderId,
        sellerId: sellerId,
        phone: sellerPhone,
        amount: originalTotal,
        originalPlanAmount: originalTotal,
        payableAmount: totalPayableAmount,
        waivedAmount: remainingAmount,
        remainingSubscriptionValue: remainingAmount,
        subtotal: totalPayableBeforeWallet,
        totalPayable: totalPayableBeforeWallet,
        walletAmount: walletPaymentAmount,
        razorpayAmount: upiPaymentAmount,
        paymentMethod: walletPaymentAmount > 0 && upiPaymentAmount === 0
          ? "Wallet"
          : walletPaymentAmount > 0 && upiPaymentAmount > 0
            ? "Wallet + UPI"
            : "UPI",
        paidAmount: paidAmount
      };

      const referralPayload = {
        rewardEarned: isCouponApplied ? discountAmount : 0,
        rewardUsed: isCouponApplied ? 1 : 0,
        referralCode: isCouponApplied ? (appliedReferralCode || couponCode || "") : ""
      };

      const storePayload = {
        createSellerInvoice: invoiceData,
        createSubscription: subPayload,
        referralUpdate: referralPayload
      };

      console.log("[GrowPlan] flowType:", flowType);
      console.log("[GrowPlan] tableIdToUse:", tableIdToUse);
      console.log("[GrowPlan] createSubscription payload:", subPayload);
      console.log("[GrowPlan] processSubscriptionOrder payload:", storePayload);

      const storeRes = await sellerService.processSubscriptionOrder(storePayload);
      console.log("[GrowPlan] processSubscriptionOrder response:", storeRes);

      const success = storeRes?.status === "success" &&
        storeRes?.message?.message === "Subscription order processed successfully";

      if (!success) {
        throw new Error(storeRes?.message?.error || "Subscription activation failed on backend.");
      }

      setPaymentStatus("success");

      if (isDowngradePlan) {
        showToast("Downgrade scheduled successfully!");
      } else if (isRenewPlan) {
        showToast("Plan renewed successfully!");
      } else if (isUpgradePlan) {
        showToast("Plan upgraded successfully!");
      } else {
        showToast("Subscription successful!");
      }

      try {
        const subRes = await sellerService.getSellerSubscription(sellerEmail);
        setSubscriptionRes(subRes);
        const orders = extractSubscriptionOrders(subRes);
        setSubscriptionList(orders);
        const latest = getLatestSubscription(orders);
        console.log("[GrowPlan] subscription orders:", orders);
        console.log("[GrowPlan] selected current subscription:", latest);
        setCurrentSubscription(latest);
      } catch (err) {
        console.error("[GrowPlanPage] Refetch subscription failed:", err);
      }

      try {
        const walletRes = await sellerService.checkWalletBalance(sellerId);
        setAvailableBalance(extractWalletBalance(walletRes));
      } catch (err) {
        console.error("[GrowPlanPage] Refetch wallet balance failed:", err);
      }

      setViewState("success");

    } catch (err) {
      console.error("[GrowPlanPage] Activation failed:", err);
      setPaymentStatus("refund");
      setSubscriptionWarning("Payment received but subscription was not activated. Please contact support.");
    } finally {
      setIsProcessingPayment(false);
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
    setSubscriptionWarning("");
    setPaymentStatus("");
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

  return (
    <div className={`grow-plan-container ${selectedPlan ? "has-sticky-action" : ""}`}>
      {toastMessage && (
        <div className="grow-success-banner" style={{ background: "#ecfdf5", borderColor: "#a7f3d0", color: "#065f46", padding: "12px", borderRadius: "8px", marginBottom: "20px", display: "flex", justifyContent: "space-between", border: "1px solid" }}>
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} style={{ background: "none", border: "none", color: "#047857", cursor: "pointer", fontWeight: "bold" }}>&times;</button>
        </div>
      )}
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
          const isSelected = Boolean(
            selectedPlan &&
            (
              (selectedPlan.id && plan.id && String(selectedPlan.id) === String(plan.id)) ||
              (selectedPlan._id && plan._id && String(selectedPlan._id) === String(plan._id)) ||
              normalize(selectedPlan.name || selectedPlan.planName) === normalize(plan.name || plan.planName)
            )
          );
          const isCurrent = isCurrentActivePlan(plan);
          const isScheduled = isScheduledPlan(plan);
          const featuresToShow = plan.features || [];

          return (
            <div
              className={[
                "plan-card",
                plan.recommended ? "recommended" : "",
                isSelected ? "selected" : "",
                isCurrent ? "current" : "",
                isScheduled ? "scheduled" : ""
              ].filter(Boolean).join(" ")}
              key={plan.id}
              onClick={() => handleSelectPlan(plan)}
              role="radio"
              aria-checked={isSelected}
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handleSelectPlan(plan);
                }
              }}
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

              {isCurrent && (
                <div className="plan-status-banner active">
                  Current plan active till: {formatCurrentPlanActiveTill(currentSubscription, scheduledSubscription)}
                </div>
              )}

              {isScheduled && (
                <div className="plan-status-banner scheduled">
                  Scheduled plan starts on: {formatPlanDate(
                    scheduledSubscription.startedDate ||
                    scheduledSubscription.startDate
                  )}
                </div>
              )}

              <div className="plan-expanded-details">
                <div className="plan-divider" />
                <div className="plan-features-title">What's included:</div>
                <ul className="plan-features-list">
                  {(plan.features || []).map((feat, idx) => (
                    <li className="plan-feature-item" key={idx}>
                      <CheckCircle2 size={16} className="feature-check-icon" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>
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
      {selectedPlan && (
        <div className="grow-plan-sticky-footer">
          <div className="grow-plan-sticky-action">
            <div className="grow-plan-sticky-left">
              <div style={{ fontWeight: "700", fontSize: "16px", color: "#1e293b" }}>
                Selected: {selectedPlan.name} &bull; ₹{selectedPlan.price.toLocaleString("en-IN")}/month
              </div>
              {currentPlanName && (
                <div style={{ fontSize: "13px", color: "#64748b", fontWeight: "600", marginTop: "2px" }}>
                  Current plan: {currentPlanName}
                </div>
              )}
              {isSelectedDowngrade && scheduledSubscription && (
                <div className="scheduled-plan-action-note">
                  You already have a scheduled plan: {scheduledSubscription.planName || scheduledSubscription.plan} starts on {formatPlanDate(
                    scheduledSubscription.startedDate ||
                    scheduledSubscription.startDate
                  )}
                </div>
              )}
            </div>
            <div className="grow-plan-sticky-right grow-plan-action-bar">
              <button
                onClick={handlePlanAction}
                disabled={isActionDisabled(selectedPlan, currentSubscription, false)}
                className="btn-review-upgrade-cta grow-plan-action-btn"
                style={{
                  backgroundColor: isActionDisabled(selectedPlan, currentSubscription, false) ? "#cbd5e1" : "#2962ff",
                  color: "#ffffff",
                  border: "none",
                  cursor: isActionDisabled(selectedPlan, currentSubscription, false) ? "not-allowed" : "pointer"
                }}
              >
                {getPlanActionLabel(selectedPlan, currentSubscription)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GrowPlanPage;