import axios from "axios";
import { resolveSellerId as sessionResolveSellerId, getSellerId as sessionGetSellerId, resolveSellerEmail, resolveSellerPhone, resolveSellerName } from "../utils/sellerSession";

export const resolveSellerId = sessionResolveSellerId;
const getSellerId = sessionGetSellerId;
export const resolveSellerEmailForApi = resolveSellerEmail;
export const resolveSellerPhoneForApi = resolveSellerPhone;
export const resolveSellerNameForApi = resolveSellerName;
// Safely check environment for both Vite and Webpack/CRA compatibility
const checkDev = () => {
  try {
    // eslint-disable-next-line no-new-func
    const meta = new Function("return import.meta")();
    if (meta && meta.env && meta.env.DEV !== undefined) {
      return meta.env.DEV;
    }
  } catch { }
  try {
    if (process.env && process.env.NODE_ENV === "development") {
      return true;
    }
  } catch { }
  return typeof window !== "undefined" && window.location.hostname === "localhost";
};

const _svcLog = (...a) => { try { if (checkDev()) console.log(...a); } catch { } };
const _svcErr = (...a) => { try { if (checkDev()) console.error(...a); } catch { } };

const HAATZA_BASE = "https://haatza.com/_functions";
const HAATZA_SELLER_BASE = "https://haatzaseller.com/_functions";

const proxyExists = false;
const HAATZA_FUNCTIONS_BASE = checkDev() && proxyExists ? "/api/_functions" : "https://haatza.com/_functions";
const API_BASE_URL = HAATZA_FUNCTIONS_BASE;

const BASE_URL = HAATZA_BASE;
const BASE_URL_WWW = HAATZA_BASE;
const PROFILE_BASE_URL = HAATZA_SELLER_BASE;
const ONBOARD_STATUS_API_URL = `${HAATZA_SELLER_BASE}/onboardStatus`;
const GST_API_URL = `${HAATZA_SELLER_BASE}/checksellergst`;
const CATEGORY_API = `${HAATZA_BASE}/category`;
const SELLER_BASE_URL = HAATZA_SELLER_BASE;

// ─── SELLER SERVICE API ENDPOINTS ────────────────────────────────────────────
const SELLER_PRODUCT_INVENTORY_API = `${API_BASE_URL}/sellerproductInventory`;
const INCREMENT_INVENTORY_API = `${API_BASE_URL}/incrementInventory`;
const DECREMENT_INVENTORY_API = `${API_BASE_URL}/decrementInventory`;
const CHECK_WALLET_BALANCE_API = `${API_BASE_URL}/checkWalletBalance`;
const TRANSACTION_HISTORY_API = `${API_BASE_URL}/transactionHistory`;
const ADD_FUNDS_API = `${API_BASE_URL}/addFunds`;
const NOTIFICATIONS_API = `${API_BASE_URL}/notifications`;
const UPDATE_NOTIFICATION_API = `${API_BASE_URL}/updateNotification`;



const SELLER_CAMPAIGNS_API = `${API_BASE_URL}/sellerCampaigns`;
const NEW_SELLER_CAMPAIGN_API = `${API_BASE_URL}/newSellerCampaign`;
const OFF_SELLER_CAMPAIGN_API = `${API_BASE_URL}/offSellerCampaign`;
const UPDATE_SELLER_CAMPAIGN_API = `${API_BASE_URL}/updateSellerCampaign`;
const DELETE_SELLER_CAMPAIGN_API = `${API_BASE_URL}/deleteSellerCampaign`;
const CAMPAIGN_SUMMARY_API = `${API_BASE_URL}/Campaignsummery`;
const CAMPAIGN_DETAILS_API = `${API_BASE_URL}/campaignDetails`;

// ─── Status constants — must match exactly what is saved in DB ────────────────
export const IN_PROGRESS_STATUSES = ["Draft", "Under Review", "Pending", "Rejected", "Approved", "Update Requested"];

/* =============================================================================
   INTERNAL HELPER FUNCTIONS
   ============================================================================= */

// Centralized resolveSellerId is imported from sellerSession

const getOrResolveSellerId = (sellerId) => {
  const resolved = (sellerId || resolveSellerId() || "").trim();
  if (!resolved || resolved === "null" || resolved === "undefined") {
    throw new Error("Seller session not found. Please login again.");
  }
  return resolved;
};

// categoryApi extraction helper
const extractArray = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];

  const KEYS = [
    "items", "data", "results", "message",
    "subCategories", "subcategories", "categories",
  ];

  for (const k of KEYS) {
    const val = payload[k];
    if (Array.isArray(val)) return val;
    if (val && typeof val === "object" && !Array.isArray(val)) {
      const inner = extractArray(val);
      if (inner.length > 0) return inner;
    }
  }

  const firstArr = Object.values(payload).find(Array.isArray);
  return firstArr || [];
};

// categoryApi image resolution helper
const resolveImageUrl = (rawImg) => {
  if (!rawImg) return null;

  if (typeof rawImg === "object" && !Array.isArray(rawImg)) {
    const src =
      rawImg.url || rawImg.src || rawImg.imageUrl ||
      rawImg.uri || rawImg.value || rawImg.mediaUrl ||
      rawImg.filePath || null;
    return resolveImageUrl(src);
  }

  if (typeof rawImg !== "string") return null;

  const trimmed = rawImg.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("wix:image://")) {
    const noScheme = trimmed.replace(/^wix:image:\/\/(?:v1\/)?/, "");
    const [fileIdRaw, ...rest] = noScheme.split("/");
    const fileId = fileIdRaw.split("#")[0].split("?")[0];
    if (!fileId) return null;

    const displayName = rest.length
      ? rest.join("/").split("#")[0].split("?")[0]
      : "image.jpg";

    return `https://static.wixstatic.com/media/${fileId}/v1/fill/w_300,h_300,al_c,q_85,usm_0.66_1.00_0.01/${displayName}`;
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  if (trimmed.length > 4 && !trimmed.includes(" ")) {
    return `https://static.wixstatic.com/media/${trimmed}`;
  }

  return null;
};

// categoryApi scan keys helper
const findImageInItem = (item) => {
  const KNOWN = [
    "subCategoryImage", "subCategoryImg",
    "SubCategoryImage", "SubCategoryImg",
    "categoryImage", "categoryImg",
    "CategoryImage", "CategoryImg",
    "image", "imageUrl",
    "ImageUrl", "img",
    "thumbnail", "photo",
    "icon", "coverImage",
    "bannerImage", "mediaUrl",
    "pictureUrl", "picture",
    "logo", "logoUrl",
  ];

  for (const key of KNOWN) {
    if (item[key]) {
      const resolved = resolveImageUrl(item[key]);
      if (resolved) return resolved;
    }
  }

  for (const [key, val] of Object.entries(item)) {
    if (!val) continue;
    const isImageKey = /image|img|photo|thumb|icon|logo|media|picture|banner|cover/i.test(key);
    if (!isImageKey) continue;
    const resolved = resolveImageUrl(val);
    if (resolved) return resolved;
  }

  return null;
};

// categoryApi normalise category
const normaliseCategory = (item, index) => {
  const name =
    item.categoryName || item.CategoryName ||
    item.name || item.title || "Unnamed";

  const id =
    item.categoryId || item.CategoryID ||
    item.CategoryId || item._id ||
    item.id || `cat-${index}`;

  const imageUrl = findImageInItem(item);

  return {
    uniqueKey: `${id}-${index}`,
    ...item,
    name,
    CategoryID: String(id),
    imageUrl,
  };
};

// categoryApi normalise subcategory
const normaliseSubcategory = (item, index) => {
  const name =
    item.subCategoryName || item.SubCategoryName ||
    item.subCategory || item.SubCategory ||
    item.name || item.title || "Unnamed";

  const id =
    item.subCategoryId || item.SubCategoryID ||
    item.subCategoryID || item._id ||
    item.id || `sub-${index}`;

  const imageUrl = findImageInItem(item);

  const resolvedCategoryName =
    item.categoryName ||
    item.CategoryName ||
    item.category_name ||
    item.parentCategory ||
    item.parentCategoryName ||
    item.parent ||
    "";

  const resolvedCategoryId =
    item.categoryId ||
    item.CategoryID ||
    item.CategoryId ||
    item.category_id ||
    item.parentId ||
    item.parentCategoryId ||
    "";

  return {
    name,
    SubCategoryID: String(id),
    uniqueKey: `${id}-${index}`,
    categoryId: String(resolvedCategoryId),
    categoryName: resolvedCategoryName,
    imageUrl,
  };
};

// categoryApi relevance ranker
const rankByRelevance = (items, query) => {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return items;

  const queryWords = normalizedQuery.split(" ");

  const scored = items
    .map((item) => {
      const normalizedName = normalizeSearchText(item.name || "");
      const nameWords = normalizedName.split(" ");

      const allWordsMatch = queryWords.every((queryWord) => {
        return nameWords.some((nameWord) => {
          if ((queryWord === "men" || queryWord === "mens") && (nameWord.includes("women") || nameWord.includes("womens"))) {
            return false;
          }
          return nameWord.startsWith(queryWord) || nameWord.includes(queryWord);
        });
      });

      if (!allWordsMatch) {
        return null;
      }

      let score = 0;
      if (normalizedName === normalizedQuery) {
        score = 100;
      } else {
        const startsCorrectly = queryWords.every(
          (word, index) => {
            return nameWords[index]?.startsWith(word) || nameWords[index]?.includes(word);
          }
        );
        if (startsCorrectly) {
          score = 80;
        } else {
          score = 60;
        }
      }

      return { item, score };
    })
    .filter(Boolean);

  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.item);
};

// listingApi pincode helper
const getSellerPinCode = () => {
  const CACHE_KEY = "__haatza_sellerPinCode";
  const cached =
    sessionStorage.getItem(CACHE_KEY) ||
    localStorage.getItem(CACHE_KEY);
  if (cached && /^\d{6}$/.test(cached.trim())) {
    return cached.trim();
  }

  const plainKeys = ["sellerPinCode", "pinCode", "pincode", "seller_pincode"];
  for (const key of plainKeys) {
    const val = sessionStorage.getItem(key);
    if (val && /^\d{6}$/.test(val.trim())) return val.trim();
  }
  for (const key of plainKeys) {
    const val = localStorage.getItem(key);
    if (val && /^\d{6}$/.test(val.trim())) return val.trim();
  }

  const jsonKeys = ["user", "authUser", "currentUser", "userData", "sellerData"];
  const pinFields = ["pinCode", "pincode", "sellerPinCode", "seller_pincode"];
  for (const store of [sessionStorage, localStorage]) {
    for (const key of jsonKeys) {
      const raw = store.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        for (const field of pinFields) {
          const val = parsed?.[field] || parsed?.user?.[field] || parsed?.data?.[field];
          if (val && /^\d{6}$/.test(String(val).trim())) return String(val).trim();
        }
      } catch { }
    }
  }

  console.error("[listingApi:getSellerPinCode] pinCode not found — using fallback 000000");
  return "000000";
};

// Centralized getSellerId is imported from sellerSession

// listingApi wix image helper helper
const toWixSrc = (url) => {
  if (!url) return null;
  if (url.startsWith("wix:image://")) return url;
  if (!url.startsWith("http")) return null;
  const wixMatch = url.match(/\/media\/([a-zA-Z0-9_~.-]+)/);
  if (!wixMatch) return null;
  const fileId = wixMatch[1];
  const parts = url.split("/");
  const fileName = parts[parts.length - 1].split("?")[0] || "image.jpg";
  return `wix:image://v1/${fileId}/${fileName}#originWidth=800&originHeight=800`;
};

// listingApi size chart url resolver
const resolveSizeChartUrl = (value) => {
  if (!value) return "";

  if (typeof value === "string") {
    if (value.trim() === "__PENDING_FILE__" || value.trim() === "") return "";
    return value.trim();
  }

  if (value instanceof File) {
    console.warn("[resolveSizeChartUrl] Raw File object reached payload builder — skipping gracefully");
    return "";
  }

  if (typeof value === "object") {
    const candidateUrl =
      value.url ||
      value.mediaUrl ||
      value.src ||
      value.imageUrl ||
      value.fileUrl ||
      (value.preview && !value.preview.startsWith("blob:") ? value.preview : "");

    if (typeof candidateUrl === "string" && candidateUrl.trim() !== "__PENDING_FILE__") {
      return candidateUrl.trim();
    }
  }

  return "";
};

// MyListings envelope unwrapper helper
const unwrapMyListingsEnvelope = (data, fallbackLimit = 10) => {
  console.log("[unwrapMyListingsEnvelope] Raw data:", JSON.stringify(data, null, 2));

  if (data?.status && data.status !== "success") {
    const body = data?.message?.body ?? data?.message ?? {};
    const msg =
      (typeof body?.message === "string" && body.message) ||
      (typeof body?.error === "string" && body.error) ||
      (typeof data?.message === "string" && data.message) ||
      body?.errorMessage ||
      body?.reason ||
      body?.details ||
      (typeof body === "object" ? JSON.stringify(body) : String(body)) ||
      "The server returned an error.";
    console.error("[unwrapMyListingsEnvelope] Backend error:", msg, "| Full body:", body);
    throw new Error(msg);
  }

  const body = data?.message?.body ?? data?.body ?? data ?? {};
  const rawProducts = body.sellerProducts ?? body.products ?? body.items ?? [];
  const products = rawProducts.map((p) => {
    if (!p) return p;
    const Table_ID = p.Table_ID || p.tableId || p.table_id || p._id || p.id || p.productId || "";
    return {
      ...p,
      Table_ID,
      mainmedia: resolveWixImage(p.mainmedia || p.main_media || p.mainMedia || p.mainImage || "") || "",
    };
  });
  const pagination = body.pagination ?? {};

  const total = pagination.total ?? body.total ?? products.length;
  const page = pagination.page ?? body.page ?? 1;
  const limit = pagination.limit ?? body.limit ?? fallbackLimit;
  const totalPages = pagination.totalPages ?? body.totalPages ??
    (total > 0 ? Math.ceil(total / limit) : 1);

  console.log("[unwrapMyListingsEnvelope] Success:", { products: products.length, total, page, totalPages });
  return { products, total, page, totalPages };
};

// InProgressListings envelope unwrapper helper
const unwrapInProgressListingsEnvelope = (data, fallbackLimit = 10) => {
  console.group("[unwrapInProgressListingsEnvelope] Raw data");
  console.log(JSON.stringify(data, null, 2));
  console.groupEnd();

  if (data?.status && data.status !== "success") {
    const body = data?.message?.body ?? data?.message ?? {};

    const msg =
      (typeof body?.message === "string" && body.message) ||
      (typeof body?.error === "string" && body.error) ||
      (typeof data?.message === "string" && data.message) ||
      body?.errorMessage ||
      body?.reason ||
      body?.details ||
      (typeof body === "object" ? JSON.stringify(body) : String(body)) ||
      "The server returned an error.";

    console.error("[unwrapInProgressListingsEnvelope] Backend error:", msg);
    throw new Error(msg);
  }

  const body = data?.message?.body ?? data?.body ?? data ?? {};
  const rawProducts = body.sellerProducts ?? body.products ?? body.items ?? body.data ?? (Array.isArray(body) ? body : []);
  const products = rawProducts.map((p) => {
    if (!p) return p;
    const Table_ID = p.Table_ID || p.tableId || p.table_id || p._id || p.id || p.productId || "";
    const productId = p.productId || p.product_id || p.wixProductId || "";
    return { ...p, Table_ID, productId };
  });
  const pagination = body.pagination ?? {};

  const total = pagination.total ?? body.total ?? products.length;
  const page = pagination.page ?? body.page ?? 1;
  const limit = pagination.limit ?? body.limit ?? fallbackLimit;
  const totalPages = pagination.totalPages ?? body.totalPages ??
    (total > 0 ? Math.ceil(total / limit) : 1);

  console.group("[unwrapInProgressListingsEnvelope] Products received");
  console.log(`Count: ${products.length}, Total: ${total}, Page: ${page}/${totalPages}`);
  products.forEach((p, i) => {
    console.log(`  [${i}] id=${p.Table_ID || p._id || "?"} name="${p.name || "?"}" status="${p.status || "?"}" price=${p.price ?? "?"}`);
  });
  console.groupEnd();

  return { products, total, page, totalPages };
};


/* =============================================================================
   // AUTH APIs
   ============================================================================= */

export const checkSeller = async (contact) => {
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact);
  const isPhone = /^[6-9]\d{9}$/.test(contact);

  if (!isEmail && !isPhone) {
    throw new Error("Enter a valid email address or 10-digit mobile number.");
  }

  const contactType = isEmail ? "email" : "phone";
  const param = `${contactType}=${encodeURIComponent(contact)}`;

  try {
    const response = await axios.get(`${PROFILE_BASE_URL}/checkseller?${param}`, {
      timeout: 10000,
    });
    const data = response.data;

    if (data?.status !== "success") {
      throw new Error(data?.message || "Unexpected response from server.");
    }

    let p = data.message || data.data || data || {};
    if (Array.isArray(p)) {
      p = p[0] || {};
    }
    const actualData = (typeof p === "string") ? (data.data || data || {}) : p;
    let sellerObj = actualData.seller || actualData.data || actualData;
    if (Array.isArray(sellerObj)) {
      sellerObj = sellerObj[0] || {};
    }

    const fullName =
      sellerObj.fullName ||
      (sellerObj.firstName ? (sellerObj.firstName + (sellerObj.lastName ? " " + sellerObj.lastName : "")).trim() : "") ||
      sellerObj.name ||
      sellerObj.nickname ||
      sellerObj.sellerName ||
      actualData.fullName ||
      (actualData.firstName ? (actualData.firstName + (actualData.lastName ? " " + actualData.lastName : "")).trim() : "") ||
      actualData.name ||
      actualData.nickname ||
      actualData.sellerName ||
      "";

    const companyName =
      sellerObj.companyName ||
      sellerObj.company_name ||
      sellerObj.storeName ||
      sellerObj.store_name ||
      sellerObj.tradeName ||
      sellerObj.trade_name ||
      sellerObj.businessName ||
      sellerObj.business_name ||
      actualData.companyName ||
      actualData.company_name ||
      actualData.storeName ||
      actualData.store_name ||
      actualData.tradeName ||
      actualData.trade_name ||
      actualData.businessName ||
      actualData.business_name ||
      "";

    const sellerId =
      sellerObj.sellerId ||
      sellerObj.seller_id ||
      sellerObj._id ||
      sellerObj.id ||
      sellerObj.uid ||
      sellerObj.SellerID ||
      sellerObj.Seller_ID ||
      actualData.sellerId ||
      actualData.seller_id ||
      actualData.uid ||
      actualData.id ||
      data?.sellerId ||
      data?.seller_id ||
      data?.SellerID ||
      "";

    if (sellerId && String(sellerId).trim().length > 2) {
      const sid = String(sellerId).trim();
      localStorage.setItem("sellerId", sid);
      sessionStorage.setItem("sellerId", sid);
      localStorage.setItem("__haatza_sellerId", sid);
      sessionStorage.setItem("__haatza_sellerId", sid);
      console.log("[sellerService] ✅ checkSeller cached sellerId:", sid);
    }

    const resolvedEmail =
      sellerObj.email ||
      actualData.email ||
      data.email ||
      (contactType === "email" ? contact : "");

    const resolvedPhone =
      sellerObj.phone ||
      sellerObj.phonenumber ||
      sellerObj.phone_number ||
      sellerObj.mobile_number ||
      sellerObj.contact ||
      sellerObj.mobile ||
      actualData.phone ||
      actualData.phonenumber ||
      actualData.phone_number ||
      actualData.mobile_number ||
      actualData.contact ||
      actualData.mobile ||
      data.phone ||
      data.contact ||
      (contactType === "phone" ? contact : "");

    if (resolvedEmail) {
      localStorage.setItem("sellerEmail", resolvedEmail);
      sessionStorage.setItem("sellerEmail", resolvedEmail);
      localStorage.setItem("__haatza_sellerEmail", resolvedEmail);
      sessionStorage.setItem("__haatza_sellerEmail", resolvedEmail);
    }
    if (resolvedPhone) {
      localStorage.setItem("sellerPhone", resolvedPhone);
      sessionStorage.setItem("sellerPhone", resolvedPhone);
      localStorage.setItem("__haatza_sellerPhone", resolvedPhone);
      sessionStorage.setItem("__haatza_sellerPhone", resolvedPhone);
    }
    if (fullName) {
      localStorage.setItem("sellerFullName", fullName);
      sessionStorage.setItem("sellerFullName", fullName);
      localStorage.setItem("__haatza_sellerName", fullName);
      sessionStorage.setItem("__haatza_sellerName", fullName);
      localStorage.setItem("sellerName", fullName);
      sessionStorage.setItem("sellerName", fullName);
    }
    if (companyName) {
      localStorage.setItem("companyName", companyName);
      sessionStorage.setItem("companyName", companyName);
    }

    return {
      userExists: data.message.userExists,
      contactType,
      email: resolvedEmail,
      phone: resolvedPhone,
      fullName: fullName || "",
      companyName: companyName || fullName || "",
      sellerId: sellerId || "",
    };
  } catch (err) {
    console.error("[checkSeller] Error checking contact existence:", err);
    throw new Error(
      err.response?.data?.message || err.message || "Server connection issues. Please try again."
    );
  }
};


/* =============================================================================
   // SELLER PROFILE APIs
   ============================================================================= */

export const fetchSellerDetails = async (email, sellerId) => {
  if (!email && !sellerId) throw new Error("Email or sellerId is required.");
  try {
    const params = {};
    const activeSellerId = sellerId || resolveSellerId();
    if (activeSellerId) {
      params.sellerId = activeSellerId;
      params.seller_id = activeSellerId;
    }
    if (email) {
      params.email = email;
    }
    const response = await axios.get(`${PROFILE_BASE_URL}/sellerdata`, {
      params,
      timeout: 10000,
    });
    return response.data;
  } catch (err) {
    console.error("[fetchSellerDetails] Error:", err);
    throw new Error(err.response?.data?.message || "Failed to fetch seller details.");
  }
};

export const getUserProfile = async (email, sellerId) => {
  const params = {};
  const activeSellerId = sellerId || resolveSellerId();
  if (activeSellerId) {
    params.sellerId = activeSellerId;
    params.seller_id = activeSellerId;
  }
  if (email) {
    params.email = email;
  }
  const response = await axios.get(`${PROFILE_BASE_URL}/sellerdata`, {
    params,
    timeout: 10000,
  });
  return response.data;
};

export const getCachedSellerId = () => {
  const resolved = resolveSellerId();
  if (resolved) return resolved.trim();

  const CANONICAL_SELLER_KEY = "__haatza_sellerId";
  const val =
    sessionStorage.getItem(CANONICAL_SELLER_KEY) ||
    localStorage.getItem(CANONICAL_SELLER_KEY) ||
    sessionStorage.getItem("sellerId") ||
    localStorage.getItem("sellerId") ||
    "";
  if (!val || val.trim().length < 2) {
    console.warn("[sellerProfileApi] getCachedSellerId: no sellerId found");
  }
  return val.trim();
};

export const getCachedSellerEmail = () => {
  const resolved = resolveSellerEmailForApi();
  if (resolved) return resolved.trim();

  const CANONICAL_EMAIL_KEY = "__haatza_sellerEmail";
  const val =
    sessionStorage.getItem(CANONICAL_EMAIL_KEY) ||
    localStorage.getItem(CANONICAL_EMAIL_KEY) ||
    sessionStorage.getItem("sellerEmail") ||
    localStorage.getItem("sellerEmail") ||
    "";
  return val.trim();
};

export const getCachedSellerPhone = () => {
  const resolved = resolveSellerPhoneForApi();
  if (resolved) return resolved.trim();

  const CANONICAL_PHONE_KEY = "__haatza_sellerPhone";
  const val =
    sessionStorage.getItem(CANONICAL_PHONE_KEY) ||
    localStorage.getItem(CANONICAL_PHONE_KEY) ||
    sessionStorage.getItem("sellerPhone") ||
    localStorage.getItem("sellerPhone") ||
    "";
  return val.trim();
};

export const getCachedSellerName = () => {
  const resolved = resolveSellerNameForApi();
  if (resolved) return resolved.trim();

  const CANONICAL_NAME_KEY = "__haatza_sellerName";
  const val =
    sessionStorage.getItem(CANONICAL_NAME_KEY) ||
    localStorage.getItem(CANONICAL_NAME_KEY) ||
    sessionStorage.getItem("sellerFullName") ||
    localStorage.getItem("sellerFullName") ||
    "";
  return val.trim();
};

export const getCachedSellerPinCode = () => {
  try {
    const stored = JSON.parse(localStorage.getItem("haatzaSeller") || sessionStorage.getItem("haatzaSeller"));
    const pin = stored?.pincode || stored?.pinCode || stored?.sellerPinCode || stored?.data?.pincode || stored?.data?.pinCode || stored?.data?.sellerPinCode;
    if (pin && /^\d{6}$/.test(String(pin).trim())) {
      return String(pin).trim();
    }
  } catch { }

  const CANONICAL_PIN_KEY = "__haatza_sellerPinCode";
  const val =
    sessionStorage.getItem(CANONICAL_PIN_KEY) ||
    localStorage.getItem(CANONICAL_PIN_KEY) ||
    sessionStorage.getItem("sellerPinCode") ||
    localStorage.getItem("sellerPinCode") ||
    "";
  if (!val || !/^\d{6}$/.test(val.trim())) {
    console.warn("[sellerProfileApi] getCachedSellerPinCode: invalid or missing pinCode:", val);
  }
  return val.trim();
};

// Centralized resolveSellerEmailForApi is imported from sellerSession


/* =============================================================================
   // CATEGORY APIs
   ============================================================================= */

export const fetchCategories = async () => {
  try {
    const res = await fetch(CATEGORY_API);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    console.log("🗂️ [fetchCategories] top-level keys:", Object.keys(data));

    const raw = Array.isArray(data.message) ? data.message : extractArray(data);
    console.log(`🗂️ [fetchCategories] raw array length: ${raw.length}`);

    return raw.map(normaliseCategory);
  } catch (err) {
    console.error("[fetchCategories]", err);
    return [];
  }
};

export const fetchSubcategoriesFirstPage = async (categoryId) => {
  const cleanId = String(categoryId ?? "").trim();
  console.log(`[fetchSubcategoriesFirstPage] categoryId="${cleanId}"`);

  const subUrl = (catId, page = 1, limit = 50) =>
    `https://www.haatza.com/_functions/subCategories?categoryId=${catId}&page=${page}&limit=${limit}`;

  try {
    const res = await fetch(subUrl(cleanId, 1, 50));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    console.log(`📡 [fetchSubcategoriesFirstPage] top-level keys:`, Object.keys(data));

    const raw = extractArray(data);
    console.log(`📡 [fetchSubcategoriesFirstPage] raw array length: ${raw.length}`);

    const normalised = raw.map(normaliseSubcategory);
    console.log(`[fetchSubcategoriesFirstPage] → ${normalised.length} subcategories`);

    return {
      items: normalised,
      hasMore: normalised.length === 50,
    };
  } catch (err) {
    console.error("[fetchSubcategoriesFirstPage]", err);
    return { items: [], hasMore: false };
  }
};

export const fetchSubcategoriesPaged = async (categoryId, page = 1, limit = 50) => {
  const cleanId = String(categoryId ?? "").trim();
  console.log(`[fetchSubcategoriesPaged] categoryId="${cleanId}" page=${page}`);

  const subUrl = (catId, p, l) =>
    `https://www.haatza.com/_functions/subCategories?categoryId=${catId}&page=${p}&limit=${l}`;

  try {
    const res = await fetch(subUrl(cleanId, page, limit));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const raw = extractArray(data);
    const normalised = raw.map(normaliseSubcategory);
    console.log(`[fetchSubcategoriesPaged] page=${page} → ${normalised.length} items`);

    return {
      items: normalised,
      hasMore: normalised.length === limit,
    };
  } catch (err) {
    console.error("[fetchSubcategoriesPaged]", err);
    return { items: [], hasMore: false };
  }
};

export const fetchSubcategories = fetchSubcategoriesFirstPage;

export const searchCategories = async (query = "") => {
  try {
    const url =
      `https://haatza.com/_functions/subcategorylist` +
      `?page=1&count=10&search=${encodeURIComponent(query.trim())}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const items = extractArray(data);
    const seen = new Set();

    return items
      .filter((item) => {
        const cid = item.categoryId || item.CategoryID;
        if (!cid || seen.has(cid)) return false;
        seen.add(cid);
        return true;
      })
      .map((item, i) => ({
        CategoryID: item.categoryId || item.CategoryID,
        name: item.categoryName || item.CategoryName || "Unnamed",
        uniqueKey: `cat-s-${i}`,
      }));
  } catch (err) {
    console.error("[searchCategories]", err);
    return [];
  }
};

export const searchSubcategories = async (query = "", _categoryId = null) => {
  try {
    const normalizedQuery = normalizeSearchText(query);

    const url =
      `https://haatza.com/_functions/subcategorylist` +
      `?page=1&count=100&search=${encodeURIComponent(query.trim())}`;

    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    const raw = extractArray(data).map(normaliseSubcategory);
    const filtered = rankByRelevance(raw, normalizedQuery);

    return filtered;
  } catch (err) {
    console.error("[searchSubcategories]", err);
    return [];
  }
};

export const normalizeSearchText = (text = "") => {
  return text
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/-/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};


/* =============================================================================
   // GST APIs
   ============================================================================= */

export const checkGSTINExists = async (gstin) => {
  const url = `${GST_API_URL}?gstin=${encodeURIComponent(gstin)}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  let data;
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    data = await res.json();
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }

  _svcLog("[checkGSTINExists] Raw API response:", JSON.stringify(data));

  const candidates = [
    data,
    data?.message,
    data?.data,
    data?.message?.body,
    data?.message?.data,
    data?.result,
    data?.body,
  ];

  for (const c of candidates) {
    if (!c || typeof c !== "object") continue;
    if (typeof c.exists === "boolean") return c.exists;
    if (typeof c.registered === "boolean") return c.registered;
    if (typeof c.found === "boolean") return c.found;
    if (typeof c.isRegistered === "boolean") return c.isRegistered;
    if (typeof c.alreadyExists === "boolean") return c.alreadyExists;
    if (typeof c.duplicate === "boolean") return c.duplicate;
    if (typeof c.isDuplicate === "boolean") return c.isDuplicate;
    if (typeof c.gstExists === "boolean") return c.gstExists;
    if (typeof c.userExists === "boolean") return c.userExists;
    if (typeof c.sellerExists === "boolean") return c.sellerExists;
    if (typeof c.gstinExists === "boolean") return c.gstinExists;
    if (typeof c.status === "string") {
      const s = c.status.toLowerCase();
      if (s === "exists" || s === "registered" || s === "duplicate" || s === "found") return true;
      if (s === "not_found" || s === "not_registered" || s === "available") return false;
    }
  }

  const sellerRecord =
    data?.message?.seller ||
    data?.seller ||
    (Array.isArray(data?.message) ? data.message[0] : null) ||
    (Array.isArray(data?.message?.data) ? data.message.data[0] : null) ||
    (Array.isArray(data?.data) ? data.data[0] : null) ||
    (Array.isArray(data) ? data[0] : null);
  if (sellerRecord && typeof sellerRecord === "object" && Object.keys(sellerRecord).length > 0) {
    return true;
  }

  _svcErr("[checkGSTINExists] Could not determine exists/not-exists from response shape. Raw response logged above.");
  throw new Error("UNKNOWN_GSTIN_RESPONSE_SHAPE");
};
/* =============================================================================
   // INVENTORY APIs
   ============================================================================= */

export const fetchInventoryData = async (sellerId, page = 1, searchText = "") => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  const response = await axios.get(SELLER_PRODUCT_INVENTORY_API, {
    params: { sellerId: resolvedSellerId, page, searchText },
    timeout: 15000,
  });
  return response.data;
};

export const getSellerProductInventory = async ({ sellerId, page = 1, searchText = "", signal = null }) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  const response = await axios.get(SELLER_PRODUCT_INVENTORY_API, {
    params: { sellerId: resolvedSellerId, page, searchText },
    timeout: 15000,
    signal,
  });
  return response.data;
};

export const incrementInventory = async (sellerId, productId, variantId, quantity) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  const response = await axios.post(
    INCREMENT_INVENTORY_API,
    { sellerId: resolvedSellerId, productId, variantId, quantity },
    { headers: { "Content-Type": "application/json" }, timeout: 10000 }
  );
  return response.data;
};

export const decrementInventory = async (sellerId, productId, variantId, quantity) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  const response = await axios.post(
    DECREMENT_INVENTORY_API,
    { sellerId: resolvedSellerId, productId, variantId, quantity },
    { headers: { "Content-Type": "application/json" }, timeout: 10000 }
  );
  return response.data;
};

export const updateInventoryStock = async (sellerId, item, newQty) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  const delta = newQty - item.stock;
  if (delta === 0) return item;

  const endpoint = delta > 0 ? "incrementInventory" : "decrementInventory";
  const absQty = Math.abs(delta);

  try {
    const response = await axios.post(`${API_BASE_URL}/${endpoint}`, {
      sellerId: resolvedSellerId,
      productId: item.productId,
      variantId: item.id,
      quantity: absQty,
    }, {
      headers: { "Content-Type": "application/json" },
      timeout: 10_000,
    });

    if (response.data?.status === "error") {
      throw new Error(response.data?.message || "Action failed on server.");
    }

    return {
      ...item,
      stock: newQty,
    };
  } catch (err) {
    console.error(`[updateInventoryStock] Error on ${endpoint}:`, err);
    throw new Error(err.response?.data?.message || `Failed to update quantity on server.`);
  }
};


/* =============================================================================
   // LISTING APIs
   ============================================================================= */

export const resolveWixImage = (img) => {
  if (!img) return null;
  const raw =
    typeof img === "string"
      ? img
      : img.src || img.url || img.image || img.imageUrl || null;
  if (!raw) return null;
  if (raw.startsWith("data:")) return raw;
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    if (raw.includes("static.wixstatic.com/media/")) {
      const parts = raw.split("static.wixstatic.com/media/");
      if (parts.length > 1) {
        const pathPart = parts[1].split("?")[0].split("#")[0];
        const pathSegments = pathPart.split("/");
        let fileId = pathSegments[0];
        if (pathSegments.length > 1) {
          if (!fileId.includes(".") && pathSegments[1].includes(".")) {
            const ext = pathSegments[1].split(".").pop();
            fileId = `${fileId}.${ext}`;
          }
        }
        return `https://static.wixstatic.com/media/${fileId}`;
      }
    }
    return raw;
  }
  if (raw.startsWith("wix:image://")) {
    const withoutScheme = raw.replace(/^wix:image:\/\//, "");
    const withoutVersion = withoutScheme.replace(/^v1\//, "");
    const hashIdx = withoutVersion.indexOf("#");
    const pathPart = hashIdx !== -1 ? withoutVersion.substring(0, hashIdx) : withoutVersion;
    const pathSegments = pathPart.split("/");
    let fileId = pathSegments[0];
    let fileName = pathSegments[1] || "";
    if (!fileId || fileId.length > 200 || fileId.includes(" ")) return null;
    if (fileId.includes(".")) {
      return `https://static.wixstatic.com/media/${fileId}`;
    }
    if (fileName && fileName.includes(".")) {
      const ext = fileName.split(".").pop();
      return `https://static.wixstatic.com/media/${fileId}.${ext}`;
    }
    return `https://static.wixstatic.com/media/${fileId}~mv2.jpg`;
  }
  return null;
};

export const buildMediaItems = (images = []) => {
  return images
    .filter((img) => img.mediaUrl || img.url || img.src)
    .map((img) => {
      const url = img.mediaUrl || img.url || img.src || "";

      let parsedWixResponse = null;
      if (img.wixResponse) {
        if (typeof img.wixResponse === "object") {
          parsedWixResponse = img.wixResponse;
        } else if (typeof img.wixResponse === "string") {
          try {
            parsedWixResponse = JSON.parse(img.wixResponse);
          } catch { }
        }
      }

      const wixSrc =
        img.wixSrc ||
        parsedWixResponse?.src ||
        (url.startsWith("wix:image://") ? url : toWixSrc(url));

      let fileId = "";
      if (wixSrc && wixSrc.startsWith("wix:image://")) {
        const withoutScheme = wixSrc.replace(/^wix:image:\/\//, "");
        const withoutVersion = withoutScheme.replace(/^v1\//, "");
        fileId = withoutVersion.split("/")[0] || "";
      }

      if (!fileId) {
        const parts = url.split("/");
        fileId = parts[parts.length - 1].split("?")[0] || "image.jpg";
      }

      return {
        description: "",
        id: fileId,
        src: wixSrc || url,
        type: "image",
      };
    });
};

export const buildPromotionPhotos = (promotionImage) => {
  if (!promotionImage) return [];
  const images = Array.isArray(promotionImage) ? promotionImage : [promotionImage];

  const output = [];
  for (const img of images) {
    if (!img) continue;
    const url = img.url || img.mediaUrl || img.src || "";
    if (!url) continue;

    console.log("[buildPromotionPhotos] Input URL type:", url.startsWith("data:") ? "base64" : url.startsWith("wix:") ? "wix" : "https");

    if (url.startsWith("data:")) {
      const fileName = img.name || "promo.jpg";
      output.push({
        description: "",
        id: fileName,
        src: url,
        type: "image",
      });
      continue;
    }

    let parsedWixResponse = null;
    if (img.wixResponse) {
      if (typeof img.wixResponse === "object") {
        parsedWixResponse = img.wixResponse;
      } else if (typeof img.wixResponse === "string") {
        try {
          parsedWixResponse = JSON.parse(img.wixResponse);
        } catch { }
      }
    }

    const wixSrc =
      img.wixSrc ||
      parsedWixResponse?.src ||
      (url.startsWith("wix:image://") ? url : toWixSrc(url));

    let fileId = "";
    if (wixSrc && wixSrc.startsWith("wix:image://")) {
      const withoutScheme = wixSrc.replace(/^wix:image:\/\//, "");
      const withoutVersion = withoutScheme.replace(/^v1\//, "");
      fileId = withoutVersion.split("/")[0] || "";
    }

    if (!fileId) {
      const parts = url.split("/");
      fileId = parts[parts.length - 1].split("?")[0] || "promo.jpg";
    }

    output.push({
      description: "",
      id: fileId,
      src: wixSrc || url,
      type: "image",
    });
  }

  return output;
};

export const buildDiscount = (formData, discountType = "percent") => {
  if (!formData.onSale || !formData.discountPercent) return {};
  const val = parseFloat(formData.discountPercent);
  if (isNaN(val) || val <= 0) return {};
  if (discountType === "flat") {
    return {
      type: "AMOUNT",
      value: val,
    };
  } else {
    return {
      type: "PERCENTAGE",
      value: val,
    };
  }
};

export const resolveProductReturn = (val) => {
  if (!val) return "7 Days Easy Return";
  const mapped = {
    return: "7 Days Easy Return",
    no_return: "No Return",
    exchange: "7 Days Exchange",
    return_or_exchange: "7 Days Return or Exchange",
  }[val] || val;
  return mapped.replace(/\breturn\b/g, "Return");
};

export const buildAdditionalInfoSections = (specValues = {}, optionKeys = new Set(), specFieldsList = []) => {
  const sections = [];
  if (specFieldsList && specFieldsList.length > 0) {
    for (const field of specFieldsList) {
      const key = field.fieldId || field.title;
      const value = specValues[key];
      if (value === undefined || value === null || value === "") continue;
      if (value instanceof File) continue;
      if (typeof value === "object" && (value.isExisting || value.url || value.mediaUrl || value.src)) continue;
      const keyLower = key.toLowerCase();
      if (
        keyLower.includes("sizechart") || keyLower.includes("size_chart") ||
        keyLower.includes("size chart") || keyLower.includes("upload")
      ) continue;
      if (value === "__PENDING_FILE__") continue;
      const display = Array.isArray(value) ? value.join(", ") : String(value);
      if (!display) continue;
      sections.push({ [field.title]: display });
    }
    return sections;
  }

  for (const [key, value] of Object.entries(specValues)) {
    if (optionKeys.has(key)) continue;
    if (value === undefined || value === null || value === "") continue;
    if (value instanceof File) continue;
    if (typeof value === "object" && (value.isExisting || value.url || value.mediaUrl || value.src)) continue;
    const keyLower = key.toLowerCase();
    if (
      keyLower.includes("sizechart") || keyLower.includes("size_chart") ||
      keyLower.includes("size chart") || keyLower.includes("upload")
    ) continue;
    if (value === "__PENDING_FILE__") continue;
    const display = Array.isArray(value) ? value.join(", ") : String(value);
    if (!display) continue;
    sections.push({ [key]: display });
  }
  return sections;
};

export const buildProductOptions = (optionFields = [], specValues = {}, colourImages = {}, confirmedColors = []) => {
  const options = {};
  for (const field of optionFields) {
    const key = field.fieldId || field.title;
    const val = specValues[key];
    const isColour = field.title.toLowerCase() === "color" ||
      field.title.toLowerCase() === "colour" ||
      (field.elementType || "").toLowerCase() === "color picker";

    if (isColour) {
      const colorList = confirmedColors.length > 0 ? confirmedColors : [];
      const selected = Array.isArray(val) ? val : (val ? [val] : []);
      const finalList = colorList.length > 0 ? colorList : selected.map(v => ({ name: v, hex: v }));
      if (finalList.length === 0) continue;

      options[field.title] = {
        optionType: "color",
        name: field.title,
        choices: finalList.map(c => {
          const colorName = c.name || c;
          const colorHex = c.hex || c;
          const choice = {
            description: colorName,
            value: colorHex,
          };
          const img = colourImages[colorName];
          if (img) {
            const urls = Array.isArray(img)
              ? img.filter(Boolean)
              : typeof img === "string"
                ? [img]
                : img instanceof File
                  ? []
                  : [(img?.url || img?.mediaUrl || img?.src || "")].filter(Boolean);
            if (urls.length > 0) {
              choice.mediaItems = urls.map(url => ({
                id: url.split("/").pop()?.split("?")[0] || colorName,
                src: url,
                type: "image",
              }));
            }
          }
          return choice;
        }),
      };
    } else {
      if (!val) continue;
      const selected = Array.isArray(val) ? val : [val];
      if (selected.length === 0) continue;
      options[field.title] = {
        optionType: "drop_down",
        name: field.title,
        choices: selected.map(v => ({
          description: String(v),
          value: String(v),
        })),
      };
    }
  }
  return options;
};

const normalizeVariantKey = (key) => {
  if (!key) return "";
  return key.toLowerCase().replace(/\s*\(\s*#[0-9a-fA-F]+\s*\)/g, "").replace(/\s+/g, "").trim();
};

const getVariantPriceData = (vKey, pricesObj) => {
  if (!pricesObj) return null;
  const target = normalizeVariantKey(vKey);
  const foundKey = Object.keys(pricesObj).find(k => normalizeVariantKey(k) === target);
  return foundKey ? pricesObj[foundKey] : null;
};

export const buildVarientPrice = (variants = [], variantPrices = {}, basePrice = 0) => {
  if (variants.length === 0) return {};
  const base = parseFloat(basePrice) || 0;
  const products = variants.map((v) => {
    const priceData = getVariantPriceData(v.key, variantPrices);
    const hasEnteredValue = !!priceData &&
      priceData.inputVal !== undefined && priceData.inputVal !== null &&
      priceData.inputVal !== "" && !isNaN(parseFloat(priceData.inputVal));
    const finalPrice = base + (hasEnteredValue ? (parseFloat(priceData?.appliedDiff ?? 0) || 0) : 0);
    const choices = {};
    if (v.color) choices["Color"] = v.color;
    if (v.optionLabel) choices[v.optionField] = v.optionLabel;
    return {
      variantInfo: [
        {
          choices,
          price: finalPrice,
          // Marks whether the seller actually entered a price for this
          // variant, so edit-mode reloads don't mistake "untouched" for "filled".
          priceModified: hasEnteredValue,
        },
      ],
    };
  });
  return { products };
};
export const createListing = async (payload) => {
  const safePayload = typeof payload === "string" ? JSON.parse(payload) : payload;

  // Force-sync resellingProfit fields the same way updateListing does,
  // so create and update paths stay consistent.
  // Force-sync resellingProfit fields the same way updateListing does,
  // so create and update paths stay consistent.
  const syncedResellingProfit = parseFloat(
    safePayload.resellingProfit ?? safePayload.sellAndEarnCommission ?? 0
  ) || 0;
  safePayload.resellingProfit = syncedResellingProfit;
  safePayload.sellAndEarnCommission = syncedResellingProfit;
  safePayload.sellAndEarn = syncedResellingProfit > 0;

  // Force-sync totalQuantity (Available Stock) the same way updateListing does.
  // Force-sync totalQuantity (Available Stock) the same way updateListing does.
  // NOTE: only totalQuantity is sent to the backend; inventory/stock are NOT
  // valid backend fields and were causing 400 Bad Request errors on save.
  const syncedTotalQuantity = parseInt(
    safePayload.totalQuantity ?? safePayload.inventory ?? safePayload.stock ?? 0,
    10
  ) || 0;
  safePayload.totalQuantity = syncedTotalQuantity;
  delete safePayload.inventory;
  delete safePayload.stock;

  console.group("[createListing] Request diagnostics");
  console.log("Seller Listing Payload", JSON.parse(JSON.stringify(safePayload)));
  console.log("Saved Seller ID", safePayload.sellerId);
  console.log("Status being sent:", safePayload.status);
  console.log("Seller email (from storage):", resolveSellerEmailForApi());
  console.groupEnd();

  const res = await fetch(`${BASE_URL}/sellerlisting`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(safePayload),
  });

  let data = {};
  try { data = await res.json(); } catch { }

  console.group("[createListing] Response diagnostics");
  console.log("HTTP status:", res.status);
  console.log("Seller Listing Response", JSON.parse(JSON.stringify(data)));
  console.groupEnd();

  if (!res.ok) {
    const errBody = data?.message?.body ?? data?.message ?? data ?? {};
    const msg = errBody?.message || errBody?.error || `Create listing failed (${res.status})`;
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }

  const body =
    data?.message?.data ??
    data?.message?.body ??
    data?.body ??
    data ??
    {};

  if (data?.status && data.status !== "success") {
    const msg = body?.message || body?.error || "Create listing failed.";
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }

  return body;
};

export const updateListing = async (payload) => {
  const safePayload = typeof payload === "string" ? JSON.parse(payload) : payload;

  // Force-sync every SKU field variant right before sending, so whichever
  // field the backend reads as authoritative always carries the latest value.
  // IMPORTANT: prioritize safePayload.sku specifically (the field explicitly
  // set by ReviewSubmitPage's buildPayload from formData.sku) over any stale
  // legacy fields that may still be present on the payload object.
  const syncedSku = String(safePayload.sku ?? "").trim() || String(
    safePayload.SKU ?? safePayload.Sku ??
    safePayload.skuCode ?? safePayload.sku_code ?? ""
  ).trim();
  safePayload.sku = syncedSku;
  safePayload.SKU = syncedSku;
  safePayload.Sku = syncedSku;
  safePayload.skuCode = syncedSku;
  safePayload.sku_code = syncedSku;

  // Force-sync resellingProfit the same way as SKU — whichever field name
  // the backend reads as authoritative always carries the latest value.
  // Force-sync resellingProfit the same way as SKU — whichever field name
  // the backend reads as authoritative always carries the latest value.
  const syncedResellingProfit = parseFloat(
    safePayload.resellingProfit ?? safePayload.sellAndEarnCommission ?? 0
  ) || 0;
  safePayload.resellingProfit = syncedResellingProfit;
  safePayload.sellAndEarnCommission = syncedResellingProfit;
  safePayload.sellAndEarn = syncedResellingProfit > 0;

  // Force-sync totalQuantity (Available Stock) the same way as SKU — whichever
  // field name the backend reads as authoritative always carries the latest value.
  // Force-sync totalQuantity (Available Stock) the same way as SKU — whichever
  // field name the backend reads as authoritative always carries the latest value.
  // NOTE: only totalQuantity is sent to the backend; inventory/stock are NOT
  // valid backend fields and were causing 400 Bad Request errors on update.
  const syncedTotalQuantity = parseInt(
    safePayload.totalQuantity ?? safePayload.inventory ?? safePayload.stock ?? 0,
    10
  ) || 0;
  safePayload.totalQuantity = syncedTotalQuantity;
  delete safePayload.inventory;
  delete safePayload.stock;

  // Force-sync Price the same way as SKU — whichever field name the backend
  // reads as authoritative always carries the latest value.
  const syncedPrice = parseFloat(safePayload.price ?? 0) || 0;
  safePayload.price = syncedPrice;

  console.group("[updateListing] Request diagnostics");
  console.log("Update Listing Payload", JSON.parse(JSON.stringify(safePayload)));
  console.log("Saved Seller ID", safePayload.sellerId || safePayload.Id);
  console.log("Status being sent:", safePayload.status);
  console.log("SKU being sent (all variants synced):", syncedSku);
  console.groupEnd();

  const res = await fetch(`${BASE_URL}/updateSellerProduct`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(safePayload),
  });

  let data = {};
  try { data = await res.json(); } catch { }

  console.group("[updateListing] Response diagnostics");
  console.log("HTTP status:", res.status);
  console.log("Update Listing Response", data);
  console.groupEnd();

  if (!res.ok) {
    const errBody = data?.message?.body ?? data?.message ?? data ?? {};
    const msg = errBody?.message || errBody?.error || `Update listing failed (${res.status})`;
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }

  const body = data?.message?.body ?? data?.body ?? data ?? {};
  if (data?.status && data.status !== "success") {
    const msg = body?.message || body?.error || "Update listing failed.";
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }

  // Guard: confirm the backend actually persisted the new SKU.
  // If the response doesn't echo it back, fall back to what we sent
  // rather than trusting a stale server value on next fetch.
  // Guard: confirm the backend actually persisted the new SKU.
  // If the response doesn't echo it back, fall back to what we sent
  // rather than trusting a stale server value on next fetch.
  const returnedSku = body.sku || body.SKU || body.Sku || body.skuCode || body.sku_code || "";
  if (safePayload.sku && returnedSku !== safePayload.sku) {
    console.warn(
      "[updateListing] ⚠️ Backend did not echo back the updated SKU. Sent:",
      safePayload.sku, "Received:", returnedSku
    );
  }

  // Guard: confirm the backend actually persisted the new totalQuantity.
  // If it doesn't echo it back, we still return the value we sent so the
  // immediate UI reflects the user's change, but we log this so a real
  // backend persistence failure is not silently hidden.
  const returnedStock = body.totalQuantity ?? body.inventory ?? body.stock;
  if (returnedStock === undefined || Number(returnedStock) !== syncedTotalQuantity) {
    console.warn(
      "[updateListing] ⚠️ Backend did not echo back the updated Available Stock. Sent:",
      syncedTotalQuantity, "Received:", returnedStock
    );
  }

  // Guard: confirm the backend actually persisted the new price.
  const returnedPrice = body.price;
  if (returnedPrice === undefined || Number(returnedPrice) !== syncedPrice) {
    console.warn(
      "[updateListing] ⚠️ Backend did not echo back the updated Price. Sent:",
      syncedPrice, "Received:", returnedPrice
    );
  }

  return {
    ...body,
    sku: safePayload.sku, SKU: safePayload.sku, skuCode: safePayload.sku, sku_code: safePayload.sku, Sku: safePayload.sku,
    resellingProfit: syncedResellingProfit, sellAndEarnCommission: syncedResellingProfit,
    totalQuantity: syncedTotalQuantity, inventory: syncedTotalQuantity, stock: syncedTotalQuantity,
    price: syncedPrice,
  };
};
export const buildCreatePayload = ({
  formData,
  images = [],
  category,
  subcategory,
  specifications = {},
  optionFields = [],
  variants = [],
  variantPrices = {},
  promotionImage = null,
  keywords = [],
  discountType = "percent",
  statusOverride = "Under Review",
  colourImages = {},
  confirmedColors = [],
  specFieldsList = [],
}) => {
  const successImages = images.filter((i) => i.mediaUrl || i.url || i.src);
  const rawMainmedia = successImages[0]?.mediaUrl || successImages[0]?.url || successImages[0]?.src || "";
  const mainmedia = resolveWixImage(rawMainmedia) || rawMainmedia;
  const mediaItems = buildMediaItems(successImages);
  const productImages = mediaItems;
  const promoPhotosArr = buildPromotionPhotos(promotionImage);
  const promotionPhotos = promoPhotosArr;
  const discount = buildDiscount(formData, discountType);
  const optionKeys = new Set(optionFields.map((f) => f.fieldId || f.title));
  const additionalInfoSections = buildAdditionalInfoSections(specifications, optionKeys, specFieldsList);
  const productOptions = buildProductOptions(optionFields, specifications, colourImages, confirmedColors);
  const base = parseFloat(formData.price) || 0;
  const effectivePrice = formData.onSale && formData.salePrice
    ? parseFloat(formData.salePrice) || base
    : base;
  const varientPrice = buildVarientPrice(variants, variantPrices, effectivePrice);

  const sizeChartEntry = Object.entries(specifications).find(([, v]) => {
    if (!v || v === "__PENDING_FILE__" || v instanceof File) return false;
    if (typeof v === "object" && v.url && (v.url.startsWith("http://") || v.url.startsWith("https://") || v.url.startsWith("wix:image://")) && !v.url.includes("__PENDING")) return true;
    if (typeof v === "object" && (v.mediaUrl || v.src)) return true;
    if (typeof v === "string" && (v.startsWith("https://") || v.startsWith("http://") || v.startsWith("wix:image://"))) return true;
    return false;
  });
  const sizeChartVal = sizeChartEntry?.[1];
  const sizeChart = sizeChartVal ? (resolveWixImage(resolveSizeChartUrl(sizeChartVal)) || "") : "";

  const sellerId = getSellerId();
  const sellerPinCode = getSellerPinCode();
  const sellerEmail = resolveSellerEmailForApi();

  const subCatId =
    subcategory?.SubCategoryID ||
    subcategory?.subcategoryId ||
    subcategory?._id ||
    subcategory?.id ||
    "";

  const catId =
    category?.CategoryID ||
    category?._id ||
    category?.id ||
    "";

  return {
    sellerId,
    sellerEmail,
    sellerPinCode: parseInt(sellerPinCode, 10) || 0,
    categoryName: [category?.name || ""],
    categoryId: [catId],
    mediaItems,
    productImages,
    mainCategory: catId,
    subCategory: subcategory?.name || "",
    subCategoryId: subCatId,
    promotionPhotos,
    paymentType: formData.acceptCOD === "yes" ? "Cash on Delivery Available" : "prepaid",
    productReturn: resolveProductReturn(formData.productReturn),
    deliveryCharges: formData.deliveryCharge === "yes",
    shippingWeight: parseFloat(formData.shippingWeight) || 0,
    totalQuantity: parseInt(formData.availableStock, 10) || 5,
    brand: formData.brand || "",
    status: statusOverride,
    mainmedia,
    name: formData.productName || "",
    price: base,
    sku: (formData.sku || "").trim(),
    SKU: (formData.sku || "").trim(),
    Sku: (formData.sku || "").trim(),
    skuCode: (formData.sku || "").trim(),
    sku_code: (formData.sku || "").trim(),
    productType: "physical",
    haatzaverified: false,
    sizeChart: sizeChart || "",
    discount,
    manageVariants: Object.keys(productOptions).length > 0,
    search_keywords: keywords || [],
    keywords: keywords || [],
    resellingProfit: parseFloat(formData.resellingProfit) || 0,
    sellAndEarnCommission: parseFloat(formData.resellingProfit) || 0,
    sellAndEarn: !!formData.resellingProfit,
    productOptions,
    varientPrice,
    additionalInfoSections,
  };
};

export const buildUpdatePayload = ({
  tableId,
  formData,
  images = [],
  category,
  subcategory,
  specifications = {},
  optionFields = [],
  variants = [],
  variantPrices = {},
  promotionImage = null,
  keywords = [],
  discountType = "percent",
  editData = {},
  statusOverride = "Under Review",
  colourImages = {},
  confirmedColors = [],
  specFieldsList = [],
}) => {
  const successImages = images.filter((i) => i.mediaUrl || i.url || i.src);
  const rawMainmedia = successImages[0]?.mediaUrl || successImages[0]?.url || successImages[0]?.src || editData?.mainmedia || "";
  const mainmedia = resolveWixImage(rawMainmedia) || rawMainmedia;
  const mediaItems = buildMediaItems(successImages);
  const promoPhotosArr = buildPromotionPhotos(promotionImage);
  const promotionPhotos = promoPhotosArr;
  const discount = buildDiscount(formData, discountType);
  const optionKeys = new Set(optionFields.map((f) => f.fieldId || f.title));
  const additionalInfoSections = buildAdditionalInfoSections(specifications, optionKeys, specFieldsList);
  const productOptions = buildProductOptions(optionFields, specifications, colourImages, confirmedColors);
  const base = parseFloat(formData.price) || 0;
  const effectivePrice = formData.onSale && formData.salePrice
    ? parseFloat(formData.salePrice) || base
    : base;
  const varientPrice = buildVarientPrice(variants, variantPrices, effectivePrice);

  const sizeChartEntry = Object.entries(specifications).find(([, v]) => {
    if (!v || v === "__PENDING_FILE__" || v instanceof File) return false;
    if (typeof v === "object" && v.url && (v.url.startsWith("http://") || v.url.startsWith("https://") || v.url.startsWith("wix:image://")) && !v.url.includes("__PENDING")) return true;
    if (typeof v === "object" && (v.mediaUrl || v.src)) return true;
    if (typeof v === "string" && (v.startsWith("https://") || v.startsWith("http://") || v.startsWith("wix:image://"))) return true;
    return false;
  });
  const sizeChartVal = sizeChartEntry?.[1];
  const sizeChart = sizeChartVal ? (resolveWixImage(resolveSizeChartUrl(sizeChartVal)) || "") : "";

  const productImages = mediaItems;

  const sellerId = getSellerId();
  const sellerPinCode = getSellerPinCode();
  const sellerEmail = resolveSellerEmailForApi();

  const catId =
    category?.CategoryID ||
    category?._id ||
    category?.id ||
    editData?.categoryId?.[0] ||
    editData?.mainCategory ||
    "";

  const subCatId =
    subcategory?.SubCategoryID ||
    subcategory?.subcategoryId ||
    subcategory?._id ||
    subcategory?.id ||
    editData?.subCategoryId ||
    editData?.SubCategoryID ||
    "";

  return {
    Id: tableId,
    _id: tableId,
    Table_ID: tableId,
    sellerId,
    sellerEmail,
    sellerPinCode: parseInt(sellerPinCode, 10) || 0,
    name: formData.productName || "",
    sku: (formData.sku ?? "").trim(),
    SKU: (formData.sku ?? "").trim(),
    Sku: (formData.sku ?? "").trim(),
    skuCode: (formData.sku ?? "").trim(),
    sku_code: (formData.sku ?? "").trim(),
    resellingProfit: parseFloat(formData.resellingProfit) || 0,
    sellAndEarn: !!formData.resellingProfit,
    sellAndEarnCommission: parseFloat(formData.resellingProfit) || 0,
    productImages,
    description: editData?.description || "",
    shippingWeight: parseFloat(formData.shippingWeight) || 0,
    brand: formData.brand || "",
    status: statusOverride,
    mainmedia,
    productOptions,
    price: base,
    discount,
    manageVariants: Object.keys(productOptions).length > 0,
    ribbon: editData?.ribbon || "",
    varientPrice,
    additionalInfoSections,
    paymentType: formData.acceptCOD === "yes" ? "Cash on Delivery Available" : "prepaid",
    productReturn: resolveProductReturn(formData.productReturn),
    deliveryCharges: formData.deliveryCharge === "yes",
    totalQuantity: (() => {
      const parsed = parseInt(formData.availableStock, 10);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : (editData?.totalQuantity || 5);
    })(),
    resellingProfit: parseFloat(formData.resellingProfit) || 0,
    sellAndEarn: !!formData.resellingProfit,
    sellAndEarnCommission: parseFloat(formData.resellingProfit) || 0,
    search_keywords: keywords,
    keywords: keywords || [],
    promotionPhotos,
    sizeChart: sizeChart || "",
    mediaItems,
    categoryName: category?.name ? [category.name] : (editData?.categoryName || []),
    categoryId: catId ? [catId] : (editData?.categoryId || []),
    mainCategory: catId,
    subCategory: subcategory?.name || editData?.subCategory || "",
    subCategoryId: subCatId,
    sku: (formData.sku ?? "").trim(),
    SKU: (formData.sku ?? "").trim(),
    Sku: (formData.sku ?? "").trim(),
    skuCode: (formData.sku ?? "").trim(),
    sku_code: (formData.sku ?? "").trim(),
    productType: "physical",
    productId: editData?.productId || editData?.product_id || editData?.ProductId || "",
    product_id: editData?.productId || editData?.product_id || editData?.ProductId || "",
    ProductId: editData?.productId || editData?.product_id || editData?.ProductId || "",
  };
};

export const normalizeSettlementSummary = (response) => {
  const body =
    response?.message?.body ||
    response?.message?.data ||
    response?.message ||
    response?.data ||
    response ||
    {};

  const toNumber = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  };

  return {
    status: response?.status || "success",

    sellingPrice: toNumber(
      body.sellingPrice ||
      body.sellingprice ||
      body.orderAmount
    ),

    productGST: toNumber(
      body.productGST ||
      body.gst ||
      body.GST ||
      body.gstAmount
    ),

    tcs: toNumber(
      body.tcsAmount ||
      body.tcs ||
      body.TCS
    ),

    tds: toNumber(
      body.tdsAmount ||
      body.tds ||
      body.TDS
    ),

    commission: toNumber(
      body.commission ||
      body.Commission ||
      body.platformCommission ||
      body.haatzaCommission
    ),

    gstOnCommission: toNumber(
      body.gstOnCommission ||
      body.gstOnPlatformCommission ||
      body.commissionGst
    ),

    pgCharges: toNumber(
      body.pgCharges ||
      body.paymentGatewayCharges ||
      body.pgFee
    ),

    gstOnPgCharges: toNumber(
      body.gstOnPgCharges ||
      body.gstOnPaymentGatewayCharges ||
      body.pgChargesGst
    ),

    shippingFee: toNumber(
      body.approxShippingFee ||
      body.shippingFee ||
      body.shipping ||
      body.shippingCharge
    ),

    gstOnShippingFee: toNumber(
      body.gstOnShippingFee ||
      body.shippingFeeGst ||
      body.gstOnShipping
    ),

    fixedFee: toNumber(
      body.fixedFee ||
      body.fixedCharges
    ),

    handlingFee: toNumber(
      body.handlingFee ||
      body.handlingCharges
    ),

    totalDebit: toNumber(
      body.totalDebit ||
      body.totalDeductions ||
      body.debit
    ),

    settlementAmount: toNumber(
      body.settlementAmount ||
      body.approxSettlementAmount ||
      body.netAmount ||
      body.netSettlement ||
      body.approxSettlement
    ),

    note: body.note || body.message_note || body.noteText || "",

    raw: body
  };
};

export const getSettlementSummary = async ({
  orderAmount,
  categoryId,
  deliveryCharges,
  shippingWeight,
  sellerPinCode,
  sellerId,
}) => {
  if (!sellerId) throw new Error("Missing sellerId for settlementsummary");

  const params = {
    orderAmount,
    categoryId,
    deliveryCharges,
    shippingWeight,
    sellerPinCode,
    sellerId,
  };

  console.log("[SettlementsPage] Settlement Summary Params", params);

  const res = await axios.get(`${HAATZA_BASE}/settlementsummary`, { params });

  console.log("[SettlementsPage] Settlement Summary Response", res.data);

  return res.data;
};

export const fetchSettlementSummary = async ({
  orderAmount,
  categoryId,
  deliveryCharges,
  shippingWeight,
  sellerPinCode,
  sellerId,
}) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  const resolvedPin = sellerPinCode || getSellerPinCode();

  if (orderAmount === undefined || orderAmount === null || orderAmount === "") {
    throw new Error("orderAmount is required for settlement summary.");
  }

  if (!categoryId) {
    throw new Error("categoryId is required for settlement summary.");
  }

  if (shippingWeight === undefined || shippingWeight === null || shippingWeight === "") {
    throw new Error("shippingWeight is required for settlement summary.");
  }

  if (!resolvedPin) {
    throw new Error("sellerPinCode is required for settlement summary.");
  }

  const response = await axios.get(`${API_BASE_URL}/settlementsummary`, {
    params: {
      orderAmount,
      categoryId,
      deliveryCharges: Boolean(deliveryCharges),
      shippingWeight,
      sellerPinCode: resolvedPin,
      sellerId: resolvedSellerId,
    },
    timeout: 15000,
  });

  return normalizeSettlementSummary(response.data);
};


/* =============================================================================
   // MY LISTINGS APIs
   ============================================================================= */

export const fetchSellerListings = async ({
  email,
  page = 1,
  limit = 10,
  type,
} = {}) => {
  if (!email?.trim()) {
    throw new Error("Seller email is required to fetch listings.");
  }

  const params = {
    email: email.trim(),
    page: Number(page) || 1,
    limit: Number(limit) || 10,
    t: Date.now(),
  };
  if (type) params.type = type;

  try {
    const response = await axios.get(
      `${BASE_URL}/seller_products`,
      { params, timeout: 15_000 }
    );
    return unwrapMyListingsEnvelope(response.data, params.limit);
  } catch (err) {
    if (!err.response) {
      throw err;
    }
    const body = err.response.data;
    const errBody = body?.message?.body ?? body?.message ?? body ?? {};
    const message =
      (typeof errBody?.message === "string" && errBody.message) ||
      (typeof errBody?.error === "string" && errBody.error) ||
      (typeof body?.message === "string" && body.message) ||
      (typeof body?.error === "string" && body.error) ||
      errBody?.errorMessage ||
      err.message ||
      "Unable to load listings. Please try again.";
    throw new Error(message);
  }
};

export const fetchProductDetails = async (tableId) => {
  if (!tableId) throw new Error("Product Table_ID is required.");

  try {
    const response = await axios.get(
      `${BASE_URL_WWW}/sellerProductDetails`,
      { params: { Table_ID: tableId, t: Date.now() }, timeout: 15_000 }
    );

    const data = response.data;
    const candidates = [
      data?.message?.body?.product,
      data?.message?.body,
      data?.body?.product,
      data?.body,
      data,
    ];

    const details = candidates.find(
      (c) =>
        c &&
        typeof c === "object" &&
        !Array.isArray(c) &&
        (c.name || c.price != null || c.status || c.Table_ID)
    ) ?? data;

    if (!details || typeof details !== "object") {
      throw new Error("Product not found or response format changed.");
    }

    const normalised = { ...details };

    // Table_ID is the DB record identifier used by updateSellerProduct.
    // productId is a separate Wix product reference — never substitute it here.
    normalised.Table_ID = normalised.Table_ID || normalised.tableId
      || normalised.table_id || normalised._id || normalised.productId || "";

    normalised.mainmedia = normalised.mainmedia || normalised.main_media
      || normalised.mainMedia || normalised.mainImage || "";

    normalised.productImages = normalised.productImages || normalised.product_images
      || normalised.images || normalised.mediaItems || [];

    const lastSavedSku = sessionStorage.getItem(`__haatza_lastSku_${normalised.Table_ID || tableId || ""}`);
    normalised.sku = lastSavedSku || normalised.sku || normalised.SKU || normalised.Sku ||
      normalised.skuCode || normalised.sku_code || "";
    normalised.SKU = normalised.sku;
    normalised.skuCode = normalised.sku;
    normalised.sku_code = normalised.sku;
    normalised.Sku = normalised.sku;

    const lastSavedReselling = sessionStorage.getItem(`__haatza_lastResellingProfit_${normalised.Table_ID || tableId || ""}`);
    normalised.resellingProfit = lastSavedReselling !== null && lastSavedReselling !== ""
      ? Number(lastSavedReselling)
      : (normalised.resellingProfit ?? normalised.sellAndEarnCommission ?? normalised.reselling_profit ?? normalised.sell_and_earn_commission ?? 0);
    normalised.sellAndEarnCommission = normalised.resellingProfit;

    // Prefer the server's own value when it is present and non-zero/defined;
    // only fall back to the sessionStorage cache when the server response is
    // missing the field entirely. This prevents a stale cached value from
    // permanently overriding a successful backend update.
    // Prefer the freshly cached client-side value (set immediately after a
    // successful Update Listing / Send for QC save) — same priority pattern
    // already used for SKU and Reselling Profit above. This guarantees
    // Available Stock never reverts to a stale server value if the backend
    // hasn't finished propagating the update by the time this fetch runs.
    const lastSavedStock = sessionStorage.getItem(`__haatza_lastStock_${normalised.Table_ID || tableId || ""}`);
    const serverStockRaw = details.totalQuantity ?? details.inventory ?? details.stock ?? null;
    normalised.totalQuantity = (lastSavedStock !== null && lastSavedStock !== "")
      ? Number(lastSavedStock)
      : (serverStockRaw !== null && serverStockRaw !== undefined && serverStockRaw !== ""
          ? Number(serverStockRaw)
          : 0);
    normalised.inventory = normalised.totalQuantity;
    normalised.stock = normalised.totalQuantity;

    const rawSizeChart = normalised.sizeChart || normalised.size_chart
      || normalised.sizeChartUrl || normalised.size_chart_url
      || normalised.sizeChartImage || "";
    normalised.sizeChart = resolveWixImage(rawSizeChart) || "";

    const rawPromo = normalised.promotionPhotos
      || normalised.promotion_photos || normalised.promoPhotos
      || normalised.promotionImages || [];
    const promoArr = Array.isArray(rawPromo) ? rawPromo : [rawPromo];
    normalised.promotionPhotos = promoArr
      .map(p => {
        if (!p) return null;
        const raw = typeof p === "string" ? p : p.src || p.url || p.image || null;
        return resolveWixImage(raw);
      })
      .filter(Boolean);

    if (!normalised.mediaItems) {
      normalised.mediaItems = normalised.productImages;
    }

    return normalised;
  } catch (err) {
    if (!err.response) throw err;
    const body = err.response.data;
    const errBody = body?.message?.body ?? body?.message ?? body ?? {};
    const message =
      (typeof errBody?.message === "string" && errBody.message) ||
      (typeof body?.error === "string" && body.error) ||
      err.message ||
      "Unable to fetch product details.";
    throw new Error(message);
  }
};

export const getProductDetails = fetchProductDetails;
export const getSellerProducts = async (email) => {
  const resolvedEmail = email || resolveSellerEmailForApi();
  if (!resolvedEmail) {
    return { status: "success", data: [], products: [], message: [] };
  }

  const response = await axios.get(`${BASE_URL}/seller_products`, {
    params: { email: resolvedEmail, page: 1, limit: 100 },
    timeout: 15000,
  });
  return response.data;
};

export const fetchInProgressListings = async ({
  email,
  page = 1,
  limit = 10,
} = {}) => {
  if (!email?.trim()) {
    throw new Error("Seller email is required to fetch in-progress listings.");
  }

  const resolveStoredSellerId = () => {
    const keys = ["sellerId", "seller_id", "userId", "user_id", "user", "authUser", "currentUser", "userData", "sellerData"];
    for (const key of keys) {
      const raw = sessionStorage.getItem(key) || localStorage.getItem(key);
      if (!raw) continue;
      if (raw.length > 3 && !raw.startsWith("{") && !raw.startsWith("[")) return raw.trim();
      try {
        const parsed = JSON.parse(raw);
        const val = parsed?.sellerId || parsed?.seller_id || parsed?.userId || parsed?.user_id
          || parsed?.user?.sellerId || parsed?.data?.sellerId || null;
        if (val) return String(val).trim();
      } catch { }
    }
    return "";
  };

  const resolvedSellerId = resolveStoredSellerId();

  const params = {
    email: email.trim(),
    sellerEmail: email.trim(),
    page: Number(page) || 1,
    limit: Number(limit) || 10,
    sellerId: resolvedSellerId || "",
    t: Date.now(),
  };

  try {
    let response = await axios.get(
      `${BASE_URL}/seller_products`,
      { params, timeout: 15_000 }
    );

    if (response.data) {
      const checkBody = response.data?.message?.body ?? response.data?.body ?? response.data ?? {};
      const checkProducts = checkBody.sellerProducts ?? checkBody.products ?? checkBody.items ?? [];
      if (checkProducts.length === 0) {
        try {
          response = await axios.get(
            `${BASE_URL_WWW}/seller_products`,
            { params, timeout: 15_000 }
          );
        } catch (retryErr) {
          console.warn("[InProgressApi] www retry also failed:", retryErr.message);
        }
      }
    }

    const result = unwrapInProgressListingsEnvelope(response.data, params.limit);
    return result;
  } catch (err) {
    if (!err.response) {
      throw err;
    }

    const body = err.response.data;
    const errBody = body?.message?.body ?? body?.message ?? body ?? {};
    const message =
      (typeof errBody?.message === "string" && errBody.message) ||
      (typeof errBody?.error === "string" && errBody.error) ||
      (typeof body?.message === "string" && body.message) ||
      (typeof body?.error === "string" && body.error) ||
      errBody?.errorMessage ||
      errBody?.reason ||
      err.message ||
      "Unable to load in-progress listings. Please try again.";

    throw new Error(message);
  }
};

export const fetchInProgressProductDetails = async (tableId) => {
  if (!tableId) throw new Error("Product Table_ID is required.");

  try {
    const response = await axios.get(
      `${BASE_URL_WWW}/sellerProductDetails`,
      { params: { Table_ID: tableId, t: Date.now() }, timeout: 15_000 }
    );

    const data = response.data;
    const candidates = [
      data?.message?.body?.product,
      data?.message?.data?.product,
      data?.message?.body,
      data?.message?.data,
      data?.body?.product,
      data?.body,
      data?.data,
      data,
    ];

    const details = candidates.find(
      (c) =>
        c &&
        typeof c === "object" &&
        !Array.isArray(c) &&
        (c.name || c.price != null || c.status || c.Table_ID || c._id)
    ) ?? data;

    if (!details || typeof details !== "object") {
      throw new Error("Product not found or response format changed.");
    }

    const normalised = { ...details };

    normalised.Table_ID = normalised.Table_ID || normalised.tableId
      || normalised.table_id || normalised._id || tableId || normalised.productId || "";
    normalised.productId = normalised.productId || normalised.product_id || normalised.wixProductId || "";

    normalised.mainmedia = normalised.mainmedia || normalised.main_media
      || normalised.mainMedia || normalised.mainImage || "";

    normalised.productImages = normalised.productImages || normalised.product_images
      || normalised.images || normalised.mediaItems || [];

    const lastSavedSku = sessionStorage.getItem(`__haatza_lastSku_${normalised.Table_ID || tableId || ""}`);
    normalised.sku = lastSavedSku || normalised.sku || normalised.SKU || normalised.Sku ||
      normalised.skuCode || normalised.sku_code || "";
    normalised.SKU = normalised.sku;
    normalised.skuCode = normalised.sku;
    normalised.sku_code = normalised.sku;
    normalised.Sku = normalised.sku;

    const lastSavedReselling = sessionStorage.getItem(`__haatza_lastResellingProfit_${normalised.Table_ID || tableId || ""}`);
    normalised.resellingProfit = lastSavedReselling !== null && lastSavedReselling !== ""
      ? Number(lastSavedReselling)
      : (normalised.resellingProfit ?? normalised.sellAndEarnCommission ?? normalised.reselling_profit ?? normalised.sell_and_earn_commission ?? 0);
    normalised.sellAndEarnCommission = normalised.resellingProfit;

    // Prefer the server's own value when present; only fall back to the
    // sessionStorage cache when the server response omits the field.
    // Prefer the freshly cached client-side value (set immediately after a
    // successful Update Listing / Send for QC save) — same priority pattern
    // already used for SKU and Reselling Profit above. This guarantees
    // Available Stock never reverts to a stale server value if the backend
    // hasn't finished propagating the update by the time this fetch runs.
    const lastSavedStock = sessionStorage.getItem(`__haatza_lastStock_${normalised.Table_ID || tableId || ""}`);
    const serverStockRaw = details.totalQuantity ?? details.inventory ?? details.stock ?? null;
    normalised.totalQuantity = (lastSavedStock !== null && lastSavedStock !== "")
      ? Number(lastSavedStock)
      : (serverStockRaw !== null && serverStockRaw !== undefined && serverStockRaw !== ""
          ? Number(serverStockRaw)
          : 0);
    normalised.inventory = normalised.totalQuantity;
    normalised.stock = normalised.totalQuantity;
    const rawSizeChart = normalised.sizeChart || normalised.size_chart
      || normalised.sizeChartUrl || normalised.size_chart_url
      || normalised.sizeChartImage || "";
    normalised.sizeChart = resolveWixImage(rawSizeChart) || "";
    const rawPromo = normalised.promotionPhotos
      || normalised.promotion_photos || normalised.promoPhotos
      || normalised.promotionImages || [];
    const promoArr = Array.isArray(rawPromo) ? rawPromo : [rawPromo];
    normalised.promotionPhotos = promoArr
      .map(p => {
        if (!p) return null;
        const raw = typeof p === "string" ? p : p.src || p.url || p.image || null;
        return resolveWixImage(raw);
      })
      .filter(Boolean);

    if (!normalised.mediaItems) {
      normalised.mediaItems = normalised.productImages;
    }

    return normalised;
  } catch (err) {
    if (!err.response) throw err;
    const body = err.response.data;
    const errBody = body?.message?.body ?? body?.message ?? body ?? {};
    const message =
      (typeof errBody?.message === "string" && errBody.message) ||
      (typeof body?.error === "string" && body.error) ||
      err.message ||
      "Unable to fetch product details.";
    throw new Error(message);
  }
};


/* =============================================================================
   // ONBOARD STATUS APIs
   ============================================================================= */

export const checkOnboardStatus = async (contact) => {
  if (!contact) {
    throw new Error("checkOnboardStatus: contact is required.");
  }

  const trimmed = contact.trim();
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  const isPhone = /^[6-9]\d{9}$/.test(trimmed);

  let queryParam = "";
  if (isEmail) {
    queryParam = `email=${encodeURIComponent(trimmed)}`;
  } else if (isPhone) {
    queryParam = `phone=${encodeURIComponent(trimmed)}`;
  } else {
    throw new Error("Invalid email or phone number.");
  }

  const url = `${ONBOARD_STATUS_API_URL}?${queryParam}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(
      `Onboard status API error: ${res.status} ${res.statusText}`
    );
  }

  const data = await res.json();

  // ─── Cache sellerId if present in response ───────────────────────────
  try {
    const sellerObj = data?.message?.seller || data?.seller || data?.message || data || {};
    if (sellerObj && typeof sellerObj === 'object') {
      const resolvedSellerId =
        sellerObj.sellerId ||
        sellerObj.seller_id ||
        sellerObj._id ||
        sellerObj.id ||
        sellerObj.uid ||
        sellerObj.SellerID ||
        sellerObj.Seller_ID ||
        data?.message?.sellerId ||
        data?.message?.seller_id ||
        data?.sellerId ||
        data?.seller_id ||
        data?.SellerID ||
        "";
      if (resolvedSellerId && String(resolvedSellerId).trim().length > 2) {
        const sid = String(resolvedSellerId).trim();
        localStorage.setItem("sellerId", sid);
        sessionStorage.setItem("sellerId", sid);
        localStorage.setItem("__haatza_sellerId", sid);
        sessionStorage.setItem("__haatza_sellerId", sid);
        console.log("[sellerService:checkOnboardStatus] ✅ Extracted and cached sellerId:", sid);
      }
    }
  } catch (err) {
    console.warn("[sellerService:checkOnboardStatus] Failed to extract and cache sellerId:", err);
  }

  const candidates = [
    data?.message?.status,
    data?.message?.onboardingStatus,
    data?.message?.onboardStatus,
    data?.message?.seller?.status,
    data?.message?.seller?.onboardingStatus,
    data?.message?.seller?.onboardStatus,
    data?.seller?.status,
    data?.seller?.onboardingStatus,
    data?.seller?.onboardStatus,
    data?.status,
    data?.onboardingStatus,
    data?.onboardStatus,
    typeof data?.message === "string" ? data.message : undefined,
    data?.active,
    data?.completed,
    data?.onboarded,
    data?.message?.active,
    data?.message?.completed,
    data?.message?.onboarded,
    data?.message?.seller?.active,
    data?.message?.seller?.completed,
    data?.message?.seller?.onboarded,
    data?.seller?.active,
    data?.seller?.completed,
    data?.seller?.onboarded,
  ];

  for (const candidate of candidates) {
    if (candidate !== undefined && candidate !== null) {
      if (typeof candidate === "boolean") {
        return candidate;
      }
      if (typeof candidate === "string" && candidate.trim() !== "") {
        const s = candidate.toLowerCase().trim();
        const ACTIVE_VALUES = new Set(["active", "completed", "complete", "done", "true"]);
        const INACTIVE_VALUES = new Set(["inactive", "incomplete", "pending", "not_completed", "false"]);
        if (ACTIVE_VALUES.has(s)) return true;
        if (INACTIVE_VALUES.has(s)) return false;
      }
    }
  }

  console.warn("checkOnboardStatus: unknown response shape:", data);
  return false;
};


/* =============================================================================
   // OTP APIs
   ============================================================================= */

export const generateOtp = async (phone) => {
  const res = await fetch(`${SELLER_BASE_URL}/generateotp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone }),
  });

  if (!res.ok) {
    throw new Error("Failed to generate OTP. Please try again.");
  }

  const data = await res.json();

  if (data?.status !== "success") {
    throw new Error(data?.message || "Could not send OTP. Please try again.");
  }

  return data;
};

export const verifyOtp = async (phone, otp) => {
  const res = await fetch(`${SELLER_BASE_URL}/verifyotp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, otp }),
  });

  if (!res.ok) {
    throw new Error("Verification failed. Please try again.");
  }

  const data = await res.json();

  if (data?.status !== "success") {
    throw new Error(data?.message || "Invalid OTP. Please try again.");
  }

  if (phone) {
    localStorage.setItem("sellerPhone", phone);
    sessionStorage.setItem("sellerPhone", phone);
    localStorage.setItem("__haatza_sellerPhone", phone);
    sessionStorage.setItem("__haatza_sellerPhone", phone);
  }

  let verifiedName = "";
  let verifiedSellerId = "";
  let verifiedEmail = "";
  let verifiedPhone = phone || "";
  let verifiedCompanyName = "";

  try {
    let p = data?.message || data?.data || data || {};
    if (Array.isArray(p)) {
      p = p[0] || {};
    }
    const actualData = (typeof p === "string") ? (data?.data || data || {}) : p;
    let sellerObj = actualData.seller || actualData.data || actualData;
    if (Array.isArray(sellerObj)) {
      sellerObj = sellerObj[0] || {};
    }

    verifiedName =
      sellerObj.fullName ||
      (sellerObj.firstName ? (sellerObj.firstName + (sellerObj.lastName ? " " + sellerObj.lastName : "")).trim() : "") ||
      sellerObj.name ||
      sellerObj.nickname ||
      sellerObj.sellerName ||
      actualData.fullName ||
      (actualData.firstName ? (actualData.firstName + (actualData.lastName ? " " + actualData.lastName : "")).trim() : "") ||
      actualData.name ||
      actualData.nickname ||
      actualData.sellerName ||
      "";

    verifiedSellerId =
      sellerObj.sellerId ||
      sellerObj.seller_id ||
      sellerObj._id ||
      sellerObj.id ||
      actualData.sellerId ||
      actualData.seller_id ||
      actualData.uid ||
      actualData.id ||
      "";

    verifiedEmail =
      sellerObj.email ||
      sellerObj.emailId ||
      actualData.email ||
      actualData.emailId ||
      "";

    const resolvedPhone =
      sellerObj.phone ||
      sellerObj.phonenumber ||
      sellerObj.phone_number ||
      sellerObj.mobile_number ||
      sellerObj.contact ||
      sellerObj.mobile ||
      actualData.phone ||
      actualData.phonenumber ||
      actualData.phone_number ||
      actualData.mobile_number ||
      actualData.contact ||
      actualData.mobile ||
      phone ||
      "";

    if (resolvedPhone) {
      verifiedPhone = resolvedPhone;
    }

    if (verifiedPhone) {
      localStorage.setItem("sellerPhone", verifiedPhone);
      sessionStorage.setItem("sellerPhone", verifiedPhone);
      localStorage.setItem("__haatza_sellerPhone", verifiedPhone);
      sessionStorage.setItem("__haatza_sellerPhone", verifiedPhone);
    }

    if (verifiedName) {
      localStorage.setItem("sellerFullName", verifiedName);
      sessionStorage.setItem("sellerFullName", verifiedName);
      localStorage.setItem("__haatza_sellerName", verifiedName);
      sessionStorage.setItem("__haatza_sellerName", verifiedName);
      localStorage.setItem("sellerName", verifiedName);
      sessionStorage.setItem("sellerName", verifiedName);
    }

    verifiedCompanyName =
      sellerObj.companyName ||
      sellerObj.company_name ||
      sellerObj.storeName ||
      sellerObj.store_name ||
      sellerObj.tradeName ||
      sellerObj.trade_name ||
      sellerObj.businessName ||
      sellerObj.business_name ||
      actualData.companyName ||
      actualData.company_name ||
      actualData.storeName ||
      actualData.store_name ||
      actualData.tradeName ||
      actualData.trade_name ||
      actualData.businessName ||
      actualData.business_name ||
      "";

    if (verifiedCompanyName) {
      localStorage.setItem("companyName", verifiedCompanyName);
      sessionStorage.setItem("companyName", verifiedCompanyName);
    }

    if (verifiedSellerId && String(verifiedSellerId).trim().length > 2) {
      const sid = String(verifiedSellerId).trim();
      localStorage.setItem("sellerId", sid);
      sessionStorage.setItem("sellerId", sid);
      localStorage.setItem("__haatza_sellerId", sid);
      sessionStorage.setItem("__haatza_sellerId", sid);
    }
  } catch (err) {
    console.warn("[verifyOtp] Could not extract seller name/id from response:", err);
  }

  const resolvedEmail = verifiedEmail || (data?.message?.seller?.email) || "";
  let resolvedFullName = verifiedName || "";
  let resolvedNickname = "";
  let resolvedFirstName = "";
  let resolvedCompanyName = verifiedCompanyName || "";
  let resolvedGstin = "";
  let resolvedAddress = "";
  let resolvedPincode = "";
  let resolvedLogoUrl = "";

  if (resolvedEmail) {
    try {
      const profile = await getUserProfile(resolvedEmail, verifiedSellerId);
      const actualProfile = profile?.message || profile?.data || profile || {};
      const profileSeller = actualProfile.seller || actualProfile.data || actualProfile || {};

      resolvedFirstName = profileSeller.firstName || actualProfile.firstName || "";
      const dbFullName = profileSeller.fullName || actualProfile.fullName || "";
      if (dbFullName) {
        resolvedFullName = dbFullName.trim();
      }

      if (!resolvedFirstName && resolvedFullName) {
        resolvedFirstName = resolvedFullName.split(/\s+/)[0];
      }

      const dbNickname = profileSeller.nickname || actualProfile.nickname || "";
      resolvedCompanyName = profileSeller.companyName || profileSeller.storeName || actualProfile.companyName || resolvedCompanyName || "";

      if (resolvedFirstName) {
        resolvedNickname = resolvedFirstName.trim();
      } else if (dbNickname) {
        resolvedNickname = dbNickname.trim();
      } else {
        resolvedNickname = resolvedCompanyName.trim();
      }

      resolvedGstin = profileSeller.GSTIN || profileSeller.gstin || actualProfile.GSTIN || actualProfile.gstin || "";
      resolvedAddress = profileSeller.address || actualProfile.address || "";
      resolvedPincode = profileSeller.pincode || actualProfile.pincode || "";
      resolvedLogoUrl = profileSeller.logoUrl || profileSeller.logo || actualProfile.logoUrl || "";
    } catch (e) {
      console.warn("[verifyOtp] Failed to fetch user profile to populate name:", e);
    }
  }

  // Extract from OTP response fallback if needed
  let otpGstin = "";
  let otpAddress = "";
  let otpPincode = "";
  let otpLogoUrl = "";
  try {
    let p = data?.message || data?.data || data || {};
    if (Array.isArray(p)) {
      p = p[0] || {};
    }
    const actualData = (typeof p === "string") ? (data?.data || data || {}) : p;
    let sellerObj = actualData.seller || actualData.data || actualData;
    if (Array.isArray(sellerObj)) {
      sellerObj = sellerObj[0] || {};
    }
    otpGstin = sellerObj.GSTIN || sellerObj.gstin || actualData.GSTIN || actualData.gstin || "";
    otpAddress = sellerObj.address || actualData.address || "";
    otpPincode = sellerObj.pincode || sellerObj.sellerPinCode || sellerObj.pinCode || actualData.pincode || actualData.sellerPinCode || actualData.pinCode || "";
    otpLogoUrl = sellerObj.logoUrl || sellerObj.logo || actualData.logoUrl || actualData.logo || "";
  } catch (err) { }

  if (!resolvedGstin) resolvedGstin = otpGstin;
  if (!resolvedAddress) resolvedAddress = otpAddress;
  if (!resolvedPincode) resolvedPincode = otpPincode;
  if (!resolvedLogoUrl) resolvedLogoUrl = otpLogoUrl;

  if (!resolvedNickname) {
    if (resolvedFullName) {
      resolvedNickname = resolvedFullName.split(" ")[0];
    } else if (resolvedCompanyName) {
      resolvedNickname = resolvedCompanyName;
    }
  }

  data.userData = {
    sellerId: verifiedSellerId,
    email: resolvedEmail,
    phone: verifiedPhone,
    fullName: resolvedFullName || resolvedNickname,
    nickname: resolvedNickname,
    firstName: resolvedFirstName,
    companyName: resolvedCompanyName,
    GSTIN: resolvedGstin,
    gstin: resolvedGstin,
    address: resolvedAddress,
    pincode: resolvedPincode,
    logoUrl: resolvedLogoUrl,
    storageType: "Seller",
  };

  return data;
};

export const resendOtp = async (phone) => {
  const res = await fetch(`${SELLER_BASE_URL}/resendotp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone }),
  });

  if (!res.ok) {
    throw new Error("Failed to resend OTP. Please try again.");
  }

  const data = await res.json();

  if (data?.status !== "success") {
    throw new Error(data?.message || "Could not resend OTP. Please try again.");
  }

  return data;
};


/* =============================================================================
   // REGISTER APIs
   ============================================================================= */

export const registerUser = async ({ fullName, phone, email, password }) => {
  if (!fullName?.trim()) {
    throw new Error("Please enter your full name.");
  }

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!isValidEmail) {
    throw new Error("Please enter a valid email address.");
  }

  const isValidPhone = /^[6-9]\d{9}$/.test(phone);
  if (!isValidPhone) {
    throw new Error("Please enter a valid 10-digit mobile number.");
  }

  if (!password || password.length < 8) {
    throw new Error("Password must be at least 8 characters long.");
  }



  const names = fullName.trim().split(/\s+/);
  const firstName = names[0] || "";
  const lastName = names.slice(1).join(" ") || "";

  const payload = {
    firstName,
    lastName,
    phone,
    email: email.toLowerCase().trim(),
    password,
    fcmToken: "token",
    fullName: fullName.trim(),
  };

  const res = await fetch(`${PROFILE_BASE_URL}/registeruser`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error("Registration failed. Please try again.");
  }

  console.log("Registration Payload:", payload);
  console.log("Registration API Response:", data);
  console.log("Registered First Name:", payload.firstName);

  // Backend sometimes returns 400 with "identity email Already exists" even when
  // the record was successfully created. We treat this as a successful registration.
  // Backend sometimes returns 400 with "identity email Already exists" even when
  // the record was successfully created. We treat this as a successful registration.
  const messageStr = typeof data?.message === "string"
    ? data.message.toLowerCase()
    : "";
  const isFalsePositiveError =
    messageStr.includes("identity") ||
    messageStr.includes("already exists") ||
    messageStr.includes("already registered") ||
    messageStr.includes("email exists") ||
    messageStr.includes("duplicate");

  if (data?.status === "success" || isFalsePositiveError) {
    const resolvedSellerId =
      data?.message?.sellerId ||
      data?.message?.body?.sellerId ||
      data?.message?.data?.sellerId ||
      data?.message?.SellerID ||
      data?.message?.body?.SellerID ||
      data?.data?.sellerId ||
      data?.data?.SellerID ||
      data?.seller?.sellerId ||
      data?.SellerID ||
      data?.sellerId ||
      "";

    if (resolvedSellerId) {
      localStorage.setItem("sellerId", String(resolvedSellerId));
      sessionStorage.setItem("sellerId", String(resolvedSellerId));
      localStorage.setItem("__haatza_sellerId", String(resolvedSellerId));
      sessionStorage.setItem("__haatza_sellerId", String(resolvedSellerId));
    }
    if (email) {
      const cleanEmail = email.toLowerCase().trim();
      localStorage.setItem("sellerEmail", cleanEmail);
      sessionStorage.setItem("sellerEmail", cleanEmail);
      localStorage.setItem("__haatza_sellerEmail", cleanEmail);
      sessionStorage.setItem("__haatza_sellerEmail", cleanEmail);
    }
    if (phone) {
      localStorage.setItem("sellerPhone", phone);
      sessionStorage.setItem("sellerPhone", phone);
      localStorage.setItem("__haatza_sellerPhone", phone);
      sessionStorage.setItem("__haatza_sellerPhone", phone);
    }
    if (fullName) {
      const cleanName = fullName.trim();
      localStorage.setItem("sellerFullName", cleanName);
      sessionStorage.setItem("sellerFullName", cleanName);
      localStorage.setItem("__haatza_sellerName", cleanName);
      sessionStorage.setItem("__haatza_sellerName", cleanName);
    }

    return {
      success: true,
      message: "Account created successfully!",
      sellerId: resolvedSellerId,
      email: email ? email.toLowerCase().trim() : "",
      phone: phone || "",
      fullName: fullName ? fullName.trim() : "",
      userData: {
        sellerId: resolvedSellerId,
        email: email ? email.toLowerCase().trim() : "",
        phone: phone || "",
        fullName: fullName ? fullName.trim() : "",
        nickname: firstName || (fullName ? fullName.trim() : ""),
        firstName: firstName,
      }
    };
  }

  // Only throw for genuine errors (not the false-positive "identity" error)
  const genuineErrorMsg = data?.message || "Registration failed. Please try again.";
  console.warn("[registerUser] Unhandled backend response:", data);
  throw new Error(genuineErrorMsg);
};


/* =============================================================================
   // SPECIFICATION APIs
   ============================================================================= */

export const fetchCategoryFields = async (categoryId) => {
  let res;
  try {
    res = await fetch(
      `https://haatza.com/_functions/CategoryFields?categoryId=${categoryId}`
    );
  } catch (networkErr) {
    throw new Error(`Network error — check your connection: ${networkErr.message}`);
  }

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const json = await res.json();
  const raw = Array.isArray(json)
    ? json
    : (json.message?.data || json.data || json.fields || json.items || []);

  return [...raw].sort((a, b) => (a.sequence ?? 999) - (b.sequence ?? 999));
};


/* =============================================================================
   // WALLET APIs
   ============================================================================= */

// --- Wallet response-mapping helpers (no UI impact, used only by service layer) ---

const toNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const pickNumber = (obj, keys = []) => {
  if (!obj || typeof obj !== "object") return 0;

  for (const key of keys) {
    const value = obj[key];
    if (value !== undefined && value !== null && value !== "") {
      return toNumber(value);
    }
  }

  return 0;
};

const unwrapArray = (...values) => {
  for (const value of values) {
    if (Array.isArray(value)) return value;
  }
  return [];
};

export const getBalanceFromResponse = (res) => {
  return Number(
    res?.message?.RemainingBalance ??
    res?.message?.remainingBalance ??
    res?.message?.balance ??
    res?.RemainingBalance ??
    res?.remainingBalance ??
    res?.balance ??
    res?.data?.RemainingBalance ??
    res?.data?.balance ??
    0
  );
};

export const getTransactionsFromResponse = (res) => {
  return unwrapArray(
    res?.message?.transactions,
    res?.message?.data,
    res?.message?.body?.transactions,
    res?.data?.transactions,
    res?.data,
    res?.transactions
  );
};

export const getTransactionAmount = (tx) => {
  return pickNumber(tx, [
    "amount",
    "amountAdded",
    "transactionAmount",
    "walletAmount",
    "creditAmount",
    "debitAmount",
    "totalAmount",
    "paidAmount",
    "value"
  ]);
};

const normalizeText = (value) =>
  String(value || "").trim().toLowerCase();

export const isCreditTransaction = (tx) => {
  const text = normalizeText(
    [
      tx.type,
      tx.transactionType,
      tx.status,
      tx.description,
      tx.reason,
      tx.title
    ].join(" ")
  );

  if (tx.isCredit === true) return true;
  if (tx.isCredit === false) return false;

  return (
    text.includes("credit") ||
    text.includes("deposit") ||
    text.includes("add_funds") ||
    text.includes("add funds") ||
    text.includes("funds added")
  );
};

export const getSpendFromCampaignDetails = (row = {}) => {
  return pickNumber(row, [
    "totalSpend",
    "total_spend",
    "spend",
    "amountSpent",
    "spentAmount",
    "spendAmount",
    "campaignSpend",
    "adSpend",
    "totalCost",
    "cost",
    "totalAmount",
    "amount",
    "debit",
    "totalDebit",
    "deductedAmount",
    "walletDebit",
    "campaignDebit"
  ]);
};

export const normalizeCampaignDetailsRows = (detailsRes) => {
  const body =
    detailsRes?.message?.data ||
    detailsRes?.message?.body ||
    detailsRes?.message ||
    detailsRes?.data ||
    detailsRes ||
    {};

  const rows = unwrapArray(
    body.performance,
    body.campaignPerformance,
    body.details,
    body.rows,
    body.items,
    body.data
  );

  if (rows.length > 0) return rows;
  if (body && typeof body === "object") return [body];

  return [];
};

export const checkWalletBalance = async (sellerId) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  return walletService.checkWalletBalance(resolvedSellerId);
};

export const getTransactionHistory = async (sellerId) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  return walletService.transactionHistory(resolvedSellerId);
};

export const addFunds = async (sellerIdOrPayload, amount) => {
  if (typeof sellerIdOrPayload === "object") {
    return walletService.addFunds(sellerIdOrPayload);
  }
  const resolvedSellerId = getOrResolveSellerId(sellerIdOrPayload);
  return walletService.addFunds({ sellerId: resolvedSellerId, amountAdded: Number(amount) });
};

export const getWalletSummary = async (sellerId) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  return walletService.checkWalletBalance(resolvedSellerId);
};

export const getWalletTransactions = async (sellerId) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  return walletService.transactionHistory(resolvedSellerId);
};

export const getCampaignSpends = async (tableId, { fromDate, toDate } = {}) => {
  return getCampaignDetails(tableId, { fromDate, toDate });
};

export const createWalletOrder = async (sellerId, amount) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  return walletService.createRazorpayOrder({ sellerId: resolvedSellerId, amount: Number(amount) });
};

export const verifyWalletPayment = async (sellerId, paymentResponse) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  return walletService.verifyRazorpayPayment({ sellerId: resolvedSellerId, ...paymentResponse });
};

export const fetchWalletBalance = async (sellerId) => {
  try {
    const resolvedSellerId = getOrResolveSellerId(sellerId);
    const data = await walletService.checkWalletBalance(resolvedSellerId);
    return getBalanceFromResponse(data);
  } catch (err) {
    console.error("[fetchWalletBalance] Error fetching balance:", err);
    return 0;
  }
};

export const getSellerTutorials = async () => {
  const response = await axios.get(`${API_BASE_URL}/SellerTutorials`, {
    timeout: 15000,
  });
  return response.data;
};

export const getSellerTickets = async ({ sellerId, emailId, fromDate, toDate }) => {
  try {
    const resolvedSellerId = getOrResolveSellerId(sellerId);
    const resolvedEmail = emailId || resolveSellerEmailForApi();
    const response = await axios.get(`${API_BASE_URL}/sellertickets`, {
      params: {
        sellerId: resolvedSellerId,
        emailId: resolvedEmail || "",
        email: resolvedEmail || "",
        fromDate,
        toDate
      },
      timeout: 15000,
    });
    return response.data;
  } catch (error) {
    console.warn("[API Failed]", "getSellerTickets", error.response?.status, error.response?.data || error.message);
    return { status: "success", tickets: [], data: [], message: { data: [] } };
  }
};

export const getTickets = async (sellerId) => {
  const email = resolveSellerEmailForApi();
  const now = new Date();
  const fromDate = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  const toDate = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .split("T")[0];
  return getSellerTickets({ sellerId, emailId: email, fromDate, toDate });
};

export const createTicket = async (sellerId, payload) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  const response = await axios.post(
    `${API_BASE_URL}/createTicket`,
    { sellerId: resolvedSellerId, ...payload },
    { headers: { "Content-Type": "application/json" }, timeout: 10000 }
  );
  return response.data;
};

export const getSellerNewOrders = async (sellerId) => {
  try {
    const resolvedSellerId = getOrResolveSellerId(sellerId);
    const response = await axios.get(`${API_BASE_URL}/sellernewOrders`, {
      params: { sellerId: resolvedSellerId },
      timeout: 15000,
    });
    return response.data;
  } catch (error) {
    console.warn("[API Failed]", "getSellerNewOrders", error.response?.status, error.response?.data || error.message);
    return { status: "success", count: 0, data: [], message: [] };
  }
};

export const getSellerPayments = async (arg = {}, config = {}) => {
  const paramsInput = typeof arg === "string" ? { email: resolveSellerEmailForApi() || "" } : arg;
  const { email, fromDate, toDate, count = 50, lastFetched = 0 } = paramsInput;

  if (!email) throw new Error("Missing seller email for sellerpayments");

  const params = new URLSearchParams({
    email,
    fromDate: fromDate || "",
    toDate: toDate || "",
    count: String(count),
    lastFetched: String(lastFetched),
  });

  const res = await axios.get(`https://haatza.com/_functions/sellerpayments?${params.toString()}`, config);

  return res.data;
};

export const getSellerConfirmedOrdersCount = async (sellerId) => {
  try {
    const resolvedSellerId = getOrResolveSellerId(sellerId);
    const response = await axios.get(`${API_BASE_URL}/sellerConfirmedOrdersCount`, {
      params: { sellerId: resolvedSellerId },
      timeout: 15000,
    });
    return response.data;
  } catch (error) {
    console.warn("[API Failed]", "getSellerConfirmedOrdersCount", error.response?.status, error.response?.data || error.message);
    return { status: "success", count: 0, message: { count: 0 } };
  }
};

export const getTopSellingProducts = async (sellerId) => {
  try {
    const resolvedSellerId = getOrResolveSellerId(sellerId);
    const response = await axios.get(`${API_BASE_URL}/getTopSellingProducts`, {
      params: { sellerId: resolvedSellerId },
      timeout: 15000,
    });
    return response.data;
  } catch (error) {
    console.warn("[API Failed]", "getTopSellingProducts", error.response?.status, error.response?.data || error.message);
    return { status: "success", data: [], message: [] };
  }
};

export const getProductStats = async (arg1, arg2, arg3) => {
  const params = {};

  if (arg1 && typeof arg1 === "object") {
    // Called with: getProductStats({ sellerId, tableId, categoryName })
    params.sellerId = arg1.sellerId;
    params.tableId = arg1.tableId;
    params.categoryName = arg1.categoryName;
  } else if (arg2 !== undefined) {
    // Called with: getProductStats(sellerId, tableId, categoryName)
    params.sellerId = arg1;
    params.tableId = arg2;
    params.categoryName = arg3;
  } else {
    // Legacy support for single argument (like dashboard calling with sellerId)
    if (arg1 && String(arg1).startsWith("HS")) {
      params.sellerId = arg1;
    } else {
      params.tableId = arg1;
    }
  }

  // Intercept overall seller product stats requests (lacking tableId)
  if (!params.tableId) {
    try {
      const email = resolveSellerEmailForApi();
      if (email) {
        const result = await fetchSellerListings({
          email,
          page: 1,
          limit: 1000,
          type: "mylisting",
        });
        const products = result?.products || [];
        const total = result?.total || products.length;
        const active = products.filter(
          (p) => (p?.status || "").toLowerCase() === "approved"
        ).length;
        return {
          status: "success",
          totalProducts: total,
          activeListings: active,
          total: total,
          active: active,
        };
      }
    } catch (e) {
      console.error("Fallback overall product stats fetch failed:", e);
    }
    return {
      status: "success",
      totalProducts: 0,
      activeListings: 0,
      total: 0,
      active: 0,
    };
  }

  // Validate only for product-level queries (where tableId is passed or expected)
  if (params.tableId !== undefined || params.categoryName !== undefined) {
    if (!params.tableId) {
      console.error("Product Stats API validation failed: Missing tableId.");
      return { status: "error", message: { error: "Missing tableId in query parameters" } };
    }
    if (!params.categoryName) {
      console.error("Product Stats API validation failed: Missing categoryName.");
      return { status: "error", message: { error: "Missing categoryName in query parameters" } };
    }
  }

  try {
    const response = await axios.get(`${API_BASE_URL}/getProductStats`, {
      params,
      timeout: 15000,
    });
    return response.data;
  } catch (err) {
    const errorBody = err.response?.data ? JSON.stringify(err.response.data) : "No response body";
    console.error(
      `Product Stats API Error:\nRequest URL: ${API_BASE_URL}/getProductStats\nParams: ${JSON.stringify(params)}\nResponse Body: ${errorBody}`,
      err
    );
    throw err;
  }
};

export const fetchWalletTransactions = async (sellerId) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  try {
    const response = await walletService.transactionHistory(resolvedSellerId);
    const rawTx = getTransactionsFromResponse(response);
    return rawTx.map((tx, index) => {
      const dateVal = tx.createdDate || tx.createdAt || tx.date || tx.paymentDate || tx.updatedAt;
      return {
        id: tx._id || tx.id || tx.transactionId || tx.paymentId || `tx-${index}`,
        date: dateVal || "Recent",
        type: tx.type || tx.transactionType || tx.description || "Transaction",
        amount: getTransactionAmount(tx),
        isCredit: isCreditTransaction(tx),
        status: tx.status || "Completed",
      };
    });
  } catch (err) {
    console.error("[fetchWalletTransactions] Error fetching transactions:", err);
    throw new Error("Unable to load transaction records.");
  }
};

export const addFundsToWallet = async (sellerId, amount, razorpayResponse = {}) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);

  const payload = {
    sellerId: resolvedSellerId,
    amountAdded: Number(amount),
    paymentId: razorpayResponse.razorpay_payment_id || razorpayResponse.paymentId
  };

  _svcLog("[WalletPage] Add Funds Payload", payload);

  try {
    const response = await walletService.addFunds(payload);
    _svcLog("[WalletPage] Add Funds Response", response);
    return response;
  } catch (err) {
    console.error(
      "[addFundsToWallet] Error:",
      err?.response?.status,
      err?.response?.data || err.message
    );

    throw new Error(
      err.response?.data?.error ||
      err.response?.data?.message ||
      "Failed to complete wallet credit."
    );
  }
};


/* =============================================================================
   // ADVERTISEMENT APIs
   ============================================================================= */

export const getApiData = (response) => response?.data ?? response;

export const safeArray = (value) => {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return [value];
  return [];
};

export const extractSellerCampaignProducts = (response) => {
  const apiData = getApiData(response);
  if (Array.isArray(apiData)) return apiData;
  const products =
    apiData?.message?.Products ??
    apiData?.message?.products ??
    apiData?.message?.data?.Products ??
    apiData?.message?.data?.products ??
    apiData?.Products ??
    apiData?.products ??
    apiData?.data?.Products ??
    apiData?.data?.products ??
    apiData?.data?.message?.Products ??
    apiData?.data?.message?.products ??
    [];
  return safeArray(products);
};

export const extractSellerCampaigns = (response) => {
  const apiData = getApiData(response);
  if (Array.isArray(apiData)) return apiData;
  const campaigns =
    apiData?.message?.campaigns ??
    apiData?.message?.data?.campaigns ??
    apiData?.campaigns ??
    apiData?.data?.campaigns ??
    apiData?.data?.message?.campaigns ??
    [];
  return safeArray(campaigns);
};

export const extractCampaignSummary = (response) => {
  const apiData = getApiData(response);
  return (
    apiData?.message?.data ??
    apiData?.data ??
    apiData?.message ??
    {}
  );
};

export const extractCampaignDetails = (response) => {
  const apiData = getApiData(response);
  return apiData?.message ?? apiData?.data ?? apiData ?? {};
};

export const extractCampaignProducts = (response) => {
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
    apiData?.data ??
    [];
  return safeArray(products);
};

export const extractCampaignProductPerformance = (response) => {
  const apiData = getApiData(response);
  const performance =
    apiData?.message?.performance ??
    apiData?.message?.data?.performance ??
    apiData?.performance ??
    apiData?.data?.performance ??
    apiData?.data?.message?.performance ??
    apiData?.message ??
    apiData?.data ??
    [];
  return safeArray(performance);
};

export const getAdvertisements = async (sellerId) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  const response = await axios.get(SELLER_CAMPAIGNS_API, {
    params: { sellerId: resolvedSellerId },
    timeout: 15000,
  });
  return response.data;
};

export const getAdvertisementSummary = async (sellerId) => {
  try {
    const resolvedSellerId = getOrResolveSellerId(sellerId);
    const response = await axios.get(CAMPAIGN_SUMMARY_API, {
      params: { sellerId: resolvedSellerId },
      timeout: 15000,
    });
    return response.data;
  } catch (error) {
    console.warn("[API Failed]", "getAdvertisementSummary", error.response?.status, error.response?.data || error.message);
    return { status: "success", data: {}, message: {} };
  }
};

export const getSellerCampaignProducts = async (arg) => {
  let sellerId, page = 1, limit = 30, search = "";
  if (arg && typeof arg === "object" && !Array.isArray(arg)) {
    sellerId = arg.sellerId;
    page = arg.page ?? 1;
    limit = arg.limit ?? 30;
    search = arg.search ?? "";
  } else {
    sellerId = arg;
  }
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  const params = { sellerId: resolvedSellerId, page, limit };
  if (search) {
    params.search = search;
  }
  const response = await axios.get(`${API_BASE_URL}/sellerCampaignsproducts`, {
    params,
    timeout: 15000,
  });
  return response.data;
};

export const getSellerCampaigns = async (arg) => {
  const sellerId = (arg && typeof arg === "object" && !Array.isArray(arg)) ? arg.sellerId : arg;
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  const response = await axios.get(`${API_BASE_URL}/sellerCampaigns`, {
    params: { sellerId: resolvedSellerId },
    timeout: 15000,
  });
  return response.data;
};

export const getCampaignSummary = async (arg) => {
  const sellerId = (arg && typeof arg === "object" && !Array.isArray(arg)) ? arg.sellerId : arg;
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  const response = await axios.get(`${API_BASE_URL}/Campaignsummery`, {
    params: { sellerId: resolvedSellerId },
    timeout: 15000,
  });
  return response.data;
};

export const getCampaignDetails = async (arg, extra) => {
  let tableId, fromDate, toDate;
  if (arg && typeof arg === "object" && !Array.isArray(arg)) {
    tableId = arg.tableId;
    fromDate = arg.fromDate;
    toDate = arg.toDate;
  } else {
    tableId = arg;
    if (extra && typeof extra === "object") {
      fromDate = extra.fromDate;
      toDate = extra.toDate;
    }
  }
  const params = { tableId };
  if (fromDate) params.fromDate = fromDate;
  if (toDate) params.toDate = toDate;
  const response = await axios.get(`${API_BASE_URL}/campaignDetails`, {
    params,
    timeout: 15000,
  });
  return response.data;
};


export const getCampaignProductPerformance = async (arg, prodId) => {
  let campaignId = arg;
  let productId = prodId;
  if (arg && typeof arg === "object" && !Array.isArray(arg)) {
    campaignId = arg.campaignId;
    productId = arg.productId;
  }
  const response = await axios.get(`${API_BASE_URL}/CampaignproductPerformance`, {
    params: { campaignId, productId },
    timeout: 15000,
  });
  return response.data;
};

export const createSellerCampaign = async (payload) => {
  if (payload && payload.sellerId) {
    payload.sellerId = getOrResolveSellerId(payload.sellerId);
  }
  const response = await axios.post(`${API_BASE_URL}/newSellerCampaign`, payload, {
    headers: { "Content-Type": "application/json" },
    timeout: 15000,
  });
  return response.data;
};

export const updateSellerCampaign = async (payload) => {
  if (payload && payload.sellerId) {
    payload.sellerId = getOrResolveSellerId(payload.sellerId);
  }
  const response = await axios.post(`${API_BASE_URL}/updateSellerCampaign`, payload, {
    headers: { "Content-Type": "application/json" },
    timeout: 15000,
  });
  return response.data;
};

export const offSellerCampaign = async (payload) => {
  if (payload && payload.sellerId) {
    payload.sellerId = getOrResolveSellerId(payload.sellerId);
  }
  const response = await axios.post(`${API_BASE_URL}/offSellerCampaign`, payload, {
    headers: { "Content-Type": "application/json" },
    timeout: 15000,
  });
  return response.data;
};

export const deleteSellerCampaign = async (payload) => {
  if (payload && payload.sellerId) {
    payload.sellerId = getOrResolveSellerId(payload.sellerId);
  }
  const response = await axios.post(`${API_BASE_URL}/deleteSellerCampaign`, payload, {
    headers: { "Content-Type": "application/json" },
    timeout: 15000,
  });
  return response.data;
};

export const getCampaigns = async (sellerId) => {
  return getSellerCampaigns(sellerId);
};

export const createCampaign = async (payload) => {
  return createSellerCampaign(payload);
};

export const pauseCampaign = async (id, sellerId = null) => {
  return offSellerCampaign({ campaignId: id, sellerId });
};

export const resumeCampaign = async (id, sellerId = null) => {
  return updateSellerCampaign({ campaignId: id, sellerId, status: "Active" });
};

export const deleteCampaign = async (id, sellerId = null) => {
  return deleteSellerCampaign({ campaignId: id, sellerId });
};

export const getAdvertisementPerformance = async (arg, prodId) => {
  return getCampaignProductPerformance(arg, prodId);
};

export const getAdvertisementAnalytics = async (arg, extra) => {
  return getCampaignDetails(arg, extra);
};

export const createAdvertisement = async (payload) => {
  return createCampaign(payload);
};

export const pauseAdvertisement = async (id, sellerId = null) => {
  return pauseCampaign(id, sellerId);
};

export const resumeAdvertisement = async (id, sellerId = null) => {
  return resumeCampaign(id, sellerId);
};

export const deleteAdvertisement = async (id, sellerId = null) => {
  return deleteCampaign(id, sellerId);
};

export const getSellerHaatzupProducts = async (sellerId, page = 1, limit = 15) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  const response = await axios.get(`${API_BASE_URL}/sellerCampaignsproducts`, {
    params: { sellerId: resolvedSellerId, page, limit },
    timeout: 15000,
  });
  return response.data;
};

export const getSellerwiseHaatzUp = async (sellerId, page = 1, limit = 12) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  const response = await axios.get(`${API_BASE_URL}/sellerwiseHaatzUp`, {
    params: { sellerId: resolvedSellerId, page, limit },
    timeout: 15000,
  });
  return response.data;
};

export const uploadHaatzupVideo = async (formData, onUploadProgress = null) => {
  const response = await axios.post(`${API_BASE_URL}/uploadHaatzupVideo`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 60000,
    onUploadProgress: onUploadProgress
      ? (event) => {
        const total = event.total || 1;
        onUploadProgress(Math.round((event.loaded * 100) / total));
      }
      : undefined,
  });
  return response.data;
};

export const deleteHaatzupVideo = async (sellerId, videoId) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  const response = await axios.post(`${API_BASE_URL}/deleteHaatzupVideo`, {
    sellerId: resolvedSellerId,
    videoId,
  }, {
    headers: { "Content-Type": "application/json" },
    timeout: 15000,
  });
  return response.data;
};

export const getSellerHaatzUpDetails = async (sellerId, videoId) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  const response = await axios.get(`${API_BASE_URL}/sellerHaatzUpDetails`, {
    params: { sellerId: resolvedSellerId, videoId },
    timeout: 15000,
  });
  return response.data;
};

export const generateHashtags = async (sellerId, query) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  const response = await axios.get(`${API_BASE_URL}/generateHashtags`, {
    params: { sellerId: resolvedSellerId, query },
    timeout: 15000,
  });
  return response.data;
};

export const getHaatzUpGuidelines = async () => ({
  status: "success",
  message: {
    guidelines: [
      "Reel length must be between 15 and 60 seconds.",
      "Ensure high resolution vertical video in 9:16 format.",
      "Avoid copyrighted background music.",
      "Highlight your product clearly in the first 3 seconds.",
      "Keep captions descriptive and use relevant tags.",
    ],
  },
});

export const getHaatzUpSummary = async (sellerId) => {
  const response = await getSellerwiseHaatzUp(sellerId);
  const videos = unwrapArray(
    response?.data,
    response?.message?.videos,
    response?.message,
    response?.videos
  );
  return {
    status: "success",
    data: {
      uploadedCount: videos.length,
      totalViews: videos.reduce((sum, video) => sum + Number(video.views || video.totalViews || 0), 0),
      totalLikes: videos.reduce((sum, video) => sum + Number(video.likes || video.totalLikes || 0), 0),
      totalComments: videos.reduce((sum, video) => sum + Number(video.comments || video.totalComments || 0), 0),
    },
  };
};

export const getPromotionalVideos = getSellerwiseHaatzUp;
export const getProductsForPromotion = getSellerHaatzupProducts;
export const uploadHaatzUpReel = uploadHaatzupVideo;

export const CAMPAIGN_TYPE_OPTIONS = [
  {
    id: "smart",
    name: "Smart Campaign",
    recommended: true,
    isAvailable: true,
    description: "You choose the products manually, and we optimize the performance."
  },
  {
    id: "manual",
    name: "Manual Campaign",
    recommended: false,
    isAvailable: false,
    description: "Currently unavailable"
  }
];

export const DAILY_BUDGET_OPTIONS = [250, 550, 700];

export const getPromotedProducts = async (sellerId) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  const response = await axios.get(`${API_BASE_URL}/sellerCampaignsproducts`, {
    params: { sellerId: resolvedSellerId },
    timeout: 15000,
  });
  return response.data;
};

export const getNotPromotedProducts = async (sellerId) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  const email = resolveSellerEmailForApi();
  if (!email) {
    return { status: "success", data: [], products: [] };
  }

  const productsResponse = await axios.get(`${API_BASE_URL}/seller_products`, {
    params: { email, page: 1, limit: 100 },
    timeout: 15000,
  });

  let promotedList = [];
  try {
    const promotedResponse = await axios.get(`${API_BASE_URL}/sellerCampaignsproducts`, {
      params: { sellerId: resolvedSellerId },
      timeout: 15000,
    });
    const rawPromoted = promotedResponse.data?.data || promotedResponse.data?.products || promotedResponse.data || [];
    promotedList = Array.isArray(rawPromoted) ? rawPromoted : [];
  } catch (err) {
    console.warn("Failed to fetch promoted products for filtering:", err);
  }

  const allProductsRaw = productsResponse.data?.data || productsResponse.data?.products || productsResponse.data || [];
  const allProducts = Array.isArray(allProductsRaw) ? allProductsRaw : [];

  const promotedIds = new Set(promotedList.map(p => String(p.id || p._id || p.productId)));
  const notPromoted = allProducts.filter(p => !promotedIds.has(String(p.id || p._id)));

  return {
    status: "success",
    data: notPromoted,
    products: notPromoted
  };
};

export const getCampaignTypes = async () => {
  return {
    status: "success",
    message: {
      campaignTypes: CAMPAIGN_TYPE_OPTIONS,
      types: CAMPAIGN_TYPE_OPTIONS
    },
    types: CAMPAIGN_TYPE_OPTIONS
  };
};

export const getBudgetOptions = async () => {
  return {
    status: "success",
    message: {
      budgetOptions: DAILY_BUDGET_OPTIONS,
      budgets: DAILY_BUDGET_OPTIONS
    },
    budgets: DAILY_BUDGET_OPTIONS
  };
};

/* =============================================================================
   // NOTIFICATION APIs
   ============================================================================= */

export const getNotifications = async (sellerId) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  const response = await axios.get(NOTIFICATIONS_API, {
    params: { sellerId: resolvedSellerId },
    timeout: 10000,
  });
  return response.data;
};

export const updateNotificationStatus = async (sellerId, notificationId, status = "read") => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  const response = await axios.post(
    UPDATE_NOTIFICATION_API,
    { sellerId: resolvedSellerId, notificationId, status },
    { headers: { "Content-Type": "application/json" }, timeout: 10000 }
  );
  return response.data;
};

export const markNotificationAsRead = async (sellerId, id) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  return updateNotificationStatus(resolvedSellerId, id, "read");
};

export const markAllNotificationsAsRead = async (sellerId, notificationIds = []) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  const promises = notificationIds.map(id =>
    updateNotificationStatus(resolvedSellerId, id, "read")
  );
  await Promise.all(promises);
  return { status: "success" };
};

export const fetchNotificationsList = async (sellerId) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  try {
    const response = await axios.get(`${API_BASE_URL}/notifications`, {
      params: { sellerId: resolvedSellerId },
      timeout: 10_000,
    });
    const rawNotif = response.data?.message?.data || [];
    return rawNotif.map((n) => ({
      id: n._id || n.id || String(Math.random()),
      title: n.title || "Notification Alert",
      message: n.message || n.body || "",
      time: n.time || "Recently",
      read: Boolean(n.read || n.status === "read"),
      type: n.type || "system",
    }));
  } catch (err) {
    console.error("[fetchNotificationsList] Error loading alerts:", err);
    throw new Error("Unable to fetch notifications.");
  }
};

export const submitWarehouseRequest = async (payload) => {
  const response = await axios.post(
    `${BASE_URL}/sellerwarehouseRequest`,
    payload,
    { headers: { "Content-Type": "application/json" }, timeout: 15000 }
  );
  return response.data;
};

export const updateSellerOnboarding = async (email, updateFields) => {
  if (!email) throw new Error("Seller email is required.");
  const response = await axios.post(
    `${PROFILE_BASE_URL}/updateSelleronboarding`,
    { email, updateFields },
    { headers: { "Content-Type": "application/json" }, timeout: 15000 }
  );
  return response.data;
};

export const forgotPassword = async (email) => {
  if (!email) throw new Error("Seller email is required.");
  const response = await axios.post(
    `${PROFILE_BASE_URL}/forgotPassword`,
    { email },
    { headers: { "Content-Type": "application/json" }, timeout: 15000 }
  );
  return response.data;
};

export const loginUser = async (email, password) => {
  if (!email) throw new Error("Seller email is required.");
  if (!password) throw new Error("Password is required.");

  let response;
  try {
    response = await axios.post(
      `${PROFILE_BASE_URL}/userlogin`,
      { email: email.toLowerCase().trim(), password },
      { headers: { "Content-Type": "application/json" }, timeout: 15000 }
    );
  } catch (err) {
    const status = err.response?.status;
    const serverMsg = (err.response?.data?.message || "").toLowerCase();
    if (
      status === 401 ||
      status === 400 ||
      serverMsg.includes("password") ||
      serverMsg.includes("incorrect") ||
      serverMsg.includes("invalid credentials")
    ) {
      throw new Error("Password is incorrect, try again.");
    }
    throw new Error(err.response?.data?.message || "Unable to sign in. Please try again.");
  }

  const data = response.data;

  if (data?.status === false || (data?.status && data?.status !== true && data?.status !== "success")) {
    const serverMsg = (data?.message || "").toString().toLowerCase();
    if (serverMsg.includes("password") || serverMsg.includes("incorrect") || serverMsg.includes("invalid")) {
      throw new Error("Password is incorrect, try again.");
    }
    throw new Error(data?.message || "Password is incorrect, try again.");
  }

  if (data?.status === true && data?.userData) {
    try {
      const profile = await getUserProfile(email, data.userData.sellerId || data.userData.seller_id);
      const actualProfile = profile?.message || profile?.data || profile || {};
      const sellerObj = actualProfile.seller || actualProfile.data || actualProfile || {};

      const dbFirstName = sellerObj.firstName || actualProfile.firstName || "";
      const dbFullName = sellerObj.fullName || actualProfile.fullName || "";

      let resolvedFirstName = dbFirstName;
      if (!resolvedFirstName && dbFullName) {
        resolvedFirstName = dbFullName.trim().split(/\s+/)[0];
      }

      const dbNickname = sellerObj.nickname || actualProfile.nickname || "";
      const dbCompanyName = sellerObj.companyName || sellerObj.storeName || actualProfile.companyName || "";

      let resolvedNickname = "";
      if (resolvedFirstName) {
        resolvedNickname = resolvedFirstName.trim();
      } else if (dbNickname) {
        resolvedNickname = dbNickname.trim();
      } else {
        resolvedNickname = dbCompanyName.trim();
      }

      data.userData.firstName = resolvedFirstName || data.userData.firstName || "";
      data.userData.companyName = dbCompanyName || data.userData.companyName || "";
      data.userData.nickname = resolvedNickname || data.userData.nickname || "";
      data.userData.fullName = dbFullName || data.userData.fullName || "";
      data.userData.GSTIN = sellerObj.GSTIN || sellerObj.gstin || actualProfile.GSTIN || actualProfile.gstin || data.userData.GSTIN || data.userData.gstin || "";
      data.userData.gstin = data.userData.GSTIN;
      data.userData.address = sellerObj.address || actualProfile.address || data.userData.address || "";
      data.userData.pincode = sellerObj.pincode || actualProfile.pincode || data.userData.pincode || "";
      data.userData.logoUrl = sellerObj.logoUrl || sellerObj.logo || actualProfile.logoUrl || data.userData.logoUrl || "";
    } catch (e) {
      console.warn("Failed to dynamically fetch nickname for login response:", e);
    }
  }
  return data;
};
/* =============================================================================
   // AUDITED BACKEND API INTEGRATIONS
   ============================================================================= */

export const fetchPricingplans = async () => {
  const response = await axios.get(`${PROFILE_BASE_URL}/getPlans`, { timeout: 15000 });
  return response.data;
};

export const getCampaignProducts = async (campaignIdOrParams) => {
  const campaignId = typeof campaignIdOrParams === "object"
    ? campaignIdOrParams?.campaignId
    : campaignIdOrParams;
  const response = await axios.get(`${API_BASE_URL}/CampaignProducts`, {
    params: { campaignId },
    timeout: 15000,
  });
  return response.data;
};

export const fetchSubscriptionPlan = async (email) => {
  const response = await axios.get(`${PROFILE_BASE_URL}/sellersubscription`, {
    params: { email },
    timeout: 15000,
  });
  return response.data;
};

export const fetchInvoiceData = async (sellerId, page = 1, count = 10) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  const response = await axios.get(`${PROFILE_BASE_URL}/sellerInvoices`, {
    params: { sellerId: resolvedSellerId, page, count },
    timeout: 15000,
  });
  return response.data;
};

export const activeCoupons = async () => {
  const response = await axios.get(`${API_BASE_URL}/activeCoupons`, { timeout: 15000 });
  return response.data;
};

export const fetchAllCategory = async (search = "", page = 1, count = 30) => {
  const response = await axios.get(`${API_BASE_URL}/subcategorylist`, {
    params: { search, page, count },
    timeout: 15000,
  });
  return response.data;
};

export const fetchSearchAllCategory = async (search = "") => {
  const response = await axios.get(`${API_BASE_URL}/searchcategorylist`, {
    params: { search },
    timeout: 15000,
  });
  return response.data;
};

export const fetchReferalTransactions = async (sellerId) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  const response = await axios.get(`${PROFILE_BASE_URL}/referralWithdraw`, {
    params: { sellerId: resolvedSellerId },
    timeout: 15000,
  });
  return response.data;
};

export const fetchOrderDetails = async (tableId) => {
  const response = await axios.get(`${API_BASE_URL}/sellerOrderdetails`, {
    params: { tableId },
    timeout: 15000,
  });
  return response.data;
};

export const fetchReturnData = async (sellerId, page = 1, count = 50) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  const response = await axios.get(`${API_BASE_URL}/returns`, {
    params: { sellerId: resolvedSellerId, page, count },
    timeout: 15000,
  });
  return response.data;
};

export const fetchReturnDetails = async (tableId) => {
  const response = await axios.get(`${API_BASE_URL}/sellerreturnDetails`, {
    params: { TableID: tableId },
    timeout: 15000,
  });
  return response.data;
};

export const fetchClaimTrackingData = async (sellerId, page = 1, limit = 10) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  const response = await axios.get(`${API_BASE_URL}/SellerClaimslist`, {
    params: { sellerId: resolvedSellerId, page, limit },
    timeout: 15000,
  });
  return response.data;
};

export const fetchReturnExchangeOrders = async (sellerId, page = 1, limit = 10) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  const response = await axios.get(`${API_BASE_URL}/SellerReturnExchangeOrders`, {
    params: { sellerId: resolvedSellerId, page, limit },
    timeout: 15000,
  });
  return response.data;
};

export const appUpdate = async (version) => {
  const response = await axios.get(`${PROFILE_BASE_URL}/sellercheckVersion`, {
    params: { currentversion: version },
    timeout: 10000,
  });
  return response.data;
};

export const createExchangeOrderFun = async (params) => {
  const response = await axios.post(`${API_BASE_URL}/ExchangecreateShipment`, params, {
    headers: { "Content-Type": "application/json" },
    timeout: 15000,
  });
  return response.data;
};

export const fetchShipmentData = async (trackingId) => {
  const response = await axios.get(`${API_BASE_URL}/trackshipping`, {
    params: { waybill: trackingId },
    timeout: 15000,
  });
  return response.data;
};

export const fetchReferralCheck = async (enteredCouponCode) => {
  const response = await axios.get(`${PROFILE_BASE_URL}/referralCheck`, {
    params: { referralCode: enteredCouponCode },
    timeout: 15000,
  });
  return response.data;
};

export const createRazorPayOrder = async (params) => {
  const response = await axios.post(`${API_BASE_URL}/createRazorpayOrder`, params, {
    headers: { "Content-Type": "application/json" },
    timeout: 15000,
  });
  return response.data;
};

export const createRazorpayOrder = createRazorPayOrder;

export const verifyRazorpayPayment = async (params) => {
  const response = await axios.post(`${API_BASE_URL}/verifyRazorpayPayment`, params, {
    headers: { "Content-Type": "application/json" },
    timeout: 15000,
  });
  return response.data;
};

export const createSubscription = async (params) => {
  const response = await axios.post(`${PROFILE_BASE_URL}/processSubscriptionOrder`, params, {
    headers: { "Content-Type": "application/json" },
    timeout: 15000,
  });
  return response.data;
};

export const getVideoResponse = async (guid) => {
  const response = await axios.get(`https://video.bunnycdn.com/library/583918/videos/${guid}`, {
    timeout: 15000,
  });
  return response.data;
};

export const fetchSellerCampaignProduct = async (sellerId, page = 1, query = "") => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  const params = { sellerId: resolvedSellerId, page, limit: 30 };
  if (query) {
    params.search = query;
  }
  const response = await axios.get(`${API_BASE_URL}/sellerCampaignsproducts`, {
    params,
    timeout: 15000,
  });
  return response.data;
};

export const fetchOrders = async (email, fromDate, toDate, count = 30, lastFetched = 0) => {
  const response = await axios.get(`${API_BASE_URL}/sellernewOrders`, {
    params: { email, fromdate: fromDate, todate: toDate, count, lastFetched },
    timeout: 15000,
  });
  return response.data;
};

export const fetchSellerOrders = async (sellerId, fromdate, toDate, page = 1, count = 30) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  const response = await axios.get(`${API_BASE_URL}/sellernewOrders`, {
    params: { sellerId: resolvedSellerId, fromdate, todate: toDate, page, count },
    timeout: 15000,
  });
  return response.data;
};


/* =============================================================================
   // EXTRA SYSTEM / COMPATIBILITY APIs
   ============================================================================= */

export const getDashboardDrawerMenu = async () => {
  return {
    status: "success",
    menu: [
      { key: "dashboard", label: "Dashboard", route: "/dashboard" },
      { key: "help", label: "Help", route: "/help" },
      {
        heading: "Boost Sales",
        items: [
          { key: "advertisement", label: "Advertisement", route: "/advertisement" },
          { key: "haatzup", label: "HaatzUp", route: "/haatzup" },
          { key: "growplan", label: "Grow Plan", route: "/growplan" },
          { key: "productinsight", label: "Product Insight", route: "/productinsight" },
          { key: "warehouse", label: "Warehouse", route: "/warehouse" },
          { key: "influencer", label: "Influencer Branding", route: "/influencer" },
          { key: "growthcentral", label: "Growth Central", route: "/growthcentral" },
          { key: "qualityinsights", label: "Quality Insights", route: "/qualityinsights" },
          { key: "referandearn", label: "Refer & Earn", route: "/referandearn" }
        ]
      }
    ]
  };
};


/* =============================================================================
   // ORDERS PAGE APIs (Consolidated)
   ============================================================================= */

export const RequestTypes = {
  trackshipping: "https://haatza.com/_functions/trackshipping",
  sellerreferral: "https://www.haatzaseller.com/_functions/sellerreferral",
  sellerReferralcode: "https://www.haatzaseller.com/_functions/sellerReferralcode",
  referralUpdate: "https://www.haatzaseller.com/_functions/referralUpdate"
};

export const fetchTrackingDetails = async (trackingId) => {
  const res = await fetch(`${RequestTypes.trackshipping}?waybill=${trackingId}`);
  const data = await res.json();
  console.log("Tracking Response", data);
  return data;
};

export const updateOrdersstatus = async (orderId, sellerId, status) => {
  const payload = { orderId: Number(orderId), sellerId, status };
  console.log("updateOrdersstatus Request:", payload);
  const res = await fetch(`${BASE_URL}/updateOrdersstatus`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  console.log("updateOrdersstatus Response:", data);
  return data;
};

export const getDeliveryAmount = async (o_pin, d_pin, cgm) => {
  const url = `${BASE_URL}/getDeliveryAmount?o_pin=${o_pin}&d_pin=${d_pin}&cgm=${cgm}`;
  console.log("getDeliveryAmount Request:", url);
  const res = await fetch(url);
  const data = await res.json();
  console.log("getDeliveryAmount Response:", data);
  return data;
};

export const expectedTat = async (sellerPinCode, toPincode) => {
  const url = `${BASE_URL}/expectedTat?sellerPinCode=${sellerPinCode}&toPincode=${toPincode}`;
  console.log("expectedTat Request:", url);
  const res = await fetch(url);
  const data = await res.json();
  console.log("expectedTat Response:", data);
  return data;
};

export const createShipment = async (orderId, sellerId, trackingId) => {
  const payload = {
    orderId: Number(orderId),
    sellerId,
    OrderId: Number(orderId),
    SellerId: sellerId,
    trackingId: trackingId || "",
    tracking_id: trackingId || "",
    waybill: trackingId || "",
    awb: trackingId || "",
    AWB: trackingId || ""
  };
  console.log("createShipment Request:", payload);
  const res = await fetch(`${BASE_URL}/createShipment`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  console.log("createShipment Response:", data);
  return data;
};

export const cancelShipment = async (waybill) => {
  const response = await axios.get(
    `https://haatza.com/_functions/cancelShipment?waybill=${waybill}`
  );
  return response.data;
};



/* =============================================================================
   // RETURN / EXCHANGE APIs (Consolidated)
   ============================================================================= */

export const fetchReturns = async (sellerId) => {
  const resolvedSellerId = getOrResolveSellerId(sellerId);
  const response = await axios.get(`${BASE_URL}/returns`, {
    params: { sellerId: resolvedSellerId },
    timeout: 15000,
  });
  return response.data;
};

export const createExchangeShipment = async (sellerId, exchangeOrderId) => {
  const payload = {
    sellerId: getOrResolveSellerId(sellerId),
    exchangeOrderId
  };
  console.log("createExchangeShipment Request:", payload);
  const response = await axios.post(`${BASE_URL}/ExchangecreateShipment`, payload, {
    headers: { "Content-Type": "application/json" },
    timeout: 15000,
  });
  console.log("createExchangeShipment Response:", response.data);
  return response.data;
};

export const handleTrackShipment = async (trackingId) => {
  const response = await axios.get(`${BASE_URL}/trackshipping`, {
    params: { waybill: trackingId },
    timeout: 15000,
  });
  return response.data;
};

export const handleDownloadPackingSlip = (trackingId) => {
  const url = `${BASE_URL}/packingSlip?waybill=${trackingId}`;
  window.open(url, "_blank");
  return url;
};


/* =============================================================================
   DUAL PATTERN EXPORTS
   ============================================================================= */

export const sellerService = {
  fetchInventoryData,
  getSellerProductInventory,
  incrementInventory,
  decrementInventory,
  checkWalletBalance,
  getTransactionHistory,
  addFunds,
  getNotifications,
  updateNotificationStatus,
  getWalletSummary,
  getWalletTransactions,
  getCampaignSpends,
  createWalletOrder,
  verifyWalletPayment,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getDashboardDrawerMenu,
  getUserProfile,
  getSellerTickets,
  getTickets,
  createTicket,
  getAdvertisements,
  getAdvertisementSummary,
  getAdvertisementPerformance,
  getAdvertisementAnalytics,
  createAdvertisement,
  pauseAdvertisement,
  resumeAdvertisement,
  deleteAdvertisement,
  checkSeller,
  fetchSellerDetails,
  getCachedSellerId,
  getCachedSellerPinCode,
  getCachedSellerEmail,
  getCachedSellerPhone,
  getCachedSellerName,
  fetchCategories,
  fetchSubcategoriesFirstPage,
  fetchSubcategoriesPaged,
  fetchSubcategories,
  searchCategories,
  searchSubcategories,
  normalizeSearchText,
  checkGSTINExists,
  updateInventoryStock,
  createListing,
  updateListing,
  buildCreatePayload,
  buildUpdatePayload,
  getSettlementSummary,
  fetchSettlementSummary,
  normalizeSettlementSummary,
  resolveWixImage,
  buildMediaItems,
  buildPromotionPhotos,
  buildDiscount,
  resolveProductReturn,
  buildAdditionalInfoSections,
  buildProductOptions,
  buildVarientPrice,
  resolveSizeChartUrl,
  fetchSellerListings,
  fetchProductDetails,
  fetchInProgressListings,
  fetchInProgressProductDetails,
  checkOnboardStatus,
  generateOtp,
  verifyOtp,
  resendOtp,
  registerUser,
  fetchCategoryFields,
  getCampaignSummary,
  getSellerCampaigns,
  getCampaignDetails,
  getCampaigns,
  getPromotedProducts,
  getNotPromotedProducts,
  getCampaignTypes,
  getBudgetOptions,
  createCampaign,
  updateSellerCampaign,
  pauseCampaign,
  resumeCampaign,
  deleteCampaign,
  getHaatzUpSummary,
  getPromotionalVideos,
  getHaatzUpGuidelines,
  getProductsForPromotion,
  uploadHaatzUpReel,
  fetchWalletBalance,
  fetchWalletTransactions,
  addFundsToWallet,
  fetchNotificationsList,
  getSellerTutorials,
  getSellerNewOrders,
  getSellerPayments,
  getSellerConfirmedOrdersCount,
  getTopSellingProducts,
  getProductStats,
  getProductDetails,
  getSellerProducts,
  deleteHaatzupVideo,
  getSellerHaatzUpDetails,
  generateHashtags,
  resolveSellerId,
  fetchPricingplans,
  getCampaignProducts,
  getCampaignProductPerformance,
  fetchSubscriptionPlan,
  fetchInvoiceData,
  activeCoupons,
  fetchAllCategory,
  fetchSearchAllCategory,
  fetchReferalTransactions,
  fetchOrderDetails,
  fetchReturnData,
  fetchReturnDetails,
  fetchClaimTrackingData,
  fetchReturnExchangeOrders,
  appUpdate,
  createExchangeOrderFun,
  fetchShipmentData,
  fetchReferralCheck,
  createRazorPayOrder,
  createRazorpayOrder,
  verifyRazorpayPayment,
  createSubscription,
  getVideoResponse,
  fetchSellerCampaignProduct,
  fetchOrders,
  fetchSellerOrders,
  RequestTypes,
  fetchTrackingDetails,
  updateOrdersstatus,
  getDeliveryAmount,
  expectedTat,
  createShipment,
  cancelShipment,
  fetchReturns,
  createExchangeShipment,
  handleTrackShipment,
  handleDownloadPackingSlip,
  submitWarehouseRequest,
  updateSellerOnboarding,
  forgotPassword,
  loginUser,
};

export const advertisementService = {
  getAdvertisementSummary,
  getCampaigns,
  getPromotedProducts,
  getNotPromotedProducts,
  getCampaignTypes,
  getBudgetOptions,
  createCampaign,
  pauseCampaign,
  resumeCampaign,
  deleteCampaign,
  fetchSellerCampaignProduct,
  getSellerCampaignProducts,
  getSellerCampaigns,
  getCampaignSummary,
  getCampaignDetails,
  getCampaignProducts,
  getCampaignProductPerformance,
  createSellerCampaign,
  updateSellerCampaign,
  offSellerCampaign,
  deleteSellerCampaign
};

export const walletService = {
  getWalletSummary,
  checkWalletBalance: async (sellerId) => {
    const resolvedSellerId = getOrResolveSellerId(sellerId);
    const resolvedEmail = resolveSellerEmailForApi();
    const params = { sellerId: resolvedSellerId };
    if (resolvedEmail) {
      params.email = resolvedEmail;
    }
    try {
      const res = await axios.get(`${API_BASE_URL}/checkWalletBalance`, {
        params,
      });
      return res.data;
    } catch (error) {
      const errorBody = error.response?.data ? JSON.stringify(error.response.data) : "No response body";
      console.error(
        `Wallet API Error:\nRequest URL: ${API_BASE_URL}/checkWalletBalance\nParams: ${JSON.stringify(params)}\nResponse Body: ${errorBody}`,
        error
      );
      throw error;
    }
  },

  transactionHistory: async (sellerId) => {
    const res = await axios.get(`${API_BASE_URL}/transactionHistory`, {
      params: { sellerId },
    });
    return res.data;
  },

  addFunds: async (payload) => {
    _svcLog("[sellerService] addFunds payload:", payload);
    try {
      const res = await axios.post(`${API_BASE_URL}/addFunds`, payload, {
        headers: { "Content-Type": "application/json" },
        timeout: 15000,
      });
      _svcLog("[sellerService] addFunds response:", res.data);
      return res.data;
    } catch (err) {
      _svcErr("[sellerService] addFunds NETWORK ERROR:", err?.message, err?.response?.status, err?.response?.data);
      throw err;
    }
  },

  createRazorpayOrder: async (payload) => {
    const res = await axios.post(`${API_BASE_URL}/createRazorpayOrder`, payload);
    return res.data;
  },

  verifyRazorpayPayment: async (payload) => {
    console.log("[sellerService] verifyRazorpayPayment payload:", payload);

    try {
      const res = await axios.post(
        `${API_BASE_URL}/verifyRazorpayPayment`,
        payload,
        {
          headers: { "Content-Type": "application/json" },
          timeout: 20000,
          validateStatus: () => true
        }
      );

      console.log("[sellerService] verifyRazorpayPayment status:", res.status);
      console.log("[sellerService] verifyRazorpayPayment response:", res.data);

      if (res.status < 200 || res.status >= 300) {
        const msg =
          res.data?.message ||
          res.data?.error ||
          `verifyRazorpayPayment failed with HTTP ${res.status}`;
        throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
      }

      return res.data;
    } catch (err) {
      console.error(
        "[sellerService] verifyRazorpayPayment failed:",
        err?.message,
        err?.response?.status,
        err?.response?.data
      );
      throw err;
    }
  },

  getCampaignSummary: async (sellerId) => {
    const res = await axios.get(`${API_BASE_URL}/Campaignsummery`, {
      params: { sellerId }
    });
    return res.data;
  },
};

export const haatzupService = {
  getHaatzUpSummary,
  getPromotionalVideos,
  getHaatzUpGuidelines,
  getProductsForPromotion,
  uploadHaatzUpReel
};

export {
  SELLER_PRODUCT_INVENTORY_API,
  INCREMENT_INVENTORY_API,
  DECREMENT_INVENTORY_API,
  CHECK_WALLET_BALANCE_API,
  TRANSACTION_HISTORY_API,
  ADD_FUNDS_API,
  NOTIFICATIONS_API,
  UPDATE_NOTIFICATION_API,
};

export default sellerService;
