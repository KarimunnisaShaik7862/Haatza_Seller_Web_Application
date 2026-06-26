import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Search, ChevronLeft, ChevronRight, ChevronDown, X, Info, AlertTriangle, RefreshCw, Calendar } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { motion, AnimatePresence } from "framer-motion";
import { sellerService } from "../../services/sellerService";
import { resolveSellerEmail } from "../../utils/sellerSession";
import "react-day-picker/style.css";
import "./SettlementsPage.css";

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

// ─── DateRangePicker ──────────────────────────────────────────────────────────

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

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

const MonthCalendar = () => null;

// eslint-disable-next-line no-unused-vars
const DateRangePicker = ({ fromDate, toDate, onChange }) => {
  const [open, setOpen] = useState(false);
  const [tempFrom, setTempFrom] = useState(null);
  const [tempTo, setTempTo] = useState(null);
  const [hoverDate, setHoverDate] = useState(null);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [leftMonth, setLeftMonth] = useState(() => {
    const d = fromDate || new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const rightMonth = useMemo(() => {
    return new Date(leftMonth.getFullYear(), leftMonth.getMonth() + 1, 1);
  }, [leftMonth]);

  const popoverRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    const handleEscape = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const handleOpen = useCallback(() => {
    setTempFrom(fromDate ? startOfDay(fromDate) : null);
    setTempTo(toDate ? startOfDay(toDate) : null);
    setHoverDate(null);
    setLeftMonth(new Date((fromDate || new Date()).getFullYear(), (fromDate || new Date()).getMonth(), 1));
    setOpen(true);
  }, [fromDate, toDate]);

  const handleDayClick = useCallback((date) => {
    if (!tempFrom || (tempFrom && tempTo)) {
      setTempFrom(date);
      setTempTo(null);
      setHoverDate(null);
    } else {
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
    const finalFrom = tempFrom;
    const finalTo = new Date(tempTo || tempFrom);
    finalTo.setHours(23, 59, 59, 999);
    onChange({ from: finalFrom, to: finalTo });
    setOpen(false);
  }, [tempFrom, tempTo, onChange]);

  const handleClear = useCallback(() => {
    setTempFrom(null);
    setTempTo(null);
    setHoverDate(null);
  }, []);

  const triggerLabel = useMemo(() => {
    if (!fromDate || !toDate) return "Select date range";
    return `${formatTriggerDate(fromDate)} – ${formatTriggerDate(toDate)}`;
  }, [fromDate, toDate]);

  const selectionLabel = useMemo(() => {
    if (!tempFrom && !tempTo) return "Select a start date";
    if (tempFrom && !tempTo) return `${formatTriggerDate(tempFrom)} – Select end date`;
    return `${formatTriggerDate(tempFrom)} – ${formatTriggerDate(tempTo)}`;
  }, [tempFrom, tempTo]);

  return (
    <div className="drp-root">
      <button
        ref={triggerRef}
        type="button"
        className={`drp-trigger${open ? " drp-trigger--open" : ""}`}
        onClick={open ? () => setOpen(false) : handleOpen}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Calendar size={15} aria-hidden="true" />
        <span>{triggerLabel}</span>
        {fromDate && toDate && (
          <span
            className="drp-trigger-clear"
            role="button"
            tabIndex={0}
            aria-label="Clear date range"
            onClick={(e) => {
              e.stopPropagation();
              onChange({ from: null, to: null });
            }}
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

      {open && (
        <div
          ref={popoverRef}
          className="drp-popover"
          role="dialog"
          aria-label="Select date range"
        >
          <div className="drp-popover-header">
            <span className="drp-selection-label">{selectionLabel}</span>
          </div>

          <div className="drp-calendars">
            <div className="drp-calendar-col">
              <div className="drp-cal-header">
                <button
                  type="button"
                  className="drp-nav-btn"
                  onClick={() => setLeftMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                  aria-label="Previous month"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="drp-month-label">
                  {MONTH_NAMES[leftMonth.getMonth()]} {leftMonth.getFullYear()}
                </span>
                <span style={{ width: 28 }} />
              </div>
              <MonthCalendar
                year={leftMonth.getFullYear()}
                month={leftMonth.getMonth()}
                tempFrom={tempFrom}
                tempTo={tempTo}
                hoverDate={hoverDate}
                onDayClick={handleDayClick}
                onDayHover={setHoverDate}
                today={today}
              />
            </div>

            <div className="drp-divider" />

            <div className="drp-calendar-col">
              <div className="drp-cal-header">
                <span style={{ width: 28 }} />
                <span className="drp-month-label">
                  {MONTH_NAMES[rightMonth.getMonth()]} {rightMonth.getFullYear()}
                </span>
                <button
                  type="button"
                  className="drp-nav-btn"
                  onClick={() => setLeftMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                  aria-label="Next month"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
              <MonthCalendar
                year={rightMonth.getFullYear()}
                month={rightMonth.getMonth()}
                tempFrom={tempFrom}
                tempTo={tempTo}
                hoverDate={hoverDate}
                onDayClick={handleDayClick}
                onDayHover={setHoverDate}
                today={today}
              />
            </div>
          </div>

          <div className="drp-footer">
            <button type="button" className="drp-btn-clear" onClick={handleClear}>
              Clear
            </button>
            <button
              type="button"
              className="drp-btn-apply"
              onClick={handleApply}
              disabled={!tempFrom}
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

// ─── Main component ───────────────────────────────────────────────────────────

const parseDateString = (str) => {
  if (!str) return null;
  const cleaned = str.trim().replace(/,/g, "").replace(/\s+/g, " ");
  const parts = cleaned.split(" ");
  if (parts.length === 3) {
    const monthStr = parts[0].toLowerCase();
    const day = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    
    const monthIndex = MONTH_SHORT.findIndex(
      (m) => m.toLowerCase() === monthStr.substring(0, 3)
    );
    
    if (monthIndex !== -1 && !isNaN(day) && !isNaN(year)) {
      const parsedDate = new Date(year, monthIndex, day);
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate;
      }
    }
  }
  
  const fallback = new Date(str);
  if (!isNaN(fallback.getTime())) {
    return fallback;
  }
  return null;
};

const ModernDateRangePicker = ({ fromDate, toDate, onChange }) => {
  const [open, setOpen] = useState(false);
  const [draftRange, setDraftRange] = useState({ from: undefined, to: undefined });
  const [fromInputVal, setFromInputVal] = useState("");
  const [toInputVal, setToInputVal] = useState("");
  const [slideDirection, setSlideDirection] = useState("next"); // "next" or "prev"
  const [hoverDate, setHoverDate] = useState(null);
  
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const base = fromDate || new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  
  const [isMobile, setIsMobile] = useState(() => (
    typeof window !== "undefined" ? window.matchMedia("(max-width: 720px)").matches : false
  ));

  const triggerRef = useRef(null);
  const popoverRef = useRef(null);

  const today = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);

  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const list = [];
    for (let y = currentYear - 10; y <= currentYear + 5; y++) {
      list.push(y);
    }
    return list;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const media = window.matchMedia("(max-width: 720px)");
    const handleMediaChange = () => setIsMobile(media.matches);
    handleMediaChange();
    media.addEventListener("change", handleMediaChange);
    return () => media.removeEventListener("change", handleMediaChange);
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const openPicker = useCallback(() => {
    const from = fromDate ? startOfDay(fromDate) : undefined;
    const to = toDate ? startOfDay(toDate) : undefined;
    const base = from || new Date();
    setDraftRange({ from, to });
    setFromInputVal(from ? formatTriggerDate(from) : "");
    setToInputVal(to ? formatTriggerDate(to) : "");
    setVisibleMonth(new Date(base.getFullYear(), base.getMonth(), 1));
    setHoverDate(null);
    setOpen(true);
  }, [fromDate, toDate]);

  const triggerLabel = useMemo(() => {
    if (!fromDate || !toDate) return "Select date range";
    return `${formatTriggerDate(fromDate)} - ${formatTriggerDate(toDate)}`;
  }, [fromDate, toDate]);

  const draftLabel = useMemo(() => {
    if (!draftRange?.from && !draftRange?.to) return "Select custom range";
    const fromStr = draftRange.from ? formatTriggerDate(draftRange.from) : "Start Date";
    const toStr = draftRange.to ? formatTriggerDate(draftRange.to) : "End Date";
    return `${fromStr} → ${toStr}`;
  }, [draftRange]);

  const handleApply = useCallback(() => {
    if (!draftRange?.from) return;
    const from = startOfDay(draftRange.from);
    const to = new Date(draftRange.to || draftRange.from);
    to.setHours(23, 59, 59, 999);
    onChange({ from, to });
    setOpen(false);
    triggerRef.current?.focus();
  }, [draftRange, onChange]);

  const handleClear = useCallback(() => {
    setDraftRange({ from: undefined, to: undefined });
    setFromInputVal("");
    setToInputVal("");
    setHoverDate(null);
  }, []);

  const handleSelect = (range) => {
    const newRange = range || { from: undefined, to: undefined };
    setDraftRange(newRange);
    
    if (newRange.from) {
      setFromInputVal(formatTriggerDate(newRange.from));
    } else {
      setFromInputVal("");
    }
    
    if (newRange.to) {
      setToInputVal(formatTriggerDate(newRange.to));
    } else {
      setToInputVal("");
    }
  };

  const handleFromInputChange = (e) => {
    const val = e.target.value;
    setFromInputVal(val);
    const parsed = parseDateString(val);
    if (parsed) {
      if (parsed > today) return;
      setDraftRange((prev) => {
        const nextRange = { ...prev, from: parsed };
        if (prev.to && parsed > prev.to) {
          nextRange.to = undefined;
          setToInputVal("");
        }
        return nextRange;
      });
      setVisibleMonth(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
    }
  };

  const handleToInputChange = (e) => {
    const val = e.target.value;
    setToInputVal(val);
    const parsed = parseDateString(val);
    if (parsed) {
      if (parsed > today) return;
      setDraftRange((prev) => {
        if (prev.from && parsed < prev.from) {
          setFromInputVal(formatTriggerDate(parsed));
          setToInputVal(formatTriggerDate(prev.from));
          return { from: parsed, to: prev.from };
        }
        return { ...prev, to: parsed };
      });
      setVisibleMonth(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
    }
  };

  const handleFromInputBlur = () => {
    if (draftRange.from) {
      setFromInputVal(formatTriggerDate(draftRange.from));
    } else {
      setFromInputVal("");
    }
  };

  const handleToInputBlur = () => {
    if (draftRange.to) {
      setToInputVal(formatTriggerDate(draftRange.to));
    } else {
      setToInputVal("");
    }
  };

  const handlePrevMonth = () => {
    setSlideDirection("prev");
    setVisibleMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setSlideDirection("next");
    setVisibleMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleMonthChange = (e) => {
    const newMonth = parseInt(e.target.value, 10);
    setSlideDirection(newMonth > visibleMonth.getMonth() ? "next" : "prev");
    setVisibleMonth(new Date(visibleMonth.getFullYear(), newMonth, 1));
  };

  const handleYearChange = (e) => {
    const newYear = parseInt(e.target.value, 10);
    setSlideDirection(newYear > visibleMonth.getFullYear() ? "next" : "prev");
    setVisibleMonth(new Date(newYear, visibleMonth.getMonth(), 1));
  };

  const handleVisibleMonthChange = (newMonth) => {
    if (!newMonth) return;
    setSlideDirection(newMonth > visibleMonth ? "next" : "prev");
    setVisibleMonth(newMonth);
  };

  const handleDayMouseEnter = useCallback((event, day) => {
    const targetDate = event instanceof Date ? event : (day instanceof Date ? day : null);
    if (targetDate) {
      setHoverDate(targetDate);
    }
  }, []);

  const handleDayMouseLeave = useCallback(() => {
    setHoverDate(null);
  }, []);

  const customModifiers = useMemo(() => {
    return {
      weekend: (date) => date.getDay() === 0 || date.getDay() === 6,
      hoverRange: (date) => {
        if (!draftRange.from || draftRange.to || !hoverDate) return false;
        const start = draftRange.from;
        const end = hoverDate;
        if (start < end) {
          return date >= start && date <= end;
        } else {
          return date >= end && date <= start;
        }
      },
      hoverRangeStart: (date) => {
        if (!draftRange.from || draftRange.to || !hoverDate) return false;
        const start = draftRange.from;
        const end = hoverDate;
        return date.getTime() === (start < end ? start : end).getTime();
      },
      hoverRangeEnd: (date) => {
        if (!draftRange.from || draftRange.to || !hoverDate) return false;
        const start = draftRange.from;
        const end = hoverDate;
        return date.getTime() === (start < end ? end : start).getTime();
      }
    };
  }, [draftRange, hoverDate]);

  return (
    <div className="drp-root">
      <label className="drp-label" htmlFor="settlement-date-range">
        Settlement dates
      </label>
      <button
        id="settlement-date-range"
        ref={triggerRef}
        type="button"
        className={`drp-trigger${open ? " drp-trigger--open" : ""}`}
        onClick={open ? () => setOpen(false) : openPicker}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span>{triggerLabel}</span>
        <span className="drp-trigger-icon" aria-hidden="true">
          <Calendar size={20} />
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={popoverRef}
            className="drp-popover"
            role="dialog"
            aria-label="Select settlement date range"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* 2. Month Navigation Header */}
            <div className="drp-nav-header">
              <div className="drp-nav-dropdowns" title="Choose year and month">
                <select
                  value={visibleMonth.getMonth()}
                  onChange={handleMonthChange}
                  className="drp-nav-select"
                  aria-label="Select month"
                >
                  {MONTH_NAMES.map((name, idx) => (
                    <option key={name} value={idx}>{name}</option>
                  ))}
                </select>
                
                <select
                  value={visibleMonth.getFullYear()}
                  onChange={handleYearChange}
                  className="drp-nav-select"
                  aria-label="Select year"
                >
                  {years.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                <div className="drp-nav-arrow-indicator">
                  <ChevronDown size={16} />
                </div>
              </div>
              
              <div className="drp-nav-arrows-group">
                <button
                  type="button"
                  className="drp-nav-arrow-btn"
                  onClick={handlePrevMonth}
                  title="Previous month"
                  aria-label="Previous month"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  type="button"
                  className="drp-nav-arrow-btn"
                  onClick={handleNextMonth}
                  title="Next month"
                  aria-label="Next month"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
            
            {/* 3. Calendar Grid (with framer-motion slide animation) */}
            <div className="drp-calendar-wrapper">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.div
                  key={visibleMonth.getTime()}
                  initial={{ x: slideDirection === "next" ? 60 : -60, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: slideDirection === "next" ? -60 : 60, opacity: 0 }}
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                >
                  <DayPicker
                    mode="range"
                    selected={draftRange}
                    onSelect={handleSelect}
                    month={visibleMonth}
                    onMonthChange={handleVisibleMonthChange}
                    numberOfMonths={1}
                    disabled={{ after: today }}
                    showOutsideDays
                    fixedWeeks
                    onDayMouseEnter={handleDayMouseEnter}
                    onDayMouseLeave={handleDayMouseLeave}
                    modifiers={customModifiers}
                    modifiersClassNames={{
                      weekend: 'rdp-day_weekend',
                      hoverRange: 'rdp-day_hover-range',
                      hoverRangeStart: 'rdp-day_hover-range-start',
                      hoverRangeEnd: 'rdp-day_hover-range-end'
                    }}
                    className={`drp-daypicker-custom${draftRange.from && draftRange.to ? " drp-has-range" : ""}`}
                    components={{
                      Weekday: (props) => {
                        const label = props.ariaLabel || props["aria-label"] || String(props.children || "");
                        const text = String(props.children || "").trim();
                        let displayLetter = text;
                        if (text.length > 0) {
                          displayLetter = text.charAt(0);
                        }
                        return (
                          <th 
                            className={props.className} 
                            style={{ ...props.style, fontWeight: 500, fontSize: "13px" }} 
                            title={label}
                            aria-label={label}
                          >
                            {displayLetter}
                          </th>
                        );
                      },
                      DayButton: (props) => {
                        const { day, modifiers, ...rest } = props;
                        let title = "Choose date";
                        if (modifiers) {
                          if (modifiers.selected || modifiers.range_start || modifiers.range_end) {
                            title = "Selected date";
                          } else if (modifiers.today) {
                            title = "Today";
                          }
                        }
                        return <button {...rest} title={title} />;
                      }
                    }}
                  />
                </motion.div>
              </AnimatePresence>
            </div>
            
            {/* 4. Footer */}
            <div className="drp-popup-footer">
              <button
                type="button"
                className="drp-btn-clear-custom"
                onClick={handleClear}
                aria-label="Clear selection"
              >
                Clear
              </button>
              <button
                type="button"
                className="drp-btn-apply-custom"
                onClick={handleApply}
                disabled={!draftRange?.from}
                aria-label="Apply selected date range"
              >
                Apply
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

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
    const email = (resolveSellerEmail() || "").trim();
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
      const payments = extractPaymentsFromResponse(response);
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
    const prev = mappedTransactions.filter((tx) => !tx.isUpcoming && matchesSearch(tx));
    const upcoming = mappedTransactions.filter((tx) => tx.isUpcoming && matchesSearch(tx));
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
              <p>We couldn't find any settlements matching your current selection or search term.</p>
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
                    const orderAmount = safeNumber(item.orderAmount ?? item.amount ?? 0);
                    const productGST = safeNumber(item.productGST ?? item.productGst ?? 0);
                    const shippingFee = safeNumber(item.shippingFee ?? 0);
                    const shippingGST = safeNumber(item.shippingGST ?? 0);
                    const totalDebit = safeNumber(item.totalDebit ?? 0);
                    const settlementAmt = safeNumber(item.settlementAmount ?? 0);

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
                          ["Order Amount", formatCurrency(orderAmount)],
                          ["Product GST", formatCurrency(productGST)],
                          ["Shipping Fee", formatCurrency(shippingFee)],
                          ["Shipping GST", formatCurrency(shippingGST)],
                          ["Total Debit", formatCurrency(totalDebit)],
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
