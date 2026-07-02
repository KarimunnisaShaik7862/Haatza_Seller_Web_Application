// OtpPage.js - updated code check
import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import OtpScreen from "../../components/auth/OtpScreen/OtpScreen";
import { generateOtp, verifyOtp, resendOtp, checkOnboardStatus, checkSeller, registerUser } from "../../services/sellerService";
import { saveUser } from "../../utils/userStore";
import { useAuth } from "../../context/AuthContext";
const OTP_LENGTH    = 6;
const TIMER_SECONDS = 60;

function OtpPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

 const routeState    = location.state || {};
  const phone         = routeState.phone || routeState.contact || "";
  const emailForStatus = routeState.email;
  const pendingRegistration = routeState.pendingRegistration || null;
  const [otp,          setOtp]          = useState(Array(OTP_LENGTH).fill(""));
  const [timeLeft,     setTimeLeft]     = useState(TIMER_SECONDS);
  const [timerActive,  setTimerActive]  = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [resendLoading,setResendLoading]= useState(false);
  const [error,        setError]        = useState("");
  const [successMsg,   setSuccessMsg]   = useState("");
  const [otpGenerated, setOtpGenerated] = useState(false);

  const timerRef  = useRef(null);
  const otpSentRef = useRef(false);
  const lastVerifiedCodeRef = useRef("");

  // ─── Timer ────────────────────────────────────────────────────────────────
  const startTimer = useCallback(() => {
    clearInterval(timerRef.current);
    setTimeLeft(TIMER_SECONDS);
    setTimerActive(true);

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          setTimerActive(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    return () => clearInterval(timerRef.current);
  }, []);

  // ─── Generate OTP on Mount ────────────────────────────────────────────────
  useEffect(() => {
    if (!phone) {
      setError("Phone number not found. Please go back and try again.");
      return;
    }
    if (otpSentRef.current) return;
    otpSentRef.current = true;

    const sendOtp = async () => {
      try {
        setLoading(true);
        console.log("Generating OTP...");
        await generateOtp(phone);
        setOtpGenerated(true);
        setSuccessMsg("OTP sent to " + phone);
        setTimeout(() => setSuccessMsg(""), 3000);
        startTimer();
      } catch (err) {
        setError(err.message || "Could not send OTP. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    sendOtp();
  }, [phone, startTimer]);

  // ─── Verify OTP ───────────────────────────────────────────────────────────
  const handleVerify = () => {
    const code = otp.join("");

    if (!otpGenerated) { setError("OTP was not generated. Please resend."); setSuccessMsg(""); return; }
    if (code.length < OTP_LENGTH) { setError("Please enter all 6 digits."); setSuccessMsg(""); return; }

    setLoading(true);
    setError("");
    setSuccessMsg("");
    lastVerifiedCodeRef.current = code;

    verifyOtp(phone, code)
      .then(async (verifyResponse) => {
        let response = verifyResponse;
        console.log("OTP Verification Success:", response);

        // ── If this OTP verification is for a NEW SIGNUP, create the account
        //    now — only after the OTP has been successfully verified. ──────
        if (pendingRegistration) {
          try {
            const regResult = await registerUser(pendingRegistration);
            // Merge the freshly created account data into the response so
            // the rest of this handler (which reads sellerObj/userData etc.)
            // works exactly as it did before for the existing-user OTP flow.
            response = {
              ...verifyResponse,
              userData: {
                ...(verifyResponse.userData || {}),
                ...(regResult.userData || {}),
                sellerId: regResult.sellerId || verifyResponse?.userData?.sellerId || "",
                email:    regResult.email    || pendingRegistration.email,
                phone:    regResult.phone    || pendingRegistration.phone,
                fullName: regResult.fullName || pendingRegistration.fullName,
              },
            };
          } catch (regErr) {
            console.error("[OtpPage] Account creation after OTP verification failed:", regErr);
            setError(regErr.message || "Could not create your account. Please try again.");
            setSuccessMsg("");
            setLoading(false);
            return;
          }
        }

        const sellerObj =
          response?.message?.seller ||
          response?.seller          ||
          response?.message          ||
          response                   ||
          {};

        // Extract the seller email from the OTP verification / registration response
        const emailFromResponse =
          sellerObj.email ||
          response?.email ||
          response?.data?.email ||
          response?.userData?.email ||
          null;

        const emailToUse = (emailFromResponse || emailForStatus || "")
          .trim()
          .toLowerCase();

        if (!emailToUse) {
          setError("Incorrect OTP. Please enter the correct OTP.");
          setSuccessMsg("");
          setLoading(false);
          return;
        }

        clearInterval(timerRef.current);
        setSuccessMsg("OTP verified successfully. You can proceed to the next page.");
        setError("");

        // Do not use any hardcoded, cached, local, or invalid Seller IDs.
        // Use ONLY the sellerId returned by the authenticated API response.
        // Do not use any hardcoded, cached, local, or invalid Seller IDs.
        // Use ONLY the sellerId returned by the authenticated API response.
        const sellerIdFromOtp =
          sellerObj.sellerId ||
          sellerObj.seller_id ||
          sellerObj._id ||
          sellerObj.id ||
          sellerObj.uid ||
          sellerObj.SellerID ||
          sellerObj.Seller_ID ||
          response?.message?.sellerId ||
          response?.message?.seller_id ||
          response?.sellerId ||
          response?.seller_id ||
          response?.SellerID ||
          response?.userData?.sellerId ||
          "";

        // Save new user data and login
        const sellerData = response.userData || {};
        // Overwrite status, email, phone, and sellerId with the authenticated response fields
        sellerData.sellerId = sellerIdFromOtp;
        sellerData.email = emailToUse;
        if (sellerObj.phone || sellerObj.phonenumber) {
          sellerData.phone = sellerObj.phone || sellerObj.phonenumber;
        }
        if (sellerObj.status) {
          sellerData.status = sellerObj.status;
        }

        // Store new data and invoke context login (which clears stale keys first)
        localStorage.setItem("sellerData", JSON.stringify(sellerData));
        login({
          name: sellerData.fullName || sellerObj.fullName || sellerObj.name || sellerObj.nickname || "",
          companyName: sellerData.companyName || sellerObj.companyName || "",
          email: emailToUse,
          phone: sellerData.phone || phone,
          logoUrl: sellerData.logoUrl || sellerObj.logoUrl || "",
          sellerId: sellerIdFromOtp,
          gstin: sellerData.GSTIN || sellerData.gstin || sellerObj.GSTIN || sellerObj.gstin || "",
          address: sellerData.address || sellerObj.address || "",
          pincode: sellerData.pincode || sellerObj.pincode || "",
          nickname: sellerData.nickname || sellerObj.nickname || "",
          storageType: sellerData.storageType || sellerObj.storageType || "Seller",
          status: sellerData.status || sellerObj.status || "",
        });

        try {
          console.log("[OtpPage] Checking onboard status for:", emailToUse);
          const isOnboarded = await checkOnboardStatus(emailToUse);

          if (isOnboarded) {
            navigate("/dashboard", {
              state: { email: emailToUse },
            });
          } else {
            navigate("/onboarding", {
              state: { email: emailToUse },
            });
          }
        } catch (statusErr) {
          console.error("[OtpPage] Onboard status check failed:", statusErr);
          navigate("/onboarding", {
            state: { email: emailToUse },
          });
        }
      })
      .catch((err) => {
        setError("Incorrect OTP. Please enter the correct OTP.");
        setSuccessMsg("");
        setOtp(Array(OTP_LENGTH).fill(""));
      })
      .finally(() => setLoading(false));
  };

  // ─── Resend OTP ───────────────────────────────────────────────────────────
  const handleResend = () => {
    setResendLoading(true);
    setError("");
    setOtp(Array(OTP_LENGTH).fill(""));

    resendOtp(phone)
      .then(() => {
        setSuccessMsg("OTP resent to " + phone);
        setTimeout(() => setSuccessMsg(""), 3000);
        startTimer();
      })
      .catch((err) => {
        setError(err.message || "Could not resend OTP. Please try again.");
      })
      .finally(() => setResendLoading(false));
  };

  // ─── Change Number ────────────────────────────────────────────────────────
  const handleChangeNumber = () => {
    clearInterval(timerRef.current);
    navigate("/signin", { state: { prefillContact: phone } });
  };

  const handleOtpChange = (newOtpArray) => {
    setOtp(newOtpArray);
    if (error) setError("");
  };

  useEffect(() => {
    const code = otp.join("");
    if (code.length === OTP_LENGTH && !loading && code !== lastVerifiedCodeRef.current) {
      const isMobileOrTablet = () => {
        const userAgent = navigator.userAgent || navigator.vendor || window.opera;
        const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        const isScreenSize = window.innerWidth <= 1024;
        return /android|iphone|ipad|playbook|silk/i.test(userAgent) || (isTouch && isScreenSize);
      };

      if (isMobileOrTablet()) {
        handleVerify();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp, loading]);

  return (
    <OtpScreen
      phone={phone}
      otp={otp}
      onOtpChange={handleOtpChange}
      timeLeft={timeLeft}
      timerActive={timerActive}
      loading={loading}
      resendLoading={resendLoading}
      error={error}
      successMsg={successMsg}
      onVerify={handleVerify}
      onResend={handleResend}
      onChangeNumber={handleChangeNumber}
    />
  );
}

export default OtpPage;