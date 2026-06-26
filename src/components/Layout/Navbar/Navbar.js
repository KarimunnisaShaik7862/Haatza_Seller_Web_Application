import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import LogoutConfirmModal from "../../common/LogoutConfirmModal/LogoutConfirmModal";
import "./Navbar.css";
import haatzaSellerLogo from "../../../assets/Images/haatzaSellerlogo.png";
import {
  Bell,
  Wallet,
  MessageSquare,
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

const HaatzaNavbar = ({ seller: propSeller = {}, onToggleSidebar }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const seller = user || propSeller || {};
  console.log("Navbar Seller Data:", seller);

  const [dropdownOpen, setDropdownOpen]         = useState(false);
  const [mobileIconsOpen, setMobileIconsOpen]   = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [searchFocused, setSearchFocused]       = useState(false);
  const [searchValue, setSearchValue]           = useState("");
  const [scrolled, setScrolled]                 = useState(false);

  /* ── NEW: Logout confirmation modal state ─────────────────── */
  const [showLogoutModal, setShowLogoutModal]   = useState(false);

  // Dropdown states
  const [remindersDropdownOpen, setRemindersDropdownOpen] = useState(false);

  const dropdownRef   = useRef(null);
  const mobileIconRef = useRef(null);

  const greeting = getGreeting();

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

  const toggleRemindersDropdown = () => {
    const nextState = !remindersDropdownOpen;
    setRemindersDropdownOpen(nextState);
    setDropdownOpen(false);
  };

  const RemindersDropdownMenu = () => {
    return React.createElement(
      "div", { className: "navbar-dropdown-panel reminders-dropdown" },
      React.createElement("div", { className: "dropdown-panel-header" },
        React.createElement("h3", null, "Reminders")
      ),
      React.createElement("div", { className: "dropdown-panel-body" },
        React.createElement("div", { className: "panel-empty" }, "No reminders available.")
      )
    );
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
      if (!e.target.closest(".reminders-dropdown-container")) {
        setRemindersDropdownOpen(false);
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
      onClick: () => { setDropdownOpen(false); navigate("/dashboard/settings"); }
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

          /* Hamburger Toggle Button (mobile/tablet only) */
          React.createElement(
            "button",
            {
              className: "navbar-hamburger-btn",
              title: "Toggle Sidebar",
              onClick: onToggleSidebar,
              "aria-label": "Toggle sidebar navigation",
            },
            React.createElement(
              "svg",
              {
                width: "20",
                height: "20",
                viewBox: "0 0 24 24",
                fill: "none",
                stroke: "currentColor",
                strokeWidth: "2.5",
                strokeLinecap: "round",
                strokeLinejoin: "round",
              },
              React.createElement("line", { x1: "3", y1: "12", x2: "21", y2: "12" }),
              React.createElement("line", { x1: "3", y1: "6", x2: "21", y2: "6" }),
              React.createElement("line", { x1: "3", y1: "18", x2: "21", y2: "18" })
            )
          ),

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
          React.createElement(
            "div",
            { className: `search-wrap desktop-search ${searchFocused ? "focused" : ""}` },
            React.createElement(Search, { className: "search-icon", size: 16 }),
            React.createElement("input", {
              type: "text",
              className: "search-input",
              placeholder: "Search products, orders…",
              value: searchValue,
              onChange: (e) => setSearchValue(e.target.value),
              onFocus: () => setSearchFocused(true),
              onBlur:  () => setSearchFocused(false),
            }),
            searchValue &&
              React.createElement(
                "button",
                { className: "search-clear", onClick: () => setSearchValue("") },
                React.createElement(X, { size: 14 })
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
                  className: `icon-btn ${location.pathname === "/wallet" ? "active" : ""}`,
                  title: "Wallet",
                  onClick: () => navigate("/wallet"),
                },
                React.createElement(Wallet, { size: 20 })
              )
            ),

            /* Messages Icon + Reminders Panel */
            React.createElement(
              "div", { className: "reminders-dropdown-container" },
              React.createElement(
                "button",
                {
                  className: `icon-btn ${remindersDropdownOpen ? "active" : ""}`,
                  title: "Messages",
                  onClick: toggleRemindersDropdown,
                },
                React.createElement(MessageSquare, { size: 20 })
              ),
              remindersDropdownOpen && RemindersDropdownMenu()
            )
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
                      React.createElement("p", { className: "dropdown-role" }, sellerRole),
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
        React.createElement(Search, { className: "search-icon", size: 16 }),
        React.createElement("input", {
          type: "text",
          className: "search-input",
          placeholder: "Search products, orders…",
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

        React.createElement(
          "button",
          {
            className: "mobile-drawer-icon-btn",
            title: "Messages",
            onClick: () => { setMobileIconsOpen(false); navigate("/notifications"); },
          },
          React.createElement(
            "div", { className: "mobile-drawer-icon" },
            React.createElement(MessageSquare, { size: 22 })
          ),
          React.createElement("span", { className: "icon-label" }, "Messages")
        )
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
