import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./SelectCategory.css";

import {
  fetchCategories,
  fetchSubcategoriesFirstPage,
  fetchSubcategoriesPaged,
  searchCategories,
  searchSubcategories,
  normalizeSearchText,
} from "../../../services/sellerService";

/* ─────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────── */
const STEPS = [
  { label: "Pick Category",   desc: "Choose the best category" },
  { label: "Product Info",    desc: "Add your product details" },
  { label: "Review & Submit", desc: "Final review" },
];

const CATEGORY_COLORS = [
  { bg: "rgba(41,98,255,0.08)",  accent: "#2962ff", light: "rgba(41,98,255,0.15)"  },
  { bg: "rgba(124,58,237,0.08)", accent: "#7c3aed", light: "rgba(124,58,237,0.15)" },
  { bg: "rgba(5,150,105,0.08)",  accent: "#059669", light: "rgba(5,150,105,0.15)"  },
  { bg: "rgba(245,158,11,0.08)", accent: "#d97706", light: "rgba(245,158,11,0.15)" },
  { bg: "rgba(239,68,68,0.08)",  accent: "#dc2626", light: "rgba(239,68,68,0.15)"  },
  { bg: "rgba(20,184,166,0.08)", accent: "#0d9488", light: "rgba(20,184,166,0.15)" },
  { bg: "rgba(249,115,22,0.08)", accent: "#ea580c", light: "rgba(249,115,22,0.15)" },
];
const CATEGORY_ICONS = {};
const PAGE_SIZE = 50;

/* ─────────────────────────────────────────
   PAGINATION COMPONENT
───────────────────────────────────────── */
const Pagination = ({ currentPage, totalPages, onPageChange, loading }) => {
  if (totalPages <= 1) return null;

  const isInfinite = totalPages === Infinity;
  const effectiveTotalPages = isInfinite ? currentPage + 1 : totalPages;

  const buildPages = () => {
    if (effectiveTotalPages <= 7) return Array.from({ length: effectiveTotalPages }, (_, i) => i + 1);
    const pages = [];
    pages.push(1);
    if (currentPage > 3)              pages.push("...");
    for (
      let i = Math.max(2, currentPage - 1);
      i <= Math.min(effectiveTotalPages - 1, currentPage + 1);
      i++
    ) { pages.push(i); }
    if (!isInfinite && currentPage < effectiveTotalPages - 2) pages.push("...");
    if (!isInfinite) pages.push(effectiveTotalPages);
    return pages;
  };

  return (
    <>
      <div className="sc-pagination">
        <button
          type="button"
          className="sc-page-btn sc-page-btn--nav"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1 || loading}
        >
          <ArrowLeftIcon size={13} />
          Prev
        </button>

        {buildPages().map((p, i) =>
          p === "..." ? (
            <span key={`dots-${i}`} className="sc-page-dots">···</span>
          ) : (
            <button
              key={p}
              type="button"
              className={`sc-page-btn ${p === currentPage ? "sc-page-btn--active" : ""}`}
              onClick={() => onPageChange(p)}
              disabled={loading}
            >
              {p}
            </button>
          )
        )}

        <button
          type="button"
          className="sc-page-btn sc-page-btn--nav"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages || loading}
        >
          Next
          <ArrowRightIcon size={13} />
        </button>
      </div>

      <p className="sc-page-info">
        Page {currentPage} of {totalPages === Infinity ? "…" : totalPages}
      </p>
    </>
  );
};

/* ─────────────────────────────────────────
   SVG ICONS
───────────────────────────────────────── */
const CheckIcon = ({ size = 13, color = "white" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M5 13l4 4L19 7" stroke={color} strokeWidth="2.5"
      strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const ArrowRightIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const ArrowLeftIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M19 12H5M5 12l7 7M5 12l7-7" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const SearchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" />
    <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);
const ClearIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);
const ImagePlaceholderIcon = ({ color }) => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="3" stroke={color} strokeWidth="1.5" />
    <circle cx="8.5" cy="8.5" r="1.5" stroke={color} strokeWidth="1.5" />
    <path d="M3 15l5-4 4 3 3-2.5 6 5.5" stroke={color}
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* ─────────────────────────────────────────
   REUSABLE ATOMS
───────────────────────────────────────── */
const StepIndicator = ({ currentStep }) => (
  <div className="sc-steps">
    {STEPS.map((step, i) => {
      const isActive = i === currentStep;
      const isDone   = i < currentStep;
      return (
        <div key={i}
          className={`sc-step ${isActive ? "sc-step--active" : ""} ${isDone ? "sc-step--done" : ""}`}>
          <div className="sc-step-bubble">
            {isDone ? <CheckIcon size={12} /> : <span>{i + 1}</span>}
          </div>
          <span className="sc-step-label">{step.label}</span>
          {i < STEPS.length - 1 && (
            <div className={`sc-step-line ${isDone ? "sc-step-line--done" : ""}`} />
          )}
        </div>
      );
    })}
  </div>
);

const PageHeader = ({ title, subtitle, currentStep }) => (
  <>
    <div className="sc-header">
      <div className="sc-header-left">
        <h1 className="sc-title">{title}</h1>
        <p className="sc-subtitle">{subtitle}</p>
      </div>
    </div>
    <StepIndicator currentStep={currentStep} />
  </>
);

const SearchBar = ({ value, onChange, onClear, placeholder }) => (
  <div className="sc-search-wrap">
    <div className="sc-search-box">
      <span className="sc-search-ico"><SearchIcon /></span>
      <input
        className="sc-search-input"
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button type="button" className="sc-search-clear" onClick={onClear}>
          <ClearIcon />
        </button>
      )}
    </div>
  </div>
);

const BackButton = ({ label, onClick }) => (
  <button type="button" className="sc-back-btn" onClick={onClick}>
    <ArrowLeftIcon size={15} />
    {label}
  </button>
);

const EmptyState = ({ query }) => (
  <div className="sc-empty">
    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.28 }}>
      <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.5" />
      <path d="M21 21l-4.35-4.35" stroke="currentColor"
        strokeWidth="1.5" strokeLinecap="round" />
    </svg>
    <strong>No results found</strong>
    {query
      ? <span>No matches for &ldquo;<em>{query}</em>&rdquo;. Try a different term.</span>
      : <span>Nothing to display right now.</span>}
  </div>
);

const SkeletonGrid = ({ count = 8, tall = false }) => (
  <div className="sc-cat-grid">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="sc-skeleton-card">
        {tall && (
          <div className="sc-skel-icon"
            style={{ width: "100%", height: 62, borderRadius: 8, marginBottom: 4 }} />
        )}
        <div className="sc-skel-icon" style={tall ? { width: "100%", height: 0 } : {}} />
        <div className="sc-skel-text" />
        <div className="sc-skel-text sc-skel-short" />
      </div>
    ))}
  </div>
);

/* ─────────────────────────────────────────
   SUBCATEGORY CARD
───────────────────────────────────────── */
const SubcategoryCard = ({ sub, isSelected, onSelect, color }) => {
  const [imgErr, setImgErr] = useState(false);

  return (
    <button
      type="button"
      className={`sc-cat-card sc-sub-card ${isSelected ? "sc-cat-card--selected" : ""}`}
      style={{
        "--card-accent": color.accent,
        "--card-bg":     color.bg,
        "--card-light":  color.light,
      }}
      onClick={() => onSelect(sub)}
    >
      <div className="sc-sub-img-wrap">
        {sub.imageUrl && !imgErr ? (
          <img
            className="sc-sub-img"
            src={sub.imageUrl}
            alt={sub.name}
            loading="lazy"
            onError={() => setImgErr(true)}
          />
        ) : (
          <div className="sc-sub-img-placeholder">
            <ImagePlaceholderIcon color={color.accent} />
          </div>
        )}
        {isSelected && (
          <div className="sc-selected-check sc-selected-check--over">
            <CheckIcon size={9} />
          </div>
        )}
      </div>

      <span className="sc-cat-name">{sub.name}</span>
    </button>
  );
};

/* ─────────────────────────────────────────
   SUBCATEGORY GRID
───────────────────────────────────────── */
const SubcategoryGrid = ({ items, selectedSub, onSelect }) => (
  <div className="sc-cat-grid">
    {items.map((sub, idx) => {
      const color      = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
      const isSelected = selectedSub?.SubCategoryID === sub.SubCategoryID;
      return (
        <SubcategoryCard
          key={sub.uniqueKey}
          sub={sub}
          isSelected={isSelected}
          onSelect={onSelect}
          color={color}
        />
      );
    })}
  </div>
);

/* ─────────────────────────────────────────
   SHARED SEARCH SUGGESTIONS HELPER
───────────────────────────────────────── */
const matchesQuery = (name, query) => {
  const normalizedName = normalizeSearchText(name || "");
  const normalizedQuery = normalizeSearchText(query || "");
  if (!normalizedQuery) return false;
  const queryWords = normalizedQuery.split(" ");
  const nameWords = normalizedName.split(" ");
  return queryWords.every(qWord =>
    nameWords.some(nWord => {
      if ((qWord === "men" || qWord === "mens") && (nWord.includes("women") || nWord.includes("womens"))) {
        return false;
      }
      return nWord.startsWith(qWord) || nWord.includes(qWord);
    })
  );
};

/* ─────────────────────────────────────────
   STEP 2 — SUBCATEGORY PAGE
───────────────────────────────────────── */
const StepSubcategory = ({
  selectedCat,
  subcategories,
  loading,
  searchLoading,
  selectedSub,
  onSelect,
  onBack,
  subcategorySearch,
  setSubcategorySearch,
  currentPage,
  totalPages,
  pageLoading,
  onPageChange,
  isSearchActive,
}) => {
  return (
    <div className="sc-root sc-visible">
      <BackButton label="Back to Categories" onClick={onBack} />

      <PageHeader
        title={selectedCat?.name || "Pick a Subcategory"}
        subtitle="Choose the best subcategory for your product."
        currentStep={0}
      />

      <SearchBar
        value={subcategorySearch}
        onChange={setSubcategorySearch}
        onClear={() => setSubcategorySearch("")}
        placeholder="Search subcategories..."
      />

      <section className="sc-section">
        <div className="sc-section-header">
          <h2 className="sc-section-title">
            {selectedCat?.name && (
              <span>
                <span style={{ color: '#0f172a' }}>Category: </span>
                <span style={{ color: '#2962ff' }}>{selectedCat.name}</span>
              </span>
            )}
          </h2>
        </div>

        {loading ? (
          <SkeletonGrid count={8} tall />
        ) : searchLoading ? (
          <SkeletonGrid count={8} tall />
        ) : subcategories.length === 0 ? (
          <div className="sc-cat-grid">
            <EmptyState query={subcategorySearch} />
          </div>
        ) : (
          <SubcategoryGrid
            items={subcategories}
            selectedSub={selectedSub}
            onSelect={onSelect}
          />
        )}

        {!loading && !searchLoading && !isSearchActive && subcategories.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={onPageChange}
            loading={pageLoading}
          />
        )}
      </section>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   ROOT COMPONENT
═══════════════════════════════════════════════════════ */
const SelectCategory = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    category: stateCategory,
    subcategory: stateSubcategory,
    isEditMode,
    isDuplicateMode,
    editData,
    tableId,
    origin,
    email,
    formData,
    images,
    specifications,
    colourImages,
    confirmedColors,
    variantPrices,
    promotionImage,
    keywords,
    discountType,
    ...restState
  } = location.state || {};

  /* ── step ── */
  const [step, setStep] = useState(stateCategory && stateSubcategory ? 1 : 0);

  /* ── category state ── */
  const [categories,          setCategories]          = useState([]);
  const [catLoading,          setCatLoading]          = useState(true);
  const [selectedCat,         setSelectedCat]         = useState(stateCategory || null);
  const [displayedCategories, setDisplayedCategories] = useState([]);

  /* ── subcategory state ── */
  const [subcategories,          setSubcategories]          = useState([]);
  const [subLoading,             setSubLoading]             = useState(false);
  const [selectedSub,            setSelectedSub]            = useState(stateSubcategory || null);
  const [displayedSubcategories, setDisplayedSubcategories] = useState([]);

  /* ── pagination state ── */
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages,  setTotalPages]  = useState(1);
  const [pageLoading, setPageLoading] = useState(false);

  /* ── search state ── */
  const [categorySearch,    setCategorySearch]    = useState("");
  const [subcategorySearch, setSubcategorySearch] = useState("");

  const [searchMode,       setSearchMode]       = useState("categories");
  const [searchSubItems,   setSearchSubItems]   = useState([]);
  const [searchSubLoading, setSearchSubLoading] = useState(false);



  /* debounce refs */
  const catTimer = useRef(null);
  const subTimer = useRef(null);

  /* ══════════════════════════════════════
     LOAD ALL CATEGORIES ON MOUNT
  ══════════════════════════════════════ */
  useEffect(() => {
    (async () => {
      try {
        setCatLoading(true);
        const data = await fetchCategories();
        setCategories(data || []);
        setDisplayedCategories(data || []);
      } catch (e) {
        console.error(e);
      } finally {
        setCatLoading(false);
      }
    })();
  }, []);

  /* Load subcategories on mount if category is pre-selected */
  useEffect(() => {
    if (stateCategory && (stateCategory.CategoryID || stateCategory._id)) {
      (async () => {
        try {
          setSubLoading(true);
          const { items, hasMore, total } = await fetchSubcategoriesFirstPage(stateCategory.CategoryID || stateCategory._id);
          setSubcategories(items);
          setDisplayedSubcategories(items);
          if (typeof total === "number" && total > 0) {
            setTotalPages(Math.ceil(total / PAGE_SIZE));
          } else {
            setTotalPages(hasMore ? Infinity : 1);
          }
        } catch (e) {
          console.error(e);
        } finally {
          setSubLoading(false);
        }
      })();
    }
  }, [stateCategory]);

  /* ══════════════════════════════════════
     CATEGORY PAGE SEARCH
  ══════════════════════════════════════ */
  useEffect(() => {
    clearTimeout(catTimer.current);

    const q = categorySearch.trim();

    if (!q) {
      setSearchMode("categories");
      setDisplayedCategories(categories);
      setSearchSubItems([]);
      return;
    }

    const localCatMatches = categories.filter((c) => {
      return matchesQuery(c.name || "", q);
    });

    if (localCatMatches.length > 0) {
      setSearchMode("categories");
      setDisplayedCategories(localCatMatches);
    } else {
      setSearchMode("loading");
      setSearchSubItems([]);
    }

    catTimer.current = setTimeout(async () => {
      try {
        setSearchSubLoading(true);

        const [catResults, subResults] = await Promise.all([
          searchCategories(q),
          searchSubcategories(q, null),
        ]);

        const catNameMatches = catResults.filter((c) =>
          matchesQuery(c.name || "", q)
        );



        if (catNameMatches.length > 0) {
          setSearchMode("categories");
          setDisplayedCategories(catNameMatches);
          setSearchSubItems([]);
        } else if (subResults.length > 0) {
          setSearchMode("subcategories");
          setSearchSubItems(subResults);
          setDisplayedCategories([]);
        } else {
          setSearchMode("subcategories");
          setSearchSubItems([]);
          setDisplayedCategories([]);
        }
      } catch (e) {
        console.error(e);
        setSearchMode("categories");
        setDisplayedCategories(localCatMatches);
      } finally {
        setSearchSubLoading(false);
      }
    }, 350);

    return () => clearTimeout(catTimer.current);
  }, [categorySearch, categories]);

  /* ══════════════════════════════════════
     SUBCATEGORY PAGE SEARCH
  ══════════════════════════════════════ */
  const [subSearchLoading, setSubSearchLoading] = useState(false);

  useEffect(() => {
    clearTimeout(subTimer.current);

    const q = subcategorySearch.trim();

    if (!q) {
      setSubSearchLoading(false);
      setDisplayedSubcategories(subcategories);
      return;
    }

    setSubSearchLoading(true);

    subTimer.current = setTimeout(async () => {
      try {
        const results = await searchSubcategories(q);
        setDisplayedSubcategories(results);
      } catch (e) {
        console.error(e);

        setDisplayedSubcategories(
          subcategories.filter((s) => {
            return matchesQuery(s.name || "", q);
          })
        );
      } finally {
        setSubSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(subTimer.current);
  }, [subcategorySearch, subcategories]);

  /* ══════════════════════════════════════
     CLICK CATEGORY → navigate to subcategory page
  ══════════════════════════════════════ */
  const handleCategorySelect = useCallback(async (cat) => {
    setSelectedCat(cat);
    setSelectedSub(null);
    setSubcategorySearch("");
    setCurrentPage(1);

    try {
      setSubLoading(true);
      const { items, hasMore, total } = await fetchSubcategoriesFirstPage(cat.CategoryID);

      setSubcategories(items);
      setDisplayedSubcategories(items);
      if (typeof total === "number" && total > 0) {
        setTotalPages(Math.ceil(total / PAGE_SIZE));
      } else {
        setTotalPages(hasMore ? Infinity : 1);
      }
      setStep(1);
    } catch (e) {
      console.error(e);
    } finally {
      setSubLoading(false);
    }
  }, []);

  /* ══════════════════════════════════════
     PAGE CHANGE
  ══════════════════════════════════════ */
  const handlePageChange = useCallback(async (newPage) => {
    if (!selectedCat || newPage < 1 || newPage === currentPage) return;

    setCurrentPage(newPage);
    setSelectedSub(null);

    try {
      setPageLoading(true);
      const { items, hasMore, total } = await fetchSubcategoriesPaged(
        selectedCat.CategoryID,
        newPage,
        PAGE_SIZE
      );

      setSubcategories(items);
      setDisplayedSubcategories(items);

      if (typeof total === "number" && total > 0) {
        setTotalPages(Math.ceil(total / PAGE_SIZE));
      } else {
        setTotalPages((prev) =>
          hasMore ? Math.max(prev === Infinity ? newPage + 1 : prev, newPage + 1) : newPage
        );
      }

      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      console.error(e);
    } finally {
      setPageLoading(false);
    }
  }, [selectedCat, currentPage]);

  /* ══════════════════════════════════════
     NAVIGATE TO PRODUCT INFO
     Called directly on subcategory card click.
     Accepts the sub as a parameter so we don't
     depend on selectedSub state being set first.
  ══════════════════════════════════════ */
  const handleSubcategorySelect = useCallback((sub) => {
    setSelectedSub(sub);
    const trueCategory =
      sub?.categoryName
        ? {
            CategoryID: sub.categoryId || selectedCat?.CategoryID || "",
            name: sub.categoryName,
          }
        : selectedCat;
    const targetPath = isEditMode
      ? `/dashboard/listing/edit/${tableId}/product-info`
      : "/dashboard/listing/select-category/product-info";
    navigate(targetPath, {
      state: {
        category: trueCategory,
        subcategory: sub,
        isEditMode,
        isDuplicateMode,
        editData,
        tableId,
        origin,
        email,
        formData,
        images,
        specifications,
        colourImages,
        confirmedColors,
        variantPrices,
        promotionImage,
        keywords,
        discountType,
        ...restState
      },
    });
  }, [navigate, selectedCat, isEditMode, isDuplicateMode, editData, tableId, origin, email, formData, images, specifications, colourImages, confirmedColors, variantPrices, promotionImage, keywords, discountType, restState]);

  /* ══════════════════════════════════════
     INLINE SUBCATEGORY SEARCH (category page)
  ══════════════════════════════════════ */
  const handleInlineSubSelect = useCallback((sub) => {
    setSelectedSub(sub);
    const trueCategory =
      sub.categoryName
        ? { CategoryID: sub.categoryId || "", name: sub.categoryName }
        : null;
    const targetPath = isEditMode
      ? `/dashboard/listing/edit/${tableId}/product-info`
      : "/dashboard/listing/select-category/product-info";
    navigate(targetPath, {
      state: {
        category: trueCategory,
        subcategory: sub,
        isEditMode,
        isDuplicateMode,
        editData,
        tableId,
        origin,
        email,
        formData,
        images,
        specifications,
        colourImages,
        confirmedColors,
        variantPrices,
        promotionImage,
        keywords,
        discountType,
        ...restState
      },
    });
  }, [navigate, isEditMode, isDuplicateMode, editData, tableId, origin, email, formData, images, specifications, colourImages, confirmedColors, variantPrices, promotionImage, keywords, discountType, restState]);



  if (step === 1) 
    return (
      <StepSubcategory
        selectedCat={selectedCat}
        subcategories={displayedSubcategories}
        loading={subLoading}
        searchLoading={subSearchLoading}
        selectedSub={selectedSub}
        onSelect={handleSubcategorySelect}
        currentPage={currentPage}
        totalPages={totalPages}
        pageLoading={pageLoading}
        onPageChange={handlePageChange}
        isSearchActive={subcategorySearch.trim().length > 0}
        onBack={() => { setStep(0); setSubcategorySearch(""); setSelectedSub(null); }}
        subcategorySearch={subcategorySearch}
        setSubcategorySearch={setSubcategorySearch}
      />
    );
  

  /* ── Category page search state ── */
  const isSearching       = categorySearch.trim().length > 0;
  const showSubcatResults = isSearching && searchMode === "subcategories";
  const isSearchLoading   = isSearching && (searchSubLoading || searchMode === "loading");

  return (
    <div className="sc-root sc-visible">
      <BackButton
        label="Back to Seller Dashboard"
        onClick={() => navigate("/dashboard/listing", { state: { tab: origin } })}
      />

      <PageHeader
        title="Add New Product"
        subtitle="Choose the best category for your product listing."
        currentStep={step}
      />

      <SearchBar
        value={categorySearch}
        onChange={setCategorySearch}
        onClear={() => setCategorySearch("")}
        placeholder="Search categories or subcategories..."
      />

      <section className="sc-section">
        {showSubcatResults ? (
          <div className="sc-section-header">
            <span className="sc-section-count">
              {searchSubItems.length} result{searchSubItems.length !== 1 ? "s" : ""}
            </span>
          </div>
        ) : (
          <div className="sc-section-header">
            <h2 className="sc-section-title">Top Categories</h2>
          </div>
        )}

        {(catLoading || isSearchLoading) ? (
          <SkeletonGrid count={showSubcatResults ? 8 : 7} tall={showSubcatResults} />

        ) : showSubcatResults ? (
          searchSubItems.length === 0
            ? <div className="sc-cat-grid"><EmptyState query={categorySearch} /></div>
            : <SubcategoryGrid
                items={searchSubItems}
                selectedSub={selectedSub}
                onSelect={handleInlineSubSelect}
              />

        ) : displayedCategories.length === 0 ? (
          <div className="sc-cat-grid"><EmptyState query={categorySearch} /></div>
        ) : (
          <div className="sc-cat-grid">
            {displayedCategories.map((cat, idx) => {
              const color      = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
              const isSelected = selectedCat?.CategoryID === cat.CategoryID;
              return (
                <button
                  type="button"
                  key={`${cat.CategoryID}-${idx}`}
                  className={`sc-cat-card ${isSelected ? "sc-cat-card--selected" : ""}`}
                  style={{
                    "--card-accent": color.accent,
                    "--card-bg":     color.bg,
                    "--card-light":  color.light,
                  }}
                  onClick={() => handleCategorySelect(cat)}
                >
                  <div className="sc-cat-icon-wrap">
                    <div className="sc-cat-icon">
                      {CATEGORY_ICONS[cat.name] ? (
                        CATEGORY_ICONS[cat.name]
                      ) : cat.imageUrl ? (
                        <img
                          src={cat.imageUrl}
                          alt={cat.name}
                          loading="lazy"
                          style={{
                            width: "100%", height: "100%",
                            objectFit: "cover", borderRadius: 8,
                            display: "block",
                          }}
                          onError={(e) => { e.currentTarget.style.display = "none"; }}
                        />
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none">
                          <rect x="3" y="3" width="18" height="18" rx="3"
                            stroke="currentColor" strokeWidth="1.5" />
                        </svg>
                      )}
                    </div>
                    {isSelected && (
                      <div className="sc-selected-check">
                        <CheckIcon size={9} />
                      </div>
                    )}
                  </div>
                  <span className="sc-cat-name">{cat.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default SelectCategory;