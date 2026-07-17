import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Search, ChevronLeft, ChevronRight, X, Info, AlertTriangle, RefreshCw, Calendar } from "lucide-react";
import { sellerService } from "../../services/sellerService";
import { resolveSellerEmail } from "../../utils/sellerSession";
import "./SettlementsPage.css";

// ─── Utility helpers ──────────────────────────────────────────────────────────

const formatCurrency = (value) => {
  const amount = Number(value);
  return `₹${Number.isFinite(amount) ? amount.toFixed(2) : "0.00"}`;
};

const safeNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const safeString = (value, fallback = "") => {
  if (value === null || value === undefined) return fallback;
  return String(value);
};

const safeArray = (value) => {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return [value];
  return [];
};

const normalizeStatus = (status) => safeString(status).trim();
const isPaidStatus = (status) => normalizeStatus(status).toLowerCase() === "paid";
const isUpcomingStatus = (status) => normalizeStatus(status).toLowerCase() === "upcoming payment";

const getPayoutDetails = (payment) => {
  if (payment?.rawPayout) return payment.rawPayout;
  if (payment?.payoutDetails) return payment.payoutDetails;
  if (payment?.payout_details) return payment.payout_details;
  if (payment?.payout) return payment.payout;
  return payment;
};

const extractPaymentsFromResponse = (response) => {
  if (!response) return [];
  const possiblePayments =
    response.payments ??
    response.message?.payments ??
    response.data?.payments ??
    response.data?.message?.payments ??
    response.message?.data?.payments ??
    (response.data ? (response.data.payments ?? response.data.message?.payments) : null) ??
    [];
  return safeArray(possiblePayments);
};

const normalizeSettlementPayments = (apiResponse) => {
  const message = apiResponse?.message || apiResponse || {};
  const payments = Array.isArray(message?.payments)
    ? message.payments
    : Array.isArray(apiResponse?.payments)
      ? apiResponse.payments
      : Array.isArray(apiResponse)
        ? apiResponse
        : [];

  const rows = payments.map((item, index) => {
    const payout = item?.payoutDetails || item || {};

    const breakupKey = Array.isArray(payout.settlementBreakup)
      ? payout.settlementBreakup
        .map((b) => b.orderId || b.order_id || "")
        .filter(Boolean)
        .join("_")
      : "";

    const uniqueId = [
      payout._id,
      payout.id,
      payout.paymentId,
      payout.sellerId,
      payout.ordersPaid,
      payout.status,
      payout.paymentDate,
      payout.totalAmount,
      breakupKey,
      index,
    ]
      .filter((v) => v !== undefined && v !== null && String(v).trim() !== "")
      .join("_");

    return {
      id: uniqueId || `settlement_${index}`,
      sellerId: payout.sellerId || "-",
      ordersPaid: payout.ordersPaid || "-",
      orderId: payout.ordersPaid || "-",
      totalAmount: Number(payout.totalAmount || 0),
      status: payout.status || "-",
      paymentDate: payout.paymentDate || null,
      settlementBreakup: Array.isArray(payout.settlementBreakup) ? payout.settlementBreakup : [],
      rawPayout: payout,
      payoutDetails: payout,
    };
  });

  const totalSettlements = rows.reduce((sum, r) => sum + r.totalAmount, 0);
  const totalOrderAmount = rows.reduce((sum, r) => sum + r.totalAmount, 0);
  const totalDebits = 0;
  const paidCount = rows.filter((r) => isPaidStatus(r.status)).length;

  if (process.env.NODE_ENV !== "production") {
    console.log("[Settlements] Raw payments:", payments);
    console.log("[Settlements] Normalized settlement rows:", rows);
  }

  return {
    fromDate: message.fromDate,
    toDate: message.toDate,
    totalItems: Number(message.totalItems || rows.length),
    lastFetched: Number(message.lastFetched || rows.length),
    rows,
    summary: { totalSettlements, totalOrderAmount, totalDebits, paidCount },
  };
};

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEK_DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const formatApiDate = (date) => {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const formatDateForApi = formatApiDate;

const formatDisplayDate = (date) => {
  if (!date) return "-";
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return date;
    const day = String(d.getDate()).padStart(2, "0");
    const mShort = MONTH_SHORT[d.getMonth()];
    const y = d.getFullYear();
    return `${day} ${mShort} ${y}`;
  } catch (e) {
    return date;
  }
};

const getThisMonthRange = () => {
  const today = new Date();
  const from = new Date(today);
  from.setMonth(today.getMonth() - 1);
  from.setHours(0, 0, 0, 0);
  const to = new Date(today);
  to.setHours(23, 59, 59, 999);
  return { from, to };
};

const activeRequests = new Map();
const lastFetchedParams = { key: null };

// ─── Custom Date Range Picker ─────────────────────────────────────────────────

const formatTriggerDate = (date) => {
  if (!date) return "";
  const d = String(date.getDate()).padStart(2, "0");
  const m = MONTH_SHORT[date.getMonth()];
  const y = date.getFullYear();
  return `${m} ${d}, ${y}`;
};

const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const isSameDay = (a, b) => {
  if (!a || !b) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
};

const isBetween = (date, from, to) => {
  if (!from || !to || !date) return false;
  return date > from && date < to;
};

/** Build a flat array of 7×N date cells for a given year/month */
const buildCalendarGrid = (year, month) => {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
};

// ─── CalendarGrid ─────────────────────────────────────────────────────────────
const CalendarGrid = ({ year, month, from, to, hoverDate, today, onDayClick, onDayHover, onDayLeave, maxDate }) => {
  const cells = useMemo(() => buildCalendarGrid(year, month), [year, month]);

  // Effective range endpoints (includes hover preview when only one date picked)
  const effectiveTo = to || hoverDate;
  const rangeFrom = from && effectiveTo ? (from <= effectiveTo ? from : effectiveTo) : from;
  const rangeTo = from && effectiveTo ? (from <= effectiveTo ? effectiveTo : from) : null;

  return (
    <div className="cdrp-grid">
      {/* Weekday headers */}
      {WEEK_DAYS.map((wd) => (
        <div key={wd} className="cdrp-weekday">{wd}</div>
      ))}

      {/* Day cells */}
      {cells.map((date, idx) => {
        if (!date) {
          return <div key={`e${idx}`} className="cdrp-cell cdrp-cell--empty" />;
        }

        const isToday = isSameDay(date, today);
        const isStart = isSameDay(date, from);
        const isEnd = to ? isSameDay(date, to) : (hoverDate ? isSameDay(date, hoverDate) : false);
        const inRange = rangeFrom && rangeTo ? isBetween(date, rangeFrom, rangeTo) : false;
        const isSelected = isStart || (to && isEnd);
        const isHoverEnd = !to && hoverDate && isSameDay(date, hoverDate) && from && !isSameDay(date, from);
        const isDisabled = maxDate ? date > maxDate : false;
        const isOutside = date.getMonth() !== month;
        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
        const isRangeEnd = to ? isEnd : isHoverEnd;

        // Cell wrapper classes (for half-pill backgrounds on range edges)
        let cellCls = "cdrp-cell";
        if (isOutside) cellCls += " cdrp-cell--outside";
        if (isDisabled) cellCls += " cdrp-cell--disabled";
        if (isStart && (to || isHoverEnd)) cellCls += " cdrp-cell--range-start-cap";
        if (isRangeEnd && from) cellCls += " cdrp-cell--range-end-cap";
        if (inRange) cellCls += " cdrp-cell--in-range";

        // Button classes
        let btnCls = "cdrp-day-btn";
        if (isSelected) btnCls += " cdrp-day-btn--selected";
        if (isHoverEnd && !to) btnCls += " cdrp-day-btn--hover-end";
        if (isToday && !isSelected) btnCls += " cdrp-day-btn--today";
        if (isWeekend && !isSelected && !inRange) btnCls += " cdrp-day-btn--weekend";
        if (isDisabled) btnCls += " cdrp-day-btn--disabled";
        if (isOutside) btnCls += " cdrp-day-btn--outside";

        return (
          <div key={date.getTime()} className={cellCls}>
            <button
              type="button"
              className={btnCls}
              disabled={isDisabled}
              onClick={() => !isDisabled && onDayClick(date)}
              onMouseEnter={() => !isDisabled && onDayHover(date)}
              onMouseLeave={onDayLeave}
              tabIndex={isDisabled ? -1 : 0}
              aria-label={date.toLocaleDateString("en-US", {
                weekday: "long", year: "numeric", month: "long", day: "numeric",
              })}
              aria-pressed={isSelected}
            >
              {date.getDate()}
            </button>
          </div>
        );
      })}
    </div>
  );
};

// ─── ModernDateRangePicker ────────────────────────────────────────────────────
const ModernDateRangePicker = ({ fromDate, toDate, onChange, maxDate, label }) => {
  const [open, setOpen] = useState(false);
  const [tempFrom, setTempFrom] = useState(null);
  const [tempTo, setTempTo] = useState(null);
  const [hoverDate, setHoverDate] = useState(null);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [visibleYear, setVisibleYear] = useState(() => (fromDate || new Date()).getFullYear());
  const [visibleMonth, setVisibleMonth] = useState(() => (fromDate || new Date()).getMonth());

  const triggerRef = useRef(null);
  const popoverRef = useRef(null);

  // ── Outside click + Escape to close ──
  useEffect(() => {
    if (!open) return;
    const handleMouseDown = (e) => {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target) &&
        triggerRef.current && !triggerRef.current.contains(e.target)
      ) setOpen(false);
    };
    const handleKeyDown = (e) => {
      if (e.key === "Escape") { setOpen(false); triggerRef.current?.focus(); }
    };
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const openPicker = useCallback(() => {
    const base = fromDate || new Date();
    setTempFrom(fromDate ? startOfDay(fromDate) : null);
    setTempTo(toDate ? startOfDay(toDate) : null);
    setVisibleYear(base.getFullYear());
    setVisibleMonth(base.getMonth());
    setHoverDate(null);
    setOpen(true);
  }, [fromDate, toDate]);

  const handleDayClick = useCallback((date) => {
    if (!tempFrom || (tempFrom && tempTo)) {
      // First click — start new range
      setTempFrom(date);
      setTempTo(null);
      setHoverDate(null);
    } else {
      // Second click — complete range
      if (date < tempFrom) {
        setTempTo(tempFrom);
        setTempFrom(date);
      } else {
        setTempTo(date);
      }
      setHoverDate(null);
    }
  }, [tempFrom, tempTo]);

  const handleApply = useCallback(() => {
    if (!tempFrom) return;
    const from = startOfDay(tempFrom);
    const to = new Date(tempTo || tempFrom);
    to.setHours(23, 59, 59, 999);
    onChange({ from, to });
    setOpen(false);
    triggerRef.current?.focus();
  }, [tempFrom, tempTo, onChange]);

  const handleClear = useCallback(() => {
    setTempFrom(null);
    setTempTo(null);
    setHoverDate(null);
  }, []);

  const handlePrev = () => {
    if (visibleMonth === 0) { setVisibleYear((y) => y - 1); setVisibleMonth(11); }
    else { setVisibleMonth((m) => m - 1); }
  };

  const handleNext = () => {
    if (visibleMonth === 11) { setVisibleYear((y) => y + 1); setVisibleMonth(0); }
    else { setVisibleMonth((m) => m + 1); }
  };

  const years = useMemo(() => {
    const cur = new Date().getFullYear();
    const list = [];
    for (let y = cur - 10; y <= cur + 2; y++) list.push(y);
    return list;
  }, []);

  const triggerLabel = label || "This Month";

  const selectionLabel = useMemo(() => {
    if (!tempFrom) return "Select start date";
    if (tempFrom && !tempTo) return `${formatTriggerDate(tempFrom)}  →  Select end date`;
    return `${formatTriggerDate(tempFrom)}  –  ${formatTriggerDate(tempTo)}`;
  }, [tempFrom, tempTo]);

  return (
    <div className="cdrp-root">
      {/* Trigger button */}
      <button
        ref={triggerRef}
        id="settlement-date-range"
        type="button"
        className={`cdrp-trigger${open ? " cdrp-trigger--open" : ""}`}
        onClick={open ? () => setOpen(false) : openPicker}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={triggerLabel}
      >
        <Calendar size={16} className="cdrp-trigger-cal-icon" aria-hidden="true" />
        <span className="cdrp-trigger-label">{triggerLabel}</span>
        {fromDate && toDate && (
          <span
            className="cdrp-trigger-clear"
            role="button"
            tabIndex={0}
            aria-label="Clear date range"
            onClick={(e) => { e.stopPropagation(); onChange({ from: null, to: null }); }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation();
                onChange({ from: null, to: null });
              }
            }}
          >
            <X size={13} />
          </span>
        )}
      </button>

      {/* Popover */}
      {open && (
        <>
          <div className="cdrp-overlay" onClick={() => setOpen(false)} />
          <div
            ref={popoverRef}
            className="cdrp-popover"
            role="dialog"
            aria-label="Select settlement date range"
            aria-modal="true"
          >
            <button
              type="button"
              className="cdrp-close-btn"
              onClick={() => setOpen(false)}
              aria-label="Close calendar"
            >
              <X size={16} />
            </button>
          {/* Selected range status label */}
          <div className="cdrp-selection-row">
            <span className="cdrp-selection-label">{selectionLabel}</span>
          </div>

          {/* Month navigation header */}
          <div className="cdrp-nav-header">
            <div className="cdrp-nav-dropdowns">
              <select
                className="cdrp-nav-select"
                value={visibleMonth}
                onChange={(e) => setVisibleMonth(Number(e.target.value))}
                aria-label="Select month"
              >
                {MONTH_NAMES.map((name, idx) => (
                  <option key={name} value={idx}>{name}</option>
                ))}
              </select>
              <select
                className="cdrp-nav-select cdrp-nav-select--year"
                value={visibleYear}
                onChange={(e) => setVisibleYear(Number(e.target.value))}
                aria-label="Select year"
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            <div className="cdrp-nav-arrows">
              <button
                type="button"
                className="cdrp-nav-arrow"
                onClick={handlePrev}
                aria-label="Previous month"
                title="Previous month"
              >
                <ChevronLeft size={17} />
              </button>
              <button
                type="button"
                className="cdrp-nav-arrow"
                onClick={handleNext}
                aria-label="Next month"
                title="Next month"
              >
                <ChevronRight size={17} />
              </button>
            </div>
          </div>

          {/* Calendar grid */}
          <CalendarGrid
            year={visibleYear}
            month={visibleMonth}
            from={tempFrom}
            to={tempTo}
            hoverDate={tempFrom && !tempTo ? hoverDate : null}
            today={today}
            maxDate={maxDate || today}
            onDayClick={handleDayClick}
            onDayHover={setHoverDate}
            onDayLeave={() => setHoverDate(null)}
          />

          {/* Footer */}
          <div className="cdrp-footer">
            <button type="button" className="cdrp-btn-clear" onClick={handleClear}>
              Clear
            </button>
            <button
              type="button"
              className="cdrp-btn-apply"
              onClick={handleApply}
              disabled={!tempFrom}
              aria-disabled={!tempFrom}
            >
              Apply
            </button>
          </div>
        </div>
        </>
      )}
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

const SettlementsPage = () => {
  const [rawTransactions, setRawTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("previous");
  const [selectedTx, setSelectedTx] = useState(null);

  const abortControllerRef = useRef(null);

  useEffect(() => {
    return () => {
      const c = abortControllerRef.current;
      if (c) c.abort();
    };
  }, []);

  const thisMonth = useMemo(() => getThisMonthRange(), []);
  const [appliedFromDate, setAppliedFromDate] = useState(thisMonth.from);
  const [appliedToDate, setAppliedToDate] = useState(thisMonth.to);
  const [dateFilterLabel, setDateFilterLabel] = useState("This Month");

  const datePickerMaxDate = useMemo(() => {
    const today = new Date();
    if (activeTab === "upcoming") {
      const upcomingMax = new Date(today);
      upcomingMax.setDate(upcomingMax.getDate() + 7);
      upcomingMax.setHours(23, 59, 59, 999);
      return upcomingMax;
    } else {
      const todayMax = new Date(today);
      todayMax.setHours(23, 59, 59, 999);
      return todayMax;
    }
  }, [activeTab]);

  const handleDateChange = useCallback(({ from, to }) => {
    if (!from) {
      const range = getThisMonthRange();
      lastFetchedParams.key = null;
      setAppliedFromDate(range.from);
      setAppliedToDate(range.to);
      setDateFilterLabel("This Month");
      return;
    }
    lastFetchedParams.key = null;
    setAppliedFromDate(from);
    setAppliedToDate(to);
    setDateFilterLabel("Custom Date");
  }, []);

  const loadSettlements = useCallback(async (force = false) => {
    const email = (resolveSellerEmail() || "").trim();
    if (!email) {
      setError("Seller email not found. Please login again.");
      setLoading(false);
      return;
    }
    const fromStr = formatDateForApi(appliedFromDate);
    const toStr = formatDateForApi(appliedToDate);
    const paramKey = `${email}_${fromStr}_${toStr}_50_0`;

    if (!force && lastFetchedParams.key === paramKey) return;
    if (!force && activeRequests.has(paramKey)) return;

    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);
    activeRequests.set(paramKey, controller);

    const fetchParams = {
      email,
      fromDate: fromStr,
      toDate: toStr,
      count: 50,
      lastFetched: 0,
    };

    if (process.env.NODE_ENV !== "production") {
      console.log("[SettlementsPage] Fetch Params:", fetchParams);
    }

    try {
      const response = await sellerService.getSellerPayments(fetchParams, { signal: controller.signal });
      lastFetchedParams.key = paramKey;

      console.log("Settlement API Params:", { email, fromDate: fromStr, toDate: toStr });
      console.log("Settlement API Response:", response);

      const payments = extractPaymentsFromResponse(response);
      
      // Sort settlements descending by payment date/creation date
      payments.sort((a, b) => {
        const timeA = new Date(a.paymentDate || a.createdAt || a.createdDate || 0).getTime();
        const timeB = new Date(b.paymentDate || b.createdAt || b.createdDate || 0).getTime();
        return timeB - timeA;
      });

      setRawTransactions(payments);
    } catch (err) {
      if (
        err.name === "CanceledError" || err.name === "AbortError" ||
        err.message === "canceled" || err.code === "ERR_CANCELED"
      ) return;

      console.error("[SettlementsPage] Load Error", err);
      const is400 = err.response?.status === 400;
      if (is400) {
        setError("Failed to load settlements: Invalid request configuration (400). Please check parameters.");
      } else {
        setError(err.message || "Failed to load settlements from server.");
      }
      setRawTransactions([]);
    } finally {
      activeRequests.delete(paramKey);
      setLoading(false);
    }
  }, [appliedFromDate, appliedToDate]);

  useEffect(() => {
    loadSettlements(true);

    const intervalId = setInterval(() => {
      loadSettlements(true);
    }, 30000);

    return () => clearInterval(intervalId);
  }, [loadSettlements]);

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    } catch {
      return dateStr;
    }
  };

  const mappedTransactions = useMemo(() => {
    const apiResponse = { message: { payments: rawTransactions } };
    const { rows } = normalizeSettlementPayments(apiResponse);

    return rows.map((payment, idx) => {
      const payoutDetails = payment.payoutDetails || payment || {};
      if (!payoutDetails || typeof payoutDetails !== "object") return null;

      const ordersPaid = safeString(
        payoutDetails.ordersPaid ?? payoutDetails.orderPaid ?? payoutDetails.orderId ?? ""
      );
      const totalAmount = safeNumber(
        payoutDetails.totalAmount ?? payoutDetails.amount ?? payoutDetails.settlementAmount ?? 0
      );
      const status = normalizeStatus(payoutDetails.status || "Pending");
      const paymentDate =
        payoutDetails.paymentDate ?? payoutDetails.paidDate ??
        payoutDetails.settlementDate ?? payoutDetails.createdAt ?? "";

      const settlementBreakup = safeArray(
        payoutDetails.settlementBreakup ?? payoutDetails.breakup ?? []
      );

      const breakupKey = settlementBreakup
        .map((b) => b.orderId || b.order_id || "")
        .filter(Boolean)
        .join("_");

      const uniqueId = [
        payment.id,
        payoutDetails._id,
        payoutDetails.id,
        payoutDetails.paymentId,
        payoutDetails.sellerId,
        ordersPaid,
        status,
        paymentDate,
        totalAmount,
        breakupKey,
        idx,
      ]
        .filter((v) => v !== undefined && v !== null && String(v).trim() !== "")
        .join("_");

      return {
        id: uniqueId || `settlement_mapped_${idx}`,
        orderId: ordersPaid || "-",
        amount: totalAmount,
        sellerId: payoutDetails.sellerId || "-",
        ordersPaid: ordersPaid || "-",
        totalAmount,
        status,
        paymentDate: formatDisplayDate(paymentDate),
        rawPaymentDate: paymentDate,
        isUpcoming: isUpcomingStatus(status),
        settlementBreakup,
        rawPayout: payoutDetails,
      };
    }).filter(Boolean);
  }, [rawTransactions]);

  const matchesSearch = useCallback((tx) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return (
      safeString(tx.orderId).toLowerCase().includes(term) ||
      safeString(tx.status).toLowerCase().includes(term) ||
      safeString(tx.sellerId).toLowerCase().includes(term)
    );
  }, [search]);

  const uniqueMappedTransactions = useMemo(() => {
    const seen = new Set();
    return mappedTransactions.filter((tx) => {
      if (!tx?.id) return false;
      if (seen.has(tx.id)) return false;
      seen.add(tx.id);
      return true;
    });
  }, [mappedTransactions]);

  const filteredTransactions = useMemo(() => {
    const prev = uniqueMappedTransactions.filter((tx) => isPaidStatus(tx.status) && matchesSearch(tx));
    const upcoming = uniqueMappedTransactions.filter((tx) => isUpcomingStatus(tx.status) && matchesSearch(tx));
    if (process.env.NODE_ENV !== "production") {
      console.log("[Settlements] Upcoming rows:", upcoming.length, "Previous rows:", prev.length);
    }
    return activeTab === "upcoming" ? upcoming : prev;
  }, [uniqueMappedTransactions, activeTab, matchesSearch]);

  return (
    <div className="settlements-page-root">
      <div className="settlements-page-header">
        <div>
          <h1>Settlements</h1>
          <p>Track your payouts, order adjustments, and billing settlements.</p>
        </div>
      </div>

      {error && (
        <div className="settlements-alert-banner">
          <AlertTriangle size={18} />
          <span>{error}</span>
          <button type="button" className="settlements-alert-close" onClick={() => setError(null)}>
            &times;
          </button>
        </div>
      )}

      <div className="settlements-card">
        <div className="settlements-card-body">

          <div className="settlements-filters-row">
            <div className="search-bar-wrapper">
              <Search className="search-icon" size={18} />
              <input
                type="text"
                placeholder="Search settlements by order ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="search-input"
              />
            </div>

            <ModernDateRangePicker
              fromDate={appliedFromDate}
              toDate={appliedToDate}
              onChange={handleDateChange}
              maxDate={datePickerMaxDate}
              label={dateFilterLabel}
            />

            <button
              type="button"
              className="btn-refresh"
              onClick={() => loadSettlements(true)}
              title="Refresh Payouts"
            >
              <RefreshCw size={16} />
            </button>
          </div>

          <div className="settlements-tabs">
            <button
              type="button"
              className={`settlements-tab-btn ${activeTab === "upcoming" ? "settlements-tab-btn--active" : ""}`}
              onClick={() => setActiveTab("upcoming")}
            >
              Upcoming Settlements
            </button>
            <button
              type="button"
              className={`settlements-tab-btn ${activeTab === "previous" ? "settlements-tab-btn--active" : ""}`}
              onClick={() => setActiveTab("previous")}
            >
              Previous Settlements
            </button>
          </div>

          {loading ? (
            <div className="settlements-loading">
              <div className="settlements-spinner" />
              <p>Fetching settlement logs from server...</p>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="settlements-empty">
              <Info size={36} className="empty-icon" />
              <h3>No Payouts Found</h3>
              <p>We couldn&apos;t find any settlements matching your current selection or search term.</p>
            </div>
          ) : (
            <div className="settlements-table-wrap">
              <table className="settlements-table">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Amount</th>
                    <th>Payment Date</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((tx) => (
                    <tr key={tx.id}>
                      <td className="font-semibold text-gray-800">{tx.orderId}</td>
                      <td className="font-bold text-emerald-600">{formatCurrency(tx.amount)}</td>
                      <td>{tx.paymentDate}</td>
                      <td>
                        <span className="settlement-status-badge">{tx.status}</span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-view-details"
                          onClick={() => {
                            if (process.env.NODE_ENV !== "production") {
                              console.log("[Settlements] Modal settlementBreakup:", tx.settlementBreakup);
                            }
                            setSelectedTx(tx);
                          }}
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {selectedTx && (
        <div className="settlements-modal-overlay" onClick={() => setSelectedTx(null)}>
          <div className="settlements-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Payment Detail</h2>
              <button type="button" className="btn-close-modal" onClick={() => setSelectedTx(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body" style={{ maxHeight: "70vh", overflowY: "auto" }}>
              <div className="modal-info-row payment-detail-row">
                <span className="info-label font-bold">Orders Paid:</span>
                <span className="info-value value font-bold text-gray-800">{selectedTx.ordersPaid}</span>
              </div>
              <div className="modal-info-row payment-detail-row">
                <span className="info-label font-bold">Payment Date:</span>
                <span className="info-value value text-gray-800">{selectedTx.paymentDate}</span>
              </div>
              <div className="modal-info-row payment-detail-row">
                <span className="info-label font-bold">Status:</span>
                <span className="info-value value text-gray-800">
                  <span className="settlement-status-badge">{selectedTx.status}</span>
                </span>
              </div>
              <div className="modal-info-row payment-detail-row">
                <span className="info-label font-bold">Total Amount:</span>
                <span className="info-value value font-bold text-emerald-600">{formatCurrency(selectedTx.totalAmount)}</span>
              </div>
              <div className="modal-divider" />
              <h3 style={{ fontSize: "15px", fontWeight: "700", color: "#111827", marginBottom: "12px" }}>
                Settlement Breakup
              </h3>
              {selectedTx.settlementBreakup && selectedTx.settlementBreakup.length > 0 ? (
                <div className={`settlement-breakup-list${selectedTx.settlementBreakup.length === 1 ? " single-item" : ""}`}>
                  {selectedTx.settlementBreakup.map((item, idx) => {
                    const breakupOrderId = item.orderId ?? item.orderID ?? item.id ?? "-";
                    const orderAmount = safeNumber(item.orderAmount ?? item.amount ?? 0);
                    const productGST = safeNumber(item.productGST ?? item.productGst ?? item.productGstAmount ?? 0);
                    const shippingFee = safeNumber(item.shippingFee ?? 0);
                    const shippingGST = safeNumber(item.shippingGST ?? item.shippingGst ?? 0);
                    const totalDebit = safeNumber(item.totalDebit ?? 0);
                    const settlementAmt = safeNumber(item.settlementAmount ?? item.settlementAmt ?? 0);
                    const rtoPenaltyVal = item.rtopenalty ?? item.rtoPenalty;

                    return (
                      <div key={idx} className="settlement-breakup-card">
                        <div className="payment-detail-row" style={{ marginBottom: "8px" }}>
                          <span className="info-label font-semibold">Order ID:</span>
                          <span className="info-value value font-semibold text-gray-800">#{breakupOrderId}</span>
                        </div>
                        {[
                          ["Order Amount", formatCurrency(orderAmount)],
                          ["Product GST", formatCurrency(productGST)],
                          ["Shipping Fee", formatCurrency(shippingFee)],
                          ["Shipping GST", formatCurrency(shippingGST)],
                          ["Total Debit", formatCurrency(totalDebit)],
                        ].map(([label, val]) => (
                          <div key={label} className="payment-detail-row" style={{ marginBottom: "6px", fontSize: "13.5px" }}>
                            <span className="info-label">{label}:</span>
                            <span className="info-value value">{val}</span>
                          </div>
                        ))}
                        {rtoPenaltyVal != null && (
                          <div className="payment-detail-row" style={{ marginBottom: "6px", fontSize: "13.5px" }}>
                            <span className="info-label">RTO Penalty:</span>
                            <span className="info-value value">{formatCurrency(safeNumber(rtoPenaltyVal))}</span>
                          </div>
                        )}
                        <div className="modal-divider" style={{ margin: "10px 0" }} />
                        <div className="payment-detail-row" style={{ marginBottom: 0 }}>
                          <span className="info-label font-semibold text-emerald-600">Settlement Amount:</span>
                          <span className="info-value value font-bold text-emerald-600">{formatCurrency(settlementAmt)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p style={{ color: "#6b7280", fontSize: "13.5px", fontStyle: "italic" }}>No breakup details available.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettlementsPage;