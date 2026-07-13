import React from "react";
import "./StockBadge.css";

const StockBadge = ({ stock }) => {
  const isInStock = stock > 0;

  return (
    <span className={`inv-badge ${isInStock ? "inv-badge--instock" : "inv-badge--outofstock"}`}>
      {isInStock ? "In Stock" : "Out of Stock"}
    </span>
  );
};

export default StockBadge;