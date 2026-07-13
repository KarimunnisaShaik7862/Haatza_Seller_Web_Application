import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Bell, Plus, X, CheckCircle2 } from "lucide-react";
import {
    resolveSellerId,
    walletService,
    getUserProfile,
    resolveAuthenticatedUserId
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

const formatTransactionType = (rawType) => {
    if (!rawType) return "Transaction";
    const type = String(rawType).trim();
    if (/^WELCOME_REWARD/i.test(type)) {
        return "New Seller Reward";
    }
    return type;
};

const isScratchCardTransaction = (tx) => {
    return tx?.gstDeducted !== undefined && tx?.gstDeducted !== null;
};

const getTransactionBalance = (tx) => {
    return Number(
        tx?.remainingBalance ??
        tx?.RemainingBalance ??
        tx?.balance ??
        tx?.walletBalance ??
        tx?.currentBalance ??
        0
    );
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
    const [isTransactionProcessing, setIsTransactionProcessing] = useState(false);
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

    const [displayBalance, setDisplayBalance] = useState(0);
    const [wpParticles, setWpParticles] = useState([]);

    useEffect(() => {
        let start = displayBalance;
        const end = balance;
        if (start === end) return;
        
        const range = end - start;
        const duration = 1500;
        const startTime = performance.now();
        
        let active = true;
        const tick = (now) => {
            if (!active) return;
            const elapsed = now - startTime;
            const progress = Math.min(1, elapsed / duration);
            const ease = progress * (2 - progress);
            const current = start + range * ease;
            setDisplayBalance(current);
            
            if (progress < 1) {
                requestAnimationFrame(tick);
            } else {
                setDisplayBalance(end);
            }
        };
        requestAnimationFrame(tick);
        return () => { active = false; };
    }, [balance]);

    useEffect(() => {
        const list = [];
        
        // 1. Falling coins
        for (let i = 0; i < 15; i++) {
            list.push({
                id: `coin-${i}`,
                className: "falling-coin-wp",
                style: {
                    left: `${Math.random() * 85}%`,
                    top: `-10px`,
                    animationDelay: `${Math.random() * 1.5}s`,
                    transform: `scale(${Math.random() * 0.4 + 0.8})`
                }
            });
        }
        
        // 2. Sparkles
        for (let i = 0; i < 10; i++) {
            list.push({
                id: `sparkle-${i}`,
                className: "wp-sparkle",
                style: {
                    left: `${Math.random() * 90}%`,
                    top: `${Math.random() * 80}%`,
                    "--mx": `${(Math.random() - 0.5) * 40}px`,
                    "--my": `${(Math.random() - 0.5) * 40}px`,
                    animationDelay: `${Math.random() * 2}s`
                }
            });
        }
        
        // 3. Entering stars
        for (let i = 0; i < 8; i++) {
            list.push({
                id: `star-${i}`,
                className: "wp-entering-star",
                style: {
                    left: `${Math.random() * 80}%`,
                    "--sx": `${(Math.random() - 0.5) * 20}px`,
                    "--tx": `${(Math.random() - 0.5) * 60}px`,
                    "--ty": `${Math.random() * 50 + 60}px`,
                    animationDelay: `${Math.random() * 0.8}s`
                }
            });
        }
        
        setWpParticles(list);
    }, []);

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
            console.log("[WalletPage] Refreshed Balance Response:", response);
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
            console.log("[WalletPage] Refreshed Transaction History Response:", transactionsRes);

            const rawTx =
                transactionsRes?.message?.transactions ||
                transactionsRes?.message?.data ||
                transactionsRes?.transactions ||
                transactionsRes?.data ||
                [];

            const currentUid = resolveAuthenticatedUserId();
            const walletTransactions = rawTx
                .filter(shouldShowInTransactionHistory)
                .filter((tx) => {
                    const txOwner = tx._owner || tx.userId || tx.user_id || tx.memberId;
                    if (txOwner && currentUid && txOwner !== currentUid) {
                        return false;
                    }
                    return true;
                })
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
                        type: formatTransactionType(tx.type),
                        amount: getTransactionTotal(tx),
                        isCredit,
                        status: tx.status || "Completed",
                        isScratchCard: isScratchCardTransaction(tx),
                        balance: getTransactionBalance(tx)
                    };
                });

            const campaignSpendTransactions = rawTx
                .filter(shouldShowInCampaignSpends)
                .filter((tx) => {
                    const txOwner = tx._owner || tx.userId || tx.user_id || tx.memberId;
                    if (txOwner && currentUid && txOwner !== currentUid) {
                        return false;
                    }
                    return true;
                })
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
        loadTransactionHistory();
    }, [loadWalletBalance, loadTransactionHistory]);

    const handleTabChange = (tab) => {
        if (isTransactionProcessing) return;

        setActiveTab(tab);

        if (tab === "history") {
            loadTransactionHistory();
        }

        if (tab === "campaign") {
            loadCampaignSummary();
        }
    };

    const openModal = () => {
        if (isTransactionProcessing || paymentInProgressRef.current) return;

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

        if (paymentInProgressRef.current || isTransactionProcessing) return;

        const amountVal = Number(amount);

        console.log("[WalletPage] Seller ID", sellerId);

        if (!sellerId) {
            setError("Seller session not found. Please login again.");
            return;
        }

        // Allow minimum ₹1 for testing
        if (!Number.isFinite(amountVal) || amountVal < 1) {
            setError("Please enter at least ₹1");
            return;
        }

        paymentInProgressRef.current = true;
        let checkoutOpened = false;
        setIsTransactionProcessing(true);
        setRazorpayLoading(true);
        setError(null);

        try {
            const beforeBalanceData = await fetchCurrentBalance();

            console.log("[WalletPage] Balance Before Payment", beforeBalanceData.response);

            // Order creation payload
            const createOrderPayload = {
                sellerId,
                amount: Number(amountVal),
                currency: "INR",
                receipt: `wallet_${sellerId}_${Date.now()}`
            };

            console.log("[WalletPage] Create Razorpay Order Payload", createOrderPayload);

            const createOrderRes = await walletService.createRazorpayOrder(createOrderPayload);

            console.log("[WalletPage] Create Razorpay Order Response", createOrderRes);

            // Requirement 6: safe extraction
            const rzpOrderId =
                createOrderRes?.message?.order?.id ||
                createOrderRes?.orderId ||
                createOrderRes?.order_id ||
                createOrderRes?.id ||
                createOrderRes?.message?.order?.orderId ||
                createOrderRes?.message?.order?.order_id ||
                createOrderRes?.message?.orderId ||
                createOrderRes?.message?.order_id ||
                createOrderRes?.message?.id;

            if (!rzpOrderId) {
                throw new Error("Payment order creation failed. Please try again.");
            }

            const rzpAmount =
                createOrderRes?.message?.order?.amount ||
                createOrderRes?.amount ||
                createOrderRes?.amount_due ||
                createOrderRes?.message?.amount ||
                amountVal * 100;

            const rzpCurrency =
                createOrderRes?.message?.order?.currency ||
                createOrderRes?.currency ||
                "INR";

            const rzpKey =
                createOrderRes?.message?.keyId ||
                createOrderRes?.key ||
                createOrderRes?.razorpayKey ||
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

            // Requirement 7: Razorpay options
            const options = {
                key: rzpKey,
                amount: rzpAmount,
                currency: rzpCurrency,
                name: "Haatza India Private Limited",
                description: "Wallet Add Funds",
                order_id: rzpOrderId,
                ...(rzpImage ? { image: rzpImage } : {}),
                prefill: {
                    name: sellerProfile?.companyName || sellerProfile?.sellerName || localStorage.getItem("userName") || "NA",
                    email: sellerProfile?.email || localStorage.getItem("userEmail") || sessionStorage.getItem("userEmail") || "NA",
                    contact: sellerProfile?.phone || sellerProfile?.contact || localStorage.getItem("userPhone") || "NA"
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

                        // Requirement 8: verify payment payload
                        const verifyPayload = {
                            orderId: razorpayResponse.razorpay_order_id || rzpOrderId,
                            paymentId: razorpayResponse.razorpay_payment_id,
                            signature: razorpayResponse.razorpay_signature
                        };

                        console.log("[WalletPage] Verify Payment Payload", verifyPayload);

                        let verifyRes;
                        try {
                            verifyRes = await walletService.verifyRazorpayPayment(verifyPayload);
                        } catch (verifyErr) {
                            console.error(
                                "[WalletPage] verifyRazorpayPayment NETWORK/CORS ERROR: verifyRazorpayPayment step failed.",
                                verifyErr
                            );
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
                            verifyRes?.status === "success" ||
                            verifyRes?.verified === true ||
                            verifyRes?.message?.verified === true ||
                            verifyRes?.message?.status === "success";

                        if (!isVerified) {
                            throw new Error("Payment verification failed. Wallet was not credited.");
                        }

                        // Requirement 9: addFunds payload
                        const addFundsPayload = {
                            sellerId,
                            amountAdded: String(amountVal),
                            paymentId: razorpayResponse.razorpay_payment_id,
                            razorpayOrderId: razorpayResponse.razorpay_order_id || rzpOrderId
                        };

                        console.log("[WalletPage] Add Funds Payload", addFundsPayload);

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

                        // Success check
                        const isSuccess =
                            addFundsRes?.success === true ||
                            addFundsRes?.status === "success" ||
                            addFundsRes?.message === "Funds added successfully!" ||
                            addFundsRes?.message?.message === "Funds added successfully!";

                        if (!isSuccess) {
                            throw new Error("Failed to add funds to wallet backend.");
                        }

                        // Create seller invoice (non-blocking)
                        try {
                            const sellerName = sellerProfile?.companyName || sellerProfile?.sellerName || "NA";
                            const addressStr = sellerProfile?.address || "NA";
                            const gstin = sellerProfile?.gstin || sellerProfile?.GSTIN || "NA";

                            const invoicePayload = {
                                invoiceDate: new Date().toISOString(),
                                sellerName,
                                sellerId,
                                address: addressStr,
                                gstin,
                                item: "Wallet Add",
                                qty: 1,
                                rate: Number(amountVal),
                                amount: Number(amountVal),
                                subtotal: Number(amountVal),
                                cgst: 0,
                                sgst: 0,
                                totalPayable: Number(amountVal),
                                payments: {
                                    wallet: "0",
                                    upi: String(amountVal)
                                },
                                transactionMethod: "UPI",
                                paymentId: razorpayResponse.razorpay_payment_id,
                                razorpayOrderId: razorpayResponse.razorpay_order_id || rzpOrderId
                            };

                            console.log("[WalletPage] Create Seller Invoice Payload:", invoicePayload);
                            const invoiceRes = await walletService.createSellerInvoice(invoicePayload);
                            console.log("[WalletPage] Create Seller Invoice Response:", invoiceRes);
                        } catch (invoiceErr) {
                            console.error("[WalletPage] Error creating seller invoice (non-blocking):", invoiceErr);
                        }

                        // Requirement 12: Success flow UI updates
                        await loadWalletBalance();
                        await loadTransactionHistory();

                        window.dispatchEvent(new CustomEvent("walletUpdate"));

                        setSuccessMessage(`₹${Number(amountVal).toFixed(2)} credited to your wallet.`);

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
                    } finally {
                        setAddingFunds(false);
                        setRazorpayLoading(false);
                        setIsTransactionProcessing(false);
                        paymentInProgressRef.current = false;
                    }
                },
                modal: {
                    ondismiss: () => {
                        setAddingFunds(false);
                        setRazorpayLoading(false);
                        setIsTransactionProcessing(false);
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
                setIsTransactionProcessing(false);
                paymentInProgressRef.current = false;

                const reason =
                    resp?.error?.description ||
                    resp?.error?.reason ||
                    "Payment failed. Please try again.";

                setError(reason);
            });

            rzp.open();
            checkoutOpened = true;
        } catch (err) {
            devError("[WalletPage] Add funds failed:", err);
            setError(err.message || "Could not complete add funds flow.");
            setRazorpayLoading(false);
            setAddingFunds(false);
            paymentInProgressRef.current = false;
        } finally {
            if (!checkoutOpened) {
                setIsTransactionProcessing(false);
            }
        }
    };

    const isInitialLoading = loadingBalance && balance === 0 && !error;
    const walletActionsDisabled = isTransactionProcessing || razorpayLoading || addingFunds;

    return (
        <div className="transaction-page-root">
            <div className="transaction-header-bar">
                <button className="header-icon-btn back-btn" onClick={() => navigate(-1)} aria-label="Go Back" disabled={walletActionsDisabled}>
                    <ChevronLeft size={24} />
                </button>
                <h1 className="transaction-title">Transaction</h1>
                <button className="header-icon-btn bell-btn" onClick={() => navigate("/notifications")} aria-label="Notifications" disabled={walletActionsDisabled}>
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
                        <button type="button" className="error-close" onClick={() => setError(null)} disabled={walletActionsDisabled}>&times;</button>
                    </div>
                )}

                {isInitialLoading ? (
                    <div className="wallet-loading-state">
                        <div className="wallet-loading-spinner" />
                        <p>Loading billing details...</p>
                    </div>
                ) : (
                    <>
                        <div className="wallet-balance-card-v2 wallet-card-opening">
                            {/* Mount particle animations */}
                            {wpParticles.map(p => (
                                <div 
                                    key={p.id} 
                                    className={p.className} 
                                    style={p.style}
                                >
                                    {p.className.includes("star") ? "★" : p.className.includes("coin") ? "₹" : ""}
                                </div>
                            ))}
                            <div className="balance-info-left" style={{ zIndex: 3 }}>
                                <span className="balance-label">Wallet Balance</span>
                                <h2 className="balance-value">₹{displayBalance.toFixed(2)}</h2>
                            </div>
                            <button className="btn-add-funds-v2" onClick={openModal} disabled={walletActionsDisabled}>
                                <Plus size={16} />
                                <span>Add Funds</span>
                            </button>
                        </div>

                        <div className="transaction-tabs-v2">
                            <button
                                type="button"
                                className={`tab-btn-v2 ${activeTab === "history" ? "active" : ""}`}
                                onClick={() => handleTabChange("history")}
                                disabled={walletActionsDisabled}
                            >
                                Transaction History
                            </button>
                            <button
                                type="button"
                                className={`tab-btn-v2 ${activeTab === "campaign" ? "active" : ""}`}
                                onClick={() => handleTabChange("campaign")}
                                disabled={walletActionsDisabled}
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
                                                {t.isScratchCard && (
                                                    <span className="tx-balance-text">
                                                        ₹{t.balance.toFixed(2)}
                                                    </span>
                                                )}
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
                                        <div className="campaign-spend-history-section">
                                            <h3 className="campaign-spend-history-title">
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
                <div className="wallet-modal-overlay" onClick={() => !walletActionsDisabled && setIsModalOpen(false)}>
                    <div className="wallet-bottom-sheet" onClick={(e) => e.stopPropagation()}>
                        <div className="bottom-sheet-handle" />

                        <button
                            type="button"
                            className="bottom-sheet-close"
                            onClick={() => !walletActionsDisabled && setIsModalOpen(false)}
                            disabled={walletActionsDisabled}
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
                                            disabled={walletActionsDisabled}
                                        />
                                    </div>
                                </div>

                                <div className="quick-amount-selectors">
                                    {[500, 1000, 2000, 5000].map((amt) => (
                                        <button
                                            key={amt}
                                            type="button"
                                            className="quick-amt-button"
                                            onClick={() => !walletActionsDisabled && setAmount(String(amt))}
                                            disabled={walletActionsDisabled}
                                        >
                                            +₹{amt}
                                        </button>
                                    ))}
                                </div>

                                <button
                                    type="submit"
                                    className="btn-bottom-sheet-add"
                                    disabled={walletActionsDisabled}
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

            {isTransactionProcessing && (
                <div className="wallet-transaction-overlay" role="alert" aria-live="assertive" aria-busy="true">
                    <div className="wallet-transaction-loader-card">
                        <div className="wallet-transaction-spinner" />
                        <p className="wallet-transaction-title">Processing your transaction...</p>
                        <p className="wallet-transaction-subtitle">Please do not close or refresh this page.</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WalletPage;