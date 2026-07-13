// AddListing.js
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./AddListing.css";
import MyListings from "../MyListings/MyListings";
import InProgressListings from "../InProgressListings/InProgressListings";
import {
  fetchSellerListings,
  fetchInProgressListings,
  getProductStats,
  getTopSellingProducts,
  fetchCategories,
  getCachedSellerEmail,
  getCachedSellerId,
  fetchProductDetails,
} from "../../../services/sellerService";

const AddListing = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [activeTab, setActiveTab] = useState(location.state?.tab || "my-listings"); // "my-listings" | "inprogress"

  const [cardVisible, setCardVisible] = useState(false);
  const [barVisible, setBarVisible] = useState(false);
  const barRef = useRef(null);
  const mBarRef = useRef(null);
  const tabSectionRef = useRef(null); // ref to scroll to tab content

  // ── Seller data state ──────────────────────────────────────────
  const [loadingStats, setLoadingStats] = useState(true);
  const [isNewSeller, setIsNewSeller] = useState(false);

  const [listingStats, setListingStats] = useState({ totalProducts: 0, activeListings: 0 });
  const [listingSummary, setListingSummary] = useState({
    total: 0,
    approved: 0,
    draft: 0,
    inReview: 0,
    updateRequested: 0,
  });
  const [inProgressCount, setInProgressCount] = useState(0);
  const [inProgressBreakdown, setInProgressBreakdown] = useState({ uploaded: 0, qc: 0, review: 0 });
  const [topCategories, setTopCategories] = useState([]); // [{name, count, imageUrl}]
  const [topProduct, setTopProduct] = useState(null);     // {name, price, rating, sold, imageUrl, isRecent}
  const [trendingCategories, setTrendingCategories] = useState([]); // for new sellers
  const [latestInProgressProduct, setLatestInProgressProduct] = useState(null); // {name, status}
  const [categoryIconMap, setCategoryIconMap] = useState({}); // {categoryName: imageUrl} from site category list
  const [animatedListings, setAnimatedListings] = useState(0);
  const [animatedInProgress, setAnimatedInProgress] = useState(0);

  // ── Fetch real seller data on mount ──────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const loadSellerData = async () => {
      setLoadingStats(true);
      try {
        const email = getCachedSellerEmail();
        const sellerId = getCachedSellerId();

        if (!email) {
          if (!cancelled) {
            setIsNewSeller(true);
            setLoadingStats(false);
          }
          return;
        }

        // Step 1: cheap check — does this seller have ANY listings?
        const firstPage = await fetchSellerListings({ email, page: 1, limit: 1 });
        const total = firstPage?.total || 0;
        const newSeller = total === 0;

        if (cancelled) return;
        setIsNewSeller(newSeller);

        if (newSeller) {
          // ── NEW SELLER: pull trending categories for inspiration ──
          try {
            const cats = await fetchCategories();
            if (!cancelled) setTrendingCategories(cats.slice(0, 4));
          } catch (e) {
            console.warn("[AddListing] Failed to load trending categories:", e);
          }
          setLoadingStats(false);
          return;
        }

        // ── EXISTING SELLER: pull real stats in parallel ──
        const [statsRes, firstInProgressRes, topProductRes, firstAllListingsRes] = await Promise.allSettled([
          getProductStats(sellerId || email),
          fetchInProgressListings({ email, page: 1, limit: 100 }),
          getTopSellingProducts(sellerId),
          fetchSellerListings({ email, page: 1, limit: 100 }),
        ]);

        if (cancelled) return;

        // Fetch remaining in-progress listings if any
        let inProgressProducts = [];
        let inProgressTotalCount = 0;
        if (firstInProgressRes.status === "fulfilled") {
          inProgressTotalCount = firstInProgressRes.value?.total || 0;
          inProgressProducts = [...(firstInProgressRes.value?.products || [])];
          
          if (firstInProgressRes.value?.totalPages > 1) {
            try {
              const rest = await Promise.all(
                Array.from({ length: firstInProgressRes.value.totalPages - 1 }, (_, i) =>
                  fetchInProgressListings({ email, page: i + 2, limit: 100 })
                )
              );
              rest.forEach((r) => {
                if (r?.products) {
                  inProgressProducts = inProgressProducts.concat(r.products);
                }
              });
            } catch (err) {
              console.warn("[AddListing] Failed to fetch rest of in-progress listings:", err);
            }
          }
        }

        // Fetch remaining all listings if any
        let allListingsProducts = [];
        if (firstAllListingsRes.status === "fulfilled") {
          allListingsProducts = [...(firstAllListingsRes.value?.products || [])];
          
          if (firstAllListingsRes.value?.totalPages > 1) {
            try {
              const rest = await Promise.all(
                Array.from({ length: firstAllListingsRes.value.totalPages - 1 }, (_, i) =>
                  fetchSellerListings({ email, page: i + 2, limit: 100 })
                )
              );
              rest.forEach((r) => {
                if (r?.products) {
                  allListingsProducts = allListingsProducts.concat(r.products);
                }
              });
            } catch (err) {
              console.warn("[AddListing] Failed to fetch rest of all listings:", err);
            }
          }
        }

        if (cancelled) return;

        // Build consolidated product array (drafts + active/submitted listings)
        const seenIds = new Set();
        const consolidated = [];
        [...allListingsProducts, ...inProgressProducts].forEach((p) => {
          if (!p) return;
          const id = p.Table_ID || p._id || p.id || p.productId;
          if (id && !seenIds.has(id)) {
            seenIds.add(id);
            consolidated.push(p);
          }
        });

        // Update in-progress count & latest product
        setInProgressCount(inProgressTotalCount);
        if (inProgressProducts.length > 0) {
          const latest = inProgressProducts[0];
          setLatestInProgressProduct({
            name: latest.name || "Unnamed draft",
            status: latest.status || "Draft",
          });

          // Compute breakdown
          let uploaded = 0, qc = 0, review = 0;
          inProgressProducts.forEach((p) => {
            const s = (p.status || "").toLowerCase();
            if (s.includes("qc") || s.includes("qc check")) {
              qc++;
            } else if (s.includes("under review") || s.includes("review") || s.includes("pending")) {
              review++;
            } else {
              uploaded++;
            }
          });
          setInProgressBreakdown({ uploaded, qc, review });
        } else {
          setLatestInProgressProduct(null);
          setInProgressBreakdown({ uploaded: 0, qc: 0, review: 0 });
        }

        // Aggregate real counts per stage for the breakdown + mini chart
        let approved = 0, draft = 0, inReview = 0, updateRequested = 0;
        consolidated.forEach((p) => {
          const s = (p.status || "").toLowerCase();
          if (s === "approved" || s === "live") {
            approved++;
          } else if (s === "draft") {
            draft++;
          } else if (s === "under review" || s === "pending" || s === "qc check") {
            inReview++;
          } else if (s === "update requested" || s === "update_requested" || s === "rejected") {
            updateRequested++;
          } else {
            draft++;
          }
        });

        if (!cancelled) {
          setListingSummary({
            total: consolidated.length,
            approved,
            draft,
            inReview,
            updateRequested
          });
          setListingStats({
            totalProducts: consolidated.length,
            activeListings: approved,
          });
        }

        // Top selling product (fallback handled below once we have allListings/consolidated)
        let resolvedTopProduct = null;
        if (topProductRes.status === "fulfilled") {
          const raw = topProductRes.value;
          const list = Array.isArray(raw?.data) ? raw.data
            : Array.isArray(raw?.message) ? raw.message
              : Array.isArray(raw) ? raw
                : [];
          const best = list[0];
          if (best) {
            const bestId = best.Table_ID || best._id || best.id || best.productId;
            try {
              const fullProduct = await fetchProductDetails(bestId);
              resolvedTopProduct = {
                ...best,
                ...fullProduct,
                name: best.name || fullProduct?.name || best.productName || "Your product",
                price: best.price ?? fullProduct?.price ?? best.finalPrice ?? 0,
                rating: best.rating ?? best.avgRating ?? null,
                sold: best.sold ?? best.unitsSold ?? best.totalSold ?? null,
                imageUrl: best.mainmedia || fullProduct?.mainmedia || best.imageUrl || null,
                category: resolveCategoryName(fullProduct || best),
                subCategory: resolveSubcategoryName(fullProduct || best),
                status: best.status || fullProduct?.status || "Live",
                isRecent: false,
              };
            } catch (e) {
              console.warn("Failed to load details for top product:", e);
              resolvedTopProduct = {
                ...best,
                name: best.name || best.productName || "Your product",
                price: best.price ?? best.finalPrice ?? 0,
                rating: best.rating ?? best.avgRating ?? null,
                sold: best.sold ?? best.unitsSold ?? best.totalSold ?? null,
                imageUrl: best.mainmedia || best.imageUrl || null,
                category: resolveCategoryName(best),
                subCategory: resolveSubcategoryName(best),
                status: best.status || "Live",
                isRecent: false,
              };
            }
          }
        }

        // Category aggregation using the consolidated list
        const counts = {};
        consolidated.forEach((p) => {
          const catName = resolveCategoryName(p);
          if (catName) {
            if (!counts[catName]) counts[catName] = 0;
            counts[catName] += 1;
          }
        });

        let sortedCatsResult = [];
        try {
          const allCats = await fetchCategories();
          const iconMap = {};
          allCats.forEach((c) => { if (c.name) iconMap[c.name] = c.imageUrl; });
          if (!cancelled) setCategoryIconMap(iconMap);

          const mappedCats = allCats.map((c) => ({
            name: c.name,
            count: counts[c.name] || 0,
            imageUrl: c.imageUrl || null,
          })).sort((a, b) => b.count - a.count);

          sortedCatsResult = mappedCats;
          if (!cancelled) setTopCategories(mappedCats);
        } catch (e) {
          console.warn("[AddListing] Failed to load category icons:", e);
          const sortedCats = Object.entries(counts).map(([name, count]) => ({
            name,
            count,
            imageUrl: null,
          })).sort((a, b) => b.count - a.count);
          sortedCatsResult = sortedCats;
          if (!cancelled) setTopCategories(sortedCats);
        }

        // Fallback: most recent listing as "featured" card if no top-seller data
        if (!resolvedTopProduct && consolidated.length > 0) {
          const recent = consolidated[0];
          const recentId = recent.Table_ID || recent._id || recent.id || recent.productId;
          try {
            const fullProduct = await fetchProductDetails(recentId);
            resolvedTopProduct = {
              ...recent,
              ...fullProduct,
              name: recent.name || fullProduct?.name || "Your latest listing",
              price: recent.price ?? fullProduct?.price ?? 0,
              rating: null,
              sold: null,
              imageUrl: recent.mainmedia || fullProduct?.mainmedia || null,
              category: resolveCategoryName(fullProduct || recent),
              subCategory: resolveSubcategoryName(fullProduct || recent),
              status: recent.status || fullProduct?.status || "Live",
              isRecent: true,
            };
          } catch (e) {
            console.warn("Failed to load details for recent product:", e);
            resolvedTopProduct = {
              ...recent,
              name: recent.name || "Your latest listing",
              price: recent.price ?? 0,
              rating: null,
              sold: null,
              imageUrl: recent.mainmedia || null,
              category: resolveCategoryName(recent),
              subCategory: resolveSubcategoryName(recent),
              status: recent.status || "Live",
              isRecent: true,
            };
          }
        }

        // If no categories have counts, fall back to trending categories
        const hasCategoriesWithCounts = sortedCatsResult.some(c => c.count > 0);
        if (!hasCategoriesWithCounts) {
          try {
            const cats = await fetchCategories();
            if (!cancelled) setTrendingCategories(cats.slice(0, 4));
          } catch (e) {
            console.warn("[AddListing] Failed to load fallback trending categories:", e);
          }
        }

        if (!cancelled) setTopProduct(resolvedTopProduct);
      } catch (err) {
        console.error("[AddListing] Failed to load seller data:", err);
      } finally {
        if (!cancelled) setLoadingStats(false);
      }
    };

    loadSellerData();
    return () => { cancelled = true; };
  }, []);

  // ── Count-up animation once real numbers are in ──────────────────
  useEffect(() => {
    setCardVisible(true);
    if (loadingStats) return;

    const steps = 40;
    let count = 0;
    const targets = {
      listings: listingStats.activeListings || 0,
      inProgress: inProgressCount || 0,
    };
    const timer = setInterval(() => {
      count++;
      setAnimatedListings(Math.min(Math.round((targets.listings / steps) * count), targets.listings));
      setAnimatedInProgress(Math.min(Math.round((targets.inProgress / steps) * count), targets.inProgress));
      if (count >= steps) clearInterval(timer);
    }, 900 / steps);
    return () => clearInterval(timer);
  }, [loadingStats, listingStats, inProgressCount]);

  useEffect(() => {
    if (location.state?.tab) {
      setActiveTab(location.state.tab);
      setTimeout(() => {
        tabSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }, [location.state]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setBarVisible(true); },
      { threshold: 0.3 }
    );
    if (barRef.current) observer.observe(barRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setBarVisible(true); },
      { threshold: 0.1 }
    );
    if (mBarRef.current) observer.observe(mBarRef.current);
    return () => observer.disconnect();
  }, []);

  const handleTabClick = (tab) => {
    setActiveTab(prev => {
      const next = prev === tab ? null : tab; // clicking same tab collapses it
      if (next) {
        setTimeout(() => {
          tabSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
      }
      return next;
    });
  };

  const fmt = (v) => (v >= 1000 ? `₹${(v / 1000).toFixed(1)}k` : `₹${v ?? 0}`);
  const formatINR = (v) => `₹${(Number(v) || 0).toLocaleString("en-IN")}`;

  // Checklist progress for new sellers (simple heuristic — expand as needed)
  const checklistSteps = [
    { label: "Account created", done: true },
    { label: "Add your first product", done: false },
    { label: "Complete seller profile", done: false },
    { label: "Set up payment details", done: false },
  ];
  const doneCount = checklistSteps.filter((s) => s.done).length;
  const checklistPct = Math.round((doneCount / checklistSteps.length) * 100);

  return (
    <div className="al-root">
      <section className="al-hero">

        {/* ── Hero Left ── */}
        <div className="al-hero-left">

          <h1 className={`al-h1 ${cardVisible ? "al-fadeup" : ""}`}>
            Start Selling.<br />
            <span className="al-h1-grad">Start Growing.</span>
          </h1>

          <p className={`al-sub ${cardVisible ? "al-fadeup al-d1" : ""}`}>
            Create powerful product listings and grow your business faster with
            Haatza's intelligent seller tools.
          </p>

          {/* Mobile cards */}
          <div className="al-mobile-cards" ref={mBarRef}>
            <div className="al-mc-grid">
              {loadingStats ? (
                <>
                  <DesktopSkeletonCard slot="revenue" />
                  <DesktopSkeletonCard slot="orders" />
                  <DesktopSkeletonCard slot="views" />
                  <DesktopSkeletonCard slot="product" />
                </>
              ) : isNewSeller ? (
                <>
                  <ChecklistCard pct={checklistPct} doneCount={doneCount} steps={checklistSteps} slot="product" />
                  <TrendingCategoriesCard categories={trendingCategories} slot="orders" />
                  <AddFirstProductCard navigate={navigate} slot="revenue" />
                  <TipCard slot="views" />
                </>
              ) : (
                <>
                  <ListingsCard
                    animatedListings={animatedListings}
                    activeListings={listingStats.activeListings}
                    totalProducts={listingStats.totalProducts}
                    summary={listingSummary}
                    slot="revenue"
                  />
                  <SellerMomentumCard
                    summary={listingSummary}
                    slot="orders"
                  />
                  <CategoriesCard
                    categories={topCategories}
                    iconMap={categoryIconMap}
                    slot="views"
                    trending={trendingCategories}
                  />
                  <TopProductCard
                    product={topProduct}
                    navigate={navigate}
                    formatINR={formatINR}
                    slot="product"
                  />
                </>
              )}
            </div>
          </div>

          {/* Action row */}
          <div className={`al-action-row ${cardVisible ? "al-fadeup al-d2" : ""}`}>
            <div className="al-tabs">
              <button
                className={`al-tab ${activeTab === "my-listings" ? "al-tab--active" : ""}`}
                onClick={() => handleTabClick("my-listings")}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" />
                  <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" />
                  <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" />
                  <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" />
                </svg>
                My Listings
              </button>

              <button
                className={`al-tab ${activeTab === "inprogress" ? "al-tab--active" : ""}`}
                onClick={() => handleTabClick("inprogress")}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
                  <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                In Progress
              </button>
            </div>

            <button
              className="al-btn-add"
              onClick={() => navigate("/dashboard/listing/select-category")}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
              Add Product
            </button>
          </div>
        </div>

        {/* ── Hero Right (desktop) ── */}
        <div className={`al-hero-right ${cardVisible ? "al-fade-right" : ""}`} ref={barRef}>
          {loadingStats ? (
            <>
              <DesktopSkeletonCard slot="revenue" />
              <DesktopSkeletonCard slot="orders" />
              <DesktopSkeletonCard slot="views" />
              <DesktopSkeletonCard slot="product" />
            </>
          ) : isNewSeller ? (
            <>
              <ChecklistCard pct={checklistPct} doneCount={doneCount} steps={checklistSteps} slot="product" />
              <TrendingCategoriesCard categories={trendingCategories} slot="orders" />
              <AddFirstProductCard navigate={navigate} slot="revenue" />
              <TipCard slot="views" />
            </>
          ) : (
            <>
              <ListingsCard
                animatedListings={animatedListings}
                activeListings={listingStats.activeListings}
                totalProducts={listingStats.totalProducts}
                summary={listingSummary}
                slot="revenue"
              />
              <SellerMomentumCard
                summary={listingSummary}
                slot="orders"
              />
              <CategoriesCard categories={topCategories} iconMap={categoryIconMap} slot="views" trending={trendingCategories} />
              <TopProductCard product={topProduct} navigate={navigate} slot="product" formatINR={formatINR} />
            </>
          )}
        </div>
      </section>

      {/* ── Inline Tab Section ── */}
      {activeTab && (
        <div ref={tabSectionRef} className="al-tab-section">
          {activeTab === "my-listings" && <MyListings embedded />}
          {activeTab === "inprogress" && <InProgressListings embedded />}
        </div>
      )}
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════
   DESKTOP CARDS — EXISTING SELLER
   `slot` reuses the original grid positions (revenue/orders/views/product)
   so the floating animation + grid placement CSS keeps working.
════════════════════════════════════════════════════════════════ */

const resolveCategoryName = (p) => {
  if (!p) return "";
  const raw =
    (Array.isArray(p.categoryName) ? p.categoryName[0] : p.categoryName) ||
    p.categoryName ||
    p.CategoryName ||
    (Array.isArray(p.category) ? p.category[0] : p.category) ||
    p.category ||
    p.Category ||
    p.category_name ||
    p.mainCategory ||
    "";
  if (typeof raw === "string") return raw.trim();
  if (typeof raw === "object" && raw) return raw.name || raw.title || "";
  return "";
};

const resolveSubcategoryName = (p) => {
  if (!p) return "";
  const raw =
    (Array.isArray(p.subCategoryName) ? p.subCategoryName[0] : p.subCategoryName) ||
    p.subCategoryName ||
    p.SubCategoryName ||
    (Array.isArray(p.subCategory) ? p.subCategory[0] : p.subCategory) ||
    p.subCategory ||
    p.SubCategory ||
    p.subcategory ||
    p.Subcategory ||
    p.subcategoryName ||
    "";
  if (typeof raw === "string") return raw.trim();
  if (typeof raw === "object" && raw) return raw.name || raw.title || "";
  return "";
};

const slotClass = (slot) => `al-fc al-fc-${slot}`;

const ListingsCard = ({ animatedListings, activeListings, totalProducts, summary, slot }) => {
  const total = summary?.total ?? totalProducts ?? 0;
  const approved = summary?.approved ?? activeListings ?? 0;
  const draft = summary?.draft ?? 0;
  const inReview = summary?.inReview ?? 0;
  const updateRequested = summary?.updateRequested ?? 0;

  // Animate the percentage chart alongside count-up animation
  const pct = total > 0 ? Math.round((animatedListings / total) * 100) : 0;
  const r = 38;
  const circumference = 2 * Math.PI * r;
  const dash = (pct / 100) * circumference;

  return (
    <div className={`${slotClass(slot)} al-fc--rich al-fc-summary`}>
      <div className="al-summary-layout">
        {/* Left Side: Prominent Pie Chart */}
        <div className="al-summary-left">
          <div className="al-ring-wrap-lg">
            <svg width="96" height="96" viewBox="0 0 96 96" className="al-ring-lg">
              <circle cx="48" cy="48" r={r} stroke="rgba(79,70,229,0.08)" strokeWidth="8" fill="none" />
              <circle
                cx="48"
                cy="48"
                r={r}
                stroke="#4F46E5"
                strokeWidth="8"
                fill="none"
                strokeDasharray={`${dash} ${circumference}`}
                strokeLinecap="round"
                transform="rotate(-90 48 48)"
              />
            </svg>
            <div className="al-ring-center-text">
              <span className="al-ring-pct-lg">{pct}%</span>
              <span className="al-ring-pct-sub">Active</span>
            </div>
          </div>
        </div>

        {/* Right Side: Details */}
        <div className="al-summary-right">
          <div className="al-summary-header">
            <p className="al-fc-lbl-summary">Listing Summary</p>
          </div>
          
          <div className="al-summary-stats">
            <div className="al-summary-stat-row">
              <span className="al-summary-stat-label">Total Listings</span>
              <span className="al-summary-stat-value">{total}</span>
            </div>
            <div className="al-summary-stat-row">
              <span className="al-summary-stat-label">Approved</span>
              <span className="al-summary-stat-value">{approved} <span className="al-summary-slash">/ {total}</span></span>
            </div>
            <div className="al-summary-stat-row">
              <span className="al-summary-stat-label">Draft</span>
              <span className="al-summary-stat-value">{draft} <span className="al-summary-slash">/ {total}</span></span>
            </div>
            <div className="al-summary-stat-row">
              <span className="al-summary-stat-label">In Review</span>
              <span className="al-summary-stat-value">{inReview} <span className="al-summary-slash">/ {total}</span></span>
            </div>
            <div className="al-summary-stat-row">
              <span className="al-summary-stat-label">Update Requested</span>
              <span className="al-summary-stat-value">{updateRequested} <span className="al-summary-slash">/ {total}</span></span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Motivational Quote at bottom */}
      <div className="al-summary-quote">
        "Keep your catalog updated to maximize visibility."
      </div>
    </div>
  );
};

const SellerMomentumCard = ({ summary, slot }) => {
  const total = summary?.total ?? 0;

  // Resolve Seller Milestone Level
  let levelName = "Beginner Seller";
  let emoji = "🌱";
  let nextMilestone = 10;
  let prevMilestone = 0;

  if (total >= 100) {
    levelName = "Elite Seller";
    emoji = "👑";
    nextMilestone = 250;
    prevMilestone = 100;
  } else if (total >= 50) {
    levelName = "Pro Seller";
    emoji = "💎";
    nextMilestone = 100;
    prevMilestone = 50;
  } else if (total >= 25) {
    levelName = "Rising Seller";
    emoji = "⭐";
    nextMilestone = 50;
    prevMilestone = 25;
  } else if (total >= 10) {
    levelName = "Growing Seller";
    emoji = "🚀";
    nextMilestone = 25;
    prevMilestone = 10;
  } else {
    levelName = "Beginner Seller";
    emoji = "🌱";
    nextMilestone = 10;
    prevMilestone = 0;
  }

  const pct = Math.min(100, Math.round((total / nextMilestone) * 100));
  const remaining = Math.max(0, nextMilestone - total);

  // Dynamic motivational quote
  let motivation = `You've unlocked the ultimate milestone! 👑`;
  if (remaining > 0) {
    motivation = `You're only ${remaining} listing${remaining > 1 ? "s" : ""} away from unlocking the next seller milestone!`;
  }

  return (
    <div className={`${slotClass(slot)} al-fc--rich al-fc-momentum`}>
      <div className="al-fc-row" style={{ marginBottom: 6 }}>
        <p className="al-fc-lbl-momentum">Seller Momentum 🚀</p>
      </div>

      <div className="al-momentum-body">
        {/* Level Display */}
        <div className="al-momentum-level-row">
          <span className="al-momentum-level-badge">
            <span className="al-momentum-emoji">{emoji}</span> {levelName}
          </span>
        </div>

        {/* Progress Section */}
        <div className="al-momentum-progress-section">
          <div className="al-momentum-progress-text">
            <span className="al-momentum-progress-listings">
              <strong>{total}</strong> <span className="al-momentum-muted">/ {nextMilestone} Listings</span>
            </span>
            <span className="al-momentum-pct">{pct}%</span>
          </div>

          <div className="al-momentum-track">
            <div className="al-momentum-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* Next Milestone Row */}
        <div className="al-momentum-milestone-row">
          <div className="al-momentum-m-item">
            <span className="al-momentum-m-lbl">Next Milestone</span>
            <span className="al-momentum-m-val">{nextMilestone} Listings</span>
          </div>
          <div className="al-momentum-m-divider" />
          <div className="al-momentum-m-item" style={{ alignItems: "flex-end" }}>
            <span className="al-momentum-m-lbl">Remaining</span>
            <span className="al-momentum-m-val">{remaining} Listing{remaining !== 1 ? "s" : ""}</span>
          </div>
        </div>

        {/* Motivation Message */}
        <div className="al-momentum-quote">
          "{motivation}"
        </div>
      </div>
    </div>
  );
};

const CATEGORY_EMOJI_FALLBACK = ["👕", "👗", "👟", "👜"];

const CategoriesCard = ({ categories, iconMap, slot, trending = [] }) => {
  const displayCategories = categories.slice(0, 7);
  const maxCount = displayCategories.length > 0 ? Math.max(...displayCategories.map((c) => c.count)) : 1;
  const resolveIcon = (name) => {
    if (!iconMap) return null;
    if (iconMap[name]) return iconMap[name];
    const target = String(name || "").trim().toLowerCase();
    const foundKey = Object.keys(iconMap).find((k) => k.trim().toLowerCase() === target);
    return foundKey ? iconMap[foundKey] : null;
  };

  // Duplicate items to support infinite, seamless marquee scroll
  const scrollingItems = [...displayCategories, ...displayCategories];

  return (
    <div className={`${slotClass(slot)} al-fc--rich al-fc-categories-scroll`}>
      <div className="al-fc-row" style={{ marginBottom: 10 }}>
        <p className="al-fc-lbl">Top Categories</p>
        <span className="al-fc-ico al-ico-purple">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="#7c3aed" strokeWidth="2" />
            <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="#7c3aed" strokeWidth="2" />
          </svg>
        </span>
      </div>
      {displayCategories.length === 0 ? (
        trending.length > 0 ? (
          <>
            <p className="al-cat-fallback-lbl">Popular on Haatza</p>
            <div className="al-trend-row">
              {trending.map((c, i) => (
                <div key={i} className="al-trend-chip">
                  {c.imageUrl && <img src={c.imageUrl} alt={c.name} />}
                  <span>{c.name}</span>
                </div>
              ))}
            </div>
            <p className="al-muted" style={{ marginTop: 8 }}>List in these to get started</p>
          </>
        ) : (
          <p className="al-muted">No categories yet</p>
        )
      ) : (
        <div className="al-catbar-scroll-container">
          <div
            className="al-catbar-scroll-list"
            style={{ animationDuration: `${Math.max(10, displayCategories.length * 3.5)}s` }}
          >
            {scrollingItems.map((c, i) => {
              const img = resolveIcon(c.name);
              return (
                <div key={i} className="al-catbar-row-custom">
                  <span className="al-catbar-icon-custom">
                    {img ? <img src={img} alt={c.name} /> : CATEGORY_EMOJI_FALLBACK[i % CATEGORY_EMOJI_FALLBACK.length]}
                  </span>
                  <span className="al-catbar-name-custom" title={c.name}>{c.name}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};


const TopProductCard = ({ product, navigate, slot, formatINR }) => {
  const categoryName = product ? resolveCategoryName(product) : "";
  const subcategoryName = product ? resolveSubcategoryName(product) : "";

  return (
    <div className={`${slotClass(slot)} al-fc--spotlight`}>
      {!product ? (
        <>
          <div className="al-prod-img al-prod-img--empty">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="#4F46E5" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </div>
          <p className="al-prod-name">No products yet</p>
          <button className="al-mini-cta" onClick={() => navigate("/dashboard/listing/select-category")}>
            Add your first product →
          </button>
        </>
      ) : (
        <div className="al-spotlight-split">
          {/* Left Side: Product Image */}
          <div className="al-spotlight-left">
            <div className="al-spotlight-img-wrap">
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="al-spotlight-img"
                />
              ) : (
                <div className="al-spotlight-img-placeholder">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="3" width="18" height="18" rx="3" stroke="#4F46E5" strokeWidth="1.5" />
                    <path d="M8 12l3 3 5-5" stroke="#4F46E5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )}
            </div>
          </div>

          {/* Right Side: Product Details */}
          <div className="al-spotlight-right">
            <span className="al-spotlight-tag">
              {product.isRecent ? "✨ Newest Listing" : "🔥 Best Seller"}
            </span>
            <h3 className="al-spotlight-name" title={product.name}>
              {product.name}
            </h3>
            <div className="al-spotlight-details">
              <div className="al-spotlight-detail-item">
                <span className="al-spotlight-detail-label">Category:</span>
                <span className="al-spotlight-detail-val" title={categoryName}>{categoryName || "—"}</span>
              </div>
              <div className="al-spotlight-detail-item">
                <span className="al-spotlight-detail-label">Subcategory:</span>
                <span className="al-spotlight-detail-val" title={subcategoryName}>{subcategoryName || "—"}</span>
              </div>
            </div>
            <div className="al-spotlight-price-row">
              <span className="al-spotlight-price-label">Price:</span>
              <span className="al-spotlight-price">{formatINR(product.price)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════
   DESKTOP CARDS — NEW SELLER
════════════════════════════════════════════════════════════════ */

const ChecklistCard = ({ pct, doneCount, steps, slot }) => (
  <div className={slotClass(slot)}>
    <p className="al-fc-lbl">Get Started</p>
    <p className="al-fc-val" style={{ fontSize: 20 }}>{doneCount} of {steps.length} done</p>
    <div className="al-prog-row">
      <div className="al-prog-track">
        <div className="al-prog-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="al-muted" style={{ fontSize: 11 }}>{pct}%</span>
    </div>
    <ul className="al-checklist">
      {steps.map((s, i) => (
        <li key={i} className={s.done ? "al-check-done" : ""}>
          {s.done ? "✅" : "⬜"} {s.label}
        </li>
      ))}
    </ul>
  </div>
);

const TrendingCategoriesCard = ({ categories, slot }) => (
  <div className={slotClass(slot)}>
    <p className="al-fc-lbl">Popular on Haatza</p>
    {categories.length === 0 ? (
      <p className="al-muted">Loading categories…</p>
    ) : (
      <div className="al-trend-row">
        {categories.map((c, i) => (
          <div key={i} className="al-trend-chip">
            {c.imageUrl && <img src={c.imageUrl} alt={c.name} />}
            <span>{c.name}</span>
          </div>
        ))}
      </div>
    )}
    <p className="al-muted" style={{ marginTop: 8 }}>Pick a category to get started</p>
  </div>
);

const AddFirstProductCard = ({ navigate, slot }) => (
  <div className={slotClass(slot)}>
    <div className="al-fc-row">
      <div>
        <p className="al-fc-lbl">Your Storefront</p>
        <p className="al-fc-val" style={{ fontSize: 18 }}>Nothing listed yet</p>
      </div>
      <span className="al-fc-ico al-ico-blue">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
          <path d="M12 5v14M5 12h14" stroke="#2962ff" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </span>
    </div>
    <button className="al-mini-cta" onClick={() => navigate("/dashboard/listing/select-category")}>
      + Add your first product
    </button>
  </div>
);

const SELLER_TIPS = [
  "Sellers who add 5+ photos get noticeably more views.",
  "A clear, honest product title builds buyer trust faster.",
  "Fast responses to buyer questions boost your seller rating.",
];

const TipCard = ({ slot }) => (
  <div className={slotClass(slot)}>
    <p className="al-fc-lbl">Seller Tip</p>
    <p className="al-fc-val" style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.4 }}>
      {SELLER_TIPS[0]}
    </p>
  </div>
);

/* ════════════════════════════════════════════════════════════════
   MOBILE CARDS — mirror the desktop cards using al-mobile-card
════════════════════════════════════════════════════════════════ */

const MobileListingsCard = ({ animatedListings, activeListings, totalProducts }) => (
  <div className="al-mobile-card al-mobile-card--1">
    <span className="al-fc-lbl">Active Listings</span>
    <div className="al-mc-val">{animatedListings}</div>
    <div className="al-mc-foot">
      <span className="al-badge-green">{totalProducts} total</span>
    </div>
  </div>
);

const MobileInProgressCard = ({ animatedInProgress }) => (
  <div className="al-mobile-card al-mobile-card--2">
    <span className="al-fc-lbl">In Progress</span>
    <div className="al-mc-val">{animatedInProgress}</div>
    <div className="al-mc-foot">
      <span className="al-muted">{animatedInProgress > 0 ? "pending review" : "all clear 🎉"}</span>
    </div>
  </div>
);

const MobileCategoriesCard = ({ categories }) => (
  <div className="al-mobile-card al-mobile-card--3">
    <span className="al-fc-lbl">Top Categories</span>
    {categories.length === 0 ? (
      <p className="al-muted" style={{ margin: 0 }}>No categories yet</p>
    ) : (
      categories.slice(0, 2).map((c, i) => (
        <div key={i} className="al-mc-foot">
          <span className="al-muted">{c.name}</span>
          <span className="al-badge-green">{c.count}</span>
        </div>
      ))
    )}
  </div>
);

const MobileTopProductCard = ({ product, navigate, formatINR }) => (
  <div className="al-mobile-card al-mobile-card--4">
    {!product ? (
      <>
        <p className="al-prod-name" style={{ marginTop: 8 }}>No products yet</p>
        <button className="al-mini-cta" onClick={() => navigate("/dashboard/listing/select-category")}>
          Add product →
        </button>
      </>
    ) : (
      <>
        <div className="al-mc-prod-header">
          <div className="al-mc-prod-img">
            {product.imageUrl
              ? <img src={product.imageUrl} alt={product.name} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 10 }} />
              : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="3" width="18" height="18" rx="3" stroke="#2962ff" strokeWidth="1.5" />
                  <path d="M8 12l3 3 5-5" stroke="#2962ff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
          </div>
          <div className="al-prod-tags" style={{ marginBottom: 0 }}>
            <span className="al-tag al-tag-green">{product.status}</span>
          </div>
        </div>
        <p className="al-prod-name" style={{ marginTop: 8 }}>{product.name}</p>
        <p className="al-prod-price">{formatINR(product.price)}</p>
        <div className="al-prod-meta">
          {product.rating != null && <span className="al-prod-stat">⭐ {product.rating}</span>}
          {product.sold != null && <span className="al-prod-stat">{product.sold} sold</span>}
        </div>
      </>
    )}
  </div>
);

const MobileChecklistCard = ({ pct, doneCount, total }) => (
  <div className="al-mobile-card al-mobile-card--1">
    <span className="al-fc-lbl">Get Started</span>
    <div className="al-mc-val" style={{ fontSize: 16 }}>{doneCount}/{total} done</div>
    <div className="al-mobile-prog-track">
      <div className="al-mobile-prog-fill" style={{ width: `${pct}%` }} />
    </div>
  </div>
);

const MobileTrendingCard = ({ categories }) => (
  <div className="al-mobile-card al-mobile-card--2">
    <span className="al-fc-lbl">Popular Categories</span>
    {categories.slice(0, 2).map((c, i) => (
      <p key={i} className="al-muted" style={{ margin: "2px 0" }}>{c.name}</p>
    ))}
  </div>
);

const MobileAddFirstProductCard = ({ navigate }) => (
  <div className="al-mobile-card al-mobile-card--3">
    <span className="al-fc-lbl">Your Storefront</span>
    <p className="al-muted" style={{ margin: "4px 0 8px" }}>Nothing listed yet</p>
    <button className="al-mini-cta" onClick={() => navigate("/dashboard/listing/select-category")}>
      + Add product
    </button>
  </div>
);

const MobileTipCard = () => (
  <div className="al-mobile-card al-mobile-card--4">
    <span className="al-fc-lbl">Seller Tip</span>
    <p className="al-muted" style={{ margin: "4px 0 0", lineHeight: 1.4 }}>{SELLER_TIPS[0]}</p>
  </div>
);

/* ════════════════════════════════════════════════════════════════
   SKELETON LOADERS — shown while real data is being fetched,
   so we never briefly flash the "empty/new seller" cards for an
   existing seller who simply hasn't finished loading yet.
════════════════════════════════════════════════════════════════ */

const DesktopSkeletonCard = ({ slot }) => (
  <div className={`${slotClass(slot)} al-fc--skeleton`}>
    <div className="al-skel-line al-skel-line--sm" />
    <div className="al-skel-line al-skel-line--lg" />
    <div className="al-skel-line al-skel-line--md" />
  </div>
);

const MobileSkeletonCard = () => (
  <div className="al-mobile-card al-mobile-card--skeleton">
    <div className="al-skel-line al-skel-line--sm" />
    <div className="al-skel-line al-skel-line--lg" />
  </div>
);

export default AddListing;