  import { useState, useEffect, useRef, useCallback } from "react";
  import { useNavigate, useLocation } from "react-router-dom";
  import "./PromotionPage.css";
import LivePreview from "../../../components/LivePreview/LivePreview";

const resolveWixImage = (img) => {
  if (!img) return null;
  const raw =
    typeof img === "string"
      ? img
      : img.src || img.url || img.image || img.imageUrl || null;
  if (!raw) return null;
  if (raw.startsWith("data:")) return raw;
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    if (raw.includes("static.wixstatic.com/media/")) {
      const parts = raw.split("static.wixstatic.com/media/");
      if (parts.length > 1) {
        const pathPart = parts[1].split("?")[0].split("#")[0];
        const pathSegments = pathPart.split("/");
        let fileId = pathSegments[0];
        if (pathSegments.length > 1) {
          if (!fileId.includes(".") && pathSegments[1].includes(".")) {
            const ext = pathSegments[1].split(".").pop();
            fileId = `${fileId}.${ext}`;
          }
        }
        return `https://static.wixstatic.com/media/${fileId}`;
      }
    }
    return raw;
  }
  if (raw.startsWith("wix:image://")) {
    const withoutScheme  = raw.replace(/^wix:image:\/\//, "");
    const withoutVersion = withoutScheme.replace(/^v1\//, "");
    const hashIdx  = withoutVersion.indexOf("#");
    const pathPart = hashIdx !== -1 ? withoutVersion.substring(0, hashIdx) : withoutVersion;
    const pathSegments = pathPart.split("/");
    let fileId   = pathSegments[0];
    let fileName = pathSegments[1] || "";
    if (!fileId || fileId.length > 200 || fileId.includes(" ")) return null;
    if (fileId.includes(".")) {
      return `https://static.wixstatic.com/media/${fileId}`;
    }
    if (fileName && fileName.includes(".")) {
      const ext = fileName.split(".").pop();
      return `https://static.wixstatic.com/media/${fileId}.${ext}`;
    }
    return `https://static.wixstatic.com/media/${fileId}~mv2.jpg`;
  }
  return null;
};

const MAX_SIZE_BYTES = 150 * 1024; // 150 KB

/**
 * Compress / resize an image file so its base64 output stays ≤ 150 KB
 * while preserving maximum visual quality.
 */
const compressImage = (file) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const mediaType = file.type;

      const encode = (scale, quality) =>
        new Promise((res) => {
          const canvas = document.createElement("canvas");
          canvas.width  = Math.round(img.naturalWidth  * scale);
          canvas.height = Math.round(img.naturalHeight * scale);
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          canvas.toBlob(
            (blob) => {
              if (!blob) { res(null); return; }
              const reader = new FileReader();
              reader.onload = () => res({ blob, base64: reader.result.split(",")[1] });
              reader.onerror = () => res(null);
              reader.readAsDataURL(blob);
            },
            mediaType,
            quality
          );
        });

      const tryCompress = async () => {
        let result = await encode(1.0, 0.99);
        if (result && result.blob.size <= MAX_SIZE_BYTES) return result;

        let lo = 0.5, hi = 0.99;
        for (let i = 0; i < 8; i++) {
          const mid = (lo + hi) / 2;
          result = await encode(1.0, mid);
          if (!result) break;
          if (result.blob.size <= MAX_SIZE_BYTES) lo = mid;
          else hi = mid;
        }
        result = await encode(1.0, lo);
        if (result && result.blob.size <= MAX_SIZE_BYTES) return result;

        let scale = 0.9;
        while (scale >= 0.3) {
          result = await encode(scale, 0.92);
          if (result && result.blob.size <= MAX_SIZE_BYTES) return result;
          scale -= 0.1;
        }

        return encode(0.3, 0.7);
      };

      tryCompress().then((r) => {
        if (!r) { reject(new Error("Compression failed")); return; }
        resolve({ blob: r.blob, base64: r.base64, mediaType });
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to load image"));
    };

    img.src = objectUrl;
  });

  /* ── SVG ICONS ── */
  const ArrowLeftIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M19 12H5M5 12l7 7M5 12l7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
  const ArrowRightIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
  const CheckIcon = ({ size = 13, color = "white" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M5 13l4 4L19 7" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
  const UploadCloudIcon = ({ size = 48 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <polyline points="16 16 12 12 8 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="12" y1="12" x2="12" y2="21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
  const TrashIcon = ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M9 6V4h6v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
  const RefreshIcon = ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <polyline points="1 4 1 10 7 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3.51 15a9 9 0 102.13-9.36L1 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
  const XIcon = ({ size = 10 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  );
  const TagIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="7" y1="7" x2="7.01" y2="7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
  const ImageIcon = ({ size = 48 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="1.5"/>
      <polyline points="21 15 16 10 5 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
  const AlertCircleIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
  const SaveIcon = ({ size = 15 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <polyline points="17 21 17 13 7 13 7 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <polyline points="7 3 7 8 15 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
  const SparkleIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M12 2l2.09 6.26L20 10l-5.91 1.74L12 18l-2.09-6.26L4 10l5.91-1.74L12 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
  const MonitorIcon = ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="8" y1="21" x2="16" y2="21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="12" y1="17" x2="12" y2="21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
  const SmartphoneIcon = ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="12" y1="18" x2="12.01" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );

  /* ── STEP INDICATORS ── */
  const STEPS = [
    { label: "Pick Category",   desc: "Choose the best category" },
    { label: "Product Info",    desc: "Add your product details" },
    { label: "Review & Submit", desc: "Final review" },
  ];

  const StepIndicator = ({ currentStep }) => (
    <div className="pp-steps">
      {STEPS.map((step, i) => {
        const isActive = i === currentStep;
        const isDone   = i < currentStep;
        return (
          <div key={i} className={`pp-step ${isActive ? "pp-step--active" : ""} ${isDone ? "pp-step--done" : ""}`}>
            <div className="pp-step-bubble">
              {isDone ? <CheckIcon size={12} /> : <span>{i + 1}</span>}
            </div>
            <span className="pp-step-label">{step.label}</span>
            {i < STEPS.length - 1 && (
              <div className={`pp-step-line ${isDone ? "pp-step-line--done" : ""}`}/>
            )}
          </div>
        );
      })}
    </div>
  );

  /* ── IMAGE UPLOAD ZONE ── */
  const ImageUploadZone = ({ image, onUpload, onDelete, error }) => {
    const inputRef = useRef(null);
    const [dragging, setDragging] = useState(false);
    const [uploading, setUploading] = useState(false);

    const imagesList = Array.isArray(image) ? image : (image ? [image] : []);

    const processFiles = useCallback(async (files) => {
      if (!files || files.length === 0) return;

      const maxAllowed = 5 - imagesList.length;
      let exceeded = false;
      let filesToProcess = Array.from(files);

      if (filesToProcess.length > maxAllowed) {
        exceeded = true;
        filesToProcess = filesToProcess.slice(0, Math.max(0, maxAllowed));
      }

      if (exceeded) {
        onUpload(null, "You can't upload more than 5 images.");
      }

      if (filesToProcess.length === 0) return;

      setUploading(true);

      for (const file of filesToProcess) {
        const allowed = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
        if (!allowed.includes(file.type)) {
          onUpload(null, `Unsupported format for "${file.name}". Use PNG, JPG, or WEBP.`);
          continue;
        }

        try {
          const { blob, base64, mediaType } = await compressImage(file);
          const fileName = file.name;
          const res = await fetch("https://haatza.com/_functions/uploadMedia", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fileName, fileData: base64, mediaType }),
          });
          if (!res.ok) throw new Error(`Upload failed (${res.status})`);
          const data = await res.json();
          const uploadedUrl =
            data?.url ||
            data?.mediaUrl ||
            data?.imageUrl ||
            data?.src ||
            data?.data?.url ||
            data?.data?.mediaUrl ||
            null;
          if (!uploadedUrl) throw new Error("No URL returned from upload");
          const resolvedUrl = resolveWixImage(uploadedUrl) || uploadedUrl;
          onUpload({ url: resolvedUrl, name: file.name, size: blob.size, wixResponse: data }, null);
        } catch (err) {
          onUpload(null, `Upload failed for ${file.name}: ${err.message}`);
        }
      }
      setUploading(false);
    }, [onUpload, imagesList.length]);

    const handleDrop = useCallback((e) => {
      e.preventDefault();
      setDragging(false);
      const files = e.dataTransfer.files;
      processFiles(files);
    }, [processFiles]);

    const handleDragOver = (e) => { e.preventDefault(); setDragging(true); };
    const handleDragLeave = () => setDragging(false);

    return (
      <div className="pp-upload-section">
        {imagesList.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
            {imagesList.map((img, idx) => (
              <div
                key={idx}
                style={{
                  width: 100, height: 100, borderRadius: 10,
                  overflow: "hidden", position: "relative",
                  border: "2px solid rgba(0,0,0,0.1)",
                  boxSizing: "border-box",
                }}
              >
                <img
                  src={img.url}
                  alt={`Promotion ${idx + 1}`}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
                <button
                  type="button"
                  onClick={() => onDelete(idx)}
                  style={{
                    position: "absolute",
                    top: 4,
                    right: 4,
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: "#ef4444",
                    border: "none",
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 10,
                    fontWeight: "bold",
                    cursor: "pointer",
                    zIndex: 50,
                    lineHeight: 1,
                    boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                  }}
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        )}

        {imagesList.length < 5 && (
          <div
            className={`pp-dropzone ${dragging ? "pp-dropzone--dragging" : ""} ${error ? "pp-dropzone--error" : ""} ${uploading ? "pp-dropzone--uploading" : ""}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => !uploading && inputRef.current?.click()}
          >
            <div className="pp-dropzone-inner">
              {uploading ? (
                <div className="pp-upload-spinner-wrap">
                  <div className="pp-upload-spinner"/>
                  <p className="pp-upload-uploading-text">Uploading…</p>
                </div>
              ) : (
                <>
                  <div className="pp-dropzone-icon">
                    <UploadCloudIcon size={40} />
                  </div>
                  <p className="pp-dropzone-title">Upload Promotion Image</p>
                  <p className="pp-dropzone-sub">Drag &amp; drop or <span className="pp-dropzone-browse">browse files</span></p>
                  <div className="pp-dropzone-formats">
                    <span className="pp-format-badge">PNG</span>
                    <span className="pp-format-badge">JPG/JPEG</span>
                    <span className="pp-format-badge">WEBP</span>
                    <span className="pp-format-size">Max 5 images · ~150KB each</span>
                  </div>
                </>
              )}
            </div>
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              multiple
              style={{ display: "none" }}
              onChange={e => { processFiles(e.target.files); e.target.value = ""; }}
            />
          </div>
        )}
        {error && (
          <div className="pp-field-error" style={{ marginTop: 8 }}>
            <AlertCircleIcon size={13} />
            {error}
          </div>
        )}
      </div>
    );
  };

  /* ── KEYWORDS INPUT ── */
  const KeywordsInput = ({ keywords, onChange, error, setError }) => {
    const [inputVal, setInputVal] = useState("");
    const inputRef = useRef(null);

    const addKeyword = () => {
      const trimmed = inputVal.trim();
      if (!trimmed) return;
      if (keywords.includes(trimmed)) return;
      if (keywords.length >= 5) {
        if (setError) setError("Maximum of 5 keywords allowed.");
        return;
      }
      onChange([...keywords, trimmed]);
      setInputVal("");
      if (setError) setError("");
    };

    const handleKeyDown = (e) => {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        addKeyword();
      }
      if (e.key === "Backspace" && inputVal === "" && keywords.length > 0) {
        onChange(keywords.slice(0, -1));
        if (setError) setError("");
      }
    };

    const removeKeyword = (kw) => {
      onChange(keywords.filter(k => k !== kw));
      if (setError) setError("");
    };

    return (
      <div className="pp-keywords-section">
        <div className="pp-keywords-header">
          <div className="pp-keywords-title-row">
            <TagIcon />
            <span className="pp-section-title">
              Keywords
              <span style={{
                marginLeft: 8,
                fontSize: 12,
                fontWeight: 600,
                color: "var(--pp-text-2, #64748b)",
                background: "rgba(0,0,0,0.06)",
                borderRadius: 20,
                padding: "2px 8px",
              }}>
                {keywords.length} added
              </span>
            </span>
          </div>
          <span className="pp-keywords-hint">Press Enter or comma to add · Click × to remove</span>
        </div>

        <div
          className={`pp-keywords-input-box ${error ? "pp-keywords-input-box--error" : ""}`}
          style={{ flexWrap: "wrap", minHeight: 48, alignItems: "flex-start", padding: "8px", cursor: "text" }}
          onClick={() => inputRef.current?.focus()}
        >
          {keywords.map((kw) => (
            <span key={kw} className="pp-keyword-tag" onClick={(e) => e.stopPropagation()}>
              {kw}
              <button type="button" className="pp-keyword-remove" onMouseDown={(e) => { e.preventDefault(); removeKeyword(kw); }}>
                <XIcon size={9} />
              </button>
            </span>
          ))}
          <input
            ref={inputRef}
            className="pp-keywords-inner-input"
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={addKeyword}
            placeholder={keywords.length === 0 ? "Type keyword and press Enter…" : keywords.length >= 5 ? "Max keywords reached" : "Add another…"}
            disabled={keywords.length >= 5}
            style={{ minWidth: 140 }}
          />
        </div>

        {error && (
          <div className="pp-field-error">
            <AlertCircleIcon size={13} />
            {error}
          </div>
        )}
      </div>
    );
  };



  /* ════════════════════════════════════════════════════
    MAIN COMPONENT
  ════════════════════════════════════════════════════ */
  const PromotionPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const {
  category, subcategory, formData, images, specifications,
  isEditMode, isDuplicateMode, editData, tableId, origin, email,
  optionFields    = [],
  specFieldsList  = [],
  variants        = [],
  variantPrices   = {},
  confirmedColors = [],
  colourImages    = {},
  discountType    = "percent",
} = location.state || {};
    const [imageError,     setImageError]     = useState("");
    const [keywordsError,  setKeywordsError]  = useState("");
    const [previewMode,    setPreviewMode]    = useState("desktop");
    const [mounted, setMounted] = useState(false);
  const prefillPromoImage = (() => {
    if (location.state?.promotionImage !== undefined) {
      const val = location.state.promotionImage;
      if (Array.isArray(val)) return val;
      return val ? [val] : [];
    }
    if ((isEditMode || isDuplicateMode) && editData) {
      const photos = editData.promotionPhotos || editData.promotion_photos || editData.promoPhotos || editData.promotionImages;
      if (Array.isArray(photos) && photos.length > 0) {
        return photos.map((p, idx) => {
          const url = typeof p === "string" ? p : p?.url || p?.src || null;
          return url ? { url: resolveWixImage(url) || url, name: `promotion-image-${idx + 1}`, size: 0 } : null;
        }).filter(Boolean);
      }
    }
    return [];
  })();

  const prefillKeywords = (() => {
    if (Array.isArray(location.state?.keywords)) {
      return location.state.keywords;
    }
    const kw = editData?.search_keywords || editData?.searchKeywords || editData?.keywords;
    if ((isEditMode || isDuplicateMode) && kw) {
      if (Array.isArray(kw)) return kw.map(k => String(k)).filter(Boolean);
      if (typeof kw === "string") return kw.split(",").map(k => k.trim()).filter(Boolean);
    }
    return [];
  })();

  const [promotionImage, setPromotionImage] = useState(prefillPromoImage);
  const [keywords,       setKeywords]       = useState(prefillKeywords);
    useEffect(() => {
      const t = setTimeout(() => setMounted(true), 10);
      return () => clearTimeout(t);
    }, []);

    const handleImageUpload = (img, err) => {
      if (err) {
        setImageError(err);
      } else if (img) {
        setPromotionImage(prev => {
          const current = Array.isArray(prev) ? prev : (prev ? [prev] : []);
          if (current.length >= 5) {
            setImageError("You can't upload more than 5 images.");
            return current;
          }
          setImageError("");
          return [...current, img];
        });
      }
    };

    const handleImageDelete = (idx) => {
      setPromotionImage(prev => {
        const current = Array.isArray(prev) ? prev : (prev ? [prev] : []);
        const updated = current.filter((_, i) => i !== idx);
        setImageError("");
        return updated;
      });
    };

    // ── CHANGE 1: Promotion details are now optional — no validation required ──
    const handleContinue = () => {
  const reviewPath = isEditMode && !isDuplicateMode
    ? `/dashboard/listing/edit/${tableId}/product-info/specifications/promotions/review`
    : "/dashboard/listing/promotions";

  navigate(reviewPath, {
    state: {
      category,
      subcategory,
      formData,
      images,
      specifications,
      promotionImage,
      keywords,
      isEditMode: isEditMode && !isDuplicateMode,
      isDuplicateMode,
      editData,
      tableId: isDuplicateMode ? null : tableId,
      origin,
      email,
      // CRITICAL: forward all spec/variant data to ReviewSubmitPage
      optionFields,
      specFieldsList,
      variants,
      variantPrices,
      confirmedColors,
      colourImages,
      discountType,
    },
  });
};

    const handleBack = () => {
  navigate(
    isEditMode && !isDuplicateMode
      ? `/dashboard/listing/edit/${tableId}/product-info/specifications`
      : "/dashboard/listing/select-category/product-info/specifications",
    {
      state: {
        category, subcategory, formData, images, specifications,
        isEditMode: isEditMode && !isDuplicateMode,
        isDuplicateMode,
        editData,
        tableId: isDuplicateMode ? null : tableId,
        origin,
        email,
        // Forward back so user doesn't lose their work
        optionFields,
        specFieldsList,
        variants,
        variantPrices,
        confirmedColors,
        colourImages,
        discountType,
        promotionImage,
        keywords,
      },
    }
  );
};

    const handleSaveDraft = () => {
      // Draft logic here
    };

    return (
      // ── CHANGE 3: Added pb-action class for bottom padding to accommodate inline action row ──
      <div className={`pp-root pp-root--no-sticky ${mounted ? "pp-root--mounted" : ""}`}>

        {/* Back button */}
        <button className="pp-back-btn" onClick={handleBack}>
          <ArrowLeftIcon size={15} />
          Back
        </button>

        {/* Header */}
        <div className="pp-header">
          <h1 className="pp-title">Promotion Images</h1>
          <p className="pp-subtitle">Add promotional visuals and keywords for your listing (optional)</p>
        </div>

        {/* Step indicator */}
        <StepIndicator currentStep={2} />

        {/* Main layout */}
        <div className="lp-main-layout">

          {/* Left: upload + keywords */}
          <div className="lp-form-side">
            
            {/* Image upload card */}
            <div className="pp-card">
              <div className="pp-card-header">
                <div className="pp-card-icon">
                  <UploadCloudIcon size={18} />
                </div>
                <div>
                  <h3 className="pp-card-title">Promotion Image</h3>
                  <p className="pp-card-subtitle">Upload a high-quality promotional banner</p>
                </div>
              </div>
              <ImageUploadZone
                image={promotionImage}
                onUpload={handleImageUpload}
                onDelete={handleImageDelete}
                error={imageError}
              />
            
            </div>

            {/* Keywords card */}
            <div className="pp-card pp-card--keywords">
              <div className="pp-card-header">
                <div className="pp-card-icon pp-card-icon--purple">
                  <TagIcon />
                </div>
                <div>
                  <h3 className="pp-card-title">Keywords </h3>
                  <p className="pp-card-subtitle">Add up to 5 search keywords to help buyers discover your promotion</p>
                </div>
              </div>
              <KeywordsInput
                keywords={keywords}
                onChange={(kws) => { setKeywords(kws); if (kws.length > 0 && kws.length <= 5) setKeywordsError(""); }}
                error={keywordsError}
                setError={setKeywordsError}
              />
            </div>

          </div>

          {/* Right: preview */}
          <div className="lp-preview-side">
            <LivePreview
              category={category}
              subcategory={subcategory}
              formData={formData}
              images={images}
              specifications={specifications}
              confirmedColors={confirmedColors}
              colourImages={colourImages}
              variantPrices={variantPrices}
              promotionImage={promotionImage}
              keywords={keywords}
              fields={[...optionFields, ...specFieldsList]}
              variants={variants}
            />
          </div>

        </div>

        <div className="lp-preview-mobile">
          <LivePreview
            category={category}
            subcategory={subcategory}
            formData={formData}
            images={images}
            specifications={specifications}
            confirmedColors={confirmedColors}
            colourImages={colourImages}
            variantPrices={variantPrices}
            promotionImage={promotionImage}
            keywords={keywords}
            fields={[...optionFields, ...specFieldsList]}
            variants={variants}
          />
        </div>

        

        {/* Inline action row — Submit button at bottom-right */}
        <div className="pp-inline-action-row">
          <button className="pp-btn pp-btn--continue" onClick={handleContinue}>
            Review &amp; Submit <ArrowRightIcon size={15} />
          </button>
        </div>

      </div>
    );
  };

  export default PromotionPage;