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

const getPayoutDetails = (payment) => {
  if (payment?.rawPayout) return payment.rawPayout;
  if (payment?.payoutDetails) return payment.payoutDetails;
  if (payment?.payout_details) return payment.payout_details;
  if (payment?.payout) return payment.payout;
  return payment;
};

const extractPaymentsFromResponse = (response) => {
  const apiData = response?.data ?? response;
  const possiblePayments =
    apiData?.message?.payments ??
    apiData?.payments ??
    apiData?.data?.payments ??
    apiData?.data?.message?.payments ??
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

  const rows = [];

  payments.forEach((item, index) => {
    const payout = item?.payoutDetails || item || {};
    const breakupList = Array.isArray(payout?.settlementBreakup) ? payout.settlementBreakup : [];

    if (breakupList.length > 0) {
      breakupList.forEach((breakup, breakupIndex) => {
        rows.push({
          id: `${payout.sellerId || "seller"}_${breakup.orderId || payout.ordersPaid || index}_${payout.paymentDate || index}_${breakupIndex}`,
          sellerId: payout.sellerId || "-",
          ordersPaid: payout.ordersPaid || "-",
          orderId: breakup.orderId || payout.ordersPaid || "-",
          totalAmount: Number(payout.totalAmount || 0),
          orderAmount: Number(breakup.orderAmount || payout.totalAmount || 0),
          settlementAmount: Number(breakup.settlementAmount || payout.totalAmount || 0),
          productGST: Number(breakup.productGST || 0),
          shippingFee: Number(breakup.shippingFee || 0),
          shippingGST: Number(breakup.shippingGST || 0),
          totalDebit: Number(breakup.totalDebit || 0),
          rtopenalty: Number(breakup.rtopenalty || breakup.rtoPenalty || 0),
          status: payout.status || "-",
          paymentDate: payout.paymentDate || null,
          rawPayout: payout,
          payoutDetails: payout,
        });
      });
    } else {
      rows.push({
        id: `${payout.sellerId || "seller"}_${payout.ordersPaid || index}_${payout.paymentDate || index}`,
        sellerId: payout.sellerId || "-",
        ordersPaid: payout.ordersPaid || "-",
        orderId: payout.ordersPaid || "-",
        totalAmount: Number(payout.totalAmount || 0),
        orderAmount: Number(payout.totalAmount || 0),
        settlementAmount: Number(payout.totalAmount || 0),
        productGST: 0,
        shippingFee: 0,
        shippingGST: 0,
        totalDebit: 0,
        rtopenalty: 0,
        status: payout.status || "-",
        paymentDate: payout.paymentDate || null,
        rawPayout: payout,
        payoutDetails: payout,
      });
    }
  });

  const totalSettlements = rows.reduce((sum, r) => sum + r.settlementAmount, 0);
  const totalOrderAmount = rows.reduce((sum, r) => sum + r.orderAmount, 0);
  const totalDebits = rows.reduce((sum, r) => sum + r.totalDebit, 0);
  const paidCount = rows.filter((r) => isPaidStatus(r.status)).length;

  return {
    fromDate: message.fromDate,
    toDate: message.toDate,
    totalItems: Number(message.totalItems || rows.length),
    lastFetched: Number(message.lastFetched || rows.length),
    rows,
    summary: { totalSettlements, totalOrderAmount, totalDebits, paidCount },
  };
};

const formatDateForApi = (date) => {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const getThisMonthRange = () => {
  const today = new Date();
  const from = new Date(today.getFullYear(), today.getMonth(), 1);
  from.setHours(0, 0, 0, 0);
  const to = new Date(today);
  to.setHours(23, 59, 59, 999);
  return { from, to };
};

const activeRequests = new Map();
const lastFetchedParams = { key: null };

// ─── Custom Date Range Picker ─────────────────────────────────────────────────

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const WEEK_DAYS   = ["Su","Mo","Tu","We","Th","Fr","Sa"];

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
    a.getMonth()    === b.getMonth()    &&
    a.getDate()     === b.getDate()
  );
};

const isBetween = (date, from, to) => {
  if (!from || !to || !date) return false;
  return date > from && date < to;
};

/** Build a flat array of 7×N date cells for a given year/month */
const buildCalendarGrid = (year, month) => {
  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells       = [];
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
  const rangeFrom   = from && effectiveTo ? (from <= effectiveTo ? from : effectiveTo) : from;
  const rangeTo     = from && effectiveTo ? (from <= effectiveTo ? effectiveTo : from)  : null;

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

        const isToday    = isSameDay(date, today);
        const isStart    = isSameDay(date, from);
        const isEnd      = to ? isSameDay(date, to) : (hoverDate ? isSameDay(date, hoverDate) : false);
        const inRange    = rangeFrom && rangeTo ? isBetween(date, rangeFrom, rangeTo) : false;
        const isSelected = isStart || (to && isEnd);
        const isHoverEnd = !to && hoverDate && isSameDay(date, hoverDate) && from && !isSameDay(date, from);
        const isDisabled = maxDate ? date > maxDate : false;
        const isOutside  = date.getMonth() !== month;
        const isWeekend  = date.getDay() === 0 || date.getDay() === 6;
        const isRangeEnd = to ? isEnd : isHoverEnd;

        // Cell wrapper classes (for half-pill backgrounds on range edges)
        let cellCls = "cdrp-cell";
        if (isOutside)  cellCls += " cdrp-cell--outside";
        if (isDisabled) cellCls += " cdrp-cell--disabled";
        if (isStart && (to || isHoverEnd)) cellCls += " cdrp-cell--range-start-cap";
        if (isRangeEnd && from)            cellCls += " cdrp-cell--range-end-cap";
        if (inRange)    cellCls += " cdrp-cell--in-range";

        // Button classes
        let btnCls = "cdrp-day-btn";
        if (isSelected)               btnCls += " cdrp-day-btn--selected";
        if (isHoverEnd && !to)        btnCls += " cdrp-day-btn--hover-end";
        if (isToday && !isSelected)   btnCls += " cdrp-day-btn--today";
        if (isWeekend && !isSelected && !inRange) btnCls += " cdrp-day-btn--weekend";
        if (isDisabled)               btnCls += " cdrp-day-btn--disabled";
        if (isOutside)                btnCls += " cdrp-day-btn--outside";

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
const ModernDateRangePicker = ({ fromDate, toDate, onChange }) => {
  const [open, setOpen]           = useState(false);
  const [tempFrom, setTempFrom]   = useState(null);
  const [tempTo, setTempTo]       = useState(null);
  const [hoverDate, setHoverDate] = useState(null);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [visibleYear,  setVisibleYear]  = useState(() => (fromDate || new Date()).getFullYear());
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
    document.addEventListener("keydown",   handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown",   handleKeyDown);
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
    const to   = new Date(tempTo || tempFrom);
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
    const cur  = new Date().getFullYear();
    const list = [];
    for (let y = cur - 10; y <= cur + 2; y++) list.push(y);
    return list;
  }, []);

  const triggerLabel = useMemo(() => {
    if (!fromDate || !toDate) return "Select date range";
    return `${formatTriggerDate(fromDate)}  –  ${formatTriggerDate(toDate)}`;
  }, [fromDate, toDate]);

  const selectionLabel = useMemo(() => {
    if (!tempFrom)           return "Select start date";
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
        <div
          ref={popoverRef}
          className="cdrp-popover"
          role="dialog"
          aria-label="Select settlement date range"
          aria-modal="true"
        >
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
            maxDate={today}
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

  const handleDateChange = useCallback(({ from, to }) => {
    if (!from) {
      const range = getThisMonthRange();
      lastFetchedParams.key = null;
      setAppliedFromDate(range.from);
      setAppliedToDate(range.to);
      return;
    }
    lastFetchedParams.key = null;
    setAppliedFromDate(from);
    setAppliedToDate(to);
  }, []);

  const loadSettlements = useCallback(async (force = false) => {
    const email   = (resolveSellerEmail() || "").trim();
    const fromStr = formatDateForApi(appliedFromDate);
    const toStr   = formatDateForApi(appliedToDate);
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
      const payments = extractPaymentsFromResponse(response);
      setRawTransactions(payments);
    } catch (err) {
      if (
        err.name === "CanceledError" || err.name === "AbortError" ||
        err.message === "canceled"   || err.code  === "ERR_CANCELED"
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
    loadSettlements();
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
      const payoutDetails = getPayoutDetails(payment);
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

      return {
        id: `${ordersPaid || "order"}-${paymentDate || "date"}-${status || "status"}-${idx}`,
        orderId: payment?.orderId || ordersPaid || "-",
        amount: totalAmount,
        sellerId: payoutDetails.sellerId || "-",
        ordersPaid: ordersPaid || "-",
        totalAmount,
        orderAmount: safeNumber(payment?.orderAmount ?? totalAmount),
        settlementAmount: safeNumber(payment?.settlementAmount ?? totalAmount),
        productGST: safeNumber(payment?.productGST ?? 0),
        shippingFee: safeNumber(payment?.shippingFee ?? 0),
        shippingGST: safeNumber(payment?.shippingGST ?? 0),
        totalDebit: safeNumber(payment?.totalDebit ?? 0),
        rtopenalty: safeNumber(payment?.rtopenalty ?? 0),
        status,
        paymentDate: formatDate(paymentDate),
        rawPaymentDate: paymentDate,
        isUpcoming: !isPaidStatus(status),
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

  const filteredTransactions = useMemo(() => {
    const prev     = mappedTransactions.filter((tx) => !tx.isUpcoming && matchesSearch(tx));
    const upcoming = mappedTransactions.filter((tx) =>  tx.isUpcoming && matchesSearch(tx));
    return activeTab === "upcoming" ? upcoming : prev;
  }, [mappedTransactions, activeTab, matchesSearch]);

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
                          onClick={() => setSelectedTx(tx)}
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
              <div className="modal-info-row">
                <span className="info-label font-bold">Orders Paid:</span>
                <span className="info-value font-bold text-gray-800">{selectedTx.ordersPaid}</span>
              </div>
              <div className="modal-info-row">
                <span className="info-label font-bold">Payment Date:</span>
                <span className="info-value text-gray-800">{selectedTx.paymentDate}</span>
              </div>
              <div className="modal-info-row">
                <span className="info-label font-bold">Status:</span>
                <span className="info-value text-gray-800">
                  <span className="settlement-status-badge">{selectedTx.status}</span>
                </span>
              </div>
              <div className="modal-info-row">
                <span className="info-label font-bold">Total Amount:</span>
                <span className="info-value font-bold text-emerald-600">{formatCurrency(selectedTx.totalAmount)}</span>
              </div>
              <div className="modal-divider" />
              <h3 style={{ fontSize: "15px", fontWeight: "700", color: "#111827", marginBottom: "12px" }}>
                Settlement Breakup
              </h3>
              {selectedTx.settlementBreakup && selectedTx.settlementBreakup.length > 0 ? (
                <div className="breakup-list" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {selectedTx.settlementBreakup.map((item, idx) => {
                    const breakupOrderId = item.orderId ?? item.orderID ?? item.id ?? "-";
                    const orderAmount    = safeNumber(item.orderAmount ?? item.amount ?? 0);
                    const productGST     = safeNumber(item.productGST ?? item.productGst ?? 0);
                    const shippingFee    = safeNumber(item.shippingFee ?? 0);
                    const shippingGST    = safeNumber(item.shippingGST ?? 0);
                    const totalDebit     = safeNumber(item.totalDebit ?? 0);
                    const settlementAmt  = safeNumber(item.settlementAmount ?? 0);

                    return (
                      <div
                        key={idx}
                        className="breakup-item"
                        style={{ padding: "14px", background: "#f9fafb", borderRadius: "10px", border: "1px solid #f1f3f6" }}
                      >
                        <div className="modal-info-row" style={{ marginBottom: "8px" }}>
                          <span className="info-label font-semibold">Order ID:</span>
                          <span className="info-value font-semibold text-gray-800">#{breakupOrderId}</span>
                        </div>
                        {[
                          ["Order Amount",  formatCurrency(orderAmount)],
                          ["Product GST",   formatCurrency(productGST)],
                          ["Shipping Fee",  formatCurrency(shippingFee)],
                          ["Shipping GST",  formatCurrency(shippingGST)],
                          ["Total Debit",   formatCurrency(totalDebit)],
                        ].map(([label, val]) => (
                          <div key={label} className="modal-info-row" style={{ marginBottom: "6px", fontSize: "13.5px" }}>
                            <span className="info-label">{label}:</span>
                            <span className="info-value">{val}</span>
                          </div>
                        ))}
                        {item.rtopenalty != null && (
                          <div className="modal-info-row" style={{ marginBottom: "6px", fontSize: "13.5px" }}>
                            <span className="info-label">RTO Penalty:</span>
                            <span className="info-value">{formatCurrency(item.rtopenalty)}</span>
                          </div>
                        )}
                        <div className="modal-divider" style={{ margin: "10px 0" }} />
                        <div className="modal-info-row" style={{ marginBottom: 0 }}>
                          <span className="info-label font-semibold text-emerald-600">Settlement Amount:</span>
                          <span className="info-value font-bold text-emerald-600">{formatCurrency(settlementAmt)}</span>
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
