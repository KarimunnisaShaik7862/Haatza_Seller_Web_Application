import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { sellerService } from "../../services/sellerService";
import LogoutConfirmModal from "../../components/common/LogoutConfirmModal/LogoutConfirmModal";
import "./SettingsPage.css";

const bankToIfscPrefix = {
  'abn amro': 'ABNA',
  'abu dhabi commercial bank': 'ADCB',
  'abhyudaya co-op bank ltd': 'ABHY',
  'abhyudaya co-op bank ltd.': 'ABHY',
  'allahabad bank': 'ALLA',
  'american express bank ltd': 'AEIB',
  'american express bank ltd.': 'AEIB',
  'andhra bank': 'ANDB',
  'bnp paribas': 'BNPA',
  'bob capital markets limited': 'BARB',
  'bank of novascotia': 'NOSC',
  'bank of rajsthan': 'BRAJ',
  'bank of america': 'BOFA',
  'bank of bahrain & kuwait': 'BBKM',
  'bank of bahrain and kuwait': 'BBKM',
  'bank of baroda': 'BARB',
  'bank of india': 'BKID',
  'bank of maharashtra': 'MAHB',
  'bank of punjab': 'BKPU',
  'bank of tokyo mitsubishi ltd': 'BOTM',
  'bank of tokyo mitsubishi ltd.': 'BOTM',
  'barclays bank plc': 'BARC',
  'barclays bank': 'BARC',
  'bharat co-op bank ltd': 'BCBM',
  'bharat co-op bank ltd.': 'BCBM',
  'bharat overseas bank ltd': 'BHOB',
  'bharat overseas bank ltd.': 'BHOB',
  'catholic syrian bank ltd': 'CSBK',
  'catholic syrian bank ltd.': 'CSBK',
  'cosmos bank': 'COSB',
  'canara bank': 'CNRB',
  'ceylon bank': 'BCEY',
  'central bank of india': 'CBIN',
  'centurion bank': 'CENT',
  'chinatrust commercial bank ltd': 'CTCB',
  'chinatrust commercial bank ltd.': 'CTCB',
  'cho-hung bank': 'CHBK',
  'citi bank n.a.': 'CITI',
  'citi bank': 'CITI',
  'citibank': 'CITI',
  'citicorp capital markets': 'CITI',
  'citizencredit co-op bank ltd': 'CCBL',
  'citizencredit co-op bank ltd.': 'CCBL',
  'city union bank ltd': 'CIUB',
  'city union bank ltd.': 'CIUB',
  'corpbank securities ltd': 'CORP',
  'corpbank securities ltd.': 'CORP',
  'corporation bank': 'CORP',
  'dombivli nagri sahakari bank ltd': 'DNSB',
  'dombivli nagri sahakari bank ltd.': 'DNSB',
  'dsp merrill lynch limited': 'DSPM',
  'dena bank': 'BKDN',
  'deutsche bank': 'DEUT',
  'deutsche securities': 'DEUT',
  'development bank of singapore': 'DBSS',
  'development credit bank': 'DCBL',
  'dhanalakshmi bank': 'DLXB',
  'federal bank': 'FDRL',
  'greater bombay co-op bank': 'GBCB',
  'hdfc bank': 'HDFC',
  'hsbc': 'HSBC',
  'hsbc bank': 'HSBC',
  'icici bank': 'ICIC',
  'idbi': 'IBKL',
  'idbi bank': 'IBKL',
  'ing vysya bank': 'VYSA',
  'indian bank': 'IDIB',
  'indian overseas bank': 'IOBA',
  'indusind bank': 'INDB',
  'jp morgan chase bank': 'CHAS',
  'jpmorgan chase': 'CHAS',
  'jammu & jk bank': 'JAKA',
  'jammu & kashmir bank': 'JAKA',
  'jammu and kashmir bank': 'JAKA',
  'jankalyan sahakari bank': 'JSBL',
  'karur vysya bank': 'KVBL',
  'krung thai bank': 'KRTB',
  'karnataka bank': 'KARB',
  'kotak mahindra bank': 'KKBK',
  'laxmi vilas bank': 'LAVB',
  'lord krishna bank': 'LKBL',
  'mandavi co-operative bank': 'MDCB',
  'mashreq bank': 'MSHQ',
  'maharashtra state co-operative bank': 'MSCI',
  'mizuho corporate bank': 'MHCB',
  'new india co-op bank': 'NICB',
  'north kanara gsb co-op bank': 'NKGS',
  'oriental bank of commerce': 'ORBC',
  'punjab & sind bank': 'PSIB',
  'punjab and sind bank': 'PSIB',
  'punjab & maharashtra co-op bank': 'PMCB',
  'punjab and maharashtra co-op bank': 'PMCB',
  'punjab national bank': 'PUNB',
  'ratnakar bank (rbl bank)': 'RATN',
  'ratnakar bank': 'RATN',
  'rbl bank': 'RATN',
  'reserve bank of india': 'RBIS',
  'saraswat co-operative bank': 'SRCB',
  'shamrao vithal co-op bank': 'SVCB',
  'south indian bank': 'SIBL',
  'standard chartered bank': 'SCBL',
  'standard chartered': 'SCBL',
  'state bank of india': 'SBIN',
  'state bank of hyderabad': 'SBHY',
  'state bank of mysore': 'SBMY',
  'state bank of patiala': 'STBP',
  'state bank of bikaner & jaipur': 'SBBJ',
  'state bank of bikaner and jaipur': 'SBBJ',
  'state bank of saurashtra': 'SBSY',
  'state bank of travancore': 'SBTR',
  'state bank indore': 'SBIN',
  'state bank of mauritius': 'STCB',
  'syndicate bank': 'SYNB',
  'tamilnad mercantile bank': 'TMBL',
  'tamilnadu state apex co-operative bank': 'TNSC',
  'thane janta sahakari bank': 'TJSB',
  'the kapol co-operative bank': 'KCBL',
  'the sangli bank': 'SANG',
  'ufj bank ltd': 'BOTM',
  'ufj bank ltd.': 'BOTM',
  'united western bank': 'UWBI',
  'uti bank (axis bank)': 'UTIB',
  'uti bank': 'UTIB',
  'uco bank': 'UCBA',
  'union bank of india': 'UBIN',
  'united bank of india': 'UTBI',
  'vijaya bank': 'VIJB',
  'yes bank': 'YESB'
};

const getBankCode = (bankName) => {
  const normalized = String(bankName || "").toLowerCase().replace(/\s+/g, ' ').trim();
  if (bankToIfscPrefix[normalized]) {
    return bankToIfscPrefix[normalized];
  }
  const matchedKey = Object.keys(bankToIfscPrefix).find(k => normalized.includes(k) || k.includes(normalized));
  return matchedKey ? bankToIfscPrefix[matchedKey] : "";
};

async function fetchBankList() {
  try {
    const res = await fetch('https://haatzaseller.com/_functions/bankList', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json();

    let rawList = [];
    if (Array.isArray(data)) {
      rawList = data;
    } else if (data && Array.isArray(data.banks)) {
      rawList = data.banks;
    } else if (data && Array.isArray(data.data)) {
      rawList = data.data;
    } else if (data && Array.isArray(data.message)) {
      rawList = data.message;
    } else if (data && typeof data === 'object') {
      const foundArray = Object.values(data).find(val => Array.isArray(val));
      if (foundArray) rawList = foundArray;
    }

    return rawList.map(item => {
      if (!item) return null;
      let name = '';
      let code = '';
      if (typeof item === 'string') {
        name = item.trim();
      } else if (typeof item === 'object') {
        name = (item.name || item.bankName || item.bank || '').trim();
        code = (item.code || item.ifscPrefix || item.bankCode || item.ifscCode || '').trim().toUpperCase();
      }

      if (!name) return null;

      if (!code) {
        const normalized = name.toLowerCase().replace(/\s+/g, ' ');
        if (bankToIfscPrefix[normalized]) {
          code = bankToIfscPrefix[normalized];
        } else {
          const matchedKey = Object.keys(bankToIfscPrefix).find(k => normalized.includes(k) || k.includes(normalized));
          if (matchedKey) {
            code = bankToIfscPrefix[matchedKey];
          } else {
            code = '';
          }
        }
      }

      return { name, code };
    }).filter(Boolean);
  } catch (err) {
    console.error('[fetchBankList] Error fetching bank list:', err);
    return [];
  }
}

/* ── Chevron icon ─────────────────────────────────────────── */
const ChevronRight = () => (
  <svg
    className="settings-chevron"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const LEGAL_ROWS = [
  { label: "Terms & Conditions",   icon: "📋", route: "/dashboard/settings/terms" },
  { label: "Privacy Policy",       icon: "👓", route: "/dashboard/settings/privacy" },
  { label: "Pricing & Commission", icon: "🤝", route: "/dashboard/settings/pricing" },
  { label: "Shipping & Return",    icon: "📦", route: "/dashboard/settings/shipping" },
];

function SettingsPage({ onLogout }) {
  const navigate = useNavigate();
  const { user, updateUser, logout } = useAuth();

  const sellerData = user || {};
  console.log("Settings Seller Data:", sellerData);

  const profileName =
    sellerData.fullName ||
    sellerData.name ||
    sellerData.sellerName ||
    sellerData.userName ||
    sellerData.firstName ||
    sellerData.nickname ||
    localStorage.getItem("sellerName") ||
    localStorage.getItem("sellerFullName") ||
    sellerData.companyName ||
    "";
  const companyName = sellerData.companyName || "";
  const sellerEmail = sellerData.email || "";
  const sellerPhone = sellerData.phone || "";
  const logoUrl = sellerData.logoUrl || null;

  const initials = profileName ? profileName.charAt(0).toUpperCase() : "";

  const hasGstin = (sellerData.GSTIN || sellerData.gstin) && String(sellerData.GSTIN || sellerData.gstin).trim() !== "" && String(sellerData.GSTIN || sellerData.gstin).trim().toLowerCase() !== "optional";
  const hasPan = sellerData.panNumber && String(sellerData.panNumber).trim() !== "" && String(sellerData.panNumber).trim().toLowerCase() !== "optional";

  // ─── Profile Popover State ────────────────────────────────
  const [showProfilePopup, setShowProfilePopup] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editProfileName, setEditProfileName] = useState("");
  const [editProfileEmail, setEditProfileEmail] = useState("");
  const [editProfilePhone, setEditProfilePhone] = useState("");
  const [profileError, setProfileError] = useState("");
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [passwordResetLoading, setPasswordResetLoading] = useState(false);
  const [passwordResetError, setPasswordResetError] = useState("");

  // ─── Bank Details State ──────────────────────────────────
  const [isEditingBank, setIsEditingBank] = useState(false);
  const [editBankName, setEditBankName] = useState("");
  const [editBankHolder, setEditBankHolder] = useState("");
  const [editBankAccount, setEditBankAccount] = useState("");
  const [editBankIfsc, setEditBankIfsc] = useState("");
  const [bankError, setBankError] = useState("");
  const [bankSaving, setBankSaving] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  const [bankSearch, setBankSearch] = useState('');
  const [showBankList, setShowBankList] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [bankList, setBankList] = useState([]);
  const [bankLoading, setBankLoading] = useState(true);

  const bankDropdownRef = useRef(null);
  const bankInputRef = useRef(null);

  useEffect(() => {
    let active = true;
    const loadBanks = async () => {
      try {
        setBankLoading(true);
        const list = await fetchBankList();
        if (active) {
          setBankList(list.sort((a, b) => a.name.localeCompare(b.name)));
        }
      } catch (err) {
        console.error("Failed to load bank list:", err);
      } finally {
        if (active) setBankLoading(false);
      }
    };
    loadBanks();
    return () => { active = false; };
  }, []);

  const filteredBanks = bankSearch.trim() === ''
    ? bankList.map(b => b.name)
    : bankList.map(b => b.name).filter((b) => b.toLowerCase().includes(bankSearch.toLowerCase().trim()));

  /* ── Bank dropdown outside-click ── */
  useEffect(() => {
    const handler = (e) => {
      if (
        bankDropdownRef.current && !bankDropdownRef.current.contains(e.target) &&
        bankInputRef.current && !bankInputRef.current.contains(e.target)
      ) {
        setShowBankList(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /* ── Scroll active bank option into view ── */
  useEffect(() => {
    if (activeIndex >= 0 && bankDropdownRef.current) {
      const item = bankDropdownRef.current.querySelector(`[data-index="${activeIndex}"]`);
      if (item) item.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  const selectBank = (bankName) => {
    handleBankNameChange(bankName);
    setBankSearch('');
    setShowBankList(false);
    setActiveIndex(-1);
  };

  const handleBankKeyDown = (e) => {
    if (!showBankList) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, filteredBanks.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (activeIndex >= 0 && filteredBanks[activeIndex]) selectBank(filteredBanks[activeIndex]); }
    else if (e.key === 'Escape') { setShowBankList(false); setActiveIndex(-1); }
  };

  // ─── NEW: Logout confirmation modal state ─────────────────
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // ─── OTP state variables ──────────────────────────────────
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpDigits, setOtpDigits] = useState(Array(6).fill(""));
  const [otpTimeLeft, setOtpTimeLeft] = useState(0);
  const [otpTimerActive, setOtpTimerActive] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpResendLoading, setOtpResendLoading] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [otpSuccess, setOtpSuccess] = useState("");

  const otpTimerRef = useRef(null);
  const otpInputRefs = useRef([]);

  const startOtpTimer = useCallback(() => {
    clearInterval(otpTimerRef.current);
    setOtpTimeLeft(60);
    setOtpTimerActive(true);

    otpTimerRef.current = setInterval(() => {
      setOtpTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(otpTimerRef.current);
          setOtpTimerActive(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    return () => clearInterval(otpTimerRef.current);
  }, []);

  const handleOtpDigitChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const digit = value.slice(-1);

    const newOtp = [...otpDigits];
    newOtp[index] = digit;
    setOtpDigits(newOtp);
    if (otpError) setOtpError("");

    if (digit && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace") {
      if (otpDigits[index]) {
        const newOtp = [...otpDigits];
        newOtp[index] = "";
        setOtpDigits(newOtp);
      } else if (index > 0) {
        otpInputRefs.current[index - 1]?.focus();
      }
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const newOtp = Array(6).fill("");
    for (let i = 0; i < pasted.length; i++) {
      newOtp[i] = pasted[i];
    }
    setOtpDigits(newOtp);
    otpInputRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const handleCancelOtp = () => {
    clearInterval(otpTimerRef.current);
    setOtpTimerActive(false);
    setShowOtpModal(false);
    setOtpError("");
    setOtpSuccess("");
  };

  const handleResendOtp = async () => {
    setOtpResendLoading(true);
    setOtpError("");
    setOtpSuccess("");
    setOtpDigits(Array(6).fill(""));

    const newPhoneVal = (editProfilePhone || "").trim();

    try {
      await sellerService.resendOtp(newPhoneVal);
      setOtpSuccess("OTP resent successfully!");
      startOtpTimer();
    } catch (err) {
      setOtpError(err.message || "Could not resend OTP. Please try again.");
    } finally {
      setOtpResendLoading(false);
    }
  };

  const handleVerifyOtpSubmit = async () => {
    const code = otpDigits.join("");
    if (code.length < 6) {
      setOtpError("Please enter all 6 digits.");
      return;
    }

    setOtpLoading(true);
    setOtpError("");
    setOtpSuccess("");

    const oldPhoneVal = (sellerPhone || "").trim();
    const newPhoneVal = (editProfilePhone || "").trim();

    try {
      const verifyResponse = await sellerService.verifyOtp(newPhoneVal, code);
      
      console.log("OTP Verified");
      console.log("Updating Seller Phone Number");

      let verifiedPhone = newPhoneVal;
      try {
        const sellerObj =
          verifyResponse?.message?.seller ||
          verifyResponse?.seller ||
          verifyResponse?.message ||
          verifyResponse ||
          {};
        const resolvedPhone =
          sellerObj.phone ||
          sellerObj.phonenumber ||
          sellerObj.phone_number ||
          sellerObj.mobile_number ||
          sellerObj.contact ||
          sellerObj.mobile ||
          verifyResponse?.phone ||
          verifyResponse?.phonenumber ||
          "";
        if (resolvedPhone) {
          verifiedPhone = String(resolvedPhone).trim();
        }
      } catch (e) {
        console.warn("[Verify OTP] Error extracting phone from response, falling back to entered phone:", e);
      }

      const updatedPhoneNumber = newPhoneVal;
      const verifiedPhoneNumber = verifiedPhone;

      console.log(`Verifying: updatedPhoneNumber (${updatedPhoneNumber}) === verifiedPhoneNumber (${verifiedPhoneNumber})`);

      if (updatedPhoneNumber === verifiedPhoneNumber) {
        console.log("Persisting verified phone number in Seller Onboarding database...");
        await sellerService.updateSellerOnboarding(sellerEmail, {
          phone: verifiedPhoneNumber,
          phoneNumber: verifiedPhoneNumber
        });

        updateUser({
          name: editProfileName,
          email: editProfileEmail,
          phone: verifiedPhoneNumber,
        });

        setShowOtpModal(false);
        setIsEditingProfile(false);
        setShowProfilePopup(false);
        showToastMsg("Profile details and phone number updated successfully.", "success");
      } else {
        throw new Error("Verification mismatch: The verified number does not match the entered phone number.");
      }
    } catch (err) {
      console.error("OTP verification or save failed:", err);
      const errorMsg = err.message || err.response?.data?.message || "Invalid OTP. Please try again.";
      setOtpError(errorMsg);
      showToastMsg(errorMsg, "error");
    } finally {
      setOtpLoading(false);
    }
  };

  const showToastMsg = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 4000);
  };

  // ─── Handlers ────────────────────────────────────────────
  const handleProfileCardClick = () => {
    if (!showProfilePopup) {
      setEditProfileName(
        sellerData.fullName ||
        sellerData.name ||
        sellerData.sellerName ||
        sellerData.userName ||
        sellerData.firstName ||
        sellerData.nickname ||
        localStorage.getItem("sellerName") ||
        localStorage.getItem("sellerFullName") ||
        sellerData.companyName ||
        ""
      );
      setEditProfileEmail(sellerData.email ? String(sellerData.email) : "");
      setEditProfilePhone(sellerData.phone ? String(sellerData.phone) : "");
      setIsEditingProfile(false);
      setProfileError("");
      setShowPasswordConfirm(false);
    }
    setShowProfilePopup(prev => !prev);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    const nameStr = String(editProfileName || "").trim();
    const emailStr = String(editProfileEmail || "").trim();
    const phoneStr = String(editProfilePhone || "").trim();

    if (!nameStr) {
      setProfileError("Name is required");
      return;
    }
    if (!emailStr) {
      setProfileError("Email is required");
      return;
    }

    const oldPhoneVal = (sellerPhone || "").trim();
    const newPhoneVal = phoneStr;

    if (newPhoneVal !== oldPhoneVal) {
      setProfileError("");
      setOtpError("");
      setOtpSuccess("");
      setOtpDigits(Array(6).fill(""));

      const isPhone = /^[6-9]\d{9}$/.test(newPhoneVal);
      if (!isPhone) {
        setProfileError("Enter a valid 10-digit mobile number.");
        return;
      }

      setOtpLoading(true);

      try {
        const checkResult = await sellerService.checkSeller(newPhoneVal);
        if (checkResult && checkResult.userExists) {
          setProfileError("This phone number is already registered. Please use a different phone number.");
          setOtpLoading(false);
          return;
        }

        setShowOtpModal(true);
        console.log("Old Phone:", oldPhoneVal);
        console.log("New Phone:", newPhoneVal);

        await sellerService.generateOtp(newPhoneVal);
        setOtpSuccess("Verification OTP sent to your new phone number!");
        startOtpTimer();
      } catch (err) {
        setProfileError(err.message || "Failed to check or send OTP. Please try again.");
      } finally {
        setOtpLoading(false);
      }
    } else {
      updateUser({
        name: nameStr,
        email: emailStr,
        phone: phoneStr,
      });
      setIsEditingProfile(false);
      setShowProfilePopup(false);
    }
  };

  const handleResetPassword = async () => {
    setPasswordResetLoading(true);
    setPasswordResetError("");
    console.log("Sending Password Reset Request:", {
      email: sellerEmail
    });
    try {
      const response = await sellerService.forgotPassword(sellerEmail);
      console.log("Forgot Password Response:", response);

      if (response && (response.status === false || response.success === false || (typeof response === "string" && response.toLowerCase().includes("failed")))) {
        throw new Error(response.message || response || "Failed to send password reset request.");
      }

      console.log("Password Reset Success:", response);
      showToastMsg("Password is sent to your mail, check it.", "success");
      setShowPasswordConfirm(false);
    } catch (error) {
      console.error("Forgot Password Error:", error);
      console.error("Password Reset Error:", error);
      const errorMsg = error.response?.data?.message || error.message || "Failed to send password reset request.";
      setPasswordResetError(errorMsg);
      showToastMsg(errorMsg, "error");
    } finally {
      setPasswordResetLoading(false);
    }
  };

  const handleStartEditBank = () => {
    setEditBankName(sellerData.bankName ? String(sellerData.bankName) : "");
    setEditBankHolder(sellerData.accountHolder ? String(sellerData.accountHolder) : "");
    setEditBankAccount(sellerData.accountNumber !== undefined && sellerData.accountNumber !== null ? String(sellerData.accountNumber) : "");
    setEditBankIfsc(sellerData.ifscCode ? String(sellerData.ifscCode) : "");
    setBankError("");
    setBankSearch("");
    setShowBankList(false);
    setActiveIndex(-1);
    setIsEditingBank(true);
  };

  const handleBankNameChange = (val) => {
    setEditBankName(val);
    setEditBankIfsc("");
    setBankError("");
  };

  const handleIfscChange = (val) => {
    const uppercaseVal = val.toUpperCase().replace(/[^A-Z0-9]/g, '');
    setEditBankIfsc(uppercaseVal);
    
    if (uppercaseVal.length === 11) {
      const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
      if (!ifscRegex.test(uppercaseVal)) {
        setBankError("Invalid IFSC code format (e.g. HDFC0001006).");
      } else {
        const code = getBankCode(editBankName);
        if (code && !uppercaseVal.startsWith(code)) {
          setBankError(`IFSC code does not match ${editBankName}. Please enter a valid IFSC code.`);
        } else {
          setBankError("");
        }
      }
    } else if (uppercaseVal.length > 0) {
      setBankError(`IFSC must be 11 characters (${uppercaseVal.length}/11)`);
    } else {
      setBankError("");
    }
  };

  const handleSaveBank = async (e) => {
    e.preventDefault();
    
    const accountNumberRegex = /^[0-9]{9,18}$/;
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;

    const bankNameStr = String(editBankName || "").trim();
    const bankHolderStr = String(editBankHolder || "").trim();
    const bankAccountStr = String(editBankAccount || "").trim();
    const bankIfscStr = String(editBankIfsc || "").trim().toUpperCase();

    if (!bankNameStr) {
      setBankError("Bank name is required.");
      return;
    }
    if (!bankHolderStr) {
      setBankError("Account holder name is required.");
      return;
    }
    if (!accountNumberRegex.test(bankAccountStr)) {
      setBankError("Account number must be 9 to 18 digits.");
      return;
    }
    if (!ifscRegex.test(bankIfscStr)) {
      setBankError("Invalid IFSC code format (e.g. HDFC0001006).");
      return;
    }
    const code = getBankCode(bankNameStr);
    if (code && !bankIfscStr.startsWith(code)) {
      setBankError(`IFSC code does not match ${bankNameStr}. Please enter a valid IFSC code.`);
      return;
    }

    setBankSaving(true);
    setBankError("");

    try {
      const updateFields = {
        bankName: bankNameStr,
        accountHolder: bankHolderStr,
        accountNumber: Number(bankAccountStr),
        ifscCode: bankIfscStr,
      };

      console.group("[SettingsPage] Saving Bank Details");
      console.log("Payload email:", sellerEmail);
      console.log("Payload updateFields:", updateFields);
      console.groupEnd();

      const response = await sellerService.updateSellerOnboarding(sellerEmail, updateFields);

      console.group("[SettingsPage] Bank Details Update API Response");
      console.log("Raw Response:", response);
      console.groupEnd();

      if (response && (response.status === "success" || response.status === true || response.message?.status === "success")) {
        updateUser(updateFields);
        setIsEditingBank(false);
        showToastMsg("Bank details updated successfully.", "success");
      } else {
        const errorMsg = response?.message || response?.error || "Failed to update bank details.";
        setBankError(errorMsg);
        showToastMsg(errorMsg, "error");
      }
    } catch (error) {
      console.group("[SettingsPage] Bank Details Update Failed");
      console.error("Error:", error);
      console.groupEnd();
      const errorMsg = error.response?.data?.message || error.message || "Failed to update bank details.";
      setBankError(errorMsg);
      showToastMsg(errorMsg, "error");
    } finally {
      setBankSaving(false);
    }
  };

  /* ─────────────────────────────────────────────────────────
     handleLogoutClick — CHANGED: now opens the confirmation
     modal instead of running logout() immediately.
     The actual logout() call is preserved inside
     handleLogoutConfirm below and is identical to the
     original logic.
  ───────────────────────────────────────────────────────── */
  const handleLogoutClick = () => {
    setShowLogoutModal(true);
  };

  /* ── Confirmed logout: run existing auth logout + navigate ─ */
  const handleLogoutConfirm = () => {
    setShowLogoutModal(false);
    logout();
    if (typeof onLogout === "function") {
      onLogout();
    } else {
      navigate("/signup");
    }
  };

  /* ── Cancelled: just close the popup ─────────────────────── */
  const handleLogoutCancel = () => {
    setShowLogoutModal(false);
  };

  const avatarContent = logoUrl ? (
    <img src={logoUrl} alt={profileName} className="settings-profile-avatar-img" />
  ) : (
    initials
  );

  return (
    <div className="settings-page">

      {/* ── Logout Confirmation Modal ── */}
      <LogoutConfirmModal
        isOpen={showLogoutModal}
        onYes={handleLogoutConfirm}
        onNo={handleLogoutCancel}
      />

      <div className="settings-header">
        <h1 className="settings-title">Settings</h1>
      </div>

      {/* ── Profile Header Section with Popover ── */}
      <div className="settings-profile-container">
        <div className="settings-profile-card" onClick={handleProfileCardClick}>
          <div className="settings-profile-avatar">{avatarContent}</div>
          <div className="settings-profile-info">
            <p className="settings-profile-name">{profileName}</p>
            <p className="settings-profile-email">{sellerEmail}</p>
            {sellerPhone && <p className="settings-profile-email">{sellerPhone}</p>}
          </div>
          <ChevronRight />
        </div>

        {showProfilePopup && (
          <div className="settings-profile-popup">
            <div className="popup-caret" />
            <div className="popup-header">
              <h3>Profile Settings</h3>
              <button className="popup-close-btn" onClick={() => setShowProfilePopup(false)}>✕</button>
            </div>
            {isEditingProfile ? (
              <form onSubmit={handleSaveProfile} className="popup-form">
                {profileError && <div className="popup-error">{profileError}</div>}
                
                <div className="popup-field">
                  <label>Name</label>
                  <input
                    type="text"
                    value={editProfileName}
                    disabled
                    required
                  />
                </div>

                <div className="popup-field">
                  <label>Email Address</label>
                  <input
                    type="email"
                    value={editProfileEmail}
                    disabled
                    required
                  />
                </div>

                <div className="popup-field">
                  <label>Phone Number</label>
                  <input
                    type="tel"
                    value={editProfilePhone}
                    onChange={(e) => setEditProfilePhone(e.target.value)}
                    placeholder="N/A"
                  />
                </div>

                <div className="popup-actions">
                  <button type="button" className="popup-btn cancel" onClick={() => setIsEditingProfile(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="popup-btn save">
                    Save Changes
                  </button>
                </div>
              </form>
            ) : (
              <div className="popup-view">
                <div className="popup-detail-row">
                  <span className="popup-label">Name</span>
                  <span className="popup-value">{profileName}</span>
                </div>
                <div className="popup-detail-row">
                  <span className="popup-label">Email</span>
                  <span className="popup-value">{sellerEmail}</span>
                </div>
                <div className="popup-detail-row">
                  <span className="popup-label">Phone</span>
                  <span className="popup-value">{sellerPhone}</span>
                </div>

                <div className="popup-actions-footer" style={{ position: "relative" }}>
                  <button className="popup-edit-trigger" onClick={() => setIsEditingProfile(true)}>
                    Edit Profile
                  </button>
                  <button type="button" className="popup-edit-trigger secondary" onClick={() => setShowPasswordConfirm(prev => !prev)}>
                    Change Password
                  </button>

                  {showPasswordConfirm && (
                    <div className="password-confirm-popup">
                      <div className="password-confirm-header">
                        <h4>Reset Password</h4>
                        <button type="button" className="password-confirm-close" onClick={() => { setShowPasswordConfirm(false); setPasswordResetError(""); }}>✕</button>
                      </div>
                      <p className="password-confirm-msg">Are you sure want to reset password?</p>
                      {passwordResetError && <div className="password-confirm-error">{passwordResetError}</div>}
                      <div className="password-confirm-actions">
                        <button type="button" className="password-confirm-btn no" onClick={() => { setShowPasswordConfirm(false); setPasswordResetError(""); }} disabled={passwordResetLoading}>
                          No
                        </button>
                        <button type="button" className="password-confirm-btn yes" onClick={handleResetPassword} disabled={passwordResetLoading}>
                          {passwordResetLoading ? "Sending..." : "Yes"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Orders Section ── */}
      <div className="settings-group">
        <button className="settings-row" onClick={() => navigate("/dashboard/orders")}>
          <span className="settings-row-icon">📦</span>
          <span className="settings-row-label">Orders</span>
          <ChevronRight />
        </button>
      </div>

      {/* ── Account Manager Card (Read-only Support Details) ── */}
      <div className="settings-section-card">
        <div className="card-header">
          <h3>Account Manager Details</h3>
        </div>
        <div className="card-details">
          <div className="detail-row">
            <span className="detail-label">Account Manager</span>
            <span className="detail-value">Haatza Seller Support</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Email</span>
            <span className="detail-value">
              <a href="mailto:support@haatzaseller.in" style={{ color: "#2962ff", textDecoration: "none" }}>support@haatzaseller.in</a>
            </span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Mobile Number</span>
            <span className="detail-value">+91 9148079015</span>
          </div>
        </div>
      </div>

      {/* ── Bank Details Card ── */}
      <div className="settings-section-card">
        <div className="card-header">
          <h3>Bank Details</h3>
          {!isEditingBank && (
            <button className="btn-card-edit" onClick={handleStartEditBank}>Edit</button>
          )}
        </div>
        
        {isEditingBank ? (
          <form onSubmit={handleSaveBank} className="card-form">
            {bankError && <div className="card-error-msg">{bankError}</div>}
            <div className="card-field">
              <label>Bank Name</label>
              <div className="bank-selector">
                <div className="bank-input-wrap">
                  <svg className="bank-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    ref={bankInputRef}
                    className="form-input bank-search-input"
                    style={{ background: "#ffffff" }}
                    type="text" placeholder="Bank Name" autoComplete="off"
                    value={editBankName ? editBankName : bankSearch}
                    onFocus={() => {
                      if (editBankName) setBankSearch('');
                      handleBankNameChange('');
                      setShowBankList(true);
                      setActiveIndex(-1);
                    }}
                    onChange={(e) => {
                      setBankSearch(e.target.value);
                      handleBankNameChange('');
                      setShowBankList(true);
                      setActiveIndex(-1);
                    }}
                    onKeyDown={handleBankKeyDown}
                    disabled={bankSaving}
                    required={!bankSearch}
                  />
                  {(bankSearch || editBankName) && (
                    <button
                      className="bank-clear-btn"
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setBankSearch('');
                        handleBankNameChange('');
                        setShowBankList(true);
                        if (bankInputRef.current) bankInputRef.current.focus();
                      }}
                      title="Clear"
                    >
                      ✕
                    </button>
                  )}
                </div>
                {showBankList && (
                  <div className="bank-dropdown-wrap">
                    <div className="bank-dropdown-header">
                      {bankSearch.trim() === '' ? (
                        <span>{bankList.length} banks available — type to search</span>
                      ) : (
                        <span>{filteredBanks.length} result{filteredBanks.length !== 1 ? 's' : ''} for "<strong>{bankSearch}</strong>"</span>
                      )}
                    </div>
                    <ul ref={bankDropdownRef} className="bank-dropdown">
                      {filteredBanks.length > 0 ? filteredBanks.map((b, idx) => {
                        const lowerB = b.toLowerCase();
                        const lowerQ = bankSearch.toLowerCase().trim();
                        const start = lowerQ ? lowerB.indexOf(lowerQ) : -1;
                        return (
                          <li
                            key={b} data-index={idx}
                            className={`bank-option${activeIndex === idx ? ' bank-option-active' : ''}`}
                            onMouseDown={() => selectBank(b)}
                          >
                            {start !== -1 ? (
                              <>
                                {b.substring(0, start)}
                                <strong className="matched-text">{b.substring(start, start + lowerQ.length)}</strong>
                                {b.substring(start + lowerQ.length)}
                              </>
                            ) : b}
                          </li>
                        );
                      }) : (
                        <li className="bank-no-results" style={{ padding: '11px 14px', fontSize: '13px', color: '#8a8fa8', fontStyle: 'italic' }}>
                          No banks found matching "{bankSearch}"
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </div>
            <div className="card-field">
              <label>Account Holder Name</label>
              <input
                type="text"
                value={editBankHolder}
                onChange={(e) => setEditBankHolder(e.target.value)}
                placeholder="Holder Name"
                disabled={bankSaving}
                required
              />
            </div>
            <div className="card-field">
              <label>Account Number</label>
              <input
                type="text"
                value={editBankAccount}
                onChange={(e) => setEditBankAccount(e.target.value)}
                placeholder="Account Number"
                disabled={bankSaving}
                required
              />
            </div>
            <div className="card-field">
              <label>IFSC Code</label>
              <input
                type="text"
                value={editBankIfsc}
                onChange={(e) => handleIfscChange(e.target.value)}
                placeholder="IFSC Code"
                disabled={bankSaving}
                required
              />
            </div>
            <div className="card-actions">
              <button type="button" className="btn-card-cancel" onClick={() => { setIsEditingBank(false); setBankError(""); }} disabled={bankSaving}>Cancel</button>
              <button type="submit" className="btn-card-save" disabled={bankSaving}>
                {bankSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        ) : (
          <div className="card-details">
            <div className="detail-row">
              <span className="detail-label">Bank Name</span>
              <span className="detail-value">{sellerData.bankName || "N/A"}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Account Holder Name</span>
              <span className="detail-value">{sellerData.accountHolder || "N/A"}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Account Number</span>
              <span className="detail-value">{sellerData.accountNumber || "N/A"}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">IFSC Code</span>
              <span className="detail-value">{sellerData.ifscCode || "N/A"}</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Business Details Card (Read-only) ── */}
      <div className="settings-section-card">
        <div className="card-header">
          <h3>Business Details</h3>
        </div>
        <div className="card-details">
          <div className="detail-row">
            <span className="detail-label">Storage Type</span>
            <span className="detail-value">{sellerData.storageType || ""}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Company Name</span>
            <span className="detail-value">{companyName}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Address</span>
            <span className="detail-value">{sellerData.address || ""}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Pin Code</span>
            <span className="detail-value">{sellerData.pincode || ""}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">GSTIN Number</span>
            <span className="detail-value">{sellerData.GSTIN || sellerData.gstin || ""}</span>
          </div>

          {hasPan && (
            <div className="detail-row">
              <span className="detail-label">PAN Number</span>
              <span className="detail-value">{sellerData.panNumber}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Legal Group ── */}
      <div className="settings-group">
        {LEGAL_ROWS.map((row) => (
          <button
            key={row.label}
            className="settings-row"
            onClick={() => navigate(row.route)}
          >
            <span className="settings-row-icon">{row.icon}</span>
            <span className="settings-row-label">{row.label}</span>
            <ChevronRight />
          </button>
        ))}
      </div>

      <div className="settings-footer">
        {/* ── CHANGED: onClick now opens the confirmation modal ── */}
        <button className="settings-logout-btn" onClick={handleLogoutClick}>
          Logout
        </button>
      </div>

      {toast.show && (
        <div className={`settings-toast ${toast.type}`}>
          {toast.message}
        </div>
      )}

      {showOtpModal && (
        <div className="otp-modal-overlay">
          <div className="otp-modal-card">
            <div className="otp-modal-header">
              <h3>Verify Phone Number</h3>
              <button type="button" className="otp-modal-close" onClick={handleCancelOtp} disabled={otpLoading}>✕</button>
            </div>
            <div className="otp-modal-body">
              <p className="otp-modal-instruction">
                We have sent a 6-digit OTP verification code to <span className="otp-highlight-phone">{editProfilePhone}</span>.
              </p>
              
              {otpError && <div className="otp-modal-error">{otpError}</div>}
              {otpSuccess && <div className="otp-modal-success">{otpSuccess}</div>}

              <div className="otp-inputs-wrapper">
                <label>Enter OTP</label>
                <div className="otp-digits-container">
                  {otpDigits.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => (otpInputRefs.current[index] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      disabled={otpLoading}
                      onChange={(e) => handleOtpDigitChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      onPaste={handleOtpPaste}
                      className={`otp-digit-input ${digit ? "filled" : ""}`}
                    />
                  ))}
                </div>
              </div>

              <div className="otp-modal-timer-row">
                {otpTimeLeft > 0 ? (
                  <span className="otp-timer-text">Resend OTP in <strong>{otpTimeLeft}s</strong></span>
                ) : (
                  <span className="otp-timer-text expired">Didn't receive the code?</span>
                )}
                <button
                  type="button"
                  className="otp-resend-btn"
                  onClick={handleResendOtp}
                  disabled={otpTimeLeft > 0 || otpResendLoading}
                >
                  {otpResendLoading ? "Resending..." : "Resend OTP"}
                </button>
              </div>
            </div>
            
            <div className="otp-modal-actions">
              <button
                type="button"
                className="otp-modal-btn cancel"
                onClick={handleCancelOtp}
                disabled={otpLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="otp-modal-btn verify"
                onClick={handleVerifyOtpSubmit}
                disabled={otpLoading || otpDigits.join("").length < 6}
              >
                {otpLoading ? "Verifying..." : "Verify & Save"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default SettingsPage;