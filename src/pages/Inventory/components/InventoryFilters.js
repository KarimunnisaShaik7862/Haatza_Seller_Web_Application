import React from "react";
import { Search, RefreshCw } from "lucide-react";
import "./InventoryFilters.css";

const InventoryFilters = ({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  categoryFilter,
  onCategoryFilterChange,
  categories = [],
  onRefresh,
}) => {
  return (
    <div className="inv-filters-row">
      <div className="inv-search-container">
        <Search size={16} className="inv-search-icon" />
        <input
          type="text"
          className="inv-search-input"
          placeholder="Search product or variant..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className="inv-selects-container">
        {onStatusFilterChange && (
          <select
            className="inv-filter-select"
            value={statusFilter || "in_stock"}
            onChange={(e) => onStatusFilterChange(e.target.value)}
          >
            <option value="in_stock">In Stock</option>
            <option value="out_of_stock">Out of Stock</option>
          </select>
        )}

        {onCategoryFilterChange && categories.length > 0 && (
          <select
            className="inv-filter-select"
            value={categoryFilter || "all"}
            onChange={(e) => onCategoryFilterChange(e.target.value)}
          >
            <option value="all">All Categories</option>
            {categories.map((cat, index) => (
              <option key={index} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        )}

        <button type="button" className="inv-btn-refresh" onClick={onRefresh}>
          <RefreshCw size={14} className="refresh-icon" />
          <span>Refresh</span>
        </button>
      </div>
    </div>
  );
};

export default InventoryFilters;
