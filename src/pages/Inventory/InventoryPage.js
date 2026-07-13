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
    paginatedItems,
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
    page: apiPage,
    setPage: setApiPage,
    totalPages: apiTotalPages,
    totalItems: apiTotalItems,
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
    setApiPage(1);
  };

  const [currentPage, setCurrentPage] = React.useState(1);
  const pageSize = 15;
  const totalVariants = filteredItems.length;
  const totalPages = Math.ceil(totalVariants / pageSize);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchRaw, statusFilter]);

  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalVariants);
  const paginatedVariants = filteredItems.slice(startIndex, endIndex);

  const fromItem = totalVariants === 0 ? 0 : startIndex + 1;

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
                items={paginatedVariants}
                onQuantityChange={handleIncrement}
                disabled={updating}
              />

              {!error && totalVariants > 0 && (
                <div className="inv-pagination">
                  <div className="inv-pagination-info">
                    Showing <span>{fromItem}–{endIndex}</span> of <span>{totalVariants}</span> variants
                  </div>
                  <div className="inv-pagination-controls">
                    <button
                      type="button"
                      className="inv-page-btn"
                      disabled={currentPage === 1 || updating}
                      onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    >
                      <ChevronLeft size={14} /> Previous
                    </button>
                    <span className="inv-page-indicator">
                      Page <span>{currentPage}</span> of <span>{totalPages}</span>
                    </span>
                    <button
                      type="button"
                      className="inv-page-btn"
                      disabled={currentPage === totalPages || updating}
                      onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
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