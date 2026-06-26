import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import ReactDOM from "react-dom";
import { sellerService } from "../../../services/sellerService";
import { getSellerId } from "../../../utils/sellerSession";
import { useAuth } from "../../../context/AuthContext";
import LogoutConfirmModal from "../../common/LogoutConfirmModal/LogoutConfirmModal";
import { ReceiptText } from "lucide-react";
import "./Sidebar.css";

const KEY_TO_ROUTE = {
  dashboard:       "/dashboard",
  orders:          "/dashboard/orders",
  returns:         "/dashboard/returns",
  listing:         "/dashboard/listing",
  inventory:       "/dashboard/inventory",
  settlements:     "/dashboard/settlements",
  help:            "/dashboard/help",
  advertisement:   "/dashboard/advertisement",
  haatzup:         "/dashboard/haatzaup",
  growplan:        "/dashboard/growplan",
  productinsight:  "/dashboard/productinsight",
  warehouse:       "/dashboard/warehouse",
  influencer:      "/dashboard/influencer",
  growthcentral:   "/dashboard/growthcentral",
  qualityinsights: "/dashboard/qualityinsights",
  referandearn:    "/refer-earn",
  settings:        "/dashboard/settings",
};
 
/* Reverse map — lets active highlight follow the URL automatically */
const ROUTE_TO_KEY = Object.fromEntries(
  Object.entries(KEY_TO_ROUTE).map(([k, v]) => [v, k])
);

/* ─────────────────────────────────────────────────────────────
   NAV DATA
   ───────────────────────────────────────────────────────────── */
const NAV_SECTIONS = [
  {
    heading: "Manage Business",
    items: [
      {
        key: "orders", label: "Orders", badge: "12",
        icon: React.createElement("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
          React.createElement("path", { d: "M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" }),
          React.createElement("line", { x1: "3", y1: "6", x2: "21", y2: "6" }),
          React.createElement("path", { d: "M16 10a4 4 0 01-8 0" })
        ),
      },
      {
        key: "returns", label: "Return / Exchange",
        icon: React.createElement("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
          React.createElement("polyline", { points: "1 4 1 10 7 10" }),
          React.createElement("path", { d: "M3.51 15a9 9 0 102.13-9.36L1 10" })
        ),
      },
      {
        key: "listing", label: "Listing",
        icon: React.createElement("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
          React.createElement("line", { x1: "8", y1: "6", x2: "21", y2: "6" }),
          React.createElement("line", { x1: "8", y1: "12", x2: "21", y2: "12" }),
          React.createElement("line", { x1: "8", y1: "18", x2: "21", y2: "18" }),
          React.createElement("line", { x1: "3", y1: "6", x2: "3.01", y2: "6" }),
          React.createElement("line", { x1: "3", y1: "12", x2: "3.01", y2: "12" }),
          React.createElement("line", { x1: "3", y1: "18", x2: "3.01", y2: "18" })
        ),
      },
      {
        key: "inventory", label: "Inventory",
        icon: React.createElement("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
          React.createElement("path", { d: "M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" }),
          React.createElement("polyline", { points: "3.27 6.96 12 12.01 20.73 6.96" }),
          React.createElement("line", { x1: "12", y1: "22.08", x2: "12", y2: "12" })
        ),
      },
      {
        key: "settlements", label: "Settlements",
        icon: React.createElement(ReceiptText, { size: 20, strokeWidth: 2 }),
      },
      {
        key: "help", label: "Help",
        icon: React.createElement("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
          React.createElement("circle", { cx: "12", cy: "12", r: "10" }),
          React.createElement("path", { d: "M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" }),
          React.createElement("line", { x1: "12", y1: "17", x2: "12.01", y2: "17" })
        ),
      },
    ],
  },
  {
    heading: "Boost Sales",
    items: [
      {
        key: "advertisement", label: "Advertisement",
        icon: React.createElement("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
          React.createElement("polygon", { points: "11 5 6 9 2 9 2 15 6 15 11 19 11 5" }),
          React.createElement("path", { d: "M19.07 4.93a10 10 0 010 14.14" }),
          React.createElement("path", { d: "M15.54 8.46a5 5 0 010 7.07" })
        ),
      },
      {
        key: "haatzup", label: "HaatzUp",
        icon: React.createElement("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
          React.createElement("polyline", { points: "23 6 13.5 15.5 8.5 10.5 1 18" }),
          React.createElement("polyline", { points: "17 6 23 6 23 12" })
        ),
      },
      {
        key: "growplan", label: "Grow Plan", badge: "Pro", badgeType: "pro",
        icon: React.createElement("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
          React.createElement("circle", { cx: "12", cy: "12", r: "10" }),
          React.createElement("path", { d: "M12 8l4 4-4 4-4-4 4-4z" })
        ),
      },
      {
        key: "productinsight", label: "Product Insight",
        icon: React.createElement("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
          React.createElement("line", { x1: "18", y1: "20", x2: "18", y2: "10" }),
          React.createElement("line", { x1: "12", y1: "20", x2: "12", y2: "4" }),
          React.createElement("line", { x1: "6", y1: "20", x2: "6", y2: "14" })
        ),
      },
      {
        key: "warehouse", label: "Warehouse",
        icon: React.createElement("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
          React.createElement("path", { d: "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" }),
          React.createElement("polyline", { points: "9 22 9 12 15 12 15 22" })
        ),
      },
      {
        key: "influencer", label: "Influencer Branding",
        icon: React.createElement("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
          React.createElement("path", { d: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" }),
          React.createElement("circle", { cx: "9", cy: "7", r: "4" }),
          React.createElement("path", { d: "M23 21v-2a4 4 0 00-3-3.87" }),
          React.createElement("path", { d: "M16 3.13a4 4 0 010 7.75" })
        ),
      },
      {
        key: "growthcentral", label: "Growth Central",
        icon: React.createElement("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
          React.createElement("polyline", { points: "22 12 18 12 15 21 9 3 6 12 2 12" })
        ),
      },
      {
        key: "qualityinsights", label: "Quality Insights",
        icon: React.createElement("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
          React.createElement("circle", { cx: "12", cy: "8", r: "6" }),
          React.createElement("path", { d: "M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" })
        ),
      },
      {
        key: "referandearn", label: "Refer & Earn",
        icon: React.createElement("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
          React.createElement("polyline", { points: "20 12 20 22 4 22 4 12" }),
          React.createElement("rect", { x: "2", y: "7", width: "20", height: "5" }),
          React.createElement("line", { x1: "12", y1: "22", x2: "12", y2: "7" }),
          React.createElement("path", { d: "M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z" }),
          React.createElement("path", { d: "M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z" })
        ),
      },
    ],
  },
];

const DASHBOARD_ITEM = {
  key: "dashboard",
  label: "Dashboard",
  icon: React.createElement("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
    React.createElement("rect", { x: "3", y: "3", width: "7", height: "7" }),
    React.createElement("rect", { x: "14", y: "3", width: "7", height: "7" }),
    React.createElement("rect", { x: "14", y: "14", width: "7", height: "7" }),
    React.createElement("rect", { x: "3", y: "14", width: "7", height: "7" })
  ),
};

const BOTTOM_ITEMS = [
  {
    key: "settings", label: "Settings",
    icon: React.createElement("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
      React.createElement("circle", { cx: "12", cy: "12", r: "3" }),
      React.createElement("path", { d: "M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" })
    ),
  },
  {
    key: "logout", label: "Logout", danger: true,
    icon: React.createElement("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
      React.createElement("path", { d: "M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" }),
      React.createElement("polyline", { points: "16 17 21 12 16 7" }),
      React.createElement("line", { x1: "21", y1: "12", x2: "9", y2: "12" })
    ),
  },
];

/* ─────────────────────────────────────────────────────────────
   ICONS
   ───────────────────────────────────────────────────────────── */
const ChevronLeftIcon = () =>
  React.createElement("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round" },
    React.createElement("polyline", { points: "15 18 9 12 15 6" })
  );

const ChevronRightIcon = () =>
  React.createElement("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round" },
    React.createElement("polyline", { points: "9 18 15 12 9 6" })
  );

/* ─────────────────────────────────────────────────────────────
   SIDEBAR TOOLTIP
   ───────────────────────────────────────────────────────────── */
function SidebarTooltip({ label, anchorRect, visible }) {
  const tooltipRef = useRef(null);
  const [coords, setCoords]   = useState({ top: 0, left: 0 });
  const [ready,  setReady]    = useState(false);

  useEffect(() => {
    if (!anchorRect) { setReady(false); return; }

    const GAP = 14;
    const estimatedH = tooltipRef.current ? tooltipRef.current.offsetHeight : 36;

    const rawTop  = anchorRect.top  + anchorRect.height / 2 - estimatedH / 2;
    const rawLeft = anchorRect.right + GAP;

    const maxTop = window.innerHeight - estimatedH - 8;
    setCoords({ top: Math.max(8, Math.min(rawTop, maxTop)), left: rawLeft });
    setReady(true);
  }, [anchorRect]);

  if (!label) return null;

  return ReactDOM.createPortal(
    React.createElement(
      "div",
      {
        ref:          tooltipRef,
        className:    ["sidebar-tooltip", visible && ready ? "sidebar-tooltip--visible" : ""].filter(Boolean).join(" "),
        style:        { top: coords.top, left: coords.left },
        "aria-hidden": "true",
      },
      React.createElement("span", { className: "sidebar-tooltip__caret", "aria-hidden": "true" }),
      label
    ),
    document.body
  );
}

/* ─────────────────────────────────────────────────────────────
   NAV ITEM
   ───────────────────────────────────────────────────────────── */
function NavItem({ item, active, onClick, isCollapsed, onTooltipShow, onTooltipHide, tooltipActiveKey }) {
  const btnRef = useRef(null);
  const isTouchDevice = useRef(false);

  useEffect(() => {
    isTouchDevice.current = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }, []);

  const handleMouseEnter = useCallback(() => {
    if (!isCollapsed || !onTooltipShow) return;
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) onTooltipShow(item.label, rect, item.key);
  }, [isCollapsed, onTooltipShow, item.label, item.key]);

  const handleMouseLeave = useCallback(() => {
    if (onTooltipHide) onTooltipHide();
  }, [onTooltipHide]);

  const handleTouchStart = useCallback((e) => {
    if (!isCollapsed || !onTooltipShow || !isTouchDevice.current) return;
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) {
      onTooltipShow(item.label, rect, item.key);
    }
  }, [isCollapsed, onTooltipShow, item.label, item.key, isTouchDevice]);

  const handleTouchEnd = useCallback((e) => {
    setTimeout(() => {
      if (onClick) onClick(item.key);
    }, 50);
  }, [onClick, item.key]);

  return React.createElement(
    "button",
    {
      ref:          btnRef,
      className:    [
        "nav-item",
        active      ? "nav-item--active"    : "",
        item.danger ? "nav-item--danger"    : "",
        isCollapsed ? "nav-item--icon-only" : "",
        tooltipActiveKey === item.key ? "nav-item--tooltip-active" : "",
      ].filter(Boolean).join(" "),
      onClick:      (e) => {
        e.stopPropagation();
        if (onClick) onClick(item.key);
      },
      onMouseEnter: handleMouseEnter,
      onMouseLeave: handleMouseLeave,
      onTouchStart: handleTouchStart,
      onTouchEnd:   handleTouchEnd,
      "aria-label": item.label,
    },
    React.createElement("span", { className: "nav-item__icon" }, item.icon),
    !isCollapsed && React.createElement("span", { className: "nav-item__label" }, item.label),
    !isCollapsed && item.badge &&
      React.createElement("span", {
        className: `nav-item__badge${item.badgeType === "pro" ? " nav-item__badge--pro" : ""}`,
      }, item.badge)
  );
}

/* ─────────────────────────────────────────────────────────────
   SELLER PROFILE
   ───────────────────────────────────────────────────────────── */
function SellerProfile({ sellerName = "", sellerEmail = "", sellerPhone = "", sellerId = "", onProfileClick, isCollapsed }) {
  const initials = sellerName
    .split(" ")
    .map(n => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "";

  const profileInfo = !isCollapsed
    ? React.createElement(
        "div",
        { className: "profile__info" },
        React.createElement("p", { className: "profile__name" }, sellerName || ""),
        React.createElement(
          "div",
          { className: "profile__email-container" },
          React.createElement("p", { className: "profile__email" }, sellerEmail || "seller@haatza.com"),
          
        )
      )
    : null;

  return React.createElement(
    "div",
    {
      className: [
        "sidebar__profile",
        isCollapsed ? "sidebar__profile--mini" : "",
      ].filter(Boolean).join(" "),
      title: isCollapsed ? sellerName : undefined,
    },
    React.createElement(
      "div",
      { className: "profile__avatar" },
      React.createElement("span", { className: "profile__avatar-initials" }, initials)
    ),
    profileInfo
  );
}

/* ─────────────────────────────────────────────────────────────
   SIDEBAR
   ───────────────────────────────────────────────────────────── */
function Sidebar({
  sellerName     = "",
  sellerEmail    = "",
  sellerPhone    = "",
  sellerId       = "",
  onProfileClick = () => {},
  onCollapseChange,
  isOpen         = true,
}) {
  const { user, logout } = useAuth();
  const seller = user || {};

  const sellerNameResolved =
    seller.name ||
    seller.fullName ||
    seller.sellerName ||
    seller.userName ||
    seller.firstName ||
    seller.nickname ||
    sellerName ||
    "";
  const sellerEmailResolved = seller.email || sellerEmail || "";
  const sellerPhoneResolved = seller.phone || sellerPhone || "";
  const sellerIdResolved = seller.sellerId || sellerId || "";

  const navigate  = useNavigate();
  const location  = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(
    () => typeof window !== "undefined" && window.innerWidth <= 768
  );

  /* ── NEW: Logout confirmation modal state ─────────────────── */
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const activeKey = (() => {
    const path = location.pathname;

    if (
      path.includes("/referearn") ||
      path.includes("/referandearn") ||
      path.includes("/refer-earn") ||
      location.state?.type === "referral" ||
      location.state?.type === "faq"
    ) {
      return "referandearn";
    }
    if (path.includes("/orders"))      return "orders";
    if (path.includes("/returns") || path.includes("/return-exchange")) return "returns";
    if (path.includes("/listing") || path.includes("/my-listings") || path.includes("/inprogress-listings")) return "listing";
    if (path.includes("/inventory"))   return "inventory";
    if (path.includes("/settlements") || path.includes("/payments")) return "settlements";
    if (path.includes("/settings"))    return "settings";
    if (path.includes("/help"))        return "help";
    if (path.includes("/advertisement")) return "advertisement";
    if (path.includes("/haatzaup") || path.includes("/haatzup")) return "haatzup";
    if (path.includes("/growplan"))    return "growplan";
    if (path.includes("/product-insight") || path.includes("/productinsight")) return "productinsight";
    if (path.includes("/warehouse"))   return "warehouse";
    if (path.includes("/influencer"))  return "influencer";
    if (path.includes("/growthcentral")) return "growthcentral";
    if (path.includes("/qualityinsights")) return "qualityinsights";
    if (path === "/dashboard" || path === "/" || path.startsWith("/dashboard/")) return "dashboard";
    return ROUTE_TO_KEY[path] || "";
  })();

  /* ── Dynamic badge counts ─────────────────────────────────── */
  const [menuSections, setMenuSections] = useState(NAV_SECTIONS);
  const activeSellerId = sellerIdResolved || getSellerId();

  useEffect(() => {
    if (!activeSellerId) return;

    const fetchCounts = async () => {
      try {
        const [ordersRes, ticketsRes, notifRes, walletRes, campaignRes] = await Promise.allSettled([
          sellerService.getSellerNewOrders(activeSellerId),
          sellerService.getTickets(activeSellerId),
          sellerService.getNotifications(activeSellerId),
          sellerService.checkWalletBalance(activeSellerId),
          sellerService.getAdvertisementSummary(activeSellerId),
        ]);

        let ordersCount = 0;
        if (ordersRes.status === "fulfilled") {
          const rawOrders = ordersRes.value?.data || ordersRes.value?.message || [];
          ordersCount = Array.isArray(rawOrders)
            ? rawOrders.filter(o => o.status === "new" || o.status === "pending").length
            : (ordersRes.value?.count || 0);
        }

        let ticketsCount = 0;
        if (ticketsRes.status === "fulfilled") {
          const rawTickets = ticketsRes.value?.message?.data || ticketsRes.value?.data || ticketsRes.value?.tickets || [];
          ticketsCount = Array.isArray(rawTickets)
            ? rawTickets.filter(t => t.status !== "Closed" && t.status !== "Resolved").length
            : 0;
        }

        let unreadNotifCount = 0;
        if (notifRes.status === "fulfilled") {
          const rawNotifs = notifRes.value?.message?.data || notifRes.value?.data || [];
          unreadNotifCount = Array.isArray(rawNotifs)
            ? rawNotifs.filter(n => !n.read && n.status !== "read").length
            : 0;
        }

        let walletLabel = "";
        if (walletRes.status === "fulfilled") {
          const bal = Number(walletRes.value?.message?.RemainingBalance || walletRes.value?.RemainingBalance || 0);
          walletLabel = `₹${bal.toFixed(2)}`;
        }

        let activeCampaigns = 0;
        if (campaignRes.status === "fulfilled") {
          const summary = campaignRes.value?.data || campaignRes.value?.message || {};
          activeCampaigns = summary.activeCampaigns || summary.ActiveCampaignsCount || 0;
        }

        setMenuSections(prevSections =>
          prevSections.map(section => ({
            ...section,
            items: section.items.map(item => {
              if (item.key === "orders")        return { ...item, badge: ordersCount > 0      ? String(ordersCount)         : undefined };
              if (item.key === "help")          return { ...item, badge: ticketsCount > 0     ? String(ticketsCount)        : undefined };
              if (item.key === "notifications") return { ...item, badge: unreadNotifCount > 0 ? String(unreadNotifCount)    : undefined };
              if (item.key === "wallet")        return { ...item, badge: walletLabel           ? walletLabel                : undefined };
              if (item.key === "advertisement") return { ...item, badge: activeCampaigns > 0  ? `${activeCampaigns} Active` : undefined };
              return item;
            }),
          }))
        );
      } catch (err) {
        console.warn("[Sidebar] Error updating dynamic counts:", err);
      }
    };

    fetchCounts();
    const interval = setInterval(fetchCounts, 30000);
    return () => clearInterval(interval);
  }, [activeSellerId]);

  /* ── Tooltip state ────────────────────────────────────────── */
  const [tooltip, setTooltip] = useState({ 
    label: "", 
    anchorRect: null, 
    visible: false,
    activeKey: null 
  });
  const hideTimer = useRef(null);
  const isTouchDevice = useRef(false);

  useEffect(() => {
    isTouchDevice.current = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }, []);

  const handleTooltipShow = useCallback((label, anchorRect, key) => {
    clearTimeout(hideTimer.current);
    setTooltip({ label, anchorRect, visible: true, activeKey: key });
  }, []);

  const handleTooltipHide = useCallback(() => {
    if (!isTouchDevice.current) {
      clearTimeout(hideTimer.current);
      setTooltip({ label: "", anchorRect: null, visible: false, activeKey: null });
    }
  }, [isTouchDevice]);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (isCollapsed && tooltip.visible && isTouchDevice.current) {
        if (!e.target.closest('.sidebar') && !e.target.closest('.sidebar-tooltip')) {
          setTooltip({ label: "", anchorRect: null, visible: false, activeKey: null });
        }
      }
    };

    if (isCollapsed && isTouchDevice.current) {
      document.addEventListener('touchstart', handleOutsideClick, { passive: true });
      document.addEventListener('click', handleOutsideClick);
    }

    return () => {
      document.removeEventListener('touchstart', handleOutsideClick);
      document.removeEventListener('click', handleOutsideClick);
    };
  }, [isCollapsed, tooltip.visible, isTouchDevice]);

  useEffect(() => {
    let rafId;
    const updateTooltipPosition = () => {
      if (tooltip.visible && tooltip.anchorRect && isCollapsed && isTouchDevice.current) {
        const navItems = document.querySelectorAll('.nav-item');
        for (let item of navItems) {
          if (item.classList.contains(`nav-item--tooltip-active`)) {
            const rect = item.getBoundingClientRect();
            setTooltip(prev => ({ ...prev, anchorRect: rect }));
            break;
          }
        }
      }
      rafId = requestAnimationFrame(updateTooltipPosition);
    };

    if (tooltip.visible && isCollapsed && isTouchDevice.current) {
      rafId = requestAnimationFrame(updateTooltipPosition);
    }

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [tooltip.visible, tooltip.activeKey, isCollapsed, isTouchDevice]);

  useEffect(() => {
    if (!isCollapsed) {
      clearTimeout(hideTimer.current);
      setTooltip({ label: "", anchorRect: null, visible: false, activeKey: null });
    }
  }, [isCollapsed]);

  /* ── Breakpoint listener ──────────────────────────────────── */
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const onBreakpoint = (e) => { 
      if (e.matches) {
        setIsCollapsed(true);
        setTooltip({ label: "", anchorRect: null, visible: false, activeKey: null });
      }
    };
    mq.addEventListener("change", onBreakpoint);
    return () => mq.removeEventListener("change", onBreakpoint);
  }, []);

  useEffect(() => {
    if (typeof onCollapseChange === "function") onCollapseChange(isCollapsed);
  }, [isCollapsed, onCollapseChange]);

  const handleToggle    = useCallback(() => setIsCollapsed(prev => !prev), []);

  /* ─────────────────────────────────────────────────────────
     handleItemClick — "logout" now opens the confirmation
     modal instead of immediately running logout().
     All other nav items behave exactly as before.
  ───────────────────────────────────────────────────────── */
  const handleItemClick = useCallback((key) => {
    if (key === "logout") {
      setShowLogoutModal(true); // open confirmation popup
      return;
    }
    const route = KEY_TO_ROUTE[key];
    if (route) navigate(route);
  }, [navigate]);

  /* ── Confirmed logout: run existing auth logout + navigate ─ */
  const handleLogoutConfirm = useCallback(() => {
    setShowLogoutModal(false);
    logout();
    navigate("/signup");
  }, [logout, navigate]);

  /* ── Cancelled: just close the popup ─────────────────────── */
  const handleLogoutCancel = useCallback(() => {
    setShowLogoutModal(false);
  }, []);

  const handleProfileClick = useCallback((e) => { 
    e.stopPropagation(); 
    onProfileClick(); 
  }, [onProfileClick]);

  const getToggleLeft = useCallback(() => {
    if (isCollapsed) {
      const miniW = getComputedStyle(document.documentElement).getPropertyValue("--sidebar-width-mini").trim();
      return miniW || "76px";
    }
    const w = getComputedStyle(document.documentElement).getPropertyValue("--sidebar-width").trim();
    return w || "280px";
  }, [isCollapsed]);

  const tooltipCallbacks = isCollapsed
    ? { 
        onTooltipShow: handleTooltipShow, 
        onTooltipHide: handleTooltipHide,
        tooltipActiveKey: tooltip.activeKey
      }
    : {};

  /* ── Sidebar content ──────────────────────────────────────── */
  const content = React.createElement(
    React.Fragment, null,

    React.createElement(SellerProfile, { sellerName: sellerNameResolved, sellerEmail: sellerEmailResolved, sellerPhone: sellerPhoneResolved, sellerId: activeSellerId, onProfileClick: handleProfileClick, isCollapsed }),

    React.createElement("div", { className: "sidebar__divider" }),

    React.createElement("div", { className: "sidebar__primary-nav" },
      React.createElement(NavItem, { item: DASHBOARD_ITEM, active: activeKey === DASHBOARD_ITEM.key, onClick: handleItemClick, isCollapsed, ...tooltipCallbacks })
    ),

    React.createElement("div", { className: "sidebar__divider" }),

    React.createElement("nav", { className: "sidebar__nav" },
      menuSections.map((section) =>
        React.createElement("div", { key: section.heading, className: "nav-section" },
          !isCollapsed && React.createElement("p", { className: "nav-section__heading" }, section.heading),
          section.items.map((item) =>
            React.createElement(NavItem, { key: item.key, item, active: activeKey === item.key, onClick: handleItemClick, isCollapsed, ...tooltipCallbacks })
          )
        )
      )
    ),

    React.createElement("div", { className: "sidebar__bottom" },
      React.createElement("div", { className: "sidebar__divider sidebar__divider--bottom" }),
      BOTTOM_ITEMS.map((item) =>
        React.createElement(NavItem, { key: item.key, item, active: activeKey === item.key, onClick: handleItemClick, isCollapsed, ...tooltipCallbacks })
      )
    )
  );

  return React.createElement(
    React.Fragment, null,

    /* ── Logout confirmation modal ────────────────────────── */
    React.createElement(LogoutConfirmModal, {
      isOpen: showLogoutModal,
      onYes:  handleLogoutConfirm,
      onNo:   handleLogoutCancel,
    }),

    /* ── Floating tooltip portal ──────────────────────────── */
    React.createElement(SidebarTooltip, tooltip),

    /* ── Toggle button ────────────────────────────────────── */
    React.createElement(
      "button",
      {
        className:    "sidebar__external-toggle",
        style:        { left: getToggleLeft() },
        onClick:      handleToggle,
        "aria-label": isCollapsed ? "Expand sidebar" : "Collapse sidebar",
        title:        isCollapsed ? "Expand sidebar" : "Collapse sidebar",
      },
      isCollapsed ? React.createElement(ChevronRightIcon) : React.createElement(ChevronLeftIcon)
    ),

    /* ── Sidebar shell ────────────────────────────────────── */
    React.createElement(
      "aside",
      {
        className: [
          "sidebar",
          isCollapsed ? "sidebar--mini" : "",
          isOpen ? "sidebar--open" : "",
        ].filter(Boolean).join(" "),
      },
      content
    )
  );
}

export default Sidebar;
