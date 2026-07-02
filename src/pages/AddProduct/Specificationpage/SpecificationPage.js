import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./SpecificationPage.css";
import { fetchCategoryFields } from "../../../services/sellerService";
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

const uploadFileToWix = async (file) => {
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  let url = null;
  try {
    const res = await fetch("https://www.haatza.com/_functions/uploadMedia", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: file.name,
        fileData: base64,
        mediaType: file.type || "image/jpeg",
      }),
    });
    if (res.ok) {
      const data = await res.json();
      url =
        data?.url || data?.mediaUrl || data?.imageUrl ||
        data?.data?.url || data?.data?.mediaUrl ||
        data?.result?.url || null;
    }
  } catch (err1) {
    console.warn("[UploadMedia] www JSON attempt failed:", err1.message);
  }

  if (!url) {
    try {
      const res2 = await fetch("https://haatza.com/_functions/uploadMedia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          fileData: base64,
          mediaType: file.type || "image/jpeg",
        }),
      });
      if (res2.ok) {
        const data2 = await res2.json();
        url =
          data2?.url || data2?.mediaUrl || data2?.imageUrl ||
          data2?.data?.url || data2?.data?.mediaUrl ||
          data2?.result?.url || null;
      }
    } catch (err2) {
      console.warn("[UploadMedia] haatza.com JSON attempt failed:", err2.message);
    }
  }

  if (!url) {
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("mediaType", "image");
      const res3 = await fetch("https://haatza.com/_functions/uploadMedia", {
        method: "POST",
        body: fd,
      });
      if (res3.ok) {
        const data3 = await res3.json();
        url =
          data3?.url || data3?.mediaUrl || data3?.imageUrl ||
          data3?.data?.url || data3?.data?.mediaUrl ||
          data3?.result?.url || null;
      }
    } catch (err3) {
      console.warn("[UploadMedia] FormData fallback failed:", err3.message);
    }
  }

  if (!url) throw new Error("All upload attempts failed — no URL returned");
  return resolveWixImage(url) || url;
};



const STEPS = [
  { label: "Pick Category",   desc: "Choose the best category" },
  { label: "Product Info",    desc: "Add your product details" },
  { label: "Review & Submit", desc: "Final review" },
];

const DEFAULT_COLORS = [
  { name: "Red",     hex: "#EF4444" },
  { name: "Blue",    hex: "#3B82F6" },
  { name: "Green",   hex: "#22C55E" },
  { name: "Black",   hex: "#1e293b" },
];

const COLOR_MAP = {
  red: "#EF4444",
  blue: "#3B82F6",
  green: "#22C55E",
  black: "#1e293b",
  white: "#FFFFFF",
  yellow: "#FBBF24",
  orange: "#F97316",
  purple: "#8B5CF6",
  pink: "#EC4899",
  grey: "#6B7280",
  gray: "#6B7280",
  brown: "#78350F",
  cyan: "#06B6D4",
  magenta: "#D946EF",
  teal: "#14B8A6",
  indigo: "#6366F1",
  violet: "#8B5CF6",
  beige: "#F5F5DC",
  gold: "#FFD700",
  silver: "#C0C0C0",
};

/* ── SVG ICONS ── */
const CheckIcon = ({ size = 13, color = "white" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M5 13l4 4L19 7" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
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
const InfoIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M12 16v-4M12 8h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
const SparkleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M12 2l2.09 6.26L20 10l-5.91 1.74L12 18l-2.09-6.26L4 10l5.91-1.74L12 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const ChevronDownIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const SearchIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
    <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);
const CloseIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);
const TagIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="7" y1="7" x2="7.01" y2="7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);
const LoaderIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="sp-spinner">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeDasharray="40" strokeDashoffset="30" strokeLinecap="round"/>
  </svg>
);
const PaletteIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
    <circle cx="8"  cy="10" r="1.5" fill="currentColor"/>
    <circle cx="12" cy="7"  r="1.5" fill="currentColor"/>
    <circle cx="16" cy="10" r="1.5" fill="currentColor"/>
    <path d="M12 17a2 2 0 004 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
const PlusIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);
const EditIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const UploadIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <polyline points="17 8 12 3 7 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="12" y1="3" x2="12" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

/* ── STEP INDICATORS ── */
const StepIndicator = ({ currentStep }) => (
  <div className="sp-steps">
    {STEPS.map((step, i) => {
      const isActive = i === currentStep;
      const isDone   = i < currentStep;
      return (
        <div key={i} className={`sp-step ${isActive ? "sp-step--active" : ""} ${isDone ? "sp-step--done" : ""}`}>
          <div className="sp-step-bubble">
            {isDone ? <CheckIcon size={12} /> : <span>{i + 1}</span>}
          </div>
          <span className="sp-step-label">{step.label}</span>
          {i < STEPS.length - 1 && (
            <div className={`sp-step-line ${isDone ? "sp-step-line--done" : ""}`}/>
          )}
        </div>
      );
    })}
  </div>
);

const StepIndicatorMobile = ({ currentStep }) => (
  <div className="sp-steps-mobile">
    {STEPS.map((step, i) => {
      const isActive = i === currentStep;
      const isDone   = i < currentStep;
      return (
        <div key={i} className={`sp-vstep ${isActive ? "sp-vstep--active" : ""} ${isDone ? "sp-vstep--done" : ""}`}>
          <div className="sp-vstep-left">
            <div className="sp-vstep-bubble">
              {isDone ? <CheckIcon size={11} /> : <span>{i + 1}</span>}
            </div>
            {i < STEPS.length - 1 && (
              <div className={`sp-vstep-line ${isDone ? "sp-vstep-line--done" : ""}`}/>
            )}
          </div>
          <div className="sp-vstep-right">
            <div className="sp-vstep-label">{step.label}</div>
            <div className="sp-vstep-desc">{step.desc}</div>
            {isActive && <div className="sp-vstep-badge">In progress</div>}
          </div>
        </div>
      );
    })}
  </div>
);

/* ── SEARCHABLE DROPDOWN ── */
const SearchableDropdown = ({ field, value, onChange, error, touched }) => {
  const [open,  setOpen]  = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef(null);

  const choices = Array.isArray(field.choices)
    ? field.choices
    : (field.choices ? field.choices.split(",").map(c => c.trim()).filter(Boolean) : []);
  const filtered = query.trim()
    ? choices.filter(c => c.toLowerCase().includes(query.toLowerCase()))
    : choices;

  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) { setOpen(false); setQuery(""); }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (choice) => { onChange(choice); setOpen(false); setQuery(""); };
  const hasError = error && touched;

  return (
    <div
      className={`sp-dropdown-wrap ${open ? "sp-dropdown-wrap--open" : ""} ${hasError ? "sp-dropdown-wrap--error" : ""}`}
      ref={wrapRef}
      style={{ position: "relative", zIndex: open ? 1000 : 1 }}
    >
      <button type="button" className="sp-dropdown-trigger" onClick={() => setOpen(p => !p)}>
        <span className={`sp-dropdown-value ${!value ? "sp-dropdown-placeholder" : ""}`}>
          {value || field.placeholderText || `Select ${field.title}`}
        </span>
        <span className={`sp-dropdown-chevron ${open ? "sp-dropdown-chevron--up" : ""}`}>
          <ChevronDownIcon />
        </span>
      </button>
      {open && (
        <div className="sp-dropdown-panel" style={{ position: "absolute", zIndex: 9999, top: "100%", left: 0, right: 0 }}>
          {choices.length > 6 && (
            <div className="sp-dropdown-search">
              <SearchIcon />
              <input autoFocus className="sp-dropdown-search-input" placeholder="Search options..." value={query} onChange={e => setQuery(e.target.value)} />
              {query && (
                <button className="sp-dropdown-search-clear" onClick={() => setQuery("")}><CloseIcon /></button>
              )}
            </div>
          )}
          <div className="sp-dropdown-options">
            {filtered.length === 0 ? (
              <div className="sp-dropdown-empty">No results for "{query}"</div>
            ) : (
              filtered.map((choice, i) => (
                <button key={i} type="button"
                  className={`sp-dropdown-option ${value === choice ? "sp-dropdown-option--selected" : ""}`}
                  onClick={() => handleSelect(choice)}>
                  <span className="sp-dropdown-option-text">{choice}</span>
                  {value === choice && <CheckIcon size={11} color="#2962ff" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/* ── MULTI-SELECT FIELD ── */
const MultiSelectField = ({ field, value = [], onChange, error, touched }) => {
  const choices = Array.isArray(field.choices)
    ? field.choices
    : (field.choices ? field.choices.split(",").map(c => c.trim()).filter(Boolean) : []);
  const toggle = (choice) => {
    if (value.includes(choice)) onChange(value.filter(v => v !== choice));
    else onChange([...value, choice]);
  };
  const hasError = error && touched;
  return (
    <div className={`sp-multiselect ${hasError ? "sp-multiselect--error" : ""}`}>
      {choices.map((choice, i) => (
        <button key={i} type="button"
          className={`sp-ms-chip ${value.includes(choice) ? "sp-ms-chip--active" : ""}`}
          onClick={() => toggle(choice)}>
          {value.includes(choice) && <CheckIcon size={10} />}
          {choice}
        </button>
      ))}
    </div>
  );
};

/* ── RADIO FIELD ── */
const RadioField = ({ field, value, onChange }) => {
  const choices = Array.isArray(field.choices)
    ? field.choices
    : (field.choices ? field.choices.split(",").map(c => c.trim()).filter(Boolean) : []);
  return (
    <div className="sp-radio-group">
      {choices.map((choice, i) => (
        <label key={i} className={`sp-radio-option ${value === choice ? "sp-radio-option--active" : ""}`}>
          <input type="radio" name={field.fieldId || field.title} value={choice}
            checked={value === choice} onChange={() => onChange(choice)} className="sp-radio-input"/>
          <span className="sp-radio-dot"/>
          <span className="sp-radio-label">{choice}</span>
        </label>
      ))}
    </div>
  );
};

/* ── CHECKBOX FIELD ── */
const CheckboxField = ({ field, value, onChange }) => {
  const checked = value === true || value === "true" || value === "yes";
  return (
    <label className={`sp-checkbox-wrap ${checked ? "sp-checkbox-wrap--checked" : ""}`}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="sp-checkbox-input"/>
      <span className="sp-checkbox-box">{checked && <CheckIcon size={10} />}</span>
      <span className="sp-checkbox-label">{field.checkboxLabel || field.title}</span>
    </label>
  );
};

/* ── SIZE CHART UPLOAD FIELD ── */
/* CHANGED: file input now uses multiple accept types and no capture restriction,
   allowing gallery, file manager, and any local storage on both mobile and desktop */
const SizeChartUploadField = ({ field, value, onChange, error, touched }) => {
  const fileRef  = useRef(null);
  const hasError = error && touched;

  const et          = (field.elementType    || field.inputType    || "").toLowerCase();
  const placeholder = (field.placeholderText || field.placeholder || "").toLowerCase().trim();
  const isUpload = placeholder !== "select" && et !== "select";

  // Resolve display URL — works for real File, existing URL object, or null
  const previewUrl = value?.isExisting
    ? value.url
    : value instanceof File
      ? URL.createObjectURL(value)
      : null;

  const displayName = value?.isExisting
    ? "Uploaded ✓"
    : value instanceof File
      ? value.name
      : null;

  const handleDelete = () => onChange(null);

  return (
    <div className="sp-field">
      <label className="sp-label">
        {field.title}
        {field.required && <span className="sp-required"> *</span>}
      </label>

      <div className="sp-size-chart-row" style={{ display: "flex", alignItems: "center", gap: 8 }}>

        {/* Preview thumbnail — only shown when value exists */}
        {previewUrl && (
          <img
            src={previewUrl}
            alt="Size Chart Preview"
            style={{
              width: 44,
              height: 44,
              objectFit: "cover",
              borderRadius: 8,
              border: "1px solid rgba(0,0,0,0.12)",
              flexShrink: 0,
            }}
          />
        )}

        {/* Show placeholder text only when no image uploaded */}
        {!value && (
          <span className="sp-size-chart-placeholder" style={{ flex: 1 }}>
            {field.placeholderText || (isUpload ? "Upload" : "Select")}
          </span>
        )}

        {/* Show loading spinner while pending */}
        {value === "__PENDING_FILE__" && (
          <div className="sp-size-chart-loading" style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
            <LoaderIcon />
            <span style={{ fontSize: 13, color: "#64748b" }}>Uploading...</span>
          </div>
        )}

        {/* Delete and Replace buttons beside each other on the same line */}
        {value && value !== "__PENDING_FILE__" && (
          <div className="sp-size-chart-actions">
            <button
              type="button"
              onClick={handleDelete}
              title="Remove image"
              className="sp-size-chart-remove-btn"
            >
              <span className="sp-size-chart-btn-text">Remove</span>
            </button>

            {isUpload && (
              <button
                type="button"
                onClick={() => { if (fileRef.current) { fileRef.current.value = ""; fileRef.current.click(); } }}
                className="sp-size-chart-replace-btn"
              >
                <span className="sp-size-chart-btn-text">Replace</span>
              </button>
            )}
          </div>
        )}

        {/* Upload button — only when no value */}
        {isUpload ? (
          <>
            {!value && (
              <button
                type="button"
                className="sp-size-chart-btn"
                onClick={() => { if (fileRef.current) { fileRef.current.value = ""; fileRef.current.click(); } }}
              >
                <UploadIcon size={14} /> Upload
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf,.jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx"
              style={{ display: "none" }}
              onChange={async e => {
              const file = e.target.files?.[0];
              if (!file) return;
              e.target.value = "";
              onChange("__PENDING_FILE__");
              try {
                const resolvedUrl = await uploadFileToWix(file);
                console.log("[SizeChartUpload] ✅ Uploaded & Resolved:", resolvedUrl);
                onChange({ url: resolvedUrl, isExisting: true, name: file.name });
              } catch (err) {
                console.error("[SizeChartUpload] ❌ Upload failed:", err.message);
                onChange(file);
              }
            }}
            />
          </>
        ) : (
          <button
            type="button"
            className="sp-size-chart-btn"
            onClick={() => field.onSelectClick?.()}
          >
            Select
          </button>
        )}

      </div>

      {hasError        && <p className="sp-error-text sp-error-anim">{error}</p>}
      {field.helperText && !hasError && <p className="sp-helper-text">{field.helperText}</p>}
    </div>
  );
};


/* ── DYNAMIC FIELD ── */
const DynamicField = ({ field, value, onChange, error, touched }) => {
  const hasError = error && touched;

  const titleLower       = (field.title        || "").toLowerCase().trim();
const fieldIdLower     = (field.fieldId       || "").toLowerCase().trim();
const elementTypeLower = (field.elementType   || "").toLowerCase().trim();
const placeholderLower = (field.placeholderText || "").toLowerCase().trim();

// Explicitly exclude pure option fields like "size" or "color"
const isOptionField = field.type === "Product Options";

const isSizeChart = !isOptionField && (
  elementTypeLower === "upload" ||
  elementTypeLower === "file"   ||
  placeholderLower === "upload" ||
  titleLower.includes("size chart") ||
  titleLower.includes("size chat")  ||
  titleLower.includes("upload")     ||
  fieldIdLower.includes("sizechart") ||
  fieldIdLower.includes("size_chart") ||
  fieldIdLower.includes("upload")
);

  if (isSizeChart) {
    return (
      <SizeChartUploadField
        field={field}
        value={value}
        onChange={onChange}
        error={error}
        touched={touched}
      />
    );
  }

  const renderInput = () => {
    const et = (field.elementType || "").toLowerCase();
    if (et === "dropdown" || et === "dropdowns" || et === "select")
      return <SearchableDropdown field={field} value={value} onChange={onChange} error={error} touched={touched}/>;
    if (et === "multiselect" || et === "multi_select" || et === "selection tag" || et === "selectiontag" || et === "selection_tag")
      return <MultiSelectField field={field} value={value || []} onChange={onChange} error={error} touched={touched}/>;
    if (et === "radio")
      return <RadioField field={field} value={value} onChange={onChange}/>;
    if (et === "checkbox")
      return <CheckboxField field={field} value={value} onChange={onChange}/>;
    if (et === "textarea")
      return (
        <textarea className={`sp-textarea ${hasError ? "sp-input--error" : ""}`}
          placeholder={field.placeholderText || `Enter ${field.title}`}
          value={value || ""} onChange={e => onChange(e.target.value.replace(/[^A-Za-z0-9\s]/g, ""))} rows={3}/>
      );
    // True numeric measurement fields (weight, dimensions, etc.) always carry an
    // explicit unit from the backend (cm, kg, ml...). Keep these digit-only, but
    // render as type="text" so no native browser +/- spinner arrows appear.
    if (et === "number" && field.unit)
      return (
        <div className="sp-input-wrap">
          <input
            type="text"
            inputMode="decimal"
            className={`sp-input sp-input--suffix ${hasError ? "sp-input--error" : ""}`}
            placeholder={field.placeholderText || `Enter ${field.title}`}
            value={value || ""}
            onChange={e => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
          />
          <span className="sp-input-suffix">{field.unit}</span>
        </div>
      );

    // Manual-entry fields — including any backend field marked elementType "number"
    // but with no unit (these are not real numeric measurements) — get a plain
    // alphanumeric text input: letters, numbers, and spaces.
    return (
      <div className="sp-input-wrap">
        <input type="text" className={`sp-input ${hasError ? "sp-input--error" : ""}`}
          placeholder={field.placeholderText || `Enter ${field.title}`}
          value={value || ""} onChange={e => onChange(e.target.value.replace(/[^A-Za-z0-9\s]/g, ""))}/>
      </div>
    );
  };
  return (
    <div className="sp-field">
      <label className="sp-label">
        {field.title}
        {field.required && <span className="sp-required"> *</span>}
      </label>
      {renderInput()}
      {hasError && <p className="sp-error-text sp-error-anim">{error}</p>}
      {field.helperText && !hasError && <p className="sp-helper-text">{field.helperText}</p>}
    </div>
  );
};



/* ── SKELETON LOADERS ── */
const FieldSkeleton = () => (
  <div className="sp-field-skeleton">
    <div className="sp-skel sp-skel-label"/>
    <div className="sp-skel sp-skel-input"/>
  </div>
);
const SkeletonGrid = () => (
  <div className="sp-form-grid">
    {Array.from({ length: 6 }).map((_, i) => <FieldSkeleton key={i}/>)}
  </div>
);

/* ────────────────────────────────────────────────────
   COLOUR UTILITIES
──────────────────────────────────────────────────── */

/** Convert HSV → hex */
const hsvToHex = (h, s, v) => {
  s /= 100; v /= 100;
  const f = h / 60 - Math.floor(h / 60);
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  let r, g, b;
  switch (Math.floor(h / 60) % 6) {
    case 0: [r, g, b] = [v, t, p]; break;
    case 1: [r, g, b] = [q, v, p]; break;
    case 2: [r, g, b] = [p, v, t]; break;
    case 3: [r, g, b] = [p, q, v]; break;
    case 4: [r, g, b] = [t, p, v]; break;
    case 5: [r, g, b] = [v, p, q]; break;
    default: [r, g, b] = [0, 0, 0];
  }
  return `#${[r, g, b].map(x => Math.round(x * 255).toString(16).padStart(2, "0")).join("")}`;
};

/** HSV to RGB values (0-255) */
const hsvToRgb = (h, s, v) => {
  s /= 100; v /= 100;
  const f = h / 60 - Math.floor(h / 60);
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  let r, g, b;
  switch (Math.floor(h / 60) % 6) {
    case 0: [r, g, b] = [v, t, p]; break;
    case 1: [r, g, b] = [q, v, p]; break;
    case 2: [r, g, b] = [p, v, t]; break;
    case 3: [r, g, b] = [p, q, v]; break;
    case 4: [r, g, b] = [t, p, v]; break;
    case 5: [r, g, b] = [v, p, q]; break;
    default: [r, g, b] = [0, 0, 0];
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
};

/** RGB to HSL */
const rgbToHsl = (r, g, b) => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  switch (max) {
    case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
    case g: h = ((b - r) / d + 2) / 6; break;
    case b: h = ((r - g) / d + 4) / 6; break;
    default: h = 0;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
};

/* ── NAMED COLOUR DATABASE + NEAREST-MATCH ── */
const NAMED_COLORS_DB = [
  { name: "Red",            hex: "#FF0000" },
  { name: "Dark Red",       hex: "#8B0000" },
  { name: "Crimson",        hex: "#DC143C" },
  { name: "Firebrick",      hex: "#B22222" },
  { name: "Maroon",         hex: "#800000" },
  { name: "Indian Red",     hex: "#CD5C5C" },
  { name: "Light Coral",    hex: "#F08080" },
  { name: "Salmon",         hex: "#FA8072" },
  { name: "Dark Salmon",    hex: "#E9967A" },
  { name: "Light Salmon",   hex: "#FFA07A" },
  { name: "Tomato",         hex: "#FF6347" },
  { name: "Coral",          hex: "#FF7F50" },
  { name: "Orange Red",     hex: "#FF4500" },
  { name: "Orange",         hex: "#FF8000" },
  { name: "Dark Orange",    hex: "#FF8C00" },
  { name: "Light Orange",   hex: "#FFB347" },
  { name: "Peach",          hex: "#FFCBA4" },
  { name: "Apricot",        hex: "#FBCEB1" },
  { name: "Amber",          hex: "#FFBF00" },
  { name: "Burnt Orange",   hex: "#CC5500" },
  { name: "Rust",           hex: "#B7410E" },
  { name: "Yellow",         hex: "#FFFF00" },
  { name: "Light Yellow",   hex: "#FFFFE0" },
  { name: "Golden Yellow",  hex: "#FFD700" },
  { name: "Gold",           hex: "#FFC200" },
  { name: "Khaki",          hex: "#F0E68C" },
  { name: "Dark Khaki",     hex: "#BDB76B" },
  { name: "Mustard",        hex: "#FFDB58" },
  { name: "Lemon",          hex: "#FFF44F" },
  { name: "Cream",          hex: "#FFFDD0" },
  { name: "Ivory",          hex: "#FFFFF0" },
  { name: "Beige",          hex: "#F5F5DC" },
  { name: "Green",          hex: "#008000" },
  { name: "Lime Green",     hex: "#32CD32" },
  { name: "Lime",           hex: "#00FF00" },
  { name: "Dark Green",     hex: "#006400" },
  { name: "Forest Green",   hex: "#228B22" },
  { name: "Sea Green",      hex: "#2E8B57" },
  { name: "Medium Green",   hex: "#3CB371" },
  { name: "Spring Green",   hex: "#00FF7F" },
  { name: "Mint Green",     hex: "#98FF98" },
  { name: "Pale Green",     hex: "#90EE90" },
  { name: "Olive",          hex: "#808000" },
  { name: "Olive Green",    hex: "#6B8E23" },
  { name: "Dark Olive",     hex: "#556B2F" },
  { name: "Yellow Green",   hex: "#9ACD32" },
  { name: "Chartreuse",     hex: "#7FFF00" },
  { name: "Sage",           hex: "#B2AC88" },
  { name: "Emerald",        hex: "#50C878" },
  { name: "Hunter Green",   hex: "#355E3B" },
  { name: "Jade",           hex: "#00A86B" },
  { name: "Moss Green",     hex: "#8A9A5B" },
  { name: "Fern Green",     hex: "#4F7942" },
  { name: "Teal",           hex: "#008080" },
  { name: "Dark Teal",      hex: "#004C54" },
  { name: "Light Teal",     hex: "#66CDAA" },
  { name: "Cyan",           hex: "#00FFFF" },
  { name: "Aqua",           hex: "#00FFFF" },
  { name: "Dark Cyan",      hex: "#008B8B" },
  { name: "Turquoise",      hex: "#40E0D0" },
  { name: "Medium Turquoise", hex: "#48D1CC" },
  { name: "Dark Turquoise", hex: "#00CED1" },
  { name: "Aquamarine",     hex: "#7FFFD4" },
  { name: "Cadet Blue",     hex: "#5F9EA0" },
  { name: "Blue",           hex: "#0000FF" },
  { name: "Dark Blue",      hex: "#00008B" },
  { name: "Navy",           hex: "#000080" },
  { name: "Midnight Blue",  hex: "#191970" },
  { name: "Royal Blue",     hex: "#4169E1" },
  { name: "Cobalt Blue",    hex: "#0047AB" },
  { name: "Steel Blue",     hex: "#4682B4" },
  { name: "Dodger Blue",    hex: "#1E90FF" },
  { name: "Deep Sky Blue",  hex: "#00BFFF" },
  { name: "Sky Blue",       hex: "#87CEEB" },
  { name: "Light Blue",     hex: "#ADD8E6" },
  { name: "Powder Blue",    hex: "#B0E0E6" },
  { name: "Cornflower Blue", hex: "#6495ED" },
  { name: "Slate Blue",     hex: "#6A5ACD" },
  { name: "Medium Blue",    hex: "#0000CD" },
  { name: "Bright Blue",    hex: "#0096FF" },
  { name: "Baby Blue",      hex: "#89CFF0" },
  { name: "Denim",          hex: "#1560BD" },
  { name: "Periwinkle",     hex: "#CCCCFF" },
  { name: "Ice Blue",       hex: "#D6EAF8" },
  { name: "Purple",         hex: "#800080" },
  { name: "Dark Purple",    hex: "#4B0082" },
  { name: "Medium Purple",  hex: "#9370DB" },
  { name: "Blue Violet",    hex: "#8A2BE2" },
  { name: "Violet",         hex: "#EE82EE" },
  { name: "Indigo",         hex: "#4B0082" },
  { name: "Dark Violet",    hex: "#9400D3" },
  { name: "Plum",           hex: "#DDA0DD" },
  { name: "Orchid",         hex: "#DA70D6" },
  { name: "Thistle",        hex: "#D8BFD8" },
  { name: "Lavender",       hex: "#E6E6FA" },
  { name: "Lilac",          hex: "#C8A2C8" },
  { name: "Mauve",          hex: "#E0B0FF" },
  { name: "Amethyst",       hex: "#9966CC" },
  { name: "Grape",          hex: "#6F2DA8" },
  { name: "Wisteria",       hex: "#C9A0DC" },
  { name: "Pink",           hex: "#FFC0CB" },
  { name: "Light Pink",     hex: "#FFB6C1" },
  { name: "Hot Pink",       hex: "#FF69B4" },
  { name: "Deep Pink",      hex: "#FF1493" },
  { name: "Rose Pink",      hex: "#BF368F" },
  { name: "Medium Pink",    hex: "#E8A0BF" },
  { name: "Pale Pink",      hex: "#FADADD" },
  { name: "Magenta",        hex: "#FF00FF" },
  { name: "Dark Magenta",   hex: "#8B008B" },
  { name: "Fuchsia",        hex: "#FF00FF" },
  { name: "Rose",           hex: "#FF007F" },
  { name: "Blush",          hex: "#DE5D83" },
  { name: "Carnation",      hex: "#FFA6C9" },
  { name: "Rose Gold",      hex: "#B76E79" },
  { name: "Ruby",           hex: "#9B111E" },
  { name: "Bubblegum",      hex: "#FFC1CC" },
  { name: "Brown",          hex: "#A52A2A" },
  { name: "Dark Brown",     hex: "#5C3317" },
  { name: "Light Brown",    hex: "#C4A265" },
  { name: "Saddle Brown",   hex: "#8B4513" },
  { name: "Sienna",         hex: "#A0522D" },
  { name: "Chocolate",      hex: "#D2691E" },
  { name: "Peru",           hex: "#CD853F" },
  { name: "Tan",            hex: "#D2B48C" },
  { name: "Sandy Brown",    hex: "#F4A460" },
  { name: "Wheat",          hex: "#F5DEB3" },
  { name: "Burlywood",      hex: "#DEB887" },
  { name: "Caramel",        hex: "#C68642" },
  { name: "Mocha",          hex: "#967969" },
  { name: "Walnut",         hex: "#773F1A" },
  { name: "Coffee",         hex: "#6F4E37" },
  { name: "White",          hex: "#FFFFFF" },
  { name: "Snow",           hex: "#FFFAFA" },
  { name: "Floral White",   hex: "#FFFAF0" },
  { name: "Ghost White",    hex: "#F8F8FF" },
  { name: "Light Gray",     hex: "#D3D3D3" },
  { name: "Silver",         hex: "#C0C0C0" },
  { name: "Gray",           hex: "#808080" },
  { name: "Dark Gray",      hex: "#A9A9A9" },
  { name: "Dim Gray",       hex: "#696969" },
  { name: "Slate Gray",     hex: "#708090" },
  { name: "Charcoal",       hex: "#36454F" },
  { name: "Jet Black",      hex: "#0A0A0A" },
  { name: "Black",          hex: "#000000" },
  { name: "Champagne",      hex: "#F7E7CE" },
  { name: "Bronze",         hex: "#CD7F32" },
  { name: "Copper",         hex: "#B87333" },
  { name: "Off White",      hex: "#FAF9F6" },
];

const autoColorName = (hex) => {
  if (!hex || hex.length < 7) return "Custom";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  let closestName = "Custom";
  let minDist = Infinity;
  for (const entry of NAMED_COLORS_DB) {
    const er = parseInt(entry.hex.slice(1, 3), 16);
    const eg = parseInt(entry.hex.slice(3, 5), 16);
    const eb = parseInt(entry.hex.slice(5, 7), 16);
    const dist = (r - er) ** 2 * 0.299 + (g - eg) ** 2 * 0.587 + (b - eb) ** 2 * 0.114;
    if (dist < minDist) { minDist = dist; closestName = entry.name; }
  }
  return closestName;
};

/* ────────────────────────────────────────────────────
   COLOUR PICKER MODAL — REDESIGNED to match reference images
   - Compact size
   - HSV palette canvas
   - Hue + opacity sliders
   - RGB/HSV/HSL dropdown with R,G,B,A values
   - Done works even without selecting anything
──────────────────────────────────────────────────── */
const ColorPickerModal = ({ open, availableColors, tempColors, onToggle, onAdd, onCancel, onDone }) => {
  const [hue,        setHue]        = useState(0);
  const [saturation, setSaturation] = useState(80);
  const [brightness, setBrightness] = useState(90);
  const [showPicker, setShowPicker] = useState(false);
  const [opacity,    setOpacity]    = useState(100);
  /* NEW: color mode dropdown (RGB / HSV / HSL) */
  const [colorMode,  setColorMode]  = useState("RGB");
  const [modeDropOpen, setModeDropOpen] = useState(false);

  const paletteRef = useRef(null);
  const isDragging = useRef(false);

  const pickedHex  = hsvToHex(hue, saturation, brightness);
  const pickedName = autoColorName(pickedHex);
  const pickedRgb  = hsvToRgb(hue, saturation, brightness);
  const pickedHsl  = rgbToHsl(pickedRgb.r, pickedRgb.g, pickedRgb.b);

  const pX = `${saturation}%`;
  const pY = `${100 - brightness}%`;

  const updateFromPaletteEvent = (e) => {
    if (!paletteRef.current) return;
    const rect = paletteRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const s = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const v = Math.max(0, Math.min(100, 100 - ((clientY - rect.top) / rect.height) * 100));
    setSaturation(Math.round(s));
    setBrightness(Math.round(v));
  };

  useEffect(() => {
    const up   = () => { isDragging.current = false; };
    const move = (e) => { if (isDragging.current) updateFromPaletteEvent(e); };
    window.addEventListener("mouseup",   up);
    window.addEventListener("mousemove", move);
    window.addEventListener("touchend",  up);
    window.addEventListener("touchmove", move, { passive: false });
    return () => {
      window.removeEventListener("mouseup",   up);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("touchend",  up);
      window.removeEventListener("touchmove", move);
    };
  }, []);

  if (!open) return null;

  const handleAddPicked = () => {
    onAdd({ name: pickedName, hex: pickedHex });
    setShowPicker(false);
  };

  const pureHue = hsvToHex(hue, 100, 100);

  /* Compute display values based on selected mode */
  const getModeValues = () => {
    if (colorMode === "RGB") {
      return [
        { label: "R", value: pickedRgb.r },
        { label: "G", value: pickedRgb.g },
        { label: "B", value: pickedRgb.b },
        { label: "A", value: `${opacity}%` },
      ];
    }
    if (colorMode === "HSV") {
      return [
        { label: "H", value: Math.round(hue) },
        { label: "S", value: `${Math.round(saturation)}%` },
        { label: "V", value: `${Math.round(brightness)}%` },
        { label: "A", value: `${opacity}%` },
      ];
    }
    // HSL
    return [
      { label: "H", value: pickedHsl.h },
      { label: "S", value: `${pickedHsl.s}%` },
      { label: "L", value: `${pickedHsl.l}%` },
      { label: "A", value: `${opacity}%` },
    ];
  };

  return (
    <div className="sp-dialog-overlay" onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      {/* CHANGED: compact dialog — max-width 380px, reduced padding */}
      <div className="sp-dialog sp-color-dialog" style={{ maxWidth: 370, borderRadius: 16 }}>

        {/* ── Header — dynamic background color ── */}
        <div
          className="sp-dialog-header"
          style={{
            background: pickedHex,
            borderBottom: "none",
            padding: "14px 18px 12px",
            borderRadius: "16px 16px 0 0",
          }}
        >
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{
              fontFamily: "var(--ff-display)",
              fontSize: 17,
              fontWeight: 700,
              color: "white",
              textShadow: "0 1px 4px rgba(0,0,0,0.25)",
              letterSpacing: "-0.01em",
            }}>
              Pick a Color
            </div>
          </div>
          <button
            className="sp-dialog-close"
            onClick={onCancel}
            style={{ background: "rgba(255,255,255,0.25)", color: "white", width: 26, height: 26 }}
          >
            <CloseIcon size={13} />
          </button>
        </div>

        <div className="sp-dialog-body" style={{ overflowY: "auto" }}>
          {!showPicker ? (
            /* ── Swatch grid view ── */
            <div className="sp-color-grid-body" style={{ padding: "14px 16px 10px" }}>
              <div className="sp-color-swatch-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(60px, 1fr))", gap: 8 }}>
                {availableColors.map(c => {
                  const selected = tempColors.some(x => x.name === c.name);
                  return (
                    <div
                      key={c.name}
                      className={`sp-color-swatch ${selected ? "sp-color-swatch--selected" : ""}`}
                      onClick={() => onToggle(c)}
                      title={c.name}
                      style={{ padding: "6px 4px" }}
                    >
                      <div className="sp-color-swatch-circle" style={{ background: c.hex, width: 36, height: 36 }}>
                        {selected && (
                          <div className="sp-color-swatch-check" style={{ width: 36, height: 36 }}>
                            <CheckIcon size={12} color="white" />
                          </div>
                        )}
                      </div>
                      <span className="sp-color-swatch-name" style={{ fontSize: 10 }}>{c.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* ── HSV Palette Picker — compact ── */
            <div style={{ padding: "0 0 4px" }}>

              {/* Saturation/Brightness 2D canvas — reduced height */}
              <div
                ref={paletteRef}
                style={{
                  position: "relative",
                  width: "100%",
                  height: 180,
                  background: `
                    linear-gradient(to bottom, transparent 0%, #000 100%),
                    linear-gradient(to right, #fff 0%, ${pureHue} 100%)
                  `,
                  cursor: "crosshair",
                  userSelect: "none",
                  flexShrink: 0,
                }}
                onMouseDown={e => { isDragging.current = true; updateFromPaletteEvent(e); }}
                onTouchStart={e => { isDragging.current = true; updateFromPaletteEvent(e); }}
              >
                <div style={{
                  position: "absolute",
                  left: pX,
                  top: pY,
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  border: "2.5px solid white",
                  boxShadow: "0 1px 5px rgba(0,0,0,0.5)",
                  transform: "translate(-50%, -50%)",
                  pointerEvents: "none",
                  background: pickedHex,
                }}/>
              </div>

              {/* Controls panel */}
              <div style={{ padding: "12px 16px 4px", background: "white" }}>

                {/* Preview circle */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    background: pickedHex,
                    border: "2px solid rgba(0,0,0,0.12)",
                    flexShrink: 0,
                  }}/>
                  {/* Hue + Opacity sliders stacked */}
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                    {/* Hue slider */}
                    <input
                      type="range"
                      min={0} max={360}
                      value={hue}
                      onChange={e => setHue(Number(e.target.value))}
                      className="sp-hue-slider"
                      style={{
                        width: "100%",
                        height: 12,
                        borderRadius: 6,
                        appearance: "none",
                        WebkitAppearance: "none",
                        outline: "none",
                        cursor: "pointer",
                        background: "linear-gradient(to right,#f00 0%,#ff0 17%,#0f0 33%,#0ff 50%,#00f 67%,#f0f 83%,#f00 100%)",
                      }}
                    />
                    {/* Opacity slider */}
                    <input
                      type="range"
                      min={0} max={100}
                      value={opacity}
                      onChange={e => setOpacity(Number(e.target.value))}
                      className="sp-opacity-slider"
                      style={{
                        width: "100%",
                        height: 12,
                        borderRadius: 6,
                        appearance: "none",
                        WebkitAppearance: "none",
                        outline: "none",
                        cursor: "pointer",
                        background: `linear-gradient(to right, transparent 0%, ${pickedHex} 100%),
                          repeating-conic-gradient(#ccc 0% 25%, white 0% 50%) 0 0 / 10px 10px`,
                      }}
                    />
                  </div>
                </div>

                {/* Mode dropdown + R,G,B,A values row — matches reference images */}
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 10px",
                  background: "#f8f9fa",
                  borderRadius: 8,
                  border: "1px solid rgba(0,0,0,0.08)",
                  marginBottom: 4,
                  position: "relative",
                }}>
                  {/* Mode dropdown */}
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={() => setModeDropOpen(p => !p)}
                      style={{
                        display: "flex", alignItems: "center", gap: 4,
                        background: "white",
                        border: "1px solid rgba(0,0,0,0.15)",
                        borderRadius: 6,
                        padding: "4px 8px",
                        fontFamily: "var(--ff-display)",
                        fontSize: 12, fontWeight: 700,
                        color: "var(--sp-text)",
                        cursor: "pointer",
                        minWidth: 52,
                        justifyContent: "space-between",
                      }}
                    >
                      {colorMode}
                      <ChevronDownIcon size={10} />
                    </button>
                    {modeDropOpen && (
                      <div style={{
                        position: "absolute",
                        top: "calc(100% + 4px)",
                        left: 0,
                        background: "white",
                        border: "1px solid rgba(0,0,0,0.12)",
                        borderRadius: 8,
                        boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
                        zIndex: 9999,
                        overflow: "hidden",
                        minWidth: 70,
                      }}>
                        {["RGB", "HSV", "HSL"].map(mode => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => { setColorMode(mode); setModeDropOpen(false); }}
                            style={{
                              display: "block", width: "100%",
                              padding: "8px 14px",
                              background: colorMode === mode ? "rgba(41,98,255,0.07)" : "transparent",
                              border: "none", cursor: "pointer",
                              fontFamily: "var(--ff-display)", fontSize: 13, fontWeight: 600,
                              color: colorMode === mode ? "var(--sp-primary)" : "var(--sp-text)",
                              textAlign: "left",
                            }}
                          >
                            {mode}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Channel value columns */}
                  <div style={{ flex: 1, display: "flex", justifyContent: "space-around" }}>
                    {getModeValues().map(({ label, value: val }) => (
                      <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                        <span style={{
                          fontFamily: "var(--ff-display)", fontSize: 11, fontWeight: 700,
                          color: "var(--sp-text-3)", letterSpacing: "0.04em"
                        }}>{label}</span>
                        <span style={{
                          fontFamily: "var(--ff-display)", fontSize: 13, fontWeight: 700,
                          color: "var(--sp-text)"
                        }}>{val}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>

        {/* ── Selected summary bar ── */}
        {tempColors.length > 0 && (
          <div className="sp-color-selected-bar" style={{ margin: "8px 16px 0" }}>
            <span className="sp-color-selected-label">{tempColors.length} selected:</span>
            <div className="sp-color-selected-dots">
              {tempColors.map(c => (
                <span key={c.name} className="sp-color-selected-dot"
                  style={{ background: c.hex, width: 14, height: 14 }} title={c.name}/>
              ))}
            </div>
          </div>
        )}

        {/* ── Footer ── */}
        <div className="sp-dialog-footer" style={{ padding: "10px 16px 14px" }}>
          {!showPicker ? (
            <>
              <button className="sp-cmodal-add" onClick={() => setShowPicker(true)}>
                <PlusIcon size={12} /> Add Color
              </button>
              <div style={{ display: "flex", gap: 16 }}>
                {/* CHANGED: Done always enabled — no minimum selection required */}
                <button className="sp-cmodal-cancel" onClick={onCancel}>Cancel</button>
                <button className="sp-cmodal-done" onClick={onDone} style={{ opacity: 1 }}>Done</button>
              </div>
            </>
          ) : (
            <>
              <button className="sp-cmodal-cancel" onClick={() => setShowPicker(false)}>Cancel</button>
              <button className="sp-cmodal-done" style={{ opacity: 1 }} onClick={handleAddPicked}>OK</button>
            </>
          )}
        </div>

      </div>
    </div>
  );
};

/* ────────────────────────────────────────────────────
   VARIANT PRICING MODAL
──────────────────────────────────────────────────── */
const cleanColorName = (name) => {
  if (!name) return "";
  return name.replace(/\s*\(\s*#[0-9a-fA-F]+\s*\)/g, "").trim();
};

const normalizeVariantKey = (key) => {
  if (!key) return "";
  return key.toLowerCase().replace(/\s*\(\s*#[0-9a-fA-F]+\s*\)/g, "").replace(/\s+/g, "").trim();
};

const getVariantPriceData = (vKey, pricesObj) => {
  if (!pricesObj) return null;
  const target = normalizeVariantKey(vKey);
  const foundKey = Object.keys(pricesObj).find(k => normalizeVariantKey(k) === target);
  return foundKey ? pricesObj[foundKey] : null;
};

const getOriginalBasePrice = (p) => {
  if (!p) return 0;
  const base = parseFloat(p.price) || 0;
  const d = p.discount;
  if (!d?.type || d.value == null) return base;
  const val = parseFloat(d.value);
  if (isNaN(val)) return base;
  if (d.type === "PERCENTAGE" || d.type === "PERCENT") {
    return Math.max(0, base - (base * val) / 100);
  }
  if (d.type === "AMOUNT") {
    return Math.max(0, base - val);
  }
  return base;
};

const getInitialVariantPrices = (variantsList, varientPriceObj, editData) => {
  const initialPrices = {};
  if (!varientPriceObj || !Array.isArray(varientPriceObj.products)) return initialPrices;
  
  const originalBase = getOriginalBasePrice(editData);
  
  variantsList.forEach(v => {
    // find a matching product in varientPriceObj.products
    const foundProduct = varientPriceObj.products.find(p => {
      const info = p.variantInfo?.[0];
      if (!info || !info.choices) return false;
      
      const choices = info.choices;
      // Match color
      if (v.color) {
        const cVal = choices["Color"] || choices["color"] || choices["Colour"] || choices["colour"];
        if (cVal !== v.color) return false;
      } else {
        // If variant doesn't have color, choices shouldn't have color
        const cVal = choices["Color"] || choices["color"] || choices["Colour"] || choices["colour"];
        if (cVal) return false;
      }
      
      // Match option
      if (v.optionLabel) {
        const oVal = choices[v.optionField];
        if (oVal !== v.optionLabel) return false;
      } else if (v.optionField) {
        // If variant doesn't have optionLabel but has field, choices shouldn't have it
        const oVal = choices[v.optionField];
        if (oVal) return false;
      }
      
      return true;
    });
    
    if (foundProduct) {
      const priceInfo = foundProduct.variantInfo?.[0];
      // Only reconstruct a value if the seller actually entered one previously.
      // Without this check, every variant saved with a default (base + 0) price
      // would falsely appear as "filled" when re-opening the listing for edit.
      if (priceInfo?.priceModified !== true) return;
      const variantPrice = parseFloat(priceInfo?.price);
      if (!isNaN(variantPrice)) {
        // diff is variantPrice - originalBase
        const diff = variantPrice - originalBase;
        const op = diff >= 0 ? "+" : "-";
        const absDiff = Math.abs(diff);
        initialPrices[v.key] = {
          op,
          inputVal: absDiff > 0 ? String(absDiff) : "",
          appliedDiff: diff,
        };
      }
    }
  });
  
  return initialPrices;
};

const VariantPricingModal = ({ open, variants, availableColors, variantPrices, onPriceChange, onClose, basePrice }) => {
  if (!open) return null;

  const base = parseFloat(basePrice) || 0;

  const totalDiff = variants.reduce((sum, v) => {
    const pData = getVariantPriceData(v.key, variantPrices);
    return sum + (parseFloat(pData?.appliedDiff ?? 0) || 0);
  }, 0);
  const totalAmount = base + totalDiff;

  return (
    /* CHANGED: compact variant dialog — max-width 440px */
    <div className="sp-dialog-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sp-dialog sp-variant-dialog" style={{ maxWidth: 440 }}>

        {/* Header */}
        <div className="sp-dialog-header" style={{ padding: "14px 18px 12px" }}>
          <div>
            <div className="sp-dialog-title" style={{ fontSize: 14 }}>Manage pricing per variant</div>
            <div className="sp-dialog-note" style={{ color: "var(--sp-text-2)", fontSize: 11 }}>
              Select + or − then enter an amount to apply once
            </div>
          </div>
          <button className="sp-dialog-close" onClick={onClose} style={{ width: 26, height: 26 }}>
            <CloseIcon size={13} />
          </button>
        </div>

        {/* Total bar */}
        <div className="sp-vmodal-total-bar" style={{ padding: "8px 18px" }}>
          <div>
            <span className="sp-vmodal-total-label">Base Price</span>
            <span className="sp-vmodal-base-price" style={{ fontSize: 12 }}>₹{base.toFixed(2)}</span>
          </div>
        </div>

        {/* Variant rows */}
        <div className="sp-dialog-body sp-variant-body" style={{ padding: "4px 18px" }}>
          {variants.map(v => {
            const colorObj    = v.color ? availableColors.find(x => x.name === v.color) : null;
            const variantData = getVariantPriceData(v.key, variantPrices) || { op: "+", inputVal: "", appliedDiff: 0 };
            const { op, inputVal, appliedDiff } = variantData;
            const variantFinalPrice = base + (parseFloat(appliedDiff) || 0);
            const handleOpSelect = (selectedOp) => {
              const parsed = parseFloat(inputVal);
              const newDiff = isNaN(parsed) ? 0 : (selectedOp === "-" ? -Math.abs(parsed) : Math.abs(parsed));
              onPriceChange(v.key, { ...variantData, op: selectedOp, appliedDiff: newDiff });
            };
            const handleInputChange = (val) => {
              const parsed = parseFloat(val);
              const newDiff = isNaN(parsed) ? 0 : (op === "-" ? -Math.abs(parsed) : Math.abs(parsed));
              onPriceChange(v.key, { ...variantData, inputVal: val, appliedDiff: newDiff });
            };
            let label = "";
            const isOptionColor = (v.optionField || "").toLowerCase() === "color" || (v.optionField || "").toLowerCase() === "colour";

            if (v.color && v.optionLabel) {
              if (isOptionColor) {
                label = cleanColorName(v.optionLabel);
              } else {
                label = `${cleanColorName(v.color)} / ${v.optionLabel}`;
              }
            } else if (v.optionLabel) {
              if (isOptionColor) {
                label = cleanColorName(v.optionLabel);
              } else {
                label = v.optionLabel;
              }
            } else if (v.color) {
              label = cleanColorName(v.color);
            }

            return (
              <div key={v.key} className="sp-variant-card" style={{ padding: "12px 0" }}>
                <div className="sp-variant-card-header" style={{ marginBottom: 8 }}>
                  {colorObj && <span className="sp-variant-cdot" style={{ background: colorObj.hex }}/>}
                  <span className="sp-variant-name" style={{ fontSize: 13 }}>{label}</span>
                  <span className="sp-variant-final-price" style={{ fontSize: 12, padding: "3px 8px" }}>₹{variantFinalPrice.toFixed(2)}</span>
                </div>
                <div className="sp-variant-card-body">
                  <div className="sp-variant-price-label">Price difference (₹)</div>
                  <div className="sp-variant-controls" style={{ height: 40 }}>
                    <button className="sp-var-btn" onClick={() => handleOpSelect("-")}
                      style={{ width: 40, height: 40, background: op === "-" ? "var(--sp-red, #ef4444)" : "var(--sp-primary)", opacity: op === "-" ? 1 : 0.45 }}>−</button>
                    <input className="sp-var-input" type="number" placeholder="Enter amount"
                      value={inputVal} min="0" onChange={e => handleInputChange(e.target.value)}
                      onWheel={e => e.target.blur()}/>
                    <button className="sp-var-btn" onClick={() => handleOpSelect("+")}
                      style={{ width: 40, height: 40, background: op === "+" ? "var(--sp-green, #059669)" : "var(--sp-primary)", opacity: op === "+" ? 1 : 0.45 }}>+</button>
                  </div>
                  <div style={{ marginTop: 4, fontSize: 11, fontFamily: "var(--ff-display)", fontWeight: 600, color: op === "-" ? "var(--sp-red)" : "var(--sp-green)" }}>
                    {inputVal !== "" && !isNaN(parseFloat(inputVal))
                      ? `${op === "-" ? "−" : "+"} ₹${Math.abs(parseFloat(inputVal)).toFixed(2)} applied`
                      : "Select + or − then enter amount"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Done button */}
        <div className="sp-dialog-footer-btn" style={{ padding: "10px 18px 14px" }}>
          <button className="sp-vmodal-done-btn" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
};

/* ── COLOUR AND EDIT SECTION ── */
/* ── CONNECT IMAGE MODAL ── */
const ConnectImageModal = ({ open, onClose, confirmedColors, uploadedProductImages, colourImages, onColourImagesChange, onAddUploadedImage }) => {
  const [selectedColor, setSelectedColor] = useState("");
  const [localMappings, setLocalMappings] = useState({});
  const [colorDropOpen, setColorDropOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [limitError, setLimitError] = useState("");
  const fileRef = useRef(null);

  // Sync localMappings from parent when modal opens
  useEffect(() => {
    if (open) {
      setLocalMappings({ ...colourImages });
      setSelectedColor(confirmedColors.length > 0 ? confirmedColors[0].name : "");
      setLimitError("");
    }
  }, [open, colourImages, confirmedColors]);

  // Reset limitError when selected color changes
  useEffect(() => {
    setLimitError("");
  }, [selectedColor]);

  if (!open) return null;

  const currentColorObj = confirmedColors.find(c => c.name === selectedColor);

  // Get currently selected image URLs for this color (supports multiple)
  const selectedUrls = (() => {
    const val = localMappings[selectedColor];
    if (!val) return [];
    if (Array.isArray(val)) return val;
    return [val];
  })();

  const toggleImage = (imgUrl) => {
    setLocalMappings(prev => {
      const current = (() => {
        const val = prev[selectedColor];
        if (!val) return [];
        if (Array.isArray(val)) return val;
        return [val];
      })();
      const exists = current.includes(imgUrl);
      if (!exists && current.length >= 10) {
        setLimitError("Maximum 10 images per color are allowed.");
        return prev;
      }
      setLimitError("");
      const updated = exists ? current.filter(u => u !== imgUrl) : [...current, imgUrl];
      return { ...prev, [selectedColor]: updated };
    });
  };

  const handleAddImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploading(true);
    try {
      const resolvedUrl = await uploadFileToWix(file);
      if (onAddUploadedImage) {
        onAddUploadedImage(resolvedUrl);
      }
    } catch (err) {
      console.error("[ColorImageUpload] Error:", err);
      alert(err.message || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleDone = () => {
    if (selectedColor) {
      const urls = localMappings[selectedColor] || [];
      if (urls.length === 0) {
        alert(`Please select at least 1 image for ${selectedColor}.`);
        return;
      }
      if (urls.length > 10) {
        setLimitError(`Maximum 10 images per color are allowed. ${selectedColor} has ${urls.length} images.`);
        return;
      }
    }
    onColourImagesChange(localMappings);
    onClose();
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "flex-end",
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "white", width: "100%", borderRadius: "20px 20px 0 0",
        padding: "20px 16px 32px", maxHeight: "85vh", overflowY: "auto",
        position: "relative"
      }}>
        {/* Uploading Spinner Overlay */}
        {uploading && (
          <div style={{
            position: "absolute", inset: 0, background: "rgba(255,255,255,0.7)",
            zIndex: 1000, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 10
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="sp-spinner" style={{ color: "#2962ff" }}>
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeDasharray="40" strokeDashoffset="30" strokeLinecap="round"/>
            </svg>
            <span style={{ fontFamily: "var(--ff-display)", fontSize: 13, fontWeight: 700, color: "#2962ff" }}>
              Uploading image...
            </span>
          </div>
        )}
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <span style={{ fontFamily: "var(--ff-display)", fontSize: 16, fontWeight: 700, color: "var(--sp-text)" }}>
            Select Option to Connect Images
          </span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="#64748b" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Color Dropdown */}
        <div style={{ position: "relative", marginBottom: 20 }}>
          <button
            type="button"
            onClick={() => setColorDropOpen(p => !p)}
            style={{
              width: "100%", padding: "14px 16px",
              background: "#f8f9fa", border: "1px solid rgba(0,0,0,0.1)",
              borderRadius: 10, display: "flex", justifyContent: "space-between",
              alignItems: "center", cursor: "pointer",
              fontFamily: "var(--ff-display)", fontSize: 14,
              color: selectedColor ? "var(--sp-text)" : "#94a3b8",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {currentColorObj && (
                <span style={{
                  width: 14, height: 14, borderRadius: "50%",
                  background: currentColorObj.hex, flexShrink: 0,
                  border: "1.5px solid rgba(0,0,0,0.12)"
                }}/>
              )}
              {selectedColor || "Choose a product option"}
            </span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M6 9l6 6 6-6" stroke="#64748b" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>

          {colorDropOpen && (
            <div style={{
              position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
              background: "white", border: "1px solid rgba(0,0,0,0.1)",
              borderRadius: 10, boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
              zIndex: 100, overflow: "hidden",
            }}>
              {confirmedColors.map(c => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => { setSelectedColor(c.name); setColorDropOpen(false); }}
                  style={{
                    width: "100%", padding: "12px 16px",
                    background: selectedColor === c.name ? "rgba(41,98,255,0.06)" : "transparent",
                    border: "none", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 10,
                    fontFamily: "var(--ff-display)", fontSize: 14,
                    color: "var(--sp-text)", textAlign: "left",
                  }}
                >
                  <span style={{
                    width: 14, height: 14, borderRadius: "50%",
                    background: c.hex, flexShrink: 0,
                    border: "1.5px solid rgba(0,0,0,0.12)"
                  }}/>
                  {c.name}
                  {selectedColor === c.name && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ marginLeft: "auto" }}>
                      <path d="M5 13l4 4L19 7" stroke="#2962ff" strokeWidth="2.5" strokeLinecap="round"/>
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Image Grid — only shown when a color is selected */}
        {selectedColor && (
          <>
            <p style={{
              fontFamily: "var(--ff-display)", fontSize: 12, fontWeight: 600,
              color: "#64748b", marginBottom: 12,
            }}>
              {selectedColor} — tap images to select · tap again to deselect
            </p>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {/* Existing product images */}
              {uploadedProductImages.map((imgUrl, idx) => {
                const isSelected = selectedUrls.includes(imgUrl);
                return (
                  <div
                    key={idx}
                    onClick={() => toggleImage(imgUrl)}
                    style={{
                      width: 90, height: 90, borderRadius: 10,
                      overflow: "hidden", cursor: "pointer",
                      position: "relative", flexShrink: 0,
                      border: isSelected ? "3px solid #2962ff" : "2px solid rgba(0,0,0,0.1)",
                      boxSizing: "border-box",
                      transform: isSelected ? "scale(1.04)" : "scale(1)",
                      transition: "all 0.15s",
                    }}
                  >
                    <img
                      src={imgUrl}
                      alt={`Product ${idx + 1}`}
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                    {isSelected && (
                      <>
                        <div style={{
                          position: "absolute", inset: 0,
                          background: "rgba(41,98,255,0.2)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          <div style={{
                            width: 24, height: 24, borderRadius: "50%",
                            background: "#2962ff",
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                              <path d="M5 13l4 4L19 7" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
                            </svg>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleImage(imgUrl);
                          }}
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
                      </>
                    )}
                    <div style={{
                      position: "absolute", bottom: 3, right: 4,
                      background: "rgba(0,0,0,0.5)", borderRadius: 4,
                      padding: "1px 5px",
                      fontSize: 9, fontWeight: 700, color: "white",
                      fontFamily: "var(--ff-display)",
                    }}>
                      {idx + 1}
                    </div>
                  </div>
                );
              })}

              {/* + Add Image tile — opens file picker */}
              <div
                onClick={() => fileRef.current?.click()}
                style={{
                  width: 90, height: 90, borderRadius: 10,
                  border: "2px dashed rgba(0,0,0,0.2)",
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  cursor: "pointer", gap: 6, flexShrink: 0,
                  background: "#f8f9fa",
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="3" width="18" height="18" rx="2" stroke="#94a3b8" strokeWidth="1.5"/>
                  <path d="M12 8v8M8 12h8" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <span style={{ fontSize: 9, fontWeight: 700, color: "#94a3b8", fontFamily: "var(--ff-display)" }}>
                  + Add Image
                </span>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={handleAddImage}
              />
            </div>

            {/* Selected count feedback */}
            {selectedUrls.length > 0 && (
              <p style={{
                marginTop: 10,
                fontFamily: "var(--ff-display)", fontSize: 12,
                color: "#2962ff", fontWeight: 600,
              }}>
                {selectedUrls.length} image{selectedUrls.length > 1 ? "s" : ""} selected for {selectedColor}
              </p>
            )}

            {/* Limit error feedback */}
            {limitError && (
              <p style={{
                marginTop: 6,
                fontFamily: "var(--ff-display)", fontSize: 12,
                color: "#ef4444", fontWeight: 600,
              }}>
                ⚠️ {limitError}
              </p>
            )}
          </>
        )}

        {uploadedProductImages.length === 0 && selectedColor && (
          <div style={{
            padding: "14px", borderRadius: 10,
            background: "#fff7ed", border: "1.5px solid #fed7aa",
            fontFamily: "var(--ff-display)", fontSize: 12, color: "#92400e",
          }}>
            ⚠️ No product images found. Please upload product images in the Product Info step first.
          </div>
        )}

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20, gap: 12 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "10px 20px", borderRadius: 8,
              border: "1px solid rgba(0,0,0,0.12)",
              background: "white", cursor: "pointer",
              fontFamily: "var(--ff-display)", fontSize: 13, fontWeight: 600,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDone}
            style={{
              padding: "10px 24px", borderRadius: 8,
              background: "#2962ff", color: "white",
              border: "none", cursor: "pointer",
              fontFamily: "var(--ff-display)", fontSize: 13, fontWeight: 700,
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

/* ── COLOUR AND EDIT SECTION ── */
const ColourAndEditSection = ({
  optionFields, values, basePrice, specFields,
  onColourImagesChange, confirmedColors, onConfirmedColorsChange,
  colorError, variantPrices, onVariantPricesChange,
  uploadedProductImages = [],
  colourImages = {},
  onAddUploadedImage,
}) => {
  const [availableColors,  setAvailableColors]  = useState(DEFAULT_COLORS);
  const [tempColors,       setTempColors]       = useState([]);
  const [colorModalOpen,   setColorModalOpen]   = useState(false);
  const [connectImageOpen, setConnectImageOpen] = useState(false);
  const [editModalOpen,    setEditModalOpen]    = useState(false);

  useEffect(() => {
    const colorField = optionFields.find(f => {
      return (f.elementType || "").toLowerCase() === "color picker";
    });

    if (colorField) {
      const rawChoices = Array.isArray(colorField.choices)
        ? colorField.choices
        : (colorField.choices ? colorField.choices.split(",").map(c => c.trim()).filter(Boolean) : []);

      if (rawChoices.length > 0) {
        const parsed = rawChoices.map(c => {
          if (c && typeof c === "object") {
            return {
              name: c.description || c.name || c.value || "",
              hex:  c.value || c.hex || "#000000",
            };
          }
          const name = String(c).trim();
          const lower = name.toLowerCase();
          const hex = COLOR_MAP[lower] || "#94a3b8";
          return { name, hex };
        }).filter(c => c.name);
        setAvailableColors(parsed);
      } else {
        setAvailableColors(DEFAULT_COLORS);
      }
    } else {
      setAvailableColors(DEFAULT_COLORS);
    }
  }, [optionFields]);


  const buildVariants = useCallback(() => {
    const optionSelections = optionFields.map(f => {
      const key = f.fieldId || f.title;
      const v   = values[key];
      const selected = Array.isArray(v) ? v : (v ? [v] : []);
      return { fieldTitle: f.title, selected };
    }).filter(x => x.selected.length > 0);

    const nonColorOptionSelections = optionSelections.filter(x => {
      const titleLower = (x.fieldTitle || "").toLowerCase().trim();
      return titleLower !== "color" && titleLower !== "colour";
    });

    const nonColorOptionCombos = nonColorOptionSelections.flatMap(({ fieldTitle, selected }) =>
      selected.map(label => ({ optionField: fieldTitle, optionLabel: label }))
    );

    if (confirmedColors.length > 0) {
      if (nonColorOptionCombos.length > 0) {
        return confirmedColors.flatMap(col =>
          nonColorOptionCombos.map(opt => ({
            color:       col.name,
            optionField: opt.optionField,
            optionLabel: opt.optionLabel,
            key:         `${col.name}__${opt.optionField}__${opt.optionLabel}`,
          }))
        );
      } else {
        return confirmedColors.map(col => ({
          color:       col.name,
          optionField: null,
          optionLabel: null,
          key:         col.name,
        }));
      }
    }

    return nonColorOptionCombos.map(opt => ({
      color:       null,
      optionField: opt.optionField,
      optionLabel: opt.optionLabel,
      key:         `${opt.optionField}__${opt.optionLabel}`,
    }));
  }, [optionFields, values, confirmedColors]);

  const variants = buildVariants();

  const handleOpenColorPicker = () => {
    setTempColors([...confirmedColors]);
    setColorModalOpen(true);
  };

  const handleToggleColor = (c) => {
    setTempColors(prev =>
      prev.some(x => x.name === c.name)
        ? prev.filter(x => x.name !== c.name)
        : [...prev, c]
    );
  };

  const handleAddCustomColor = (newColor) => {
    setAvailableColors(prev => {
      if (prev.some(c => c.name === newColor.name)) return prev;
      return [...prev, newColor];
    });
    setTempColors(prev => {
      if (prev.some(c => c.name === newColor.name)) return prev;
      return [...prev, newColor];
    });
  };

  const handleColorDone = () => {
    const next = tempColors;
    const updatedImages = {};
    next.forEach(c => {
      if (colourImages[c.name] !== undefined) {
        updatedImages[c.name] = colourImages[c.name];
      }
    });
    if (onColourImagesChange) onColourImagesChange(updatedImages);
    if (onConfirmedColorsChange) onConfirmedColorsChange(next);
    setColorModalOpen(false);
  };

  const handlePriceChange = useCallback((key, val) => {
    if (onVariantPricesChange) {
      onVariantPricesChange(prev => ({ ...prev, [key]: val }));
    }
  }, [onVariantPricesChange]);

  // Count total mapped images
  const mappedCount = confirmedColors.filter(c => {
    const val = colourImages[c.name];
    if (!val) return false;
    if (Array.isArray(val)) return val.length > 0;
    return !!val;
  }).length;

  const hasColorPickerOption = optionFields.some(f =>
    (f.elementType || "").toLowerCase() === "color picker"
  );

  return (
    <>
      {hasColorPickerOption && (
        <div style={{ marginTop: 16 }}>
          {/* Header row: Colour label + Connect Image button */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <label className="sp-label" style={{ margin: 0 }}>Color</label>
              <button
                type="button"
                className="sp-ms-chip"
                style={{
                  borderStyle: "dashed", margin: 0, padding: "4px 10px", fontSize: 12, height: "auto",
                  background: "transparent", border: "1px dashed #d1d5db", borderRadius: 6, cursor: "pointer",
                  color: "#4b5563"
                }}
                onClick={handleOpenColorPicker}
              >
                {confirmedColors.length === 0 ? "+ Select colors" : "Edit colors"}
              </button>
            </div>
            {confirmedColors.length > 0 && (
              <div style={{ position: "relative" }}>
                <button
                  type="button"
                  onClick={() => setConnectImageOpen(true)}
                  style={{
                    background: "none", border: "1.5px solid var(--sp-primary, #2962ff)",
                    borderRadius: 6, padding: "4px 10px", cursor: "pointer",
                    fontFamily: "var(--ff-display)", fontSize: 12, fontWeight: 700,
                    color: "var(--sp-primary, #2962ff)",
                    display: "flex", alignItems: "center", gap: 5,
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="1.5"/>
                    <polyline points="21 15 16 10 5 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  {mappedCount > 0 ? "Edit Connected Images" : "Connect Image"}
                  {mappedCount > 0 && (
                    <span style={{
                      background: "var(--sp-primary, #2962ff)", color: "white",
                      borderRadius: 10, padding: "0 6px", fontSize: 10, fontWeight: 800,
                    }}>
                      {mappedCount}
                    </span>
                  )}
                </button>
                {/* ConnectImageModal removed here to prevent double rendering */}
              </div>
            )}
          </div>

          {/* Color chips row */}
          <div className="sp-color-row" style={{ marginTop: 4 }}>
            {confirmedColors.map(c => {
              const imgVal = colourImages[c.name];
              const hasMapped = imgVal && (Array.isArray(imgVal) ? imgVal.length > 0 : !!imgVal);
              return (
                <div
                  key={c.name}
                  className="sp-color-chip sp-color-chip--active"
                  onClick={handleOpenColorPicker}
                  title="Click to edit colors"
                  style={{ position: "relative" }}
                >
                  <span className="sp-color-dot" style={{ background: c.hex }}/>
                  {c.name}
                  {hasMapped && (
                    <span style={{
                      width: 8, height: 8, borderRadius: "50%",
                      background: "#22c55e", border: "1.5px solid white",
                      position: "absolute", top: -2, right: -2,
                    }}/>
                  )}
                </div>
              );
            })}
          </div>

          {/* Selected colours summary */}
          {confirmedColors.length > 0 && (
            <div className="sp-color-summary">
              <span className="sp-color-summary-label">Selected Colors:</span>
              <span>{confirmedColors.map(c => c.name).join(", ")}</span>
            </div>
          )}

          {/* Color validation error */}
          {colorError && (
            <p className="sp-error-text sp-error-anim" style={{ marginTop: 6 }}>{colorError}</p>
          )}

          {/* Compact image mapping summary */}
          {confirmedColors.length > 0 && (
            <div style={{ marginTop: 12 }}>
              {confirmedColors.map(c => {
                const imgVal = colourImages[c.name];
                const urls = imgVal
                  ? (Array.isArray(imgVal) ? imgVal : [imgVal]).filter(Boolean)
                  : [];
                return (
                  <div key={c.name} style={{
                    display: "flex", alignItems: "center", gap: 8,
                    marginBottom: 6, padding: "6px 10px",
                    background: urls.length > 0 ? "rgba(34,197,94,0.06)" : "rgba(0,0,0,0.03)",
                    borderRadius: 8,
                    border: urls.length > 0 ? "1px solid rgba(34,197,94,0.2)" : "1px solid rgba(0,0,0,0.06)",
                  }}>
                    <span style={{
                      width: 12, height: 12, borderRadius: "50%",
                      background: c.hex, flexShrink: 0,
                      border: "1.5px solid rgba(0,0,0,0.12)",
                    }}/>
                    <span style={{
                      fontFamily: "var(--ff-display)", fontSize: 12,
                      fontWeight: 600, color: "var(--sp-text)", flex: 1,
                    }}>
                      {c.name}
                    </span>
                    {urls.length > 0 ? (
                      <div style={{ display: "flex", gap: 4 }}>
                        {urls.slice(0, 3).map((url, i) => (
                          <img key={i} src={url} alt=""
                            style={{ width: 24, height: 24, borderRadius: 4, objectFit: "cover", border: "1px solid rgba(0,0,0,0.1)" }}
                          />
                        ))}
                        {urls.length > 3 && (
                          <span style={{ fontSize: 10, color: "#64748b", fontFamily: "var(--ff-display)", alignSelf: "center" }}>
                            +{urls.length - 3}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span style={{ fontSize: 11, color: "#f59e0b", fontFamily: "var(--ff-display)", fontWeight: 600 }}>
                        No image
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Variant pricing row */}
      <div className="sp-edit-row" style={{ marginTop: 12, padding: "10px 14px" }}>
        <div className="sp-edit-row-left">
          Manage pricing for each product variant
          <span className="sp-edit-row-count">
            {variants.length > 0
              ? `${variants.length} variant${variants.length !== 1 ? "s" : ""} generated`
              : "— select options above to generate variants"}
          </span>
        </div>
        <button
          type="button"
          className="sp-edit-btn"
          disabled={optionFields.length === 0}
          onClick={() => setEditModalOpen(true)}
          style={{ padding: "6px 12px", fontSize: 12 }}
        >
          <EditIcon size={12} /> Edit
        </button>
      </div>

      <ConnectImageModal
        open={connectImageOpen}
        onClose={() => setConnectImageOpen(false)}
        confirmedColors={confirmedColors}
        uploadedProductImages={uploadedProductImages}
        colourImages={colourImages}
        onColourImagesChange={(newMappings) => {
          if (onColourImagesChange) onColourImagesChange(newMappings);
          setConnectImageOpen(false);
        }}
        onAddUploadedImage={onAddUploadedImage}
      />

      {/* Color Picker Modal */}
      <ColorPickerModal
        open={colorModalOpen}
        availableColors={availableColors}
        tempColors={tempColors}
        onToggle={handleToggleColor}
        onAdd={handleAddCustomColor}
        onCancel={() => setColorModalOpen(false)}
        onDone={handleColorDone}
      />

      {/* Variant Pricing Modal */}
      <VariantPricingModal
        open={editModalOpen}
        variants={variants}
        availableColors={availableColors}
        variantPrices={variantPrices}
        onPriceChange={handlePriceChange}
        onClose={() => setEditModalOpen(false)}
        basePrice={basePrice}
      />
    </>
  );
};

/* ── HELPER ── */
const resolveSubcategoryId = (subcategory, category) => {
  if (!subcategory) return null;
  // Handle plain string ID (edit mode passes subcategory as string or object)
  if (typeof subcategory === "string" && subcategory.trim() !== "") return subcategory.trim();
  const candidates = [
    subcategory._id, subcategory.id, subcategory.subcategoryId,
    subcategory.SubCategoryID, subcategory.subCategoryId, subcategory.categoryId,
  ];
  for (const c of candidates) {
    if (c && typeof c === "string" && c.trim() !== "") return c.trim();
  }
  console.warn("[SpecificationPage] Could not find subcategory ID. Full object:", subcategory);
  return category?.CategoryID ?? category?._id ?? null;
};

/* ════════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════════ */
const SpecificationPage = () => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { category: rawCategory, subcategory: rawSubcategory, formData, images: initialImages, specifications, isEditMode, isDuplicateMode, editData: rawEditData, tableId, origin, email } = location.state || {};

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
  } : null);

  const subcategory = rawSubcategory || (editData ? {
    name: editData.subCategory || "",
    _id: editData.subCategoryId || editData.SubCategoryID || editData.subcategoryId || "",
    subcategoryId: editData.subCategoryId || editData.SubCategoryID || editData.subcategoryId || "",
    SubCategoryID: editData.SubCategoryID || "",
  } : null);
  const basePrice = (formData?.onSale && formData?.salePrice) ? formData.salePrice : (formData?.price || "");

  const [images, setImages] = useState(() => initialImages || []);
  const [newlyUploadedImages, setNewlyUploadedImages] = useState([]);

  const [fields,          setFields]          = useState([]);
  const [confirmedColors, setConfirmedColors] = useState(() => {
    if (location.state?.confirmedColors) return location.state.confirmedColors;
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
  });
  const [colourImages,    setColourImages]    = useState(() => {
    if (location.state?.colourImages) return location.state.colourImages;
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
  });
  // Resolve size chart URL from editData
  const resolveSizeChartUrl = () =>
    editData?.sizeChart ||
    editData?.size_chart ||
    editData?.sizeChartUrl ||
    editData?.size_chart_url ||
    editData?.sizeChartImage ||
    null;

  const buildInitialValues = () => {
    if (specifications && Object.keys(specifications).length > 0) return specifications;
    if ((isEditMode || isDuplicateMode) && editData) {
      const merged = {};

      // Pull from additionalInfoSections (spec fields)
      if (Array.isArray(editData.additionalInfoSections)) {
        editData.additionalInfoSections.forEach(section => {
          Object.entries(section).forEach(([k, v]) => {
            if (k !== "title" && k !== "description" && v != null && v !== "") {
              merged[k] = v;
            }
          });
        });
      }

      // Pull from productOptions (option fields like Size, Color)
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
          .map(c => (typeof c === "object" ? (c.value || c.description || c.name || "") : String(c)))
          .filter(Boolean);

        if (selectedValues.length === 0) return;

        const keyVariants = [
          optName,
          optName.toLowerCase(),
          optName.toUpperCase(),
          optName.charAt(0).toUpperCase() + optName.slice(1).toLowerCase(),
        ];

        const storeValue = selectedValues.length === 1 ? selectedValues[0] : selectedValues;
        keyVariants.forEach(k => { merged[k] = storeValue; });
      });
      return merged;
    }
    return {};
  };

  const [values, setValues] = useState(buildInitialValues);

  const [variantPrices,   setVariantPrices]   = useState(location.state?.variantPrices || {});
  const variantPricesLoadedRef = useRef(!!location.state?.variantPrices);

  useEffect(() => {
    if ((isEditMode || isDuplicateMode) && editData?.varientPrice && !variantPricesLoadedRef.current) {
      const currentOptionFields = fields.filter(f => f.type === "Product Options");
      if (currentOptionFields.length === 0 && confirmedColors.length === 0) return;

      const optionSelections = currentOptionFields.map(f => {
        const key = f.fieldId || f.title;
        const v = values[key];
        const selected = Array.isArray(v) ? v : (v ? [v] : []);
        return { fieldTitle: f.title, selected };
      }).filter(x => x.selected.length > 0);

      const nonColorOptionSelections = optionSelections.filter(x => {
        const titleLower = (x.fieldTitle || "").toLowerCase().trim();
        return titleLower !== "color" && titleLower !== "colour";
      });

      const nonColorOptionCombos = nonColorOptionSelections.flatMap(({ fieldTitle, selected }) =>
        selected.map(label => ({ optionField: fieldTitle, optionLabel: label }))
      );

      let currentVariants = [];
      if (confirmedColors.length > 0) {
        if (nonColorOptionCombos.length > 0) {
          currentVariants = confirmedColors.flatMap(col =>
            nonColorOptionCombos.map(opt => ({
              color: col.name,
              optionField: opt.optionField,
              optionLabel: opt.optionLabel,
              key: `${col.name}__${opt.optionField}__${opt.optionLabel}`,
            }))
          );
        } else {
          currentVariants = confirmedColors.map(col => ({
            color: col.name,
            optionField: null,
            optionLabel: null,
            key: col.name,
          }));
        }
      } else {
        currentVariants = nonColorOptionCombos.map(opt => ({
          color: null,
          optionField: opt.optionField,
          optionLabel: opt.optionLabel,
          key: `${opt.optionField}__${opt.optionLabel}`,
        }));
      }

      if (currentVariants.length > 0) {
        const initialPrices = getInitialVariantPrices(currentVariants, editData.varientPrice, editData);
        if (Object.keys(initialPrices).length > 0) {
          setVariantPrices(initialPrices);
        }
        variantPricesLoadedRef.current = true;
      }
    }
  }, [editData, fields, values, confirmedColors, isEditMode, isDuplicateMode]);
  // In edit mode, merge editData fields into initial values if no prior specifications exist
  const [loading,         setLoading]         = useState(false);
  const [apiError,        setApiError]        = useState("");
  const [fieldErrors,     setFieldErrors]     = useState({});
  const [touched,         setTouched]         = useState({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [mounted,         setMounted]         = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    console.group("[SpecificationPage] Navigation state received");
    console.log("category   :", category);
    console.log("subcategory:", subcategory);
    console.log("basePrice  :", basePrice);
    console.groupEnd();

    // In edit mode, try to get subcategory ID from editData directly
const subcategoryId = (isEditMode || isDuplicateMode)
  ? (editData?.subCategoryId || editData?.SubCategoryID || editData?.subcategoryId || resolveSubcategoryId(subcategory, category))
  : resolveSubcategoryId(subcategory, category);

if (!subcategoryId) {
  console.warn("[SpecificationPage] No subcategoryId; skipping API call.");
  return;
}
    (async () => {
      setLoading(true);
      setApiError("");
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
        console.error("[SpecificationPage] CategoryFields API error:", err);
        setApiError("Could not load specifications for this category. You can still continue.");
        setFields([]);
      } finally {
        setLoading(false);
      }
    })();
   // Inject size chart value once fields are loaded in edit mode

  }, [subcategory, category, isEditMode, editData]);
  
  useEffect(() => {
    if ((!isEditMode && !isDuplicateMode) || !editData || fields.length === 0) return;
    // ADD THIS TEMPORARILY
  console.log("[SpecPage] editData.productOptions:", editData.productOptions);
  console.log("[SpecPage] fields:", fields.map(f => ({ title: f.title, fieldId: f.fieldId, elementType: f.elementType })));
    setValues(prev => {
      const next = { ...prev };

      // ── Inject size chart ──
      const sizeChartUrl = resolveSizeChartUrl(editData);
      if (sizeChartUrl) {
        const sizeChartFile = { name: "size-chart-image", url: sizeChartUrl, isExisting: true };
        const sizeChartField = fields.find(f => {
          const title = (f.title || "").toLowerCase().trim();
          const id    = (f.fieldId || "").toLowerCase().trim();
          const et    = (f.elementType || "").toLowerCase().trim();
          const ph    = (f.placeholderText || "").toLowerCase().trim();
          return (
            et === "upload" || et === "file" || ph === "upload" ||
            title.includes("size chart") || title.includes("size chat") ||
            title.includes("upload") ||
            id.includes("sizechart") || id.includes("size_chart") || id.includes("upload")
          );
        });
        if (sizeChartField) {
          const key = sizeChartField.fieldId || sizeChartField.title;
          if (!next[key] || next[key] === "") next[key] = sizeChartFile;
        }
      }

      // ── Inject product options ──
      // ── Inject product options ──
// Normalize to array regardless of whether API returned object or array
const rawOpts = editData.productOptions;
const optsArray = Array.isArray(rawOpts)
  ? rawOpts
  : rawOpts && typeof rawOpts === "object"
    ? Object.entries(rawOpts).map(([key, opt]) => ({
        name: opt?.name || key,
        choices: opt?.choices || [],
      }))
    : [];

optsArray.forEach(opt => {
  const optName = (opt.name || opt.optionType || "").trim();
  if (!optName) return;

  const choices = opt.choices || opt.values || opt.options || [];
  const selectedValues = choices
    .map(c => (typeof c === "object" ? (c.value || c.description || c.name || "") : String(c)))
    .filter(Boolean);
  if (selectedValues.length === 0) return;

  const matchedField = fields.find(f => {
    const ftitle = (f.title || "").toLowerCase().trim();
    const fid    = (f.fieldId || "").toLowerCase().trim();
    const oname  = optName.toLowerCase();
    return ftitle === oname || fid === oname ||
           ftitle.includes(oname) || oname.includes(ftitle);
  });

  if (matchedField) {
    const key = matchedField.fieldId || matchedField.title;
    if (!next[key] || (Array.isArray(next[key]) && next[key].length === 0) || next[key] === "") {
      const et = (matchedField.elementType || "").toLowerCase();
      const isMulti = et === "multiselect" || et === "multi_select" ||
                      et === "selection tag" || et === "selectiontag";
      next[key] = isMulti ? selectedValues : selectedValues[0];
    }
  }
});

      return next;
    });
  }, [fields, isEditMode, editData]);
  const handleChange = useCallback((fieldId, val) => {
    setValues(prev => ({ ...prev, [fieldId]: val }));
    setTouched(prev => ({ ...prev, [fieldId]: true }));
    if (fieldErrors[fieldId]) setFieldErrors(prev => ({ ...prev, [fieldId]: "" }));
  }, [fieldErrors]);

  const validate = () => {
    const errors = {};
    fields.forEach(f => {
      if (!f.required) return;
      const key = f.fieldId || f.title;
      const v   = values[key];
      if (v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) {
        errors[key] = `${f.title} is required`;
      }
    });

    // Size validation: optional, but if selected, requires at least 2 sizes
    const sizeField = fields.find(f => {
      const t = (f.title || "").toLowerCase().trim();
      return f.type === "Product Options" && (t === "size" || t === "sizes");
    });
    if (sizeField) {
      const sizeKey = sizeField.fieldId || sizeField.title;
      const sizeVal = values[sizeKey];
      const sizeArr = Array.isArray(sizeVal) ? sizeVal : (sizeVal ? [sizeVal] : []);
      if (sizeArr.length === 1) {
        errors[sizeKey] = "Please select at least 2 size options.";
      }
    }

    // Color validation: if any color is selected, require at least 2, and ensure every color has an image
    const colorField = fields.find(f => {
      return f.type === "Product Options" && (f.elementType || "").toLowerCase() === "color picker";
    });
    if (colorField) {
      // confirmedColors is the source of truth for color selection
      if (confirmedColors.length === 1) {
        // Use a special key to show error near color section
        errors["__colorSelection__"] = "Please select at least 2 colors, or select none.";
      } else if (confirmedColors.length > 1) {
        const missingColors = confirmedColors
          .filter(c => {
            const imgVal = colourImages[c.name];
            const urls = imgVal
              ? (Array.isArray(imgVal) ? imgVal : [imgVal]).filter(Boolean)
              : [];
            return urls.length === 0;
          })
          .map(c => c.name);

        if (missingColors.length > 0) {
          const getMissingColorsMessage = (list) => {
            if (list.length === 1) {
              return `Please upload an image for ${list[0]} color.`;
            }
            if (list.length === 2) {
              return `Please upload images for ${list[0]} and ${list[1]} colors.`;
            }
            const allButLast = list.slice(0, -1).join(", ");
            const last = list[list.length - 1];
            return `Please upload images for ${allButLast} and ${last} colors.`;
          };
          errors["__colorSelection__"] = getMissingColorsMessage(missingColors);
        }
      }
    }

    // Pending file upload checks (e.g. Size Chart)
    fields.forEach(f => {
      const key = f.fieldId || f.title;
      if (values[key] === "__PENDING_FILE__") {
        const titleLower = (f.title || "").toLowerCase();
        if (titleLower.includes("size chart") || titleLower.includes("size chat")) {
          errors[key] = "Please wait until the size chart image upload is completed.";
        } else {
          errors[key] = `Please wait until the ${f.title} upload is completed.`;
        }
      }
    });

    return errors;
  };

  const handleContinue = () => {
    setSubmitAttempted(true);
    console.log("Size chart value at continue:", Object.entries(values).find(([k]) => k.toLowerCase().includes("size") || k.toLowerCase().includes("upload")));

    // Collect size selections for logging
    const sizeField = fields.find(f => {
      const t = (f.title || "").toLowerCase().trim();
      return f.type === "Product Options" && (t === "size" || t === "sizes");
    });
    const sizeKey = sizeField ? (sizeField.fieldId || sizeField.title) : null;
    const selectedSizes = sizeKey
      ? (Array.isArray(values[sizeKey]) ? values[sizeKey] : (values[sizeKey] ? [values[sizeKey]] : []))
      : [];
    console.log("Selected Sizes:", selectedSizes);
console.log("Specifications (raw values):", values);

// Show exactly what will be stored in DB
const optionKeySet = new Set(fields.filter(f => f.type === "Product Options").map(f => f.fieldId || f.title));
const previewOptionFields = fields.filter(f => f.type === "Product Options");
const previewAdditionalInfoSections = Object.entries(values).reduce((acc, [key, val]) => {
  if (optionKeySet.has(key)) return acc;
  if (!val || val === "") return acc;
  if (val instanceof File) return acc;
  if (typeof val === "object" && val.isExisting) return acc;
  const display = Array.isArray(val) ? val.join(", ") : String(val);
  if (!display) return acc;
  acc.push({ [key]: display });
  return acc;
}, []);

const previewProductOptions = {};
previewOptionFields.forEach(field => {
  const key = field.fieldId || field.title;
  const val = values[key];
  if (!val) return;
  const selected = Array.isArray(val) ? val : [val];
  if (selected.length === 0) return;
  previewProductOptions[field.title] = {
    name: field.title,
    optionType: "drop_down",
    choices: selected.map(v => ({ value: String(v), description: String(v) })),
  };
});

// Build productOptions preview in exact DB format
const previewColorOptionField = fields.find(f =>
  f.type === "Product Options" &&
  (f.elementType || "").toLowerCase() === "color picker"
);
const previewProductOptionsForLog = { ...previewProductOptions };
if (previewColorOptionField && confirmedColors.length > 0) {
  previewProductOptionsForLog[previewColorOptionField.title] = {
    choices: confirmedColors.map(c => {
      const choice = { description: c.name, value: c.hex };
      const img = colourImages[c.name];
      if (img) {
        const url = img instanceof File ? "[File — uploaded on submit]" : (img?.url || img?.mediaUrl || "");
        if (url) choice.mediaItems = [{ id: url.split("/").pop()?.split("?")[0] || c.name, src: url, type: "image" }];
      }
      return choice;
    }),
  };
}

console.group("[SpecificationPage] === DB FORMAT PREVIEW ===");
console.log("Product Options:", JSON.stringify(previewProductOptionsForLog, null, 2));
console.log("Specifications:", JSON.stringify(previewAdditionalInfoSections, null, 2));
console.groupEnd();

    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const allTouched = {};
      fields.forEach(f => { allTouched[f.fieldId || f.title] = true; });
      setTouched(allTouched);
      const firstError = document.querySelector(".sp-input--error, .sp-dropdown-wrap--error, .sp-error-text");
      if (firstError) firstError.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    // Build optionFields and variants to pass forward
    const currentOptionFields = fields.filter(f => f.type === "Product Options");
    const currentSpecFieldsList = fields;

    // Build variants the same way ColourAndEditSection does
    const buildVariantsForNav = () => {
      const optionSelections = currentOptionFields.map(f => {
        const key = f.fieldId || f.title;
        const v = values[key];
        const selected = Array.isArray(v) ? v : (v ? [v] : []);
        return { fieldTitle: f.title, selected };
      }).filter(x => x.selected.length > 0);

      const nonColorOptionSelections = optionSelections.filter(x => {
        const titleLower = (x.fieldTitle || "").toLowerCase().trim();
        return titleLower !== "color" && titleLower !== "colour";
      });

      const nonColorOptionCombos = nonColorOptionSelections.flatMap(({ fieldTitle, selected }) =>
        selected.map(label => ({ optionField: fieldTitle, optionLabel: label }))
      );

      if (confirmedColors.length > 0) {
        if (nonColorOptionCombos.length > 0) {
          return confirmedColors.flatMap(col =>
            nonColorOptionCombos.map(opt => ({
              color: col.name,
              optionField: opt.optionField,
              optionLabel: opt.optionLabel,
              key: `${col.name}__${opt.optionField}__${opt.optionLabel}`,
            }))
          );
        } else {
          return confirmedColors.map(col => ({
            color: col.name,
            optionField: null,
            optionLabel: null,
            key: col.name,
          }));
        }
      }

      return nonColorOptionCombos.map(opt => ({
        color: null,
        optionField: opt.optionField,
        optionLabel: opt.optionLabel,
        key: `${opt.optionField}__${opt.optionLabel}`,
      }));
    };

    const builtVariants = buildVariantsForNav();

    console.group("[SpecificationPage:handleContinue] Passing to next page");
    console.log("optionFields:", currentOptionFields);
    console.log("specFieldsList:", currentSpecFieldsList.map(f => f.title));
    console.log("variants:", builtVariants);
    console.log("confirmedColors:", confirmedColors);
    console.log("colourImages keys:", Object.keys(colourImages));
    console.log("specifications:", values);
    console.groupEnd();

    navigate(
      isEditMode && !isDuplicateMode
        ? `/dashboard/listing/edit/${tableId}/product-info/specifications/promotions`
        : "/dashboard/listing/select-category/product-info/specifications/promotions",
      {
        state: {
          category,
          subcategory,
          formData,
          images,
          specifications: values,
          isEditMode: isEditMode && !isDuplicateMode,
          isDuplicateMode,
          editData,
          tableId: isDuplicateMode ? null : tableId,
          origin,
          email,
          colourImages,
          confirmedColors,
          // CRITICAL: pass these so ReviewSubmitPage can display options/variants/specs
          optionFields: currentOptionFields,
          specFieldsList: currentSpecFieldsList,
          variants: builtVariants,
          variantPrices: variantPrices, // lifted state — contains actual pricing data
          promotionImage: location.state?.promotionImage || null,
          keywords: location.state?.keywords || null,
          discountType: location.state?.discountType,
        },
      }
    );
  };

  const handleBack = () => {
    navigate(
      isEditMode && !isDuplicateMode
        ? `/dashboard/listing/edit/${tableId}/product-info`
        : "/dashboard/listing/select-category/product-info",
      {
        state: {
          category,
          subcategory,
          formData,
          images,
          isEditMode: isEditMode && !isDuplicateMode,
          isDuplicateMode,
          editData,
          tableId: isDuplicateMode ? null : tableId,
          origin,
          email,
          specifications: values,
          colourImages,
          confirmedColors,
          variantPrices,
          promotionImage: location.state?.promotionImage || null,
          keywords: location.state?.keywords || null,
          discountType: location.state?.discountType,
        },
      }
    );
  };

  const previewVariants = (() => {
    const currentOptionFields = fields.filter(f => f.type === "Product Options");
    const optionSelections = currentOptionFields.map(f => {
      const key = f.fieldId || f.title;
      const v = values[key];
      const selected = Array.isArray(v) ? v : (v ? [v] : []);
      return { fieldTitle: f.title, selected };
    }).filter(x => x.selected.length > 0);

    const nonColorOptionSelections = optionSelections.filter(x => {
      const titleLower = (x.fieldTitle || "").toLowerCase().trim();
      return titleLower !== "color" && titleLower !== "colour";
    });

    const nonColorOptionCombos = nonColorOptionSelections.flatMap(({ fieldTitle, selected }) =>
      selected.map(label => ({ optionField: fieldTitle, optionLabel: label }))
    );

    if (confirmedColors.length > 0) {
      if (nonColorOptionCombos.length > 0) {
        return confirmedColors.flatMap(col =>
          nonColorOptionCombos.map(opt => ({
            color: col.name,
            optionField: opt.optionField,
            optionLabel: opt.optionLabel,
            key: `${col.name}__${opt.optionField}__${opt.optionLabel}`,
          }))
        );
      } else {
        return confirmedColors.map(col => ({
          color: col.name,
          optionField: null,
          optionLabel: null,
          key: col.name,
        }));
      }
    }

    return nonColorOptionCombos.map(opt => ({
      color: null,
      optionField: opt.optionField,
      optionLabel: opt.optionLabel,
      key: `${opt.optionField}__${opt.optionLabel}`,
    }));
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

  return (
    <div className={`sp-root ${mounted ? "sp-root--mounted" : ""}`}>

      {/* Back button */}
      <button className="sp-back-btn" onClick={handleBack}>
        <ArrowLeftIcon size={15} />
        Back to Product Info
      </button>

      {/* Header */}
      <div className="sp-header">
        <h1 className="sp-title">Product Specifications</h1>
        <p className="sp-subtitle">Add product-specific details and attributes</p>
      </div>

      {/* Step indicators */}
      <StepIndicator currentStep={1}/>
      <StepIndicatorMobile currentStep={1}/>

      {/* Category pill */}
      {(category || subcategory) && (
        <div className="sp-category-pill">
          <TagIcon/>
          <span className="sp-category-text">
            {category?.name}
            {category && subcategory && <span className="sp-category-sep"> › </span>}
            {subcategory?.name}
          </span>
        </div>
      )}

      {/* Info banner */}
      <div className="sp-info-banner">
        <InfoIcon/>
        <span>
          Specifications are unique to your selected category.
          Fields marked <strong>*</strong> are required.
        </span>
      </div>

      {/* Main layout */}
      <div className="sp-layout">

        {/* Form side */}
        <div className="sp-form-side">
          <div className="sp-master-card">
            <div className="sp-card-section-header">
              <TagIcon/>
              <h3 className="sp-section-title">
                Specification's
              </h3>
            </div>

            {loading && (
              <div className="sp-loading-state">
                <LoaderIcon/>
                <span>Loading specifications…</span>
              </div>
            )}

            {!loading && apiError && (
              <div className="sp-api-error">
                <InfoIcon/>
                <span>{apiError}</span>
              </div>
            )}

            {!loading && fields.length === 0 && !apiError && (
              <div className="sp-empty-state">
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.28 }}>
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <p>No specification fields found for this category.</p>
                <span>You can continue to the next step.</span>
              </div>
            )}

            {loading && <SkeletonGrid/>}

            {!loading && fields.length > 0 && (() => {
              const optionFields = fields.filter(f => f.type === "Product Options");
              const specFields   = fields.filter(f => f.type !== "Product Options");
              return (
                <>
                  {optionFields.length > 0 && (
                    <>
                      <div className="sp-section-divider">
                        <span className="sp-section-divider-label">Product Options</span>
                        <p className="sp-section-divider-sub">Variants buyers can choose from (e.g. Size, Color)</p>
                      </div>
                      <div className="sp-form-grid sp-form-grid--full">
  {optionFields
    .filter(field => {
      return (field.elementType || "").toLowerCase() !== "color picker";
    })
    .map((field) => {
      const key = field.fieldId || field.title;
      return (
        <DynamicField key={key} field={field} value={values[key]}
          onChange={(val) => handleChange(key, val)}
          error={fieldErrors[key]}
          touched={touched[key] || submitAttempted}
        />
      );
    })}
</div>

                      <ColourAndEditSection
                        optionFields={optionFields}
                        values={values}
                        basePrice={basePrice}
                        specFields={specFields}
                        confirmedColors={confirmedColors}
                        onConfirmedColorsChange={setConfirmedColors}
                        colorError={fieldErrors["__colorSelection__"]}
                        variantPrices={variantPrices}
                        onVariantPricesChange={setVariantPrices}
                        colourImages={colourImages}
                        uploadedProductImages={(() => {
                          const productUrls = (images || [])
                            .map(img => img?.mediaUrl || img?.url || img?.preview || null)
                            .filter(Boolean);
                          const colorUrls = Object.values(colourImages || {})
                            .flatMap(val => {
                              if (!val) return [];
                              if (Array.isArray(val)) return val;
                              return [val];
                            })
                            .filter(Boolean);
                          return Array.from(new Set([...productUrls, ...newlyUploadedImages, ...colorUrls]));
                        })()}
                        onColourImagesChange={(imgs) => {
                          setColourImages(imgs);
                          console.log("Colour Image Data:", imgs);
                        }}
                        onAddUploadedImage={(newImgUrl) => {
                          setNewlyUploadedImages(prev => [...prev, newImgUrl]);
                        }}
                      />
                    </>
                  )}

                  {specFields.length > 0 && (
                    <>
                      {optionFields.length > 0 && (
                        <div className="sp-section-divider">
                          <span className="sp-section-divider-label">Product Specifications</span>
                          <p className="sp-section-divider-sub">Detailed product attributes</p>
                        </div>
                      )}
                      <div className="sp-form-grid">
                        {specFields.map((field) => {
                          const key = field.fieldId || field.title;
                          return (
                            <DynamicField key={key} field={field} value={values[key]}
                              onChange={(val) => handleChange(key, val)}
                              error={fieldErrors[key]}
                              touched={touched[key] || submitAttempted}
                            />
                          );
                        })}
                      </div>
                    </>
                  )}
                </>
              );
            })()}
          </div>
        </div>

        {/* Preview side */}
        <div className="sp-preview-side">
          <LivePreview
            category={category}
            subcategory={subcategory}
            formData={formData}
            images={images}
            specifications={values}
            confirmedColors={confirmedColors}
            colourImages={colourImages}
            variantPrices={variantPrices}
            promotionImage={previewPromotionImage}
            keywords={previewKeywords}
            fields={fields}
            variants={previewVariants}
          />
        </div>
      </div>

      {/* Mobile preview */}
      <div className="sp-preview-mobile">
        <LivePreview
          category={category}
          subcategory={subcategory}
          formData={formData}
          images={images}
          specifications={values}
          confirmedColors={confirmedColors}
          colourImages={colourImages}
          variantPrices={variantPrices}
          promotionImage={previewPromotionImage}
          keywords={previewKeywords}
          fields={fields}
          variants={previewVariants}
        />
      </div>

      {/* Continue button */}
      <div className="sp-bottom-continue">
        <button className="sp-btn-continue sp-btn-continue--bottom" onClick={handleContinue}>
          Continue
          <ArrowRightIcon size={16}/>
        </button>
      </div>

    </div>
  );
};

export default SpecificationPage;