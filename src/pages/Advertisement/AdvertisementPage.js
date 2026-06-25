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

const extractSellerCampaigns = (response) => {
  const apiData = getApiData(response);
  if (Array.isArray(apiData)) return apiData;
  const campaigns =
    apiData?.message?.campaigns ??
    apiData?.campaigns ??
    apiData?.data?.campaigns ??
    apiData?.data?.message?.campaigns ??
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
  const title = item.title ?? item.campaignName ?? "Unnamed Campaign";
  const startDateTime = item.startDateTime ?? item.startDate ?? "";
  const endDateTime = item.endDateTime ?? item.endDate ?? "";
  const status = item.campaignstatus ?? item.status ?? "Pending";
  const adStatus = item.Adstatus ?? item.adStatus ?? "";
  const productIds = Array.isArray(item.productId) ? item.productId : (Array.isArray(item.productIds) ? item.productIds : []);
  const plan = item.plan ?? item.planName ?? item.subscriptionPlan ?? item.packageName ?? item.statusPlan ?? "";
  const tableId = item.tableId ?? item.TableID ?? item.table_id ?? item.id ?? item._id ?? "";
  const campaignId = item.campaignId ?? item.CampaignID ?? item.campaignID ?? item.id ?? "";

  return {
    id: tableId || campaignId || `campaign-${index}`,
    tableId,
    campaignId,
    title: title,
    campaignName: title,
    campaignType: item.campaignType ?? "Smart",
    status: status,
    adStatus: adStatus,
    startDateTime: startDateTime,
    endDateTime: endDateTime,
    startDate: startDateTime, // fallback for legacy code / test
    endDate: endDateTime,     // fallback for legacy code / test
    dailyBudget: item.dailyBudget ?? 0,
    productIds: productIds,
    plan: plan
  };
};

const extractCampaignDetails = (response) => {
  const apiData = getApiData(response);
  return apiData?.message ?? apiData?.data ?? apiData ?? {};
};

const extractCampaignProducts = (response) => {
  const apiData = getApiData(response);
  const products =
    apiData?.message?.products ??
    apiData?.message?.Products ??
    apiData?.message?.data?.products ??
    apiData?.message?.data?.Products ??
    apiData?.products ??
    apiData?.Products ??
    apiData?.data?.products ??
    apiData?.data?.Products ??
    apiData?.data?.message?.products ??
    apiData?.data?.message?.Products ??
    apiData?.message ??
    apiData?.data?.message ??
    [];

  return safeArray(products);
};

const normalizeCampaignDetailInfo = (details, selectedCampaign) => {
  const campaignInfo = details?.campaign ?? {};
  
  return {
    campaignName: safeString(campaignInfo.title ?? selectedCampaign.title ?? selectedCampaign.campaignName, "Unnamed Campaign"),
    budget: campaignInfo.dailyBudget ?? selectedCampaign.dailyBudget ?? "",
    campaignType: safeString(campaignInfo.campaignType ?? selectedCampaign.campaignType, "Smart"),
    schedule: safeString(campaignInfo.startDateTime ?? selectedCampaign.startDateTime ?? selectedCampaign.startDate, ""),
    endDateTime: campaignInfo.endDateTime ?? selectedCampaign.endDateTime ?? selectedCampaign.endDate ?? "",
    status: safeString(campaignInfo.status ?? selectedCampaign.status, "Pending"),
    active: campaignInfo.active ?? selectedCampaign.adStatus ?? false,
    campaignId: campaignInfo.campaignId ?? selectedCampaign.campaignId,
    plan: safeString(campaignInfo.plan ?? selectedCampaign.plan, "")
  };
};

const normalizeCampaignProduct = (product, index, campaignId = "") => {
  const source = product?.product ?? product?.data ?? product;

  return {
    id: safeString(
      source.productId ?? source.ProductID ?? source.id ?? source._id,
      `campaign-product-${index}`
    ),
    campaignId: safeString(source.campaignId ?? campaignId),
    productId: safeString(source.productId ?? source.ProductID ?? source.id ?? source._id),
    productName: safeString(source.name ?? source.productName ?? source.title, "Unnamed Product"),
    image: source.mainmedia ?? source.image ?? source.imageUrl ?? source.productImage ?? source.thumbnail ?? "",
    price: source.price ?? source.sellingPrice ?? source.finalPrice ?? source.mrp ?? "",
    raw: source
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

const getDateRangeForFilter = (filterKey) => {
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

  if (filterKey === "thisWeek") {
    return { from: getStartOfWeekMonday(today), to: today };
  }

  if (filterKey === "lastWeek") {
    const currentWeekStart = getStartOfWeekMonday(today);
    const lastWeekEnd = new Date(currentWeekStart);
    lastWeekEnd.setDate(currentWeekStart.getDate() - 1);
    const lastWeekStart = getStartOfWeekMonday(lastWeekEnd);
    return { from: lastWeekStart, to: lastWeekEnd };
  }

  if (filterKey === "thisMonth") {
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from: first, to: today };
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

const sumByKey = (rows, key) => {
  return rows.reduce((sum, row) => {
    const value = Number(row?.[key]);
    return sum + (Number.isFinite(value) ? value : 0);
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
  
  const reach = dataSrc.reach !== undefined && dataSrc.reach !== null ? dataSrc.reach : (rows.length ? sumByKey(rows, "reach") : null);
  const impressions = dataSrc.impressions !== undefined && dataSrc.impressions !== null ? dataSrc.impressions : (rows.length ? sumByKey(rows, "impressions") : null);
  const clicks = dataSrc.clicks !== undefined && dataSrc.clicks !== null ? dataSrc.clicks : (rows.length ? sumByKey(rows, "clicks") : null);
  const sales = dataSrc.sales !== undefined && dataSrc.sales !== null ? dataSrc.sales : (rows.length ? sumByKey(rows, "sales") : null);
  const revenue = dataSrc.revenue !== undefined && dataSrc.revenue !== null ? dataSrc.revenue : (rows.length ? sumByKey(rows, "revenue") : null);
  const totalSpend = dataSrc.totalSpend !== undefined && dataSrc.totalSpend !== null ? dataSrc.totalSpend : (rows.length ? (sumByKey(rows, "totalSpend") || sumByKey(rows, "spend")) : null);
  const haatzaSales = dataSrc.haatzaSales !== undefined && dataSrc.haatzaSales !== null ? dataSrc.haatzaSales : (dataSrc.sales !== undefined && dataSrc.sales !== null ? dataSrc.sales : sales);
  const costPerSale = dataSrc.costPerSale !== undefined && dataSrc.costPerSale !== null ? dataSrc.costPerSale : (sales > 0 ? totalSpend / sales : null);

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
  yesterday: "Yesterday",
  today: "Today",
  lastWeek: "Last week",
  lastMonth: "Last month",
  thisWeek: "This week",
  thisMonth: "This month",
  custom: "Custom date range"
};

const getFilterPreview = (filterKey) => {
  if (filterKey === "custom") return null;
  try {
    const { from, to } = getDateRangeForFilter(filterKey);
    if (filterKey === "today" || filterKey === "yesterday") {
      return formatDisplayDate(from);
    }
    return `${formatDisplayDate(from)} - ${formatDisplayDate(to)}`;
  } catch (e) {
    return null;
  }
};

const AdvertisementPage = () => {
  const sellerId = resolveSellerId();
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

      const parsedCampaigns = extractSellerCampaigns(response).map((c, idx) => normalizeCampaign(c, idx));
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

    switch (option) {
      case "Today":
        fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        toDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "Yesterday":
        fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        toDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        break;
      case "Last 7 days":
        fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
        toDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "Last 30 days":
        fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
        toDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "This week": {
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        fromDate = new Date(now.getFullYear(), now.getMonth(), diff);
        toDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      }
      case "This Month":
      case "This month":
        fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
        toDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "Maximum":
        fromDate = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());
        toDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "Custom date range":
      case "Custom":
        if (customFrom && customTo) {
          return {
            fromDate: customFrom,
            toDate: customTo
          };
        }
        fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
        toDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      default:
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
      const range = getDateRangeForFilter(filterKey);
      fromDateObj = range.from;
      toDateObj = range.to;
    }
    const fromDate = formatDateString(fromDateObj);
    const toDate = formatDateString(toDateObj);
    
    // Resolve IDs
    const tableId = campaign.tableId;
    const campaignId = campaign.campaignId;

    if (!tableId) {
      console.error("[CampaignDetails] Missing tableId", { tableId, campaignId, selectedCampaign: campaign });
      setDetailsError("Missing campaign table ID. Cannot load details.");
      setDetailsLoading(false);
      return;
    }

    try {
      // Fetch details and products concurrently
      const [detailsResponse, productsResponse] = await Promise.all([
        sellerService.getCampaignDetails({ tableId, fromDate, toDate }),
        campaignId ? sellerService.getCampaignProducts({ campaignId }) : Promise.resolve({ message: [] }),
      ]);

      // Extract and normalize campaign details
      const details = extractCampaignDetails(detailsResponse);
      const campaignInfo = details.campaign ?? {};
      const performanceRows = safeArray(details.performance);

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

      // Temporary debug logs as requested in Step 10
      console.log("[CampaignDetails] selectedCampaign:", campaign);
      console.log("[CampaignDetails] tableId:", tableId);
      console.log("[CampaignDetails] campaignId:", campaignId);
      console.log("[CampaignDetails] dateRange:", { fromDate, toDate });
      console.log("[CampaignDetails] raw details response:", detailsResponse);
      console.log("[CampaignDetails] campaignInfo:", campaignInfo);
      console.log("[CampaignDetails] performanceRows:", performanceRows);
      console.log("[CampaignDetails] raw products response:", productsResponse);
      console.log("[CampaignDetails] normalized products:", products);
      console.log("[CampaignDetails] productPerformanceRows:", productPerformanceRows);
      console.log("[CampaignDetails] metrics:", metrics);
      console.log("[CampaignDetails] trendData:", trendData);

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



  const handleDeleteCampaignFromDetails = async () => {
    if (!selectedCampaign) return;
    const id = selectedCampaign.campaignId;
    const tableId = selectedCampaign.tableId ?? selectedCampaign.TableID ?? selectedCampaign._id ?? selectedCampaign.id;
    if (window.confirm("Are you sure you want to delete this campaign?")) {
      setActionLoadingId(id);
      const params = { campaignId: id, sellerId, tableId };
      try {
        if (advertisementService.deleteSellerCampaign) {
          await advertisementService.deleteSellerCampaign(params);
        } else {
          await advertisementService.deleteCampaign(id, sellerId);
        }
        showToast("Campaign deleted successfully");
        setCampaigns(prev => prev.filter(c => (c.campaignId ?? c.CampaignID ?? c.campaignID ?? c.id) !== id));
        setSelectedCampaign(null);
      } catch (err) {
        console.error("[AdvertisementPage] Delete campaign failed:", err);
        showToast("Failed to delete campaign", "error");
      } finally {
        setActionLoadingId(null);
      }
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
                setShowEditConfirmModal(true);
              }}>
                <span className="toggle-switch-label">
                  {(() => {
                    const isCampaignActive = (() => {
                      if (campaignDetailInfo && campaignDetailInfo.active !== undefined) {
                        return campaignDetailInfo.active === true || String(campaignDetailInfo.active).toLowerCase() === "active" || campaignDetailInfo.active === "true";
                      }
                      const activeVal = selectedCampaign?.active ?? selectedCampaign?.adStatus ?? selectedCampaign?.Adstatus ?? selectedCampaign?.status;
                      if (activeVal === undefined || activeVal === null) return false;
                      return activeVal === true || String(activeVal).toLowerCase() === "active" || activeVal === "true";
                    })();
                    return isCampaignActive ? "Running" : "Paused";
                  })()}
                </span>
                <div className={`toggle-switch ${(() => {
                  const isCampaignActive = (() => {
                    if (campaignDetailInfo && campaignDetailInfo.active !== undefined) {
                      return campaignDetailInfo.active === true || String(campaignDetailInfo.active).toLowerCase() === "active" || campaignDetailInfo.active === "true";
                    }
                    const activeVal = selectedCampaign?.active ?? selectedCampaign?.adStatus ?? selectedCampaign?.Adstatus ?? selectedCampaign?.status;
                    if (activeVal === undefined || activeVal === null) return false;
                    return activeVal === true || String(activeVal).toLowerCase() === "active" || activeVal === "true";
                  })();
                  return isCampaignActive;
                })() ? "active" : ""}`}>
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
                      {campaignDetailsData?.metrics?.totalSpend !== null && campaignDetailsData?.metrics?.totalSpend !== undefined
                        ? `₹${campaignDetailsData.metrics.totalSpend}`
                        : "--"}
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
                </div>
                
                <div className="see-more-toggle-row">
                  <button className="btn-see-more-toggle" onClick={() => setMetricsExpanded(!metricsExpanded)}>
                    <span>{metricsExpanded ? "See Less" : "See More"}</span>
                    <ChevronDown size={14} style={{ transform: metricsExpanded ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }} />
                  </button>
                </div>
                
                {metricsExpanded && (
                  <div className="results-metrics-grid" style={{ marginTop: "16px", borderTop: "1px solid #f1f5f9", paddingTop: "16px" }}>
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
                  </div>
                )}
              </>
            )}
          </div>

          <div className="details-section-grid">
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              <div className="details-card-box">
                <h3>Campaign Settings</h3>
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

          <div className="details-delete-row">
            <button
              className="btn-delete-campaign-details"
              onClick={handleDeleteCampaignFromDetails}
              disabled={actionLoadingId !== null}
            >
              <Trash2 size={16} />
              <span>{actionLoadingId === selectedCampaign.campaignId ? "Deleting..." : "Delete Campaign"}</span>
            </button>
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
            <div className="product-search-wrapper" style={{ maxWidth: "400px", marginBottom: "20px" }}>
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
          <div className="date-filter-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Select Date Range</h3>
              <button className="close-btn" onClick={() => setShowDateFilterModal(false)}>&times;</button>
            </div>
            
            <div className="date-options-radio-list" style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
              {["yesterday", "today", "lastWeek", "lastMonth", "thisWeek", "thisMonth", "custom"].map((key) => {
                const isSelected = tempSelectedFilter === key;
                const preview = getFilterPreview(key);
                return (
                  <div
                    key={key}
                    className={`date-radio-option-item ${isSelected ? "selected" : ""}`}
                    onClick={() => setTempSelectedFilter(key)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      border: isSelected ? "1.5px solid var(--primary-color)" : "1.5px solid var(--border-color)",
                      backgroundColor: isSelected ? "#f0f4ff" : "#f8fafc",
                      cursor: "pointer",
                      transition: "all 0.2s ease"
                    }}
                  >
                    <input
                      type="radio"
                      name="tempDateFilter"
                      checked={isSelected}
                      onChange={() => setTempSelectedFilter(key)}
                      style={{
                        margin: 0,
                        width: "18px",
                        height: "18px",
                        accentColor: "var(--primary-color)",
                        cursor: "pointer"
                      }}
                    />
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px", flex: 1 }}>
                      <span style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-main)" }}>
                        {filterLabels[key]}
                      </span>
                      {preview && (
                        <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "500" }}>
                          {preview}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {tempSelectedFilter === "custom" && (
              <div className="custom-date-inputs" style={{ marginTop: "16px", borderTop: "1px solid var(--border-color)", paddingTop: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ display: "flex", gap: "12px" }}>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", textTransform: "uppercase" }}>From Date</label>
                    <input
                      type="date"
                      value={tempCustomFromDate}
                      onChange={(e) => setTempCustomFromDate(e.target.value)}
                      style={{
                        padding: "10px",
                        border: "1px solid var(--border-color)",
                        borderRadius: "8px",
                        fontSize: "14px",
                        width: "100%",
                        boxSizing: "border-box"
                      }}
                    />
                  </div>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", textTransform: "uppercase" }}>To Date</label>
                    <input
                      type="date"
                      value={tempCustomToDate}
                      onChange={(e) => setTempCustomToDate(e.target.value)}
                      style={{
                        padding: "10px",
                        border: "1px solid var(--border-color)",
                        borderRadius: "8px",
                        fontSize: "14px",
                        width: "100%",
                        boxSizing: "border-box"
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            <button
              className="btn-apply-custom-date"
              disabled={tempSelectedFilter === "custom" && (!tempCustomFromDate || !tempCustomToDate)}
              onClick={() => {
                setSelectedFilter(tempSelectedFilter);
                if (tempSelectedFilter === "custom") {
                  setCustomFromDate(tempCustomFromDate);
                  setCustomToDate(tempCustomToDate);
                }
                setShowDateFilterModal(false);
              }}
              style={{
                backgroundColor: (tempSelectedFilter === "custom" && (!tempCustomFromDate || !tempCustomToDate)) ? "#cbd5e1" : "var(--primary-color)",
                color: "#fff",
                border: "none",
                padding: "12px",
                borderRadius: "10px",
                fontWeight: "600",
                fontSize: "14px",
                cursor: (tempSelectedFilter === "custom" && (!tempCustomFromDate || !tempCustomToDate)) ? "not-allowed" : "pointer",
                transition: "background-color 0.2s",
                marginTop: "20px",
                width: "100%"
              }}
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Campaign Edit/Start Confirmation Modal */}
      {showEditConfirmModal && (
        <div className="date-filter-modal-overlay" onClick={() => setShowEditConfirmModal(false)}>
          <div className="date-filter-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "420px", borderRadius: "16px", padding: "24px" }}>
            <div style={{ textAlign: "center" }}>
              <h3 style={{ fontSize: "18px", fontWeight: "700", color: "#0f172a", marginBottom: "12px", border: "none", padding: 0 }}>
                Are you sure you want to start campaign?
              </h3>
              <p style={{ fontSize: "14px", color: "#64748b", marginBottom: "24px" }}>
                This will take you to the campaign setup page where you can edit its details.
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
                    // Extract active value for the payload
                    const isCampaignActive = (() => {
                      if (campaignDetailInfo && campaignDetailInfo.active !== undefined) {
                        return campaignDetailInfo.active === true || String(campaignDetailInfo.active).toLowerCase() === "active" || campaignDetailInfo.active === "true";
                      }
                      const activeVal = selectedCampaign?.active ?? selectedCampaign?.adStatus ?? selectedCampaign?.Adstatus ?? selectedCampaign?.status;
                      if (activeVal === undefined || activeVal === null) return false;
                      return activeVal === true || String(activeVal).toLowerCase() === "active" || activeVal === "true";
                    })();

                    // Navigate with location state
                    navigate("/advertisement/create-campaign", {
                      state: {
                        editCampaign: {
                          tableId: selectedCampaign.tableId ?? selectedCampaign.TableID ?? selectedCampaign._id ?? selectedCampaign.id,
                          campaignId: selectedCampaign.campaignId ?? selectedCampaign.CampaignID ?? selectedCampaign.campaignID ?? selectedCampaign.id,
                          title: campaignDetailInfo?.campaignName || selectedCampaign.campaignName || selectedCampaign.title,
                          campaignType: campaignDetailInfo?.campaignType || selectedCampaign.campaignType || "Smart",
                          startDateTime: campaignDetailInfo?.schedule || selectedCampaign.startDateTime || selectedCampaign.startDate,
                          endDateTime: campaignDetailInfo?.endDateTime || selectedCampaign.endDateTime || selectedCampaign.endDate,
                          dailyBudget: campaignDetailInfo?.budget ?? selectedCampaign.dailyBudget ?? 0,
                          productIds: selectedCampaign.productIds || [],
                          status: campaignDetailInfo?.status || selectedCampaign.status || "Pending",
                          active: isCampaignActive
                        }
                      }
                    });
                  }}
                  style={{
                    flex: 1,
                    background: "var(--primary-color)",
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
