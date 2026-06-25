import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import InventoryFilters from "./components/InventoryFilters";
import InventoryTable from "./components/InventoryTable";
import { getSellerId } from "../../utils/sellerSession";
import { useInventoryViewModel } from "./hooks/useInventoryViewModel";
import "./InventoryPage.css";

const InventoryPage = () => {
  const sellerId = getSellerId();
  
  const {
    filteredItems,
    loading,
    error,
    setError,
    searchRaw,
    handleSearchChange,
    statusFilter,
    setStatusFilter,
    inStockCount,
    outOfStockCount,
    handleIncrement,
    handleRefresh,
    page,
    setPage,
    totalPages,
    totalItems,
    limit,
    // Batch updates
    changedRows,
    showConfirmation,
    setShowConfirmation,
    updating,
    successMessage,
    setSuccessMessage,
    handleUpdateInventory,
    totalProduct,
    totalVariant
  } = useInventoryViewModel(sellerId);

  // Helper helper to switch status tab & reset to page 1
  const setViewStateAndResetPage = (status) => {
    setStatusFilter(status);
    setPage(1);
  };

  // Calculate items range shown
  const fromItem = totalItems === 0 ? 0 : (page - 1) * limit + 1;
  const toItem = Math.min(page * limit, totalItems);

  return (
    <div className={`inv-page-root ${changedRows.length > 0 ? "has-update-bar" : ""}`}>
      <div className="inv-page-header">
        <h1>Inventory</h1>
        <p>Manage product variants, stock levels, and availability.</p>
      </div>

      {/* Error / Warning Alert Banner */}
      {error && (
        <div className="inv-alert-banner">
          <span>{error}</span>
          <button type="button" className="inv-alert-close" onClick={() => setError(null)}>&times;</button>
        </div>
      )}

      {/* Success Alert Banner */}
      {successMessage && (
        <div className="inv-alert-banner" style={{ background: "#ecfdf5", borderColor: "#a7f3d0", color: "#065f46" }}>
          <span>{successMessage}</span>
          <button type="button" className="inv-alert-close" onClick={() => setSuccessMessage(null)} style={{ color: "#047857" }}>&times;</button>
        </div>
      )}

      {/* Filters & Content Wrap */}
      <div className="inv-card">
        <div className="inv-card-body">
          <InventoryFilters
            search={searchRaw}
            onSearchChange={handleSearchChange}
            statusFilter={statusFilter}
            onStatusFilterChange={setViewStateAndResetPage}
            onRefresh={handleRefresh}
          />

          {/* Tab Selection */}
          <div className="inv-tabs">
            <button
              type="button"
              className={`inv-tab-btn ${statusFilter === "in_stock" ? "inv-tab-btn--active" : ""}`}
              onClick={() => setViewStateAndResetPage("in_stock")}
            >
              In Stock ({inStockCount})
            </button>
            <button
              type="button"
              className={`inv-tab-btn ${statusFilter === "out_of_stock" ? "inv-tab-btn--active" : ""}`}
              onClick={() => setViewStateAndResetPage("out_of_stock")}
            >
              Out of Stock ({outOfStockCount})
            </button>
          </div>

          {/* Desktop Table View */}
          {loading ? (
            <div className="inv-table-loading">
              <div className="inv-loading-spinner" />
              <p>Fetching inventory from server...</p>
            </div>
          ) : (
            <>
              <InventoryTable
                items={filteredItems}
                onQuantityChange={handleIncrement}
              />
              
              {/* Pagination Controls */}
              {!error && filteredItems.length > 0 && (
                <div className="inv-pagination">
                  <div className="inv-pagination-info">
                    Showing <span>{fromItem}–{toItem}</span> of <span>{totalItems}</span> products
                  </div>
                  <div className="inv-pagination-controls">
                    <button
                      type="button"
                      className="inv-page-btn"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      <ChevronLeft size={14} /> Previous
                    </button>
                    <span className="inv-page-indicator">
                      Page <span>{page}</span> of <span>{totalPages}</span>
                    </span>
                    <button
                      type="button"
                      className="inv-page-btn"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}

            </>
          )}
        </div>
      </div>

      {/* Confirmation Modal Popup */}
      {showConfirmation && (
        <div className="inv-modal-overlay">
          <div className="inv-modal">
            <h3 className="inv-modal-title">Update Inventory</h3>
            <p className="inv-modal-message">Are you sure you want to update the inventory?</p>
            <div className="inv-modal-summary">
              Total Product: {totalProduct}, Total Variant: {totalVariant}
            </div>
            <div className="inv-modal-actions">
              <button
                type="button"
                className="inv-btn-cancel"
                onClick={() => setShowConfirmation(false)}
                disabled={updating}
              >
                Cancel
              </button>
              <button
                type="button"
                className="inv-btn-ok"
                onClick={handleUpdateInventory}
                disabled={updating}
              >
                {updating ? "Updating..." : "OK"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Viewport-fixed Update Inventory Bar */}
      {changedRows.length > 0 && (
        <div className="inventory-update-bar">
          <button
            type="button"
            onClick={() => setShowConfirmation(true)}
          >
            Update Inventory
          </button>
        </div>
      )}
    </div>
  );
};

export default InventoryPage;
