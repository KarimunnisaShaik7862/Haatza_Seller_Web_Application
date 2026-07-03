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
    refreshing,
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

  // Switch status tab and reset pagination.
  const setViewStateAndResetPage = (status) => {
    setStatusFilter(status);
    setPage(1);
  };

  const fromItem = totalItems === 0 ? 0 : (page - 1) * limit + 1;
  const toItem = Math.min(page * limit, totalItems);

  return (
    <div className={`inv-page-root ${changedRows.length > 0 ? "has-update-bar" : ""}`}>
      {updating && (
        <div className="inv-fullscreen-loading" role="status" aria-live="polite">
          <div className="inv-loader-wrap">
            <div className="inv-loading-wheel" aria-hidden="true">
              {Array.from({ length: 16 }).map((_, index) => (
                <span key={index} style={{ "--i": index }} />
              ))}
            </div>
            <div className="inv-loading-text">Updating inventory....</div>
          </div>
        </div>
      )}

      <div className="inv-page-header">
        <h1>Inventory</h1>
        <p>Manage product variants, stock levels, and availability.</p>
      </div>

      {error && (
        <div className="inv-alert-banner">
          <span>{error}</span>
          <button type="button" className="inv-alert-close" onClick={() => setError(null)}>
            &times;
          </button>
        </div>
      )}

      {successMessage && (
        <div
          className="inv-alert-banner inv-success-banner"
        >
          <span>{successMessage}</span>
          <button
            type="button"
            className="inv-alert-close inv-success-close"
            onClick={() => setSuccessMessage(null)}
          >
            &times;
          </button>
        </div>
      )}

      <div className="inv-card">
        <div className="inv-card-body">
          <InventoryFilters
            search={searchRaw}
            onSearchChange={handleSearchChange}
            statusFilter={statusFilter}
            onStatusFilterChange={setViewStateAndResetPage}
            onRefresh={handleRefresh}
            refreshing={refreshing}
            disabled={updating}
          />

          <div className="inv-tabs">
            <button
              type="button"
              className={`inv-tab-btn ${statusFilter === "in_stock" ? "inv-tab-btn--active" : ""}`}
              onClick={() => setViewStateAndResetPage("in_stock")}
              disabled={updating}
            >
              In Stock ({inStockCount})
            </button>
            <button
              type="button"
              className={`inv-tab-btn ${statusFilter === "out_of_stock" ? "inv-tab-btn--active" : ""}`}
              onClick={() => setViewStateAndResetPage("out_of_stock")}
              disabled={updating}
            >
              Out of Stock ({outOfStockCount})
            </button>
          </div>

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
                disabled={updating}
              />

              {!error && filteredItems.length > 0 && (
                <div className="inv-pagination">
                  <div className="inv-pagination-info">
                    Showing <span>{fromItem}–{toItem}</span> of <span>{totalItems}</span> products
                  </div>
                  <div className="inv-pagination-controls">
                    <button
                      type="button"
                      className="inv-page-btn"
                      disabled={page <= 1 || updating}
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
                      disabled={page >= totalPages || updating}
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

      {changedRows.length > 0 && (
        <div className="inventory-update-bar">
          <button
            type="button"
            onClick={() => setShowConfirmation(true)}
            disabled={updating}
          >
            {updating ? "Updating Inventory..." : "Update Inventory"}
          </button>
        </div>
      )}
    </div>
  );
};

export default InventoryPage;