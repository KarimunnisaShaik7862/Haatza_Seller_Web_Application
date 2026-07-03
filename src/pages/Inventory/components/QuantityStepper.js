import React from "react";
import { Plus, Minus } from "lucide-react";
import "./QuantityStepper.css";

const QuantityStepper = ({ value, onChange }) => {
  const handleDecrement = () => {
    if (value > 0) {
      onChange(value - 1);
    }
  };

  const handleIncrement = () => {
    onChange(value + 1);
  };

  const handleInputChange = (e) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val >= 0) {
      onChange(val);
    } else if (e.target.value === "") {
      onChange(0);
    }
  };

  return (
    <div className="qty-stepper">
      <button 
        type="button" 
        className="qty-btn" 
        onClick={handleDecrement}
        disabled={value <= 0}
        aria-label="Decrease quantity"
      >
        <Minus size={14} />
      </button>
      <input 
        type="number" 
        className="qty-input" 
        value={value} 
        onChange={handleInputChange}
        min="0"
      />
      <button 
        type="button" 
        className="qty-btn" 
        onClick={handleIncrement}
        aria-label="Increase quantity"
      >
        <Plus size={14} />
      </button>
    </div>
  );
};

export default QuantityStepper;