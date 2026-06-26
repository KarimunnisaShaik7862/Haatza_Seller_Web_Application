import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Bell, Plus, X, CheckCircle2 } from "lucide-react";
import {
    resolveSellerId,
    walletService,
    getUserProfile
} from '../../services/sellerService';
import "./WalletPage.css";

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

const isDev = () => {
    try {
        if (process.env?.NODE_ENV === "development") return true;
    } catch { }
    return typeof window !== "undefined" && window.location.hostname === "localhost";
};

const devLog = (...args) => {
    if (isDev()) console.log(...args);
};

const devError = (...args) => {
    if (isDev()) console.error(...args);
};

const getBalanceFromResponse = (res) => {
    return Number(
        res?.message?.RemainingBalance ??
        res?.RemainingBalance ??
        res?.balance ??
        res?.message?.balance ??
        0
    );
};

const getTransactionTotal = (tx) => {
    return Number(
        tx?.total ??
        tx?.totalAmount ??
        tx?.amountAdded ??
        tx?.transactionAmount ??
        tx?.amount ??
        0
    );
};

const getCampaignSpendAmount = (tx) => {
    return Number(tx?.amount ?? tx?.total ?? 0);
};

const shouldShowInTransactionHistory = (tx) => {
    return tx?.campaignspend !== true;
};

const shouldShowInCampaignSpends = (tx) => {
    return tx?.campaignspend === true;
};

const formatDateToEnGB = (dateStr) => {
    if (!dateStr) return "Recent";
    try {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
            return d.toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric"
            });
        }
    } catch { }
    return String(dateStr);
};

const WalletPage = () => {
    const sellerId = resolveSellerId();
    console.log("[WalletPage] Resolved sellerId", sellerId);
    const navigate = useNavigate();

    const [balance, setBalance] = useState(0);
    const [transactions, setTransactions] = useState([]);
    const [campaignSummary, setCampaignSummary] = useState(null);
    const [campaignHistory, setCampaignHistory] = useState([]);

    const [loadingBalance, setLoadingBalance] = useState(true);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [loadingCampaign, setLoadingCampaign] = useState(false);
    const [loadingCampaignHistory, setLoadingCampaignHistory] = useState(false);
    const [addingFunds, setAddingFunds] = useState(false);
    const [razorpayLoading, setRazorpayLoading] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);
    const [amount, setAmount] = useState("");

    const [activeTab, setActiveTab] = useState("history");
    const [sellerProfile, setSellerProfile] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const hasFetchedBalanceRef = useRef(false);
    const hasFetchedHistoryRef = useRef(false);
    const paymentInProgressRef = useRef(false);
    const processedPaymentRef = useRef(new Set());

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const email =
                    localStorage.getItem("userEmail") ||
                    sessionStorage.getItem("userEmail") ||
                    "";

                if (!email) return;

                const profile = await getUserProfile(email, sellerId);
                if (profile?.status === "success" || profile?.message) {
                    setSellerProfile(profile.message);
                }
            } catch (err) {
                devLog("[WalletPage] Profile load failed:", err);
            }
        };

        fetchProfile();
    }, []);

    const fetchCurrentBalance = useCallback(async () => {
        const balanceRes = await walletService.checkWalletBalance(sellerId);
        return {
            response: balanceRes,
            balance: getBalanceFromResponse(balanceRes)
        };
    }, [sellerId]);

    const loadWalletBalance = useCallback(async () => {
        if (!sellerId) {
            setError("Seller session not found. Please login again.");
            setLoadingBalance(false);
            return;
        }

        setLoadingBalance(true);
        setError(null);

        try {
            const { response, balance: fetchedBalance } = await fetchCurrentBalance();
            devLog("[WalletPage] balance response", response);
            setBalance(fetchedBalance);

            if (response?.status === "error") {
                setError("Unable to load wallet balance");
            }
        } catch (err) {
            devError("[WalletPage] Error loading balance:", err);
            setBalance(0);
            setError("Unable to load wallet balance");
        } finally {
            setLoadingBalance(false);
        }
    }, [sellerId, fetchCurrentBalance]);

    const loadTransactionHistory = useCallback(async () => {
        if (!sellerId) {
            setLoadingHistory(false);
            return;
        }

        setLoadingHistory(true);
        setError(null);

        try {
            const transactionsRes = await walletService.transactionHistory(sellerId);

            const rawTx =
                transactionsRes?.message?.transactions ||
                transactionsRes?.message?.data ||
                transactionsRes?.transactions ||
                transactionsRes?.data ||
                [];

            const walletTransactions = rawTx
                .filter(shouldShowInTransactionHistory)
                .map((tx) => {
                    const type = String(tx.type || "").toLowerCase();
                    const isCredit =
                        type === "credit" ||
                        type === "deposit" ||
                        type === "add_funds";

                    const dateVal = tx.createdDate || tx.date || tx.createdAt;

                    return {
                        id: tx._id || tx.id || `${dateVal}-${tx.type}-${getTransactionTotal(tx)}`,
                        date: formatDateToEnGB(dateVal),
                        type: tx.type || "Transaction",
                        amount: getTransactionTotal(tx),
                        isCredit,
                        status: tx.status || "Completed"
                    };
                });

            const campaignSpendTransactions = rawTx
                .filter(shouldShowInCampaignSpends)
                .map((tx) => {
                    const dateVal = tx.createdDate || tx.date || tx.createdAt;

                    return {
                        id: tx._id || tx.id || `${dateVal}-${tx.type}-${getCampaignSpendAmount(tx)}`,
                        date: formatDateToEnGB(dateVal),
                        type: tx.type || "Campaign Spend",
                        amount: getCampaignSpendAmount(tx),
                        isCredit: false,
                        status: tx.status || "Completed"
                    };
                });

            setTransactions(walletTransactions);
            setCampaignHistory(campaignSpendTransactions);
        } catch (err) {
            devError("[WalletPage] Error loading history:", err);
            setError(err.message || "Failed to retrieve transaction history.");
        } finally {
            setLoadingHistory(false);
        }
    }, [sellerId]);

    const loadCampaignSummary = useCallback(async () => {
        if (!sellerId) {
            setError("Seller session not found. Please login again.");
            return;
        }

        setLoadingCampaign(true);
        setLoadingCampaignHistory(true);
        setError(null);

        try {
            const transactionsRes = await walletService.transactionHistory(sellerId);

            const rawTx =
                transactionsRes?.message?.transactions ||
                transactionsRes?.message?.data ||
                transactionsRes?.transactions ||
                transactionsRes?.data ||
                [];

            const campaignSpendTransactions = rawTx
                .filter(shouldShowInCampaignSpends)
                .map((tx) => {
                    const dateVal = tx.createdDate || tx.date || tx.createdAt;

                    return {
                        id: tx._id || tx.id || `${dateVal}-${tx.type}-${getCampaignSpendAmount(tx)}`,
                        date: formatDateToEnGB(dateVal),
                        type: tx.type || "Campaign Spend",
                        amount: getCampaignSpendAmount(tx),
                        isCredit: false,
                        status: tx.status || "Completed"
                    };
                });

            const totalSpend = campaignSpendTransactions.reduce(
                (sum, item) => sum + Number(item.amount || 0),
                0
            );

            setCampaignSummary({
                data: {
                    totalSpend
                }
            });

            setCampaignHistory(campaignSpendTransactions);
        } catch (err) {
            devError("[WalletPage] Error loading campaign spends:", err);
            setError(err.message || "Failed to retrieve campaign spends.");
        } finally {
            setLoadingCampaign(false);
            setLoadingCampaignHistory(false);
        }
    }, [sellerId]);

    useEffect(() => {
        if (hasFetchedBalanceRef.current) return;
        hasFetchedBalanceRef.current = true;
        loadWalletBalance();
    }, [loadWalletBalance]);

    const handleTabChange = (tab) => {
        setActiveTab(tab);

        if (tab === "history" && !hasFetchedHistoryRef.current) {
            hasFetchedHistoryRef.current = true;
            loadTransactionHistory();
        }

        if (tab === "campaign") {
            loadCampaignSummary();
        }
    };

    const openModal = () => {
        setAmount("");
        setSuccessMessage(null);
        setError(null);
        setAddingFunds(false);
        setRazorpayLoading(false);
        setIsModalOpen(true);
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

        if (paymentInProgressRef.current) return;

        const amountVal = Number(amount);

        console.log("[WalletPage] Seller ID", sellerId);

        if (!sellerId) {
            setError("Seller session not found. Please login again.");
            return;
        }

        if (!Number.isFinite(amountVal) || amountVal <= 0) {
            setError("Please enter a valid amount greater than 0");
            return;
        }

        paymentInProgressRef.current = true;
        setRazorpayLoading(true);
        setError(null);

        try {
            const beforeBalanceData = await fetchCurrentBalance();

            console.log("[WalletPage] Balance Before Payment", beforeBalanceData.response);

            const createOrderPayload = {
                sellerId,
                amount: Number(amountVal)
            };

            console.log("[WalletPage] Create Razorpay Order Payload", createOrderPayload);

            const createOrderRes = await walletService.createRazorpayOrder(createOrderPayload);

            console.log("[WalletPage] Create Razorpay Order Response", createOrderRes);

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
                    name: sellerProfile?.sellerName || sellerProfile?.companyName || "",
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
                    setError(null);

                    console.log("[WalletPage] Razorpay Response", razorpayResponse);

                    try {
                        if (!razorpayResponse?.razorpay_payment_id) {
                            throw new Error("razorpay_payment_id missing from Razorpay response.");
                        }

                        const paymentId = razorpayResponse.razorpay_payment_id;
                        if (processedPaymentRef.current.has(paymentId)) {
                            console.log("[WalletPage] Payment already processed, skipping duplicate addFunds call:", paymentId);
                            return;
                        }
                        processedPaymentRef.current.add(paymentId);

                        if (!razorpayResponse?.razorpay_signature) {
                            throw new Error("razorpay_signature missing from Razorpay response.");
                        }

                        const verifyPayload = {
                            sellerId,
                            amount: Number(amountVal),
                            paymentId: razorpayResponse.razorpay_payment_id,
                            orderId: razorpayResponse.razorpay_order_id || rzpOrderId,
                            signature: razorpayResponse.razorpay_signature
                        };

                        console.log("[WalletPage] Verify Payment Payload", verifyPayload);

                        let verifyRes;
                        try {
                            verifyRes = await walletService.verifyRazorpayPayment(verifyPayload);
                        } catch (verifyErr) {
                            console.error(
                                "[WalletPage] verifyRazorpayPayment NETWORK/CORS ERROR: This is backend CORS / Wix function browser access issue for verifyRazorpayPayment. Frontend payload is correct.",
                                verifyErr
                            );

                            const isNetworkOrCors =
                                !verifyErr?.response ||
                                verifyErr?.message?.toLowerCase().includes("network error") ||
                                verifyErr?.code === "ERR_NETWORK";

                            if (isNetworkOrCors) {
                                throw new Error(
                                    "Payment completed, but verification API is blocked or unreachable from browser. Please check backend CORS for verifyRazorpayPayment."
                                );
                            }

                            throw new Error(
                                verifyErr?.response?.data?.message ||
                                verifyErr?.response?.data?.error ||
                                verifyErr?.message ||
                                "Payment verification failed. Wallet was not credited."
                            );
                        }

                        console.log("[WalletPage] Verify Payment Response", verifyRes);

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

                        console.log("[WalletPage] Add Funds Payload", {
                            sellerId,
                            amountAdded: Number(amount),
                            paymentId: razorpayResponse.razorpay_payment_id
                        });

                        let addFundsRes;
                        try {
                            addFundsRes = await walletService.addFunds(addFundsPayload);
                        } catch (error) {
                            console.error("[WalletPage] Add Funds Error", error?.response?.status, error?.response?.data);
                            throw new Error(
                                error?.response?.data?.message ||
                                error?.response?.data?.error ||
                                "Failed to complete wallet credit."
                            );
                        }

                        console.log("[WalletPage] Add Funds Response", addFundsRes);

                        const isSuccess =
                            addFundsRes?.success === true ||
                            addFundsRes?.message === "Funds added successfully!";

                        if (!isSuccess) {
                            throw new Error("Failed to add funds to wallet backend.");
                        }

                        const balanceRes = await walletService.checkWalletBalance(sellerId);
                        console.log("[WalletPage] Refreshed Balance Response", balanceRes);

                        setBalance(getBalanceFromResponse(balanceRes));

                        const historyRes = await walletService.transactionHistory(sellerId);
                        console.log("[WalletPage] Refreshed Transaction History Response", historyRes);

                        const rawTx =
                            historyRes?.message?.transactions ||
                            historyRes?.message?.data ||
                            historyRes?.transactions ||
                            historyRes?.data ||
                            [];

                        const walletTransactions = rawTx
                            .filter(shouldShowInTransactionHistory)
                            .map((tx) => {
                                const type = String(tx.type || "").toLowerCase();
                                const isCredit =
                                    type === "credit" ||
                                    type === "deposit" ||
                                    type === "add_funds";

                                const dateVal = tx.createdDate || tx.date || tx.createdAt;

                                return {
                                    id: tx._id || tx.id || `${dateVal}-${tx.type}-${getTransactionTotal(tx)}`,
                                    date: formatDateToEnGB(dateVal),
                                    type: tx.type || "Transaction",
                                    amount: getTransactionTotal(tx),
                                    isCredit,
                                    status: tx.status || "Completed"
                                };
                            });

                        const campaignSpendTransactions = rawTx
                            .filter(shouldShowInCampaignSpends)
                            .map((tx) => {
                                const dateVal = tx.createdDate || tx.date || tx.createdAt;

                                return {
                                    id: tx._id || tx.id || `${dateVal}-${tx.type}-${getCampaignSpendAmount(tx)}`,
                                    date: formatDateToEnGB(dateVal),
                                    type: tx.type || "Campaign Spend",
                                    amount: getCampaignSpendAmount(tx),
                                    isCredit: false,
                                    status: tx.status || "Completed"
                                };
                            });

                        setTransactions(walletTransactions);
                        setCampaignHistory(campaignSpendTransactions);

                        window.dispatchEvent(new CustomEvent("walletUpdate"));

                        setSuccessMessage(`₹${Number(amountVal).toFixed(2)} credited to your wallet.`);
                        setAddingFunds(false);

                        setTimeout(() => {
                            setIsModalOpen(false);
                            setSuccessMessage(null);
                            setAmount("");
                        }, 2000);
                    } catch (handlerErr) {
                        console.error("[WalletPage] Payment handler error:", handlerErr?.message);
                        setError(
                            handlerErr.message ||
                            "Failed to complete payment. Please contact support."
                        );
                        setAddingFunds(false);
                    } finally {
                        paymentInProgressRef.current = false;
                    }
                },
                modal: {
                    ondismiss: () => {
                        setAddingFunds(false);
                        setRazorpayLoading(false);
                        paymentInProgressRef.current = false;
                        setError("Payment cancelled. Your wallet has not been charged.");
                    }
                }
            };

            const rzp = new window.Razorpay(options);

            rzp.on("payment.failed", function (resp) {
                devError("[WalletPage] Razorpay payment.failed:", resp?.error);
                setAddingFunds(false);
                setRazorpayLoading(false);
                paymentInProgressRef.current = false;

                const reason =
                    resp?.error?.description ||
                    resp?.error?.reason ||
                    "Payment failed. Please try again.";

                setError(reason);
            });

            rzp.open();
        } catch (err) {
            devError("[WalletPage] Add funds failed:", err);
            setError(err.message || "Could not complete add funds flow.");
            setRazorpayLoading(false);
            setAddingFunds(false);
            paymentInProgressRef.current = false;
        }
    };

    const isInitialLoading = loadingBalance && balance === 0 && !error;

    return (
        <div className="transaction-page-root">
            <div className="transaction-header-bar">
                <button className="header-icon-btn back-btn" onClick={() => navigate(-1)} aria-label="Go Back">
                    <ChevronLeft size={24} />
                </button>
                <h1 className="transaction-title">Transaction</h1>
                <button className="header-icon-btn bell-btn" onClick={() => navigate("/notifications")} aria-label="Notifications">
                    <Bell size={24} />
                </button>
            </div>

            <div className="wallet-desktop-header">
                <nav className="wallet-breadcrumb">
                    <span>Dashboard</span> &gt; <span className="active">Wallet</span>
                </nav>
                <h1 className="wallet-desktop-title">Wallet & Transactions</h1>
            </div>

            <div className="transaction-content-area">
                {error && (
                    <div className="wallet-error-banner">
                        <span>{error}</span>
                        <button type="button" className="error-close" onClick={() => setError(null)}>&times;</button>
                    </div>
                )}

                {isInitialLoading ? (
                    <div className="wallet-loading-state">
                        <div className="wallet-loading-spinner" />
                        <p>Loading billing details...</p>
                    </div>
                ) : (
                    <>
                        <div className="wallet-balance-card-v2">
                            <div className="balance-info-left">
                                <span className="balance-label">Wallet Balance</span>
                                <h2 className="balance-value">₹{balance.toFixed(2)}</h2>
                            </div>
                            <button className="btn-add-funds-v2" onClick={openModal}>
                                <Plus size={16} />
                                <span>Add Funds</span>
                            </button>
                        </div>

                        <div className="transaction-tabs-v2">
                            <button
                                type="button"
                                className={`tab-btn-v2 ${activeTab === "history" ? "active" : ""}`}
                                onClick={() => handleTabChange("history")}
                            >
                                Transaction History
                            </button>
                            <button
                                type="button"
                                className={`tab-btn-v2 ${activeTab === "campaign" ? "active" : ""}`}
                                onClick={() => handleTabChange("campaign")}
                            >
                                Campaign Spends
                            </button>
                        </div>

                        <div className="transaction-list-container-v2">
                            {activeTab === "history" ? (
                                loadingHistory ? (
                                    <div className="wallet-loading-state">
                                        <div className="wallet-loading-spinner" />
                                        <p>Loading transaction history...</p>
                                    </div>
                                ) : transactions.length === 0 ? (
                                    <div className="empty-list-view">
                                        <p>No transaction history found.</p>
                                    </div>
                                ) : (
                                    transactions.map((t) => (
                                        <div className="transaction-item-row" key={t.id}>
                                            <div className="tx-col-left">
                                                <span className="tx-date-text">{t.date}</span>
                                                <span className="tx-type-text">{t.type}</span>
                                            </div>
                                            <div className="tx-col-right">
                        <span className={`tx-amount-text ${t.isCredit ? "credit" : "spend"}`}>
                          ₹{t.amount.toFixed(2)}
                        </span>
                                            </div>
                                        </div>
                                    ))
                                )
                            ) : (
                                loadingCampaign ? (
                                    <div className="wallet-loading-state">
                                        <div className="wallet-loading-spinner" />
                                        <p>Loading campaign summary...</p>
                                    </div>
                                ) : !campaignSummary ? (
                                    <div className="empty-list-view">
                                        <p>No campaign summary found.</p>
                                    </div>
                                ) : (
                                    <div className="campaign-summary-container">
                                        <div className="transaction-item-row" style={{ borderBottom: "1px solid #eee", paddingBottom: "12px", marginBottom: "12px" }}>
                                            <div className="tx-col-left">
                                                <span className="tx-type-text" style={{ fontSize: "16px", fontWeight: "600" }}>Total Campaign Spend</span>
                                            </div>
                                            <div className="tx-col-right">
                        <span className="tx-amount-text spend" style={{ fontSize: "18px", fontWeight: "700", color: "#e53935" }}>
                          ₹{Number(campaignSummary?.data?.totalSpend || 0).toFixed(2)}
                        </span>
                                            </div>
                                        </div>

                                        <div style={{ marginTop: "24px", borderTop: "1px solid #eee", paddingTop: "24px" }}>
                                            <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "16px", color: "#333" }}>
                                                Campaign Spend History
                                            </h3>

                                            {loadingCampaignHistory ? (
                                                <div className="wallet-loading-state" style={{ minHeight: "100px" }}>
                                                    <div className="wallet-loading-spinner" />
                                                    <p>Loading spend history...</p>
                                                </div>
                                            ) : campaignHistory.length === 0 ? (
                                                <div className="empty-list-view" style={{ minHeight: "100px" }}>
                                                    <p>No campaign spend history found.</p>
                                                </div>
                                            ) : (
                                                campaignHistory.map((c) => (
                                                    <div className="transaction-item-row" key={c.id}>
                                                        <div className="tx-col-left">
                                                            <span className="tx-date-text">{c.date}</span>
                                                            <span className="tx-type-text">Campaign Spend</span>
                                                        </div>
                                                        <div className="tx-col-right">
                              <span className="tx-amount-text spend">
                                ₹{Number(c.amount || 0).toFixed(2)}
                              </span>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )
                            )}
                        </div>
                    </>
                )}
            </div>

            {isModalOpen && (
                <div className="wallet-modal-overlay" onClick={() => !(razorpayLoading || addingFunds) && setIsModalOpen(false)}>
                    <div className="wallet-bottom-sheet" onClick={(e) => e.stopPropagation()}>
                        <div className="bottom-sheet-handle" />

                        <button
                            type="button"
                            className="bottom-sheet-close"
                            onClick={() => !(razorpayLoading || addingFunds) && setIsModalOpen(false)}
                            disabled={razorpayLoading || addingFunds}
                        >
                            <X size={20} />
                        </button>

                        {successMessage ? (
                            <div className="modal-success-state">
                                <CheckCircle2 size={54} className="success-icon" />
                                <h3>Funds Added Successfully!</h3>
                                <p>{successMessage}</p>
                            </div>
                        ) : (
                            <form onSubmit={handleProceedPayment} className="bottom-sheet-form">
                                <h3>Add Funds</h3>

                                <div className="form-group">
                                    <label htmlFor="amount-input">Enter Amount</label>
                                    <div className="amount-input-container">
                                        <span className="amount-prefix">₹</span>
                                        <input
                                            id="amount-input"
                                            type="number"
                                            className="amount-input"
                                            placeholder="0"
                                            value={amount}
                                            onChange={(e) => setAmount(e.target.value)}
                                            min="1"
                                            required
                                            autoFocus
                                            disabled={razorpayLoading || addingFunds}
                                        />
                                    </div>
                                </div>

                                <div className="quick-amount-selectors">
                                    {[500, 1000, 2000, 5000].map((amt) => (
                                        <button
                                            key={amt}
                                            type="button"
                                            className="quick-amt-button"
                                            onClick={() => setAmount(String(amt))}
                                            disabled={razorpayLoading || addingFunds}
                                        >
                                            +₹{amt}
                                        </button>
                                    ))}
                                </div>

                                <button
                                    type="submit"
                                    className="btn-bottom-sheet-add"
                                    disabled={razorpayLoading || addingFunds}
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

export default WalletPage;