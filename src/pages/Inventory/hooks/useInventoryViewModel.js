import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import sellerService, { resolveWixImage, resolveSellerId } from "../../../services/sellerService";

const LIMIT = 15;
const RECENT_UPDATE_TTL_MS = 10 * 60 * 1000;

const parseNumber = (val) => {
  const parsed = Number(val);
  return isNaN(parsed) ? 0 : Math.round(parsed);
};

const extractInventoryResponse = (response, fallbackPage, limit = LIMIT) => {
  const inventoryItems = response?.inventoryItems || response?.data?.inventoryItems || response?.message?.inventoryItems || [];
  const totalItems = response?.totalItems || response?.data?.totalItems || response?.message?.totalItems || inventoryItems.length;

  const payload = response?.data ?? response ?? {};
  const source = payload?.message ?? payload;
  const currentPage = Number(source?.currentPage ?? source?.page ?? payload?.page ?? fallbackPage);

  let totalPages = response?.totalPages || response?.data?.totalPages || response?.message?.totalPages;
  if (!totalPages) {
    totalPages = Math.max(1, Math.ceil(totalItems / limit));
  } else {
    totalPages = Number(totalPages);
  }

  return { inventoryItems, totalItems, currentPage, totalPages };
};

export const useInventoryViewModel = (sellerId) => {
  const [inventoryItems, setInventoryItems] = useState([]);
  const inventory = inventoryItems;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search state (raw input and debounced search term)
  const [searchRaw, setSearchRaw] = useState("");
  const [search, setSearch] = useState("");

  // Pagination and filter states
  const [page, setPage] = useState(1);

  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Single source of truth for the active inventory tab/filter.
  // It is persisted because some dashboard layouts remount this page when Refresh is clicked.
  // Without this, the hook state falls back to "in_stock" after remount.
  const statusFilterRef = useRef("in_stock");

  const getInitialStatusFilter = () => {
    try {
      const saved = window.sessionStorage.getItem("inventoryStatusFilter");
      if (saved === "in_stock" || saved === "out_of_stock") return saved;
    } catch { }
    return "in_stock";
  };

  const [statusFilter, setStatusFilterState] = useState(getInitialStatusFilter);

  const setStatusFilter = useCallback((nextStatus) => {
    const value = typeof nextStatus === "function"
      ? nextStatus(statusFilterRef.current)
      : nextStatus;

    const safeStatus = value === "out_of_stock" ? "out_of_stock" : "in_stock";
    statusFilterRef.current = safeStatus;

    try {
      window.sessionStorage.setItem("inventoryStatusFilter", safeStatus);
    } catch { }

    setStatusFilterState(safeStatus);
  }, []);

  useEffect(() => {
    statusFilterRef.current = statusFilter;
    try {
      window.sessionStorage.setItem("inventoryStatusFilter", statusFilter);
    } catch { }
  }, [statusFilter]);

  // Batch update states
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  const [recentUpdateVersion, setRecentUpdateVersion] = useState(0);

  // ISSUE 6: tracks the "Refresh" button's own loading state, independent
  // of the initial page-load `loading` state.
  const [refreshing, setRefreshing] = useState(false);

  const debounceRef = useRef(null);
  const isRefetchingRef = useRef(false);
  const successTimerRef = useRef(null);

  // Tracks rows we just updated locally so a stale backend refetch can't
  // temporarily re-add them to the wrong status bucket (e.g. Out of Stock).
  // Map key: `${productId}-${variantId}` -> { finalQty, timestamp }
  const recentlyUpdatedRowsRef = useRef(new Map());

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Show success message and auto-dismiss after 3 seconds
  const showSuccessMessage = (message) => {
    setSuccessMessage(message);
    if (successTimerRef.current) {
      clearTimeout(successTimerRef.current);
    }
    successTimerRef.current = setTimeout(() => {
      setSuccessMessage(null);
      successTimerRef.current = null;
    }, 3000);
  };

  // Clear success message immediately (manual close) and cancel pending timer
  const clearSuccessMessage = () => {
    if (successTimerRef.current) {
      clearTimeout(successTimerRef.current);
      successTimerRef.current = null;
    }
    setSuccessMessage(null);
  };

  // Debounced search handler
  const handleSearchChange = (val) => {
    setSearchRaw(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(val.trim());
      setPage(1); // Reset page to 1 when search query changes
    }, 350);
  };

  // Fetch Inventory from API
  const loadInventory = useCallback(async (signal = null, silent = false) => {
    if (!silent) {
      setLoading(true);
    }
    setError(null);
    const resolvedSellerId = sellerId || resolveSellerId();

    // TASK 14: Debug log - list request
    console.log("[Inventory] list request:", { sellerId: resolvedSellerId, page, searchText: search, limit: LIMIT });

    try {
      const response = await sellerService.getSellerProductInventory({
        sellerId: resolvedSellerId,
        page,
        limit: LIMIT,
        count: LIMIT,
        searchText: search,
        signal
      });

      // TASK 14: Debug log - list response
      console.log("[Inventory] list response:", response);

      const backendLimit = response?.limit || response?.pagination?.limit || LIMIT;

      const {
        inventoryItems: inventoryItemsResponse,
        totalItems: totalItemsVal,
        currentPage: currentPageVal,
        totalPages: totalPagesVal
      } = extractInventoryResponse(response, page, backendLimit);

      // TASK 2: Fix row mapping from variants
      const getVariantLabel = (variant) => {
        const choices = variant?.choices || {};
        const values = Object.values(choices).filter(Boolean);
        return values.length ? values.join(" / ") : "Default";
      };

      // Clear out expired "recently updated" entries before applying overrides
      const now = Date.now();
      for (const [key, val] of recentlyUpdatedRowsRef.current.entries()) {
        if (now - val.timestamp >= RECENT_UPDATE_TTL_MS) {
          recentlyUpdatedRowsRef.current.delete(key);
        }
      }

      // Applies a locally-known "just updated" quantity onto a freshly
      // mapped row if the backend response still looks stale for it.
      const applyRecentOverride = (mappedRow, rowKey) => {
        const updated = recentlyUpdatedRowsRef.current.get(rowKey);
        if (!updated) return mappedRow;
        if (now - updated.timestamp >= RECENT_UPDATE_TTL_MS) return mappedRow;

        if (Number(mappedRow.originalQuantity) !== Number(updated.finalQty)) {
          if (process.env.NODE_ENV !== "production") {
            console.log("[Inventory] applying optimistic row override:", rowKey);
          }
          const finalQty = updated.finalQty;
          const finalStatus = finalQty <= 0 ? "Out of Stock" : (finalQty <= 5 ? "Low Stock" : "In Stock");
          mappedRow.originalQuantity = finalQty;
          mappedRow.editedQuantity = finalQty;
          mappedRow.stock = finalQty;
          mappedRow.inStock = finalQty > 0;
          mappedRow.status = finalStatus;
          mappedRow.stockStatus = finalStatus;
        }
        return mappedRow;
      };

      const rows = [];
      inventoryItemsResponse.forEach((item) => {
        const productId = item.productId;
        const externalId = item.externalId;
        const productName = item.productName;
        const image = item.mainMedia;
        const variants = item.variants || [];

        if (variants.length === 0) {
          const variantId = item.variantId || item.id || item._id || "00000000-0000-0000-0000-000000000000";
          const qty = parseNumber(
            item.stock?.quantity ??
            item.quantity ??
            item.stock ??
            0
          );
          const inStock = item.stock?.inStock !== undefined
            ? item.stock.inStock
            : (item.inStock !== undefined ? item.inStock : qty > 0);

          const rowId = `${productId || externalId || "prod"}-${variantId}`;
          const rowKey = `${productId}-${variantId}`;
          let mappedRow = {
            rowId,
            id: rowId,
            productId: productId || "-",
            externalId: externalId || "-",
            productName: productName || "-",
            image: resolveWixImage(image) || image || "",
            variantId: variantId,
            originalQuantity: qty,
            editedQuantity: qty,
            inStock: Boolean(inStock),
            choices: {},
            stockStatus: qty <= 0 ? "Out of Stock" : (qty <= 5 ? "Low Stock" : "In Stock"),
            // Legacy / UI properties
            name: productName || "-",
            variant: "Default",
            stock: qty,
            status: qty <= 0 ? "Out of Stock" : (qty <= 5 ? "Low Stock" : "In Stock")
          };
          mappedRow = applyRecentOverride(mappedRow, rowKey);
          rows.push(mappedRow);
        } else {
          variants.forEach((variant) => {
            const variantId = variant.variantId || "00000000-0000-0000-0000-000000000000";
            const qty = parseNumber(
              variant.stock?.quantity ??
              variant.quantity ??
              0
            );
            const inStock = variant.stock?.inStock !== undefined
              ? variant.stock.inStock
              : (variant.inStock !== undefined ? variant.inStock : qty > 0);

            const variantLabel = getVariantLabel(variant);
            const rowId = `${productId || externalId || "prod"}-${variantId}`;
            const rowKey = `${productId}-${variantId}`;

            let mappedRow = {
              rowId,
              id: rowId,
              productId: productId || "-",
              externalId: externalId || "-",
              productName: productName || "-",
              image: resolveWixImage(image) || image || "",
              variantId: variantId,
              originalQuantity: qty,
              editedQuantity: qty,
              inStock: Boolean(inStock),
              choices: variant.choices || {},
              stockStatus: qty <= 0 ? "Out of Stock" : (qty <= 5 ? "Low Stock" : "In Stock"),
              // Legacy / UI properties
              name: productName || "-",
              variant: variantLabel,
              stock: qty,
              status: qty <= 0 ? "Out of Stock" : (qty <= 5 ? "Low Stock" : "In Stock")
            };
            mappedRow = applyRecentOverride(mappedRow, rowKey);
            rows.push(mappedRow);
          });
        }
      });

      // TASK 14: Debug log - mapped rows
      console.log("[Inventory] mapped rows:", rows);
      if (process.env.NODE_ENV !== "production") {
        console.log("[Inventory] recently updated rows:", recentlyUpdatedRowsRef.current);
      }

      setInventoryItems(rows);
      setTotalItems(totalItemsVal);
      setPage(currentPageVal);
      setTotalPages(totalPagesVal);
    } catch (err) {
      if (err.name === "CanceledError" || err.name === "AbortError" || err.message === "canceled") {
        return; // Request was aborted, ignore error setting
      }
      console.error("[Inventory] Error", err);
      setError("Unable to load inventory. Please try again.");
      setInventoryItems([]);
      setTotalItems(0);
    } finally {
      // Only set loading false if not aborted
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, [sellerId, page, search]);

  useEffect(() => {
    const controller = new AbortController();
    loadInventory(controller.signal);
    return () => {
      controller.abort();
    };
  }, [loadInventory]);

  // Reset page to 1 on status tab change
  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  // Clean up debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Clean up success message timer on unmount
  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  // Compute pending changed rows
  const changedRows = useMemo(() => {
    return inventoryItems.filter((row) => row.editedQuantity !== row.originalQuantity);
  }, [inventoryItems]);

  useEffect(() => {
    const isDev = process.env.NODE_ENV !== "production";
    if (isDev && changedRows.length > 0) {
      console.log("[InventoryPage] Changed Rows detected:", changedRows);
    }
  }, [changedRows]);

  const totalProduct = useMemo(() => {
    return new Set(changedRows.map((row) => row.productId)).size;
  }, [changedRows]);

  const totalVariant = changedRows.length;

  // Calculate stats dynamically based on the current dataset
  const inStockCount = useMemo(() => {
    return inventoryItems.filter((item) => {
      const qty = Number(item.originalQuantity ?? 0);
      return qty > 0 || item.inStock === true;
    }).length;
  }, [inventoryItems]);

  const outOfStockCount = useMemo(() => {
    return inventoryItems.filter((item) => {
      const qty = Number(item.originalQuantity ?? 0);
      return !(qty > 0 || item.inStock === true);
    }).length;
  }, [inventoryItems]);

  const handleQuantityChange = (rowId, nextQuantity) => {
    const quantity = Math.max(0, parseNumber(nextQuantity));
    setInventoryItems((prev) =>
      prev.map((item) =>
        item.rowId === rowId || item.id === rowId
          ? {
            ...item,
            editedQuantity: quantity,
            stock: quantity,
            stockStatus:
              quantity <= 0 ? "Out of Stock" :
                quantity <= 5 ? "Low Stock" :
                  "In Stock",
            status:
              quantity <= 0 ? "Out of Stock" :
                quantity <= 5 ? "Low Stock" :
                  "In Stock"
          }
          : item
      )
    );
  };

  const handleIncrement = handleQuantityChange;

  // Handle local-only decrement
  const handleDecrement = (rowId) => {
    setInventoryItems((prev) =>
      prev.map((item) =>
        (item.rowId === rowId || item.id === rowId) && item.editedQuantity > 0
          ? { ...item, editedQuantity: Math.max(0, item.editedQuantity - 1) }
          : item
      )
    );
  };

  // Handle Batch update submission
  const handleUpdateInventory = async () => {
    // Debug logs
    console.log("[Inventory] changed rows:", changedRows);
    console.log("[Inventory] statusFilter:", statusFilter);
    console.log("[Inventory] out of stock changed rows:", changedRows.filter(r => Number(r.originalQuantity) === 0));
    console.log("[Inventory] totalProduct totalVariant:", { totalProduct, totalVariant });

    // TASK 7: Validate before update
    if (changedRows.length === 0) {
      setError("No inventory changes to update");
      setShowConfirmation(false);
      return;
    }

    let validationError = null;
    for (const row of changedRows) {
      const editedQty = Number(row.editedQuantity ?? 0);
      if (editedQty < 0) {
        validationError = "Stock quantity cannot be negative.";
        break;
      }
      if (!row.productId) {
        validationError = "Missing productId for one or more changed items.";
        break;
      }
      if (!row.variantId) {
        validationError = "Missing variantId for one or more changed items.";
        break;
      }
      const delta = editedQty - Number(row.originalQuantity ?? 0);
      if (delta === 0 || Math.abs(delta) <= 0) {
        validationError = "Increment/decrement amount must be greater than 0.";
        break;
      }
    }

    if (validationError) {
      setError(validationError);
      setShowConfirmation(false);
      return;
    }

    setUpdating(true);
    setError(null);
    const resolvedSellerId = sellerId || resolveSellerId();

    try {
      const incrementItems = [];
      const decrementItems = [];

      changedRows.forEach((row) => {
        const oldStock = Number(row.originalQuantity ?? 0);
        const newStock = Number(row.editedQuantity ?? 0);
        const delta = newStock - oldStock;

        const productId = row.productId;
        const variantId =
          row.variantId ||
          row.varientId ||
          "00000000-0000-0000-0000-000000000000";

        if (!productId) {
          console.warn("[Inventory] Missing productId, skipping row:", row);
          return;
        }

        if (delta > 0) {
          incrementItems.push({
            productId,
            variantId,
            incrementBy: delta
          });
        }

        if (delta < 0) {
          decrementItems.push({
            productId,
            variantId,
            decrementBy: Math.abs(delta)
          });
        }
      });

      const updatePromises = [];

      if (incrementItems.length > 0) {
        console.log("[Inventory] increment payload:", {
          updateInfo: incrementItems
        });

        updatePromises.push(
          sellerService.incrementInventory({
            updateInfo: incrementItems
          })
        );
      }

      if (decrementItems.length > 0) {
        console.log("[Inventory] decrement payload:", {
          updateInfo: decrementItems
        });

        updatePromises.push(
          sellerService.decrementInventory({
            updateInfo: decrementItems
          })
        );
      }

      const responses = await Promise.all(updatePromises);

      console.log("[Inventory] update responses:", responses);

      // Verify success condition: response.status === "success"
      const allSuccess = responses.every((res) => res?.status === "success");
      if (!allSuccess) {
        const failedRes = responses.find((res) => res?.status !== "success");
        const errMsg = failedRes?.message?.error || failedRes?.message?.message || "Failed to update some inventory items.";
        throw new Error(errMsg);
      }

      // Record the rows we just updated so a stale/early backend refetch
      // can't temporarily re-add them to the wrong status bucket.
      const updateTimestamp = Date.now();
      changedRows.forEach((row) => {
        const rowKey = `${row.productId}-${row.variantId}`;
        recentlyUpdatedRowsRef.current.set(rowKey, {
          productId: row.productId,
          variantId: row.variantId,
          finalQty: Number(row.editedQuantity ?? 0),
          timestamp: updateTimestamp
        });
      });
      setRecentUpdateVersion((version) => version + 1);
      if (process.env.NODE_ENV !== "production") {
        console.log("[Inventory] recently updated rows:", recentlyUpdatedRowsRef.current);
      }

      // TASK 9: Refresh after update (Optimistic UI update)
      setInventoryItems((prev) =>
        prev.map((row) => {
          const changedRow = changedRows.find(
            (item) =>
              item.productId === row.productId &&
              (item.variantId === row.variantId || item.id === row.id)
          );

          if (!changedRow) return row;

          const finalQty = changedRow.editedQuantity;
          const finalStatus = finalQty <= 0 ? "Out of Stock" : (finalQty <= 5 ? "Low Stock" : "In Stock");

          return {
            ...row,
            originalQuantity: finalQty,
            editedQuantity: finalQty,
            stock: finalQty,
            inventory: finalQty,
            availableStock: finalQty,
            inStock: finalQty > 0,
            status: finalStatus,
            stockStatus: finalStatus
          };
        })
      );

      // Successfully updated all changes
      showSuccessMessage("Inventory updated successfully.");
      isRefetchingRef.current = true;
      setShowConfirmation(false);

      // Silent backend sync to prevent manual refresh.
      // Timings pushed out slightly (800ms / 2000ms) to reduce the chance
      // of the backend/Wix inventory not having propagated yet, which was
      // causing a stale Out of Stock row to flicker back in.
      const currentStatus = statusFilterRef.current;

      // Keep the full loading overlay visible while the backend/Wix stock
      // sync catches up. This avoids users thinking nothing is happening.
      await wait(800);
      await loadInventory(null, true);
      setStatusFilter(currentStatus);
      statusFilterRef.current = currentStatus;

      await wait(1200);
      await loadInventory(null, true);
      setStatusFilter(currentStatus);
      statusFilterRef.current = currentStatus;
    } catch (err) {
      console.error("[useInventoryViewModel] Batch update failed:", err);
      setError(err.message || "Failed to update some inventory items.");
    } finally {
      setUpdating(false);
    }
  };

  // Refresh must stay on the currently selected tab.
  // This deliberately preserves the tab before, during, and after the async refetch.
  const handleRefresh = useCallback(async () => {
    const currentStatus = statusFilterRef.current;

    setRefreshing(true);
    setError(null);

    // Lock the current tab before refetch starts.
    setStatusFilter(currentStatus);

    try {
      await loadInventory(null, false);
    } finally {
      // Lock it again after React state updates from loadInventory finish.
      setStatusFilter(currentStatus);
      statusFilterRef.current = currentStatus;

      // Some dashboard wrappers remount or re-render children after refresh.
      // These two micro-delayed locks prevent a late default value from flipping to In Stock.
      setTimeout(() => {
        setStatusFilter(currentStatus);
        statusFilterRef.current = currentStatus;
      }, 0);

      setTimeout(() => {
        setStatusFilter(currentStatus);
        statusFilterRef.current = currentStatus;
      }, 80);

      setRefreshing(false);
    }
  }, [loadInventory, setStatusFilter]);

  // Filter items based on dropdown filters and tab selection
  const filteredItems = useMemo(() => {
    const filtered = inventoryItems.filter((item) => {
      // 1. Status filter
      const qty = Number(item.originalQuantity ?? 0);
      const inStock = qty > 0 || item.inStock === true;

      if (statusFilter === "in_stock") {
        return inStock;
      }

      if (statusFilter === "out_of_stock") {
        return !inStock;
      }

      return true;
    });

    // Keep recently updated variants visible at the top of the active tab.
    return [...filtered].sort((a, b) => {
      const aKey = `${a.productId}-${a.variantId}`;
      const bKey = `${b.productId}-${b.variantId}`;

      const aRecent = recentlyUpdatedRowsRef.current.get(aKey)?.timestamp || 0;
      const bRecent = recentlyUpdatedRowsRef.current.get(bKey)?.timestamp || 0;

      return bRecent - aRecent;
    });
  }, [inventoryItems, statusFilter, search, recentUpdateVersion]);

  const filteredTotalItems = filteredItems.length;
  const filteredTotalPages = Math.max(1, Math.ceil(filteredTotalItems / LIMIT));

  const paginatedItems = useMemo(() => {
    const startIndex = (page - 1) * LIMIT;
    return filteredItems.slice(startIndex, startIndex + LIMIT);
  }, [filteredItems, page]);

  useEffect(() => {
    if (page > filteredTotalPages) {
      setPage(filteredTotalPages);
    }
  }, [page, filteredTotalPages]);

  return {
    inventory,
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
    handleDecrement,
    handleRefresh,
    refreshing,
    page,
    setPage,
    totalPages: filteredTotalPages,
    totalItems: filteredTotalItems,
    limit: LIMIT,

    // Batch updates
    changedRows,
    showConfirmation,
    setShowConfirmation,
    updating,
    successMessage,
    setSuccessMessage: clearSuccessMessage,
    handleUpdateInventory,
    totalProduct,
    totalVariant
  };
};
export default useInventoryViewModel;