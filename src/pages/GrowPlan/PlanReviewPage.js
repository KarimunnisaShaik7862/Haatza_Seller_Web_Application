import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate, Navigate } from "react-router-dom";
import { ChevronLeft, CheckCircle2 } from "lucide-react";
import { resolveSellerId, resolveSellerEmail, resolveSellerPhone } from "../../utils/sellerSession";
import { sellerService } from "../../services/sellerService";
import "./PlanReviewPage.css";

// TEST MODE FOR QA: keep this true while testing all Grow Plan flows.
// Razorpay will charge only ₹1, while the page still calculates the real
// plan price, wallet adjustment, coupon discount, upgrade waive-off, and downgrade scheduling.
// Set this to false before production release.
const FORCE_GROW_PLAN_ONE_RUPEE_TEST = true;

const IS_SUBSCRIPTION_TEST_PAYMENT =
  FORCE_GROW_PLAN_ONE_RUPEE_TEST ||
  process.env.REACT_APP_SUBSCRIPTION_TEST_PAYMENT === "true" ||
  process.env.REACT_APP_GROW_PLAN_TEST_PAYMENT === "true";

const isGrowPlanTestPayment = IS_SUBSCRIPTION_TEST_PAYMENT;

const growPlanTestAmount = Number(
  process.env.REACT_APP_GROW_PLAN_TEST_AMOUNT ||
  1
);

const getRazorpayAmount = (actualPayableAmount) => {
  const amount = Number(actualPayableAmount || 0);
  if (isGrowPlanTestPayment) return growPlanTestAmount;
  return Math.round(amount);
};

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

const normalize = (value) => String(value || "").trim().toLowerCase();

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

// ─── Plan hierarchy helpers ────────────────────────────────────────────────
const PLAN_RANK = {
  growth: 1,
  pro: 2,
  enterprise: 3
};

function getPlanRank(planName) {
  const name = String(planName || "").trim().toLowerCase();
  if (name.includes("enterprise")) return 3;
  if (name.includes("pro")) return 2;
  if (name.includes("growth")) return 1;
  return 0;
}

const getDurationMultiplier = (duration) => {
  if (duration === "12 Months") return 10;
  if (duration === "6 Months") return 5;
  if (duration === "3 Months") return 3;
  return 1;
};

const calculateExactMonths = (start, end) => {
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.round(diffDays / 30);
};

const daysBetween = (date1, date2) => {
  const d1 = new Date(date1.getFullYear(), date1.getMonth(), date1.getDate());
  const d2 = new Date(date2.getFullYear(), date2.getMonth(), date2.getDate());
  const diff = d2.getTime() - d1.getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
};

// Renewal window: 1/2 months = last 7 days, 3 months = last 14 days, 6/12 months = last 30 days
const getRenewalWindowDays = (months) => {
  if (months >= 6) return 30;
  if (months >= 3) return 14;
  return 7;
};

const isWithinRenewalWindow = (currentSubscription, oldExpiry) => {
  if (!currentSubscription || !oldExpiry) return false;
  const start = parseDateSafe(currentSubscription.startedDate || currentSubscription.startDate);
  if (!start) return false;
  const months = calculateExactMonths(start, oldExpiry);
  const windowDays = getRenewalWindowDays(months);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(oldExpiry);
  expiry.setHours(0, 0, 0, 0);

  const daysUntilExpiry = Math.round((expiry - today) / (1000 * 60 * 60 * 24));
  return daysUntilExpiry <= windowDays;
};

const toLocalYmd = (d) => {
  const offset = d.getTimezoneOffset();
  const localDate = new Date(d.getTime() - (offset * 60 * 1000));
  return localDate.toISOString().split("T")[0];
};

const startOfDay = (value) => {
  const d = parseDateSafe(value) || new Date(value);
  if (!d || Number.isNaN(d.getTime())) return null;
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const calculateOngoingPlanAdjustment = (currentSubscription, oldPlan, selectedStartDate) => {
  if (!currentSubscription || !oldPlan) return {
    oldEffectiveAmount: 0,
    usedAmount: 0,
    remainingAmount: 0
  };

  const start = new Date(currentSubscription.startedDate || currentSubscription.startDate);
  const end = new Date(currentSubscription.endedDate || currentSubscription.endDate);
  const selectedStart = new Date(selectedStartDate);

  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  selectedStart.setHours(0, 0, 0, 0);

  if (selectedStart > end) {
    return {
      oldEffectiveAmount: 0,
      usedAmount: 0,
      remainingAmount: 0
    };
  }

  const totalMonths = calculateExactMonths(start, end);
  const oldDuration =
    totalMonths >= 12 ? "12 Months" :
      totalMonths >= 6 ? "6 Months" :
        totalMonths >= 3 ? "3 Months" :
          "1 Month";

  const oldEffectiveAmount =
    Number(oldPlan.price || oldPlan.amount || 0) * getDurationMultiplier(oldDuration);

  const totalDays = daysBetween(start, end) + 1;
  const usedDays = Math.max(0, daysBetween(start, selectedStart));
  const dailyRate = oldEffectiveAmount / totalDays;

  const usedAmount = Math.min(oldEffectiveAmount, Math.round(dailyRate * usedDays));
  const remainingAmount = Math.max(0, oldEffectiveAmount - usedAmount);

  return {
    oldEffectiveAmount,
    usedAmount,
    remainingAmount
  };
};

const calculateEndDate = (startDateVal, duration) => {
  const months =
    duration === "12 Months" ? 12 :
      duration === "6 Months" ? 6 :
        duration === "3 Months" ? 3 : 1;

  const start = new Date(startDateVal);
  const end = new Date(start);
  end.setMonth(end.getMonth() + months);
  end.setDate(end.getDate() - 1);
  return end;
};

const PlanReviewPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const sellerId = resolveSellerId();
  const sellerEmail = resolveSellerEmail();

  // Retrieve state passed from React Router Link/navigate
  const { selectedPlan, currentSubscription, walletBalance: initialWallet, plans } = location.state || {};

  // Setup component states
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [planDuration, setPlanDuration] = useState("1 Month");
  const [showDurationModal, setShowDurationModal] = useState(false);
  const [useWallet, setUseWallet] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [appliedCouponCode, setAppliedCouponCode] = useState("");
  const [discountAmount, setDiscountAmount] = useState(0);
  const [isCouponApplied, setIsCouponApplied] = useState(false);

  const walletBalance = initialWallet || 0;
  const [checkingReferral, setCheckingReferral] = useState(false);
  const [referralMessage, setReferralMessage] = useState({ text: "", type: "" });
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [processingMessage, setProcessingMessage] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [errorMsg, setErrorMsg] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [sellerProfile, setSellerProfile] = useState(null);
  const [isFeaturesExpanded, setIsFeaturesExpanded] = useState(false);

  console.log("[PlanReview] paymentStatus:", paymentStatus);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());

  const datePickerRef = useRef(null);
  const durationRef = useRef(null);
  const paymentInProgressRef = useRef(false);

  // Click outside handlers
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (datePickerRef.current && !datePickerRef.current.contains(e.target)) {
        setShowDatePicker(false);
      }
      if (durationRef.current && !durationRef.current.contains(e.target)) {
        setShowDurationModal(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Expiry date parse. Mobile app treats the plan end date as inclusive.
  const currentPlanName = currentSubscription?.planName || currentSubscription?.plan;
  const oldStart = currentSubscription ? parseDateSafe(currentSubscription.startedDate || currentSubscription.startDate) : null;
  const oldExpiry = currentSubscription ? parseDateSafe(
    currentSubscription.endedDate ||
    currentSubscription.endDate ||
    currentSubscription.expiryDate ||
    currentSubscription.expiredOn ||
    currentSubscription.validTill
  ) : null;
  const todayOnly = startOfDay(new Date());
  const oldStartOnly = oldStart ? startOfDay(oldStart) : null;
  const oldExpiryOnly = oldExpiry ? startOfDay(oldExpiry) : null;
  const isOldActive = Boolean(
    currentSubscription &&
    oldStartOnly &&
    oldExpiryOnly &&
    todayOnly &&
    normalize(currentSubscription.status) === "active" &&
    todayOnly >= oldStartOnly &&
    todayOnly <= oldExpiryOnly
  );

  // Resolve old plan info
  const oldPlan = plans?.find(p =>
    p.id === currentSubscription?.planId ||
    p._id === currentSubscription?.planId ||
    normalize(p.name) === normalize(currentSubscription?.planName || currentSubscription?.plan)
  );

  // ─── Plan rank / upgrade / downgrade / renewal classification ───────────
  const currentRank = getPlanRank(currentSubscription?.planName || currentSubscription?.plan);
  const selectedRank = selectedPlan ? getPlanRank(selectedPlan.name || selectedPlan.planName) : 0;

  const isSamePlan = Boolean(currentSubscription && selectedRank === currentRank);
  const isUpgrade = Boolean(currentSubscription && isOldActive && selectedRank > currentRank);
  const isDowngrade = Boolean(currentSubscription && isOldActive && selectedRank < currentRank);
  const isRenewal = Boolean(currentSubscription && isSamePlan);
  const isActiveRenewal = Boolean(isRenewal && isOldActive);
  const isNewSubscription = !currentSubscription || (!isOldActive && !isRenewal);
  const flowType = isDowngrade
    ? "downgrade"
    : isUpgrade
      ? "upgrade"
      : isRenewal
        ? "renew"
        : "subscribe";

  const renewalAllowed = isActiveRenewal ? isWithinRenewalWindow(currentSubscription, oldExpiry) : true;

  // Force start date for downgrade / renewal: current plan expiry + 1 day.
  // Manual date selection is disabled for these cases (datepicker click is a no-op).
  useEffect(() => {
    if (!selectedPlan) return;
    if ((isDowngrade || isRenewal) && oldExpiry) {
      const forcedStart = new Date(oldExpiry.getTime());
      forcedStart.setDate(forcedStart.getDate() + 1);
      setStartDate(toLocalYmd(forcedStart));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDowngrade, isRenewal, oldExpiry ? oldExpiry.getTime() : null, selectedPlan]);

  // Start/End date constraints
  const getTodayYmd = () => {
    const d = new Date();
    return d.toISOString().split("T")[0];
  };



  const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const WEEK_DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  const getCalendarDays = () => {
    const days = [];
    const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay();
    const totalDays = new Date(viewYear, viewMonth + 1, 0).getDate();
    const prevMonthTotalDays = new Date(viewYear, viewMonth, 0).getDate();

    // Previous month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      days.push({
        day: prevMonthTotalDays - i,
        month: viewMonth === 0 ? 11 : viewMonth - 1,
        year: viewMonth === 0 ? viewYear - 1 : viewYear,
        isCurrentMonth: false
      });
    }

    // Current month days
    for (let i = 1; i <= totalDays; i++) {
      days.push({
        day: i,
        month: viewMonth,
        year: viewYear,
        isCurrentMonth: true
      });
    }

    // Next month padding
    const totalCells = days.length <= 35 ? 35 : 42;
    const nextMonthDaysCount = totalCells - days.length;
    for (let i = 1; i <= nextMonthDaysCount; i++) {
      days.push({
        day: i,
        month: viewMonth === 11 ? 0 : viewMonth + 1,
        year: viewMonth === 11 ? viewYear + 1 : viewYear,
        isCurrentMonth: false
      });
    }

    return days;
  };

  const isDateDisabled = (dayObj) => {
    const date = new Date(dayObj.year, dayObj.month, dayObj.day);
    date.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const maxDate = new Date();
    maxDate.setMonth(maxDate.getMonth() + 3);
    maxDate.setHours(0, 0, 0, 0);

    return date < today || date > maxDate;
  };

  // Manual date selection is only allowed for upgrade / new subscription flows.
  const isDatePickerLocked = isDowngrade || isRenewal;

  const handleSelectDate = (dayObj) => {
    if (isDatePickerLocked) return;
    const d = new Date(dayObj.year, dayObj.month, dayObj.day);
    const offset = d.getTimezoneOffset();
    const localDate = new Date(d.getTime() - (offset * 60 * 1000));
    const ymd = localDate.toISOString().split("T")[0];
    setStartDate(ymd);
    setShowDatePicker(false);
  };

  const getFormattedStartDate = () => {
    if (!startDate) return "";
    const [year, month, day] = startDate.split("-");
    return `${day}-${month}-${year}`;
  };

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  // Calculations
  const basePrice = selectedPlan ? Number(selectedPlan.price || 0) : 0;
  const newMultiplier = getDurationMultiplier(planDuration);
  const totalPrice = basePrice * newMultiplier;

  // Ongoing plan waive-off only applies to true upgrades.
  const { oldEffectiveAmount, usedAmount, remainingAmount } = (isUpgrade && oldPlan)
    ? calculateOngoingPlanAdjustment(currentSubscription, oldPlan, startDate)
    : { oldEffectiveAmount: 0, usedAmount: 0, remainingAmount: 0 };

  const payableBeforeWallet = Math.max(totalPrice - remainingAmount - discountAmount, 0);
  const walletUsedAmount = useWallet ? Math.min(walletBalance, payableBeforeWallet) : 0;
  const payableAmount = Math.max(payableBeforeWallet - walletUsedAmount, 0);

  const endDateObj = calculateEndDate(startDate, planDuration);

  // Detect future start date (Scheduled Plan)
  const todayStr = getTodayYmd();
  const isScheduled = startDate > todayStr;

  // Adaptive CTA Button Text
  const getCtaButtonText = () => {
    if (isRenewal) {
      return renewalAllowed ? "Renew Now" : "Current Plan";
    }
    if (isDowngrade) {
      return "Schedule Downgrade";
    }
    if (isUpgrade) {
      return "Upgrade Now";
    }
    return "Subscribe Now";
  };

  const getConfirmModalTitle = () => {
    if (isRenewal) return "Ready to renew?";
    if (isDowngrade) return "Ready to schedule downgrade?";
    if (isUpgrade) return "Ready to upgrade?";
    return "Ready to subscribe?";
  };

  const isCtaDisabled = isRenewal && !renewalAllowed;

  // Toast helper
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Fetch profiles on mount
  useEffect(() => {
    const fetchProfile = async () => {
      if (sellerEmail) {
        try {
          const profileRes = await sellerService.getUserProfile(sellerEmail);
          if (profileRes?.status === "success" || profileRes?.message) {
            setSellerProfile(profileRes.message);
          }
        } catch (err) {
          console.error("[PlanReview] Profile load error:", err);
        }
      }
    };
    fetchProfile();
  }, [sellerEmail]);

  // Handle Referral Check
  const handleApplyReferral = async () => {
    if (!couponCode.trim()) {
      showToast("Please enter referral code");
      return;
    }

    setCheckingReferral(true);
    setReferralMessage({ text: "", type: "" });
    setDiscountAmount(0);
    setAppliedCouponCode("");
    setIsCouponApplied(false);

    const code = couponCode.trim();

    try {
      const res = await sellerService.referralCheck(code);
      const success = res?.message?.valid === true || res?.valid === true;
      const discount = Number(res?.message?.rewardAmount || res?.message?.discount || res?.rewardAmount || 0);

      if (success) {
        setDiscountAmount(discount);
        setAppliedCouponCode(code);
        setIsCouponApplied(true);
        setReferralMessage({
          text: `Coupon applied successfully! Saved ₹${discount}.`,
          type: "success"
        });
        showToast("Coupon applied successfully");
      } else {
        setReferralMessage({
          text: "Invalid referral code",
          type: "error"
        });
        showToast("Invalid referral code");
      }
    } catch (err) {
      console.error("[PlanReview] Coupon apply error:", err);
      setReferralMessage({
        text: "Invalid referral code",
        type: "error"
      });
      showToast("Invalid referral code");
    } finally {
      setCheckingReferral(false);
    }
  };

  const completeSubscriptionActivation = async (paymentId, razorpayOrderId) => {
    try {
      setProcessingMessage("Activating subscription...");

      /*
        FINAL PAYLOAD RULES
        - Subscribe, upgrade, downgrade, and renewal all send full createSellerInvoice.
        - This function always sends populated createSellerInvoice data.
        - Downgrade creates a new Scheduled row with tableId: "".
        - Upgrade and renewal keep current tableId.
      */

      const safeValue = (value, fallback = "NA") => {
        if (value === undefined || value === null) return fallback;
        const text = String(value).trim();
        return text.length > 0 ? text : fallback;
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
            if (parts[0].length === 4) {
              return `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}T00:00:00.000Z`;
            }
            return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}T00:00:00.000Z`;
          }
        }

        const parsed = parseDateSafe(value) || new Date(value);
        if (Number.isNaN(parsed.getTime())) {
          return toApiMidnightIso(new Date());
        }

        const yyyy = parsed.getFullYear();
        const mm = String(parsed.getMonth() + 1).padStart(2, "0");
        const dd = String(parsed.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}T00:00:00.000Z`;
      };

      const toApiEndOfDayIso = (value) => {
        const startIso = toApiMidnightIso(value);
        return `${startIso.split("T")[0]}T23:59:59.999Z`;
      };

      const addDaysToApiIso = (value, days) => {
        const parsed = parseDateSafe(value) || new Date(value);
        parsed.setDate(parsed.getDate() + days);
        return toApiMidnightIso(parsed);
      };

      const calculateEndApiIso = (startIso, duration) => {
        const start = parseDateSafe(startIso) || new Date(startIso);
        const months =
          duration === "12 Months" ? 12 :
            duration === "6 Months" ? 6 :
              duration === "3 Months" ? 3 : 1;

        const end = new Date(start.getTime());
        end.setMonth(end.getMonth() + months);
        end.setDate(end.getDate() - 1);
        return toApiEndOfDayIso(end);
      };

      const getGstInclusiveBreakup = (total) => {
        const totalValue = Number(total || 0);
        const taxableAmount = Math.round(totalValue / 1.10);
        const taxAmount = Math.round(((totalValue - taxableAmount) / 2) * 100) / 100;
        return {
          rate: taxableAmount,
          amount: taxableAmount,
          subtotal: taxableAmount,
          cgst: taxAmount,
          sgst: taxAmount
        };
      };

      const sName = safeValue(
        sellerProfile?.companyName ||
        sellerProfile?.businessName ||
        sellerProfile?.sellerName ||
        sellerProfile?.nickname ||
        sellerProfile?.name ||
        sellerEmail,
        sellerId
      );

      const sAddress = safeValue(
        [
          sellerProfile?.address,
          sellerProfile?.city,
          sellerProfile?.state,
          sellerProfile?.pincode
        ].filter(Boolean).map(s => String(s).trim()).filter(s => s.length > 0).join(", "),
        "NA"
      );

      const sGstin = safeValue(
        sellerProfile?.gstin || sellerProfile?.GSTIN,
        "NA"
      );

      const sPhone = safeValue(
        sellerProfile?.phone ||
        resolveSellerPhone(),
        ""
      );

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

      let finalStartedDate = toApiMidnightIso(startDate);
      let finalEndedDate = calculateEndApiIso(finalStartedDate, planDuration);

      if ((isDowngrade || isRenewal) && oldExpiry) {
        finalStartedDate = addDaysToApiIso(oldExpiry, 1);
        finalEndedDate = calculateEndApiIso(finalStartedDate, planDuration);
      }

      const statusStr = isDowngrade ? "Scheduled" : "Active";

      const tableIdToUse = (isUpgrade || isRenewal) ? currentTableId : "";

      const invoicePayableAmount = payableAmount;
      const walletPaymentAmount = Number(walletUsedAmount || 0);
      const upiPaymentAmount = invoicePayableAmount;
      const gstBreakup = getGstInclusiveBreakup(invoicePayableAmount);

      const invoiceData = {
        invoiceDate: new Date().toISOString(),
        sellerName: sName,
        sellerId: sellerId,
        address: sAddress,
        gstin: sGstin,
        item: selectedPlan.name,
        qty: 1,
        rate: gstBreakup.rate,
        amount: gstBreakup.amount,
        subtotal: gstBreakup.subtotal,
        cgst: gstBreakup.cgst,
        sgst: gstBreakup.sgst,
        totalPayable: invoicePayableAmount,
        payments: {
          wallet: walletPaymentAmount,
          upi: upiPaymentAmount
        },
        transactionMethod: walletPaymentAmount > 0 && upiPaymentAmount === 0
          ? "Wallet"
          : walletPaymentAmount > 0 && upiPaymentAmount > 0
            ? "Wallet, UPI"
            : "UPI"
      };

      const subPayload = {
        tableId: tableIdToUse,
        planName: selectedPlan.name,
        planId: selectedPlanId,
        status: statusStr,
        email: sellerEmail,
        startedDate: finalStartedDate,
        endedDate: finalEndedDate,
        paymentId: paymentId,
        razorpayOrderId: razorpayOrderId,
        sellerId: sellerId,
        phone: sPhone
      };

      const referralPayload = {
        rewardEarned: isCouponApplied ? discountAmount : 0,
        rewardUsed: isCouponApplied ? 1 : 0,
        referralCode: isCouponApplied ? (appliedCouponCode || "") : ""
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

      const successToastMsg = isDowngrade
        ? "Downgrade scheduled successfully"
        : isRenewal
          ? "Plan renewed successfully"
          : isUpgrade
            ? "Plan upgraded successfully"
            : "Subscription successful";
      showToast(successToastMsg);

      try {
        await sellerService.getSellerSubscription(sellerEmail);
        await sellerService.checkWalletBalance(sellerId);
      } catch (err) {
        console.error("[PlanReview] Background status sync error:", err);
      }

      setTimeout(() => {
        navigate("/dashboard/growplan");
      }, 2000);

    } catch (err) {
      console.error("[PlanReview] Activation error:", err);
      setErrorMsg(err.message || "Activation failed. Please contact support.");
    } finally {
      setIsProcessingPayment(false);
      paymentInProgressRef.current = false;
    }
  };

  // Initiate Payment
  const handleProceedSubscription = async () => {
    setShowConfirmModal(false);

    if (paymentInProgressRef.current) return;

    if (!selectedPlan || !sellerId || !sellerEmail) {
      setErrorMsg("Missing selectedPlan or seller account details.");
      return;
    }

    if (isRenewal && !renewalAllowed) {
      setErrorMsg("You can renew this plan only near expiry period");
      showToast("You can renew this plan only near expiry period");
      return;
    }

    paymentInProgressRef.current = true;
    setIsProcessingPayment(true);
    setPaymentStatus("processing");
    setErrorMsg(null);

    try {
      // 0 payable bypass
      if (!isGrowPlanTestPayment && payableAmount === 0 && walletUsedAmount > 0) {
        await completeSubscriptionActivation(
          "wallet_payment_" + Date.now(),
          "wallet_order_" + Date.now()
        );
        return;
      }

      const paymentAmountForRazorpay = getRazorpayAmount(payableAmount);

      console.log("[GrowPlan] selectedPlan:", selectedPlan);
      console.log("[GrowPlan] currentSubscription:", currentSubscription);
      console.log("[GrowPlan] currentRank/selectedRank:", currentRank, selectedRank);
      console.log("[GrowPlan] isSamePlan/isUpgrade/isDowngrade/isRenewal:", isSamePlan, isUpgrade, isDowngrade, isRenewal);
      console.log("[GrowPlan] isScheduled:", isScheduled);
      console.log("[GrowPlan] oldEffectiveAmount/usedAmount/remainingAmount:", oldEffectiveAmount, usedAmount, remainingAmount);
      console.log("[GrowPlan] payableAmount:", payableAmount);
      console.log("[GrowPlan] paymentAmountForRazorpay:", paymentAmountForRazorpay);

      setProcessingMessage("Creating payment order...");
      const orderPayload = {
        amount: paymentAmountForRazorpay,
        currency: "INR",
        receipt: "rcpt_" + Date.now()
      };

      console.log("[GrowPlan] createRazorpayOrder payload:", orderPayload);
      const orderRes = await sellerService.createRazorpayOrder(orderPayload);
      console.log("[GrowPlan] createRazorpayOrder response:", orderRes);

      const orderData = orderRes?.message?.order;
      const razorpayOrderId = orderData?.id;
      const razorpayKey = orderRes?.message?.keyId;

      if (!razorpayOrderId || !razorpayKey) {
        throw new Error("Razorpay order token creation failed.");
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
        prefill: {
          name: sellerProfile?.name || sellerProfile?.companyName || "",
          contact: sellerProfile?.phone || "",
          email: sellerEmail
        },
        method: {
          upi: true,
          card: true,
          netbanking: true,
          wallet: true,
          emi: true
        },
        handler: async function (razorpayResponse) {
          console.log("[GrowPlan] Razorpay success:", {
            orderId: razorpayResponse.razorpay_order_id,
            paymentId: razorpayResponse.razorpay_payment_id
          });
          setProcessingMessage("Verifying payment transaction...");
          try {
            const verifyPayload = {
              orderId: razorpayResponse.razorpay_order_id,
              paymentId: razorpayResponse.razorpay_payment_id,
              signature: razorpayResponse.razorpay_signature
            };

            console.log("[GrowPlan] verifyRazorpayPayment payload:", verifyPayload);
            const verifyRes = await sellerService.verifyRazorpayPayment(verifyPayload);
            console.log("[GrowPlan] verifyRazorpayPayment response:", verifyRes);

            const verified = verifyRes?.status === "success" && verifyRes?.message?.verified === true;

            if (!verified) {
              throw new Error("Payment transaction verification failed");
            }

            await completeSubscriptionActivation(
              razorpayResponse.razorpay_payment_id,
              razorpayResponse.razorpay_order_id
            );
          } catch (err) {
            console.error("[PlanReview] Payment processing failed:", err);
            setPaymentStatus("failed");
            setErrorMsg(err.message || "Failed to process payment.");
            setIsProcessingPayment(false);
            paymentInProgressRef.current = false;
          }
        },
        theme: {
          color: "#2962ff"
        },
        modal: {
          ondismiss: function () {
            setIsProcessingPayment(false);
            paymentInProgressRef.current = false;
            setErrorMsg("Payment checkout cancelled.");
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();

    } catch (err) {
      console.error("[PlanReview] Initiate payment error:", err);
      setErrorMsg(err.message || "Failed to initiate checkout.");
      setIsProcessingPayment(false);
      paymentInProgressRef.current = false;
    }
  };

  if (!selectedPlan) {
    return <Navigate to="/dashboard/growplan" replace />;
  }

  // Features count limit
  const featuresToShow = isFeaturesExpanded ? selectedPlan.features : selectedPlan.features?.slice(0, 6);
  const hasMoreFeatures = selectedPlan.features?.length > 6;

  return (
    <>
      {isProcessingPayment && (
        <>
          <div className="payment-overlay" aria-hidden="true" />
          <div
            className="payment-loader"
            data-status={processingMessage || "processing"}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="payment-progress-title"
            aria-describedby="payment-progress-description"
          >
            <div className="grow-loading-spinner" />
            <h2 id="payment-progress-title">Payment in Progress...</h2>
            <p id="payment-progress-description">Please complete the payment in the Razorpay window.</p>
            <p>Do not refresh or close this page.</p>
          </div>
        </>
      )}

      <div className="grow-plan-container" inert={isProcessingPayment ? "" : undefined} aria-busy={isProcessingPayment}>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="grow-success-banner" style={{ background: "#ecfdf5", borderColor: "#a7f3d0", color: "#065f46", padding: "12px", borderRadius: "8px", marginBottom: "20px", display: "flex", justifyContent: "space-between", border: "1px solid" }}>
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} style={{ background: "none", border: "none", color: "#047857", cursor: "pointer", fontWeight: "bold" }}>&times;</button>
        </div>
      )}

      {/* breadcrumb */}
      <div className="grow-plan-breadcrumb" style={{ textAlign: "left" }}>
        <span>Dashboard</span> &gt; <span>Grow Plan</span> &gt; <span className="active">Plan Review</span>
      </div>

      {/* Header */}
      <div className="review-header-row" style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
        <button className="btn-back-plans" onClick={() => navigate("/dashboard/growplan")} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center" }}>
          <ChevronLeft size={24} />
        </button>
        <h1 style={{ margin: 0, fontSize: "24px", fontWeight: "700" }}>Plan Review</h1>
      </div>

      {errorMsg && (
        <div className="grow-error-banner" style={{ margin: "20px 0" }}>
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)}>&times;</button>
        </div>
      )}

      {/* Desktop 2-column Container */}
      <div className="plan-review-desktop-layout">
        {/* Left Column: Plan Card with Features */}
        <div className="plan-review-left-card">
          <h2 style={{ fontSize: "20px", fontWeight: "700", margin: "0 0 8px 0" }}>{selectedPlan.name}</h2>
          <div style={{ fontSize: "26px", fontWeight: "800", color: "#1e293b", marginBottom: "16px" }}>
            ₹{basePrice.toLocaleString("en-IN")} / month
          </div>

          <div className="review-divider" />

          <h3 style={{ fontSize: "15px", fontWeight: "700", color: "#64748b", margin: "16px 0 10px 0" }}>What's included:</h3>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "12px" }}>
            {featuresToShow?.map((feature, i) => (
              <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: "8px", fontSize: "14px", color: "#334155" }}>
                <CheckCircle2 size={18} style={{ color: "#10b981", flexShrink: 0, marginTop: "2px" }} />
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          {hasMoreFeatures && (
            <button
              onClick={() => setIsFeaturesExpanded(!isFeaturesExpanded)}
              style={{
                background: "none",
                border: "none",
                color: "#2962ff",
                fontWeight: "600",
                fontSize: "14px",
                cursor: "pointer",
                marginTop: "14px",
                padding: 0,
                textAlign: "left"
              }}
            >
              {isFeaturesExpanded ? "See Less" : "See More"}
            </button>
          )}
        </div>

        {/* Right Column: Review Details & Summary Card */}
        <div className="plan-review-right-card">

          {isDowngrade && (
            <div className="grow-plan-test-mode-note" style={{
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              color: "#1d4ed8",
              padding: "12px",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: "600",
              marginBottom: "16px",
              textAlign: "left"
            }}>
              Downgrade will start after your current plan ends.
            </div>
          )}

          {isRenewal && !renewalAllowed && (
            <div className="grow-plan-test-mode-note" style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#b91c1c",
              padding: "12px",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: "600",
              marginBottom: "16px",
              textAlign: "left"
            }}>
              You can renew this plan only near expiry period.
            </div>
          )}

          {/* 1. Start Date selector (Custom Datepicker Popover) */}
          <div className="start-date-block" ref={datePickerRef} style={{ textAlign: "left" }}>
            <label className="start-date-label">
              Start Date : {isScheduled && <span className="scheduled-badge" style={{ marginLeft: "8px" }}>Scheduled Plan</span>}
            </label>
            <div style={{ position: "relative" }}>
              <input
                type="text"
                readOnly
                value={getFormattedStartDate()}
                onClick={() => !isDatePickerLocked && setShowDatePicker(!showDatePicker)}
                className="start-date-input"
                style={isDatePickerLocked ? { cursor: "not-allowed", opacity: 0.75 } : undefined}
              />
              <svg
                onClick={() => !isDatePickerLocked && setShowDatePicker(!showDatePicker)}
                style={{
                  position: "absolute",
                  right: "16px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: "20px",
                  height: "20px",
                  cursor: isDatePickerLocked ? "not-allowed" : "pointer",
                  color: "#64748b"
                }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>

              {showDatePicker && !isDatePickerLocked && (
                <div className="date-picker-popover">
                  <div className="calendar-header">
                    <button type="button" onClick={handlePrevMonth} className="calendar-nav-btn">&lt;</button>
                    <span className="calendar-month-year">{MONTH_NAMES[viewMonth]} {viewYear}</span>
                    <button type="button" onClick={handleNextMonth} className="calendar-nav-btn">&gt;</button>
                  </div>
                  <div className="calendar-weekdays">
                    {WEEK_DAYS.map(day => (
                      <div key={day} className="calendar-weekday">{day}</div>
                    ))}
                  </div>
                  <div className="calendar-days-grid">
                    {getCalendarDays().map((dayObj, index) => {
                      const isDisabled = isDateDisabled(dayObj);
                      const isSelected = startDate === `${dayObj.year}-${String(dayObj.month + 1).padStart(2, "0")}-${String(dayObj.day).padStart(2, "0")}`;
                      const isCurrentDay = new Date().getDate() === dayObj.day && new Date().getMonth() === dayObj.month && new Date().getFullYear() === dayObj.year;

                      return (
                        <button
                          key={index}
                          type="button"
                          disabled={isDisabled}
                          onClick={() => handleSelectDate(dayObj)}
                          className={`calendar-day-cell ${!dayObj.isCurrentMonth ? "other-month" : ""} ${isSelected ? "selected" : ""} ${isCurrentDay ? "today" : ""}`}
                        >
                          {dayObj.day}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 2. Summary details list */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", margin: "20px 0" }}>
            <div className="plan-summary-row">
              <span>Plan</span>
              <span>{selectedPlan.name}</span>
            </div>

            <div className="plan-summary-row">
              <span>Plan Price</span>
              <span>₹{basePrice.toLocaleString("en-IN")}</span>
            </div>

            <div className="plan-summary-row">
              <span>Plan Duration</span>
              <div className="duration-select-wrap" ref={durationRef}>
                <button
                  type="button"
                  onClick={() => setShowDurationModal(!showDurationModal)}
                  className="duration-select-button"
                >
                  {planDuration}
                </button>
                {showDurationModal && (
                  <div className="duration-dropdown">
                    {["1 Month", "3 Months", "6 Months", "12 Months"].map((dur) => (
                      <button
                        key={dur}
                        type="button"
                        onClick={() => {
                          setPlanDuration(dur);
                          setShowDurationModal(false);
                        }}
                        className={`duration-dropdown-option ${planDuration === dur ? "active" : ""}`}
                      >
                        {dur}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="plan-summary-row">
              <span>Total Price</span>
              <span>₹{totalPrice.toLocaleString("en-IN")}</span>
            </div>

            {/* Upgrade ongoing details — shown only for true upgrades */}
            {isUpgrade && oldPlan && (
              <>
                <div className="plan-summary-row">
                  <span>Ongoing Plan</span>
                  <span>{currentSubscription.planName || currentSubscription.plan}</span>
                </div>
                <div className="plan-summary-row">
                  <span>Ongoing Plan Price</span>
                  <span>₹{Number(oldPlan.price || 0).toLocaleString("en-IN")}</span>
                </div>
                <div className="plan-summary-row">
                  <span>Ongoing Plan Spend Limit</span>
                  <span>₹{oldEffectiveAmount.toLocaleString("en-IN")}</span>
                </div>
                <div className="plan-summary-row" style={{ color: "#dc2626" }}>
                  <span>Ongoing Plan Used</span>
                  <span>- ₹{usedAmount.toLocaleString("en-IN")}</span>
                </div>
                <div className="plan-summary-row" style={{ color: "#059669" }}>
                  <span>Remaining Adjustment / Waive-off</span>
                  <span>- ₹{remainingAmount.toLocaleString("en-IN")}</span>
                </div>
              </>
            )}

            <div className="plan-summary-divider" style={{ borderTop: "1px solid #cbd5e1", margin: "12px 0" }} />

            <div className="plan-summary-row payable-row" style={{ fontSize: "16px", fontWeight: "800" }}>
              <span style={{ fontWeight: "700" }}>Payable Amount</span>
              <span style={{ fontWeight: "800", color: "#1e293b" }}>₹{payableAmount.toLocaleString("en-IN")}</span>
            </div>
          </div>

          {/* 3. Wallet Balance Section */}
          <div className="wallet-redeem-box">
            <input
              type="checkbox"
              id="walletRedeemCheck"
              checked={useWallet}
              onChange={(e) => setUseWallet(e.target.checked)}
              style={{ cursor: "pointer", width: "16px", height: "16px" }}
            />
            <label htmlFor="walletRedeemCheck" style={{ cursor: "pointer", fontSize: "14px", fontWeight: "600", color: "#334155", display: "flex", justifyContent: "space-between", width: "100%", margin: 0 }}>
              <span>Redeem Wallet Balance?</span>
              <span style={{ color: "#2962ff" }}>₹{walletBalance}</span>
            </label>
          </div>

          {/* 4. Referral Section */}
          <div className="referral-box">
            <input
              type="text"
              placeholder="Enter Referral Code"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
              disabled={checkingReferral || appliedCouponCode !== ""}
            />
            <button
              type="button"
              onClick={handleApplyReferral}
              disabled={checkingReferral || !couponCode.trim() || appliedCouponCode !== ""}
            >
              {checkingReferral ? "Applying..." : "Apply"}
            </button>
          </div>
          {referralMessage.text && (
            <div style={{
              marginTop: "-16px",
              marginBottom: "16px",
              fontSize: "12px",
              fontWeight: "600",
              color: referralMessage.type === "success" ? "#059669" : "#dc2626",
              textAlign: "left"
            }}>
              {referralMessage.text}
            </div>
          )}

          {isGrowPlanTestPayment && (
            <div className="grow-plan-test-mode-note" style={{
              background: "#fffbeb",
              border: "1px solid #fef3c7",
              color: "#b45309",
              padding: "12px",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: "600",
              marginBottom: "16px",
              textAlign: "left"
            }}>
              Test mode enabled: You will be charged ₹{growPlanTestAmount}. Actual calculated payable after coupon/wallet/upgrade adjustment is ₹{payableAmount.toLocaleString("en-IN")}. Wallet selection is allowed for calculation testing, but real wallet debit is not sent in test mode.
            </div>
          )}

          {/* 5. Upgrade Now / Submit Button */}
          <button
            className="btn-review-upgrade-cta"
            onClick={() => setShowConfirmModal(true)}
            disabled={isCtaDisabled}
            style={isCtaDisabled ? { opacity: 0.6, cursor: "not-allowed" } : undefined}
          >
            {getCtaButtonText()}
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="review-confirm-modal-overlay" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0, 0, 0, 0.4)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2000 }}>
          <div className="review-confirm-modal-container" style={{ background: "#ffffff", padding: "24px", borderRadius: "12px", width: "420px", boxShadow: "0 10px 25px rgba(0,0,0,0.1)", textAlign: "center" }}>
            <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#1e293b", margin: "0 0 16px 0", lineHeight: "1.5" }}>
              {getConfirmModalTitle()}
            </h3>
            <div style={{ color: "#10b981", fontSize: "18px", fontWeight: "800", marginBottom: "24px" }}>
              Payable Amount ₹{(isGrowPlanTestPayment ? growPlanTestAmount : payableAmount).toLocaleString("en-IN")}
            </div>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <button
                onClick={handleProceedSubscription}
                style={{
                  flex: 1,
                  padding: "10px 16px",
                  borderRadius: "6px",
                  border: "none",
                  backgroundColor: "#2962ff",
                  color: "#ffffff",
                  fontWeight: "bold",
                  cursor: "pointer"
                }}
              >
                Yes
              </button>
              <button
                onClick={() => setShowConfirmModal(false)}
                style={{
                  flex: 1,
                  padding: "10px 16px",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  backgroundColor: "#ffffff",
                  color: "#475569",
                  fontWeight: "bold",
                  cursor: "pointer"
                }}
              >
                No
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
};

export default PlanReviewPage;