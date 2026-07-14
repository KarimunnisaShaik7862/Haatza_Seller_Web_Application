import React from "react";
import { Search } from "lucide-react";

const ReturnExchangeFilters = ({ searchQuery, setSearchQuery }) => {
  return (
    <div className="ret-search-box">
      <Search size={18} />
      <input
        type="text"
        className="ret-search-input"
        placeholder="Search by Product ID or Product Name..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />
    </div>
  );
};

export default ReturnExchangeFilters;
