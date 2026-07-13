import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { resolveSellerEmail } from "../../utils/sellerSession";

import { 
  BrandingHeader, 
  BrandingHero, 
  BrandingStats, 
  BrandingBenefitsCard, 
  BrandingSearchBar, 
  BrandingProductTable, 
  BrandingProductCard,
  BrandingToggleModal, 
  BrandingEmptyState, 
  BrandingLoadingSkeleton
} from "../../components/InfluenceBranding";

import "./InfluenceBranding.css";

const getSellerEmail = () => {
  const resolved = resolveSellerEmail();
  if (resolved) return resolved;

  const sessionKeys = ["pendingEmail", "userEmail", "email", "sellerEmail",
                       "user_email", "seller_email", "currentUserEmail"];
  for (const key of sessionKeys) {
    const val = sessionStorage.getItem(key);
    if (val && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return val;
    try {
      const parsed = JSON.parse(val);
      const found  = parsed?.email || parsed?.userEmail || parsed?.sellerEmail;
      if (found && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(found)) return found;
    } catch { /* not JSON */ }
  }

  const localKeys = [
    "userEmail", "email", "sellerEmail", "user_email", "seller_email",
    "user", "authUser", "currentUser", "seller", "userData",
    "sellerData", "auth", "session", "loginData", "accountData",
  ];
  for (const key of localKeys) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.trim())) return raw.trim();
    try {
      const parsed = JSON.parse(raw);
      const emailFields = ["email", "userEmail", "sellerEmail", "user_email",
                           "seller_email", "emailAddress", "loginEmail"];
      for (const field of emailFields) {
        const found = parsed?.[field];
        if (found && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(found)) return found;
      }
    } catch { /* not JSON */ }
  }
  return "";
};

const InfluenceBranding = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters & Tabs state
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState(() => {
    if (location.state && location.state.fromTab) {
      return location.state.fromTab;
    }
    return "not_promoted";
  });

  // Checkbox selection mode states
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Checkbox multi-select state
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Modal toggle state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState("enable"); // "enable" or "disable"
  const [modalTargetIds, setModalTargetIds] = useState([]);

  // Custom toast status notifications
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  const showToastMessage = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3500);
  };

  // Fetch products
  const fetchProducts = useCallback(async (isSilent = false) => {
    if (!isSilent) {
      setLoading(true);
      setError(null);
    }
    try {
      const email = getSellerEmail();
      const response = await axios.get("https://haatza.com/_functions/seller_products", {
        params: { email, page: 1, limit: 100, type: "mylisting" }
      });

      let fetchedList = [];
      if (response.data?.status === "success" && response.data?.message?.body?.sellerProducts) {
        fetchedList = response.data.message.body.sellerProducts;
      } else if (Array.isArray(response.data?.products)) {
        fetchedList = response.data.products;
      }

      // Apply pending updates from localStorage to prevent Wix indexing cache overrides
      try {
        const raw = localStorage.getItem("haatza_branding_local_overrides");
        if (raw) {
          const overrides = JSON.parse(raw);
          const now = Date.now();
          let changed = false;

          fetchedList = fetchedList.map((p) => {
            const tableIdStr = String(p.Table_ID);
            const override = overrides[tableIdStr];
            if (override) {
              // If the database has caught up to match the override, we remove the override
              if (p.sellAndEarn === override.status) {
                delete overrides[tableIdStr];
                changed = true;
                return p;
              }
              // If the override has expired (e.g. 5 minutes / 300,000 ms), we remove it
              if (now - override.timestamp > 300000) {
                delete overrides[tableIdStr];
                changed = true;
                return p;
              }
              // Otherwise, we apply the local override status
              return { ...p, sellAndEarn: override.status };
            }
            return p;
          });

          if (changed) {
            localStorage.setItem("haatza_branding_local_overrides", JSON.stringify(overrides));
          }
        }
      } catch (e) {
        console.error("Error applying branding overrides:", e);
      }

      setProducts(fetchedList);
    } catch (err) {
      console.error("Error loading products:", err);
      if (!isSilent) {
        setError(err.message || "Failed to load products list.");
      }
    } finally {
      if (!isSilent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchProducts(true);
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchProducts]);

  // Clear selections and reset page when activeTab changes
  useEffect(() => {
    setSelectedIds(new Set());
    setCurrentPage(1);
  }, [activeTab]);

  // Listen to tab redirection from details page
  useEffect(() => {
    if (location.state && location.state.fromTab) {
      setActiveTab(location.state.fromTab);

      const { updatedProductId, updatedStatus } = location.state;
      if (updatedProductId) {
        try {
          const raw = localStorage.getItem("haatza_branding_local_overrides") || "{}";
          const overrides = JSON.parse(raw);
          const targetIds = Array.isArray(updatedProductId) ? updatedProductId : [updatedProductId];
          targetIds.forEach((id) => {
            overrides[String(id)] = { status: updatedStatus, timestamp: Date.now() };
          });
          localStorage.setItem("haatza_branding_local_overrides", JSON.stringify(overrides));
        } catch (e) {
          console.error("Error setting branding overrides:", e);
        }

        setProducts((prev) => {
          const targetIds = Array.isArray(updatedProductId) ? updatedProductId : [updatedProductId];
          return prev.map((p) => 
            targetIds.map(String).includes(String(p.Table_ID)) 
              ? { ...p, sellAndEarn: updatedStatus } 
              : p
          );
        });
      }
    }
  }, [location.state]);

  // Clear selections and reset page when searchQuery changes
  useEffect(() => {
    setSelectedIds(new Set());
    setCurrentPage(1);
  }, [searchQuery]);

  const handleToggleSelectionMode = () => {
    setIsSelectionMode((prev) => {
      if (prev) {
        setSelectedIds(new Set());
      }
      return !prev;
    });
  };

  const handleCancelSelection = () => {
    setSelectedIds(new Set());
    setIsSelectionMode(false);
  };

  // Client-side stats aggregates
  const stats = useMemo(() => {
    const total = products.length;
    const enabled = products.filter((p) => p.sellAndEarn === true).length;
    const disabled = total - enabled;
    return { total, enabled, disabled };
  }, [products]);

  // Filter listings based on active tab and search query
  const filteredProducts = useMemo(() => {
    const tabFiltered = products.filter((p) => {
      const isPromoted = p.sellAndEarn === true;
      return activeTab === "promoted" ? isPromoted : !isPromoted;
    });

    if (!searchQuery) return tabFiltered;
    const query = searchQuery.toLowerCase().trim();
    return tabFiltered.filter((p) => (p.name || "").toLowerCase().includes(query));
  }, [products, activeTab, searchQuery]);

  // Sliced products on the current page (10 per page)
  const paginatedProducts = useMemo(() => {
    const startIdx = (currentPage - 1) * 10;
    return filteredProducts.slice(startIdx, startIdx + 10);
  }, [filteredProducts, currentPage]);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredProducts.length / 10));
  }, [filteredProducts]);

  // Checkbox row select togglers
  const handleSelectRow = (tableId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(tableId)) {
        next.delete(tableId);
      } else {
        next.add(tableId);
      }
      return next;
    });
  };

  const handleSelectAll = (isSelectAll) => {
    if (isSelectAll) {
      const ids = paginatedProducts.map((p) => p.Table_ID);
      setSelectedIds(new Set(ids));
    } else {
      setSelectedIds(new Set());
    }
  };

  // Open details page
  const handleOpenDetails = (product) => {
    navigate(`/dashboard/influencer/details/${product.Table_ID}`, {
      state: { fromTab: activeTab }
    });
  };

  // Open Promote modal (handles both bulk and single product promotion confirmation popup)
  const handleOpenModal = (productOrArray, actionType) => {
    if (Array.isArray(productOrArray)) {
      // Bulk action
      setModalTargetIds(productOrArray);
      setModalType(actionType);
      setModalOpen(true);
    } else {
      // Single product action
      if (actionType === "enable") {
        // Not Promoted -> Promoted flow: show confirmation popup first
        setModalTargetIds([productOrArray.Table_ID]);
        setModalType("single-promote");
        setModalOpen(true);
      } else {
        // If Promoted tab has details click, it goes directly to details
        navigate(`/dashboard/influencer/details/${productOrArray.Table_ID}`, {
          state: { fromTab: activeTab }
        });
      }
    }
  };

  // POST update execution
  const handleConfirmBrandingToggle = async () => {
    setModalOpen(false);

    if (modalType === "single-promote") {
      // Single product promote confirmed -> open details page
      const targetId = modalTargetIds[0];
      navigate(`/dashboard/influencer/details/${targetId}`, {
        state: { fromTab: activeTab }
      });
      return;
    }

    setLoading(true);
    const isEnable = modalType === "enable";

    try {
      const response = await axios.post("https://haatza.com/_functions/updateInfluencerBranding", {
        tableId: modalTargetIds,
        influencerBranding: isEnable
      });

      if (response.data?.status === "success") {
        // Track the pending update in localStorage so background fetch doesn't revert it
        try {
          const raw = localStorage.getItem("haatza_branding_local_overrides") || "{}";
          const overrides = JSON.parse(raw);
          const targetIds = Array.isArray(modalTargetIds) ? modalTargetIds : [modalTargetIds];
          targetIds.forEach((id) => {
            overrides[String(id)] = { status: isEnable, timestamp: Date.now() };
          });
          localStorage.setItem("haatza_branding_local_overrides", JSON.stringify(overrides));
        } catch (e) {
          console.error("Error setting branding overrides:", e);
        }

        // Optimistically update local state for instant UI updates
        setProducts((prevProducts) =>
          prevProducts.map((p) =>
            modalTargetIds.map(String).includes(String(p.Table_ID)) ? { ...p, sellAndEarn: isEnable } : p
          )
        );

        showToastMessage(
          isEnable 
            ? "Influence branding enabled successfully." 
            : "Influence branding disabled successfully.",
          "success"
        );
        setSelectedIds(new Set());
        setIsSelectionMode(false); // Clear and exit selection mode upon bulk promotion success
        setLoading(false);

        // Fetch products in background after 2 seconds to keep in sync
        setTimeout(() => {
          fetchProducts();
        }, 2000);
      } else {
        throw new Error(response.data?.message || "Failed to update status");
      }
    } catch (err) {
      console.error("Error updating influencer status:", err);
      showToastMessage("Failed to update branding. Please try again.", "error");
      setLoading(false);
    }
  };

  return (
    <div className="ib-page-outer">
      {/* Toast Notification Alert */}
      <AnimatePresence>
        {toast.show && (
          <motion.div 
            className={`ib-toast-wrap ib-toast-${toast.type}`}
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.25 }}
          >
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="ib-page-container">
        {/* Section 1: Header */}
        <BrandingHeader />

        {loading && products.length === 0 ? (
          <BrandingLoadingSkeleton />
        ) : error ? (
          <div className="ib-error-wrapper">
            <AlertTriangle size={48} className="ib-error-icon" />
            <h2 className="ib-error-title">Failed to load content</h2>
            <p className="ib-error-desc">{error}</p>
            <button className="ib-error-retry-btn" onClick={fetchProducts}>
              <RefreshCw size={16} /> Retry
            </button>
          </div>
        ) : (
          <>
            {/* Section 2: Hero */}
            <BrandingHero />

            {/* Section 3: Statistics */}
            <BrandingStats 
              total={stats.total} 
              enabled={stats.enabled} 
              disabled={stats.disabled} 
            />

            {/* Section 4: Benefits Grid */}
            <BrandingBenefitsCard />

            {/* Section 5: Search Query Bar */}
            <BrandingSearchBar 
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              promotedCount={stats.enabled}
              notPromotedCount={stats.disabled}
            />

            {/* Section 5.5: Products Heading & Select Multiple */}
            <div className="ib-products-section-header">
              <h2 className="ib-products-heading">
                {activeTab === "promoted" ? "Promoted Products" : "Available Products"}
              </h2>
              <div className="ib-products-header-actions">
                {isSelectionMode && (
                  <span className="ib-selected-count-label">
                    Selected: {selectedIds.size} {selectedIds.size === 1 ? "Product" : "Products"}
                  </span>
                )}
                {!isSelectionMode && (
                  <button 
                    type="button"
                    className="ib-select-multiple-btn"
                    onClick={handleToggleSelectionMode}
                  >
                    Select Multiple
                  </button>
                )}
                {isSelectionMode && (
                  <button 
                    type="button"
                    className="ib-cancel-selection-btn"
                    onClick={handleCancelSelection}
                  >
                    Cancel Selection
                  </button>
                )}
              </div>
            </div>

            {/* Section 6: Listings Container */}
            {filteredProducts.length === 0 ? (
              <BrandingEmptyState 
                title={searchQuery ? "No matches found" : "No products available"}
                desc={searchQuery ? "Try refining your search keyword" : "Add products to start promoting"}
              />
            ) : (
              <>
                {/* Desktop View Table */}
                <div className="ib-desktop-table-view">
                  <BrandingProductTable 
                    products={paginatedProducts}
                    selectedIds={selectedIds}
                    onSelectRow={handleSelectRow}
                    onSelectAll={handleSelectAll}
                    onOpenModal={handleOpenModal}
                    onOpenDetails={handleOpenDetails}
                    isSelectionMode={isSelectionMode}
                    activeTab={activeTab}
                  />
                </div>

                {/* Mobile View Cards */}
                <div className="ib-mobile-cards-view">
                  {paginatedProducts.map(p => (
                    <BrandingProductCard 
                      key={p.Table_ID}
                      product={p}
                      isSelected={selectedIds.has(p.Table_ID)}
                      onSelectRow={handleSelectRow}
                      onOpenDetails={handleOpenDetails}
                      isSelectionMode={isSelectionMode}
                    />
                  ))}
                </div>

                {/* Sticky Bottom Actions Bar (appears when 2 or more items selected) */}
                <AnimatePresence>
                  {selectedIds.size >= 2 && (
                    <motion.div 
                      className="ib-sticky-actions-bar"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 74, opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="ib-sticky-inner">
                        <span className="ib-sticky-count">
                          <strong>{selectedIds.size}</strong> product{selectedIds.size > 1 ? "s" : ""} selected
                        </span>
                        
                        {activeTab === "promoted" ? (
                          <button 
                            className="ib-sticky-btn stop-btn"
                            onClick={() => handleOpenModal(Array.from(selectedIds), "disable")}
                          >
                            Stop Promoting Selected
                          </button>
                        ) : (
                          <button 
                            className="ib-sticky-btn promote-btn"
                            onClick={() => handleOpenModal(Array.from(selectedIds), "enable")}
                          >
                            Promote Selected
                          </button>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="ib-pagination-container">
                    <button 
                      type="button"
                      className="ib-pagination-btn"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft size={16} />
                      <span>Previous</span>
                    </button>
                    <span className="ib-pagination-info">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button 
                      type="button"
                      className="ib-pagination-btn"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                    >
                      <span>Next</span>
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>



      {/* Confirm Toggle Modal */}
      <BrandingToggleModal 
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={handleConfirmBrandingToggle}
        type={modalType}
        count={modalTargetIds.length}
      />
    </div>
  );
};

export default InfluenceBranding;
