import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { 
  Gift, 
  Copy, 
  Check, 
  Send, 
  Mail, 
  ArrowLeft, 
  ChevronDown, 
  ChevronUp, 
  Award, 
  TrendingUp, 
  ShieldCheck, 
  Info, 
  RefreshCw,
  X
} from "lucide-react";
import { resolveSellerId, resolveSellerEmail } from "../../utils/sellerSession";
import { RequestTypes } from "../../services/sellerService";
import "./ReferralShare.css";


const FAQ_DATA = [
  {
    question: "How many sellers can I refer?",
    answer: "You can refer unlimited new sellers. There is no limit to how many rewards you can earn."
  },
  {
    question: "When do I receive my referral reward?",
    answer: "You will be able to claim your ₹500 reward once the referred seller successfully purchases a subscription plan."
  },
  {
    question: "How do I share my referral code?",
    answer: "Share your unique referral code with new sellers via WhatsApp, Email, SMS, or any other method. The new seller must manually enter the code during sign-up."
  },
  {
    question: "Can I refer a seller who is already registered?",
    answer: "No. Only new sellers who have never registered on Haatza are eligible for referral codes."
  },
  {
    question: "How do I claim my reward?",
    answer: "Rewards are not auto-credited. Once eligible, you can claim your reward in the Refer & Earn section of the Haatza Seller App."
  },
  {
    question: "Are rewards transferable or redeemable for cash?",
    answer: "No. Rewards are not transferable and cannot be exchanged for cash. They can only be used for eligible subscriptions, services, or transactions on Haatza."
  },
  {
    question: "What happens if I try to self-refer or commit fraud?",
    answer: "Self-referrals or referrals made through fraudulent or invalid means will result in disqualification and forfeiture of any pending or future rewards."
  },
  {
    question: "Can the program rules change?",
    answer: "Haatza Seller reserves the right to modify, pause, or terminate the referral program at any time. Any updates will be communicated through the platform."
  }
];

const getAvailableEmails = () => {
  const emails = new Set();
  const keys = [
    "haatza_user",
    "haatzaSeller",
    "pendingEmail", "userEmail", "email", "sellerEmail",
    "user_email", "seller_email", "currentUserEmail",
    "user", "authUser", "currentUser", "userData", "sellerData",
    "auth", "session", "loginData", "accountData",
  ];
  const emailFields = [
    "email", "userEmail", "sellerEmail", "user_email",
    "seller_email", "emailAddress", "loginEmail",
  ];
  const isValidEmail = (v) => v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim());

  for (const key of keys) {
    try {
      const sVal = sessionStorage.getItem(key);
      if (sVal) {
        if (isValidEmail(sVal)) {
          emails.add(sVal.trim().toLowerCase());
        } else {
          const parsed = JSON.parse(sVal);
          for (const field of emailFields) {
            if (isValidEmail(parsed?.[field])) {
              emails.add(String(parsed[field]).trim().toLowerCase());
            }
          }
          for (const nest of ["user", "data", "account", "seller", "profile"]) {
            if (parsed?.[nest] && typeof parsed[nest] === "object") {
              for (const field of emailFields) {
                if (isValidEmail(parsed[nest][field])) {
                  emails.add(String(parsed[nest][field]).trim().toLowerCase());
                }
              }
            }
          }
        }
      }
    } catch {}

    try {
      const lVal = localStorage.getItem(key);
      if (lVal) {
        if (isValidEmail(lVal)) {
          emails.add(lVal.trim().toLowerCase());
        } else {
          const parsed = JSON.parse(lVal);
          for (const field of emailFields) {
            if (isValidEmail(parsed?.[field])) {
              emails.add(String(parsed[field]).trim().toLowerCase());
            }
          }
          for (const nest of ["user", "data", "account", "seller", "profile"]) {
            if (parsed?.[nest] && typeof parsed[nest] === "object") {
              for (const field of emailFields) {
                if (isValidEmail(parsed[nest][field])) {
                  emails.add(String(parsed[nest][field]).trim().toLowerCase());
                }
              }
            }
          }
        }
      }
    } catch {}
  }

  for (const key of ["userEmail", "pendingEmail", "sellerEmail"]) {
    try {
      const sVal = sessionStorage.getItem(key);
      if (isValidEmail(sVal)) emails.add(sVal.trim().toLowerCase());
      const lVal = localStorage.getItem(key);
      if (isValidEmail(lVal)) emails.add(lVal.trim().toLowerCase());
    } catch {}
  }

  const resolved = resolveSellerEmail();
  if (isValidEmail(resolved)) {
    emails.add(resolved.trim().toLowerCase());
  }

  return Array.from(emails);
};

export default function ReferralShare() {
  const location = useLocation();
  const navigate = useNavigate();
  
  // State variables
  const [sellerId, setSellerId] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [rewardEarned, setRewardEarned] = useState(0);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });
  
  // UI states
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [faqActive, setFaqActive] = useState(null);

  // New UI Modal States
  const [showShareModal, setShowShareModal] = useState(false);



  const shareText = `🌟 Grow with Haatza Seller! 🌟\n\nStart your e-commerce journey today with Haatza Seller\n– India’s zero-commission online selling platform. 🚀\n\nUse my Referral Code: ${referralCode} while subscribing and unlock exclusive benefits. 🎉\n\n👉 Sign up now: www.haatzaseller.com\n\nLet’s build success together! 💼`;

  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3500);
  };

  // Sync state from location or fetch dynamically
  useEffect(() => {
    const state = location.state || {};
    const resolvedId = state.sellerId || resolveSellerId();
    
    if (resolvedId) {
      setSellerId(resolvedId);
    }

    if (state.referralCode) {
      setReferralCode(state.referralCode);
      setRewardEarned(state.rewardEarned || 0);
    } else if (resolvedId) {
      // Fetch details dynamically if they refreshed page
      const fetchDetails = async () => {
        setLoading(true);
        try {
          const response = await axios.get(
            `https://www.haatzaseller.com/_functions/sellerreferral?sellerId=${resolvedId}`
          );
          if (response.data?.status === "success" && response.data.message?.status === true) {
            setReferralCode(response.data.message.referralCode);
            setRewardEarned(response.data.message.rewardEarned || 0);
          } else {
            navigate("/refer-earn");
          }
        } catch (err) {
          console.error("Failed to load state on refresh:", err);
          showToast("Unable to load referral information", "error");
          navigate("/refer-earn");
        } finally {
          setLoading(false);
        }
      };
      fetchDetails();
    } else {
      navigate("/refer-earn");
    }
  }, [location.state, navigate]);

  const handleCopyCode = async () => {
    if (!referralCode) return;
    try {
      await navigator.clipboard.writeText(referralCode);
      setCopiedCode(true);
      showToast("Referral Code Copied", "success");
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (err) {
      console.error("Copy failed:", err);
      showToast("Copy failed", "error");
    }
  };



  const handleCopyLink = async () => {
    if (!referralCode) return;
    try {
      await navigator.clipboard.writeText(shareText);
      setCopiedLink(true);
      showToast("Referral Link Copied", "success");
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (err) {
      console.error("Copy Link failed:", err);
      showToast("Copy Link failed", "error");
    }

    // Attempt Native Share
    if (navigator.share) {
      try {
        await navigator.share({
          text: shareText
        });
      } catch (err) {
        console.log("Native share cancelled or failed:", err);
      }
    } else {
      // Trigger Desktop Share fallback modal
      setShowShareModal(true);
    }
  };

  const handleShareWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank");
  };

  const handleShareEmail = () => {
    const subject = "Join Haatza Seller with my Referral!";
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(shareText)}`;
  };

  if (loading) {
    return (
      <div className="se-page-outer" id="refer-share-loading">
        <div className="se-breadcrumb-skeleton" />
        <div className="se-hero-skeleton" />
      </div>
    );
  }

  return (
    <div className="se-page-outer" id="refer-earn-share-page">
      {/* Toast Alert */}
      {toast.show && (
        <div className={`se-toast se-toast--${toast.type}`}>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header Back button & Breadcrumb */}
      <div className="se-header-nav">
        <button className="se-btn-back" onClick={() => navigate("/refer-earn")}>
          <ArrowLeft size={16} /> Back to Program Info
        </button>
        <div className="se-breadcrumb">
          <span onClick={() => navigate("/dashboard")}>Dashboard</span>
          <span className="se-breadcrumb-separator">/</span>
          <span onClick={() => navigate("/refer-earn")}>Refer & Earn</span>
          <span className="se-breadcrumb-separator">/</span>
          <span className="se-breadcrumb-active">Share</span>
        </div>
      </div>

      {/* Title Header Section */}
      <div className="se-section-header">
        <h1 className="se-main-title">Refer & Earn ₹500</h1>
        <p className="se-main-desc">
          Invite sellers to join Haatza Seller. Earn ₹500 when they complete their first subscription purchase.
        </p>
      </div>

      {/* Referral Info Cards Grid (Code Card + Reward Card Side-by-side) */}
      <div className="se-cards-row">
        {/* Your Referral Code Card */}
        <div className="se-info-card">
          <div className="se-card-icon-wrap icon-blue">
            <Gift size={24} />
          </div>
          <div className="se-card-text">
            <span className="se-card-label">Your Referral Code</span>
            <span className="se-card-highlight">{referralCode}</span>
          </div>
          <button className="se-btn-action" onClick={handleCopyCode}>
            {copiedCode ? (
              <>
                <Check size={16} className="se-check-color" /> Copied
              </>
            ) : (
              <>
                <Copy size={16} /> Copy Code
              </>
            )}
          </button>
        </div>

        {/* Total Rewards Earned Card */}
        <div className="se-info-card">
          <div className="se-card-icon-wrap icon-purple">
  <span style={{ fontSize: "20px", fontWeight: "700", color: "#8b5cf6" }}>₹</span>
</div>
          <div className="se-card-text">
            <span className="se-card-label">Total Rewards Earned</span>
            <span className="se-card-highlight">₹{rewardEarned}</span>
          </div>
        </div>
      </div>

      {/* Share Actions Section */}
      <div className="se-section-card">
        <h2 className="se-card-title">Invite via Social Channels</h2>
        <div className="se-share-grid">
          {/* WhatsApp share */}
          <div className="se-share-channel channel-whatsapp" onClick={handleShareWhatsApp}>
            <div className="se-share-icon icon-whatsapp">
              <Send size={24} />
            </div>
            <h3>WhatsApp</h3>
            <p>Share code with WhatsApp contacts.</p>
          </div>

          {/* Email share */}
          <div className="se-share-channel channel-email" onClick={handleShareEmail}>
            <div className="se-share-icon icon-email">
              <Mail size={24} />
            </div>
            <h3>Email</h3>
            <p>Send details via your mail client.</p>
          </div>

          {/* Share Link */}
          <div className="se-share-channel channel-link" onClick={handleCopyLink}>
            <div className="se-share-icon icon-link">
              <Copy size={24} />
            </div>
            <h3>Share Link</h3>
            <p>{copiedLink ? "Link Copied!" : "Copy complete register link."}</p>
          </div>
        </div>
      </div>

      {/* How it Works Section */}
      <div className="se-section-card">
        <h2 className="se-card-title">How It Works</h2>
        <div className="se-timeline">
          <div className="se-timeline-step" style={{ alignItems: "flex-start" }}>
            <div className="se-step-marker" style={{ marginTop: "2px" }}>1</div>
            <div className="se-step-text">
              <strong style={{ display: "block", color: "var(--text-primary)", fontSize: "16px", marginBottom: "4px" }}>Share Your Referral Code</strong>
              <span style={{ display: "block", fontSize: "14px", color: "var(--text-secondary)", lineHeight: "1.4" }}>Get your unique referral code from the Haatza Seller App and share it with new sellers via WhatsApp, Email, SMS, or any other method.</span>
            </div>
          </div>
          <div className="se-timeline-step" style={{ alignItems: "flex-start" }}>
            <div className="se-step-marker" style={{ marginTop: "2px" }}>2</div>
            <div className="se-step-text">
              <strong style={{ display: "block", color: "var(--text-primary)", fontSize: "16px", marginBottom: "4px" }}>They Must Enter Your Referral Code Manually</strong>
              <span style={{ display: "block", fontSize: "14px", color: "var(--text-secondary)", lineHeight: "1.4" }}>The referred seller must manually enter your referral code during subscription purchase.</span>
            </div>
          </div>
          <div className="se-timeline-step" style={{ alignItems: "flex-start" }}>
            <div className="se-step-marker" style={{ marginTop: "2px" }}>3</div>
            <div className="se-step-text">
              <strong style={{ display: "block", color: "var(--text-primary)", fontSize: "16px", marginBottom: "4px" }}>You Earn ₹500</strong>
              <span style={{ display: "block", fontSize: "14px", color: "var(--text-secondary)", lineHeight: "1.4" }}>You earn ₹500 once the referred seller successfully completes their first subscription purchase.</span>
            </div>
          </div>
          <div className="se-timeline-step" style={{ alignItems: "flex-start" }}>
            <div className="se-step-marker" style={{ marginTop: "2px" }}>4</div>
            <div className="se-step-text">
              <strong style={{ display: "block", color: "var(--text-primary)", fontSize: "16px", marginBottom: "4px" }}>Claim Your Reward</strong>
              <span style={{ display: "block", fontSize: "14px", color: "var(--text-secondary)", lineHeight: "1.4" }}>Once eligible, you can claim your ₹500 reward from the Refer & Earn section.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Clickable links below How It Works card */}
      <div className="se-links-container" style={{ display: "flex", gap: "24px", justifyContent: "center", marginBottom: "32px" }}>
        <span 
          onClick={() => navigate("/dashboard/settings/terms", { state: { type: "referral" } })} 
          style={{ 
            color: "var(--primary-blue)", 
            cursor: "pointer", 
            fontWeight: "600", 
            fontSize: "14.5px", 
            textDecoration: "underline" 
          }}
        >
          Terms &amp; Conditions
        </span>
        <span 
          onClick={() => navigate("/dashboard/settings/terms", { state: { type: "faq" } })} 
          style={{ 
            color: "var(--primary-blue)", 
            cursor: "pointer", 
            fontWeight: "600", 
            fontSize: "14.5px", 
            textDecoration: "underline" 
          }}
        >
          FAQs
        </span>
      </div>

      {/* Benefits Section: Why Join Referral Program */}
      <div className="se-section-card">
        <h2 className="se-card-title">Why Join Referral Program?</h2>
        <div className="se-benefits-grid">
          <div className="se-benefit-card">
            <div className="se-benefit-num">01</div>
            <h3>Zero investment</h3>
            <p>Zero investment, big rewards for sellers.</p>
          </div>
          <div className="se-benefit-card">
            <div className="se-benefit-num">02</div>
            <h3>Help others</h3>
            <p>Help fellow sellers grow their business online.</p>
          </div>
          <div className="se-benefit-card">
            <div className="se-benefit-num">03</div>
            <h3>Earn like partner</h3>
            <p>Act like a business partner — just by referring.</p>
          </div>
          <div className="se-benefit-card">
            <div className="se-benefit-num">04</div>
            <h3>Transparent</h3>
            <p>100% transparent — track every seller referral in real time.</p>
          </div>
        </div>
      </div>

      {/* FAQ Accordion Section */}
      <div className="se-section-card" id="faq-section">
        <h2 className="se-card-title">Frequently Asked Questions</h2>
        <div className="se-faq-list">
          {FAQ_DATA.map((faq, index) => {
            const isActive = faqActive === index;
            return (
              <div key={index} className={`se-faq-item ${isActive ? "se-faq-item--active" : ""}`}>
                <button className="se-faq-btn" onClick={() => setFaqActive(isActive ? null : index)}>
                  <span>{faq.question}</span>
                  {isActive ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
                <div className="se-faq-answer-wrapper">
                  <div className="se-faq-answer-content">
                    <p>{faq.answer}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>


      {/* Desktop Fallback Share Modal */}
      {showShareModal && (
        <div className="se-modal-overlay">
          <div className="se-modal-card">
            <div className="se-modal-header">
              <h3>Share Referral</h3>
              <button className="se-modal-close" onClick={() => setShowShareModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="se-modal-body">
              <p className="se-modal-desc">
                Share this referral invite via any of the options below:
              </p>
              <div className="se-share-options-list">
                {/* WhatsApp Option */}
                <a 
                  href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="se-share-option-item"
                  onClick={() => setShowShareModal(false)}
                >
                  <Send size={18} className="icon-whatsapp-color" />
                  <span>WhatsApp</span>
                </a>
                
                {/* Gmail Option */}
                <a 
                  href={`https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent("Join Haatza Seller with my Referral!")}&body=${encodeURIComponent(shareText)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="se-share-option-item"
                  onClick={() => setShowShareModal(false)}
                >
                  <Mail size={18} className="icon-gmail-color" />
                  <span>Gmail</span>
                </a>

                {/* Outlook Option */}
                <a 
                  href={`https://outlook.office.com/mail/deeplink/compose?subject=${encodeURIComponent("Join Haatza Seller with my Referral!")}&body=${encodeURIComponent(shareText)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="se-share-option-item"
                  onClick={() => setShowShareModal(false)}
                >
                  <Mail size={18} className="icon-outlook-color" />
                  <span>Outlook</span>
                </a>

                {/* Telegram Option */}
                <a 
                  href={`https://t.me/share/url?url=&text=${encodeURIComponent(shareText)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="se-share-option-item"
                  onClick={() => setShowShareModal(false)}
                >
                  <Send size={18} className="icon-telegram-color" />
                  <span>Telegram</span>
                </a>

                {/* Copy Link Option */}
                <button 
                  className="se-share-option-item btn-raw"
                  onClick={() => {
                    handleCopyLink();
                    setShowShareModal(false);
                  }}
                >
                  <Copy size={18} />
                  <span>Copy Link</span>
                </button>
              </div>
            </div>
            <div className="se-modal-footer">
              <button className="se-btn-cancel" onClick={() => setShowShareModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
