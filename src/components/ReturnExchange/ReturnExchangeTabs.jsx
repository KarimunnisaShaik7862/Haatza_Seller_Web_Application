import React, { useState, useEffect, useRef } from "react";

const ReturnExchangeTabs = ({ activeTab, setActiveTab, counts = { Return: 0, Exchange: 0, Claim: 0 } }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleScroll = () => setIsOpen(false);
    window.addEventListener("scroll", handleScroll, true);
    return () => window.removeEventListener("scroll", handleScroll, true);
  }, [isOpen]);

  const labelMap = {
    Return: "Returns",
    Exchange: "Exchanges",
    Claim: "Claims",
  };

  return (
    <>
      <div className="ret-tabs-dropdown-container" ref={dropdownRef}>
        <button
          type="button"
          className={`ret-status-select-btn ${isOpen ? "open" : ""}`}
          onClick={() => setIsOpen(!isOpen)}
        >
          <span>
            {labelMap[activeTab] || activeTab} ({counts[activeTab] || 0})
          </span>
        </button>
        {isOpen && (
          <div className="ret-status-dropdown-menu">
            <button
              type="button"
              className={`ret-status-dropdown-item ${activeTab === "Return" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("Return");
                setIsOpen(false);
              }}
            >
              <span>Returns</span>
              <span className="ret-dropdown-badge">{counts.Return || 0}</span>
            </button>
            <button
              type="button"
              className={`ret-status-dropdown-item ${activeTab === "Exchange" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("Exchange");
                setIsOpen(false);
              }}
            >
              <span>Exchanges</span>
              <span className="ret-dropdown-badge">{counts.Exchange || 0}</span>
            </button>
            <button
              type="button"
              className={`ret-status-dropdown-item ${activeTab === "Claim" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("Claim");
                setIsOpen(false);
              }}
            >
              <span>Claims</span>
              <span className="ret-dropdown-badge">{counts.Claim || 0}</span>
            </button>
          </div>
        )}
      </div>

      <div className="ret-tabs-container">
        <button
          className={`ret-tab ${activeTab === "Return" ? "active" : ""}`}
          onClick={() => setActiveTab("Return")}
        >
          <span>Returns</span>
          <span className="ret-tab-badge">{counts.Return || 0}</span>
        </button>
        <button
          className={`ret-tab ${activeTab === "Exchange" ? "active" : ""}`}
          onClick={() => setActiveTab("Exchange")}
        >
          <span>Exchanges</span>
          <span className="ret-tab-badge">{counts.Exchange || 0}</span>
        </button>
        <button
          className={`ret-tab ${activeTab === "Claim" ? "active" : ""}`}
          onClick={() => setActiveTab("Claim")}
        >
          <span>Claims</span>
          <span className="ret-tab-badge">{counts.Claim || 0}</span>
        </button>
      </div>
    </>
  );
};

export default ReturnExchangeTabs;
