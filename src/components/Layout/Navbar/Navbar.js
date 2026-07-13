import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { sellerService } from "../../../services/sellerService";
import LogoutConfirmModal from "../../common/LogoutConfirmModal/LogoutConfirmModal";
import "./Navbar.css";
import haatzaSellerLogo from "../../../assets/Images/haatzaSellerlogo.png";
import {
  Bell,
  Wallet,
  Search,
  ChevronDown,
  User,
  Settings,
  HelpCircle,
  LogOut,
  X,
} from "lucide-react";

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
};

const HaatzaNavbar = ({ seller: propSeller = {} }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const seller = user || propSeller || {};
  console.log("Navbar Seller Data:", seller);

  const sellerName    =
    seller.name ||
    seller.fullName ||
    seller.sellerName ||
    seller.userName ||
    seller.firstName ||
    seller.nickname ||
    "";
  const sellerEmail   = seller.email         || "";
  const sellerRole    = seller.role          || "Seller";
  const sellerId      = seller.sellerId      || "";
  const sellerInitial = seller.avatarInitial || (sellerName ? sellerName.charAt(0).toUpperCase() : "");
  const sellerLogoUrl = seller.logoUrl       || null;

  const [dropdownOpen, setDropdownOpen]         = useState(false);
  const [mobileIconsOpen, setMobileIconsOpen]   = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [searchFocused, setSearchFocused]       = useState(false);
  const [searchValue, setSearchValue]           = useState("");
  const [scrolled, setScrolled]                 = useState(false);
  const [activePlan, setActivePlan]             = useState("Free Plan");

  useEffect(() => {
    if (!sellerEmail) return;
    let isMounted = true;
    
    sellerService.fetchSubscriptionPlan(sellerEmail)
      .then(res => {
        if (!isMounted) return;
        const data = res?.data ?? res ?? {};
        const orders = data?.message?.orders || data?.orders || [];
        
        if (Array.isArray(orders) && orders.length > 0) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          const parseDate = (val) => {
            if (!val) return null;
            const d = new Date(val);
            return isNaN(d.getTime()) ? null : d;
          };

          const getDateTime = (sub) => {
            const d = parseDate(
              sub?.startedDate ||
              sub?.startDate ||
              sub?.endedDate ||
              sub?.endDate ||
              sub?.createdDate ||
              sub?.createdAt ||
              0
            );
            return d ? d.getTime() : 0;
          };

          const isActiveNow = (sub) => {
            const status = String(sub?.status || "").toLowerCase();
            const start = parseDate(sub?.startedDate || sub?.startDate);
            const end = parseDate(sub?.endedDate || sub?.endDate);
            if (!start || !end) return false;

            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);

            return status === "active" && today >= start && today <= end;
          };

          const activeNow = orders.find(isActiveNow);
          let latest = activeNow;
          if (!latest) {
            const active = orders.find(
              (sub) => String(sub?.status || "").toLowerCase() === "active"
            );
            if (active) {
              latest = active;
            } else {
              const scheduled = orders
                .filter((sub) => String(sub?.status || "").toLowerCase() === "scheduled")
                .sort((a, b) => getDateTime(b) - getDateTime(a))[0];
              if (scheduled) {
                latest = scheduled;
              } else {
                latest = [...orders].sort((a, b) => getDateTime(b) - getDateTime(a))[0];
              }
            }
          }
          
          if (latest) {
            const rawPlan = latest.planName || latest.plan || latest.subscriptionPlan || "Free Plan";
            let formatted = String(rawPlan).trim();
            if (formatted.toLowerCase() === "free") {
              formatted = "Free Plan";
            }
            if (formatted && !formatted.toLowerCase().endsWith("plan")) {
              formatted = `${formatted} Plan`;
            }
            setActivePlan(formatted);
          } else {
            setActivePlan("Free Plan");
          }
        } else {
          setActivePlan("Free Plan");
        }
      })
      .catch(err => {
        console.error("[Navbar] Fetch subscription failed:", err);
      });
      
    return () => { isMounted = false; };
  }, [sellerEmail, location.pathname]);

  /* ── NEW: Logout confirmation modal state ─────────────────── */
/* ── NEW: Logout confirmation modal state ─────────────────── */
  const [showLogoutModal, setShowLogoutModal]   = useState(false);

  const dropdownRef   = useRef(null);
  const mobileIconRef = useRef(null);

const greeting = getGreeting();

  /* ── Static module list for the search-as-navigator feature ── */
  const MODULE_LIST = [
    { label: "Dashboard", route: "/dashboard" },
    { label: "Orders", route: "/dashboard/orders" },
    { label: "Return / Exchange", route: "/dashboard/returns" },
    { label: "Listing", route: "/dashboard/listing" },
    { label: "Inventory", route: "/dashboard/inventory" },
    { label: "Settlements", route: "/dashboard/settlements" },
    { label: "Help", route: "/dashboard/help" },
    { label: "Advertisement", route: "/dashboard/advertisement" },
    { label: "Campaign", route: "/dashboard/advertisement" },
    { label: "Group Plan", route: "/dashboard/growplan" },
    { label: "Product Insight", route: "/dashboard/productinsight" },
    { label: "Warehouse", route: "/dashboard/warehouse" },
    { label: "Influencer Branding", route: "/dashboard/influencer" },
    { label: "Growth Central", route: "/dashboard/growthcentral" },
    { label: "Quality Insights", route: "/dashboard/qualityinsights" },
    { label: "Refer & Earn", route: "/refer-earn" },
    { label: "Settings", route: "/dashboard/settings" },
    { label: "Wallet", route: "/wallet" },
    { label: "Notifications", route: "/notifications" },
    { label: "Profile", route: "/profile" },
  ];

  const filteredModules = searchValue.trim()
    ? MODULE_LIST.filter((m) =>
        m.label.toLowerCase().includes(searchValue.trim().toLowerCase())
      )
    : [];

  const handleModuleSelect = (route) => {
    navigate(route);
    setSearchValue("");
    setSearchFocused(false);
    setMobileSearchOpen(false);
  };


 useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
      if (
        mobileIconRef.current &&
        !mobileIconRef.current.contains(e.target) &&
        !e.target.closest(".mobile-icons-toggle-btn")
      ) {
        setMobileIconsOpen(false);
      }
      if (
        !e.target.closest(".mobile-search-bar") &&
        !e.target.closest(".mobile-search-icon-btn")
      ) {
        setMobileSearchOpen(false);
      }
      
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  /* ── Confirmed logout: run existing auth logout + navigate ── */
  const handleLogoutConfirm = () => {
    setShowLogoutModal(false);
    logout();
    navigate("/signup");
  };

  /* ── Cancelled: just close the popup ─────────────────────── */
  const handleLogoutCancel = () => {
    setShowLogoutModal(false);
  };

  const dropdownItems = [
   {
      icon: React.createElement(User, { size: 16 }),
      label: "My Profile",
      danger: false,
      onClick: () => { setDropdownOpen(false); navigate("/profile"); }
    },
    {
      icon: React.createElement(Settings, { size: 16 }),
      label: "Business Settings",
      danger: false,
      onClick: () => { setDropdownOpen(false); navigate("/dashboard/settings"); }
    },
    {
      icon: React.createElement(Wallet, { size: 16 }),
      label: "Wallet",
      danger: false,
      onClick: () => { setDropdownOpen(false); navigate("/wallet"); }
    },
    {
      icon: React.createElement(HelpCircle, { size: 16 }),
      label: "Help Center",
      danger: false,
      onClick: () => { setDropdownOpen(false); navigate("/help-center"); }
    },
    {
      /* ── CHANGED: instead of running logout() directly, open the modal ── */
      icon: React.createElement(LogOut, { size: 16 }),
      label: "Logout",
      danger: true,
      onClick: () => {
        setDropdownOpen(false);       // close the profile dropdown first
        setShowLogoutModal(true);     // then show the confirmation popup
      }
    },
  ];

  /* ── Avatar: letter or logo image ── */
  const AvatarContent = () =>
    sellerLogoUrl
      ? React.createElement(
          "div", { className: "avatar" },
          React.createElement("img", { src: sellerLogoUrl, alt: sellerName, className: "avatar-img" })
        )
      : React.createElement("div", { className: "avatar" }, sellerInitial);

  /* ── Dropdown avatar (slightly larger) ── */
  const DropdownAvatarContent = () =>
    sellerLogoUrl
      ? React.createElement(
          "div", { className: "dropdown-avatar" },
          React.createElement("img", { src: sellerLogoUrl, alt: sellerName, className: "avatar-img" })
        )
      : React.createElement("div", { className: "dropdown-avatar" }, sellerInitial);

  /* ── Greeting text shared between mobile & desktop center ── */
  const GreetingText = () => {
    const firstName = sellerName ? sellerName.trim().split(/\s+/)[0] : "";
    return React.createElement(
      "p", { className: "greeting-text" },
      greeting,
      firstName
        ? React.createElement(
            React.Fragment, null,
            ", ",
            React.createElement("span", { className: "greeting-name" }, firstName)
          )
        : null,
      " 👋"
    );
  };

  /* ── 3-dot vertical icon SVG ── */
  const ThreeDotsIcon = () =>
    React.createElement(
      "svg",
      {
        width: "20", height: "20",
        viewBox: "0 0 24 24",
        fill: "currentColor",
        xmlns: "http://www.w3.org/2000/svg",
      },
      React.createElement("circle", { cx: "12", cy: "5",  r: "1.5" }),
      React.createElement("circle", { cx: "12", cy: "12", r: "1.5" }),
      React.createElement("circle", { cx: "12", cy: "19", r: "1.5" })
    );

  return React.createElement(
    React.Fragment,
    null,

    /* ══════════════════════════════════════════════
       LOGOUT CONFIRMATION MODAL
    ══════════════════════════════════════════════ */
    React.createElement(LogoutConfirmModal, {
      isOpen: showLogoutModal,
      onYes:  handleLogoutConfirm,
      onNo:   handleLogoutCancel,
    }),

    /* ══════════════════════════════════════════════
       NAVBAR
    ══════════════════════════════════════════════ */
    React.createElement(
      "nav",
      { className: `haatza-navbar ${scrolled ? "scrolled" : ""}` },
      React.createElement(
        "div",
        { className: "navbar-inner" },

        /* ── LEFT: Logo + Search ── */
        React.createElement(
          "div",
          { className: "navbar-left" },

          /* Logo */
          React.createElement(
            "div", { className: "logo-wrap" },
            React.createElement("img", {
              src: haatzaSellerLogo,
              alt: "Haatza Seller",
              className: "brand-logo-img",
            })
          ),

          /* Mobile search tap icon (≤639px only, shown via CSS) */
          React.createElement(
            "button",
            {
              className: "icon-btn mobile-search-icon-btn",
              title: "Search",
              onClick: () => setMobileSearchOpen((p) => !p),
            },
            React.createElement(Search, { size: 20 })
          ),

          /* Desktop / Tablet search bar (hidden on ≤639px via CSS) */
          /* Desktop / Tablet search bar (hidden on ≤639px via CSS) — now a module navigator */
          React.createElement(
            "div",
            { className: "search-wrap-outer" },
            React.createElement(
              "div",
              { className: `search-wrap desktop-search ${searchFocused ? "focused" : ""}` },
              React.createElement(Search, { className: "search-icon", size: 16 }),
              React.createElement("input", {
                type: "text",
                className: "search-input",
                placeholder: "Search modules (e.g. Orders, Listing)…",
                value: searchValue,
                onChange: (e) => setSearchValue(e.target.value),
                onFocus: () => setSearchFocused(true),
                onBlur:  () => setTimeout(() => setSearchFocused(false), 150),
              }),
              searchValue &&
                React.createElement(
                  "button",
                  { className: "search-clear", onClick: () => setSearchValue("") },
                  React.createElement(X, { size: 14 })
                )
            ),
            searchFocused && searchValue.trim() &&
              React.createElement(
                "div", { className: "search-suggestions" },
                filteredModules.length > 0
                  ? filteredModules.map((m, i) =>
                      React.createElement(
                        "button",
                        {
                          key: i,
                          type: "button",
                          className: "search-suggestion-item",
                          onMouseDown: (e) => e.preventDefault(),
                          onClick: () => handleModuleSelect(m.route),
                        },
                        m.label
                      )
                    )
                  : React.createElement("div", { className: "search-suggestion-empty" }, "No modules found")
              )
          )
        ),

        /* ── MOBILE CENTER greeting (≤639px) ── */
        React.createElement(
          "div", { className: "navbar-center mobile-center" },
          React.createElement(GreetingText)
        ),

        /* ── DESKTOP / TABLET CENTER greeting (≥640px) ── */
        React.createElement(
          "div", { className: "navbar-center desktop-center" },
          React.createElement(GreetingText)
        ),

        /* ── RIGHT: Icon group + Profile avatar + 3-dot ── */
        React.createElement(
          "div",
          { className: "navbar-right" },

          /* Desktop icon group (Bell, Wallet, Messages) — hidden on tablet/mobile */
          React.createElement(
            "div", { className: "icon-group" },

            /* Notifications Icon */
            React.createElement(
              "div", { className: "notif-icon-container" },
              React.createElement(
                "button",
                {
                  className: `icon-btn ${location.pathname === "/notifications" ? "active" : ""}`,
                  title: "Notifications",
                  onClick: () => navigate("/notifications"),
                },
                React.createElement(Bell, { size: 20 })
              )
            ),

            /* Wallet Icon */
            React.createElement(
              "div", { className: "wallet-icon-container" },
              React.createElement(
                "button",
                {
                  id: "navbar-wallet-btn",
                  className: `icon-btn ${location.pathname === "/wallet" ? "active" : ""}`,
                  title: "Wallet",
                  onClick: () => navigate("/wallet"),
                },
                React.createElement(Wallet, { size: 20 })
              )
            ),

           
          ),

          /* ── Profile — AVATAR ONLY button, dropdown has all details ── */
          React.createElement(
            "div",
            { className: "profile-wrap", ref: dropdownRef },

            /* Circular avatar button — no name/email/chevron visible */
            React.createElement(
              "button",
              {
                className: `profile-btn ${dropdownOpen ? "active" : ""}`,
                onClick: () => setDropdownOpen((p) => !p),
                title: sellerName || "Profile",
                "aria-label": "Open profile menu",
              },
              React.createElement(AvatarContent)
            ),

            /* Dropdown panel — reveals name, full email, role, menu items */
            dropdownOpen &&
              React.createElement(
                "div", { className: "dropdown-menu" },

                /* Header: avatar + name + full email + role */
                React.createElement(
                  "div", { className: "dropdown-header" },
                  React.createElement(DropdownAvatarContent),
                  React.createElement(
                    "div", { className: "dropdown-user-info" },
                    sellerName &&
                      React.createElement("p", { className: "dropdown-name" }, sellerName),
                    sellerEmail &&
                      React.createElement("p", { className: "dropdown-email" }, sellerEmail),
                    sellerRole &&
                      React.createElement("p", { className: "dropdown-role" }, `${sellerRole} • ${activePlan}`),
                    sellerId &&
                      React.createElement("p", { className: "dropdown-role", style: { fontSize: "11.5px", color: "rgba(0, 0, 0, 0.45)", marginTop: "2px" } }, `Seller ID: ${sellerId}`)
                  )
                ),

                React.createElement("div", { className: "dropdown-divider" }),

                React.createElement(
                  "ul", { className: "dropdown-list" },
                  dropdownItems.map((item, i) =>
                    React.createElement(
                      "li", { key: i },
                      React.createElement(
                        "button",
                        {
                          className: `dropdown-item ${item.danger ? "danger" : ""}`,
                          onClick: item.onClick
                        },
                        React.createElement("span", { className: "di-icon"  }, item.icon),
                        React.createElement("span", { className: "di-label" }, item.label)
                      )
                    )
                  )
                )
              )
          ),

          /* ── 3-dot toggle (tablet + mobile) — opens Bell/Wallet/Messages drawer ── */
          React.createElement(
            "button",
            {
              className: "mobile-icons-toggle-btn",
              onClick: () => setMobileIconsOpen((p) => !p),
              "aria-label": "Toggle notifications and wallet",
              title: "Notifications & Wallet",
            },
            React.createElement(ThreeDotsIcon)
          )
        )
      )
    ),

    /* ══════════════════════════════════════════════
       MOBILE SEARCH BAR (slides below navbar on tap)
    ══════════════════════════════════════════════ */
   mobileSearchOpen &&
      React.createElement(
        "div", { className: "mobile-search-bar" },
        React.createElement(
          "div", { className: "mobile-search-bar-row" },
          React.createElement(Search, { className: "search-icon", size: 16 }),
          React.createElement("input", {
            type: "text",
            className: "search-input",
            placeholder: "Search modules (e.g. Orders, Listing)…",
            value: searchValue,
            autoFocus: true,
            onChange: (e) => setSearchValue(e.target.value),
          }),
          React.createElement(
            "button",
            {
              className: "search-clear",
              onClick: () => {
                if (searchValue) setSearchValue("");
                else setMobileSearchOpen(false);
              },
            },
            React.createElement(X, { size: 14 })
          )
        ),
        searchValue.trim() &&
          React.createElement(
            "div", { className: "search-suggestions search-suggestions--mobile" },
            filteredModules.length > 0
              ? filteredModules.map((m, i) =>
                  React.createElement(
                    "button",
                    {
                      key: i,
                      type: "button",
                      className: "search-suggestion-item",
                      onClick: () => handleModuleSelect(m.route),
                    },
                    m.label
                  )
                )
              : React.createElement("div", { className: "search-suggestion-empty" }, "No modules found")
          )
      ),

    /* ══════════════════════════════════════════════
       MOBILE / TABLET DRAWER — Bell, Wallet, Messages
    ══════════════════════════════════════════════ */
    React.createElement(
      "div",
      {
        className: `mobile-drawer ${mobileIconsOpen ? "open" : ""}`,
        ref: mobileIconRef,
      },
      React.createElement(
        "div", { className: "mobile-icon-row" },

        React.createElement(
          "button",
          {
            className: "mobile-drawer-icon-btn",
            title: "Notifications",
            onClick: () => { setMobileIconsOpen(false); navigate("/notifications"); },
          },
          React.createElement(
            "div", { className: "mobile-drawer-icon" },
            React.createElement(Bell, { size: 22 })
          ),
          React.createElement("span", { className: "icon-label" }, "Alerts")
        ),

        React.createElement(
          "button",
          {
            className: "mobile-drawer-icon-btn",
            title: "Wallet",
            onClick: () => { setMobileIconsOpen(false); navigate("/wallet"); },
          },
          React.createElement(
            "div", { className: "mobile-drawer-icon" },
            React.createElement(Wallet, { size: 22 })
          ),
          React.createElement("span", { className: "icon-label" }, "Wallet")
        ),
     )
    ),
        

    /* Overlay to close mobile/tablet drawer */
    mobileIconsOpen &&
      React.createElement("div", {
        className: "drawer-overlay",
        onClick: () => setMobileIconsOpen(false),
      })
  );
};

export default HaatzaNavbar;
