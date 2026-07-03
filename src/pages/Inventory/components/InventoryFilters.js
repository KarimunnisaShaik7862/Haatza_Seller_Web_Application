import React from "react";
import { Search, RefreshCw } from "lucide-react";

const InventoryFilters = ({
  search = "",
  onSearchChange,
  statusFilter = "in_stock",
  onStatusFilterChange,
  onRefresh,
  refreshing = false,
  disabled = false
}) => {
  const isDisabled = disabled || refreshing;

  return (
    <div className="inv-filters-row">
      <div className="inv-search-box">
        <Search size={18} className="inv-search-icon" />
        <input
          type="text"
          className="inv-search-input"
          placeholder="Search product or variant..."
          value={search}
          disabled={disabled}
          onChange={(e) => onSearchChange?.(e.target.value)}
        />
      </div>

      <div className="inv-filter-actions">
        <select
          className="inv-status-select"
          value={statusFilter}
          disabled={isDisabled}
          onChange={(e) => onStatusFilterChange?.(e.target.value)}
        >
          <option value="in_stock">In Stock</option>
          <option value="out_of_stock">Out of Stock</option>
        </select>

        <button
          type="button"
          className="inv-refresh-btn"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRefresh?.();
          }}
          disabled={isDisabled}
        >
          <RefreshCw size={16} className={`inv-refresh-icon ${refreshing ? "spinning" : ""}`} />
          <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
        </button>
      </div>
    </div>
  );
};

export default InventoryFilters;