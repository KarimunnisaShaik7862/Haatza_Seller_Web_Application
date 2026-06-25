import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  ChevronLeft,
  Wallet,
  Bell,
  Check,
  AlertCircle,
  Plus,
  RefreshCw,
  Clock,
  Calendar,
  Search,
  Package,
  X,
  CheckCircle2
} from "lucide-react";
import { resolveSellerId } from "../../utils/sellerSession";
import {
  advertisementService,
  sellerService,
  checkWalletBalance,
  resolveWixImage,
  extractSellerCampaignProducts as apiExtractProducts,
  extractCampaignProducts
} from "../../services/sellerService";
import "./CreateCampaignPage.css";

const extractSellerCampaignProducts = (response) => {
  if (typeof apiExtractProducts === "function") {
    return apiExtractProducts(response);
  }
  const apiData = response?.data ?? response;
  if (Array.isArray(apiData)) return apiData;
  const products =
    apiData?.message?.Products ??
    apiData?.message?.products ??
    apiData?.Products ??
    apiData?.products ??
    apiData?.data?.Products ??
    apiData?.data?.products ??
    [];
  return Array.isArray(products) ? products : (products && typeof products === "object" ? [products] : []);
};

// Date-Time formatting helper matching Flutter style (D/M/YYYY h:mm A)
const getFormattedDateTime = () => {
  const now = new Date();
  const datePart = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;
  let hours = now.getHours();
  const minutes = now.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  const minutesStr = minutes < 10 ? '0' + minutes : minutes;
  return `${datePart} ${hours}:${minutesStr} ${ampm}`;
};

// Robust Date-Time parser for various formats (ISO, D/M/YYYY h:mm A)
const parseDateTime = (dateTimeStr) => {
  if (!dateTimeStr) return { date: "", time: "" };
  try {
    if (dateTimeStr.includes("/")) {
      const spaceParts = dateTimeStr.trim().split(/\s+/);
      if (spaceParts.length >= 2) {
        const datePart = spaceParts[0];
        const timePart = spaceParts[1];
        const ampmPart = spaceParts[2];

        const dateDigits = datePart.split("/");
        if (dateDigits.length === 3) {
          const dVal = String(dateDigits[0]).padStart(2, "0");
          const mVal = String(dateDigits[1]).padStart(2, "0");
          const yVal = dateDigits[2];
          const formattedDate = `${yVal}-${mVal}-${dVal}`;

          let [hVal, minVal] = timePart.split(":");
          let hours = Number(hVal);
          const mins = String(minVal).padStart(2, "0");
          if (ampmPart) {
            const ampm = ampmPart.toUpperCase();
            if (ampm === "PM" && hours < 12) {
              hours += 12;
            } else if (ampm === "AM" && hours === 12) {
              hours = 0;
            }
          }
          const formattedTime = `${String(hours).padStart(2, "0")}:${mins}`;
          return { date: formattedDate, time: formattedTime };
        }
      }
    }

    const d = new Date(dateTimeStr);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const hours = String(d.getHours()).padStart(2, "0");
      const mins = String(d.getMinutes()).padStart(2, "0");
      return { date: `${y}-${m}-${day}`, time: `${hours}:${mins}` };
    }
  } catch (e) {
    console.error("Error parsing date-time string:", dateTimeStr, e);
  }
  return { date: "", time: "" };
};

const combineDateAndTime = (dateValue, timeValue) => {
  if (!dateValue) return "";
  if (!timeValue) timeValue = "00:00";
  const [y, m, d] = dateValue.split("-").map(Number);
  const [h, min] = timeValue.split(":").map(Number);
  const dateObj = new Date(y, m - 1, d, h, min);
  return dateObj.toISOString();
};

const getProductId = (product) =>
  product?.productId ??
  product?.ProductID ??
  product?.id ??
  product?._id ??
  product?.tableId ??
  "";

const isOutOfStock = (product) => {
  const status = String(
    product?.status ??
    product?.availability ??
    product?.stockStatus ??
    product?.inventoryStatus ??
    ""
  ).toLowerCase();

  const quantityRaw =
    product?.quantity ??
    product?.stock ??
    product?.availableStock ??
    product?.inventory ??
    product?.totalStock;

  const hasQuantity = quantityRaw !== undefined && quantityRaw !== null && quantityRaw !== "";
  const quantity = Number(quantityRaw);

  return (
    status.includes("out of stock") ||
    status.includes("out_of_stock") ||
    status.includes("outofstock") ||
    (hasQuantity && Number.isFinite(quantity) && quantity <= 0)
  );
};

const isCampaignProduct = (product) => {
  return Boolean(
    product?.isInCampaign ||
    product?.alreadyInCampaign ||
    product?.campaignId ||
    product?.campaignID ||
    product?.currentCampaignId
  );
};

const getProductName = (p) => p?.productName ?? p?.name ?? p?.title ?? p?.ProductName ?? "Unnamed Product";
const getProductPrice = (p) => p?.price ?? p?.sellingPrice ?? p?.mrp ?? p?.finalPrice ?? 0;
const getProductImage = (p) => p?.image ?? p?.imageUrl ?? p?.productImage ?? p?.media?.[0]?.url ?? p?.mainmedia ?? p?.thumbnail ?? "";
const getProductSku = (p) => p?.sku ?? p?.SKU ?? "N/A";

const getVisibilityInfo = (count) => {
  if (count >= 1 && count <= 5) {
    return {
      label: "Good Visibility",
      message: "Ads will rank in bottom 40% of similar catalogs",
      color: "#10b981",
      percent: 40
    };
  }
  if (count >= 6 && count <= 8) {
    return {
      label: "Low Visibility",
      message: "Ads will rank in bottom 70% of similar catalogs",
      color: "#f59e0b",
      percent: 70
    };
  }
  if (count >= 9) {
    return {
      label: "Very Low Visibility",
      message: "Ads will rank in bottom 90% of similar catalogs",
      color: "#ef4444",
      percent: 90
    };
  }
  return null;
};

const CreateCampaignPage = () => {
  const location = useLocation();
  const editCampaign = location.state?.editCampaign;
  const isEditMode = Boolean(editCampaign);

  const sellerId = resolveSellerId();
  const navigate = useNavigate();

  // Wizard Step State
  const [step, setStep] = useState(1); // 1: Details, 2: Choose Products

  // States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);

  // --- Step 1 Form Fields ---
  const [campaignType, setCampaignType] = useState(editCampaign?.campaignType || "Smart");
  const [campaignName, setCampaignName] = useState(editCampaign?.title || editCampaign?.campaignName || "");

  // Start Date / Time
  const [startDate, setStartDate] = useState(() => {
    if (editCampaign?.startDateTime) {
      return parseDateTime(editCampaign.startDateTime).date;
    }
    return new Date().toISOString().split("T")[0];
  });
  const [startTime, setStartTime] = useState(() => {
    if (editCampaign?.startDateTime) {
      return parseDateTime(editCampaign.startDateTime).time;
    }
    return "09:00";
  });

  // End Date / Time
  const [hasEndDate, setHasEndDate] = useState(() => {
    if (isEditMode) {
      return Boolean(editCampaign?.endDateTime);
    }
    return true;
  });
  const [endDate, setEndDate] = useState(() => {
    if (editCampaign?.endDateTime) {
      return parseDateTime(editCampaign.endDateTime).date;
    }
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split("T")[0];
  });
  const [endTime, setEndTime] = useState(() => {
    if (editCampaign?.endDateTime) {
      return parseDateTime(editCampaign.endDateTime).time;
    }
    return "22:00";
  });

  const [cpcGoal, setCpcGoal] = useState(() => {
    if (isEditMode) {
      return editCampaign?.cpcGoal !== undefined && editCampaign?.cpcGoal !== null ? String(editCampaign.cpcGoal) : "";
    }
    return "5";
  });

  const [selectedBudgetMode, setSelectedBudgetMode] = useState(() => {
    if (isEditMode && editCampaign?.dailyBudget !== undefined) {
      const bStr = String(editCampaign.dailyBudget);
      if (["250", "550", "700"].includes(bStr)) {
        return "preset";
      }
      return "manual";
    }
    return "preset";
  });
  const [selectedBudgetOption, setSelectedBudgetOption] = useState(() => {
    if (isEditMode && editCampaign?.dailyBudget !== undefined) {
      const bStr = String(editCampaign.dailyBudget);
      if (["250", "550", "700"].includes(bStr)) {
        return bStr;
      }
    }
    return "250";
  });
  const [manualBudget, setManualBudget] = useState(() => {
    if (isEditMode && editCampaign?.dailyBudget !== undefined) {
      const bStr = String(editCampaign.dailyBudget);
      if (!["250", "550", "700"].includes(bStr)) {
        return bStr;
      }
    }
    return "";
  });

  // Daily Budget resolver
  const dailyBudget = useMemo(() => {
    if (selectedBudgetMode === "preset") {
      return Number(selectedBudgetOption);
    }
    return Number(manualBudget);
  }, [selectedBudgetMode, selectedBudgetOption, manualBudget]);

  // --- Step 2 Products Selection ---
  const [products, setProducts] = useState([]);
  const [currentCampaignProducts, setCurrentCampaignProducts] = useState([]); // Products belonging to current campaign being edited
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);

  // --- Add Funds Modal States ---
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [addFundsAmount, setAddFundsAmount] = useState("");
  const [razorpayLoading, setRazorpayLoading] = useState(false);
  const [addingFunds, setAddingFunds] = useState(false);
  const [walletError, setWalletError] = useState(null);
  const [walletSuccessMessage, setWalletSuccessMessage] = useState(null);
  const [sellerProfile, setSellerProfile] = useState(null);

  // Validation state
  const [validationErrors, setValidationErrors] = useState({});

  // Toast
  const [toast, setToast] = useState(null);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  // Form state logger for Part F debug logs
  const formState = useMemo(() => ({
    campaignName,
    startDate,
    startTime,
    hasEndDate,
    endDate,
    endTime,
    cpcGoal,
    selectedBudgetMode,
    selectedBudgetOption,
    manualBudget,
    dailyBudget
  }), [campaignName, startDate, startTime, hasEndDate, endDate, endTime, cpcGoal, selectedBudgetMode, selectedBudgetOption, manualBudget, dailyBudget]);

  useEffect(() => {
    console.log("[CampaignEdit] form state:", formState);
  }, [formState]);

  // Selected product IDs logger for Part F debug logs
  const selectedProductIdsArray = selectedProductIds;
  useEffect(() => {
    console.log("[CampaignProductsEdit] selected product IDs:", selectedProductIdsArray);
  }, [selectedProductIdsArray]);

  // Fetch profile for Razorpay prefill
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const email =
          localStorage.getItem("userEmail") ||
          sessionStorage.getItem("userEmail") ||
          "";

        if (!email) return;

        const profile = await sellerService.getUserProfile(email);
        if (profile?.status === "success" || profile?.message) {
          setSellerProfile(profile.message);
        }
      } catch (err) {
        console.warn("[CreateCampaignPage] Profile load failed:", err);
      }
    };

    fetchProfile();
  }, []);

  // Load Wallet Balance & Set Default Campaign Name or Load Edit Data
  const loadInitialData = useCallback(async () => {
    if (!sellerId) {
      setError("Seller session not found. Please login again.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Wallet balance fetch
      const balanceResponse = await checkWalletBalance(sellerId);
      console.log("[CampaignEdit] wallet balance response:", balanceResponse);
      
      const balance = balanceResponse?.data?.RemainingBalance || balanceResponse?.message?.RemainingBalance || balanceResponse?.RemainingBalance || 0;
      setWalletBalance(Number(balance));

      if (isEditMode) {
        console.log("[CampaignEdit] initial campaign:", editCampaign);
        console.log("[Advertisement] Selected Campaign", editCampaign);
        
        // Fetch current campaign products
        const campaignId = editCampaign.campaignId;
        const campaignProductsResponse = await advertisementService.getCampaignProducts({ campaignId });
        console.log("[CampaignProductsEdit] campaign products response:", campaignProductsResponse);
        
        const prods = (typeof extractCampaignProducts === "function" ? extractCampaignProducts(campaignProductsResponse) : null) || campaignProductsResponse?.products || campaignProductsResponse?.message?.products || [];
        setCurrentCampaignProducts(prods);

        // Pre-select all current campaign products
        const prodIds = Array.isArray(prods) ? prods.map(getProductId).filter(Boolean) : [];
        setSelectedProductIds(prodIds);
        setSelectedProducts(Array.isArray(prods) ? prods : []);
      } else {
        // Generate default campaign name
        const defaultName = `New Smart Campaign ${getFormattedDateTime()}`;
        setCampaignName(defaultName);
      }
    } catch (err) {
      console.warn("Failed fetching wallet details, defaulting balance to 0:", err);
      setWalletBalance(0);
      if (!isEditMode) {
        setCampaignName(`New Smart Campaign ${getFormattedDateTime()}`);
      }
    } finally {
      setLoading(false);
    }
  }, [sellerId, isEditMode, editCampaign]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Load Products for Step 2
  const loadProducts = useCallback(async () => {
    if (!sellerId || step !== 2) return;
    setProductsLoading(true);
    setProductsError(null);

    const page = 1;
    const limit = 30;
    const search = searchText;

    try {
      const sellerProductsResponse = advertisementService.getSellerCampaignProducts
        ? await advertisementService.getSellerCampaignProducts({ sellerId, page, limit, search })
        : await advertisementService.fetchSellerCampaignProduct(sellerId, page, search);

      console.log("[CampaignProductsEdit] seller products response:", sellerProductsResponse);

      const parsedProducts = extractSellerCampaignProducts(sellerProductsResponse);
      setProducts(parsedProducts);
    } catch (err) {
      console.error("[CreateCampaignPage] Products fetch failed:", err);
      setProductsError("Unable to load products. Please check connection.");
      showToast("Error loading products", "error");
    } finally {
      setProductsLoading(false);
    }
  }, [sellerId, step, searchText]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Group products into Campaign Groups and Available Products
  const { campaignGroups, availableProducts } = useMemo(() => {
    const groups = {};
    const avail = [];

    products.forEach((p) => {
      if (isCampaignProduct(p)) {
        const cid = p.campaignId || p.campaignID || p.currentCampaignId || "Active Campaign";
        if (isEditMode && String(cid) === String(editCampaign?.campaignId)) {
          return;
        }
        if (!groups[cid]) {
          groups[cid] = [];
        }
        groups[cid].push(p);
      } else {
        if (!isOutOfStock(p)) {
          avail.push(p);
        }
      }
    });

    return { campaignGroups: groups, availableProducts: avail };
  }, [products, isEditMode, editCampaign]);

  // Filter available products to exclude current campaign products
  const filteredAvailableProducts = useMemo(() => {
    const currentCampaignIds = new Set((currentCampaignProducts || []).map(getProductId).filter(Boolean));
    return (availableProducts || []).filter(p => !currentCampaignIds.has(getProductId(p)));
  }, [availableProducts, currentCampaignProducts]);

  const visibilityInfo = useMemo(() => {
    const info = getVisibilityInfo(selectedProductIds.length);
    console.log("[Advertisement] Selected Products Count:", selectedProductIds.length);
    console.log("[Advertisement] Visibility Info:", info);
    return info;
  }, [selectedProductIds.length]);

  // Validations for Step 1
  const validateStep1 = () => {
    const errors = {};
    if (!campaignName.trim()) {
      errors.name = "Campaign name is required.";
    } else if (campaignName.length > 40) {
      errors.name = "Campaign name cannot exceed 40 characters.";
    }

    if (!startDate) errors.startDate = "Start date is required.";
    if (!startTime) errors.startTime = "Start time is required.";

    if (selectedBudgetMode === "manual") {
      if (!manualBudget) {
        errors.budget = "Daily budget is required.";
      } else {
        const num = Number(manualBudget);
        if (isNaN(num) || num <= 0) {
          errors.budget = "Daily budget must be a number greater than 0.";
        }
      }
    } else {
      if (!selectedBudgetOption) {
        errors.budget = "Please select a budget option.";
      }
    }

    // Validate that End Date exists
    if (hasEndDate) {
      if (!endDate) {
        errors.endDate = "End date is required.";
      } else {
        const start = new Date(`${startDate}T${startTime}`);
        const end = new Date(`${endDate}T${endTime}`);
        if (end < start) {
          errors.endDate = "End date cannot be before start date.";
        }
      }
    }

    // Validate that CPC Goal exists and is > 0 only if entered
    if (cpcGoal) {
      const cpcNum = Number(cpcGoal);
      if (isNaN(cpcNum) || cpcNum <= 0) {
        errors.cpcGoal = "CPC Goal must be a number greater than 0.";
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Continue Handler (Proceed to Step 2)
  const handleContinue = (e) => {
    e.preventDefault();
    if (validateStep1()) {
      setStep(2);
    } else {
      showToast("Please correct the validation errors.", "error");
    }
  };

  // Razorpay payment integration helpers
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

  const isPublicHttpsImageUrl = (url) => {
    if (!url || typeof url !== "string") return false;
    const trimmed = url.trim();
    if (!trimmed.startsWith("https://")) return false;

    try {
      const parsed = new URL(trimmed);
      const host = parsed.hostname.toLowerCase();
      if (parsed.protocol !== "https:") return false;
      return !(
        host === "localhost" ||
        host === "127.0.0.1" ||
        host === "::1" ||
        host === "0.0.0.0" ||
        host.startsWith("192.168.") ||
        host.startsWith("10.") ||
        host.startsWith("172.") ||
        host.endsWith(".localhost") ||
        host.endsWith(".local") ||
        host.endsWith(".internal")
      );
    } catch {
      return false;
    }
  };

  const handleProceedPayment = async (e) => {
    e.preventDefault();

    const amountVal = Number(addFundsAmount);

    if (!sellerId) {
      setWalletError("Seller session not found. Please login again.");
      return;
    }

    if (!Number.isFinite(amountVal) || amountVal <= 0) {
      setWalletError("Please enter a valid amount greater than 0");
      return;
    }

    setRazorpayLoading(true);
    setWalletError(null);

    try {
      const createOrderPayload = {
        sellerId,
        amount: Number(amountVal)
      };

      console.log("[CreateCampaignPage] Create Razorpay Order Payload", createOrderPayload);

      const createOrderRes = await sellerService.createRazorpayOrder(createOrderPayload);

      console.log("[CreateCampaignPage] Create Razorpay Order Response", createOrderRes);

      const rzpOrderId =
        createOrderRes?.orderId ||
        createOrderRes?.order_id ||
        createOrderRes?.id ||
        createOrderRes?.razorpayOrderId ||
        createOrderRes?.data?.orderId ||
        createOrderRes?.data?.order_id ||
        createOrderRes?.data?.id ||
        createOrderRes?.message?.order?.id ||
        createOrderRes?.message?.order?.orderId ||
        createOrderRes?.message?.order?.order_id ||
        createOrderRes?.message?.orderId ||
        createOrderRes?.message?.order_id ||
        createOrderRes?.message?.id;

      if (!rzpOrderId) {
        throw new Error("Payment order creation failed. Please try again.");
      }

      const rzpAmount =
        createOrderRes?.amount ||
        createOrderRes?.amount_due ||
        createOrderRes?.message?.order?.amount ||
        createOrderRes?.message?.amount ||
        amountVal * 100;

      const rzpCurrency =
        createOrderRes?.currency ||
        createOrderRes?.message?.order?.currency ||
        "INR";

      const rzpKey =
        createOrderRes?.key ||
        createOrderRes?.razorpayKey ||
        createOrderRes?.message?.keyId ||
        createOrderRes?.message?.key ||
        createOrderRes?.message?.razorpayKey;

      if (!rzpKey) {
        throw new Error("Razorpay key missing from create order response.");
      }

      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error("Razorpay SDK failed to load. Please check your network connection.");
      }

      const rawImage =
        createOrderRes?.image ||
        createOrderRes?.logo ||
        createOrderRes?.message?.image ||
        createOrderRes?.message?.logo ||
        createOrderRes?.message?.order?.image ||
        createOrderRes?.message?.order?.logo ||
        null;

      const rzpImage = isPublicHttpsImageUrl(rawImage)
        ? rawImage.trim()
        : undefined;

      setRazorpayLoading(false);

      const options = {
        key: rzpKey,
        amount: rzpAmount,
        currency: rzpCurrency,
        name: "Haatza India Private Limited",
        description: "Add Funds to Wallet",
        order_id: rzpOrderId,
        ...(rzpImage ? { image: rzpImage } : {}),
        prefill: {
          name: sellerProfile?.sellerName || "Seller",
          email:
            sellerProfile?.email ||
            localStorage.getItem("userEmail") ||
            sessionStorage.getItem("userEmail") ||
            "",
          contact: sellerProfile?.phone || sellerProfile?.contact || ""
        },
        theme: {
          color: "#2962ff"
        },
        handler: async function (razorpayResponse) {
          setAddingFunds(true);
          setWalletError(null);

          console.log("[CreateCampaignPage] Razorpay Response", razorpayResponse);

          try {
            if (!razorpayResponse?.razorpay_payment_id) {
              throw new Error("razorpay_payment_id missing from Razorpay response.");
            }

            const verifyPayload = {
              sellerId,
              amount: Number(amountVal),
              paymentId: razorpayResponse.razorpay_payment_id,
              orderId: razorpayResponse.razorpay_order_id || rzpOrderId,
              signature: razorpayResponse.razorpay_signature
            };

            console.log("[CreateCampaignPage] Verify Payment Payload", verifyPayload);

            const verifyRes = await sellerService.verifyRazorpayPayment(verifyPayload);

            console.log("[CreateCampaignPage] Verify Payment Response", verifyRes);

            const isVerified =
              verifyRes === true ||
              (verifyRes?.status === "success" &&
               verifyRes?.message?.verified === true);

            if (!isVerified) {
              throw new Error("Payment verification failed. Wallet was not credited.");
            }

            const addFundsPayload = {
              sellerId: sellerId,
              amountAdded: Number(amountVal),
              paymentId: razorpayResponse.razorpay_payment_id
            };

            const addFundsRes = await sellerService.addFunds(addFundsPayload);

            console.log("[CreateCampaignPage] Add Funds Response", addFundsRes);

            const isSuccess =
              addFundsRes?.success === true ||
              addFundsRes?.message === "Funds added successfully!";

            if (!isSuccess) {
              throw new Error("Failed to add funds to wallet backend.");
            }

            const balanceRes = await checkWalletBalance(sellerId);
            const balance = balanceRes?.data?.RemainingBalance || balanceRes?.message?.RemainingBalance || balanceRes?.RemainingBalance || 0;
            setWalletBalance(Number(balance));

            setWalletSuccessMessage(`₹${Number(amountVal).toFixed(2)} credited to your wallet.`);
            setAddingFunds(false);

            setTimeout(() => {
              setIsWalletModalOpen(false);
              setWalletSuccessMessage(null);
              setAddFundsAmount("");
            }, 2000);
          } catch (handlerErr) {
            console.error("[CreateCampaignPage] Payment handler error:", handlerErr?.message);
            setWalletError(
              handlerErr.message ||
              "Failed to complete payment. Please contact support."
            );
            setAddingFunds(false);
          }
        },
        modal: {
          ondismiss: () => {
            setAddingFunds(false);
            setRazorpayLoading(false);
            setWalletError("Payment cancelled. Your wallet has not been charged.");
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", function (resp) {
        setAddingFunds(false);
        setRazorpayLoading(false);
        setWalletError(resp?.error?.description || "Payment failed. Please try again.");
      });

      rzp.open();
    } catch (err) {
      console.error("[CreateCampaignPage] Add funds failed:", err);
      setWalletError(err.message || "Could not complete add funds flow.");
      setRazorpayLoading(false);
      setAddingFunds(false);
    }
  };

  // Final Submit Handler (Create or Update Campaign)
  const handleFinalSubmit = async () => {
    // 1. Enforce validation checklist before calling the API
    try {
      if (!sellerId) throw new Error("sellerId must exist");
      if (!campaignName.trim()) throw new Error("campaignName must exist");
      if (!campaignType) throw new Error("campaignType must exist");
      if (!startDate) throw new Error("startDate must exist");
      if (hasEndDate && !endDate) throw new Error("endDate must exist");
      if (!dailyBudget || Number(dailyBudget) <= 0) throw new Error("dailyBudget must be > 0");
      if (cpcGoal) {
        const cpcNum = Number(cpcGoal);
        if (isNaN(cpcNum) || cpcNum <= 0) {
          throw new Error("cpcGoal must be > 0 if entered");
        }
      }
      if (!selectedProductIds || selectedProductIds.length === 0) {
        throw new Error("at least one selected product exists");
      }
    } catch (validationErr) {
      showToast(validationErr.message, "error");
      return;
    }

    setSubmitting(true);
    
    const startDateTime = combineDateAndTime(startDate, startTime);
    const endDateTime = hasEndDate ? combineDateAndTime(endDate, endTime) : null;

    if (isEditMode) {
      const payload = {
        sellerId,
        tableId: editCampaign.tableId,
        campaignId: editCampaign.campaignId,
        campaignType: "Smart",
        title: campaignName.trim(),
        startDateTime,
        endDateTime,
        dailyBudget: Number(dailyBudget),
        cpcGoal: cpcGoal ? Number(cpcGoal) : null,
        productId: selectedProductIds
      };

      console.log("[Advertisement] Update Payload", payload);
      console.log("[CampaignReview] update payload:", payload);

      try {
        const response = await sellerService.updateSellerCampaign(payload);
        console.log("[Advertisement] Update Response", response);
        console.log("[CampaignReview] update response:", response);

        const isNotFoundError = response?.status === "error" && String(response?.message || response?.data?.message || "").includes("Campaign not found for given ID");

        if (isNotFoundError || response?.status === "error") {
          if (isNotFoundError) {
            console.log("[Advertisement] Campaign not found for given ID. sellerId:", sellerId, "tableId:", editCampaign.tableId, "campaignId:", editCampaign.campaignId);
          }
          throw new Error(response.message || "Failed to update campaign.");
        }

        showToast("Campaign updated successfully!");
        setTimeout(() => {
          navigate("/advertisement");
        }, 1500);
      } catch (err) {
        console.error("[CreateCampaignPage] Update failed:", err);
        const msg = err.response?.data?.message || err.message || "Failed to update campaign.";
        if (String(msg).includes("Campaign not found for given ID")) {
          console.log("[Advertisement] Campaign not found for given ID. sellerId:", sellerId, "tableId:", editCampaign.tableId, "campaignId:", editCampaign.campaignId);
        }
        showToast(msg, "error");
      } finally {
        setSubmitting(false);
      }
    } else {
      const payload = {
        sellerId,
        campaignName: campaignName.trim(),
        campaignType: "Smart",
        startDate,
        startTime,
        endDate,
        endTime,
        cpcGoal: cpcGoal ? Number(cpcGoal) : null,
        dailyBudget: Number(dailyBudget),
        selectedProducts: selectedProductIds,
        products: selectedProductIds.map(id => ({ productId: id })),
        status: "Active"
      };

      console.log("[Advertisement] New Campaign Payload:", payload);

      try {
        const response = advertisementService.createSellerCampaign
          ? await advertisementService.createSellerCampaign(payload)
          : await advertisementService.createCampaign(payload);

        console.log("[Advertisement] New Campaign Response:", response);

        showToast("Campaign created successfully!");
        setTimeout(() => {
          navigate("/advertisement");
        }, 1500);
      } catch (err) {
        console.error("[CreateCampaignPage] Submission failed:", err);
        const msg = err.response?.data?.message || err.message || "Failed to create campaign.";
        showToast(msg, "error");
      } finally {
        setSubmitting(false);
      }
    }
  };

  // Handle Select All Checkbox
  const handleSelectAllChange = (e) => {
    if (e.target.checked) {
      const allIds = availableProducts.map(getProductId).filter(Boolean);
      setSelectedProductIds(allIds);
      setSelectedProducts([...availableProducts]);
    } else {
      setSelectedProductIds([]);
      setSelectedProducts([]);
    }
  };

  // Handle Individual Product Checkbox
  const handleProductSelectChange = (product, isChecked) => {
    const productId = getProductId(product);
    if (isChecked) {
      setSelectedProductIds(prev => {
        if (prev.includes(productId)) return prev;
        return [...prev, productId];
      });
      setSelectedProducts(prev => {
        if (prev.some(p => getProductId(p) === productId)) return prev;
        return [...prev, product];
      });
    } else {
      setSelectedProductIds(prev => prev.filter(id => id !== productId));
      setSelectedProducts(prev => prev.filter(p => getProductId(p) !== productId));
    }
  };

  const handleProceedToReview = () => {
    const reviewData = {
      campaignName,
      campaignType,
      dailyBudget,
      startDate,
      startTime,
      endDate,
      endTime,
      cpcGoal: cpcGoal ? Number(cpcGoal) : null,
      selectedProducts
    };
    console.log("[Advertisement] Review Campaign Data:", reviewData);
    setStep(3);
  };

  // Render Skeleton Loader
  const renderSkeletons = () => (
    <div className="cc-skeleton-layout">
      <div className="skeleton-form-card skeleton-pulse" style={{ height: "400px", borderRadius: "14px", background: "#cbd5e1" }} />
    </div>
  );

  return (
    <div className="cc-page-root">
      {toast && (
        <div className={`cc-toast-banner ${toast.type}`}>
          <AlertCircle size={18} />
          <span>{toast.message}</span>
        </div>
      )}

      {/* Breadcrumbs and Header Area */}
      <div className="cc-page-header">
        <div className="cc-header-left">
          <button className="back-arrow-btn" onClick={() => {
            if (step === 3) {
              setStep(2);
            } else if (step === 2) {
              setStep(1);
            } else {
              navigate("/advertisement");
            }
          }} aria-label="Go Back">
            <ChevronLeft size={24} />
          </button>
          <div>
            <nav className="cc-breadcrumb">
              <span>Advertisement</span> &gt; <span className="active">{isEditMode ? "Edit Campaign" : "New Campaign"}</span>
            </nav>
            <h1 className="cc-page-title">
              {step === 1 ? (isEditMode ? "Edit Campaign" : "Create New Campaign") : step === 2 ? "Choose the Products" : "Review Campaign"}
            </h1>
          </div>
        </div>
        <div className="cc-header-right">
          <button className="nav-icon-btn" onClick={() => navigate("/wallet")} aria-label="Wallet">
            <Wallet size={20} />
          </button>
          <button className="nav-icon-btn" onClick={() => navigate("/notifications")} aria-label="Notifications">
            <Bell size={20} />
          </button>
        </div>
      </div>

      {loading ? (
        renderSkeletons()
      ) : error ? (
        <div className="cc-error-container">
          <div className="cc-error-card">
            <AlertCircle size={48} className="error-icon" />
            <h3>Configuration Error</h3>
            <p>{error}</p>
            <button className="btn-retry-sync" onClick={loadInitialData}>
              <RefreshCw size={16} />
              <span>Retry Load</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="cc-form-layout">
          {step === 1 ? (
            /* =================================================================
               STEP 1: Campaign Details Form
               ================================================================= */
            <form onSubmit={handleContinue} className="cc-grid-main">
              <div className="cc-fields-card">
                {/* 1. Select Campaign Type */}
                <div className="form-group-section">
                  <label className="section-label-main">Campaign Type</label>
                  <div className="type-selection-cards">
                    {/* Smart Campaign */}
                    <div
                      className={`type-card ${campaignType === "Smart" ? "selected" : ""}`}
                      onClick={() => setCampaignType("Smart")}
                    >
                      <div className="type-card-header">
                        <span className="type-title">Smart Campaign</span>
                        <div className="type-badges">
                          <span className="badge-recommended">Recommended</span>
                        </div>
                      </div>
                      <p className="type-description">
                        You choose the Products manually, and we optimize the performance.
                      </p>
                      {campaignType === "Smart" && (
                        <div className="selected-check-bubble">
                          <Check size={14} />
                        </div>
                      )}
                    </div>

                    {/* Manual Campaign (Disabled) */}
                    <div className="type-card unavailable">
                      <div className="type-card-header">
                        <span className="type-title" style={{ color: "#94a3b8" }}>Manual Campaign</span>
                        <div className="type-badges">
                          <span className="badge-unavailable">Currently unavailable</span>
                        </div>
                      </div>
                      <p className="type-description">
                        Define budgets and bid strategies at product level manually.
                      </p>
                    </div>
                  </div>
                </div>

                {/* 2. Campaign Name */}
                <div className="form-group-section">
                  <label className="section-label-main">Campaign Name</label>
                  <div className="input-with-counter">
                    <input
                      type="text"
                      placeholder="Enter campaign name"
                      value={campaignName}
                      onChange={(e) => {
                        setCampaignName(e.target.value);
                        if (validationErrors.name) {
                          setValidationErrors(prev => ({ ...prev, name: null }));
                        }
                      }}
                      className={`text-input ${validationErrors.name ? "error" : ""}`}
                      maxLength={40}
                    />
                    <span className="char-counter">{campaignName.length}/40</span>
                  </div>
                  {validationErrors.name && <span className="field-error-text">{validationErrors.name}</span>}
                </div>

                {/* Smart Campaign Bullet points list */}
                <div className="smart-campaign-info-section" style={{ background: "#f8fafc", padding: "20px", borderRadius: "10px", marginBottom: "28px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "600", color: "#1e293b" }}>
                      <Check size={16} className="text-success" style={{ color: "#10b981" }} />
                      <span>Sellers with Smart Campaign get 20% higher orders</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "600", color: "#1e293b" }}>
                      <Check size={16} className="text-success" style={{ color: "#10b981" }} />
                      <span>10,000+ Sellers have created Smart Campaign</span>
                    </div>
                  </div>

                  <h4 style={{ margin: "0 0 10px 0", fontSize: "14px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px", color: "#475569" }}>Catalogs</h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <div style={{ display: "flex", gap: "12px" }}>
                      <Package size={20} style={{ color: "#2962ff", flexShrink: 0 }} />
                      <div>
                        <div style={{ fontWeight: "700", fontSize: "13.5px", color: "#1e293b" }}>Automatically selects catalogs customers love</div>
                        <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>Catalogs will be visible after creation</div>
                        <div style={{ fontSize: "12px", color: "#10b981", fontWeight: "600", marginTop: "2px" }}>Pause catalogs anytime</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                      <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#f0f4ff", color: "#2962ff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", fontSize: "12px" }}>🔄</div>
                      <div>
                        <div style={{ fontWeight: "700", fontSize: "13.5px", color: "#1e293b" }}>Pauses poor performing catalogs to give better ROI</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                      <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#f0f4ff", color: "#2962ff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", fontSize: "12px" }}>📈</div>
                      <div>
                        <div style={{ fontWeight: "700", fontSize: "13.5px", color: "#1e293b" }}>Bids smartly to get more clicks than competitors</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Duration selectors */}
                <div className="form-group-section">
                  <label className="section-label-main">Select Duration</label>
                  <div className="duration-inputs-row">
                    <div className="date-time-box">
                      <span className="sub-label">Start Date</span>
                      <div className="icon-input-wrap">
                        <Calendar size={16} className="input-icon" />
                        <input
                          type="date"
                          value={startDate}
                          onChange={(e) => {
                            setStartDate(e.target.value);
                            if (validationErrors.startDate) {
                              setValidationErrors(prev => ({ ...prev, startDate: null }));
                            }
                          }}
                          className={`date-input ${validationErrors.startDate ? "error" : ""}`}
                        />
                      </div>
                    </div>
                    <div className="date-time-box">
                      <span className="sub-label">Start Time</span>
                      <div className="icon-input-wrap">
                        <Clock size={16} className="input-icon" />
                        <input
                          type="time"
                          value={startTime}
                          onChange={(e) => {
                            setStartTime(e.target.value);
                            if (validationErrors.startTime) {
                              setValidationErrors(prev => ({ ...prev, startTime: null }));
                            }
                          }}
                          className={`date-input ${validationErrors.startTime ? "error" : ""}`}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="checkbox-wrap" style={{ margin: "14px 0" }}>
                    <input
                      type="checkbox"
                      id="setEndDateCheckbox"
                      checked={hasEndDate}
                      onChange={(e) => {
                        setHasEndDate(e.target.checked);
                        if (e.target.checked && !endDate) {
                          setEndDate(startDate);
                        }
                        setValidationErrors(prev => ({ ...prev, endDate: null }));
                      }}
                    />
                    <label htmlFor="setEndDateCheckbox">Set an End Date</label>
                  </div>

                  {hasEndDate && (
                    <div className="duration-inputs-row ending-row">
                      <div className="date-time-box">
                        <span className="sub-label">End Date</span>
                        <div className="icon-input-wrap">
                          <Calendar size={16} className="input-icon" />
                          <input
                            type="date"
                            value={endDate}
                            onChange={(e) => {
                              setEndDate(e.target.value);
                              setValidationErrors(prev => ({ ...prev, endDate: null }));
                            }}
                            className={`date-input ${validationErrors.endDate ? "error" : ""}`}
                          />
                        </div>
                      </div>
                      <div className="date-time-box">
                        <span className="sub-label">End Time</span>
                        <div className="icon-input-wrap">
                          <Clock size={16} className="input-icon" />
                          <input
                            type="time"
                            value={endTime}
                            onChange={(e) => setEndTime(e.target.value)}
                            className="date-input"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  {validationErrors.endDate && <span className="field-error-text">{validationErrors.endDate}</span>}
                </div>

                {/* 4. CPC Goal */}
                <div className="form-group-section">
                  <div className="label-with-tip">
                    <label className="section-label-main">CPC Goal (Optional)</label>
                    <span className="field-tip">Set your target cost per click.</span>
                  </div>
                  <div className="cpc-input-wrapper">
                    <span className="currency-prefix">₹</span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Set your target cost per click."
                      value={cpcGoal}
                      onChange={(e) => setCpcGoal(e.target.value)}
                      className="cpc-input"
                    />
                  </div>
                  <p className="cpc-instructions">
                    Haatza will aim to get more clicks at or below this amount. Leave blank for maximum reach.
                  </p>
                  {validationErrors.cpcGoal && <span className="field-error-text">{validationErrors.cpcGoal}</span>}
                </div>

                {/* 5. Daily Budget selector */}
                <div className="form-group-section">
                  <label className="section-label-main">Daily Budget</label>
                  <div className="budget-modes-selectors">
                    {/* Mode A: Preset option selection */}
                    <div
                      className={`budget-mode-card ${selectedBudgetMode === "preset" ? "active" : ""}`}
                      onClick={() => {
                        setSelectedBudgetMode("preset");
                        if (validationErrors.budget) {
                          setValidationErrors(prev => ({ ...prev, budget: null }));
                        }
                      }}
                    >
                      <div className="radio-check-row">
                        <div className={`radio-circle ${selectedBudgetMode === "preset" ? "checked" : ""}`}>
                          {selectedBudgetMode === "preset" && <div className="radio-dot" />}
                        </div>
                        <span>Select a budget option</span>
                      </div>

                      <div className="preset-budget-options">
                        {["250", "550", "700"].map((opt) => {
                          const isPresetSelected = selectedBudgetOption === opt && selectedBudgetMode === "preset";
                          return (
                            <button
                              key={opt}
                              type="button"
                              className={`preset-btn ${isPresetSelected ? "selected" : ""}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedBudgetMode("preset");
                                setSelectedBudgetOption(opt);
                                setManualBudget("");
                                if (validationErrors.budget) {
                                  setValidationErrors(prev => ({ ...prev, budget: null }));
                                }
                              }}
                            >
                              {isPresetSelected && <Check size={12} className="check-icon" />}
                              <span>₹{opt}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Mode B: Manual selection */}
                    <div
                      className={`budget-mode-card ${selectedBudgetMode === "manual" ? "active" : ""}`}
                      onClick={() => {
                        setSelectedBudgetMode("manual");
                        if (validationErrors.budget) {
                          setValidationErrors(prev => ({ ...prev, budget: null }));
                        }
                      }}
                    >
                      <div className="radio-check-row">
                        <div className={`radio-circle ${selectedBudgetMode === "manual" ? "checked" : ""}`}>
                          {selectedBudgetMode === "manual" && <div className="radio-dot" />}
                        </div>
                        <span>Select budget manually</span>
                      </div>

                      {selectedBudgetMode === "manual" && (
                        <div className="manual-budget-input-wrap">
                          <span className="currency-prefix">₹</span>
                          <input
                            type="number"
                            placeholder="Enter daily limit"
                            value={manualBudget}
                            onChange={(e) => {
                              setManualBudget(e.target.value);
                              if (validationErrors.budget) {
                                  setValidationErrors(prev => ({ ...prev, budget: null }));
                              }
                            }}
                            className="manual-input"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  {validationErrors.budget && <span className="field-error-text">{validationErrors.budget}</span>}
                  <p className="cpc-instructions warning-note" style={{ marginTop: "14px" }}>
                    Your catalogs lose over 10k+ customer searches as daily budget gets over.
                  </p>
                </div>
              </div>

              {/* Right Summary Sidebar Panel */}
              <div className="cc-summary-card">
                <h3>Campaign Launch Control</h3>
                
                <div className="summary-details-list">
                  <div className="summary-item">
                    <span className="sum-label">Campaign Type:</span>
                    <span className="sum-val">{campaignType} Campaign</span>
                  </div>
                  <div className="summary-item">
                    <span className="sum-label">Daily Budget:</span>
                    <span className="sum-val text-primary">₹{dailyBudget}</span>
                  </div>
                  <div className="summary-item">
                    <span className="sum-label">Duration:</span>
                    <span className="sum-val">
                      {startDate} {hasEndDate ? `to ${endDate}` : "(Ongoing)"}
                    </span>
                  </div>
                </div>

                <div className="wallet-balance-callout">
                  <div className="balance-labels">
                    <span className="lbl">Current Balance</span>
                    <span className="val">₹{walletBalance.toFixed(2)}</span>
                  </div>
                  <button
                    type="button"
                    className="btn-add-funds-cc"
                    onClick={() => {
                      setAddFundsAmount("");
                      setWalletSuccessMessage(null);
                      setWalletError(null);
                      setAddingFunds(false);
                      setRazorpayLoading(false);
                      setIsWalletModalOpen(true);
                    }}
                  >
                    <Plus size={14} />
                    <span>Add Funds</span>
                  </button>
                </div>

                <button type="submit" className="btn-launch-campaign">
                  <span>Continue</span>
                </button>
              </div>
            </form>
          ) : step === 2 ? (
            /* =================================================================
               STEP 2: Choose Products
               ================================================================= */
            <div className="cc-grid-main" style={{ gridTemplateColumns: "1fr 340px" }}>
              <div className="cc-fields-card">
                {/* Search Bar top row */}
                <div className="product-search-wrapper" style={{ marginBottom: "20px" }}>
                  <Search size={16} className="search-icon" />
                  <input
                    type="text"
                    placeholder="Search by Product Name"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    className="search-product-input"
                  />
                </div>

                {productsLoading ? (
                  <div style={{ textAlign: "center", padding: "40px" }}>
                    <RefreshCw size={32} className="spinner-icon" style={{ color: "#2962ff" }} />
                    <p style={{ marginTop: "12px", color: "#64748b" }}>Loading products catalog...</p>
                  </div>
                ) : productsError ? (
                  <div style={{ textAlign: "center", padding: "40px", color: "#ef4444" }}>
                    <AlertCircle size={32} />
                    <p style={{ marginTop: "12px" }}>{productsError}</p>
                    <button className="preset-btn" style={{ margin: "10px auto 0" }} onClick={loadProducts}>
                      Retry fetch
                    </button>
                  </div>
                ) : (products.length === 0 && currentCampaignProducts.length === 0) ? (
                  <div style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
                    <Package size={32} />
                    <p style={{ marginTop: "12px" }}>No products found in inventory.</p>
                  </div>
                ) : (
                  <>
                    {/* Section 1: Products already in this campaign (Editable) */}
                    {isEditMode && currentCampaignProducts.length > 0 && (
                      <div className="campaign-group-section" style={{ marginBottom: "28px" }}>
                        <h3 className="section-label-main" style={{ fontSize: "15px", fontWeight: "700", color: "#475569", marginBottom: "12px", borderBottom: "1px solid #e2e8f0", paddingBottom: "6px" }}>
                          Campaign ID: {editCampaign.campaignId}
                        </h3>
                        <div className="table-wrapper-horizontal">
                          <table className="campaigns-desktop-table products-selection-table">
                            <thead>
                              <tr>
                                <th style={{ width: "40px" }}>
                                  <input
                                    type="checkbox"
                                    checked={currentCampaignProducts.length > 0 && currentCampaignProducts.every(p => selectedProductIds.includes(getProductId(p)))}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        const currentIds = currentCampaignProducts.map(getProductId).filter(Boolean);
                                        setSelectedProductIds(prev => Array.from(new Set([...prev, ...currentIds])));
                                        setSelectedProducts(prev => {
                                          const next = [...prev];
                                          currentCampaignProducts.forEach(p => {
                                            if (!next.some(x => getProductId(x) === getProductId(p))) {
                                              next.push(p);
                                            }
                                          });
                                          return next;
                                        });
                                      } else {
                                        const currentIds = currentCampaignProducts.map(getProductId).filter(Boolean);
                                        setSelectedProductIds(prev => prev.filter(id => !currentIds.includes(id)));
                                        setSelectedProducts(prev => prev.filter(p => !currentIds.includes(getProductId(p))));
                                      }
                                    }}
                                    style={{ width: "16px", height: "16px", cursor: "pointer" }}
                                  />
                                </th>
                                <th style={{ width: "60px" }}>Image</th>
                                <th>Product Name</th>
                                <th>Price</th>
                                <th>Status / Availability</th>
                              </tr>
                            </thead>
                            <tbody>
                              {currentCampaignProducts.map((p) => {
                                const id = getProductId(p);
                                const name = getProductName(p);
                                const price = getProductPrice(p);
                                const imageUrl = resolveWixImage(getProductImage(p));
                                const sku = getProductSku(p);
                                const isChecked = selectedProductIds.includes(id);

                                return (
                                  <tr key={id} className={isChecked ? "product-row-selected" : ""}>
                                    <td>
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={(e) => handleProductSelectChange(p, e.target.checked)}
                                        style={{ width: "16px", height: "16px", cursor: "pointer" }}
                                      />
                                    </td>
                                    <td>
                                      <div className="product-img-holder" style={{ width: "40px", height: "40px" }}>
                                        {imageUrl ? (
                                          <img src={imageUrl} alt={name} />
                                        ) : (
                                          <Package size={20} className="img-placeholder" />
                                        )}
                                      </div>
                                    </td>
                                    <td>
                                      <div style={{ display: "flex", flexDirection: "column" }}>
                                        <span className="campaign-name-bold">{name}</span>
                                        <span style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>SKU: {sku}</span>
                                      </div>
                                    </td>
                                    <td>
                                      <span className="campaign-budget-value">₹{price}</span>
                                    </td>
                                    <td>
                                      <span className="status-capsule active">
                                        In Campaign
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Group 1: Products already in other campaigns (Disabled) */}
                    {Object.entries(campaignGroups).map(([cid, groupProducts]) => (
                      <div key={cid} className="campaign-group-section" style={{ marginBottom: "28px" }}>
                        <h3 className="section-label-main" style={{ fontSize: "15px", fontWeight: "700", color: "#475569", marginBottom: "12px", borderBottom: "1px solid #e2e8f0", paddingBottom: "6px" }}>
                          Campaign ID: {cid}
                        </h3>
                        <div className="table-wrapper-horizontal">
                          <table className="campaigns-desktop-table products-selection-table">
                            <thead>
                              <tr>
                                <th style={{ width: "40px" }}></th>
                                <th style={{ width: "60px" }}>Image</th>
                                <th>Product Name</th>
                                <th>Price</th>
                                <th>Status / Availability</th>
                              </tr>
                            </thead>
                            <tbody>
                              {groupProducts.map((p) => {
                                const id = getProductId(p);
                                const name = getProductName(p);
                                const price = getProductPrice(p);
                                const imageUrl = resolveWixImage(getProductImage(p));
                                const sku = getProductSku(p);

                                return (
                                  <tr key={id} className="product-row-disabled" style={{ opacity: 0.7 }}>
                                    <td>
                                      <input
                                        type="checkbox"
                                        checked={false}
                                        disabled={true}
                                        style={{ width: "16px", height: "16px", cursor: "default" }}
                                      />
                                    </td>
                                    <td>
                                      <div className="product-img-holder" style={{ width: "40px", height: "40px" }}>
                                        {imageUrl ? (
                                          <img src={imageUrl} alt={name} />
                                        ) : (
                                          <Package size={20} className="img-placeholder" />
                                        )}
                                      </div>
                                    </td>
                                    <td>
                                      <div style={{ display: "flex", flexDirection: "column" }}>
                                        <span className="campaign-name-bold">{name}</span>
                                        <span style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>SKU: {sku}</span>
                                      </div>
                                    </td>
                                    <td>
                                      <span className="campaign-budget-value">₹{price}</span>
                                    </td>
                                    <td>
                                      <span className="status-capsule inactive" style={{ background: "#f1f5f9", color: "#64748b" }}>
                                        In Campaign
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}

                    {/* Group 2: Available Products */}
                    <div className="available-products-section" style={{ marginBottom: "28px" }}>
                      <h3 className="section-label-main" style={{ fontSize: "15px", fontWeight: "700", color: "#475569", marginBottom: "12px", borderBottom: "1px solid #e2e8f0", paddingBottom: "6px" }}>
                        Available Products
                      </h3>
                      {filteredAvailableProducts.length === 0 ? (
                        <div style={{ padding: "20px", textAlign: "center", color: "#64748b", background: "#f8fafc", borderRadius: "8px" }}>
                          No available in-stock products for campaign selection.
                        </div>
                      ) : (
                        <div className="table-wrapper-horizontal">
                          <table className="campaigns-desktop-table products-selection-table">
                            <thead>
                              <tr>
                                <th style={{ width: "40px" }}>
                                  <input
                                    type="checkbox"
                                    checked={filteredAvailableProducts.length > 0 && filteredAvailableProducts.every(p => selectedProductIds.includes(getProductId(p)))}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        const availIds = filteredAvailableProducts.map(getProductId).filter(Boolean);
                                        setSelectedProductIds(prev => Array.from(new Set([...prev, ...availIds])));
                                        setSelectedProducts(prev => {
                                          const next = [...prev];
                                          filteredAvailableProducts.forEach(p => {
                                            if (!next.some(x => getProductId(x) === getProductId(p))) {
                                              next.push(p);
                                            }
                                          });
                                          return next;
                                        });
                                      } else {
                                        const availIds = filteredAvailableProducts.map(getProductId).filter(Boolean);
                                        setSelectedProductIds(prev => prev.filter(id => !availIds.includes(id)));
                                        setSelectedProducts(prev => prev.filter(p => !availIds.includes(getProductId(p))));
                                      }
                                    }}
                                    style={{ width: "16px", height: "16px", cursor: "pointer" }}
                                  />
                                </th>
                                <th style={{ width: "60px" }}>Image</th>
                                <th>Product Name</th>
                                <th>Price</th>
                                <th>Status / Availability</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredAvailableProducts.map((p) => {
                                const id = getProductId(p);
                                const name = getProductName(p);
                                const price = getProductPrice(p);
                                const imageUrl = resolveWixImage(getProductImage(p));
                                const sku = getProductSku(p);
                                const isChecked = selectedProductIds.includes(id);

                                return (
                                  <tr key={id} className={isChecked ? "product-row-selected" : ""}>
                                    <td>
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={(e) => handleProductSelectChange(p, e.target.checked)}
                                        style={{ width: "16px", height: "16px", cursor: "pointer" }}
                                      />
                                    </td>
                                    <td>
                                      <div className="product-img-holder" style={{ width: "40px", height: "40px" }}>
                                        {imageUrl ? (
                                          <img src={imageUrl} alt={name} />
                                        ) : (
                                          <Package size={20} className="img-placeholder" />
                                        )}
                                      </div>
                                    </td>
                                    <td>
                                      <div style={{ display: "flex", flexDirection: "column" }}>
                                        <span className="campaign-name-bold">{name}</span>
                                        <span style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>SKU: {sku}</span>
                                      </div>
                                    </td>
                                    <td>
                                      <span className="campaign-budget-value">₹{price}</span>
                                    </td>
                                    <td>
                                      <span className="status-capsule active">
                                        In Stock
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Visibility Card overlay inside Step 2 */}
                {visibilityInfo && selectedProductIds.length > 0 && (
                  <div className="visibility-card-overlay" style={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "12px",
                    padding: "16px",
                    marginTop: "20px",
                    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "700", color: "var(--text-main)", fontSize: "14px" }}>
                      <span style={{ color: visibilityInfo.color }}>📈 {visibilityInfo.label}</span>
                      <span style={{ color: "var(--text-muted)", fontWeight: "500" }}>• {selectedProductIds.length} products</span>
                    </div>
                    <div style={{ fontSize: "13px", color: "var(--text-main)", marginTop: "4px" }}>
                      {visibilityInfo.message}
                    </div>
                    <div style={{ height: "6px", width: "100%", background: "#f1f5f9", borderRadius: "3px", marginTop: "12px", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${visibilityInfo.percent}%`, background: visibilityInfo.color, transition: "width 0.3s ease" }} />
                    </div>
                  </div>
                )}
              </div>

              {/* Right sticky launch sidebar panel */}
              <div className="cc-summary-card">
                <h3>Launch Campaign</h3>
                
                <div className="summary-details-list">
                  <div className="summary-item">
                    <span className="sum-label">Campaign Name:</span>
                    <span className="sum-val">{campaignName}</span>
                  </div>
                  <div className="summary-item">
                    <span className="sum-label">Selected Products:</span>
                    <span className="sum-val text-primary" style={{ fontSize: "16px" }}>{selectedProductIds.length} Products</span>
                  </div>
                  <div className="summary-item">
                    <span className="sum-label">Daily Budget:</span>
                    <span className="sum-val">₹{dailyBudget}</span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
                  <button
                    type="button"
                    className="preset-btn"
                    style={{ flex: 1, justifyContent: "center", background: "#fff", border: "1px solid #cbd5e1" }}
                    onClick={() => setStep(1)}
                    disabled={submitting}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className="btn-launch-campaign"
                    style={{ flex: 2 }}
                    onClick={handleProceedToReview}
                    disabled={selectedProductIds.length === 0}
                  >
                    <span>Continue</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* =================================================================
               STEP 3: Review Campaign Page
               ================================================================= */
            <div className="cc-grid-main" style={{ gridTemplateColumns: "1fr" }}>
              <div className="cc-fields-card">
                <h3 style={{ fontSize: "18px", fontWeight: "700", color: "#1e293b", margin: "0 0 16px 0", borderBottom: "1px solid #e2e8f0", paddingBottom: "8px" }}>
                  Campaign Details
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", background: "#f8fafc", padding: "20px", borderRadius: "10px", marginBottom: "28px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#64748b", fontWeight: "500" }}>Title</span>
                    <span style={{ color: "#1e293b", fontWeight: "700", textAlign: "right" }}>{campaignName}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#64748b", fontWeight: "500" }}>Campaign Type</span>
                    <span style={{ color: "#1e293b", fontWeight: "600" }}>{campaignType}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#64748b", fontWeight: "500" }}>Daily Budget</span>
                    <span style={{ color: "#2962ff", fontWeight: "700" }}>₹{dailyBudget}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#64748b", fontWeight: "500" }}>Start Date</span>
                    <span style={{ color: "#1e293b", fontWeight: "600" }}>{startDate} {startTime}</span>
                  </div>
                  {hasEndDate && (
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#64748b", fontWeight: "500" }}>End Date</span>
                      <span style={{ color: "#1e293b", fontWeight: "600" }}>{endDate} {endTime}</span>
                    </div>
                  )}
                  {cpcGoal ? (
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#64748b", fontWeight: "500" }}>CPC Goal</span>
                      <span style={{ color: "#1e293b", fontWeight: "600" }}>₹{cpcGoal}</span>
                    </div>
                  ) : null}
                </div>

                <h3 style={{ fontSize: "18px", fontWeight: "700", color: "#1e293b", margin: "0 0 16px 0", borderBottom: "1px solid #e2e8f0", paddingBottom: "8px" }}>
                  Selected Products ({selectedProducts.length})
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "28px" }}>
                  {selectedProducts.map((p) => {
                    const id = getProductId(p);
                    const name = getProductName(p);
                    const price = getProductPrice(p);
                    const imageUrl = resolveWixImage(getProductImage(p));
                    return (
                      <div key={id} style={{ display: "flex", alignItems: "center", gap: "16px", padding: "12px", border: "1px solid #e2e8f0", borderRadius: "8px", background: "#fff" }}>
                        <div style={{ width: "50px", height: "50px", borderRadius: "6px", overflow: "hidden", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {imageUrl ? (
                            <img src={imageUrl} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : (
                            <Package size={24} style={{ color: "#94a3b8" }} />
                          )}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: "600", color: "#1e293b", fontSize: "14px" }}>{name}</div>
                          <div style={{ fontSize: "13px", color: "#64748b", marginTop: "2px" }}>₹{price}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: "flex", gap: "12px", marginTop: "20px" }}>
                  <button
                    type="button"
                    className="preset-btn"
                    style={{ flex: 1, justifyContent: "center", background: "#fff", border: "1px solid #cbd5e1", padding: "12px" }}
                    onClick={() => setStep(2)}
                    disabled={submitting}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className="btn-launch-campaign"
                    style={{ flex: 2, padding: "12px" }}
                    onClick={handleFinalSubmit}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <RefreshCw size={14} className="spinner-icon" />
                        <span>{isEditMode ? "Updating..." : "Publishing..."}</span>
                      </>
                    ) : (
                      <span>{isEditMode ? "Update Campaign" : "Publish"}</span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Wallet Modal for Adding Funds */}
      {isWalletModalOpen && (
        <div className="wallet-modal-overlay" onClick={() => !(razorpayLoading || addingFunds) && setIsWalletModalOpen(false)} style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(15, 23, 42, 0.6)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1100,
          animation: "fadeIn 0.2s ease"
        }}>
          <div className="wallet-bottom-sheet" onClick={(e) => e.stopPropagation()} style={{
            background: "#fff",
            borderRadius: "16px",
            padding: "24px",
            width: "100%",
            maxWidth: "420px",
            boxSizing: "border-box",
            position: "relative",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
          }}>
            <button
              type="button"
              className="bottom-sheet-close"
              onClick={() => !(razorpayLoading || addingFunds) && setIsWalletModalOpen(false)}
              disabled={razorpayLoading || addingFunds}
              style={{
                position: "absolute",
                top: "16px",
                right: "16px",
                background: "transparent",
                border: "none",
                color: "#64748b",
                cursor: "pointer",
                padding: "4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <X size={20} />
            </button>

            {walletSuccessMessage ? (
              <div style={{ textAlign: "center", padding: "24px 0" }}>
                <CheckCircle2 size={54} style={{ color: "#10b981", margin: "0 auto 16px" }} />
                <h3 style={{ fontSize: "18px", fontWeight: "700", color: "#0f172a", margin: "0 0 8px 0" }}>Funds Added Successfully!</h3>
                <p style={{ fontSize: "14px", color: "#64748b", margin: 0 }}>{walletSuccessMessage}</p>
              </div>
            ) : (
              <form onSubmit={handleProceedPayment}>
                <h3 style={{ fontSize: "18px", fontWeight: "700", color: "#0f172a", margin: "0 0 20px 0" }}>Add Funds</h3>

                {walletError && (
                  <div style={{
                    backgroundColor: "#fef2f2",
                    border: "1px solid #fee2e2",
                    borderRadius: "8px",
                    padding: "10px 14px",
                    marginBottom: "16px",
                    color: "#ef4444",
                    fontSize: "13px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px"
                  }}>
                    <AlertCircle size={16} style={{ flexShrink: 0 }} />
                    <span>{walletError}</span>
                  </div>
                )}

                <div className="form-group" style={{ marginBottom: "20px" }}>
                  <label htmlFor="amount-input" style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#475569", marginBottom: "8px" }}>Enter Amount</label>
                  <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                    <span style={{ position: "absolute", left: "14px", fontSize: "18px", fontWeight: "700", color: "#0f172a" }}>₹</span>
                    <input
                      id="amount-input"
                      type="number"
                      placeholder="0"
                      value={addFundsAmount}
                      onChange={(e) => setAddFundsAmount(e.target.value)}
                      min="1"
                      required
                      autoFocus
                      disabled={razorpayLoading || addingFunds}
                      style={{
                        width: "100%",
                        padding: "12px 14px 12px 30px",
                        border: "1px solid #cbd5e1",
                        borderRadius: "8px",
                        fontSize: "16px",
                        fontWeight: "700",
                        outline: "none",
                        boxSizing: "border-box"
                      }}
                    />
                  </div>
                </div>

                <div className="quick-amount-selectors" style={{ display: "flex", gap: "8px", marginBottom: "24px" }}>
                  {[500, 1000, 2000, 5000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setAddFundsAmount(String(amt))}
                      disabled={razorpayLoading || addingFunds}
                      style={{
                        flex: 1,
                        background: "#f1f5f9",
                        border: "1px solid #cbd5e1",
                        color: "#475569",
                        padding: "8px 0",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: "600",
                        cursor: "pointer",
                        transition: "all 0.15s ease"
                      }}
                    >
                      +₹{amt}
                    </button>
                  ))}
                </div>

                <button
                  type="submit"
                  disabled={razorpayLoading || addingFunds}
                  style={{
                    width: "100%",
                    background: "var(--primary-color)",
                    color: "#fff",
                    border: "none",
                    padding: "12px",
                    borderRadius: "8px",
                    fontWeight: "700",
                    fontSize: "14px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "background 0.15s ease"
                  }}
                >
                  {razorpayLoading
                    ? "Opening Razorpay..."
                    : addingFunds
                      ? "Processing Payment..."
                      : "Add"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateCampaignPage;
