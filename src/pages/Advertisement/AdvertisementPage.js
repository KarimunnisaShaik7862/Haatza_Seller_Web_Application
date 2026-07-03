import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  RefreshCw,
  Plus,
  Trash2,
  TrendingUp,
  AlertCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Calendar,
  ArrowLeft
} from "lucide-react";
import { resolveSellerId } from "../../utils/sellerSession";
import sellerService, { advertisementService } from "../../services/sellerService";
import "./AdvertisementPage.css";

const getApiData = (response) => response?.data ?? response;

const safeArray = (value) => {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return [value];
  return [];
};


const parseProductIds = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
};

const extractSellerCampaigns = (response) => {
  const campaigns =
    response?.message?.campaigns ||
    response?.data?.message?.campaigns ||
    response?.campaigns ||
    response?.data?.campaigns ||
    [];
  return safeArray(campaigns);
};

const safeString = (value, fallback = "") => {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
};

const safeNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const displayValue = (value) => {
  if (value === null || value === undefined || value === "") return "--";
  return value;
};

const normalizeCampaign = (item, index) => {
  const tableId = item.tableId || item.TableID || item._id || item.id || "";
  const campaignId = item.campaignId || item.CampaignID || item.campaignID || "";
  const title = item.title || item.campaignName || "Unnamed Campaign";
  const campaignType = item.campaignType || "Smart";
  const campaignstatus = item.campaignstatus || item.status || "";
  const adstatus = item.Adstatus ?? item.adstatus ?? item.adStatus ?? item.active ?? false;
  const startDateTime = item.startDateTime || item.startDate || "";
  const endDateTime = item.endDateTime || item.endDate || "";
  const dailyBudget = Number(item.dailyBudget || 0);
  const productId = parseProductIds(item.productId || item.productIds || item.products);

  return {
    id: tableId || campaignId || `campaign-${index}`,
    tableId,
    campaignId,
    title,
    campaignName: title,
    campaignType,
    campaignstatus,
    status: campaignstatus,
    adstatus,
    adStatus: adstatus,
    startDateTime,
    endDateTime,
    startDate: startDateTime,
    endDate: endDateTime,
    dailyBudget,
    productId,
    productIds: productId,
    plan: item.plan || item.planName || ""
  };
};

const extractCampaignDetails = (response) => {
  const apiData = getApiData(response);
  return apiData?.message ?? apiData?.data ?? apiData ?? {};
};

const extractCampaignProducts = (response) => {
  const products =
    response?.message?.products ||
    response?.message?.Products ||
    response?.data?.message?.products ||
    response?.data?.message?.Products ||
    response?.products ||
    response?.Products ||
    response?.message ||
    response?.data?.message ||
    response?.data ||
    response ||
    [];

  return safeArray(products);
};

const normalizeCampaignDetailInfo = (details, selectedCampaign) => {
  const campaign = details?.campaign || {};

  const title = campaign.title || selectedCampaign.title;
  const campaignType = campaign.campaignType || selectedCampaign.campaignType;
  const dailyBudget = campaign.dailyBudget || selectedCampaign.dailyBudget;
  const startDateTime = campaign.startDateTime || selectedCampaign.startDateTime;
  const endDateTime = campaign.endDateTime || selectedCampaign.endDateTime;
  const status = campaign.status || selectedCampaign.campaignstatus;
  const active = campaign.active ?? campaign.Adstatus ?? campaign.adstatus ?? selectedCampaign.adstatus;
  const tableId = campaign.tableId || campaign.TableID || campaign._id || selectedCampaign.tableId || "";
  const cpcGoal = campaign.cpcGoal ?? campaign.averageCPC ?? selectedCampaign.cpcGoal ?? selectedCampaign.averageCPC ?? "";
  const productId = parseProductIds(campaign.productId || selectedCampaign.productId || selectedCampaign.productIds);

  return {
    tableId,
    cpcGoal,
    productId,
    title,
    campaignType,
    dailyBudget,
    startDateTime,
    endDateTime,
    status,
    active,
    campaignName: title || "Unnamed Campaign",
    budget: dailyBudget || "",
    schedule: startDateTime || "",
    campaignId: campaign.campaignId || selectedCampaign.campaignId,
    plan: campaign.plan || selectedCampaign.plan || ""
  };
};

const normalizeCampaignProduct = (item, index, campaignId = "") => {
  const productId = item.productId || item.ProductID || item.id || item._id || "";
  const name = item.name || item.productName || item.title || "Unnamed Product";
  const image = item.mainMedia || item.mainmedia || item.image || item.imageUrl || item.productImage || "";
  const price = item.price || item.sellingPrice || item.finalPrice || item.mrp || 0;

  return {
    id: productId || `campaign-product-${index}`,
    productId,
    name,
    productName: name,
    image,
    price,
    campaignId: item.campaignId || campaignId,
    raw: item
  };
};

const formatDateString = (date) => {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const formatDisplayDate = (date) => {
  if (!date) return "";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short"
  });
};

const formatDateLabel = (dateStr) => {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return formatDisplayDate(date);
  } catch (e) {
    return dateStr;
  }
};

const getStartOfWeekMonday = (date) => {
  const d = new Date(date);
  const day = d.getDay(); // Sunday = 0, Monday = 1
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const getEndOfWeekSunday = (date) => {
  const start = getStartOfWeekMonday(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
};

const getDateRangeForFilter = (filterKey, campaign) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (filterKey === "today") {
    return { from: today, to: today };
  }

  if (filterKey === "yesterday") {
    const y = new Date(today);
    y.setDate(today.getDate() - 1);
    return { from: y, to: y };
  }

  if (filterKey === "last7days" || filterKey === "lastWeek") {
    const from = new Date(today);
    from.setDate(today.getDate() - 6);
    return { from, to: today };
  }

  if (filterKey === "last30days") {
    const from = new Date(today);
    from.setDate(today.getDate() - 29);
    return { from, to: today };
  }

  if (filterKey === "thisWeek") {
    return { from: getStartOfWeekMonday(today), to: today };
  }

  if (filterKey === "thisMonth") {
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from: first, to: today };
  }

  if (filterKey === "maximum") {
    let start = new Date(2022, 5, 3);
    const rawStart = campaign?.startDateTime || campaign?.startDate;
    if (rawStart) {
      const parsed = new Date(rawStart);
      if (!isNaN(parsed.getTime())) start = parsed;
    }
    return { from: start, to: today };
  }

  if (filterKey === "lastMonth") {
    const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const last = new Date(today.getFullYear(), today.getMonth(), 0);
    return { from: first, to: last };
  }

  return { from: today, to: today };
};

const getDatesBetween = (from, to) => {
  const dates = [];
  const current = new Date(from);
  current.setHours(0, 0, 0, 0);

  const end = new Date(to);
  end.setHours(0, 0, 0, 0);

  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
};

const buildDailyTrendData = (performanceRows, from, to) => {
  const rowsByDate = new Map();

  performanceRows.forEach((row) => {
    const key = String(row.date ?? row.day ?? row.createdAt ?? row.performanceDate ?? row.timestamp ?? "").slice(0, 10);
    if (key) {
      rowsByDate.set(key, row);
    }
  });

  return getDatesBetween(from, to).map((date) => {
    const key = formatDateString(date);
    const row = rowsByDate.get(key) || {};

    return {
      label: formatDisplayDate(date),
      date: key,
      reach: Number(row.reach || 0),
      impressions: Number(row.impressions || 0),
      clicks: Number(row.clicks || 0)
    };
  });
};

const buildWeeklyTrendData = (performanceRows, from, to) => {
  const rowsByDate = new Map();

  performanceRows.forEach((row) => {
    const key = String(row.date ?? row.day ?? row.createdAt ?? row.performanceDate ?? row.timestamp ?? "").slice(0, 10);
    if (key) {
      rowsByDate.set(key, row);
    }
  });

  const result = [];
  let cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);

  const end = new Date(to);
  end.setHours(0, 0, 0, 0);

  while (cursor <= end) {
    const weekStart = new Date(cursor);
    const weekEnd = new Date(cursor);
    weekEnd.setDate(weekStart.getDate() + 6);

    if (weekEnd > end) {
      weekEnd.setTime(end.getTime());
    }

    let reach = 0;
    let impressions = 0;
    let clicks = 0;

    getDatesBetween(weekStart, weekEnd).forEach((date) => {
      const key = formatDateString(date);
      const row = rowsByDate.get(key) || {};
      reach += Number(row.reach || 0);
      impressions += Number(row.impressions || 0);
      clicks += Number(row.clicks || 0);
    });

    result.push({
      label: `${formatDisplayDate(weekStart)} - ${formatDisplayDate(weekEnd)}`,
      fromDate: formatDateString(weekStart),
      toDate: formatDateString(weekEnd),
      date: formatDateString(weekStart), // fallback field
      reach,
      impressions,
      clicks
    });

    cursor = new Date(weekEnd);
    cursor.setDate(cursor.getDate() + 1);
  }

  return result;
};

const getRangeLength = (from, to) => {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.floor((to - from) / oneDay) + 1;
};

const buildTrendDataByFilter = (performanceRows, from, to, filterKey) => {
  const dayCount = getRangeLength(from, to);

  const shouldGroupWeekly =
    filterKey === "thisMonth" ||
    filterKey === "lastMonth" ||
    dayCount > 7;

  if (shouldGroupWeekly) {
    return buildWeeklyTrendData(performanceRows, from, to);
  }

  return buildDailyTrendData(performanceRows, from, to);
};

const formatTwoDecimal = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(2) : "0.00";
};

const pickMetric = (obj, keys = []) => {
  if (!obj || typeof obj !== "object") return undefined;
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null && obj[key] !== "") {
      const num = Number(obj[key]);
      return Number.isFinite(num) ? num : obj[key];
    }
  }
  return undefined;
};

const sumByKeys = (rows, keys = []) => {
  return rows.reduce((sum, row) => {
    const val = Number(pickMetric(row, keys));
    return sum + (Number.isFinite(val) ? val : 0);
  }, 0);
};

const calculateMetricsForRange = (detailsOrRows, performanceRows) => {
  let details = {};
  let rows = [];

  if (Array.isArray(detailsOrRows)) {
    rows = detailsOrRows;
    if (Array.isArray(performanceRows)) {
      rows = performanceRows;
    }
  } else {
    details = detailsOrRows || {};
    rows = Array.isArray(performanceRows) ? performanceRows : [];
  }

  const dataSrc = details?.data ?? details ?? {};

  const reachVal = pickMetric(dataSrc, ["reach", "totalReach", "reachCount"]);
  const reach = reachVal !== undefined ? Number(reachVal) : (rows.length ? sumByKeys(rows, ["reach", "totalReach", "reachCount"]) : 0);

  const impVal = pickMetric(dataSrc, ["impressions", "totalImpressions", "impressionCount"]);
  const impressions = impVal !== undefined ? Number(impVal) : (rows.length ? sumByKeys(rows, ["impressions", "totalImpressions", "impressionCount"]) : 0);

  const clicksVal = pickMetric(dataSrc, ["clicks", "totalClicks", "clickCount"]);
  const clicks = clicksVal !== undefined ? Number(clicksVal) : (rows.length ? sumByKeys(rows, ["clicks", "totalClicks", "clickCount"]) : 0);

  const salesVal = pickMetric(dataSrc, ["sales", "totalSales", "salesCount", "orders"]);
  const sales = salesVal !== undefined ? Number(salesVal) : (rows.length ? sumByKeys(rows, ["sales", "totalSales", "salesCount", "orders"]) : 0);

  const revVal = pickMetric(dataSrc, ["revenue", "totalRevenue", "salesRevenue", "amount"]);
  const revenue = revVal !== undefined ? Number(revVal) : (rows.length ? sumByKeys(rows, ["revenue", "totalRevenue", "salesRevenue", "amount"]) : 0);

  const spendKeys = ["totalSpend", "spend", "amountSpent", "campaignSpend", "totalAmountSpent", "total_spend", "amount_spent", "cost"];
  const spendVal = pickMetric(dataSrc, spendKeys);
  const totalSpend = spendVal !== undefined ? Number(spendVal) : (rows.length ? sumByKeys(rows, spendKeys) : 0);

  const haatzaSalesVal = pickMetric(dataSrc, ["haatzaSales", "sales", "totalSales"]);
  const haatzaSales = haatzaSalesVal !== undefined ? Number(haatzaSalesVal) : sales;

  const costPerSale = sales > 0 ? totalSpend / sales : 0;

  return {
    reach,
    impressions,
    clicks,
    sales,
    revenue,
    totalSpend,
    haatzaSales,
    costPerSale
  };
};

const filterLabels = {
  last7days: "Last 7 days",
  last30days: "Last 30 days",
  maximum: "Maximum",
  today: "Today",
  yesterday: "Yesterday",
  thisWeek: "This week",
  thisMonth: "This month",
  custom: "Custom date range"
};

const getFilterPreview = (filterKey, campaign) => {
  if (filterKey === "custom") return null;
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (filterKey === "today") return formatDisplayDate(today);
    if (filterKey === "yesterday") {
      const y = new Date(today);
      y.setDate(today.getDate() - 1);
      return formatDisplayDate(y);
    }
    if (filterKey === "last7days") {
      const from = new Date(today);
      from.setDate(today.getDate() - 6);
      return `${formatDisplayDate(from)} - ${formatDisplayDate(today)}`;
    }
    if (filterKey === "last30days") {
      const from = new Date(today);
      from.setDate(today.getDate() - 29);
      return `${formatDisplayDate(from)} - ${formatDisplayDate(today)}`;
    }
    if (filterKey === "thisWeek") {
      const from = getStartOfWeekMonday(today);
      return `${formatDisplayDate(from)} - ${formatDisplayDate(today)}`;
    }
    if (filterKey === "thisMonth") {
      const from = new Date(today.getFullYear(), today.getMonth(), 1);
      return `${formatDisplayDate(from)} - ${formatDisplayDate(today)}`;
    }
    if (filterKey === "maximum") {
      let start = new Date(2022, 5, 3);
      const rawStart = campaign?.startDateTime || campaign?.startDate;
      if (rawStart) {
        const parsed = new Date(rawStart);
        if (!isNaN(parsed.getTime())) start = parsed;
      }
      const startStr = start.getFullYear() !== today.getFullYear()
        ? start.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
        : formatDisplayDate(start);
      const endStr = start.getFullYear() !== today.getFullYear()
        ? today.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
        : formatDisplayDate(today);
      return `${startStr} - ${endStr}`;
    }
    return null;
  } catch (e) {
    return null;
  }
};

const SingleMonthCalendar = ({ fromDate, toDate, onChange, onSelectPreset }) => {
  const realToday = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [currentMonth, setCurrentMonth] = useState(() => {
    if (fromDate) {
      const parts = fromDate.split("-");
      if (parts.length === 3) return new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
    }
    return new Date(realToday.getFullYear(), realToday.getMonth(), 1);
  });

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(year, month - 1, 1));
  };

  const isNextDisabled = useMemo(() => {
    const nextM = new Date(year, month + 1, 1);
    const realCurrentM = new Date(realToday.getFullYear(), realToday.getMonth(), 1);
    return nextM > realCurrentM;
  }, [year, month, realToday]);

  const handleNextMonth = () => {
    if (isNextDisabled) return;
    setCurrentMonth(new Date(year, month + 1, 1));
  };

  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const handleDateClick = (dayNum) => {
    const dateObj = new Date(year, month, dayNum);
    dateObj.setHours(0, 0, 0, 0);
    if (dateObj > realToday) return;

    const clickedStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;

    if (!fromDate || (fromDate && toDate) || clickedStr < fromDate) {
      onChange(clickedStr, "");
    } else {
      onChange(fromDate, clickedStr);
    }
  };

  const daysGrid = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    daysGrid.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    daysGrid.push(d);
  }

  return (
    <div style={{ background: "#ffffff", borderRadius: "12px", marginTop: "8px" }}>
      <div style={{ border: "1px solid #e2e8f0", borderRadius: "12px", overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "#f3f0ff" }}>
          <span style={{ fontWeight: "600", fontSize: "15px", color: "#334155" }}>
            {monthNames[month]} {year}
          </span>
          <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
            <button
              type="button"
              onClick={handlePrevMonth}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "#64748b", display: "flex", alignItems: "center" }}
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              disabled={isNextDisabled}
              style={{
                background: "none",
                border: "none",
                cursor: isNextDisabled ? "not-allowed" : "pointer",
                padding: 0,
                color: isNextDisabled ? "#cbd5e1" : "#64748b",
                display: "flex",
                alignItems: "center"
              }}
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", padding: "12px 8px 6px 8px", textAlign: "center" }}>
          {["S", "M", "T", "W", "T", "F", "S"].map((day, idx) => (
            <span key={idx} style={{ fontSize: "13px", fontWeight: "600", color: idx === 1 ? "#2563eb" : "#64748b" }}>
              {day}
            </span>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", padding: "4px 8px 16px 8px", rowGap: "6px", textAlign: "center" }}>
          {daysGrid.map((dayNum, idx) => {
            if (!dayNum) {
              return <div key={`empty-${idx}`} style={{ height: "36px" }} />;
            }
            const dateObj = new Date(year, month, dayNum);
            dateObj.setHours(0, 0, 0, 0);
            const isFuture = dateObj > realToday;
            const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;

            const isFrom = fromDate === dateStr;
            const isTo = toDate === dateStr;
            const isInRange = fromDate && toDate && dateStr > fromDate && dateStr < toDate;
            const isSelected = isFrom || isTo;

            return (
              <div
                key={dateStr}
                style={{
                  height: "36px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                  backgroundColor: isInRange ? "#dbeafe" : "transparent"
                }}
              >
                <button
                  type="button"
                  onClick={() => handleDateClick(dayNum)}
                  disabled={isFuture}
                  style={{
                    height: "32px",
                    width: "32px",
                    border: "none",
                    borderRadius: isSelected ? "50%" : "4px",
                    backgroundColor: isSelected ? "#2563eb" : "transparent",
                    color: isFuture ? "#cbd5e1" : (isSelected ? "#ffffff" : (isInRange ? "#1d4ed8" : "#334155")),
                    fontWeight: isSelected ? "700" : "500",
                    fontSize: "14px",
                    cursor: isFuture ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 2,
                    transition: "all 0.15s ease"
                  }}
                >
                  {dayNum}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", gap: "8px", marginTop: "16px", overflowX: "auto", paddingBottom: "4px" }}>
        {[
          { label: "Last 7 days", key: "last7days" },
          { label: "Last 30 days", key: "last30days" },
          { label: "This month", key: "thisMonth" }
        ].map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => onSelectPreset && onSelectPreset(p.key)}
            style={{
              padding: "8px 16px",
              border: "1px solid #cbd5e1",
              borderRadius: "8px",
              background: "#ffffff",
              fontSize: "13px",
              fontWeight: "600",
              color: "#334155",
              cursor: "pointer",
              whiteSpace: "nowrap"
            }}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
};

const AdvertisementPage = () => {
  const sellerId = resolveSellerId();
  console.log("[Advertisement] resolved sellerId:", sellerId);
  const navigate = useNavigate();

  // API Data States
  const [campaigns, setCampaigns] = useState([]);

  // UI Flow States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Selected campaign for details view
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState(null);
  const [campaignDetailsData, setCampaignDetailsData] = useState(null);
  const [campaignDetailInfo, setCampaignDetailInfo] = useState(null);
  const [campaignProducts, setCampaignProducts] = useState([]);

  // Date filter inside Details View
  const [showDateFilterModal, setShowDateFilterModal] = useState(false);
  const [showEditConfirmModal, setShowEditConfirmModal] = useState(false);
  const [confirmModalType, setConfirmModalType] = useState("start"); // "start" | "stop"
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState("thisMonth");
  const [tempSelectedFilter, setTempSelectedFilter] = useState("thisMonth");
  const [customFromDate, setCustomFromDate] = useState("");
  const [customToDate, setCustomToDate] = useState("");
  const [tempCustomFromDate, setTempCustomFromDate] = useState("");
  const [tempCustomToDate, setTempCustomToDate] = useState("");

  // See more metrics expanded state
  const [metricsExpanded, setMetricsExpanded] = useState(false);

  // Search
  const [searchQuery, setSearchQuery] = useState("");

  // Toasts
  const [toast, setToast] = useState(null);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Load All Data
  const loadPageData = useCallback(async () => {
    if (!sellerId) {
      setError("Seller session not found. Please login again.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    const params = { sellerId };

    try {
      const response = advertisementService.getSellerCampaigns
        ? await advertisementService.getSellerCampaigns(params)
        : await advertisementService.getCampaigns(sellerId);

      console.log("[Advertisement] campaigns raw response:", response);
      const parsedCampaigns = extractSellerCampaigns(response).map((c, idx) => normalizeCampaign(c, idx));
      console.log("[Advertisement] normalized campaigns:", parsedCampaigns);
      setCampaigns(parsedCampaigns);
    } catch (err) {
      console.error("[AdvertisementPage] Error loading data:", err);
      setError("Failed to load campaigns from backend. Please verify your connection.");
      showToast("Error loading page data", "error");
    } finally {
      setLoading(false);
    }
  }, [sellerId]);

  useEffect(() => {
    loadPageData();
  }, [loadPageData]);

  // Date range picker range calculations
  const getDateRangeForOption = (option, customFrom = "", customTo = "") => {
    const now = new Date();
    let fromDate = new Date();
    let toDate = new Date();

    const opt = String(option).toLowerCase();

    if (opt === "today") {
      fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      toDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (opt === "yesterday") {
      fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      toDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    } else if (opt === "last 7 days" || opt === "last7days" || opt === "lastweek") {
      fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
      toDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (opt === "last 30 days" || opt === "last30days") {
      fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
      toDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (opt === "this week" || opt === "thisweek") {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      fromDate = new Date(now.getFullYear(), now.getMonth(), diff);
      toDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (opt === "this month" || opt === "thismonth") {
      fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
      toDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (opt === "last month" || opt === "lastmonth") {
      fromDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      toDate = new Date(now.getFullYear(), now.getMonth(), 0);
    } else if (opt === "maximum") {
      fromDate = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());
      toDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (opt === "custom date range" || opt === "custom") {
      if (customFrom && customTo) {
        return {
          fromDate: customFrom,
          toDate: customTo
        };
      }
      fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
      toDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else {
      fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
      toDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }

    return {
      fromDate: formatDateString(fromDate),
      toDate: formatDateString(toDate)
    };
  };

  // Fetch campaign details callback
  const fetchCampaignDetailsData = useCallback(async (campaign, filterKey, customFrom, customTo) => {
    if (!campaign) return;
    setDetailsLoading(true);
    setDetailsError(null);

    let fromDateObj, toDateObj;
    if (filterKey === "custom") {
      fromDateObj = customFrom ? new Date(customFrom) : new Date();
      toDateObj = customTo ? new Date(customTo) : new Date();
    } else {
      const range = getDateRangeForFilter(filterKey, campaign);
      fromDateObj = range.from;
      toDateObj = range.to;
    }
    const fromDate = formatDateString(fromDateObj);
    const toDate = formatDateString(toDateObj);

    // Resolve IDs
    const tableId = campaign.tableId;
    const campaignId = campaign.campaignId;

    if (!tableId) {
      setDetailsError("Missing campaign tableId");
      console.error("[CampaignDetails] Missing tableId:", campaign);
      setDetailsLoading(false);
      return;
    }

    if (!campaignId) {
      console.error("[CampaignProducts] Missing campaignId:", campaign);
    }

    try {
      // Fetch details and products concurrently
      const [detailsResponse, productsResponse] = await Promise.all([
        sellerService.getCampaignDetails({ tableId, fromDate, toDate }),
        campaignId ? sellerService.getCampaignProducts({ campaignId }) : Promise.resolve({ message: [] }),
      ]);

      // Extract and normalize campaign details
      const details = detailsResponse?.message || detailsResponse?.data?.message || detailsResponse?.data || detailsResponse || {};
      const performanceRows = Array.isArray(details.performance) ? details.performance : [];

      const normalizedDetails = normalizeCampaignDetailInfo(details, campaign);
      const products = extractCampaignProducts(productsResponse).map((p, idx) => normalizeCampaignProduct(p, idx, campaignId));

      let productPerformanceRows = [];

      // Fallback: If campaignDetails performance is empty, fetch product performance for each product
      if (campaignId && !performanceRows.length && products.length) {
        const performanceResponses = await Promise.allSettled(
          products.map((product) =>
            sellerService.getCampaignProductPerformance({
              campaignId,
              productId: product.productId
            })
          )
        );

        productPerformanceRows = performanceResponses.flatMap((result) => {
          if (result.status !== "fulfilled") return [];
          const apiData = getApiData(result.value);
          return safeArray(
            apiData?.message?.performance ??
            apiData?.message?.data?.performance ??
            apiData?.data?.performance ??
            apiData?.performance ??
            apiData?.message ??
            apiData?.data ??
            []
          );
        });
      }

      const allPerformanceRows = performanceRows.length ? performanceRows : productPerformanceRows;
      const metrics = calculateMetricsForRange(details, allPerformanceRows);
      const trendData = buildTrendDataByFilter(allPerformanceRows, fromDateObj, toDateObj, filterKey);

      // Task 14 logs
      console.log("[CampaignDetails] raw response:", detailsResponse);
      console.log("[CampaignDetails] normalized details:", normalizedDetails);
      console.log("[CampaignProducts] raw response:", productsResponse);

      // Update states
      setCampaignDetailInfo(normalizedDetails);
      setCampaignDetailsData({
        metrics,
        trend: trendData
      });
      setCampaignProducts(products);

    } catch (err) {
      console.error("[AdvertisementPage] Error loading details data:", err);
      setDetailsError("Failed to fetch detailed performance. Fallback data shown.");
      setCampaignDetailsData({
        metrics: calculateMetricsForRange({}, []),
        trend: []
      });
      setCampaignProducts([]);
      showToast("Error loading metrics, using empty defaults", "error");
    } finally {
      setDetailsLoading(false);
    }
  }, [sellerId]);

  useEffect(() => {
    if (selectedCampaign) {
      fetchCampaignDetailsData(selectedCampaign, selectedFilter, customFromDate, customToDate);
    }
  }, [selectedCampaign, selectedFilter, customFromDate, customToDate, fetchCampaignDetailsData]);

  const handleSelectCampaign = (campaign) => {
    setSelectedFilter("thisMonth");
    setTempSelectedFilter("thisMonth");
    setCustomFromDate("");
    setCustomToDate("");
    setTempCustomFromDate("");
    setTempCustomToDate("");
    setMetricsExpanded(false);
    setCampaignDetailInfo(null);
    setSelectedCampaign(campaign);
  };

  // Resolve whether the current campaign is active/running
  const resolveIsCampaignActive = useCallback(() => {
    if (campaignDetailInfo && campaignDetailInfo.active !== undefined) {
      return campaignDetailInfo.active === true || String(campaignDetailInfo.active).toLowerCase() === "active" || campaignDetailInfo.active === "true";
    }
    const activeVal = selectedCampaign?.active ?? selectedCampaign?.adStatus ?? selectedCampaign?.Adstatus ?? selectedCampaign?.status;
    if (activeVal === undefined || activeVal === null) return false;
    return activeVal === true || String(activeVal).toLowerCase() === "active" || activeVal === "true";
  }, [campaignDetailInfo, selectedCampaign]);

  // Stop (turn OFF) the currently selected campaign using existing off-campaign API
  const handleStopCampaign = async () => {
    if (!selectedCampaign) return;
    const id = selectedCampaign.campaignId;
    const tableId = selectedCampaign.tableId;

    setActionLoadingId(id);
    try {
      const stopPayload = {
        _id: tableId,
        status: "Inactive",
        active: false
      };
      console.log("[CampaignStop] stopping campaign payload:", stopPayload);
      const stopResponse = await advertisementService.offSellerCampaign(stopPayload);
      console.log("[CampaignStop] offSellerCampaign response:", stopResponse);

      const isStopSuccess = stopResponse?.status === "success";

      if (isStopSuccess) {
        showToast("Campaign stopped successfully", "success");
        setCampaignDetailInfo((prev) => (prev ? { ...prev, active: false, status: "Inactive" } : prev));
        setSelectedCampaign((prev) =>
          prev
            ? { ...prev, adstatus: false, adStatus: false, active: false, status: "Inactive", campaignstatus: "Inactive" }
            : prev
        );
        setCampaigns((prev) =>
          prev.map((c) =>
            c.campaignId === id
              ? { ...c, adstatus: false, adStatus: false, active: false, status: "Inactive", campaignstatus: "Inactive" }
              : c
          )
        );
      } else {
        const stopError = stopResponse?.message?.error || stopResponse?.message?.message || "Failed to stop campaign.";
        showToast(stopError, "error");
      }
    } catch (err) {
      console.error("Error in offSellerCampaign step:", err);
      showToast(err.message || "Failed to stop campaign.", "error");
    } finally {
      setActionLoadingId(null);
    }
  };

  const openEditCampaign = useCallback(() => {
    if (!selectedCampaign) {
      showToast("Please select a campaign to edit.", "error");
      return;
    }

    const isCampaignActive = resolveIsCampaignActive();

    const resolvedTableId =
      selectedCampaign.tableId ||
      selectedCampaign.TableID ||
      selectedCampaign._id ||
      campaignDetailInfo?.tableId ||
      "";

    const resolvedCampaignId =
      selectedCampaign.campaignId ||
      selectedCampaign.CampaignID ||
      selectedCampaign.campaignID ||
      campaignDetailInfo?.campaignId ||
      "";

    if (!resolvedTableId || !resolvedCampaignId) {
      showToast("Cannot edit campaign: missing campaign identifiers.", "error");
      console.error("[CampaignEdit] Missing IDs before navigation:", {
        selectedCampaign,
        campaignDetailInfo,
        resolvedTableId,
        resolvedCampaignId
      });
      return;
    }

    const productIdsForEdit = parseProductIds(
      campaignDetailInfo?.productId ||
      selectedCampaign.productIds ||
      selectedCampaign.productId
    );

    navigate("/advertisement/create-campaign", {
      state: {
        mode: "edit",
        from: "advertisement-details",
        editCampaign: {
          tableId: resolvedTableId,
          _id: resolvedTableId,
          campaignId: resolvedCampaignId,
          title: campaignDetailInfo?.campaignName || selectedCampaign.campaignName || selectedCampaign.title,
          campaignType: campaignDetailInfo?.campaignType || selectedCampaign.campaignType || "Smart",
          startDateTime: campaignDetailInfo?.startDateTime || campaignDetailInfo?.schedule || selectedCampaign.startDateTime || selectedCampaign.startDate,
          endDateTime: campaignDetailInfo?.endDateTime || selectedCampaign.endDateTime || selectedCampaign.endDate,
          dailyBudget: campaignDetailInfo?.dailyBudget || campaignDetailInfo?.budget || selectedCampaign.dailyBudget,
          productIds: productIdsForEdit,
          currentCampaignProducts: campaignProducts,
          status: campaignDetailInfo?.status || selectedCampaign.status || selectedCampaign.campaignstatus || "Inactive",
          campaignstatus: campaignDetailInfo?.status || selectedCampaign.status || selectedCampaign.campaignstatus || "Inactive",
          adstatus: selectedCampaign.adstatus ?? selectedCampaign.adStatus ?? isCampaignActive,
          active: isCampaignActive,
          cpcGoal: campaignDetailInfo?.cpcGoal || selectedCampaign.cpcGoal || selectedCampaign.averageCPC || ""
        }
      }
    });
  }, [selectedCampaign, campaignDetailInfo, campaignProducts, navigate, resolveIsCampaignActive]);


  const handleDeleteCampaignFromDetails = async () => {
    if (!selectedCampaign) return;
    const id = selectedCampaign.campaignId;
    const tableId = selectedCampaign.tableId;

    setActionLoadingId(id);

    // Step 1: Deactivate the campaign
    try {
      const stopPayload = {
        _id: tableId,
        status: "Inactive",
        active: false
      };
      console.log("[CampaignDelete] stopping campaign payload:", stopPayload);
      const stopResponse = await advertisementService.offSellerCampaign(stopPayload);
      console.log("[CampaignDelete] offSellerCampaign response:", stopResponse);

      const isStopSuccess = stopResponse?.status === "success";

      if (!isStopSuccess) {
        const stopError = stopResponse?.message?.error || stopResponse?.message?.message || "Failed to deactivate campaign.";
        showToast(stopError, "error");
        setActionLoadingId(null);
        return;
      }
    } catch (err) {
      console.error("Error in offSellerCampaign step:", err);
      showToast(err.message || "Failed to deactivate campaign step.", "error");
      setActionLoadingId(null);
      return;
    }

    // Step 2: Delete the campaign
    try {
      const deletePayload = {
        _id: tableId,
        sellerId
      };
      console.log("[CampaignDelete] final delete payload:", deletePayload);
      const deleteResponse = advertisementService.deleteSellerCampaign
        ? await advertisementService.deleteSellerCampaign(deletePayload)
        : await advertisementService.deleteCampaign(id, sellerId);
      console.log("[CampaignDelete] deleteSellerCampaign response:", deleteResponse);

      const isDeleteSuccess = deleteResponse?.status === "success";

      if (isDeleteSuccess) {
        const successMsg = deleteResponse?.message?.message || deleteResponse?.message || "Campaign deleted successfully";
        showToast(successMsg, "success");
        loadPageData();
        setSelectedCampaign(null);
      } else {
        const deleteError = deleteResponse?.message?.error || deleteResponse?.message?.message || "Failed to delete campaign.";
        showToast(deleteError, "error");
      }
    } catch (err) {
      console.error("Error in deleteSellerCampaign step:", err);
      showToast(err.message || "Failed to delete campaign step.", "error");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Filter campaigns by search query locally
  const filteredCampaigns = useMemo(() => {
    if (!searchQuery.trim()) return campaigns;
    const q = searchQuery.toLowerCase();
    return campaigns.filter(c => {
      const name = String(c.campaignName || "").toLowerCase();
      const id = String(c.campaignId || "").toLowerCase();
      return name.includes(q) || id.includes(q);
    });
  }, [campaigns, searchQuery]);

  // Render Skeleton Placeholders
  const renderSkeletons = () => (
    <div className="ad-skeleton-container">
      <div className="skeleton-main-grid" style={{ gridTemplateColumns: "1fr" }}>
        <div className="skeleton-right skeleton-pulse" style={{ height: "400px" }} />
      </div>
    </div>
  );

  return (
    <div className="ad-page-root">
      {/* Toast Notification Container */}
      {toast && (
        <div className={`ad-toast-banner ${toast.type}`}>
          <AlertCircle size={18} />
          <span>{toast.message}</span>
        </div>
      )}

      {loading ? (
        renderSkeletons()
      ) : error ? (
        <div className="ad-error-container">
          <div className="ad-error-card">
            <AlertCircle size={42} className="error-icon" />
            <h3>Unable to load campaigns</h3>
            <p>{error}</p>
            <button type="button" className="btn-retry-sync" onClick={loadPageData}>
              Try Again
            </button>
          </div>
        </div>
      ) : selectedCampaign ? (
        <div className="ad-details-container">
          <div className="ad-page-header">
            <div className="header-breadcrumbs-area">
              <nav className="ad-breadcrumb">
                <span>Dashboard</span> &gt; <span>Boost Sales</span> &gt; <span style={{ cursor: "pointer" }} onClick={() => setSelectedCampaign(null)}>Advertisement</span> &gt; <span className="active">Campaign Details</span>
              </nav>
              <h1 className="ad-page-title">Campaign Details</h1>
            </div>
            <div className="header-navigation-icons">
              <button className="details-back-link" style={{ marginBottom: 0 }} onClick={() => setSelectedCampaign(null)}>
                <ArrowLeft size={16} />
                <span>Back to Hub</span>
              </button>
            </div>
          </div>

          <div className="details-header-row">
            <div>
              <h2 className="campaign-name-bold" style={{ fontSize: "20px", margin: 0 }}>
                {campaignDetailInfo?.campaignName || selectedCampaign.campaignName}
              </h2>
              <span style={{ fontSize: "12px", color: "var(--text-muted)", fontFamily: "monospace" }}>
                Campaign ID: {selectedCampaign.campaignId}
              </span>
            </div>

            <div className="details-header-actions">
              <div className="toggle-switch-container" onClick={() => {
                console.log("[CampaignDetails] toggle clicked:", selectedCampaign);
                const isCampaignActive = resolveIsCampaignActive();
                setConfirmModalType(isCampaignActive ? "stop" : "start");
                setShowEditConfirmModal(true);
              }}>
                <span className="toggle-switch-label">
                  {(() => {
                    const isCampaignActive = resolveIsCampaignActive();
                    return isCampaignActive ? "Running" : "Paused";
                  })()}
                </span>
                <div className={`toggle-switch ${resolveIsCampaignActive() ? "active" : ""}`}>
                  <div className="toggle-switch-handle" />
                </div>
              </div>
            </div>
          </div>

          <div className="date-selector-row">
            <button className="btn-date-picker-trigger" onClick={() => {
              setTempSelectedFilter(selectedFilter);
              setTempCustomFromDate(customFromDate);
              setTempCustomToDate(customToDate);
              setShowDateFilterModal(true);
            }}>
              <Calendar size={16} />
              <span>
                {selectedFilter === "custom" && customFromDate && customToDate
                  ? `${formatDateLabel(customFromDate)} - ${formatDateLabel(customToDate)}`
                  : (filterLabels[selectedFilter] || "Select Date Range")}
              </span>
              <ChevronDown size={14} />
            </button>
          </div>

          {/* Performance metrics overview */}
          <div className="details-card-box">
            <h3>Performance Metrics</h3>
            {detailsLoading ? (
              <div className="skeleton-pulse" style={{ height: "100px", backgroundColor: "#f1f5f9", borderRadius: "8px" }} />
            ) : detailsError ? (
              <div style={{ color: "var(--danger-color)", fontSize: "14px", padding: "10px 0" }}>{detailsError}</div>
            ) : (
              <>
                <div className="results-metrics-grid">
                  <div className="results-metric-item">
                    <div className="label">Haatza Sales</div>
                    <div className="value">
                      {campaignDetailsData?.metrics?.haatzaSales !== null && campaignDetailsData?.metrics?.haatzaSales !== undefined
                        ? `₹${campaignDetailsData.metrics.haatzaSales}`
                        : "--"}
                    </div>
                  </div>
                  <div className="results-metric-item">
                    <div className="label">Cost Per Sale</div>
                    <div className="value">
                      {campaignDetailsData?.metrics?.costPerSale !== null && campaignDetailsData?.metrics?.costPerSale !== undefined
                        ? `₹${campaignDetailsData.metrics.costPerSale}`
                        : "--"}
                    </div>
                  </div>
                  <div className="results-metric-item">
                    <div className="label">Total Spend</div>
                    <div className="value">
                      ₹{formatTwoDecimal(campaignDetailsData?.metrics?.totalSpend)}
                    </div>
                  </div>
                  <div className="results-metric-item">
                    <div className="label">Reach</div>
                    <div className="value">
                      {campaignDetailsData?.metrics?.reach !== null && campaignDetailsData?.metrics?.reach !== undefined
                        ? campaignDetailsData.metrics.reach.toLocaleString()
                        : "--"}
                    </div>
                  </div>
                  <div className="results-metric-item">
                    <div className="label">Impressions</div>
                    <div className="value">
                      {campaignDetailsData?.metrics?.impressions !== null && campaignDetailsData?.metrics?.impressions !== undefined
                        ? campaignDetailsData.metrics.impressions.toLocaleString()
                        : "--"}
                    </div>
                  </div>

                  {metricsExpanded && (
                    <>
                      <div className="results-metric-item">
                        <div className="label">Clicks</div>
                        <div className="value">
                          {campaignDetailsData?.metrics?.clicks !== null && campaignDetailsData?.metrics?.clicks !== undefined
                            ? campaignDetailsData.metrics.clicks.toLocaleString()
                            : "--"}
                        </div>
                      </div>
                      <div className="results-metric-item">
                        <div className="label">Sales</div>
                        <div className="value">
                          {campaignDetailsData?.metrics?.sales !== null && campaignDetailsData?.metrics?.sales !== undefined
                            ? campaignDetailsData.metrics.sales.toLocaleString()
                            : "--"}
                        </div>
                      </div>
                      <div className="results-metric-item">
                        <div className="label">Revenue</div>
                        <div className="value">
                          {campaignDetailsData?.metrics?.revenue !== null && campaignDetailsData?.metrics?.revenue !== undefined
                            ? `₹${campaignDetailsData.metrics.revenue.toLocaleString()}`
                            : "--"}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="see-more-toggle-row">
                  <button className="btn-see-more-toggle" onClick={() => setMetricsExpanded(!metricsExpanded)}>
                    <span>{metricsExpanded ? "See Less" : "See More"}</span>
                    <ChevronDown size={14} style={{ transform: metricsExpanded ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }} />
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="details-section-grid">
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              <div className="details-card-box">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "8px" }}>
                  <h3 style={{ margin: 0 }}>Campaign Settings</h3>
                  <button
                    type="button"
                    onClick={openEditCampaign}
                    aria-label="Edit campaign"
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#2563eb",
                      fontWeight: "700",
                      cursor: "pointer",
                      fontSize: "15px",
                      lineHeight: 1,
                      padding: "6px 4px",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      minWidth: "38px",
                      opacity: 1,
                      visibility: "visible"
                    }}
                  >
                    Edit
                  </button>
                </div>
                <div className="info-field-row">
                  <span className="label">Campaign Name</span>
                  <span className="value">{campaignDetailInfo?.campaignName || selectedCampaign.campaignName}</span>
                </div>
                <div className="info-field-row">
                  <span className="label">Daily Budget</span>
                  <span className="value">
                    {(() => {
                      const budget = campaignDetailInfo?.budget !== undefined ? campaignDetailInfo.budget : selectedCampaign.dailyBudget;
                      return budget !== "" && budget !== null && budget !== undefined ? `₹${budget}/day` : "--";
                    })()}
                  </span>
                </div>
                <div className="info-field-row">
                  <span className="label">Campaign Type</span>
                  <span className="value">{campaignDetailInfo?.campaignType || selectedCampaign.campaignType}</span>
                </div>
                <div className="info-field-row">
                  <span className="label">Schedule</span>
                  <span className="value">
                    {(() => {
                      const sched = campaignDetailInfo?.schedule || selectedCampaign.startDate;
                      if (!sched) return "N/A";
                      return formatDateLabel(sched);
                    })()}
                    {(campaignDetailInfo?.endDate || selectedCampaign.endDate)
                      ? ` - ${formatDateLabel(campaignDetailInfo?.endDate || selectedCampaign.endDate)}`
                      : " - Ongoing"}
                  </span>
                </div>
                <div className="info-field-row">
                  <span className="label">Status / Plan</span>
                  <span className="value">
                    {campaignDetailInfo?.status || selectedCampaign.status}
                    {(campaignDetailInfo?.plan || selectedCampaign.plan)
                      ? ` / ${campaignDetailInfo?.plan || selectedCampaign.plan}`
                      : ""}
                  </span>
                </div>
              </div>

              <div className="details-card-box">
                <h3 className="chart-header-title">
                  <TrendingUp size={18} className="chart-header-icon" />
                  <span>Campaign Trend</span>
                </h3>
                {detailsLoading ? (
                  <div className="skeleton-pulse" style={{ height: "180px", backgroundColor: "#f1f5f9", borderRadius: "8px" }} />
                ) : !campaignDetailsData?.trend || campaignDetailsData.trend.length === 0 ? (
                  <div className="campaigns-empty-view" style={{ padding: "20px" }}>
                    <TrendingUp size={24} className="empty-chart-icon" />
                    <p>No trend data available for the selected dates.</p>
                  </div>
                ) : (
                  <div className="chart-container-box">
                    {(() => {
                      const trend = campaignDetailsData.trend;
                      const maxTotal = Math.max(...trend.map(d => d.reach + d.impressions + d.clicks), 10);

                      let yMax = 50;
                      if (maxTotal > 250) {
                        yMax = Math.ceil(maxTotal / 100) * 100;
                      } else if (maxTotal > 100) {
                        yMax = Math.ceil(maxTotal / 50) * 50;
                      } else {
                        yMax = Math.ceil(maxTotal / 20) * 20;
                      }
                      if (yMax < 50) yMax = 50;

                      const intervalCount = 5;
                      const stepVal = yMax / intervalCount;
                      const ySteps = [];
                      for (let i = intervalCount; i >= 0; i--) {
                        ySteps.push(Math.round(i * stepVal));
                      }

                      return (
                        <div className="chart-wrapper">
                          <div className="chart-y-axis">
                            {ySteps.map((step, idx) => (
                              <span key={idx} className="y-axis-label">{step}</span>
                            ))}
                          </div>
                          <div className="chart-grid-container">
                            <div className="chart-plot-area">
                              <div className="grid-lines">
                                {ySteps.map((_, idx) => (
                                  <div key={idx} className="grid-line" />
                                ))}
                              </div>
                              <div className="chart-bars-area">
                                {trend.map((dataPoint, idx) => {
                                  const total = dataPoint.reach + dataPoint.impressions + dataPoint.clicks;
                                  const colHeight = (total / yMax) * 100;

                                  const reachHeight = total > 0 ? (dataPoint.reach / total) * 100 : 0;
                                  const impHeight = total > 0 ? (dataPoint.impressions / total) * 100 : 0;
                                  const clickHeight = total > 0 ? (dataPoint.clicks / total) * 100 : 0;

                                  return (
                                    <div className="chart-bar-column" key={idx}>
                                      <div className="chart-stacked-bar" style={{ height: `${colHeight}%` }}>
                                        {clickHeight > 0 && (
                                          <div className="chart-segment clicks" style={{ height: `${clickHeight}%` }}>
                                            <div className="chart-tooltip">Clicks: {dataPoint.clicks.toLocaleString()}</div>
                                          </div>
                                        )}
                                        {impHeight > 0 && (
                                          <div className="chart-segment impressions" style={{ height: `${impHeight}%` }}>
                                            <div className="chart-tooltip">Impressions: {dataPoint.impressions.toLocaleString()}</div>
                                          </div>
                                        )}
                                        {reachHeight > 0 && (
                                          <div className="chart-segment reach" style={{ height: `${reachHeight}%` }}>
                                            <div className="chart-tooltip">Reach: {dataPoint.reach.toLocaleString()}</div>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                            <div className="chart-x-axis">
                              {trend.map((dataPoint, idx) => (
                                <span className="chart-x-label" key={idx}>{formatDateLabel(dataPoint.date)}</span>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    <div className="chart-legend-row">
                      <div className="legend-item">
                        <div className="legend-icon reach">
                          <span className="legend-bar bar-1"></span>
                          <span className="legend-bar bar-2"></span>
                          <span className="legend-bar bar-3"></span>
                        </div>
                        <span>Reach</span>
                      </div>
                      <div className="legend-item">
                        <div className="legend-icon impressions">
                          <span className="legend-bar bar-1"></span>
                          <span className="legend-bar bar-2"></span>
                          <span className="legend-bar bar-3"></span>
                        </div>
                        <span>Impressions</span>
                      </div>
                      <div className="legend-item">
                        <div className="legend-icon clicks">
                          <span className="legend-bar bar-1"></span>
                          <span className="legend-bar bar-2"></span>
                          <span className="legend-bar bar-3"></span>
                        </div>
                        <span>Clicks</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              <div className="details-card-box" style={{ display: "flex", flexDirection: "column" }}>
                <h3>Campaign Products</h3>
                <div className="details-products-viewport">
                  {detailsLoading ? (
                    <div className="skeleton-pulse" style={{ height: "120px", backgroundColor: "#f1f5f9", borderRadius: "8px" }} />
                  ) : campaignProducts.length === 0 ? (
                    <div className="products-empty-view" style={{ padding: "20px" }}>
                      <p>No products linked to this campaign.</p>
                    </div>
                  ) : (
                    campaignProducts.map((p, idx) => (
                      <div className="product-item-card" key={p.id}>
                        <div className="product-img-holder">
                          {p.image ? (
                            <img src={p.image} alt={p.productName} />
                          ) : (
                            <span className="img-placeholder">N/A</span>
                          )}
                        </div>
                        <div className="product-info-column">
                          <span className="product-item-name">{p.productName}</span>
                          <span className="product-item-sku">ID: {p.id}</span>
                          {p.price && <span className="product-item-price">₹{p.price}</span>}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="ad-page-header">
            <div className="header-breadcrumbs-area">
              <nav className="ad-breadcrumb">
                <span>Dashboard</span> &gt; <span>Boost Sales</span> &gt; <span className="active">Advertisement</span>
              </nav>
              <h1 className="ad-page-title">Advertisement</h1>
            </div>
            <div className="header-navigation-icons">
              <button
                type="button"
                className="btn-create-campaign-main"
                onClick={() => navigate("/advertisement/create-campaign")}
              >
                <Plus size={16} />
                <span>New Campaign</span>
              </button>
            </div>
          </div>

          <div className="ad-main-layout" style={{ display: "block" }}>
            <div className="ad-campaigns-list-card">
              {/* Search Input Bar */}
              <div className="product-search-wrapper ad-campaign-search-wrapper">
                <Search size={16} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search Campaign"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-product-input"
                />
              </div>

              <div className="table-wrapper-horizontal">
                {filteredCampaigns.length === 0 ? (
                  <div className="campaigns-empty-view">
                    <TrendingUp size={40} className="empty-chart-icon" />
                    <h4>No Campaigns Found</h4>
                    <p>Drive more traffic to your listings by launching your first campaign today.</p>
                    <button
                      className="btn-create-campaign-inline"
                      onClick={() => navigate("/advertisement/create-campaign")}
                    >
                      New Campaign
                    </button>
                  </div>
                ) : (
                  <table className="campaigns-desktop-table">
                    <thead>
                      <tr>
                        <th>Campaign Name</th>
                        <th>Campaign ID</th>
                        <th>Campaign Type</th>
                        <th>Status</th>
                        <th>Start Date/Time</th>
                        <th>Budget</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCampaigns.map((c) => {
                        const id = c.campaignId || c.id;
                        const statusClass = String(c.status || "active").toLowerCase().replace(/\s+/g, "-");

                        return (
                          <tr key={id} onClick={() => handleSelectCampaign(c)} style={{ cursor: "pointer" }}>
                            <td>
                              <div className="campaign-name-container">
                                <span className="campaign-name-bold">{c.campaignName}</span>
                                {c.plan && <span className="campaign-plan-subtitle">{c.plan}</span>}
                              </div>
                            </td>
                            <td>
                              <span className="campaign-id-cell" style={{ fontFamily: "monospace", color: "#475569" }}>
                                {c.campaignId}
                              </span>
                            </td>
                            <td>
                              <span className="campaign-type-pill">{c.campaignType}</span>
                            </td>
                            <td>
                              <span className={`status-capsule ${statusClass}`}>
                                {c.status}
                              </span>
                            </td>
                            <td>
                              <span className="campaign-date-span">
                                {c.startDate ? formatDateLabel(c.startDate) : "N/A"}{" "}
                                {c.startTime || ""}
                              </span>
                            </td>
                            <td>
                              <span className="campaign-budget-value">₹{c.dailyBudget}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Date Filter modal overlay */}
      {showDateFilterModal && (
        <div className="date-filter-modal-overlay" onClick={() => setShowDateFilterModal(false)}>
          <div className="date-filter-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "420px", width: "90%", borderRadius: "16px", padding: "20px", backgroundColor: "#ffffff" }}>
            {/* Modal Header */}
            <div className="modal-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "none", paddingBottom: 0, marginBottom: "16px", position: "relative" }}>
              <h3 style={{ fontSize: "18px", fontWeight: "700", color: "#0f172a", margin: 0, width: "100%", textAlign: "center" }}>
                Filter by date
              </h3>
              <button
                className="close-btn"
                onClick={() => setShowDateFilterModal(false)}
                style={{ background: "none", border: "none", fontSize: "22px", cursor: "pointer", color: "#64748b", position: "absolute", right: "0px", top: "-2px" }}
              >
                &times;
              </button>
            </div>

            {tempSelectedFilter === "custom" ? (
              /* Custom Calendar View (Image 1) */
              <div>
                <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "12px", marginBottom: "12px" }}>
                  <div style={{ fontSize: "16px", fontWeight: "700", color: "#0f172a" }}>
                    {tempCustomFromDate && tempCustomToDate
                      ? `${formatDisplayDate(new Date(tempCustomFromDate))} - ${formatDisplayDate(new Date(tempCustomToDate))}`
                      : tempCustomFromDate
                        ? `From: ${formatDisplayDate(new Date(tempCustomFromDate))}`
                        : "Select date range"}
                  </div>
                </div>

                <SingleMonthCalendar
                  fromDate={tempCustomFromDate}
                  toDate={tempCustomToDate}
                  onChange={(from, to) => {
                    setTempCustomFromDate(from);
                    setTempCustomToDate(to);
                  }}
                  onSelectPreset={(key) => {
                    const range = getDateRangeForFilter(key, selectedCampaign);
                    const fromStr = formatDateString(range.from);
                    const toStr = formatDateString(range.to);
                    setTempCustomFromDate(fromStr);
                    setTempCustomToDate(toStr);
                  }}
                />

                <div style={{ display: "flex", gap: "12px", marginTop: "24px", borderTop: "1px solid #f1f5f9", paddingTop: "16px" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setTempCustomFromDate("");
                      setTempCustomToDate("");
                    }}
                    style={{
                      flex: 1,
                      backgroundColor: "#ffffff",
                      color: "#0f172a",
                      border: "1px solid #cbd5e1",
                      padding: "12px",
                      borderRadius: "10px",
                      fontWeight: "600",
                      fontSize: "14px",
                      cursor: "pointer",
                      transition: "all 0.2s"
                    }}
                  >
                    Clear
                  </button>
                  <button
                    className="btn-apply-custom-date"
                    disabled={!tempCustomFromDate || !tempCustomToDate}
                    onClick={() => {
                      setSelectedFilter("custom");
                      setCustomFromDate(tempCustomFromDate);
                      setCustomToDate(tempCustomToDate);
                      setShowDateFilterModal(false);
                    }}
                    style={{
                      flex: 1,
                      backgroundColor: (!tempCustomFromDate || !tempCustomToDate) ? "#cbd5e1" : "#2563eb",
                      color: "#fff",
                      border: "none",
                      padding: "12px",
                      borderRadius: "10px",
                      fontWeight: "600",
                      fontSize: "14px",
                      cursor: (!tempCustomFromDate || !tempCustomToDate) ? "not-allowed" : "pointer",
                      transition: "background-color 0.2s"
                    }}
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              /* Preset Radio List View (Image 2) */
              <div>
                <div className="date-options-radio-list" style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "16px", marginTop: "12px" }}>
                  {[
                    "last7days",
                    "last30days",
                    "maximum",
                    "today",
                    "yesterday",
                    "thisWeek",
                    "thisMonth"
                  ].map((key) => {
                    const isSelected = tempSelectedFilter === key;
                    const preview = getFilterPreview(key, selectedCampaign);
                    return (
                      <div
                        key={key}
                        className={`date-radio-option-item ${isSelected ? "selected" : ""}`}
                        onClick={() => setTempSelectedFilter(key)}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "14px",
                          cursor: "pointer"
                        }}
                      >
                        <input
                          type="radio"
                          name="tempDateFilter"
                          checked={isSelected}
                          onChange={() => setTempSelectedFilter(key)}
                          style={{
                            margin: "2px 0 0 0",
                            width: "20px",
                            height: "20px",
                            accentColor: "#2563eb",
                            cursor: "pointer"
                          }}
                        />
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px", flex: 1 }}>
                          <span style={{ fontSize: "15px", fontWeight: "600", color: "#0f172a" }}>
                            {filterLabels[key]}
                          </span>
                          {preview && (
                            <span style={{ fontSize: "13px", color: "#64748b", fontWeight: "400" }}>
                              {preview}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ borderTop: "1px solid #e2e8f0", margin: "16px 0" }} />

                <div
                  onClick={() => setTempSelectedFilter("custom")}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 0",
                    cursor: "pointer"
                  }}
                >
                  <span style={{ fontSize: "15px", fontWeight: "600", color: "#0f172a" }}>
                    Custom date range
                  </span>
                  <ChevronRight size={20} color="#64748b" />
                </div>

                <button
                  className="btn-apply-custom-date"
                  onClick={() => {
                    setSelectedFilter(tempSelectedFilter);
                    setShowDateFilterModal(false);
                  }}
                  style={{
                    backgroundColor: "#2563eb",
                    color: "#fff",
                    border: "none",
                    padding: "14px",
                    borderRadius: "10px",
                    fontWeight: "600",
                    fontSize: "15px",
                    cursor: "pointer",
                    transition: "background-color 0.2s",
                    marginTop: "24px",
                    width: "100%"
                  }}
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Campaign Start/Stop Confirmation Modal */}
      {showEditConfirmModal && (
        <div className="date-filter-modal-overlay" onClick={() => setShowEditConfirmModal(false)}>
          <div className="date-filter-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "420px", borderRadius: "16px", padding: "24px" }}>
            <div style={{ textAlign: "center" }}>
              <h3 style={{ fontSize: "18px", fontWeight: "700", color: "#0f172a", marginBottom: "12px", border: "none", padding: 0 }}>
                {confirmModalType === "stop"
                  ? "Are you sure you want to stop campaign?"
                  : "Are you sure you want to start campaign?"}
              </h3>
              <p style={{ fontSize: "14px", color: "#64748b", marginBottom: "24px" }}>
                {confirmModalType === "stop"
                  ? "This will stop the campaign. You can start it again later."
                  : "This will take you to the campaign setup page where you can edit its details."}
              </p>
              <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
                <button
                  type="button"
                  onClick={() => setShowEditConfirmModal(false)}
                  style={{
                    flex: 1,
                    background: "#f1f5f9",
                    border: "1px solid #cbd5e1",
                    color: "#475569",
                    padding: "10px",
                    borderRadius: "8px",
                    fontWeight: "600",
                    cursor: "pointer",
                    fontSize: "14px"
                  }}
                >
                  No
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditConfirmModal(false);

                    if (confirmModalType === "stop") {
                      handleStopCampaign();
                      return;
                    }

                    openEditCampaign();
                  }}
                  style={{
                    flex: 1,
                    background: confirmModalType === "stop" ? "#ef4444" : "var(--primary-color)",
                    color: "#fff",
                    border: "none",
                    padding: "10px",
                    borderRadius: "8px",
                    fontWeight: "600",
                    cursor: "pointer",
                    fontSize: "14px"
                  }}
                >
                  Yes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Campaign Delete Confirmation Modal — retained in code but the trigger button
          on the details page has been removed per requirements (Delete Campaign hidden). */}
      {showDeleteConfirmModal && (
        <div className="date-filter-modal-overlay" onClick={() => setShowDeleteConfirmModal(false)}>
          <div className="date-filter-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "420px", borderRadius: "16px", padding: "24px" }}>
            <div style={{ textAlign: "center" }}>
              <h3 style={{ fontSize: "18px", fontWeight: "700", color: "#ef4444", marginBottom: "12px", border: "none", padding: 0 }}>
                {(() => {
                  const isCampaignActive = resolveIsCampaignActive();
                  return isCampaignActive
                    ? "This campaign is currently active. Are you sure you want to delete it?"
                    : "Are you sure you want to delete this campaign?";
                })()}
              </h3>
              <p style={{ fontSize: "14px", color: "#64748b", marginBottom: "24px" }}>
                This action is permanent and cannot be undone.
              </p>
              <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirmModal(false)}
                  style={{
                    flex: 1,
                    background: "#f1f5f9",
                    border: "1px solid #cbd5e1",
                    color: "#475569",
                    padding: "10px",
                    borderRadius: "8px",
                    fontWeight: "600",
                    cursor: "pointer",
                    fontSize: "14px"
                  }}
                >
                  No
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteConfirmModal(false);
                    handleDeleteCampaignFromDetails();
                  }}
                  style={{
                    flex: 1,
                    background: "#ef4444",
                    color: "#fff",
                    border: "none",
                    padding: "10px",
                    borderRadius: "8px",
                    fontWeight: "600",
                    cursor: "pointer",
                    fontSize: "14px"
                  }}
                >
                  Yes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvertisementPage;