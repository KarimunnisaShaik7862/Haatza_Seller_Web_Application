import React from "react";
import "./LivePreview.css";

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

const LivePreview = ({
  category = null,
  subcategory = null,
  formData = {},
  images = [],
  specifications = {},
  confirmedColors = [],
  colourImages = {},
  variantPrices = {},
  promotionImage = null,
  keywords = [],
  fields = [],
  optionFields = [],
  variants = [],
}) => {
  // Helpers to check field types
  const isSizeChartField = (f) => {
    if (f.type === "Product Options") return false;
    const titleLower = (f.title || "").toLowerCase().trim();
    const fieldIdLower = (f.fieldId || "").toLowerCase().trim();
    const elementTypeLower = (f.elementType || "").toLowerCase().trim();
    const placeholderLower = (f.placeholderText || "").toLowerCase().trim();
    return (
      elementTypeLower === "upload" ||
      elementTypeLower === "file" ||
      placeholderLower === "upload" ||
      titleLower.includes("size chart") ||
      titleLower.includes("size chat") ||
      titleLower.includes("upload") ||
      fieldIdLower.includes("sizechart") ||
      fieldIdLower.includes("size_chart") ||
      fieldIdLower.includes("upload")
    );
  };

  const isOptionField = (f) => f.type === "Product Options";

  // Category and Subcategory strings
  const catNameRaw = typeof category === "string" ? category : (category?.name || category?.CategoryName || category?.displayName || "");
  const subCatNameRaw = typeof subcategory === "string" ? subcategory : (subcategory?.name || subcategory?.SubCategoryName || subcategory?.displayName || "");

  const catName = String(catNameRaw || "");
  const subCatName = String(subCatNameRaw || "");

  const isCategorySelected = !!catName.trim();
  const isSubcategorySelected = !!subCatName.trim();

  // Basic Info Validation
  const hasName = !!formData?.productName?.trim();
  const hasBrand = !!formData?.brand?.trim();
  const hasPrice = !!(formData?.price && parseFloat(formData.price) > 0);
  const hasStock = !!(formData?.availableStock && parseInt(formData.availableStock) >= 5);
  const hasWeight = !!(formData?.shippingWeight && parseFloat(formData.shippingWeight) > 0);
  const hasReturn = !!formData?.productReturn?.trim();
  const hasImages = !!(images && images.length >= 1);

  // Specifications Validation
  const reqSpecs = (fields || []).filter(f => f.type !== "Product Options" && !isSizeChartField(f) && f.required);
  
  const optFields = (fields || []).filter(isOptionField);
  const sizeField = optFields.find(f => {
    const t = (f.title || "").toLowerCase().trim();
    return t === "size" || t === "sizes";
  });
  let isSizeFilled = true;
  if (sizeField && sizeField.required) {
    const key = sizeField.fieldId || sizeField.title;
    const v = specifications?.[key];
    const sizeArr = Array.isArray(v) ? v : (v ? [v] : []);
    isSizeFilled = sizeArr.length > 0;
  }

  const hasColorPicker = (fields || []).some(f => (f.elementType || "").toLowerCase() === "color picker");
  const colorField = (fields || []).find(f => {
    const t = (f.title || "").toLowerCase().trim();
    return t === "color" || t === "colour";
  });
  let isColorFilled = true;
  if (hasColorPicker && colorField && colorField.required) {
    isColorFilled = (confirmedColors || []).length > 0;
  }

 const filledVariantPricesCount = (variants || []).filter(v => {
    const priceObj = getVariantPriceData(v.key, variantPrices);
    if (!priceObj) return false;
    const rawVal = typeof priceObj === "object" ? priceObj.inputVal : priceObj;
    return rawVal !== undefined && rawVal !== null && rawVal !== "" && !isNaN(parseFloat(rawVal)) && parseFloat(rawVal) >= 0;
  }).length;
  const isVariantPricesFilled = (variants || []).length > 0
    ? filledVariantPricesCount === variants.length
    : true;

  // Promotion Validation (size chart if required)
  const sizeChartField = (fields || []).find(f => isSizeChartField(f));
  const isPromoCompleted = (() => {
    if (sizeChartField && sizeChartField.required) {
      const key = sizeChartField.fieldId || sizeChartField.title;
      const v = specifications?.[key];
      return !!(v && v !== "__PENDING_FILE__");
    }
    return true;
  })();

  // -------------------------------------------------------------
  // Construct dynamic required field checklist (for completion percentage)
  // -------------------------------------------------------------
  const mandatoryFields = [];
  mandatoryFields.push({ label: "Category", isFilled: isCategorySelected });
  mandatoryFields.push({ label: "Subcategory", isFilled: isSubcategorySelected });
  mandatoryFields.push({ label: "Product Name", isFilled: hasName });
  mandatoryFields.push({ label: "Brand", isFilled: hasBrand });
  mandatoryFields.push({ label: "Price", isFilled: hasPrice });
  mandatoryFields.push({ label: "Available Stock", isFilled: hasStock });
  mandatoryFields.push({ label: "Shipping Weight", isFilled: hasWeight });
  mandatoryFields.push({ label: "Product Images", isFilled: hasImages });

  reqSpecs.forEach(f => {
    const key = f.fieldId || f.title;
    const v = specifications?.[key];
    const isFilled = v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0);
    mandatoryFields.push({ label: f.title, isFilled });
  });

  if (sizeField && sizeField.required) {
    mandatoryFields.push({ label: sizeField.title, isFilled: isSizeFilled });
  }

  if (hasColorPicker && colorField && colorField.required) {
    mandatoryFields.push({ label: colorField.title, isFilled: isColorFilled });
  }

  if (sizeChartField && sizeChartField.required) {
    mandatoryFields.push({ label: "Size Chart", isFilled: isPromoCompleted });
  }



  const totalRequired = mandatoryFields.length;
  const filledRequired = mandatoryFields.filter(f => f.isFilled).length;
  const completionPercentage = totalRequired > 0 ? Math.round((filledRequired / totalRequired) * 100) : 100;

  const missingMandatory = mandatoryFields.filter(f => !f.isFilled).map(f => f.label);
  const qcReady = missingMandatory.length === 0;

  // 18 character progress bar (matches prompt example)
  const totalBlocks = 18;
  const filledBlocks = Math.round((completionPercentage / 100) * totalBlocks);
  const emptyBlocks = totalBlocks - filledBlocks;
  const blockProgressBar = "█".repeat(filledBlocks) + "░".repeat(emptyBlocks);

  // -------------------------------------------------------------
  // Construct list of summary fields to display values/status
  // -------------------------------------------------------------
  const summaryFields = [];
  summaryFields.push({ label: "Image", value: images && images.length >= 1 ? "✅ Uploaded" : "Not Uploaded", isFilled: hasImages });
  summaryFields.push({ label: "Product Name", value: formData?.productName || "Not Filled", isFilled: hasName });
  summaryFields.push({ label: "SKU", value: formData?.sku || "Not Filled", isFilled: !!formData?.sku?.trim() });
  summaryFields.push({ label: "Brand", value: formData?.brand || "Not Filled", isFilled: hasBrand });
  summaryFields.push({ label: "Category", value: catName || "Not Selected", isFilled: isCategorySelected });
  summaryFields.push({ label: "Subcategory", value: subCatName || "Not Selected", isFilled: isSubcategorySelected });
  summaryFields.push({ label: "Price", value: formData?.price ? `₹${formData.price}` : "Not Filled", isFilled: hasPrice });
  summaryFields.push({ label: "Available Stock", value: formData?.availableStock || "Not Filled", isFilled: hasStock });
  summaryFields.push({ label: "Shipping Weight", value: formData?.shippingWeight ? `${formData.shippingWeight}` : "Not Filled", isFilled: hasWeight });

  if ((variants || []).length > 0) {
    const variantPriceDisplay = filledVariantPricesCount === 0
      ? "Not Filled"
      : filledVariantPricesCount === variants.length
        ? "All Filled"
        : `${filledVariantPricesCount}/${variants.length} Filled`;
    summaryFields.push({ label: "Variant Prices", value: variantPriceDisplay, isFilled: isVariantPricesFilled });
  }

  // Dynamic dynamic spec values
  reqSpecs.forEach(f => {
    const key = f.fieldId || f.title;
    const v = specifications?.[key];
    const isFilled = v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0);
    const displayVal = isFilled ? (Array.isArray(v) ? v.join(", ") : String(v)) : "Not Filled";
    summaryFields.push({ label: f.title, value: displayVal, isFilled });
  });

  summaryFields.push({
    label: "Keywords",
    value: keywords && keywords.length > 0 ? keywords.join(", ") : "Not Added",
    isFilled: keywords && keywords.length > 0
  });

  const hasPromo = promotionImage && (!Array.isArray(promotionImage) || promotionImage.length > 0);
  summaryFields.push({
    label: "Promo Image",
    value: hasPromo ? "✅ Uploaded" : "Not Uploaded",
    isFilled: !!hasPromo
  });

  return (
    <div className="lp-card-minimal">
      <h3 className="lh-mini-title">Listing Progress</h3>
      
      <div className="lh-mini-progress-wrap">
        <div className="lh-mini-progress-label">Progress: {completionPercentage}%</div>
        <div className="lh-mini-progress-ascii">{blockProgressBar}</div>
      </div>
      
      <div className="lh-mini-completed-count">
        Completed: {filledRequired}/{totalRequired} Fields
      </div>

      <div className="lh-mini-field-list">
        {summaryFields.map((field, idx) => (
          <div key={idx} className="lh-mini-field-row">
            <span className="lh-mini-field-label">{field.label}:</span>
            <span className={`lh-mini-field-value ${field.isFilled ? "lh-mini-field-value--filled" : "lh-mini-field-value--not-filled"}`}>
              {field.value}
            </span>
          </div>
        ))}
      </div>


      <div className="lh-mini-status-section">
        <span className="lh-mini-status-label">Status: </span>
        <span className={`lh-mini-status-value ${qcReady ? "lh-mini-status-value--ready" : "lh-mini-status-value--not-ready"}`}>
          {qcReady ? "Ready for QC" : "Not Ready for QC"}
        </span>
      </div>
    </div>
  );
};

export default LivePreview;
