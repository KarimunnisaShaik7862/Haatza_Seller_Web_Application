import React, { lazy, Suspense, useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";

// ─── Auth & Onboarding (your existing flow) ───────────────────────────────────
import SignInPage    from "../pages/auth/SignInPage";
import SignUpPage    from "../pages/auth/SignUpPage";
import OtpPage       from "../pages/auth/OtpPage";
import ForgotPasswordPage from "../pages/auth/ForgotPasswordPage";
import WarehouseGetStarted from "../pages/Warehouse/WarehouseGetStarted";

const OnboardingPage = lazy(() => import("../pages/Onboarding/Onboarding"));

// ─── Dashboard Shell (new layout with Outlet + session validation) ─────────────
const DashboardLayout = lazy(() => import("../components/Layout/DashboardLayout/DashboardLayout"));

// ─── Dashboard & General Pages ────────────────────────────────────────────────
const DashboardPage      = lazy(() => import("../pages/Dashboard/DashboardPage"));
const InventoryPage      = lazy(() => import("../pages/Inventory/InventoryPage"));
const WalletPage         = lazy(() => import("../pages/Wallet/WalletPage"));
const NotificationsPage  = lazy(() => import("../pages/Notifications/NotificationsPage"));
const SettingsPage       = lazy(() => import("../pages/Settings/SettingsPage"));
const ProfilePage        = lazy(() => import("../components/Layout/Navbar/Profile"));
const TermsPage = lazy(() => import("../pages/Settings/TermsPage.js"));
const PrivacyPolicyPage = lazy(() => import("../components/common/PrivacyPolicyPage"));
const TermsOfUsePage = lazy(() => import("../components/common/TermsOfUsePage"));
const PricingPage = lazy(() => import("../pages/Settings/PricingPage"));
const ShippingReturnPage = lazy(() => import("../pages/Settings/ShippingReturnPage"));
const SettlementsPage    = lazy(() => import("../pages/Settlements/SettlementsPage"));
const HelpPage           = lazy(() => import("../pages/Help/HelpPage"));
const AdvertisementPage  = lazy(() => import("../pages/Advertisement/AdvertisementPage"));
const CreateCampaignPage = lazy(() => import("../pages/Advertisement/CreateCampaignPage"));
const GrowPlanPage = lazy(() => import("../pages/GrowPlan/GrowPlanPage"));
const PlanReviewPage = lazy(() => import("../pages/GrowPlan/PlanReviewPage"));
const HaatzaUpPage       = lazy(() => import("../pages/HaatzUp/HaatzUpPage"));
const UploadReelPage     = lazy(() => import("../pages/HaatzUp/UploadReelPage"));

// ─── Orders Pages ─────────────────────────────────────────────────────────────
const OrdersPage         = lazy(() => import("../pages/OrdersPage/OrdersPage"));
const OrderDetailsPage   = lazy(() => import("../components/orders/OrderDetailsPage/OrderDetailsPage"));
const ConfirmedOrdersPage = lazy(() => import("../components/orders/ConfirmedOrdersPage/ConfirmedOrdersPage"));
const ShippedOrdersPage  = lazy(() => import("../components/orders/ShippedOrdersPage/ShippedOrdersPage"));
const CancelledOrdersPage = lazy(() => import("../components/orders/CancelledOrdersPage/CancelledOrdersPage"));
const TrackingPage       = lazy(() => import("../components/orders/TrackingPage/TrackingPage"));

// ─── Listings / Product Pages ─────────────────────────────────────────────────
const AddListing         = lazy(() => import("../pages/AddProduct/AddListing/AddListing"));
const SelectCategory     = lazy(() => import("../pages/AddProduct/SelectCategory/SelectCategory"));
const ProductInfo        = lazy(() => import("../pages/AddProduct/ProductInfo/ProductInfo"));
const SpecificationPage  = lazy(() => import("../pages/AddProduct/Specificationpage/SpecificationPage"));
const PromotionPage      = lazy(() => import("../pages/AddProduct/Promotionpage/PromotionPage"));
const ReviewSubmitPage   = lazy(() => import("../pages/AddProduct/ReviewSubmit/ReviewSubmit"));
const MyListings         = lazy(() => import("../pages/AddProduct/MyListings/MyListings"));
const InProgressListings = lazy(() => import("../pages/AddProduct/InProgressListings/InProgressListings"));
const ReturnExchange     = lazy(() => import("../pages/ReturnExchange/ReturnExchange.jsx"));
const ReturnDetailsPage  = lazy(() => import("../pages/ReturnExchange/ReturnDetailsPage.jsx"));
const ProductInsightsList = lazy(() => import("../pages/ProductInsights/ProductInsightsList/ProductInsightsList"));
const ProductInsightDetails = lazy(() => import("../pages/ProductInsights/ProductInsightDetails/ProductInsightDetails"));
const ReferEarn = lazy(() => import("../pages/referearn/ReferEarn"));
const ReferralShare = lazy(() => import("../pages/referearn/ReferralShare"));
const CancelShipmentPage = lazy(() => import("../components/orders/CancelShipmentPage/CancelShipmentPage"));
const InfluenceBranding  = lazy(() => import("../pages/InfluenceBranding/InfluenceBranding"));
const InfluenceBrandingDetails = lazy(() => import("../pages/InfluenceBranding/InfluenceBrandingDetails"));
const WarehousePage = lazy(() => import("../pages/Warehouse/Warehouse"));
const QualityInsightsPage = lazy(() => import("../pages/qualityinsights/QualityInsights"));
const GrowthCentral = lazy(() => import("../pages/GrowthCentral/GrowthCentral"));

// ─── Loading Spinner ──────────────────────────────────────────────────────────
const PageLoader = () => (
  <div style={{
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "60vh",
    width: "100%",
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

// ─── Placeholder for coming-soon sidebar pages ────────────────────────────────
const PlaceholderPage = ({ title }) => (
  <div className="page-placeholder" style={{ padding: "40px" }}>
    <div className="placeholder-card" style={{
      background: "#fff",
      padding: "40px",
      borderRadius: "14px",
      boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
      border: "1px solid #f1f3f6"
    }}>
      <h1 style={{ fontSize: "24px", fontWeight: "700", color: "#1a1d23", margin: "0 0 8px 0" }}>{title}</h1>
      <p style={{ color: "#6b7280", margin: 0, fontSize: "14px" }}>This page is coming soon.</p>
    </div>
  </div>
);

// ─── Scroll To Top component to reset scrollbars on route transitions ─────────
function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
    const scrollContainers = [
      document.querySelector(".dashboard-content-wrapper"),
      document.querySelector(".dashboard-main"),
      document.querySelector(".settings-page"),
      document.querySelector("main"),
    ];
    scrollContainers.forEach((container) => {
      if (container) {
        container.scrollTop = 0;
      }
    });
  }, [pathname]);

  return null;
}

// ─── Routes ───────────────────────────────────────────────────────────────────
function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <ScrollToTop />
      <Routes>

        {/* ── Auth flow (your existing flow — entry point of the app) ── */}
        <Route path="/"           element={<Navigate to="/signin" replace />} />
        <Route path="/signin"     element={<SignInPage />} />
        <Route path="/signup"     element={<SignUpPage />} />
        <Route path="/otp"        element={<OtpPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/privacy"    element={<PrivacyPolicyPage />} />
        <Route path="/terms"      element={<TermsOfUsePage />} />

        {/* ── Dashboard shell — all protected pages live inside here ── */}
        {/*    DashboardLayout (Document 2) renders <Outlet /> for children */}
        {/*    and handles session validation / redirect to /signin        */}
        <Route element={<DashboardLayout />}>

          {/* Dashboard home */}
          <Route path="/dashboard" element={<DashboardPage />} />

          {/* General sidebar pages */}
          <Route path="/dashboard/inventory"    element={<InventoryPage />} />
          <Route path="/dashboard/settlements"  element={<SettlementsPage />} />
          <Route path="/dashboard/settings"     element={<SettingsPage />} />
          <Route path="/dashboard/profile"      element={<ProfilePage />} />
          <Route path="/dashboard/settings/terms" element={<TermsPage />} />
          <Route path="/dashboard/settings/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/dashboard/settings/pricing" element={<PricingPage />} />
          <Route path="/dashboard/settings/shipping" element={<ShippingReturnPage />} />
          <Route path="/dashboard/wallet"       element={<WalletPage />} />
          <Route path="/dashboard/notifications" element={<NotificationsPage />} />
          <Route path="/wallet"                 element={<WalletPage />} />
          <Route path="/notifications"          element={<NotificationsPage />} />
          <Route path="/dashboard/help"         element={<HelpPage />} />
          <Route path="/dashboard/help-center"  element={<HelpPage />} />

          {/* Non-prefixed general sidebar page aliases */}
          <Route path="/inventory"              element={<InventoryPage />} />
          <Route path="/settlements"            element={<SettlementsPage />} />
          <Route path="/settings"               element={<SettingsPage />} />
          <Route path="/profile"                element={<ProfilePage />} />
          <Route path="/settings/terms"         element={<TermsPage />} />
          <Route path="/settings/privacy"       element={<PrivacyPolicyPage />} />
          <Route path="/settings/pricing"       element={<PricingPage />} />
          <Route path="/settings/shipping"      element={<ShippingReturnPage />} />
          <Route path="/help"                   element={<HelpPage />} />
          <Route path="/help-center"            element={<HelpPage />} />

          {/* Advertisement */}
          <Route path="/dashboard/advertisement"                 element={<AdvertisementPage />} />
          <Route path="/dashboard/advertisement/create-campaign" element={<CreateCampaignPage />} />
          <Route path="/advertisement"                           element={<AdvertisementPage />} />
          <Route path="/advertisement/create-campaign"           element={<CreateCampaignPage />} />

          {/* HaatzaUp */}
          <Route path="/dashboard/haatzaup"             element={<HaatzaUpPage />} />
          <Route path="/dashboard/haatzaup/upload-reel" element={<UploadReelPage />} />
          <Route path="/haatzaup"                       element={<HaatzaUpPage />} />
          <Route path="/haatzaup/upload-reel"           element={<UploadReelPage />} />

          {/* Orders */}
          <Route path="/dashboard/orders"                      element={<OrdersPage />} />
          <Route path="/dashboard/orders/details/:tableId"     element={<OrderDetailsPage />} />
          <Route path="/dashboard/orders/cancel/:tableId"      element={<CancelShipmentPage />} />
          <Route path="/dashboard/orders/tracking/:waybill"    element={<TrackingPage />} />
          <Route path="/dashboard/orders/confirmed"            element={<ConfirmedOrdersPage />} />
          <Route path="/dashboard/orders/shipped"              element={<ShippedOrdersPage />} />
          <Route path="/dashboard/orders/cancelled"            element={<CancelledOrdersPage />} />
          <Route path="/orders"                                element={<OrdersPage />} />
          <Route path="/orders/details/:tableId"               element={<OrderDetailsPage />} />
          <Route path="/orders/cancel/:tableId"                element={<CancelShipmentPage />} />
          <Route path="/orders/tracking/:waybill"              element={<TrackingPage />} />
          <Route path="/orders/confirmed"                      element={<ConfirmedOrdersPage />} />
          <Route path="/orders/shipped"                        element={<ShippedOrdersPage />} />
          <Route path="/orders/cancelled"                      element={<CancelledOrdersPage />} />

         
          {/* Placeholder sidebar pages */}
          <Route path="/dashboard/return-exchange"  element={<ReturnExchange />} />
          <Route path="/dashboard/returns"          element={<ReturnExchange />} />
          <Route path="/dashboard/returns/details/:tableId"  element={<ReturnDetailsPage />} />
          <Route path="/returns"                    element={<ReturnExchange />} />
          <Route path="/returns/details/:tableId"   element={<ReturnDetailsPage />} />
          <Route path="/return-exchange"            element={<ReturnExchange />} />
          <Route path="/return-exchange/details/:tableId"   element={<ReturnDetailsPage />} />
          <Route path="/dashboard/growplan"         element={<GrowPlanPage />} />
          <Route path="/dashboard/growplan/review"  element={<PlanReviewPage />} />
          <Route path="/growplan"                   element={<GrowPlanPage />} />
          <Route path="/growplan/review"            element={<PlanReviewPage />} />
          <Route path="/dashboard/productinsight"   element={<ProductInsightsList />} />
          <Route path="/productinsight"             element={<ProductInsightsList />} />
          <Route path="/product-insight/:tableId"   element={<ProductInsightDetails />} />
          <Route path="/dashboard/warehouse"        element={<WarehousePage />} />
          <Route path="/dashboard/warehouse/callback" element={<WarehousePage />} />
          <Route path="/warehouse"                  element={<WarehousePage />} />
          <Route path="/warehouse/callback"          element={<WarehousePage />} />
          <Route path="/warehouse/get-started" element={<WarehouseGetStarted />} />
          <Route path="/dashboard/influencer"       element={<InfluenceBranding />} />
          <Route path="/influencer"                 element={<InfluenceBranding />} />
          <Route path="/dashboard/influencer/details/:tableId" element={<InfluenceBrandingDetails />} />
          <Route path="/influencer/details/:tableId"           element={<InfluenceBrandingDetails />} />
          <Route path="/dashboard/growthcentral"    element={<GrowthCentral />} />
          <Route path="/growthcentral"              element={<GrowthCentral />} />
          <Route path="/dashboard/qualityinsights"  element={<QualityInsightsPage />} />
          <Route path="/qualityinsights"            element={<QualityInsightsPage />} />
          <Route path="/dashboard/referandearn"     element={<ReferEarn />} />
          <Route path="/referandearn"               element={<ReferEarn />} />
          <Route path="/referearn"                  element={<ReferEarn />} />
          <Route path="/dashboard/referearn"        element={<ReferEarn />} />
          <Route path="/refer-earn"                 element={<ReferEarn />} />
          <Route path="/dashboard/refer-earn"       element={<ReferEarn />} />
          <Route path="/refer-earn/share"           element={<ReferralShare />} />
          <Route path="/dashboard/refer-earn/share" element={<ReferralShare />} />

          {/* ── Listings: Create flow ── */}
          <Route path="/dashboard/listing"                                                              element={<AddListing />} />
          <Route path="/dashboard/listing/select-category"                                             element={<SelectCategory />} />
          <Route path="/dashboard/listing/select-category/product-info"                               element={<ProductInfo />} />
          <Route path="/dashboard/listing/select-category/product-info/specifications"                element={<SpecificationPage />} />
          <Route path="/dashboard/listing/select-category/product-info/specifications/promotions"     element={<PromotionPage />} />
          <Route path="/dashboard/listing/promotions"                                                  element={<ReviewSubmitPage />} />
          <Route path="/listing"                                                                       element={<AddListing />} />
          <Route path="/listing/select-category"                                                      element={<SelectCategory />} />
          <Route path="/listing/select-category/product-info"                                        element={<ProductInfo />} />
          <Route path="/listing/select-category/product-info/specifications"                         element={<SpecificationPage />} />
          <Route path="/listing/select-category/product-info/specifications/promotions"              element={<PromotionPage />} />
          <Route path="/listing/promotions"                                                           element={<ReviewSubmitPage />} />

          {/* ── Listings: Edit flow ── */}
          <Route path="/dashboard/listing/edit/:tableId/product-info"                                              element={<ProductInfo />} />
          <Route path="/dashboard/listing/edit/:tableId/product-info/specifications"                               element={<SpecificationPage />} />
          <Route path="/dashboard/listing/edit/:tableId/product-info/specifications/promotions"                    element={<PromotionPage />} />
          <Route path="/dashboard/listing/edit/:tableId/product-info/specifications/promotions/review"             element={<ReviewSubmitPage />} />
          <Route path="/listing/edit/:tableId/product-info"                                                        element={<ProductInfo />} />
          <Route path="/listing/edit/:tableId/product-info/specifications"                                         element={<SpecificationPage />} />
          <Route path="/listing/edit/:tableId/product-info/specifications/promotions"                              element={<PromotionPage />} />
          <Route path="/listing/edit/:tableId/product-info/specifications/promotions/review"                       element={<ReviewSubmitPage />} />

          {/* ── Listings: Views ── */}
          <Route path="/dashboard/listing/my-listings"   element={<MyListings />} />
          <Route path="/dashboard/listing/view-details"  element={<ReviewSubmitPage />} />
          <Route path="/dashboard/listing/in-progress"   element={<InProgressListings />} />
          <Route path="/dashboard/my-listings"           element={<MyListings />} />
          <Route path="/dashboard/inprogress-listings"   element={<InProgressListings />} />
          <Route path="/listing/my-listings"             element={<MyListings />} />
          <Route path="/listing/view-details"            element={<ReviewSubmitPage />} />
          <Route path="/listing/in-progress"             element={<InProgressListings />} />
          <Route path="/my-listings"                     element={<MyListings />} />
          <Route path="/inprogress-listings"             element={<InProgressListings />} />

        </Route>

        {/* Catch-all — redirect unknown routes back to signup */}
        <Route path="*" element={<Navigate to="/signin" replace />} />

      </Routes>
    </Suspense>
  );
}

export default AppRoutes;
