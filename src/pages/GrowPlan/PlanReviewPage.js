import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate, Navigate } from "react-router-dom";
import { ChevronLeft, CheckCircle2 } from "lucide-react";
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
  isWithinRenewalWindow,
  calculatePlanPricing
} from "../../utils/pricingUtils";
import "./PlanReviewPage.css";

// Test payment mode has been permanently disabled for production use.
// Razorpay must always be charged the real calculated payable amount.
const FORCE_GROW_PLAN_ONE_RUPEE_TEST = false;

const getRazorpayAmount = (actualPayableAmount) => {
  const amount = Number(actualPayableAmount || 0);
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

const getSubscriptionPlanName = (subscription) =>
  subscription?.planName || subscription?.plan || subscription?.subscriptionPlan || "";

const getSubscriptionTableId = (subscription) =>
  subscription?.TableID || subscription?.tableId || subscription?._id || "";

const getSubscriptionStartYmd = (subscription) => {
  const value = subscription?.startedDate || subscription?.startDate;
  if (!value) return "";
  if (typeof value === "string") return value.includes("T") ? value.split("T")[0] : value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : toLocalYmd(date);
};

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

// Mobile-app-style short date format, e.g. "04 Jul 26"
const formatDisplayDate = (dateVal) => {
  if (!dateVal) return "-";
  const d = dateVal instanceof Date ? dateVal : parseDateSafe(dateVal);
  if (!d || isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });
};



// Current Plan card End Date display — always shows the corrected inclusive
// end date, regardless of whether the backend record was saved exclusively
// (legacy) or inclusively (correct). Never subtracts twice.
const formatCurrentPlanEndDate = (subscription) => {
  const effectiveEnd = getInclusiveEffectiveEndDate(subscription);
  return effectiveEnd ? formatDisplayDate(effectiveEnd) : "-";
};

const getScheduledPlanPrice = (sub, plans) => {
  if (!sub) return 0;
  const planName = getSubscriptionPlanName(sub);
  const planObj = plans?.find(p => normalize(p.name || p.planName) === normalize(planName));
  if (planObj) {
    const multiplier = getDurationMultiplier(sub.duration || sub.planDuration || sub.billingCycle || "1 Month");
    return Number(planObj.price || planObj.amount || 0) * multiplier;
  }
  // Static fallback
  const name = String(planName || "").toLowerCase();
  let price = 999;
  if (name.includes("enterprise")) price = 2499;
  else if (name.includes("pro")) price = 1999;
  else if (name.includes("growth")) price = 999;
  const multiplier = getDurationMultiplier(sub.duration || sub.planDuration || sub.billingCycle || "1 Month");
  return price * multiplier;
};

const safeNum = (val) => {
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
};

const getSubscriptionPaidAmount = (sub, plans) => {
  if (!sub) return 0;
  const fields = [
    sub.amountPaid,
    sub.transactionAmount,
    sub.paidAmount,
    sub.amount,
    sub.originalPlanAmount,
    sub.payableAmount,
    sub.totalPayable,
    sub.subtotal,
    sub.price,
    sub.PaidAmount,
    sub.Amount,
    sub.PayableAmount,
    sub.TotalPayable,
    sub.Price,
    sub.paidamount,
    sub.payableamount,
    sub.totalpayable
  ];
  for (const val of fields) {
    const num = Number(val);
    if (!isNaN(num) && num > 0) {
      return num;
    }
  }
  return getScheduledPlanPrice(sub, plans) || 0;
};

const calculateScheduledWaiveOff = (scheduledSubscription, plans, startDate) => {
  if (!scheduledSubscription) return 0;
  const proStart = parseLocalDate(scheduledSubscription.startedDate || scheduledSubscription.startDate);
  const proEnd = getInclusiveEffectiveEndDate(scheduledSubscription);
  const upgradeStart = parseLocalDate(startDate) || new Date();

  if (!proStart || !proEnd) return 0;

  const fullProPaidAmount = getSubscriptionPaidAmount(scheduledSubscription, plans);

  // Scenario 1: Enterprise starts before (or on) the scheduled Pro start date
  if (upgradeStart <= proStart) {
    return fullProPaidAmount;
  }

  // Scenario 2: Enterprise starts after the scheduled Pro start date
  if (upgradeStart > proEnd) {
    return 0;
  }

  // Otherwise, it starts during the Pro subscription period.
  const totalDays = daysBetween(proStart, proEnd) + 1;
  const unusedDays = daysBetween(upgradeStart, proEnd) + 1;
  const dailyRate = totalDays > 0 ? (fullProPaidAmount / totalDays) : 0;
  return totalDays > 0 ? Math.max(0, Math.round(unusedDays * dailyRate)) : 0;
};

const PlanReviewPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const sellerId = resolveSellerId();
  const sellerEmail = resolveSellerEmail();

  // Retrieve state passed from React Router Link/navigate
  const { selectedPlan, currentSubscription, walletBalance: initialWallet, plans, subscriptionList } = location.state || {};

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

  // If wallet balance is unavailable, make sure the "use wallet" toggle can't stay on.
  useEffect(() => {
    if (walletBalance <= 0 && useWallet) {
      setUseWallet(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletBalance]);

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
  // Effective (corrected-for-inclusivity) expiry — used whenever we need to
  // derive a "next start date" from the current plan's true end date.
  const effectiveOldExpiry = currentSubscription ? getInclusiveEffectiveEndDate(currentSubscription) : null;
  const todayOnly = startOfDay(new Date());
  const oldStartOnly = oldStart ? startOfDay(oldStart) : null;
  const oldExpiryOnly = oldExpiry ? startOfDay(oldExpiry) : null;
  const isOldActive = Boolean(
    currentSubscription &&
    normalize(currentSubscription.status) === "active"
  );

  // Resolve old plan info
  const oldPlan = plans?.find(p =>
    p.id === currentSubscription?.planId ||
    p._id === currentSubscription?.planId ||
    normalize(p.name) === normalize(currentSubscription?.planName || currentSubscription?.plan)
  );

  // Upcoming/scheduled plan (if any) for display on this page, from subscriptionList
  // passed via navigate state from GrowPlanPage.
  const scheduledSubscription = Array.isArray(subscriptionList)
    ? subscriptionList.find((s) => normalize(s?.status) === "scheduled")
    : null;

  // ─── Plan rank / upgrade / downgrade / renewal classification ───────────
  const currentRank = getPlanRank(currentSubscription?.planName || currentSubscription?.plan);
  const selectedRank = selectedPlan ? getPlanRank(selectedPlan.name || selectedPlan.planName) : 0;
  const scheduledPlanRank = getPlanRank(getSubscriptionPlanName(scheduledSubscription));
  const isScheduledReplacement = Boolean(
    scheduledSubscription &&
    selectedRank > scheduledPlanRank
  );

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

  // Default start date for downgrade / renewal / scheduled replacement:
  // For downgrade / renewal, starts 1 day after current plan expires.
  // For scheduled replacements, defaults to the existing scheduled plan's start date.
  useEffect(() => {
    if (!selectedPlan) return;
    if (isScheduledReplacement) {
      const scheduledStart = parseLocalDate(scheduledSubscription.startedDate || scheduledSubscription.startDate);
      if (scheduledStart) {
        setStartDate(toLocalYmd(scheduledStart));
        return;
      }
    }
    if ((isDowngrade || isRenewal) && effectiveOldExpiry) {
      const isExistingScheduledPlan = scheduledSubscription &&
        normalize(getSubscriptionPlanName(scheduledSubscription)) === normalize(selectedPlan?.name);
      const existingScheduledStart = isExistingScheduledPlan
        ? parseLocalDate(scheduledSubscription.startedDate || scheduledSubscription.startDate)
        : null;
      const forcedStart = existingScheduledStart || new Date(effectiveOldExpiry.getTime());
      if (!existingScheduledStart) forcedStart.setDate(forcedStart.getDate() + 1);
      const calculatedEndDate = calculateInclusiveEndDate(forcedStart, planDuration);
      setStartDate(toLocalYmd(forcedStart));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDowngrade, isRenewal, isScheduledReplacement, effectiveOldExpiry ? effectiveOldExpiry.getTime() : null, selectedPlan, scheduledSubscription]);

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

  const earliestDowngradeStart = effectiveOldExpiry
    ? new Date(effectiveOldExpiry.getFullYear(), effectiveOldExpiry.getMonth(), effectiveOldExpiry.getDate() + 1)
    : null;

  const isDateDisabled = (dayObj) => {
    const date = new Date(dayObj.year, dayObj.month, dayObj.day);
    date.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const maxDate = new Date(earliestDowngradeStart || today);
    maxDate.setMonth(maxDate.getMonth() + 12);
    maxDate.setHours(0, 0, 0, 0);

    const isDowngradeOrSame = isDowngrade || isRenewal || isSamePlan;
    const minimumDate = isDowngradeOrSame && earliestDowngradeStart ? earliestDowngradeStart : today;
    return date < minimumDate || date > maxDate;
  };

  // Renewals remain fixed; downgrades can be moved but never before active + 1 day.
  const isDatePickerLocked = isRenewal;

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

  // Centralized calculations
  const DURATION_ORDER = ["1 Month", "3 Months", "6 Months", "12 Months"];

  const activeEndObj = effectiveOldExpiry ? startOfDay(effectiveOldExpiry) : null;
  const startDayObj = startDate ? startOfDay(parseLocalDate(startDate)) : null;

  const shouldBypassActiveWaiveOff = Boolean(
    isScheduledReplacement &&
    activeEndObj &&
    startDayObj &&
    startDayObj > activeEndObj
  );

  const pricing = calculatePlanPricing({
    selectedPlan,
    planDuration,
    currentSubscription: shouldBypassActiveWaiveOff ? null : currentSubscription,
    oldPlan: shouldBypassActiveWaiveOff ? null : oldPlan,
    selectedStartDate: startDate,
    discountAmount,
    useWallet,
    walletBalance,
    plans
  });

  const basePrice = safeNum(pricing.basePrice);
  const totalPrice = safeNum(pricing.totalPrice);
  const remainingAmount = safeNum(pricing.remainingAmount);

  const scheduledPaidAmount = isScheduledReplacement
    ? calculateScheduledWaiveOff(scheduledSubscription, plans, startDate)
    : 0;


  const payableBeforeWallet = isScheduledReplacement
    ? safeNum(Math.max(totalPrice - remainingAmount - scheduledPaidAmount - discountAmount, 0))
    : safeNum(pricing.payableBeforeWallet);

  const walletUsedAmount = isScheduledReplacement
    ? safeNum(useWallet ? Math.min(walletBalance, payableBeforeWallet) : 0)
    : safeNum(pricing.walletUsedAmount);

  const payableAmount = isScheduledReplacement
    ? safeNum(Math.max(payableBeforeWallet - walletUsedAmount, 0))
    : safeNum(pricing.payableAmount);

  const { oldEffectiveAmount, remainingDays, totalDays, dailyRate } = pricing.waiveOffDetails;
  const usedAmount = Math.max(0, oldEffectiveAmount - remainingAmount);
  const availableWalletBalance = Number(walletBalance || 0);
  const remainingWalletBalance = Math.max(
    0,
    availableWalletBalance - Number(walletUsedAmount || 0)
  );
  const formatWalletCurrency = (value) =>
    Number(value || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });

  const getDurationTotalPrice = (duration) => basePrice * getDurationMultiplier(duration);

  const isDurationAllowedForUpgrade = (duration) => {
    if (!isUpgrade) return true;
    return getDurationTotalPrice(duration) >= remainingAmount;
  };

  // If the currently selected duration becomes invalid for an upgrade
  // (e.g. after remainingAmount recalculates), auto-switch to the first
  // allowed duration in priority order.
  useEffect(() => {
    if (!isUpgrade) return;
    if (isDurationAllowedForUpgrade(planDuration)) return;
    const nextAllowed = DURATION_ORDER.find((d) => isDurationAllowedForUpgrade(d));
    if (nextAllowed && nextAllowed !== planDuration) {
      setPlanDuration(nextAllowed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUpgrade, remainingAmount, basePrice, planDuration]);

  const endDateObj = calculateInclusiveEndDate(startDate, planDuration);

  // Detect future start date (Scheduled Plan)
  const todayStr = getTodayYmd();
  const isScheduled = startDate > todayStr;

  const isSameScheduledPlan = Boolean(
    scheduledSubscription && normalize(getSubscriptionPlanName(scheduledSubscription)) === normalize(selectedPlan?.name)
  );
  const isSameScheduledDate = isSameScheduledPlan && getSubscriptionStartYmd(scheduledSubscription) === startDate;
  const isReschedule = isSameScheduledPlan && !isSameScheduledDate;
  const displayedPlanDuration = isSameScheduledPlan
    ? (scheduledSubscription?.duration || scheduledSubscription?.planDuration || scheduledSubscription?.billingCycle || planDuration)
    : planDuration;
  const isFutureUpgrade = isUpgrade && isScheduled;
  const isImmediateUpgrade = isUpgrade && !isScheduled;

  const getSchedulingValidationMessage = () => {
    if (!scheduledSubscription) return "";

    // Rule 1 / Rule 4: Selected plan is LOWER than the scheduled plan.
    // This must be rejected unconditionally — even for immediate upgrades —
    // because the active plan would end AFTER the scheduled plan starts,
    // creating an overlapping, invalid subscription timeline.
    if (selectedRank < scheduledPlanRank) {
      const scheduledPlanName = getSubscriptionPlanName(scheduledSubscription);
      return `You already have a scheduled ${scheduledPlanName} plan. A lower plan cannot be purchased because it would create an invalid subscription timeline. Please cancel your scheduled ${scheduledPlanName} plan before purchasing a lower plan.`;
    }

    // For immediate upgrades where the selected rank is >= scheduled rank:
    // Rule 3 applies — the higher selected plan will replace the lower
    // scheduled plan. This is handled by schedulingAction: "replace" in
    // completeSubscriptionActivation, so no further check is needed here.
    if (isImmediateUpgrade) return "";

    if (isSameScheduledPlan) {
      return isSameScheduledDate ? "This plan is already scheduled for the selected date." : "";
    }

    if (selectedRank < currentRank) {
      return "You already have a scheduled downgrade. You can reschedule the same plan or cancel it before selecting another downgrade plan.";
    }

    return "";
  };

  // Adaptive CTA Button Text
  const getCtaButtonText = () => {
    if (isSameScheduledPlan) {
      return "Reschedule Plan";
    }
    if (isScheduledReplacement) {
      return "Replace Scheduled Plan";
    }
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
    if (isSameScheduledPlan) return "Ready to reschedule?";
    if (isScheduledReplacement) return "Ready to replace scheduled plan?";
    if (isRenewal) return "Ready to renew?";
    if (isDowngrade) return "Ready to schedule downgrade?";
    if (isUpgrade) return "Ready to upgrade?";
    return "Ready to subscribe?";
  };

  const hasScheduledConflict = Boolean(scheduledSubscription && selectedRank < scheduledPlanRank);
  const isCtaDisabled = hasScheduledConflict || (isRenewal && !renewalAllowed) || (isUpgrade && !isDurationAllowedForUpgrade(planDuration));

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
        // Keep subscription end dates as date-only midnight UTC.
        // Example: 04 Jul 26 + 1 Month => 03 Aug 26, not 04 Aug 26 in IST.
        return `${startIso.split("T")[0]}T00:00:00.000Z`;
      };

      const addDaysToApiIso = (value, days) => {
        const parsed = parseDateSafe(value) || new Date(value);
        const copy = new Date(parsed.getTime());
        copy.setDate(copy.getDate() + days);
        return toApiMidnightIso(copy);
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

      if (isRenewal && effectiveOldExpiry) {
        finalStartedDate = addDaysToApiIso(effectiveOldExpiry, 1);
        finalEndedDate = calculateEndApiIso(finalStartedDate, planDuration);
      }

      if (isDowngrade && earliestDowngradeStart && startOfDay(finalStartedDate) < earliestDowngradeStart) {
        throw new Error("A downgrade plan can only start after your current subscription ends. Please select a date after your current plan expiry.");
      }

      console.log("[GrowPlan Date Debug]", {
        startDate: finalStartedDate,
        planDuration,
        calculatedEndDate: finalEndedDate,
        apiStartedDate: finalStartedDate,
        apiEndedDate: finalEndedDate
      });

      const statusStr = isScheduled ? "Scheduled" : "Active";

      const tableIdToUse = (isDowngrade || isFutureUpgrade) && scheduledSubscription && !isScheduledReplacement
        ? getSubscriptionTableId(scheduledSubscription)
        : (isImmediateUpgrade || isRenewal)
          ? currentTableId
          : "";

      // ─── Boundary-date sync for surviving scheduled subscription ──────────
      // When the primary operation keeps an existing scheduled subscription
      // alive (i.e. it is NOT being cancelled via cancelScheduledTableId),
      // derive the correct new startedDate so it begins exactly one day after
      // the new active plan ends.  This prevents both overlaps and gaps.
      const isScheduledBeingCancelled = Boolean(
        (isImmediateUpgrade && scheduledSubscription) || isScheduledReplacement
      );

      let newScheduledStartedDate = null;
      let newScheduledEndedDate = null;

      if (scheduledSubscription && !isScheduledBeingCancelled) {
        const activeEndDateObj = parseDateSafe(finalEndedDate) || new Date(finalEndedDate);
        const scheduledNextDay = new Date(
          activeEndDateObj.getFullYear(),
          activeEndDateObj.getMonth(),
          activeEndDateObj.getDate() + 1
        );
        newScheduledStartedDate = toApiMidnightIso(scheduledNextDay);

        // Preserve the scheduled plan's original billing duration.
        const scheduledDuration =
          scheduledSubscription.duration ||
          scheduledSubscription.planDuration ||
          scheduledSubscription.billingCycle ||
          "1 Month";
        newScheduledEndedDate = calculateEndApiIso(newScheduledStartedDate, scheduledDuration);

        console.log("[GrowPlan] Computed boundary-aligned scheduled dates:", {
          newScheduledStartedDate,
          newScheduledEndedDate,
          scheduledDuration
        });
      }

      // ─── Active plan end-date trim for overlapping future schedule ─────────
      // When the user schedules a plan whose start date falls BEFORE the
      // current active plan expires, shorten the active plan's end date to one
      // day before the scheduled start.  This eliminates the overlap so that
      // active.endedDate is always exactly scheduled.startedDate − 1 day.
      //
      // Example:
      //   Active   Growth  13 Jul → 12 Aug  (original)
      //   Scheduled Enterprise  31 Jul  (user-selected start)
      //   Fix: Growth endedDate → 30 Jul
      //
      // Scope: only for newly-scheduled plans (statusStr === "Scheduled"),
      // when a real active subscription exists and there is an actual overlap.
      let newActiveEndedDate = null;

      if (isScheduled && currentSubscription && currentTableId) {
        const activeExpiry = getInclusiveEffectiveEndDate(currentSubscription);
        const scheduledStartObj = parseDateSafe(finalStartedDate) || new Date(finalStartedDate);

        if (activeExpiry && scheduledStartObj <= activeExpiry) {
          // Overlap detected: trim active plan to end the day before schedule starts.
          const dayBeforeSchedule = new Date(
            scheduledStartObj.getFullYear(),
            scheduledStartObj.getMonth(),
            scheduledStartObj.getDate() - 1
          );
          newActiveEndedDate = toApiMidnightIso(dayBeforeSchedule);

          console.log("[GrowPlan] Active plan trimmed to prevent overlap:", {
            activeExpiry: toApiMidnightIso(activeExpiry),
            scheduledStart: finalStartedDate,
            newActiveEndedDate
          });
        }
      }



      const scheduledPaidAmount = isScheduledReplacement
        ? calculateScheduledWaiveOff(scheduledSubscription, plans, startDate)
        : 0;

      const finalRemainingAmount = safeNum(remainingAmount);

      // Invoice totalPayable is the FULL order amount (after discount/upgrade
      // waive-off, but BEFORE wallet is applied). wallet + upi must always sum
      // to this value — matches what the backend expects.
      const totalPayableBeforeWallet = isScheduledReplacement
        ? safeNum(Math.max(totalPrice - finalRemainingAmount - scheduledPaidAmount - discountAmount, 0))
        : safeNum(payableBeforeWallet);
      const walletPaymentAmount = isScheduledReplacement
        ? safeNum(useWallet ? Math.min(walletBalance, totalPayableBeforeWallet) : 0)
        : safeNum(walletUsedAmount || 0);
      const upiPaymentAmount = isScheduledReplacement
        ? safeNum(Math.max(totalPayableBeforeWallet - walletPaymentAmount, 0))
        : safeNum(payableAmount || 0);
      const paidAmount = safeNum(walletPaymentAmount + upiPaymentAmount);

      const invoiceData = {
        invoiceDate: new Date().toISOString(),
        sellerName: sName,
        sellerId: sellerId,
        address: sAddress,
        gstin: sGstin,
        item: selectedPlan.name,
        qty: 1,
        rate: totalPayableBeforeWallet,
        amount: totalPrice,
        originalPlanAmount: totalPrice,
        waivedAmount: finalRemainingAmount,
        remainingSubscriptionValue: finalRemainingAmount,
        discountAmount: discountAmount,
        subtotal: totalPayableBeforeWallet,
        totalPayable: totalPayableBeforeWallet,
        payableAmount: upiPaymentAmount,
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
        status: statusStr,
        email: sellerEmail,
        startedDate: finalStartedDate,
        endedDate: finalEndedDate,
        paymentId: paymentId,
        razorpayOrderId: razorpayOrderId,
        sellerId: sellerId,
        phone: sPhone,
        amount: totalPrice,
        originalPlanAmount: totalPrice,
        payableAmount: upiPaymentAmount,
        waivedAmount: finalRemainingAmount,
        remainingSubscriptionValue: finalRemainingAmount,
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
      subPayload.schedulingAction = isSameScheduledPlan
        ? "reschedule"
        : (scheduledSubscription && (isFutureUpgrade || isImmediateUpgrade || isScheduledReplacement))
          ? "replace"
          : isScheduled
            ? "schedule"
            : "activate";
      subPayload.existingScheduledTableId = getSubscriptionTableId(scheduledSubscription);
      subPayload.cancelScheduledTableId = (isImmediateUpgrade || isScheduledReplacement)
        ? getSubscriptionTableId(scheduledSubscription)
        : "";
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

      // ─── Cancel replaced scheduled subscription in the database ───────────
      // When a scheduled replacement or immediate upgrade occurs, cancel the
      // old scheduled plan record in the database by setting its status to "Cancelled".
      const cancelScheduledTableId = (isImmediateUpgrade || isScheduledReplacement)
        ? getSubscriptionTableId(scheduledSubscription)
        : "";

      if (cancelScheduledTableId && scheduledSubscription) {
        const proStart = parseLocalDate(scheduledSubscription.startedDate || scheduledSubscription.startDate);
        const upgradeStart = parseLocalDate(startDate) || new Date();
        
        let cancelEndedDate = scheduledSubscription.endedDate || scheduledSubscription.endDate;
        if (proStart && upgradeStart && upgradeStart > proStart) {
          const dayBeforeUpgrade = new Date(upgradeStart.getFullYear(), upgradeStart.getMonth(), upgradeStart.getDate() - 1);
          cancelEndedDate = toApiMidnightIso(dayBeforeUpgrade);
        } else {
          cancelEndedDate = toApiMidnightIso(cancelEndedDate);
        }

        const cancelScheduledPayload = {
          createSellerInvoice: null,
          createSubscription: {
            tableId: cancelScheduledTableId,
            planName: getSubscriptionPlanName(scheduledSubscription),
            planId:
              scheduledSubscription.planId ||
              scheduledSubscription._id ||
              scheduledSubscription.id ||
              "",
            status: "Cancelled",
            email: sellerEmail,
            sellerId: sellerId,
            startedDate: toApiMidnightIso(scheduledSubscription.startedDate || scheduledSubscription.startDate),
            endedDate: cancelEndedDate,
            schedulingAction: "schedule",
            existingScheduledTableId: cancelScheduledTableId,
            cancelScheduledTableId: "",
            phone: sPhone,
            amount: scheduledSubscription.amount || scheduledSubscription.originalPlanAmount || 0,
            originalPlanAmount: scheduledSubscription.originalPlanAmount || scheduledSubscription.amount || 0,
            payableAmount: scheduledSubscription.payableAmount || 0,
            waivedAmount: scheduledSubscription.waivedAmount || 0,
            remainingSubscriptionValue: scheduledSubscription.remainingSubscriptionValue || 0,
            subtotal: scheduledSubscription.subtotal || 0,
            totalPayable: scheduledSubscription.totalPayable || 0,
            walletAmount: scheduledSubscription.walletAmount || 0,
            razorpayAmount: scheduledSubscription.razorpayAmount || 0,
            paymentMethod: scheduledSubscription.paymentMethod || "UPI",
            paidAmount: scheduledSubscription.paidAmount || 0,
            paymentId: "cancelled",
            razorpayOrderId: "cancelled"
          },
          referralUpdate: null
        };

        console.log("[GrowPlan] Cancelling replaced scheduled subscription in database:", cancelScheduledPayload);
        try {
          const cancelRes = await sellerService.processSubscriptionOrder(cancelScheduledPayload);
          console.log("[GrowPlan] Scheduled cancel result:", cancelRes);
        } catch (cancelErr) {
          console.error("[GrowPlan] Non-fatal: failed to cancel scheduled subscription:", cancelErr);
        }
      }

      // ─── Sync scheduled subscription boundary dates ───────────────────────
      // After the primary activation is confirmed successful, push the
      // corrected startedDate / endedDate to the scheduled subscription so
      // that it starts exactly one day after the new active plan ends.
      // This call is NON-FATAL: a failure here is logged but does not roll
      // back or affect the already-confirmed main activation.
      if (newScheduledStartedDate && newScheduledEndedDate && scheduledSubscription && !isScheduledBeingCancelled) {
        const scheduledTableId = getSubscriptionTableId(scheduledSubscription);
        if (scheduledTableId) {
          const scheduledInvoiceData = {
            invoiceDate: new Date().toISOString(),
            sellerName: sName,
            sellerId: sellerId,
            address: sAddress,
            gstin: sGstin,
            item: getSubscriptionPlanName(scheduledSubscription) || "Scheduled Plan",
            qty: 1,
            rate: Number(scheduledSubscription.amount || scheduledSubscription.originalPlanAmount || 999),
            amount: Number(scheduledSubscription.amount || scheduledSubscription.originalPlanAmount || 999),
            originalPlanAmount: Number(scheduledSubscription.originalPlanAmount || scheduledSubscription.amount || 999),
            waivedAmount: Number(scheduledSubscription.waivedAmount || 0),
            remainingSubscriptionValue: Number(scheduledSubscription.remainingSubscriptionValue || 0),
            discountAmount: Number(scheduledSubscription.discountAmount || 0),
            subtotal: Number(scheduledSubscription.subtotal || scheduledSubscription.amount || 999),
            totalPayable: Number(scheduledSubscription.totalPayable || scheduledSubscription.amount || 999),
            payableAmount: Number(scheduledSubscription.payableAmount || 0),
            cgst: 0,
            sgst: 0,
            payments: {
              wallet: Number(scheduledSubscription.walletAmount || 0),
              upi: Number(scheduledSubscription.razorpayAmount || 0)
            },
            paymentMethod: scheduledSubscription.paymentMethod || "UPI",
            transactionMethod: scheduledSubscription.paymentMethod || "UPI",
            paymentId: scheduledSubscription.paymentId || "WALLET_FULL_PAYMENT",
            razorpayOrderId: scheduledSubscription.razorpayOrderId || ""
          };

          const scheduledSyncPayload = {
            createSellerInvoice: scheduledInvoiceData,
            createSubscription: {
              tableId: scheduledTableId,
              planName: getSubscriptionPlanName(scheduledSubscription),
              planId:
                scheduledSubscription.planId ||
                scheduledSubscription._id ||
                scheduledSubscription.id ||
                "",
              status: "Scheduled",
              email: sellerEmail,
              sellerId: sellerId,
              startedDate: newScheduledStartedDate,
              endedDate: newScheduledEndedDate,
              // "schedule" is the no-payment update action for Scheduled status.
              schedulingAction: "schedule",
              existingScheduledTableId: scheduledTableId,
              cancelScheduledTableId: "",
              // Preserve original billing and payment fields
              phone: sPhone,
              amount: scheduledSubscription.amount || scheduledSubscription.originalPlanAmount || 0,
              originalPlanAmount: scheduledSubscription.originalPlanAmount || scheduledSubscription.amount || 0,
              payableAmount: scheduledSubscription.payableAmount || 0,
              waivedAmount: scheduledSubscription.waivedAmount || 0,
              remainingSubscriptionValue: scheduledSubscription.remainingSubscriptionValue || 0,
              subtotal: scheduledSubscription.subtotal || 0,
              totalPayable: scheduledSubscription.totalPayable || 0,
              walletAmount: scheduledSubscription.walletAmount || 0,
              razorpayAmount: scheduledSubscription.razorpayAmount || 0,
              paymentMethod: scheduledSubscription.paymentMethod || "UPI",
              paidAmount: scheduledSubscription.paidAmount || 0,
              paymentId: scheduledSubscription.paymentId || "WALLET_FULL_PAYMENT",
              razorpayOrderId: scheduledSubscription.razorpayOrderId || ""
            },
            referralUpdate: null
          };

          console.log("[GrowPlan] Syncing scheduled subscription boundary dates:", scheduledSyncPayload);
          try {
            const syncRes = await sellerService.processSubscriptionOrder(scheduledSyncPayload);
            console.log("[GrowPlan] Scheduled boundary sync result:", syncRes);
          } catch (syncErr) {
            console.error("[GrowPlan] Non-fatal: failed to sync scheduled subscription dates:", syncErr);
          }
        }
      }

      // ─── Trim active plan's end date to remove future-schedule overlap ─────
      // After the new scheduled plan is confirmed in the database, update the
      // current active subscription so its end date is exactly one day before
      // the scheduled plan starts.  NON-FATAL: logged on failure, never rolls
      // back the already-committed scheduled plan creation.
      if (newActiveEndedDate && currentTableId && currentSubscription) {
        const activeStartDate = toApiMidnightIso(
          parseDateSafe(
            currentSubscription.startedDate || currentSubscription.startDate
          ) || new Date()
        );

        const activeInvoiceData = {
          invoiceDate: new Date().toISOString(),
          sellerName: sName,
          sellerId: sellerId,
          address: sAddress,
          gstin: sGstin,
          item: currentSubscription.planName || currentSubscription.plan || "Trimmed Plan",
          qty: 1,
          rate: Number(currentSubscription.amount || currentSubscription.originalPlanAmount || 999),
          amount: Number(currentSubscription.amount || currentSubscription.originalPlanAmount || 999),
          originalPlanAmount: Number(currentSubscription.originalPlanAmount || currentSubscription.amount || 999),
          waivedAmount: Number(currentSubscription.waivedAmount || 0),
          remainingSubscriptionValue: Number(currentSubscription.remainingSubscriptionValue || 0),
          discountAmount: Number(currentSubscription.discountAmount || 0),
          subtotal: Number(currentSubscription.subtotal || currentSubscription.amount || 999),
          totalPayable: Number(currentSubscription.totalPayable || currentSubscription.amount || 999),
          payableAmount: Number(currentSubscription.payableAmount || 0),
          cgst: 0,
          sgst: 0,
          payments: {
            wallet: Number(currentSubscription.walletAmount || 0),
            upi: Number(currentSubscription.razorpayAmount || 0)
          },
          paymentMethod: currentSubscription.paymentMethod || "UPI",
          transactionMethod: currentSubscription.paymentMethod || "UPI",
          paymentId: currentSubscription.paymentId || "WALLET_FULL_PAYMENT",
          razorpayOrderId: currentSubscription.razorpayOrderId || ""
        };

        const activeTrimPayload = {
          createSellerInvoice: activeInvoiceData,
          createSubscription: {
            tableId: currentTableId,
            planName:
              currentSubscription.planName ||
              currentSubscription.plan ||
              currentSubscription.subscriptionPlan ||
              "",
            planId:
              currentSubscription.planId ||
              currentSubscription._id ||
              currentSubscription.id ||
              "",
            status: "Active",
            email: sellerEmail,
            sellerId: sellerId,
            startedDate: activeStartDate,
            endedDate: newActiveEndedDate,
            // "activate" updates the existing active record in-place.
            schedulingAction: "activate",
            existingScheduledTableId: "",
            cancelScheduledTableId: "",
            // Preserve original billing and payment fields
            phone: sPhone,
            amount: currentSubscription.amount || currentSubscription.originalPlanAmount || 0,
            originalPlanAmount: currentSubscription.originalPlanAmount || currentSubscription.amount || 0,
            payableAmount: currentSubscription.payableAmount || 0,
            waivedAmount: currentSubscription.waivedAmount || 0,
            remainingSubscriptionValue: currentSubscription.remainingSubscriptionValue || 0,
            subtotal: currentSubscription.subtotal || 0,
            totalPayable: currentSubscription.totalPayable || 0,
            walletAmount: currentSubscription.walletAmount || 0,
            razorpayAmount: currentSubscription.razorpayAmount || 0,
            paymentMethod: currentSubscription.paymentMethod || "UPI",
            paidAmount: currentSubscription.paidAmount || 0,
            paymentId: currentSubscription.paymentId || "WALLET_FULL_PAYMENT",
            razorpayOrderId: currentSubscription.razorpayOrderId || ""
          },
          referralUpdate: null
        };

        console.log("[GrowPlan] Trimming active plan end date to remove overlap:", activeTrimPayload);
        try {
          const trimRes = await sellerService.processSubscriptionOrder(activeTrimPayload);
          console.log("[GrowPlan] Active plan trim result:", trimRes);
        } catch (trimErr) {
          console.error("[GrowPlan] Non-fatal: failed to trim active plan end date:", trimErr);
        }
      }

      const selectedDisplayName = selectedPlan.name || selectedPlan.planName;
      const scheduledDisplayName = getSubscriptionPlanName(scheduledSubscription);
      const successToastMsg = isSameScheduledPlan
        ? `Your scheduled ${selectedDisplayName} plan has been rescheduled successfully to ${startOfDay(finalStartedDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.`
        : isScheduledReplacement
          ? (finalRemainingAmount > 0
              ? `Your scheduled ${scheduledDisplayName} plan has been replaced with the ${selectedDisplayName} plan. The unused value of your Active ${currentPlanName} plan and the amount already paid for the Scheduled ${scheduledDisplayName} plan have been applied as credits. You only need to pay the remaining balance.`
              : `Your scheduled ${scheduledDisplayName} plan has been cancelled and replaced with the ${selectedDisplayName} plan.`
            )
          : scheduledSubscription && isFutureUpgrade
            ? `Your scheduled ${scheduledDisplayName} plan has been cancelled and replaced with the ${selectedDisplayName} plan.`
            : isDowngrade
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

    const sPhone = sellerProfile?.phone || sellerProfile?.phoneNo || resolveSellerPhone() || "";

    if (!selectedPlan || !sellerId || !sellerEmail) {
      setErrorMsg("Missing selectedPlan or seller account details.");
      return;
    }

    const schedulingValidationMessage = getSchedulingValidationMessage();
    if (schedulingValidationMessage) {
      setErrorMsg(schedulingValidationMessage);
      showToast(schedulingValidationMessage);
      return;
    }

    if (isDowngrade && earliestDowngradeStart && startOfDay(startDate) < earliestDowngradeStart) {
      const message = "A downgrade plan can only start after your current subscription ends. Please select a date after your current plan expiry.";
      setErrorMsg(message);
      showToast(message);
      return;
    }

    // Rescheduling is a date-only update of an already paid record. This must
    // return before pricing, wallet, invoice, Razorpay, or order processing.
    if (isReschedule) {
      paymentInProgressRef.current = true;
      setIsProcessingPayment(true);
      setProcessingMessage("Rescheduling subscription...");
      setErrorMsg(null);

      const oldStartedDate = parseLocalDate(
        scheduledSubscription.startedDate || scheduledSubscription.startDate
      );
      const oldEndedDate = parseLocalDate(
        scheduledSubscription.endedDate ||
        scheduledSubscription.endDate ||
        scheduledSubscription.expiryDate ||
        scheduledSubscription.validTill
      );
      const newStartedDate = parseLocalDate(startDate);

      try {
        if (!oldStartedDate || !oldEndedDate || !newStartedDate) {
          throw new Error("Scheduled subscription dates are invalid.");
        }

        const shiftInDays = daysBetween(oldStartedDate, newStartedDate);
        const newEndedDate = new Date(oldEndedDate.getTime());
        newEndedDate.setDate(newEndedDate.getDate() + shiftInDays);

        const scheduledTableId = getSubscriptionTableId(scheduledSubscription);

        const sName =
          sellerProfile?.companyName ||
          sellerProfile?.businessName ||
          sellerProfile?.sellerName ||
          sellerProfile?.nickname ||
          sellerProfile?.name ||
          sellerEmail ||
          "Seller";

        const sAddress = [
          sellerProfile?.address,
          sellerProfile?.city,
          sellerProfile?.state,
          sellerProfile?.pincode
        ].filter(Boolean).map(s => String(s).trim()).filter(s => s.length > 0).join(", ") || "NA";

        const sGstin = sellerProfile?.gstin || sellerProfile?.GSTIN || "NA";

        const scheduledInvoiceData = {
          invoiceDate: new Date().toISOString(),
          sellerName: sName,
          sellerId: sellerId || "",
          address: sAddress,
          gstin: sGstin,
          item: getSubscriptionPlanName(scheduledSubscription) || "Scheduled Plan",
          qty: 1,
          rate: Number(scheduledSubscription.amount || scheduledSubscription.originalPlanAmount || 999),
          amount: Number(scheduledSubscription.amount || scheduledSubscription.originalPlanAmount || 999),
          originalPlanAmount: Number(scheduledSubscription.originalPlanAmount || scheduledSubscription.amount || 999),
          waivedAmount: Number(scheduledSubscription.waivedAmount || 0),
          remainingSubscriptionValue: Number(scheduledSubscription.remainingSubscriptionValue || 0),
          discountAmount: Number(scheduledSubscription.discountAmount || 0),
          subtotal: Number(scheduledSubscription.subtotal || scheduledSubscription.amount || 999),
          totalPayable: Number(scheduledSubscription.totalPayable || scheduledSubscription.amount || 999),
          payableAmount: Number(scheduledSubscription.payableAmount || 0),
          cgst: 0,
          sgst: 0,
          payments: {
            wallet: Number(scheduledSubscription.walletAmount || 0),
            upi: Number(scheduledSubscription.razorpayAmount || 0)
          },
          paymentMethod: scheduledSubscription.paymentMethod || "UPI",
          transactionMethod: scheduledSubscription.paymentMethod || "UPI",
          paymentId: scheduledSubscription.paymentId || "WALLET_FULL_PAYMENT",
          razorpayOrderId: scheduledSubscription.razorpayOrderId || ""
        };

        const reschedulePayload = {
          createSellerInvoice: scheduledInvoiceData,
          createSubscription: {
            tableId: scheduledTableId,
            planName: getSubscriptionPlanName(scheduledSubscription),
            planId:
              scheduledSubscription.planId ||
              scheduledSubscription._id ||
              scheduledSubscription.id ||
              "",
            status: "Scheduled",
            email: sellerEmail,
            sellerId: sellerId,
            startedDate: toApiDateOnlyIso(newStartedDate),
            endedDate: toApiDateOnlyIso(newEndedDate),
            // "schedule" is the no-payment update action for Scheduled status.
            schedulingAction: "schedule",
            existingScheduledTableId: scheduledTableId,
            cancelScheduledTableId: "",
            // Preserve original billing and payment fields
            phone: sPhone,
            amount: scheduledSubscription.amount || scheduledSubscription.originalPlanAmount || 0,
            originalPlanAmount: scheduledSubscription.originalPlanAmount || scheduledSubscription.amount || 0,
            payableAmount: scheduledSubscription.payableAmount || 0,
            waivedAmount: scheduledSubscription.waivedAmount || 0,
            remainingSubscriptionValue: scheduledSubscription.remainingSubscriptionValue || 0,
            subtotal: scheduledSubscription.subtotal || 0,
            totalPayable: scheduledSubscription.totalPayable || 0,
            walletAmount: scheduledSubscription.walletAmount || 0,
            razorpayAmount: scheduledSubscription.razorpayAmount || 0,
            paymentMethod: scheduledSubscription.paymentMethod || "UPI",
            paidAmount: scheduledSubscription.paidAmount || 0,
            paymentId: scheduledSubscription.paymentId || "WALLET_FULL_PAYMENT",
            razorpayOrderId: scheduledSubscription.razorpayOrderId || ""
          },
          referralUpdate: null
        };

        console.log("[PlanReview] Rescheduling subscription payload:", reschedulePayload);
        const syncRes = await sellerService.processSubscriptionOrder(reschedulePayload);
        console.log("[PlanReview] Reschedule API result:", syncRes);

        // Clear local storage override if any
        const localScheduleKey = `growPlanScheduledOverride:${sellerId || sellerEmail}`;
        window.localStorage.removeItem(localScheduleKey);

        const oldDateText = oldStartedDate.toLocaleDateString("en-GB", {
          day: "numeric", month: "long", year: "numeric"
        });
        const newDateText = newStartedDate.toLocaleDateString("en-GB", {
          day: "numeric", month: "long", year: "numeric"
        });
        showToast(
          `Your scheduled ${getSubscriptionPlanName(scheduledSubscription)} plan has been successfully rescheduled from ${oldDateText} to ${newDateText}. No additional payment was required.`
        );

        // Fetch latest subscriptions so GrowPlanPage displays the updated database values
        try {
          await sellerService.getSellerSubscription(sellerEmail);
        } catch (subErr) {
          console.error("[PlanReview] Failed to fetch subscription after rescheduling:", subErr);
        }

        setTimeout(() => navigate("/dashboard/growplan"), 2000);
        return;
      } catch (err) {
        console.error("[PlanReview] Reschedule failed:", err);
        setErrorMsg("Unable to reschedule your subscription. Your existing scheduled plan has not been modified.");
        return;
      } finally {
        setIsProcessingPayment(false);
        paymentInProgressRef.current = false;
      }
    }

    if (isRenewal && !renewalAllowed) {
      setErrorMsg("You can renew this plan only near expiry period");
      showToast("You can renew this plan only near expiry period");
      return;
    }

    if (isUpgrade && !isDurationAllowedForUpgrade(planDuration)) {
      setErrorMsg("Please select an eligible duration. Current plan remaining value is higher than this duration price.");
      showToast("Please select an eligible duration. Current plan remaining value is higher than this duration price.");
      return;
    }

    paymentInProgressRef.current = true;
    setIsProcessingPayment(true);
    setPaymentStatus("processing");
    setErrorMsg(null);

    try {
      // 0 payable bypass — wallet (and/or coupon) fully covers the payable amount.
      if (payableAmount === 0) {
        await completeSubscriptionActivation("WALLET_FULL_PAYMENT", null);
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

  // All plan features are always shown directly — no See More / See Less.
  const featuresToShow = selectedPlan.features || selectedPlan.benefits || [];

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
            <h2 id="payment-progress-title">
              {processingMessage === "Rescheduling subscription..." ? "Rescheduling Plan..." : "Payment in Progress..."}
            </h2>
            <p id="payment-progress-description">
              {processingMessage === "Rescheduling subscription..."
                ? "Please wait while your scheduled dates are updated."
                : "Please complete the payment in the Razorpay window."}
            </p>
            <p>Do not refresh or close this page.</p>
          </div>
        </>
      )}

      {(errorMsg || toastMessage) && !isProcessingPayment && (
        <div className="review-result-overlay" role="presentation">
          <div
            className={`review-result-modal ${errorMsg ? "is-error" : "is-success"}`}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="review-result-title"
            aria-describedby="review-result-message"
          >
            <div className="review-result-icon" aria-hidden="true">
              {errorMsg ? "!" : "✓"}
            </div>
            <h2 id="review-result-title">
              {errorMsg ? "Plan update failed" : "Plan updated successfully"}
            </h2>
            <p id="review-result-message">{errorMsg || toastMessage}</p>
            <button
              type="button"
              className="review-result-close"
              onClick={() => {
                setErrorMsg(null);
                setToastMessage(null);
              }}
            >
              OK
            </button>
          </div>
        </div>
      )}

      <div className="grow-plan-container" inert={isProcessingPayment ? "" : undefined} aria-busy={isProcessingPayment}>
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
          </div>

          {/* Right Column: Review Details & Summary Card */}
          <div className="plan-review-right-card">

            {/* Subscription Summary Card */}
            {(currentSubscription || scheduledSubscription) && (
              <div style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                padding: "20px",
                marginBottom: "24px",
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
                textAlign: "left"
              }}>
                <h3 style={{ fontSize: "14px", fontWeight: "700", color: "#64748b", marginBottom: "16px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Subscription Summary
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {currentSubscription && String(currentSubscription.status || "").toLowerCase() === "active" && (
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span style={{ fontSize: "13px", fontWeight: "600", color: "#64748b" }}>Current Plan Active Till:</span>
                      <span style={{ fontSize: "16px", fontWeight: "700", color: "#0f172a", marginTop: "4px" }}>
                        {formatCurrentPlanEndDate(currentSubscription)}
                      </span>
                    </div>
                  )}
                  {scheduledSubscription && (
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span style={{ fontSize: "13px", fontWeight: "600", color: "#64748b" }}>Scheduled Plan Starts On:</span>
                      <span style={{ fontSize: "16px", fontWeight: "700", color: "#0f172a", marginTop: "4px" }}>
                        {formatDisplayDate(scheduledSubscription.startedDate || scheduledSubscription.startDate)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

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
                    onClick={() => !isSameScheduledPlan && setShowDurationModal(!showDurationModal)}
                    disabled={isSameScheduledPlan}
                    className="duration-select-button"
                    style={isSameScheduledPlan ? { cursor: "not-allowed", opacity: 0.7 } : undefined}
                  >
                    {displayedPlanDuration}
                  </button>
                  {showDurationModal && (
                    <div className="duration-dropdown">
                      {DURATION_ORDER.map((dur) => {
                        const durAllowed = isDurationAllowedForUpgrade(dur);
                        return (
                          <button
                            key={dur}
                            type="button"
                            disabled={!durAllowed}
                            onClick={() => {
                              if (!durAllowed) return;
                              setPlanDuration(dur);
                              setShowDurationModal(false);
                            }}
                            className={`duration-dropdown-option ${planDuration === dur ? "active" : ""} ${!durAllowed ? "disabled-duration" : ""}`}
                            style={!durAllowed ? { opacity: 0.45, pointerEvents: "none", cursor: "not-allowed" } : undefined}
                          >
                            {dur}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>



              {isSameScheduledPlan && (
                <div className="reschedule-no-payment-note">
                  No additional payment is required because this subscription has already been purchased.
                </div>
              )}

              <div className="plan-summary-row">
                <span>Total Price</span>
                <span>₹{totalPrice.toLocaleString("en-IN")}</span>
              </div>

              {/* Upgrade ongoing details — shown only for true upgrades */}
              {isUpgrade && oldPlan && (!isScheduledReplacement || !shouldBypassActiveWaiveOff) && (
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
                  <div className="plan-summary-row">
                    <span>Remaining Days</span>
                    <span>{remainingDays} days</span>
                  </div>
                  <div className="plan-summary-row" style={{ color: "#059669" }}>
                    <span>Remaining Adjustment / Waive-off</span>
                    <span>- ₹{remainingAmount.toLocaleString("en-IN")}</span>
                  </div>
                </>
              )}

              {/* Scheduled replacement details — credit from previous scheduled plan */}
              {isScheduledReplacement && scheduledSubscription && scheduledPaidAmount > 0 && (
                <>
                  <div className="plan-summary-row">
                    <span>Cancelled Scheduled Plan</span>
                    <span>{getSubscriptionPlanName(scheduledSubscription)}</span>
                  </div>
                  <div className="plan-summary-row" style={{ color: "#059669" }}>
                    <span>Previous Payment Credit</span>
                    <span>- ₹{scheduledPaidAmount.toLocaleString("en-IN")}</span>
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
                disabled={walletBalance <= 0}
                style={{ cursor: walletBalance <= 0 ? "not-allowed" : "pointer", width: "16px", height: "16px" }}
              />
              <label htmlFor="walletRedeemCheck" style={{ cursor: walletBalance <= 0 ? "not-allowed" : "pointer", fontSize: "14px", fontWeight: "600", color: "#334155", display: "flex", justifyContent: "space-between", width: "100%", margin: 0 }}>
                <span>Redeem Wallet Balance?</span>
                <span style={{ color: "#2962ff" }}>
                  {useWallet ? (
                    <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "4px" }}>
                      <span>Remaining ₹{formatWalletCurrency(remainingWalletBalance)}</span>
                    </span>
                  ) : (
                    `Available ₹${formatWalletCurrency(availableWalletBalance)}`
                  )}
                </span>
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

            {/* Scheduled-higher-plan blocking banner — Rule 1 / Rule 4 */}
            {scheduledSubscription && selectedRank < scheduledPlanRank && (
              <div
                id="scheduled-conflict-banner"
                role="alert"
                style={{
                  background: "#fef2f2",
                  border: "1.5px solid #fca5a5",
                  borderRadius: "10px",
                  padding: "14px 16px",
                  marginBottom: "16px",
                  textAlign: "left",
                  display: "flex",
                  gap: "12px",
                  alignItems: "flex-start"
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    fontSize: "20px",
                    lineHeight: "1",
                    flexShrink: 0,
                    color: "#dc2626"
                  }}
                >
                  ⚠
                </span>
                <div>
                  <div style={{ fontSize: "13px", fontWeight: "700", color: "#b91c1c", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                    Purchase Blocked
                  </div>
                  <p style={{ margin: "0 0 6px 0", fontSize: "13px", fontWeight: "600", color: "#7f1d1d", lineHeight: "1.5" }}>
                    You already have a scheduled <strong>{getSubscriptionPlanName(scheduledSubscription)}</strong> plan.
                  </p>
                  <p style={{ margin: 0, fontSize: "13px", color: "#991b1b", lineHeight: "1.5" }}>
                    A lower plan cannot be purchased because it would create an invalid subscription timeline.
                    Please cancel your scheduled <strong>{getSubscriptionPlanName(scheduledSubscription)}</strong> plan before purchasing a lower plan.
                  </p>
                </div>
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
          <div className="review-confirm-modal-overlay">
            <div className="review-confirm-modal-container">
              <div className="review-confirm-icon">✓</div>
              <h3>{getConfirmModalTitle()}</h3>
              <p className="review-confirm-subtitle">
                Please confirm the selected plan before proceeding.
              </p>

              <div className="review-confirm-summary">
                <div>
                  <span>Plan</span>
                  <strong>{selectedPlan.name}</strong>
                </div>
                <div>
                  <span>Duration</span>
                  <strong>{displayedPlanDuration}</strong>
                </div>
                <div>
                  <span>Payable Amount</span>
                  <strong>{isSameScheduledPlan ? "Already paid" : `₹${payableAmount.toLocaleString("en-IN")}`}</strong>
                </div>
              </div>

              <div className="review-confirm-actions">
                <button className="review-confirm-no" onClick={() => setShowConfirmModal(false)}>
                  Cancel
                </button>
                <button className="review-confirm-yes" onClick={handleProceedSubscription}>
                  Confirm
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