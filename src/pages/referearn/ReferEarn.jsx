import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { 
  Gift, 
  ChevronDown, 
  ChevronUp, 
  AlertTriangle, 
  RefreshCw, 
  X, 
  Check, 
  Award, 
  TrendingUp, 
  ShieldCheck, 
  Info 
} from "lucide-react";
import { resolveSellerId } from "../../utils/sellerSession";
import { RequestTypes, resolveSellerEmailForApi } from "../../services/sellerService";
import "./ReferEarn.css";

const FAQ_DATA = [
  {
    question: "How many sellers can I refer?",
    answer: "There is no limit on referrals."
  },
  {
    question: "When will I receive my reward?",
    answer: "Reward is credited after successful first subscription purchase."
  },
  {
    question: "Can I refer an already registered seller?",
    answer: "No. Referral benefits apply only to new sellers."
  },
  {
    question: "Can referral rules change?",
    answer: "Haatza may update referral policies at any time."
  }
];

export default function ReferEarn() {
  const navigate = useNavigate();
  const [sellerId, setSellerId] = useState("");
  
  // UI states
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [newCodeInput, setNewCodeInput] = useState("");
  const [validationError, setValidationError] = useState("");
  
  // Accordion state
  const [faqActive, setFaqActive] = useState(null);

  useEffect(() => {
    const resolvedId = resolveSellerId();
    if (resolvedId) {
      setSellerId(resolvedId);
    } else {
      console.warn("Seller ID not found in session.");
    }
  }, []);

  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3500);
  };

  const handleReferNow = async () => {
    if (!sellerId) {
      showToast("Seller session not found. Please log in.", "error");
      return;
    }

    setLoading(true);
    setApiError(null);
    try {
      const response = await axios.get(
        `${RequestTypes.sellerreferral}?sellerId=${sellerId}`
      );

      if (response.data?.status === "success") {
        const msg = response.data.message;
        if (msg?.status === true && msg?.referralCode) {
          // CASE A: User has referral code
          setLoading(false);
          navigate("/refer-earn/share", {
            state: {
              sellerId,
              referralCode: msg.referralCode,
              rewardEarned: msg.rewardEarned || 0
            }
          });
        } else {
          // CASE B: User does not have referral code
          setLoading(false);
          setShowModal(true);
        }
      } else {
        setLoading(false);
        setShowModal(true);
      }
    } catch (err) {
      console.error("Error checking referral details:", err);
      setLoading(false);
      
      const status = err.response?.status;
      const errMsg = String(err.response?.data?.message || err.message || "").toLowerCase();
      
      // If the code doesn't exist yet, it might return 404, 400, or a not-found message.
      // Open the modal to let them create a referral code.
      if (status === 404 || status === 400 || errMsg.includes("not found") || errMsg.includes("no referral")) {
        setShowModal(true);
      } else {
        setShowModal(true);
      }
    }
  };

  const handleCreateCodeSubmit = async (e) => {
    e.preventDefault();
    setValidationError("");

    const code = newCodeInput.trim();
    if (code.length < 4) {
      setValidationError("At least 4 characters are required.");
      return;
    }
    if (!/^[a-zA-Z0-9]+$/.test(code)) {
      setValidationError("Only letters and numbers are allowed.");
      return;
    }

   setLoading(true);
    try {
      const response = await axios.post(
        RequestTypes.sellerReferralcode,
        {
          sellerId,
          referralCode: code,
          status: "Active",
          rewardEarned: 100,
          rewardType: "Cash",
          dateReferred: new Date().toISOString().split("T")[0]
        }
      );

      if (response.data?.status === "success" || response.status === 200) {
        showToast("Referral Code Created Successfully", "success");
        setShowModal(false);
        setLoading(false);
        
        // Navigate automatically to share page
        navigate("/refer-earn/share", {
          state: {
            sellerId,
            referralCode: code,
            rewardEarned: 0
          }
        });
      } else {
        throw new Error("Failed to create code");
      }
    } catch (err) {
      console.error("Error creating referral code:", err.response?.data || err.message);
      setLoading(false);
      const serverMsg =
        err.response?.data?.message?.error ||
        err.response?.data?.message ||
        err.response?.data?.error;
      showToast(
        typeof serverMsg === "string" ? serverMsg : "Unable to create referral code",
        "error"
      );
    }
  };

  return (
    <div className="le-page-outer" id="refer-earn-landing-page">
      {/* Toast Notification */}
      {toast.show && (
        <div className={`le-toast le-toast--${toast.type}`}>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Full Page Loader */}
      {loading && (
        <div className="le-loader-overlay">
          <div className="le-loader-card">
            <RefreshCw className="le-spin" size={32} />
            <p>Processing referral details...</p>
          </div>
        </div>
      )}

      {/* Breadcrumbs */}
      <div className="le-breadcrumb">
        <span onClick={() => navigate("/dashboard")}>Dashboard</span>
        <span className="le-breadcrumb-separator">/</span>
        <span className="le-breadcrumb-active">Refer & Earn</span>
      </div>

      {/* Hero Section */}
      <div className="le-hero-card">
        <div className="le-hero-left">
          <div className="le-hero-badge">Seller Referral Program</div>
          <h1 className="le-hero-title">Refer & Earn ₹500</h1>
          <p className="le-hero-subtitle">
            Get ₹500 when your referred seller completes their first subscription purchase. Help other sellers grow online.
          </p>
          <button className="le-btn-primary" onClick={handleReferNow}>
            Refer Now
          </button>
        </div>
        <div className="le-hero-right">
          {/* Custom SVG Gift Illustration */}
          <svg className="le-gift-illustration" width="240" height="240" viewBox="0 0 240 240" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="boxGrad" x1="40" y1="90" x2="200" y2="210" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#1d4ed8" />
              </linearGradient>
              <linearGradient id="ribbonGrad" x1="110" y1="40" x2="130" y2="210" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#fbbf24" />
                <stop offset="100%" stopColor="#f59e0b" />
              </linearGradient>
            </defs>
            <circle cx="120" cy="120" r="90" fill="#eff6ff" />
            <circle cx="190" cy="70" r="15" fill="#dbeafe" />
            <circle cx="50" cy="160" r="25" fill="#dbeafe" opacity="0.6" />
            <path d="M45,75 L55,75 M50,70 L50,80" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
            <path d="M185,165 L195,165 M190,160 L190,170" stroke="#10b981" strokeWidth="2" strokeLinecap="round" />
            
            <rect x="60" y="95" width="120" height="100" rx="12" fill="url(#boxGrad)" />
            <rect x="52" y="80" width="136" height="24" rx="6" fill="#2563eb" />
            <rect x="110" y="80" width="20" height="115" rx="2" fill="url(#ribbonGrad)" />
            <rect x="60" y="133" width="120" height="20" rx="2" fill="url(#ribbonGrad)" />
            <path d="M120,80 C100,50 80,65 110,80 Z" fill="url(#ribbonGrad)" />
            <path d="M120,80 C140,50 160,65 130,80 Z" fill="url(#ribbonGrad)" />
            <circle cx="120" cy="80" r="10" fill="#d97706" />
          </svg>
        </div>
      </div>

      {/* Program Details: "Refer. Earn. Grow!" */}
      <div className="le-section-card">
        <h2 className="le-section-title">Refer. Earn. Grow!</h2>
        <div className="le-intro-content">
          <p>Invite fellow sellers to join Haatza and grow their business online.</p>
          <p>Share your referral code and invite sellers to register on Haatza. When they successfully purchase their first subscription, you earn ₹500!</p>
          <p>Earn ₹500 for every successful seller referral – and your referred seller also gets exclusive onboarding support and growth benefits.</p>
          <p>Your referral bonus will be credited to your bank account once every 30 days after the referred seller completes their first subscription purchase.</p>
        </div>
      </div>

      {/* How it Works / How to Refer Section */}
      <div className="le-section-card">
        <h2 className="le-section-title">How to Refer</h2>
        <p className="le-section-subtitle">
          Share your referral code via WhatsApp, SMS, email, or social media and invite sellers to join Haatza.
        </p>
        <div className="le-timeline">
          <div className="le-timeline-step">
            <div className="le-step-number">1</div>
            <div className="le-step-info">
              <h3 className="le-step-title">Refer Unlimited Sellers</h3>
              <p className="le-step-desc">Each seller can refer unlimited sellers using their referral code.</p>
            </div>
          </div>
          <div className="le-timeline-step">
            <div className="le-step-number">2</div>
            <div className="le-step-info">
              <h3 className="le-step-title">Enter Referral Code During Subscription</h3>
              <p className="le-step-desc">The referred seller must manually enter the referral code at the time of purchasing a subscription.</p>
            </div>
          </div>
          <div className="le-timeline-step">
            <div className="le-step-number">3</div>
            <div className="le-step-info">
              <h3 className="le-step-title">You Earn ₹500 Instantly!</h3>
              <p className="le-step-desc">You earn ₹500 reward once they complete their subscription purchase.</p>
            </div>
          </div>
        </div>
      </div>

      {/* New Information Card */}
      <div className="le-section-card">
        <h2 className="le-section-title">Start Referring Today and Unlock Unlimited Earnings with Haatza Seller</h2>
        <div className="le-intro-content">
          <p style={{ fontWeight: "600", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
            <Info size={16} /> Note
          </p>
          <ul className="le-terms-list">
            <li>Referral rewards are applicable only when the referred seller completes their first successful subscription purchase.</li>
            <li>Referral bonus will be credited to your bank account once every 30 days.</li>
            <li>Each seller can refer unlimited sellers.</li>
            <li>The referral code must be entered manually during subscription purchase.</li>
            <li>Haatza reserves the right to modify or withdraw the referral program at any time.</li>
          </ul>
        </div>
      </div>

      {/* Create Referral Code Modal Popup */}
      {showModal && (
        <div className="le-modal-overlay">
          <div className="le-modal-card">
            <div className="le-modal-header">
              <h3>Create Your Referral Code</h3>
              <button className="le-modal-close" onClick={() => setShowModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateCodeSubmit}>
              <div className="le-modal-body">
                <p className="le-modal-desc">
                  You do not have a referral code yet. Create your referral code to start inviting sellers and earning rewards.
                </p>
                <div className="le-input-group">
                  <label htmlFor="referralCodeInput">Referral Code</label>
                  <input 
                    type="text" 
                    id="referralCodeInput"
                    placeholder="Enter referral code" 
                    value={newCodeInput}
                    onChange={(e) => {
                      setNewCodeInput(e.target.value);
                      if (validationError) setValidationError("");
                    }}
                    autoFocus
                  />
                  {validationError && <span className="le-error-msg">{validationError}</span>}
                </div>
              </div>
              <div className="le-modal-footer">
                <button type="button" className="le-btn-cancel" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="le-btn-submit">
                  Create Referral Code
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
