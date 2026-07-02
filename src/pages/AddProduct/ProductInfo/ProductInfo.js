import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./ProductInfo.css";
import { fetchCategoryFields } from "../../../services/sellerService";
import LivePreview from "../../../components/LivePreview/LivePreview";

const resolveSubcategoryId = (subcategory, category) => {
  if (!subcategory) return null;
  if (typeof subcategory === "string" && subcategory.trim() !== "") return subcategory.trim();
  const candidates = [
    subcategory._id, subcategory.id, subcategory.subcategoryId,
    subcategory.SubCategoryID, subcategory.subCategoryId, subcategory.categoryId,
  ];
  for (const c of candidates) {
    if (c && typeof c === "string" && c.trim() !== "") return c.trim();
  }
  return category?.CategoryID ?? category?._id ?? null;
};

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

/* ─────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────── */
const STEPS = [
  { label: "Pick Category",   desc: "Choose the best category" },
  { label: "Product Info",    desc: "Add your product details" },
  { label: "Review & Submit", desc: "Final review" },
];

export const STEP = {
  PICK_CATEGORY: 0,
  PRODUCT_INFO:  1,
  REVIEW_SUBMIT: 2,
};

const BRAND_OPTIONS = ["Generic", "Other"];

const cleanTextInput = (val) => {
  if (!val) return "";
  return val.replace(/[^A-Za-z0-9\s]/g, "");
};

const COD_OPTIONS = [
  { value: "yes", label: "Yes" },
  { value: "no",  label: "No" },
];

const RETURN_OPTIONS = [
  { value: "return",            label: "Return" },
  { value: "no_return",         label: "No Return" },
  { value: "exchange",          label: "Exchange" },
  { value: "return_or_exchange",label: "Return or Exchange" },
];

const DELIVERY_OPTIONS = [
  { value: "yes", label: "Yes" },
  { value: "no",  label: "No" },
];

/* ─────────────────────────────────────────
   IMAGE UPLOAD HELPERS
───────────────────────────────────────── */

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_SIZE_BYTES  = 150 * 1024; // 150 KB
const UPLOAD_ENDPOINT = "https://haatza.com/_functions/uploadMedia";

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

const uploadToApi = async ({ base64, mediaType, fileName }) => {
  const res = await fetch(UPLOAD_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName, fileData: base64, mediaType }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Upload failed (${res.status})${text ? `: ${text}` : ""}`);
  }

  const data = await res.json();
  console.log("Upload API response:", JSON.stringify(data, null, 2));

  const url =
    data?.url ||
    data?.mediaUrl ||
    data?.imageUrl ||
    data?.image_url ||
    data?.link ||
    data?.src ||
    data?.data?.url ||
    data?.data?.mediaUrl ||
    data?.data?.imageUrl ||
    data?.result?.url ||
    null;

  if (!url) throw new Error("Upload succeeded but no URL was returned");
  return { url: resolveWixImage(url) || url, wixResponse: data };
};

/* ─────────────────────────────────────────
   ICONS
───────────────────────────────────────── */
const CheckIcon = ({ size = 13, color = "white" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M5 13l4 4L19 7" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const ArrowRightIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const ArrowLeftIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M19 12H5M5 12l7 7M5 12l7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const UploadIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <polyline points="17,8 12,3 7,8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="12" y1="3" x2="12" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const ImageIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/>
    <circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M21 15l-5-5L5 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const InfoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M12 16v-4M12 8h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const TagIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="7" y1="7" x2="7.01" y2="7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const ShippingIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <rect x="1" y="3" width="15" height="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M16 8h4l3 3v5h-7V8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="5.5" cy="18.5" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
    <circle cx="18.5" cy="18.5" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

const ResellerIcon = () => (
  <span style={{
    fontSize: 20,
    fontWeight: 700,
    width: 24,
    height: 24,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: "currentColor"
  }}>₹</span>
);

const ChevronDownIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const ChevronRightIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const CloseIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

/* ─────────────────────────────────────────
   IMAGE GUIDELINES MODAL
───────────────────────────────────────── */
const ImageGuidelinesModal = ({ onClose }) => (
  <div className="pi-guidelines-popover">
    <div className="pi-modal-header">
      <div className="pi-modal-title-row">
        <ImageIcon />
        <h2 className="pi-modal-title">Image Guidelines</h2>
      </div>
      <button className="pi-modal-close" onClick={onClose}><CloseIcon size={18} /></button>
    </div>
    <div className="pi-modal-body">
      <div className="pi-modal-section pi-modal-section--green">
        <div className="pi-modal-section-header">
          <span className="pi-modal-icon">✅</span>
          <h3>Accepted Formats</h3>
        </div>
        <ul>
          <li>Only <strong>JPEG images</strong> are supported.</li>
          <li>Images must be in <strong>RGB color space</strong>; CMYK and other color spaces are not allowed.</li>
        </ul>
      </div>
      <div className="pi-modal-section pi-modal-section--red">
        <div className="pi-modal-section-header">
          <span className="pi-modal-icon">🚫</span>
          <h3>Rejected Images</h3>
        </div>
        <ul>
          <li>Graphic, inverted, or pixelated images will not be accepted.</li>
          <li>Images with <strong>text or watermarks</strong> are not allowed as primary images.</li>
          <li>Blurry or cluttered images will be rejected.</li>
          <li>Images displaying <strong>prices or brand logos</strong> are not permitted.</li>
          <li>Distorted images (stretched, shrunk, or elongated) are not allowed.</li>
          <li>Partial product images are not acceptable.</li>
          <li>Offensive or inappropriate content will be strictly rejected.</li>
        </ul>
      </div>
      <div className="pi-modal-section pi-modal-section--blue">
        <div className="pi-modal-section-header">
          <span className="pi-modal-icon">🎯</span>
          <h3>Image Standards</h3>
        </div>
        <ul>
          <li>Ensure a clear product image with <strong>no additional props</strong>.</li>
          <li>Product images must <strong>not contain any text</strong>.</li>
        </ul>
      </div>
    </div>
    <div className="pi-modal-footer">
      <button className="pi-modal-dismiss" onClick={onClose}>Got it</button>
    </div>
  </div>
);

/* ─────────────────────────────────────────
   STEP INDICATORS
───────────────────────────────────────── */
const StepIndicator = ({ currentStep }) => (
  <div className="pi-steps">
    {STEPS.map((step, i) => {
      const isActive = i === currentStep;
      const isDone   = i < currentStep;
      return (
        <div key={i} className={`pi-step ${isActive ? "pi-step--active" : ""} ${isDone ? "pi-step--done" : ""}`}>
          <div className="pi-step-bubble">
            {isDone ? <CheckIcon size={12} /> : <span>{i + 1}</span>}
          </div>
          <span className="pi-step-label">{step.label}</span>
          {i < STEPS.length - 1 && (
            <div className={`pi-step-line ${isDone ? "pi-step-line--done" : ""}`} />
          )}
        </div>
      );
    })}
  </div>
);

const StepIndicatorMobile = ({ currentStep }) => (
  <div className="pi-steps-mobile">
    {STEPS.map((step, i) => {
      const isActive = i === currentStep;
      const isDone   = i < currentStep;
      return (
        <div key={i} className={`pi-vstep ${isActive ? "pi-vstep--active" : ""} ${isDone ? "pi-vstep--done" : ""}`}>
          <div className="pi-vstep-left">
            <div className="pi-vstep-bubble">
              {isDone ? <CheckIcon size={12} /> : <span>{i + 1}</span>}
            </div>
            {i < STEPS.length - 1 && (
              <div className={`pi-vstep-line ${isDone ? "pi-vstep-line--done" : ""}`} />
            )}
          </div>
          <div className="pi-vstep-right">
            <div className="pi-vstep-label">{step.label}</div>
            <div className="pi-vstep-desc">{step.desc}</div>
            {isActive && <div className="pi-vstep-badge">In progress</div>}
          </div>
        </div>
      );
    })}
  </div>
);

const PageHeader = ({ title, subtitle, currentStep }) => (
  <>
    <div className="pi-header">
      <div className="pi-header-left">
        <h1 className="pi-title">{title}</h1>
        <p className="pi-subtitle">{subtitle}</p>
      </div>
    </div>
    <StepIndicator currentStep={currentStep} />
    <StepIndicatorMobile currentStep={currentStep} />
  </>
);

const BackButton = ({ label, onClick }) => (
  <button className="pi-back-btn" onClick={onClick}>
    <ArrowLeftIcon size={15} />
    {label}
  </button>
);

/* ─────────────────────────────────────────
   IMAGE UPLOAD SECTION
───────────────────────────────────────── */
const ImageUploadSection = ({ images, onUpload, onRemove }) => {
  const [guidelinesOpen, setGuidelinesOpen] = useState(false);
  const [limitError, setLimitError] = useState("");

  const handleFileChange = async (e) => {
    let files = Array.from(e.target.files);
    e.target.value = "";

    const maxAllowed = 10 - images.length;
    let exceeded = false;

    if (files.length > maxAllowed) {
      exceeded = true;
      files = files.slice(0, Math.max(0, maxAllowed));
    }

    if (exceeded) {
      setLimitError("You can't upload more than 10 images.");
    } else {
      setLimitError("");
    }

    if (files.length === 0) return;

    for (const file of files) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        onUpload({
          file,
          preview:  URL.createObjectURL(file),
          status:   "error",
          mediaUrl: null,
          error:    `Unsupported format "${file.type}". Use PNG, JPG or WEBP.`,
        });
        continue;
      }

      const previewUrl = URL.createObjectURL(file);
      const placeholder = {
        file,
        preview:  previewUrl,
        status:   "uploading",
        mediaUrl: null,
        error:    null,
      };
      onUpload(placeholder);

      let compressed;
      try {
        compressed = await compressImage(file);
      } catch (compressErr) {
        onUpload({
          ...placeholder,
          status: "error",
          error:  `Compression failed: ${compressErr.message}`,
        });
        continue;
      }

      try {
        const { url: mediaUrl, wixResponse } = await uploadToApi({
          base64:    compressed.base64,
          mediaType: compressed.mediaType,
          fileName:  file.name,
        });

        onUpload({
          ...placeholder,
          status:   "success",
          mediaUrl,
          preview:  mediaUrl,
          wixResponse,
        });

        // Log immediately after upload
        console.log("Uploaded Product Images:", [mediaUrl]);
      } catch (uploadErr) {
        onUpload({
          ...placeholder,
          status: "error",
          error:  uploadErr.message,
        });
      }
    }
  };

  return (
    <div className="pi-upload-section">

      <div className="pi-upload-header">
        <h3 className="pi-section-title">
          <ImageIcon />
          Product Images <span className="pi-required">*</span>
        </h3>
        <span className="pi-upload-count">{images.length}/10 images</span>
      </div>

      <div className="pi-upload-grid">
        {images.length < 10 && (
          <label className="pi-upload-box">
            <input
              type="file"
              accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
              multiple
              onChange={handleFileChange}
              style={{ display: "none" }}
            />
            <div className="pi-upload-icon-wrap">
              <UploadIcon />
            </div>
            <span className="pi-upload-text">Click to upload</span>
            <span className="pi-upload-subtext">or drag &amp; drop your images here</span>
            <span className="pi-upload-hint">PNG, JPG, WEBP up to 150 KB · <strong className="pi-upload-limit-highlight">Min 2, Max 10 images</strong></span>
          </label>
        )}

        {images.map((img, idx) => (
          <div key={idx} className="pi-uploaded-img" style={{ position: "relative" }}>
            <img src={img.preview} alt={`Product ${idx + 1}`} />
            <button className="pi-img-remove" onClick={() => { setLimitError(""); onRemove(idx); }}>✕</button>

            {idx === 0 && img.status === "success" && (
              <span className="pi-img-primary">Front View</span>
            )}

            {img.status === "uploading" && (
              <div style={overlayStyle("#0000007a")}>
                <UploadSpinner />
                <span style={overlayLabelStyle}>Uploading…</span>
              </div>
            )}

            {img.status === "error" && (
              <div style={overlayStyle("rgba(239,68,68,0.82)")} title={img.error}>
                <span style={{ fontSize: 20 }}>✕</span>
                <span style={{ ...overlayLabelStyle, fontSize: 10, textAlign: "center", padding: "0 4px" }}>
                  {img.error?.length > 40 ? img.error.slice(0, 37) + "…" : img.error}
                </span>
              </div>
            )}

            {img.status === "success" && (
              <div style={{
                position: "absolute", top: 4, left: 4,
                background: "rgba(5,150,105,0.88)",
                borderRadius: 5, padding: "2px 5px",
                display: "flex", alignItems: "center", gap: 3,
                maxWidth: "calc(100% - 8px)",
                overflow: "hidden",
              }}>
                <CheckIcon size={9} color="white" />
                <span style={{
                  color: "white", fontSize: 8, fontWeight: 700,
                  fontFamily: "var(--ff-display)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}>
                  ✓
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {limitError && (
        <p className="pi-error-text pi-error-anim" style={{ marginTop: 8 }}>
          {limitError}
        </p>
      )}

      <div className="pi-guidelines-container">
        <button className="pi-guidelines-btn" onClick={() => setGuidelinesOpen(!guidelinesOpen)}>
          <InfoIcon />
          <span>Image Guidelines</span>
          <ChevronRightIcon size={13} />
        </button>
        {guidelinesOpen && <ImageGuidelinesModal onClose={() => setGuidelinesOpen(false)} />}
      </div>

      <div className="pi-inline-guidelines">
        <ul>
          <li>You can create a catalog with a <strong>minimum of 2 images</strong> and a <strong>maximum of 10 images</strong>.</li>
          <li>Make sure all the images you upload <strong>belong to the same category</strong> you selected.</li>
        </ul>
      </div>
    </div>
  );
};

const overlayStyle = (bg) => ({
  position: "absolute", inset: 0,
  background: bg,
  display: "flex", flexDirection: "column",
  alignItems: "center", justifyContent: "center",
  gap: 6, borderRadius: "inherit", color: "white",
});
const overlayLabelStyle = {
  fontSize: 11, fontWeight: 700,
  fontFamily: "var(--ff-display)", color: "white",
};

const UploadSpinner = () => (
  <svg
    width="24" height="24" viewBox="0 0 24 24" fill="none"
    style={{ animation: "pi-spin 0.75s linear infinite" }}
  >
    <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5"/>
    <path d="M12 2a10 10 0 0110 10" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
    <style>{`@keyframes pi-spin { to { transform: rotate(360deg); } }`}</style>
  </svg>
);

/* ─────────────────────────────────────────
   FORM FIELD COMPONENTS
───────────────────────────────────────── */
const FormInput = ({ label, required, placeholder, value, onChange, type = "text", prefix, suffix, maxLength, helperText, error, touched }) => (
  <div className="pi-field">
    <label className="pi-label">
      {label}
      {required && <span className="pi-required"> *</span>}
    </label>
    <div className="pi-input-wrap">
      {prefix && <span className="pi-input-prefix">{prefix}</span>}
      <input
        type={type}
        className={`pi-input ${prefix ? "pi-input--prefix" : ""} ${suffix ? "pi-input--suffix" : ""} ${(error && touched) ? "pi-input--error" : ""}`}
        placeholder={placeholder}
        value={value}
        maxLength={maxLength}
        onChange={e => onChange(e.target.value)}
        onWheel={type === "number" ? e => e.target.blur() : undefined}
      />
      {suffix && <span className="pi-input-suffix">{suffix}</span>}
    </div>
    {helperText && !error && <p className="pi-helper-text">{helperText}</p>}
    {error && touched && <p className="pi-error-text pi-error-anim">{error}</p>}
    {maxLength && (
      <p className="pi-char-count">{value.length}/{maxLength}</p>
    )}
  </div>
);

const FormSelect = ({ label, required, value, onChange, options, placeholder, helperText, disabled, error, touched }) => (
  <div className="pi-field">
    <label className="pi-label">
      {label}
      {required && <span className="pi-required"> *</span>}
    </label>
    <div className={`pi-select-wrap ${disabled ? "pi-select-wrap--disabled" : ""} ${(error && touched) ? "pi-select-wrap--error" : ""}`}>
      <select
        className="pi-select"
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(opt => (
          <option key={opt.value ?? opt} value={opt.value ?? opt}>
            {opt.label ?? opt}
          </option>
        ))}
      </select>
      <span className="pi-select-arrow"><ChevronDownIcon size={15} /></span>
    </div>
    {helperText && <p className="pi-helper-text">{helperText}</p>}
    {error && touched && <p className="pi-error-text pi-error-anim">{error}</p>}
  </div>
);

const ToggleSwitch = ({ label, checked, onChange, description }) => (
  <div className="pi-toggle-field">
    <div className="pi-toggle-top">
      <div className="pi-toggle-info">
        <span className="pi-toggle-label">{label}</span>
        {description && <span className="pi-toggle-desc">{description}</span>}
      </div>
      <button
        type="button"
        className={`pi-toggle-switch ${checked ? "pi-toggle-switch--on" : ""}`}
        onClick={() => onChange(!checked)}
        aria-pressed={checked}
      >
        <span className="pi-toggle-thumb" />
      </button>
    </div>
  </div>
);

/* ─────────────────────────────────────────
   DISCOUNT TYPE TOGGLE (% / ₹)
───────────────────────────────────────── */
const DiscountTypeToggle = ({ type, onChange }) => (
  <div className="pi-discount-type">
    <button
      type="button"
      className={`pi-dtype-btn ${type === "percent" ? "pi-dtype-btn--active" : ""}`}
      onClick={() => onChange("percent")}
    >%</button>
    <button
      type="button"
      className={`pi-dtype-btn ${type === "flat" ? "pi-dtype-btn--active" : ""}`}
      onClick={() => onChange("flat")}
    >₹</button>
  </div>
);

/* Prefill Helpers for COD and Returns */
const prefillReturn = (val) => {
  if (!val) return "return";
  const normalized = String(val).toLowerCase();
  if (normalized.includes("easy return") || normalized === "return") return "return";
  if (normalized.includes("no return") || normalized === "no_return") return "no_return";
  if (normalized.includes("exchange") && !normalized.includes("return")) return "exchange";
  if (normalized.includes("return or exchange") || normalized === "return_or_exchange") return "return_or_exchange";
  return "return";
};

const CODLikeMatch = (val) => {
  if (val === true) return true;
  if (val === false || val === undefined || val === null) return false;
  const normalized = String(val).toLowerCase().trim();
  if (!normalized) return false;
  const CODIndicators = ["yes", "true", "1", "cod", "cash on delivery", "cash on delivery available", "delivery available"];
  return CODIndicators.some(ind => normalized === ind || normalized.includes(ind));
};

const prefillCOD = (val) => {
  if (val === undefined || val === null || val === "") return "yes";
  return CODLikeMatch(val) ? "yes" : "no";
};

/* ─────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────── */
const ProductInfo = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { category: rawCategory, subcategory: rawSubcategory, isEditMode, isDuplicateMode, editData: rawEditData, tableId, origin, email } = location.state || {};

  const editData = useMemo(() => {
    if (!rawEditData) return null;
    const copied = { ...rawEditData };
    if (typeof copied.productOptions === "string" && copied.productOptions.trim() !== "") {
      try {
        copied.productOptions = JSON.parse(copied.productOptions);
      } catch (e) {
        console.error("Failed to parse productOptions:", e);
      }
    }
    if (typeof copied.varientPrice === "string" && copied.varientPrice.trim() !== "") {
      try {
        copied.varientPrice = JSON.parse(copied.varientPrice);
      } catch (e) {
        console.error("Failed to parse varientPrice:", e);
      }
    }
    if (typeof copied.specifications === "string" && copied.specifications.trim() !== "") {
      try {
        copied.specifications = JSON.parse(copied.specifications);
      } catch (e) {
        console.error("Failed to parse specifications:", e);
      }
    }
    return copied;
  }, [rawEditData]);

 const category = rawCategory || (editData ? {
    name: editData.categoryName?.[0] || editData.mainCategory || "",
    _id: editData.categoryId?.[0] || "",
    CategoryID: editData.categoryId?.[0] || "",
  } : null);

  const subcategory = rawSubcategory || (editData ? {
    name: editData.subCategory || "",
    _id: editData.subCategoryId || editData.SubCategoryID || editData.subcategoryId || "",
    subcategoryId: editData.subCategoryId || editData.SubCategoryID || editData.subcategoryId || "",
    SubCategoryID: editData.SubCategoryID || "",
  } : null);
  
  // uses top-level resolveWixImage

  const prefillImages = location.state?.images
    ? location.state.images.map(img => ({
        ...img,
        status: img.status || "success",
        preview: img.preview || img.mediaUrl,
      }))
    : (isEditMode || isDuplicateMode) && editData
      ? (() => {
          const seen = new Set();
          const result = [];

          // Main image
          if (editData.mainmedia) {
            const resolved = resolveWixImage(editData.mainmedia);
            if (resolved && !seen.has(resolved)) {
              seen.add(resolved);
              seen.add(editData.mainmedia);
              result.push({ preview: resolved, mediaUrl: resolved, url: resolved, status: "success" });
            }
          }

          // Additional product images (mediaItems or productImages)
          const extraImages = editData.mediaItems || editData.productImages || [];
          if (Array.isArray(extraImages)) {
            for (const img of extraImages) {
              const raw = typeof img === "string" ? img : img?.src || img?.url || img?.mediaUrl || img?.image || null;
              if (!raw) continue;
              let resolved = null;
              if (raw.startsWith("http")) {
                resolved = raw;
              } else if (raw.startsWith("wix:image://")) {
                resolved = resolveWixImage(raw);
              }
              if (!resolved) continue;
              if (seen.has(resolved) || seen.has(raw)) continue;
              seen.add(resolved);
              seen.add(raw);
              result.push({
                preview: resolved,
                mediaUrl: resolved,
                url: resolved,
                status: "success",
                wixSrc: raw.startsWith("wix:image://") ? raw : null,
                wixResponse: typeof img === "object" ? img : null,
              });
            }
          }

          return result;
        })()
      : [];

  const resolveDiscount = (d, basePrice) => {
    if (!d?.type || d.value == null) return { onSale: false, discountPercent: "", salePrice: "" };
    const price = parseFloat(basePrice) || 0;
    if (d.type === "PERCENTAGE") {
      const sale = price > 0 ? (price - (price * d.value) / 100).toFixed(2) : "";
      return { onSale: true, discountPercent: String(d.value), salePrice: sale };
    }
    if (d.type === "AMOUNT") {
      const sale = price > 0 ? Math.max(price - d.value, 0).toFixed(2) : "";
      return { onSale: true, discountPercent: String(d.value), salePrice: sale };
    }
    return { onSale: false, discountPercent: "", salePrice: "" };
  };

  const discountPrefill = (isEditMode || isDuplicateMode) && editData ? resolveDiscount(editData.discount, editData.price) : {};
  const [images, setImages] = useState(prefillImages);
  const [discountType, setDiscountType] = useState(
    location.state?.discountType ||
    (((isEditMode || isDuplicateMode) && editData?.discount?.type === "AMOUNT") ? "flat" : "percent")
  );
  
  const prefill = (isEditMode || isDuplicateMode) && !location.state?.formData;
  const hasNavState = !!location.state?.formData;
  
  // FIX: Ensure brand is resolved correctly from editData on initial mount
  const initialBrand = hasNavState ? (location.state.formData.brand ?? "") : (prefill ? (editData?.brand ?? "") : (location.state?.formData?.brand ?? ""));

  const [formData, setFormData] = useState({
    productName:     hasNavState ? (location.state.formData.productName     ?? "") : (prefill ? (editData?.name            ?? "") : ""),
    sku:             hasNavState ? (location.state.formData.sku             ?? "") : (prefill ? (editData?.skuCode || editData?.sku_code || editData?.sku || editData?.SKU || editData?.Sku || "") : ""),
    brand:           initialBrand,
    price:           hasNavState ? (location.state.formData.price           ?? "") : (prefill ? (editData?.price            ?? "") : ""),
    onSale:          hasNavState ? (location.state.formData.onSale          ?? false) : (prefill ? (discountPrefill.onSale     ?? false) : false),
    discountPercent: hasNavState ? (location.state.formData.discountPercent ?? "") : (prefill ? (discountPrefill.discountPercent ?? "") : ""),
    salePrice:       hasNavState ? (location.state.formData.salePrice       ?? "") : (prefill ? (discountPrefill.salePrice  ?? "") : ""),
    shippingWeight:  hasNavState ? (location.state.formData.shippingWeight  ?? "") : (prefill ? (editData?.shippingWeight   ?? "") : ""),
    availableStock:  hasNavState ? (location.state.formData.availableStock  ?? "") : (prefill ? (String(editData?.inventory ?? editData?.stock ?? editData?.totalQuantity ?? "")) : ""),
    acceptCOD:       hasNavState ? (location.state.formData.acceptCOD       ?? "yes") : (prefill ? prefillCOD(editData?.paymentType) : "yes"),
    productReturn:   hasNavState ? (location.state.formData.productReturn   ?? "return") : (prefill ? prefillReturn(editData?.productReturn) : "return"),
    deliveryCharge:  hasNavState ? (location.state.formData.deliveryCharge  ?? "no") : (prefill ? (editData?.deliveryCharges  ? "yes" : "no") : "no"),
    resellingProfit: hasNavState ? (location.state.formData.resellingProfit  ?? "") : (prefill ? (editData?.resellingProfit || editData?.sellAndEarnCommission || editData?.reselling_profit || editData?.sell_and_earn_commission || "") : ""),
  });

  useEffect(() => {
    if ((isEditMode || isDuplicateMode) && editData) {
      if (!location.state?.formData) {
        const discountPrefill = resolveDiscount(editData.discount, editData.price);
        setFormData({
          productName:     editData?.name            ?? "",
          sku:             editData?.skuCode || editData?.sku_code || editData?.sku || editData?.SKU || editData?.Sku || "",
          brand:           editData?.brand ?? "",
          price:           editData?.price            ?? "",
          onSale:          discountPrefill.onSale     ?? false,
          discountPercent: discountPrefill.discountPercent ?? "",
          salePrice:       discountPrefill.salePrice  ?? "",
          shippingWeight:  editData?.shippingWeight   ?? "",
          availableStock:  String(editData?.inventory ?? editData?.stock ?? editData?.totalQuantity ?? ""),
          acceptCOD:       prefillCOD(editData?.paymentType),
          productReturn:   prefillReturn(editData?.productReturn),
          deliveryCharge:  editData?.deliveryCharges  ? "yes" : "no",
          resellingProfit: editData?.resellingProfit || editData?.sellAndEarnCommission || editData?.reselling_profit || editData?.sell_and_earn_commission || "",
        });
        setDiscountType((editData?.discount?.type === "AMOUNT") ? "flat" : "percent");
      }
      if (!location.state?.images) {
        const seen = new Set();
        const result = [];
        if (editData.mainmedia) {
          const resolved = resolveWixImage(editData.mainmedia);
          if (resolved && !seen.has(resolved)) {
            seen.add(resolved);
            seen.add(editData.mainmedia);
            result.push({ preview: resolved, mediaUrl: resolved, url: resolved, status: "success" });
          }
        }
        const extraImages = editData.mediaItems || editData.productImages || [];
        if (Array.isArray(extraImages)) {
          for (const img of extraImages) {
            const raw = typeof img === "string" ? img : img?.src || img?.url || img?.mediaUrl || img?.image || null;
            if (!raw) continue;
            let resolved = null;
            if (raw.startsWith("http")) {
              resolved = raw;
            } else if (raw.startsWith("wix:image://")) {
              resolved = resolveWixImage(raw);
            }
            if (!resolved) continue;
            if (seen.has(resolved) || seen.has(raw)) continue;
            seen.add(resolved);
            seen.add(raw);
            result.push({
              preview: resolved,
              mediaUrl: resolved,
              url: resolved,
              status: "success",
              wixSrc: raw.startsWith("wix:image://") ? raw : null,
              wixResponse: typeof img === "object" ? img : null,
            });
          }
        }
        setImages(result);
      }
    }
  }, [editData, isEditMode, isDuplicateMode, location.state?.formData, location.state?.images]);

  const [resellerError, setResellerError] = useState("");
  const [stockError, setStockError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const [fields, setFields] = useState([]);

  useEffect(() => {
    const subcategoryId = (isEditMode || isDuplicateMode)
      ? (editData?.subCategoryId || editData?.SubCategoryID || editData?.subcategoryId || resolveSubcategoryId(subcategory, category))
      : resolveSubcategoryId(subcategory, category);

    if (!subcategoryId) return;

    (async () => {
      try {
        const sorted = await fetchCategoryFields(subcategoryId);
        const overridden = sorted.map(f => {
          const t = (f.title || "").toLowerCase().trim();
          if (f.type === "Product Options" && (t === "size" || t === "sizes")) {
            return { ...f, required: false };
          }
          return f;
        });
        setFields(overridden);
      } catch (err) {
        console.error("[ProductInfo] fetchCategoryFields error:", err);
      }
    })();
  }, [subcategory, category, isEditMode, editData]);

  // For Live Preview data persistence
  const previewSpecs = location.state?.specifications || (() => {
    if ((isEditMode || isDuplicateMode) && editData) {
      const merged = {};
      if (Array.isArray(editData.additionalInfoSections)) {
        editData.additionalInfoSections.forEach(section => {
          Object.entries(section).forEach(([k, v]) => {
            if (k !== "title" && k !== "description" && v != null && v !== "") {
              merged[k] = v;
            }
          });
        });
      }
      // Pull options like Size
      const rawOptions = editData.productOptions;
      const optionsArray = Array.isArray(rawOptions)
        ? rawOptions
        : rawOptions && typeof rawOptions === "object"
          ? Object.entries(rawOptions).map(([key, opt]) => ({
              name: opt?.name || key,
              choices: opt?.choices || [],
            }))
          : [];

      optionsArray.forEach(opt => {
        const optName = (opt.name || opt.optionType || "").trim();
        if (!optName) return;
        const choices = opt.choices || opt.values || opt.options || [];
        const selectedValues = choices
          .map(c => (typeof c === "object" ? (c.description || c.value || c.name || "") : String(c)))
          .filter(Boolean);
        if (selectedValues.length === 0) return;
        const storeValue = selectedValues.length === 1 ? selectedValues[0] : selectedValues;
        merged[optName] = storeValue;
      });
      return merged;
    }
    return {};
  })();

  const previewConfirmedColors = location.state?.confirmedColors || (() => {
    if ((isEditMode || isDuplicateMode) && editData?.productOptions) {
      const rawOpts = editData.productOptions;
      const optsArray = Array.isArray(rawOpts)
        ? rawOpts
        : rawOpts && typeof rawOpts === "object"
          ? Object.entries(rawOpts).map(([key, opt]) => ({
              name: opt?.name || key,
              choices: opt?.choices || [],
            }))
          : [];
      const colorOpt = optsArray.find(o => (o.name || "").toLowerCase() === "color" || (o.name || "").toLowerCase() === "colour");
      if (colorOpt && Array.isArray(colorOpt.choices)) {
        return colorOpt.choices.map(c => ({
          name: c.description || c.value || "",
          hex: c.value || "#000000",
        })).filter(c => c.name);
      }
    }
    return [];
  })();

  const previewColourImages = location.state?.colourImages || (() => {
    if ((isEditMode || isDuplicateMode) && editData?.productOptions) {
      const rawOpts = editData.productOptions;
      const optsArray = Array.isArray(rawOpts)
        ? rawOpts
        : rawOpts && typeof rawOpts === "object"
          ? Object.entries(rawOpts).map(([key, opt]) => ({
              name: opt?.name || key,
              choices: opt?.choices || [],
            }))
          : [];
      const colorOpt = optsArray.find(o => (o.name || "").toLowerCase() === "color" || (o.name || "").toLowerCase() === "colour");
      if (colorOpt && Array.isArray(colorOpt.choices)) {
        const mappings = {};
        colorOpt.choices.forEach(c => {
          const colorName = c.description || c.value || "";
          if (colorName && Array.isArray(c.mediaItems)) {
            mappings[colorName] = c.mediaItems.map(m => m.src || m.url || "").filter(Boolean);
          }
        });
        return mappings;
      }
    }
    return {};
  })();

  const previewVariantPrices = location.state?.variantPrices || (() => {
    if ((isEditMode || isDuplicateMode) && editData && editData.varientPrice?.products) {
      const prices = {};
      const base = parseFloat(editData.price) || 0;
      const effectiveBasePrice = discountPrefill.onSale && discountPrefill.salePrice
        ? parseFloat(discountPrefill.salePrice) || base
        : base;
      const products = editData.varientPrice.products || [];
      products.forEach(p => {
        const info = p.variantInfo?.[0];
        if (!info) return;
        // Skip variants the seller never actually entered a price for —
        // otherwise every default-saved variant shows as "filled" in preview.
        if (info.priceModified !== true) return;
        const choices = info.choices || {};
        const price = parseFloat(info.price) || 0;
        const color = choices["Color"] || choices["Colour"] || null;
        const optionField = Object.keys(choices).find(k => k !== "Color" && k !== "Colour");
        const optionLabel = optionField ? choices[optionField] : null;

        let key = "";
        if (color && optionField && optionLabel) {
          key = `${color}__${optionField}__${optionLabel}`;
        } else if (color) {
          key = color;
        } else if (optionField && optionLabel) {
          key = `${optionField}__${optionLabel}`;
        }

        if (key) {
          const diff = price - effectiveBasePrice;
          const op = diff >= 0 ? "+" : "-";
          const inputVal = String(Math.abs(diff));
          prices[key] = {
            op,
            inputVal,
            appliedDiff: diff,
          };
        }
      });
      return prices;
    }
    return {};
  })();

  const previewPromotionImage = (() => {
    if (location.state?.promotionImage !== undefined) {
      const val = location.state.promotionImage;
      if (Array.isArray(val)) return val;
      return val ? [val] : [];
    }
    if ((isEditMode || isDuplicateMode) && editData) {
      const photos = editData.promotionPhotos;
      if (Array.isArray(photos) && photos.length > 0) {
        return photos.map((p, idx) => {
          const url = typeof p === "string" ? p : p?.url || p?.src || null;
          return url ? { url: resolveWixImage(url) || url, name: `promotion-image-${idx + 1}`, size: 0 } : null;
        }).filter(Boolean);
      }
    }
    return [];
  })();

  const previewKeywords = (() => {
    if (Array.isArray(location.state?.keywords)) return location.state.keywords;
    if ((isEditMode || isDuplicateMode) && editData?.search_keywords) {
      const kw = editData.search_keywords;
      if (Array.isArray(kw)) return kw.map(k => String(k)).filter(Boolean);
      if (typeof kw === "string") return kw.split(",").map(k => k.trim()).filter(Boolean);
    }
    return [];
  })();

  const previewOptionFields = fields.filter(f => {
    if (f.type !== "Product Options") return false;
    const name = (f.title || f.fieldId || "").toLowerCase().trim();
    return name !== "color" && name !== "colour";
  });
  const previewVariants = (() => {
    if (location.state?.variants) return location.state.variants;

    const optionSelections = previewOptionFields.map(f => {
      const key = f.fieldId || f.title;
      const v = previewSpecs[key];
      const selected = Array.isArray(v) ? v : (v ? [v] : []);
      return { fieldTitle: f.title, selected };
    }).filter(x => x.selected.length > 0);

    const optionCombos = optionSelections.flatMap(({ fieldTitle, selected }) =>
      selected.map(label => ({ optionField: fieldTitle, optionLabel: label }))
    );

    if (previewConfirmedColors.length > 0) {
      if (optionCombos.length > 0) {
        return previewConfirmedColors.flatMap(col =>
          optionCombos.map(opt => ({
            color: col.name,
            optionField: opt.optionField,
            optionLabel: opt.optionLabel,
            key: `${col.name}__${opt.optionField}__${opt.optionLabel}`,
          }))
        );
      } else {
        return previewConfirmedColors.map(col => ({
          color: col.name,
          optionField: null,
          optionLabel: null,
          key: col.name,
        }));
      }
    }

    return optionCombos.map(opt => ({
      color: null,
      optionField: opt.optionField,
      optionLabel: opt.optionLabel,
      key: `${opt.optionField}__${opt.optionLabel}`,
    }));
  })();

  const prevOnSale = useRef(false);

  useEffect(() => { window.scrollTo({ top: 0, behavior: "smooth" }); }, []);

  useEffect(() => {
    if (formData.productReturn !== "no_return" && formData.deliveryCharge === "yes") {
      setFormData(prev => ({ ...prev, deliveryCharge: "no" }));
    }
  }, [formData.productReturn]);

  useEffect(() => {
    if (prevOnSale.current && !formData.onSale) {
      setFormData(prev => ({ ...prev, discountPercent: "", salePrice: "" }));
    }
    prevOnSale.current = formData.onSale;
  }, [formData.onSale]);

  const updateField = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    setTouched(prev => ({ ...prev, [key]: true }));
    if (fieldErrors[key]) {
      setFieldErrors(prev => ({ ...prev, [key]: "" }));
    }
  };

  const handlePriceChange = (val) => {
    const basePrice = parseFloat(val);
    setFormData(prev => {
      let updatedSalePrice = prev.salePrice;
      if (prev.onSale && !isNaN(basePrice) && basePrice > 0 && prev.discountPercent) {
        const discVal = parseFloat(prev.discountPercent);
        if (!isNaN(discVal)) {
          if (discountType === "percent") {
            updatedSalePrice = (basePrice - (basePrice * discVal) / 100).toFixed(2);
          } else {
            updatedSalePrice = Math.max(basePrice - discVal, 0).toFixed(2);
          }
        }
      }
      return {
        ...prev,
        price: val,
        salePrice: updatedSalePrice,
      };
    });
    setTouched(prev => ({ ...prev, price: true }));
    if (fieldErrors.price) {
      setFieldErrors(prev => ({ ...prev, price: "" }));
    }
  };

  const handleDiscountChange = (val) => {
    const cleaned = val.replace(/[^0-9.]/g, "");
    const basePrice = parseFloat(formData.price);
    let sale = "";

    if (discountType === "percent") {
      const num = parseFloat(cleaned);
      const clamped = isNaN(num) ? "" : Math.min(num, 99).toString();
      if (!isNaN(parseFloat(clamped)) && !isNaN(basePrice) && basePrice > 0) {
        sale = (basePrice - (basePrice * parseFloat(clamped)) / 100).toFixed(2);
      }
      setFormData(prev => ({ ...prev, discountPercent: clamped, salePrice: sale }));
    } else {
      const num = parseFloat(cleaned);
      if (!isNaN(num) && !isNaN(basePrice) && basePrice > 0) {
        sale = Math.max(basePrice - num, 0).toFixed(2);
      }
      setFormData(prev => ({ ...prev, discountPercent: cleaned, salePrice: sale }));
    }
  };

  const handleSalePriceChange = (val) => {
    const cleaned = val.replace(/[^0-9.]/g, "");
    const basePrice = parseFloat(formData.price);
    let pct = "";
    if (!isNaN(parseFloat(cleaned)) && !isNaN(basePrice) && basePrice > 0) {
      if (discountType === "percent") {
        const disc = ((basePrice - parseFloat(cleaned)) / basePrice) * 100;
        pct = Math.min(Math.max(disc, 0), 99).toFixed(2);
      } else {
        pct = Math.max(basePrice - parseFloat(cleaned), 0).toFixed(2);
      }
    }
    setFormData(prev => ({ ...prev, salePrice: cleaned, discountPercent: pct }));
  };

  const handleStockChange = (val) => {
    const cleaned = val.replace(/[^0-9]/g, "");
    const num = parseInt(cleaned, 10);
    if (!isNaN(num) && num > 0 && num < 5) {
      setStockError("Minimum 5 stock quantity is required");
    } else {
      setStockError("");
    }
    updateField("availableStock", cleaned);
  };

  const handleResellerChange = (val) => {
    const cleaned = val.replace(/[^0-9.]/g, "");
    const baseForCalc = formData.onSale && formData.salePrice
      ? parseFloat(formData.salePrice)
      : parseFloat(formData.price);
    const maxProfit = isNaN(baseForCalc) ? Infinity : baseForCalc * 0.3;
    const num = parseFloat(cleaned);
    if (!isNaN(num) && num > maxProfit) {
      setResellerError(`Max reseller profit is ₹${maxProfit.toFixed(2)} (30% of ${formData.onSale && formData.salePrice ? "sale" : "regular"} price)`);
    } else {
      setResellerError("");
    }
    updateField("resellingProfit", cleaned);
  };

  const handleImageUpload = (img) => {
    if (images.length >= 10) return;
    setImages(prev => {
      const idx = prev.findIndex(
        (p) => p.file === img.file && p.status === "uploading"
      );
      if (idx !== -1) {
        const next = [...prev];
        next[idx] = img;
        return next;
      }
      if (prev.length >= 10) return prev;
      return [...prev, img];
    });
  };

  const handleImageRemove = (idx) => {
    setImages(prev => {
      const removed = prev[idx];
      if (removed?.preview && removed.preview.startsWith("blob:")) {
        URL.revokeObjectURL(removed.preview);
      }
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleBack = () => {
    navigate("/dashboard/listing/select-category", {
      state: {
        category,
        subcategory,
        isEditMode,
        isDuplicateMode,
        editData,
        tableId,
        origin,
        formData,
        images,
        specifications: location.state?.specifications || null,
        colourImages: location.state?.colourImages || null,
        confirmedColors: location.state?.confirmedColors || null,
        variantPrices: location.state?.variantPrices || null,
        promotionImage: location.state?.promotionImage || null,
        keywords: location.state?.keywords || null,
        discountType,
        email: email || location.state?.email,
      },
    });
  };

  const validate = () => {
    const errors = {};
    if (!formData.productName.trim()) errors.productName = "Please enter Product Name";
    if (!formData.brand) errors.brand = "Please select Brand";
    if (!formData.price) errors.price = "Please add Price";
    if (!formData.availableStock) errors.availableStock = "Please enter Available Stock";
    if (!formData.shippingWeight) errors.shippingWeight = "Please enter Shipping Weight";

    const successImages = images.filter(img => img.status === "success");
    const uploadingImages = images.filter(img => img.status === "uploading");

    if (uploadingImages.length > 0) {
      errors.images = "Please wait for all images to finish uploading";
    } else if (successImages.length < 2) {
      errors.images = "Please upload at least 2 product images.";
    }

    return errors;
  };

  const handleContinue = () => {
    setSubmitAttempted(true);
    
    // ── FIX: Safety shield to block early submission when sizechart uploads are pending ──
    const incomingSpecs = location.state?.specifications || editData?.additionalInfoSections || {};
    const sizeChartValue = incomingSpecs?.sizeChart || editData?.sizeChart;
    const isChartPending = sizeChartValue === "__PENDING_FILE__" || 
                          (sizeChartValue && typeof sizeChartValue === "object" && sizeChartValue.url === "__PENDING_FILE__");

    if (isChartPending) {
      alert("Your size chart file is still processing. Please give it a brief moment to finish uploading before continuing!");
      return; 
    }

    const errors = validate();
    if (Object.keys(errors).length > 0 || stockError || resellerError) {
      setFieldErrors(errors);
      setTouched({
        productName: true,
        brand: true,
        price: true,
        availableStock: true,
      });
      const firstErrorEl = document.querySelector(".pi-input--error, .pi-select-wrap--error");
      if (firstErrorEl) firstErrorEl.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    const uploadedProductImages = images
      .filter(img => img.status === "success")
      .map(img => img.mediaUrl);
    console.log("Uploaded Product Images:", uploadedProductImages);

    const uploadedImages = images
      .filter(img => img.status === "success")
      .map(img => ({
        preview: img.mediaUrl,
        mediaUrl: img.mediaUrl,
        file: img.file,
        wixResponse: img.wixResponse,
      }));

    navigate(
      isEditMode && !isDuplicateMode
        ? `/dashboard/listing/edit/${tableId}/product-info/specifications`
        : "/dashboard/listing/select-category/product-info/specifications",
      {
        state: {
          category: category || { name: editData?.categoryName?.[0] || editData?.mainCategory, _id: editData?.categoryId?.[0] },
          subcategory: subcategory || {
            name: editData?.subCategory,
            _id:            editData?.subCategoryId || editData?.SubCategoryID || editData?.subcategoryId,
            subcategoryId:  editData?.subCategoryId || editData?.SubCategoryID || editData?.subcategoryId,
            SubCategoryID:  editData?.SubCategoryID,
          },
          formData,
          images: uploadedImages,
          isEditMode: isEditMode && !isDuplicateMode,
          isDuplicateMode,
          editData,
          tableId: isDuplicateMode ? null : tableId,
          origin,
          email: email || location.state?.email,
          specifications: hasNavState ? (location.state.specifications || null) : (previewSpecs || null),
          colourImages: hasNavState ? (location.state.colourImages || null) : (previewColourImages || null),
          confirmedColors: hasNavState ? (location.state.confirmedColors || null) : (previewConfirmedColors || null),
          variantPrices: hasNavState ? (location.state.variantPrices || null) : (previewVariantPrices || null),
          promotionImage: hasNavState ? (location.state.promotionImage || null) : (previewPromotionImage || null),
          keywords: hasNavState ? (location.state.keywords || null) : (previewKeywords || null),
          discountType,
        },
      }
    );
  };

  const successImages = images.filter(img => img.status === "success");
  const uploadingImages = images.filter(img => img.status === "uploading");

  const availableDeliveryOptions = formData.productReturn === "no_return"
    ? DELIVERY_OPTIONS
    : DELIVERY_OPTIONS.filter(o => o.value === "no");

  const discountLabel = discountType === "percent" ? "Discount (%)" : "Discount (₹)";
  const discountPlaceholder = discountType === "percent" ? "e.g. 20" : "e.g. 50";
  const discountHelper = discountType === "percent"
    ? "Enter % to auto-calculate sale price"
    : "Enter flat ₹ amount to auto-calculate sale price";

  const isCustomBrand = formData.brand !== "" && !BRAND_OPTIONS.includes(formData.brand);

  return (
    <div className="pi-root">
      <BackButton label="Back to Categories" onClick={handleBack} />

      <PageHeader
        title="Product Information"
        subtitle="Fill in the details about your product"
        currentStep={STEP.PRODUCT_INFO}
      />

      {category && subcategory && (
        <div className="pi-category-display">
          <span className="pi-category-path">{category.name} › {subcategory.name}</span>
        </div>
      )}

      <div className="lp-main-layout">
        <div className="lp-form-side">
          <div className="pi-master-card">
        <div className="pi-card-section">
          <ImageUploadSection images={images} onUpload={handleImageUpload} onRemove={handleImageRemove} />
          {fieldErrors.images && submitAttempted && (
            <p className="pi-error-text pi-error-anim" style={{ marginTop: 8 }}>{fieldErrors.images}</p>
          )}
        </div>

        <div className="pi-card-divider" />

        <div className="pi-card-section">
          <div className="pi-section-header">
            <TagIcon />
            <h3 className="pi-section-title">Product Details</h3>
          </div>

          <div className="pi-form-grid">
            <FormInput
              label="Product Name" required
              placeholder="Enter product name"
              value={formData.productName}
              onChange={(v) => updateField("productName", cleanTextInput(v))}
              error={fieldErrors.productName}
              touched={touched.productName || submitAttempted}
            />
            <FormInput
              label="SKU"
              placeholder="Enter SKU code (optional)"
              value={formData.sku}
              maxLength={40}
              onChange={(v) => updateField("sku", cleanTextInput(v))}
            />
            <FormSelect
              label="Brand" required
              value={isCustomBrand ? "Other" : formData.brand}
              onChange={(v) => {
                if (v === "Other") updateField("brand", "Other");
                else updateField("brand", v);
              }}
              options={BRAND_OPTIONS}
              placeholder="Select brand"
              error={fieldErrors.brand}
              touched={touched.brand || submitAttempted}
            />
            {(formData.brand === "Other" || isCustomBrand) && (
              <FormInput
                label="Brand Name"
                required
                placeholder="Brand name"
                value={formData.brand === "Other" ? "" : formData.brand}
                onChange={(v) => updateField("brand", cleanTextInput(v) || "Other")}
                error={fieldErrors.brand}
                touched={touched.brand || submitAttempted}
              />
            )}
            <FormInput
              label="Price" required
              placeholder="0.00" type="number" prefix="₹"
              value={formData.price}
              onChange={handlePriceChange}
              error={fieldErrors.price}
              touched={touched.price || submitAttempted}
            />
          </div>

          <div className="pi-sale-toggle-wrap">
            <ToggleSwitch
              label="On Sale"
              checked={formData.onSale}
              onChange={(v) => updateField("onSale", v)}
              description="Enable to mark this product as discounted"
            />
          </div>

          <div className={`pi-sale-fields ${formData.onSale ? "pi-sale-fields--visible" : ""}`}>
            <div className="pi-sale-note">
              <InfoIcon />
              <span>{discountType === "percent" ? "Max discount allowed is 99%" : "Enter flat ₹ discount amount"}</span>
            </div>
            <div className="pi-form-grid pi-form-grid--sale">
              <div className="pi-field">
                <label className="pi-label" style={{ minHeight: "28px" }}>
                  {discountLabel}
                  <div className="pi-label-toggle">
                    <DiscountTypeToggle type={discountType} onChange={(t) => {
                      setDiscountType(t);
                      setFormData(prev => ({ ...prev, discountPercent: "", salePrice: "" }));
                    }} />
                  </div>
                </label>
                <div className="pi-input-wrap">
                  {discountType === "flat" && <span className="pi-input-prefix">₹</span>}
                  <input
                    type="number"
                    className={`pi-input ${discountType === "flat" ? "pi-input--prefix" : ""} ${discountType === "percent" ? "pi-input--suffix" : ""}`}
                    placeholder={discountPlaceholder}
                    value={formData.discountPercent}
                    onChange={e => handleDiscountChange(e.target.value)}
                    onWheel={e => e.target.blur()}
                  />
                  {discountType === "percent" && <span className="pi-input-suffix">%</span>}
                </div>
                <p className="pi-helper-text">{discountHelper}</p>
              </div>

              <div className="pi-field">
                <label className="pi-label" style={{ minHeight: "28px" }}>
                  On Sale Price
                </label>
                <div className="pi-input-wrap">
                  <span className="pi-input-prefix">₹</span>
                  <input
                    type="number"
                    className="pi-input pi-input--prefix"
                    placeholder="0.00"
                    value={formData.salePrice}
                    onChange={e => handleSalePriceChange(e.target.value)}
                    onWheel={e => e.target.blur()}
                  />
                </div>
                <p className="pi-helper-text">Or enter price to auto-calculate discount</p>
              </div>
            </div>
          </div>

          <div className="pi-form-grid pi-form-grid--lower">
            <FormInput
              label="Shipping Weight (in Grm)"
              required
              placeholder="Enter weight in grams"
              value={formData.shippingWeight}
              onChange={(v) => updateField("shippingWeight", v)}
              error={fieldErrors.shippingWeight}
              touched={touched.shippingWeight || submitAttempted}
            />
            <div className="pi-field">
              <label className="pi-label">
                Available Stock <span className="pi-required"> *</span>
                <span className="pi-label-hint">&nbsp;(Min 5)</span>
              </label>
              <div className="pi-input-wrap">
                <input
                  type="number"
                  className={`pi-input ${(stockError || (fieldErrors.availableStock && (touched.availableStock || submitAttempted))) ? "pi-input--error" : ""}`}
                  placeholder="Enter quantity"
                  value={formData.availableStock}
                  onChange={e => handleStockChange(e.target.value)}
                  onWheel={e => e.target.blur()}
                  min="5"
                />
              </div>
              {stockError && <p className="pi-error-text pi-error-anim">{stockError}</p>}
              {!stockError && fieldErrors.availableStock && (touched.availableStock || submitAttempted) && (
                <p className="pi-error-text pi-error-anim">{fieldErrors.availableStock}</p>
              )}
            </div>
          </div>
        </div>

        <div className="pi-card-divider" />

        <div className="pi-card-section">
          <div className="pi-section-header">
            <ShippingIcon />
            <h3 className="pi-section-title">Shipping &amp; Policies</h3>
          </div>

          <div className="pi-form-grid pi-form-grid--three">
            <FormSelect
              label="Accept COD" required
              value={formData.acceptCOD}
              onChange={(v) => updateField("acceptCOD", v)}
              options={COD_OPTIONS}
            />
            <FormSelect
              label="Product Return / Exchange" required
              value={formData.productReturn}
              onChange={(v) => updateField("productReturn", v)}
              options={RETURN_OPTIONS}
            />
            <div className="pi-field">
              <label className="pi-label">
                Is Delivery Charge Applicable<span className="pi-required"> *</span>
              </label>
              <div className={`pi-select-wrap ${formData.productReturn !== "no_return" ? "pi-select-wrap--disabled" : ""}`}>
                <select
                  className="pi-select"
                  value={formData.deliveryCharge}
                  onChange={e => updateField("deliveryCharge", e.target.value)}
                  disabled={formData.productReturn !== "no_return"}
                >
                  {availableDeliveryOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <span className="pi-select-arrow"><ChevronDownIcon size={15} /></span>
              </div>
              {formData.productReturn !== "no_return" && (
                <p className="pi-helper-text">Automatically set to "No" unless "No Return" is selected</p>
              )}
            </div>
          </div>
        </div>

        <div className="pi-card-divider" />

        <div className="pi-card-section">
          <div className="pi-section-header">
            <ResellerIcon />
            <h3 className="pi-section-title">Reselling</h3>
          </div>

          <div className="pi-form-grid">
            <FormInput
              label="Reselling Profit"
              placeholder="0.00" prefix="₹" type="number"
              value={formData.resellingProfit}
              onChange={handleResellerChange}
              helperText="Resellers earn this per sale"
              error={resellerError}
              touched={!!resellerError}
            />
          </div>
        </div>
        </div>
        </div>
        <div className="lp-preview-side">
          <LivePreview
            category={category}
            subcategory={subcategory}
            formData={formData}
            images={images}
            specifications={previewSpecs}
            confirmedColors={previewConfirmedColors}
            colourImages={previewColourImages}
            variantPrices={previewVariantPrices}
            promotionImage={previewPromotionImage}
            keywords={previewKeywords}
            fields={fields}
            variants={previewVariants}
          />
        </div>
      </div>

      <div className="lp-preview-mobile">
        <LivePreview
          category={category}
          subcategory={subcategory}
          formData={formData}
          images={images}
          specifications={previewSpecs}
          confirmedColors={previewConfirmedColors}
          colourImages={previewColourImages}
          variantPrices={previewVariantPrices}
          promotionImage={previewPromotionImage}
          keywords={previewKeywords}
          fields={fields}
          variants={previewVariants}
        />
      </div>

      <div className="pi-continue-wrap">
        <button className="pi-proceed-btn" onClick={handleContinue}>
          Continue
          <ArrowRightIcon />
        </button>
      </div>
    </div>
  );
};

export default ProductInfo;