// DashboardLayout.js  (updated — added ReviewSubmitPage routes and AuthContext sync)
import React, { useState, useEffect, useRef } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { sellerService } from "../../../services/sellerService";
import { getSellerId } from "../../../utils/sellerSession";
import { useAuth } from "../../../context/AuthContext";

import HaatzaNavbar  from "../Navbar/Navbar";
import Sidebar       from "../Sidebar/Sidebar";
import "./DashboardLayout.css";

// ─── Wix image helper ──────────────────────────────────────────────────────────
const resolveLogoUrl = (url) => {
  if (!url) return null;
  const trimmed = String(url).trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  if (trimmed.startsWith("wix:image://")) {
    const noScheme = trimmed.replace(/^wix:image:\/\/(?:v1\/)?/, "");
    const fileId = noScheme.split("/")[0].split("#")[0].split("?")[0];
    if (fileId) return `https://static.wixstatic.com/media/${fileId}`;
  }
  if (trimmed.length > 4 && !trimmed.includes(" ")) {
    return `https://static.wixstatic.com/media/${trimmed}`;
  }
  return trimmed;
};

// ─── Read the real seller email from auth sources ─────────────────────────────
const resolveSellerEmail = (locationState) => {
  if (locationState?.email &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(locationState.email)) {
    const e = locationState.email.trim().toLowerCase();
    console.log("[DashboardLayout] ✅ Email from location.state:", e);
    sessionStorage.setItem("pendingEmail", e);
    localStorage.setItem("userEmail",      e);
    return e;
  }

  const sessionKeys = ["pendingEmail", "userEmail", "email", "sellerEmail"];
  for (const key of sessionKeys) {
    const val = sessionStorage.getItem(key);
    if (val && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim())) {
      const e = val.trim().toLowerCase();
      console.log(`[DashboardLayout] ✅ Email from sessionStorage[${key}]:`, e);
      return e;
    }
  }

  const localKeys = ["userEmail", "email", "sellerEmail",
                     "user", "authUser", "currentUser", "seller"];
  for (const key of localKeys) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.trim())) {
      const e = raw.trim().toLowerCase();
      console.log(`[DashboardLayout] ✅ Email from localStorage[${key}]:`, e);
      return e;
    }
    try {
      const parsed = JSON.parse(raw);
      const found  = parsed?.email || parsed?.userEmail || parsed?.sellerEmail;
      if (found && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(found)) {
        const e = found.trim().toLowerCase();
        console.log(`[DashboardLayout] ✅ Email from localStorage[${key}].email:`, e);
        return e;
      }
    } catch { /* not JSON */ }
  }

  console.warn("[DashboardLayout] ⚠️ No seller email found in any storage.");
  return "";
};

// ─── Seller display data ───────────────────────────────────────────────────────
const useSellerDisplayData = (resolvedEmail, updateUser, currentUser) => {
  const [loadingProfile, setLoadingProfile] = useState(resolvedEmail ? true : false);
  const fetchedEmailRef = useRef("");

  const updateUserRef = useRef(updateUser);
  const currentUserRef = useRef(currentUser);

  updateUserRef.current = updateUser;
  currentUserRef.current = currentUser;

  useEffect(() => {
    if (!resolvedEmail) {
      setLoadingProfile(false);
      return;
    }

    if (fetchedEmailRef.current === resolvedEmail && currentUserRef.current?.profileFetched) {
      setLoadingProfile(false);
      return;
    }

    fetchedEmailRef.current = resolvedEmail;
    setLoadingProfile(true);

    const activeSellerId = currentUserRef.current?.sellerId || getSellerId();

    // 1. Session Storage Details
    const sessionData = {
      sellerName: sessionStorage.getItem("sellerName") || "",
      companyName: sessionStorage.getItem("companyName") || "",
      phone: sessionStorage.getItem("sellerPhone") || "",
      sellerId: sessionStorage.getItem("sellerId") || sessionStorage.getItem("__haatza_sellerId") || "",
      email: sessionStorage.getItem("userEmail") || sessionStorage.getItem("pendingEmail") || "",
      pincode: sessionStorage.getItem("sellerPinCode") || "",
    };

    // 2. Local Storage Details
    const localStorageData = {
      sellerName: localStorage.getItem("sellerName") || localStorage.getItem("sellerFullName") || localStorage.getItem("__haatza_sellerName") || "",
      companyName: localStorage.getItem("companyName") || "",
      phone: localStorage.getItem("sellerPhone") || "",
      sellerId: localStorage.getItem("sellerId") || localStorage.getItem("__haatza_sellerId") || "",
      email: localStorage.getItem("userEmail") || "",
      pincode: localStorage.getItem("sellerPinCode") || "",
    };

    // 3. Registration / OTP response details
    let parsedSellerData = {};
    try {
      const raw = localStorage.getItem("sellerData");
      if (raw) parsedSellerData = JSON.parse(raw);
    } catch {}

    const authenticatedSeller = {
      name: parsedSellerData.fullName || parsedSellerData.name || localStorageData.sellerName || sessionData.sellerName || currentUserRef.current?.name || "",
      nickname: parsedSellerData.nickname || currentUserRef.current?.nickname || "",
      firstName: parsedSellerData.firstName || "",
      lastName: parsedSellerData.lastName || "",
      companyName: parsedSellerData.companyName || localStorageData.companyName || sessionData.companyName || currentUserRef.current?.companyName || "",
      email: parsedSellerData.email || localStorageData.email || sessionData.email || currentUserRef.current?.email || resolvedEmail || "",
      phone: parsedSellerData.phone || localStorageData.phone || sessionData.phone || currentUserRef.current?.phone || "",
      sellerId: parsedSellerData.sellerId || parsedSellerData.seller_id || localStorageData.sellerId || sessionData.sellerId || currentUserRef.current?.sellerId || "",
      gstin: parsedSellerData.gstin || parsedSellerData.GSTIN || currentUserRef.current?.gstin || "",
      GSTIN: parsedSellerData.GSTIN || parsedSellerData.gstin || currentUserRef.current?.GSTIN || "",
      address: parsedSellerData.address || currentUserRef.current?.address || "",
      pincode: parsedSellerData.pincode || localStorageData.pincode || sessionData.pincode || currentUserRef.current?.pincode || "",
      logoUrl: parsedSellerData.logoUrl || currentUserRef.current?.logoUrl || "",
      storageType: parsedSellerData.storageType || currentUserRef.current?.storageType || "",
      status: parsedSellerData.status || currentUserRef.current?.status || "",
    };

    sellerService.getUserProfile(resolvedEmail, activeSellerId)
      .then((res) => {
        const profileResponse = res;
        let p = res?.message || res?.data || res || {};
        
        // Task B - 6: Prevent unrelated profile records from overriding the authenticated seller identity
        if (Array.isArray(p)) {
          const matched = p.find(item => {
            const itemEmail = item.email || item.sellerEmail || item.userEmail || "";
            const itemId = item.sellerId || item.seller_id || item.uid || item.id || "";
            return (
              (resolvedEmail && itemEmail.toLowerCase().trim() === resolvedEmail.toLowerCase().trim()) ||
              (activeSellerId && String(itemId).trim() === String(activeSellerId).trim())
            );
          });
          p = matched || {};
        }

        const pEmail = p.email || p.sellerEmail || p.userEmail || "";
        const pId = p.sellerId || p.seller_id || p.uid || p.id || "";
        
        const isMatch = 
          (resolvedEmail && pEmail && pEmail.toLowerCase().trim() === resolvedEmail.toLowerCase().trim()) ||
          (activeSellerId && pId && String(pId).trim() === String(activeSellerId).trim());

        let onboardingData = {};
        if (isMatch || (!pEmail && !pId && Object.keys(p).length > 0)) {
          onboardingData = p.seller || p.data || p;
          if (Array.isArray(onboardingData)) {
            onboardingData = onboardingData[0] || {};
          }
        } else {
          console.warn("[DashboardLayout] Profile API response email/id did not match authenticated seller. Discarding to prevent override.");
        }

        const resolvedName =
          onboardingData.fullName ||
          (onboardingData.firstName ? (onboardingData.firstName + (onboardingData.lastName ? " " + onboardingData.lastName : "")).trim() : "") ||
          onboardingData.name ||
          onboardingData.nickname ||
          onboardingData.sellerName ||
          "";

        const resolvedCompanyName =
          onboardingData.companyName ||
          onboardingData.company_name ||
          onboardingData.storeName ||
          onboardingData.store_name ||
          onboardingData.tradeName ||
          onboardingData.trade_name ||
          onboardingData.businessName ||
          onboardingData.business_name ||
          "";

        const resolvedPhone =
          onboardingData.phone ||
          onboardingData.phonenumber ||
          onboardingData.phone_number ||
          onboardingData.mobile_number ||
          onboardingData.contact ||
          onboardingData.mobile ||
          "";

        const rawLogo =
          onboardingData.logoUrl ||
          onboardingData.logo ||
          onboardingData.profileImage ||
          onboardingData.profileImg ||
          "";

        const resolvedLogoUrl = rawLogo ? resolveLogoUrl(rawLogo) : null;

        const mergedSeller = {
          ...authenticatedSeller,
          name: (resolvedName && resolvedName !== "Seller") ? resolvedName : authenticatedSeller.name,
          companyName: (resolvedCompanyName && resolvedCompanyName !== "Seller") ? resolvedCompanyName : authenticatedSeller.companyName,
          phone: resolvedPhone || authenticatedSeller.phone,
          logoUrl: resolvedLogoUrl || authenticatedSeller.logoUrl,
          GSTIN: onboardingData.GSTIN || onboardingData.gstin || authenticatedSeller.GSTIN || "",
          gstin: onboardingData.GSTIN || onboardingData.gstin || authenticatedSeller.gstin || "",
          address: onboardingData.address || authenticatedSeller.address || "",
          pincode: onboardingData.pincode || onboardingData.pinCode || authenticatedSeller.pincode || "",
          storageType: onboardingData.storageType || authenticatedSeller.storageType || "",
          nickname: onboardingData.nickname || authenticatedSeller.nickname || resolvedName || "",
          accountManager: onboardingData.accountManager || "",
          bankName: onboardingData.bankName || "",
          accountHolder: onboardingData.accountHolder || "",
          accountNumber: onboardingData.accountNumber || "",
          ifscCode: onboardingData.ifscCode || "",
          panNumber: onboardingData.panNumber || "",
          profileFetched: true,
          status: onboardingData.status || authenticatedSeller.status || "",
        };

        // Task H debug logging
        const registrationData = parsedSellerData;
        const otpResponse = parsedSellerData;
        const sellerData = parsedSellerData;
        const onboardingResponse = onboardingData;
        const finalSellerData = mergedSeller;

        console.log("Registration Data:", registrationData);
        console.log("OTP Response:", otpResponse);
        console.log("Session Seller Data:", sellerData);
        console.log("Onboarding Response:", onboardingResponse);
        console.log("Profile API Response:", profileResponse);
        console.log("Final Dashboard Seller Data:", finalSellerData);

        updateUserRef.current(mergedSeller);
      })
      .catch((err) => {
        console.warn("[DashboardLayout] getUserProfile failed, using fallback display:", err);
        updateUserRef.current(authenticatedSeller);
      })
      .finally(() => {
        setLoadingProfile(false);
      });
  }, [resolvedEmail]);

  return { loadingProfile };
};

// ─── Main Layout ───────────────────────────────────────────────────────────────
function DashboardLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();

  const sellerDataRaw = localStorage.getItem("sellerData");
  let sellerData = {};
  if (sellerDataRaw) {
    try { sellerData = JSON.parse(sellerDataRaw); } catch {}
  }

  const sellerEmail = sellerData.email || user?.email || resolveSellerEmail(location.state);
  const { loadingProfile }  = useSellerDisplayData(sellerEmail, updateUser, user);

  const [sidebarOpen,      setSidebarOpen]      = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobile,         setIsMobile]         = useState(false);

  useEffect(() => {
    const checkScreenSize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      setSidebarOpen(!mobile);
    };
    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);
    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  const handleSidebarToggle  = () => setSidebarOpen(prev => !prev);
  const handleSidebarClose   = () => { if (isMobile) setSidebarOpen(false); };
  const handleCollapseChange = (collapsed) => setSidebarCollapsed(collapsed);

  const activeSellerId = getSellerId();

  useEffect(() => {
    if (!sellerEmail || (!loadingProfile && !activeSellerId)) {
      navigate("/signin", { replace: true });
      return;
    }

    if (!loadingProfile && activeSellerId && user) {
      const status = (user.status || "").toLowerCase().trim();
      const ACTIVE_VALUES = new Set(["active", "completed", "complete", "done"]);
      if (!status || !ACTIVE_VALUES.has(status)) {
        console.log("[DashboardLayout] Redirecting to onboarding due to inactive/empty status:", status);
        navigate("/onboarding", { replace: true });
      }
    }
  }, [sellerEmail, loadingProfile, activeSellerId, user, navigate]);

  if (loadingProfile && !activeSellerId) {
    return (
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        width: "100%",
        backgroundColor: "#f5f7ff"
      }}>
        <div style={{
          width: 36,
          height: 36,
          border: "3px solid #e5e7eb",
          borderTopColor: "#2962ff",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!sellerEmail || (!loadingProfile && !activeSellerId)) {
    return null;
  }

  return (
    <div
      className={[
        "app-container",
        sidebarOpen      ? "sidebar-open"      : "",
        sidebarCollapsed ? "sidebar-collapsed" : "",
      ].filter(Boolean).join(" ")}
    >
      <HaatzaNavbar seller={user || {}} onToggleSidebar={handleSidebarToggle} />

      {isMobile && sidebarOpen && (
        <div className="sidebar-mobile-backdrop" onClick={handleSidebarClose} />
      )}

      <Sidebar
        isOpen={sidebarOpen}
        onClose={handleSidebarClose}
        onToggle={handleSidebarToggle}
        sellerName={user?.name || user?.fullName || ""}
        sellerEmail={user?.email || ""}
        sellerPhone={user?.phone || ""}
        sellerId={user?.sellerId || ""}
        onCollapseChange={handleCollapseChange}
        isMobile={isMobile}
      />

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}

export default DashboardLayout;