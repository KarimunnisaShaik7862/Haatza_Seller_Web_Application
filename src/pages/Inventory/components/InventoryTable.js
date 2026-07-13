import React, { useState, useEffect } from "react";
import StockBadge from "./StockBadge";
import QuantityStepper from "./QuantityStepper";
import "./InventoryTable.css";

const FALLBACK_IMG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60' viewBox='0 0 60 60'%3E%3Crect width='60' height='60' fill='%23f1f3f6' rx='8'/%3E%3Ctext x='30' y='35' text-anchor='middle' fill='%23b0b7c3' font-size='22'%3E%F0%9F%93%A6%3C/text%3E%3C/svg%3E";

const InventoryTableRow = ({ item, onQuantityChange, disabled = false }) => {
  const [localQty, setLocalQty] = useState(item.editedQuantity);

  useEffect(() => {
    setLocalQty(item.editedQuantity);
  }, [item.editedQuantity]);

  const hasChanges = item.editedQuantity !== item.originalQuantity;

  const handleQuantityChange = (nextQty) => {
    if (disabled) return;
    setLocalQty(nextQty);
    onQuantityChange(item.rowId, nextQty);
  };

  return (
    <tr className={hasChanges ? "row-has-changes" : ""}>
      <td>
        <img
          className="inv-img"
          src={item.image || FALLBACK_IMG}
          alt={item.name}
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = FALLBACK_IMG;
          }}
        />
      </td>
      <td>
        <span className="inv-product-name" title={item.name}>
          {item.name}
        </span>
        <span className="inv-product-meta" title={item.variant || "Default"}>
          Variant: {item.variant || "Default"}
        </span>
      </td>
      <td className="inv-stock-cell font-bold">{item.originalQuantity}</td>
      <td>
        <StockBadge stock={item.editedQuantity} />
      </td>
      <td>
        <QuantityStepper value={localQty} onChange={handleQuantityChange} disabled={disabled} />
      </td>
    </tr>
  );
};

const InventoryTable = ({ items = [], onQuantityChange, disabled = false }) => {
  const handleQuantityChange = (id, nextQty) => {
    if (disabled) return;
    onQuantityChange?.(id, nextQty);
  };

  return (
    <div className="inv-table-wrap">
      <table className="inv-table">
        <thead>
          <tr>
            <th>Image</th>
            <th>Product Name</th>
            <th>Current Stock</th>
            <th>Stock Status</th>
            <th>Update Quantity</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan="5" className="inv-table-empty">
                No inventory items found matching the filter criteria.
              </td>
            </tr>
          ) : (
            items.map((item) => (
              <InventoryTableRow
                key={item.id}
                item={item}
                onQuantityChange={handleQuantityChange}
                disabled={disabled}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default InventoryTable;