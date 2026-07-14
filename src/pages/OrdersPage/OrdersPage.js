import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Calendar,
  RefreshCw,
  PackageCheck,
  Truck,
  XCircle,
  PackageSearch,
  ArrowLeft,
} from "lucide-react";
import { fetchSellerOrders } from "../../services/sellerService";
import ConfirmedOrdersPage from "../../components/orders/ConfirmedOrdersPage/ConfirmedOrdersPage";
import ShippedOrdersPage from "../../components/orders/ShippedOrdersPage/ShippedOrdersPage";
import CancelledOrdersPage from "../../components/orders/CancelledOrdersPage/CancelledOrdersPage";
import "../../components/orders/theme.css";
import "./OrdersPage.css";
const TABS = [
  { key: "confirmed", label: "Confirmed Orders", icon: PackageCheck },
  { key: "shipped", label: "Shipped Orders", icon: Truck },
  { key: "cancelled", label: "Cancelled Orders", icon: XCircle },
];

const CONFIRMED_STATUSES = ["Order Placed", "Order Confirmed", "Shipping Pickup Scheduled"];
const SHIPPED_STATUSES = ["Shipped"];
const CANCELLED_STATUSES = ["Order Cancelled"];

const OrdersPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(location.state?.fromTab || "confirmed");
  const [search, setSearch] = useState("");
  
  // Date Picker States
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [hoverDate, setHoverDate] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  const today = new Date();
  const [calendarMonth, setCalendarMonth] = useState(today.getMonth());
const [calendarYear, setCalendarYear] = useState(today.getFullYear());
const [pickerView, setPickerView] = useState("days"); // "days" | "months" | "years"
const [decadeStart, setDecadeStart] = useState(Math.floor(today.getFullYear() / 10) * 10);
  const datePickerRef = React.useRef(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleDropdownClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleDropdownClickOutside);
    return () => document.removeEventListener("mousedown", handleDropdownClickOutside);
  }, []);

  useEffect(() => {
    if (!isDropdownOpen) return;
    const handleScroll = () => setIsDropdownOpen(false);
    window.addEventListener("scroll", handleScroll, true);
    return () => window.removeEventListener("scroll", handleScroll, true);
  }, [isDropdownOpen]);

  useEffect(() => {
    const handleClickOutside = (event) => {
  if (datePickerRef.current && !datePickerRef.current.contains(event.target)) {
    setShowDatePicker(false);
    setPickerView("days");
  }
};
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const sellerId = useMemo(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("haatzaSeller"));
      return user?.sellerId || stored?.sellerId || stored?.data?.sellerId || localStorage.getItem("sellerId") || sessionStorage.getItem("sellerId") || "";
    } catch {
      return user?.sellerId || localStorage.getItem("sellerId") || sessionStorage.getItem("sellerId") || "";
    }
  }, [user]);

  const loadingRef = useRef(false);

  const loadOrders = useCallback(async (isSilent = false) => {
    if (!sellerId || loadingRef.current) return;
    loadingRef.current = true;
    if (!isSilent) {
      setLoading(true);
    }
    try {
      const response = await fetchSellerOrders(sellerId);
      const list = Array.isArray(response) ? response : response?.message?.results || response?.items || response?.orders || [];
      setOrders(list);
    } catch (err) {
      console.error("Error fetching seller orders", err);
      setOrders([]);
    } finally {
      loadingRef.current = false;
      if (!isSilent) {
        setLoading(false);
      }
    }
  }, [sellerId]);

  useEffect(() => {
    loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sellerId, loadOrders]);

  useEffect(() => {
    if (!sellerId) return;
    const interval = setInterval(() => {
      loadOrders(true);
    }, 30000);
    return () => clearInterval(interval);
  }, [sellerId, loadOrders]);

  const filteredOrders = useMemo(() => {
    let list = [...orders];

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((o) =>
        String(o.orderId || "").toLowerCase().includes(q) ||
        String(o.items || "").toLowerCase().includes(q) ||
        String(o.productId || o.productID || "").toLowerCase().includes(q)
      );
    }

    if (startDate && endDate) {
      list = list.filter((o) => {
        const created = new Date(o.createdDate);
        const createdTime = new Date(created.getFullYear(), created.getMonth(), created.getDate()).getTime();
        const startTime = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()).getTime();
        const endTime = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()).getTime();
        return createdTime >= startTime && createdTime <= endTime;
      });
    } else if (startDate) {
      list = list.filter((o) => {
        const created = new Date(o.createdDate);
        const createdTime = new Date(created.getFullYear(), created.getMonth(), created.getDate()).getTime();
        const startTime = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()).getTime();
        return createdTime === startTime;
      });
    }

    return list;
  }, [orders, search, startDate, endDate]);

  const grouped = useMemo(() => {
    const confirmed = filteredOrders.filter((o) => CONFIRMED_STATUSES.includes(o.status));
    const shipped = filteredOrders.filter((o) => SHIPPED_STATUSES.includes(o.status));
    const cancelled = filteredOrders.filter((o) => CANCELLED_STATUSES.includes(o.status));
    return { confirmed, shipped, cancelled };
  }, [filteredOrders]);

  
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

  const handleQuickPreset = (preset) => {
    const todayVal = new Date();
    todayVal.setHours(0, 0, 0, 0);

    if (preset === "today") {
      setStartDate(todayVal);
      setEndDate(todayVal);
    } else if (preset === "yesterday") {
      const yesterday = new Date(todayVal);
      yesterday.setDate(todayVal.getDate() - 1);
      setStartDate(yesterday);
      setEndDate(yesterday);
    } else if (preset === "last7") {
      const last7 = new Date(todayVal);
      last7.setDate(todayVal.getDate() - 6);
      setStartDate(last7);
      setEndDate(todayVal);
    } else if (preset === "last30") {
      const last30 = new Date(todayVal);
      last30.setDate(todayVal.getDate() - 29);
      setStartDate(last30);
      setEndDate(todayVal);
    } else if (preset === "thisMonth") {
      const startOfMonth = new Date(todayVal.getFullYear(), todayVal.getMonth(), 1);
      const endOfMonth = new Date(todayVal.getFullYear(), todayVal.getMonth() + 1, 0);
      setStartDate(startOfMonth);
      setEndDate(endOfMonth);
    } else if (preset === "clear") {
      setStartDate(null);
      setEndDate(null);
      setCalendarMonth(new Date().getMonth());
      setCalendarYear(new Date().getFullYear());
    }
    setShowDatePicker(false);
    setPickerView("days");
  };
  const handlePrevMonth = () => {
    if (calendarMonth === 0) {
      setCalendarMonth(11);
      setCalendarYear((y) => y - 1);
    } else {
      setCalendarMonth((m) => m - 1);
    }
  };

 const handleNextMonth = () => {
  if (calendarYear >= today.getFullYear() && calendarMonth >= today.getMonth()) {
    return;
  }
  if (calendarMonth === 11) {
    setCalendarMonth(0);
    setCalendarYear((y) => y + 1);
  } else {
    setCalendarMonth((m) => m + 1);
  }
};

const currentDecadeStart = Math.floor(today.getFullYear() / 10) * 10;

const handlePrevDecade = () => setDecadeStart((d) => d - 10);

const handleNextDecade = () => {
  if (decadeStart >= currentDecadeStart) return;
  setDecadeStart((d) => d + 10);
};

// 12 cells: one padding year before/after so the grid isn't a bare 10
const getDecadeYears = () => {
  const years = [];
  for (let i = -1; i <= 10; i++) years.push(decadeStart + i);
  return years;
};

const openYearPicker = () => {
  setDecadeStart(Math.floor(calendarYear / 10) * 10);
  setPickerView("years");
};

const handleYearSelect = (year) => {
  if (year > today.getFullYear()) return;
  setCalendarYear(year);
  if (year === today.getFullYear() && calendarMonth > today.getMonth()) {
    setCalendarMonth(today.getMonth());
  }
  setPickerView("months");
};

const handleMonthSelect = (monthIndex) => {
  if (calendarYear === today.getFullYear() && monthIndex > today.getMonth()) return;
  setCalendarMonth(monthIndex);
  setPickerView("days");
};

  const getCalendarDays = () => {
    const firstDayIndex = new Date(calendarYear, calendarMonth, 1).getDay();
    const totalDays = new Date(calendarYear, calendarMonth + 1, 0).getDate();

    const days = [];

    // Empty cells
    for (let i = 0; i < firstDayIndex; i++) {
      days.push({ day: null, date: null });
    }

    // Day cells
    for (let d = 1; d <= totalDays; d++) {
      days.push({
        day: d,
        date: new Date(calendarYear, calendarMonth, d)
      });
    }

    return days;
  };

  const calendarDays = getCalendarDays();
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const getDayClassNames = (dayDate) => {
    if (!dayDate) return "orders-calendar-day-empty";

    const time = dayDate.getTime();
    const startTime = startDate ? new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()).getTime() : null;
    const endTime = endDate ? new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()).getTime() : null;
    const hoverTime = hoverDate ? new Date(hoverDate.getFullYear(), hoverDate.getMonth(), hoverDate.getDate()).getTime() : null;

    let classes = "orders-calendar-day";

    if (startTime && time === startTime) {
      classes += " is-start-date";
    }
    if (endTime && time === endTime) {
      classes += " is-end-date";
    }

    if (startTime && endTime && time > startTime && time < endTime) {
      classes += " in-range";
    }

    if (startTime && !endTime && hoverTime) {
      const minTime = Math.min(startTime, hoverTime);
      const maxTime = Math.max(startTime, hoverTime);
      if (time >= minTime && time <= maxTime) {
        classes += " in-range-hover";
      }
    }

    return classes;
  };

  const handleDayClick = (dayDate) => {
    if (!dayDate) return;

    const clickedMidnightVal = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate()).getTime();
    if (clickedMidnightVal > todayMidnight) {
      return;
    }

    const normalizedDate = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate());

    if (!startDate || (startDate && endDate)) {
      setStartDate(normalizedDate);
      setEndDate(null);
    } else if (startDate && !endDate) {
      if (normalizedDate.getTime() < startDate.getTime()) {
        setEndDate(startDate);
        setStartDate(normalizedDate);
      } else {
        setEndDate(normalizedDate);
      }
      setShowDatePicker(false);
    }
  };

  const formatDateText = () => {
    if (startDate && endDate) {
      return `${startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${endDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
    }
    if (startDate) {
      return `From ${startDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
    }
    return "Select Date Range";
  };

  return (
    <div className="haatza-page orders-page">
      <div className="orders-header glass-card">
        <div className="orders-header-top">
          <div>
            <h1 className="orders-title">Orders</h1>
            <p className="orders-subtitle">Manage customer orders, shipping, and fulfillment</p>
          </div>
          <div className="orders-header-actions">
            <button className="btn-secondary" onClick={() => loadOrders(false)}>
              <RefreshCw size={16} className={loading ? "spin" : ""} />
              Refresh Orders
            </button>
          </div>
        </div>

        <div className="orders-filters">
          <div className="orders-search">
            <Search size={18} />
            <input
              type="text"
              placeholder="Search by Product ID or Product Name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          
          <div className="orders-date-filter-wrapper" ref={datePickerRef}>
            <div className="orders-date-filter-trigger" onClick={() => setShowDatePicker(!showDatePicker)}>
              <Calendar size={18} />
              <span className="orders-date-text">{formatDateText()}</span>
              {startDate && (
                <button
                  className="orders-date-clear-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleQuickPreset("clear");
                  }}
                >
                  &times;
                </button>
              )}
            </div>

            {showDatePicker && (
              <div className="orders-calendar-dropdown glass-card">
                <div className="orders-calendar-sidebar">
                    <button className="calendar-preset-btn" onClick={() => handleQuickPreset("today")}>Today</button>
                    <button className="calendar-preset-btn" onClick={() => handleQuickPreset("yesterday")}>Yesterday</button>
                    <button className="calendar-preset-btn" onClick={() => handleQuickPreset("last7")}>Last 7 Days</button>
                    <button className="calendar-preset-btn" onClick={() => handleQuickPreset("last30")}>Last 30 Days</button>
                    <button className="calendar-preset-btn" onClick={() => handleQuickPreset("thisMonth")}>This Month</button>
                    <button className="calendar-preset-btn clear-btn" onClick={() => handleQuickPreset("clear")}>Clear Filter</button>
                  </div>
                  <div className="orders-calendar-main">
                    <button
                      className="orders-calendar-close-btn"
                      onClick={() => {
                        setShowDatePicker(false);
                        setPickerView("days");
                      }}
                    >
                      &times;
                    </button>

                    {pickerView === "days" && (
                      <>
                        <div className="orders-calendar-header">
                          <button className="calendar-nav-btn" onClick={handlePrevMonth}>&larr;</button>
                          <button className="calendar-period-label" onClick={openYearPicker}>
                            {monthNames[calendarMonth]} {calendarYear}
                          </button>
                          <button
                            className="calendar-nav-btn"
                            onClick={handleNextMonth}
                            disabled={calendarYear >= today.getFullYear() && calendarMonth >= today.getMonth()}
                          >
                            &rarr;
                          </button>
                        </div>
                        <div className="orders-calendar-weekdays">
                          <span>Su</span>
                          <span>Mo</span>
                          <span>Tu</span>
                          <span>We</span>
                          <span>Th</span>
                          <span>Fr</span>
                          <span>Sa</span>
                        </div>
                        <div className="orders-calendar-days-grid">
                          {calendarDays.map((d, index) => {
                            const isCellFuture = d.date && d.date.getTime() > todayMidnight;
                            return (
                              <button
                                key={index}
                                className={getDayClassNames(d.date)}
                                disabled={!d.day || isCellFuture}
                                onClick={() => handleDayClick(d.date)}
                                onMouseEnter={() => d.date && setHoverDate(d.date)}
                              >
                                {d.day}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}

                    {pickerView === "years" && (
                      <div className="orders-calendar-picker-view">
                        <div className="orders-calendar-header">
                          <button className="calendar-nav-btn" onClick={handlePrevDecade}>&larr;</button>
                          <span className="calendar-period-label static">
                            {decadeStart} - {decadeStart + 9}
                          </span>
                          <button
                            className="calendar-nav-btn"
                            onClick={handleNextDecade}
                            disabled={decadeStart >= currentDecadeStart}
                          >
                            &rarr;
                          </button>
                        </div>
                        <div className="orders-calendar-years-grid">
                          {getDecadeYears().map((year) => {
                            const isFuture = year > today.getFullYear();
                            const isOutsideDecade = year < decadeStart || year > decadeStart + 9;
                            return (
                              <button
                                key={year}
                                className={`orders-calendar-year-cell ${year === calendarYear ? "is-selected" : ""} ${isOutsideDecade ? "is-outside" : ""}`}
                                disabled={isFuture}
                                onClick={() => handleYearSelect(year)}
                              >
                                {year}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {pickerView === "months" && (
                      <div className="orders-calendar-picker-view">
                        <div className="orders-calendar-header">
                          <button className="calendar-nav-btn" onClick={() => setPickerView("years")}>&larr;</button>
                          <span className="calendar-period-label static">{calendarYear}</span>
                          <span className="calendar-nav-btn" style={{ visibility: "hidden" }}>&rarr;</span>
                        </div>
                        <div className="orders-calendar-months-grid">
                          {monthNames.map((name, i) => {
                            const isFuture = calendarYear === today.getFullYear() && i > today.getMonth();
                            return (
                              <button
                                key={name}
                                className={`orders-calendar-month-cell ${i === calendarMonth ? "is-selected" : ""}`}
                                disabled={isFuture}
                                onClick={() => handleMonthSelect(i)}
                              >
                                {name.slice(0, 3)}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
          </div>
        </div>
      </div>

      <div className="orders-tabs">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          const count = grouped[tab.key]?.length || 0;
          return (
            <button
              key={tab.key}
              className={`order-tab ${isActive ? "active" : ""}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {Icon && <Icon size={16} />}
              <span>{tab.label}</span>
              <span className="tab-badge">{count}</span>
              {isActive && (
                <motion.div
                  layoutId="activeTabUnderline"
                  className="tab-underline"
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="orders-status-dropdown-container" ref={dropdownRef}>
        <button
          type="button"
          className={`orders-status-select-btn ${isDropdownOpen ? "open" : ""}`}
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        >
          <span>
            {activeTab === "confirmed" && "Confirmed Orders"}
            {activeTab === "shipped" && "Shipped Orders"}
            {activeTab === "cancelled" && "Cancelled Orders"}
          </span>
        </button>
        {isDropdownOpen && (
          <div className="orders-status-dropdown-menu">
            <button
              type="button"
              className={`orders-status-dropdown-item ${activeTab === "confirmed" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("confirmed");
                setIsDropdownOpen(false);
              }}
            >
              Confirmed Orders
            </button>
            <button
              type="button"
              className={`orders-status-dropdown-item ${activeTab === "shipped" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("shipped");
                setIsDropdownOpen(false);
              }}
            >
              Shipped Orders
            </button>
            <button
              type="button"
              className={`orders-status-dropdown-item ${activeTab === "cancelled" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("cancelled");
                setIsDropdownOpen(false);
              }}
            >
              Cancelled Orders
            </button>
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25 }}
        >
          {activeTab === "confirmed" && (
            <ConfirmedOrdersPage orders={grouped.confirmed} loading={loading} onRefresh={loadOrders} />
          )}
          {activeTab === "shipped" && (
            <ShippedOrdersPage orders={grouped.shipped} loading={loading} onRefresh={loadOrders} />
          )}
          {activeTab === "cancelled" && (
            <CancelledOrdersPage orders={grouped.cancelled} loading={loading} onRefresh={loadOrders} />
          )}
        </motion.div>
      </AnimatePresence>

      {!loading && filteredOrders.length === 0 && (
        <div className="empty-state glass-card">
          <PackageSearch size={48} color="#2962FF" />
          <h3>No Orders Found</h3>
          <p>No orders are currently available.</p>
          {/* Refresh button removed for automatic refresh */}
        </div>
      )}
    </div>
  );
};

export default OrdersPage;
