import React from "react";
import { Package, Layers, CheckCircle, AlertTriangle } from "lucide-react";
import "./InventoryStats.css";

const InventoryStats = ({ totalProducts, totalVariants, inStockVariants, outOfStockVariants }) => {
  const stats = [
    {
      title: "Total Products",
      value: totalProducts,
      icon: <Package size={20} />,
      className: "stat-card--products",
    },
    {
      title: "Total Variants",
      value: totalVariants,
      icon: <Layers size={20} />,
      className: "stat-card--variants",
    },
    {
      title: "In Stock Variants",
      value: inStockVariants,
      icon: <CheckCircle size={20} />,
      className: "stat-card--instock",
    },
    {
      title: "Out of Stock",
      value: outOfStockVariants,
      icon: <AlertTriangle size={20} />,
      className: "stat-card--outofstock",
    },
  ];

  return (
    <div className="inv-stats-grid">
      {stats.map((stat, idx) => (
        <div key={idx} className={`stat-card ${stat.className}`}>
          <div className="stat-card__icon-wrapper">{stat.icon}</div>
          <div className="stat-card__content">
            <p className="stat-card__title">{stat.title}</p>
            <p className="stat-card__value">{stat.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default InventoryStats;