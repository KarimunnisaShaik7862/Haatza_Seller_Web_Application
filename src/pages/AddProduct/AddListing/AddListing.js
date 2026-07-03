// AddListing.js
import { useState, useEffect, useRef } from "react";
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
  const [inProgressCount, setInProgressCount] = useState(0);
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
        const [statsRes, inProgressRes, topProductRes, allListingsRes] = await Promise.allSettled([
          getProductStats(sellerId || email),
          fetchInProgressListings({ email, page: 1, limit: 5 }), // limit raised so we can read the latest item's status
          getTopSellingProducts(sellerId),
          fetchSellerListings({ email, page: 1, limit: 200 }), // for category aggregation
        ]);

        if (cancelled) return;

        // Listing stats (active vs total)
        if (statsRes.status === "fulfilled") {
          const s = statsRes.value || {};
          setListingStats({
            totalProducts: s.totalProducts ?? s.total ?? 0,
            activeListings: s.activeListings ?? s.active ?? 0,
          });
        }

        // In-progress count
        // In-progress count + latest in-progress product (drives the step tracker)
        if (inProgressRes.status === "fulfilled") {
          setInProgressCount(inProgressRes.value?.total || 0);
          const ipProducts = inProgressRes.value?.products || [];
          if (ipProducts.length > 0) {
            const latest = ipProducts[0];
            setLatestInProgressProduct({
              name: latest.name || "Your product",
              status: latest.status || "Draft",
            });
          } else {
            setLatestInProgressProduct(null);
          }
        }
        // Top selling product (fallback handled below once we have allListings)
        let resolvedTopProduct = null;
        if (topProductRes.status === "fulfilled") {
          const raw = topProductRes.value;
          const list = Array.isArray(raw?.data) ? raw.data
            : Array.isArray(raw?.message) ? raw.message
            : Array.isArray(raw) ? raw
            : [];
          const best = list[0];
          if (best) {
            resolvedTopProduct = {
              name: best.name || best.productName || "Your product",
              price: best.price ?? best.finalPrice ?? 0,
              rating: best.rating ?? best.avgRating ?? null,
              sold: best.sold ?? best.unitsSold ?? best.totalSold ?? null,
              imageUrl: best.mainmedia || best.imageUrl || null,
              category: best.categoryName?.[0] || best.subCategory || "",
              status: best.status || "Live",
              isRecent: false,
            };
          }
        }

        // Category aggregation + fallback "recent listing" if no sales data yet
       // Category aggregation + fallback "recent listing" if no sales data yet
        let sortedCatsResult = [];
        if (allListingsRes.status === "fulfilled") {
          const products = allListingsRes.value?.products || [];
          // Debug: log the raw shape of the first product once, so we can see
          // exactly which category-related field the backend actually sends.
          if (products[0]) {
            console.log("[AddListing] Sample product for category debug:", products[0]);
          }

          // Top categories by listing count — checks every category-name
          // variant seen elsewhere in sellerService.js (categoryName can be
          // an array or string; subCategory/category/CategoryName are also
          // used in different responses).
          const resolveCategoryName = (p) => {
            const raw =
              (Array.isArray(p.categoryName) ? p.categoryName[0] : p.categoryName) ||
              p.CategoryName ||
              p.category ||
              p.Category ||
              p.category_name ||
              p.mainCategory ||
              p.subCategory ||
              p.SubCategory ||
              "";
            return typeof raw === "string" && raw.trim() ? raw.trim() : null;
          };

          const counts = {};
          let unlabeledCount = 0;
          products.forEach((p) => {
            const catName = resolveCategoryName(p);
            if (!catName) { unlabeledCount++; return; }
            if (!counts[catName]) counts[catName] = { name: catName, count: 0 };
            counts[catName].count += 1;
          });
          if (unlabeledCount > 0) {
            console.warn(`[AddListing] ${unlabeledCount} product(s) had no resolvable category field — check the sample logged above.`);
          }
         const sortedCats = Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 3);
          sortedCatsResult = sortedCats;
          setTopCategories(sortedCats);

          // Cross-reference the real site category list so we show the actual
          // category image/icon instead of a generic emoji.
          try {
            const allCats = await fetchCategories();
            const iconMap = {};
            allCats.forEach((c) => { if (c.name) iconMap[c.name] = c.imageUrl; });
            if (!cancelled) setCategoryIconMap(iconMap);
          } catch (e) {
            console.warn("[AddListing] Failed to load category icons:", e);
          }
          // Fallback: most recent listing as "featured" card if no top-seller data
          if (!resolvedTopProduct && products.length > 0) {
            const recent = products[0];
            resolvedTopProduct = {
              name: recent.name || "Your latest listing",
              price: recent.price ?? 0,
              rating: null,
              sold: null,
              imageUrl: recent.mainmedia || null,
              category: resolveCategoryName(recent) || "",
              status: recent.status || "Live",
              isRecent: true,
            };
          }
        }

        // If no product carries a resolvable category yet, fall back to
        // showing popular/trending categories (same source as the new-seller
        // card) so this card never sits empty.
        if (sortedCatsResult.length === 0) {
          try {
            const cats = await fetchCategories();
            if (!cancelled) setTrendingCategories(cats.slice(0, 4));
          } catch (e) {
            console.warn("[AddListing] Failed to load fallback trending categories:", e);
          }
        }

        setTopProduct(resolvedTopProduct);
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
            Start Selling.<br/>
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
                  <MobileSkeletonCard /><MobileSkeletonCard /><MobileSkeletonCard /><MobileSkeletonCard />
                </>
              ) : isNewSeller ? (
                <>
                  <MobileChecklistCard pct={checklistPct} doneCount={doneCount} total={checklistSteps.length} />
                  <MobileTrendingCard categories={trendingCategories} />
                  <MobileAddFirstProductCard navigate={navigate} />
                  <MobileTipCard />
                </>
              ) : (
                <>
                  <MobileListingsCard animatedListings={animatedListings} activeListings={listingStats.activeListings} totalProducts={listingStats.totalProducts} barVisible={barVisible} />
                  <MobileInProgressCard animatedInProgress={animatedInProgress} barVisible={barVisible} />
                  <MobileCategoriesCard categories={topCategories} />
                  <MobileTopProductCard product={topProduct} navigate={navigate} formatINR={formatINR} />
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
                  <rect x="3"  y="3"  width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2"/>
                  <rect x="14" y="3"  width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2"/>
                  <rect x="3"  y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2"/>
                  <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2"/>
                </svg>
                My Listings
              </button>

              <button
                className={`al-tab ${activeTab === "inprogress" ? "al-tab--active" : ""}`}
                onClick={() => handleTabClick("inprogress")}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
                  <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                In Progress
              </button>
            </div>

            <button
              className="al-btn-add"
              onClick={() => navigate("/dashboard/listing/select-category")}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
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
                slot="revenue"
              />
              <InProgressCard
                animatedInProgress={animatedInProgress}
                latestProduct={latestInProgressProduct}
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

const slotClass = (slot) => `al-fc al-fc-${slot}`;

const ListingsCard = ({ animatedListings, activeListings, totalProducts, slot }) => {
  const pct = totalProducts > 0 ? Math.round((activeListings / totalProducts) * 100) : 0;
  const r = 34;
  const circumference = 2 * Math.PI * r;
  const dash = (pct / 100) * circumference;
  return (
    <div className={`${slotClass(slot)} al-fc--rich`}>
      <div className="al-fc-row">
        <p className="al-fc-lbl">Active Listings</p>
        <span className="al-fc-ico al-ico-blue">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              stroke="#2962ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
      </div>
      <div className="al-ring-row">
        <div className="al-ring-wrap">
          <svg width="84" height="84" viewBox="0 0 84 84" className="al-ring">
            <circle cx="42" cy="42" r={r} stroke="rgba(79,70,229,0.12)" strokeWidth="8" fill="none" />
            <circle
              cx="42" cy="42" r={r} stroke="url(#al-ring-grad)" strokeWidth="8" fill="none"
              strokeDasharray={`${dash} ${circumference}`} strokeLinecap="round"
              transform="rotate(-90 42 42)"
            />
            <defs>
              <linearGradient id="al-ring-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#4F46E5" />
                <stop offset="100%" stopColor="#3B82F6" />
              </linearGradient>
            </defs>
          </svg>
          <span className="al-ring-pct">{pct}%</span>
        </div>
        <div>
          <p className="al-fc-val" style={{ marginBottom: 0 }}>{animatedListings}</p>
          <span className="al-muted" style={{ fontSize: 11.5 }}>of {totalProducts} live</span>
        </div>
      </div>
      <div className="al-fc-foot">
        <span className="al-badge-green">{pct}% active</span>
        <span className="al-muted">on Haatza</span>
      </div>
    </div>
  );
};

// Two possible journeys a listing goes through, based on IN_PROGRESS_STATUSES
// in sellerService.js. New listing → QC path. Live listing sent back → update path.
const NEW_LISTING_FLOW = ["Uploaded", "Send for QC", "Under Review", "Live"];
const UPDATE_FLOW      = ["Uploaded", "Update Listing", "Update Requested", "Live"];

const resolveProgressStep = (status) => {
  const s = (status || "").toLowerCase();
  if (s === "update requested") return { flow: UPDATE_FLOW, index: 2 };
  if (s === "rejected")         return { flow: UPDATE_FLOW, index: 1 };
  if (s === "approved")         return { flow: NEW_LISTING_FLOW, index: 3 };
  if (s === "under review")     return { flow: NEW_LISTING_FLOW, index: 2 };
  if (s === "pending")          return { flow: NEW_LISTING_FLOW, index: 1 };
  return { flow: NEW_LISTING_FLOW, index: 0 }; // Draft / unknown = just uploaded
};

const InProgressCard = ({ animatedInProgress, latestProduct, slot }) => {
  const clear = animatedInProgress === 0;
  const { flow, index } = latestProduct ? resolveProgressStep(latestProduct.status) : { flow: NEW_LISTING_FLOW, index: 0 };

  return (
    <div className={`${slotClass(slot)} al-fc--rich`}>
      <div className="al-fc-row">
        <p className="al-fc-lbl">In Progress</p>
        <span className={`al-fc-ico ${clear ? "al-ico-green" : "al-ico-amber"}`}>
          {clear ? (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
              <path d="M20 6L9 17l-5-5" stroke="#059669" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          ) : (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="#b45309" strokeWidth="2"/>
              <path d="M12 7v5l3 3" stroke="#b45309" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          )}
        </span>
      </div>

      <p className="al-fc-val al-fc-val--big">{animatedInProgress}</p>

      {clear ? (
        <div className="al-fc-foot">
          <span className="al-badge-green">All clear 🎉</span>
        </div>
      ) : (
        <>
          {latestProduct && <p className="al-ip-prodname">{latestProduct.name}</p>}
          <div className="al-step-track">
            {flow.map((label, i) => (
              <div
                key={i}
                className={`al-step-node ${i <= index ? "al-step-node--done" : ""} ${i === index ? "al-step-node--current" : ""}`}
              >
                {i < flow.length - 1 && (
                  <span className={`al-step-connector ${i < index ? "al-step-connector--done" : ""}`} />
                )}
                <span className="al-step-dot" />
                <span className="al-step-label">{label}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
const CATEGORY_EMOJI_FALLBACK = ["👕", "👗", "👟", "👜"];

const CategoriesCard = ({ categories, iconMap, slot, trending = [] }) => {  const maxCount = categories.length > 0 ? Math.max(...categories.map((c) => c.count)) : 1;
  const resolveIcon = (name) => {
    if (!iconMap) return null;
    if (iconMap[name]) return iconMap[name];
    const target = String(name || "").trim().toLowerCase();
    const foundKey = Object.keys(iconMap).find((k) => k.trim().toLowerCase() === target);
    return foundKey ? iconMap[foundKey] : null;
  };
  return (
    <div className={`${slotClass(slot)} al-fc--rich`}>
      <div className="al-fc-row">
        <p className="al-fc-lbl">Top Categories</p>
        <span className="al-fc-ico al-ico-purple">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="#7c3aed" strokeWidth="2"/>
            <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="#7c3aed" strokeWidth="2"/>
          </svg>
        </span>
      </div>
      {categories.length === 0 ? (
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
        <div className="al-cat-chip-list">
          {categories.map((c, i) => {
            const img = resolveIcon(c.name);
            return (
              <div key={i} className="al-cat-chip-row">
                <span className="al-cat-chip-icon">
                  {img ? (
                    <img src={img} alt={c.name} />
                  ) : (
                    CATEGORY_EMOJI_FALLBACK[i % CATEGORY_EMOJI_FALLBACK.length]
                  )}
                </span>
                <span className="al-cat-chip-name">{c.name}</span>
                <span className="al-cat-chip-count">{c.count}</span>
                <div className="al-cat-chip-bar-track">
                  <div className="al-cat-chip-bar-fill" style={{ width: `${Math.max(8, (c.count / maxCount) * 100)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const TopProductCard = ({ product, navigate, slot, formatINR }) => (
  <div className={`${slotClass(slot)} al-fc--spotlight`}>
    {!product ? (
      <>
        <div className="al-prod-img al-prod-img--empty">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14M5 12h14" stroke="#4F46E5" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        </div>
        <p className="al-prod-name">No products yet</p>
        <button className="al-mini-cta" onClick={() => navigate("/dashboard/listing/select-category")}>
          Add your first product →
        </button>
      </>
    ) : (
      <>
        <div className="al-prod-spotlight-header">
          <span className="al-prod-spotlight-lbl">
            {product.isRecent ? "✨ Newest Listing" : "🔥 Best Seller"}
          </span>
        </div>

        {/* Image beside name/price, like the reference card */}
        <div className="al-prod-row">
          <div className="al-prod-img al-prod-img--lg">
            {product.imageUrl
              ? <img src={product.imageUrl} alt={product.name} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 14 }} />
              : (
                <svg width="42" height="42" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="3" width="18" height="18" rx="3" stroke="#4F46E5" strokeWidth="1.5"/>
                  <path d="M8 12l3 3 5-5" stroke="#4F46E5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
          </div>
          <div className="al-prod-info">
            <p className="al-prod-name">{product.name}</p>
            <p className="al-prod-price">{formatINR(product.price)}</p>
            {(product.rating != null || product.sold != null) && (
              <div className="al-prod-meta">
                {product.rating != null && <span className="al-prod-stat">⭐ {product.rating}</span>}
                {product.sold != null && <span className="al-prod-stat">{product.sold} sold</span>}
              </div>
            )}
          </div>
        </div>

        <div className="al-prod-tags">
          {product.category && <span className="al-tag al-tag-blue">{product.category}</span>}
          <span className="al-tag al-tag-green">{product.status}</span>
        </div>

        <button
          className="al-mini-cta al-mini-cta--full"
          onClick={() => navigate("/dashboard/listing", { state: { tab: "my-listings" } })}
        >
          View Listing →
        </button>
      </>
    )}
  </div>
);

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
          <path d="M12 5v14M5 12h14" stroke="#2962ff" strokeWidth="2.5" strokeLinecap="round"/>
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
                  <rect x="3" y="3" width="18" height="18" rx="3" stroke="#2962ff" strokeWidth="1.5"/>
                  <path d="M8 12l3 3 5-5" stroke="#2962ff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
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