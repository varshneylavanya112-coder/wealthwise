// frontend/src/components/Dashboard/CalculateReturns.jsx
import { useState, useEffect } from "react";
import axios from "axios";
import styles from "../../style";

const API_URL = import.meta.env.VITE_API_URL || "https://codezen-backend-bz1g.onrender.com";

const CalculateReturns = ({ selectedScheme }) => {
  const [investmentAmount, setInvestmentAmount] = useState(10000); // Default ₹10,000
  const [duration, setDuration] = useState(1); // Default 1 year
  const [returnsData, setReturnsData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchReturnsData = async () => {
      if (!selectedScheme || !selectedScheme.code) {
        setReturnsData(null);
        setError("No scheme selected.");
        return;
      }
      setLoading(true);
      setError(null);
      try {
        // Fetch risk/volatility data to get annualized return
        const response = await axios.get(`${API_URL}/api/risk-volatility/${selectedScheme.code}`);
        const annualizedReturn = response.data.annualized_return;
        if (annualizedReturn === undefined) {
          throw new Error("Annualized return not available in response.");
        }
        calculateReturns(annualizedReturn);
      } catch (err) {
        console.error("Error fetching returns data:", err);
        setError("Failed to fetch returns data. Please try again.");
        setReturnsData(null);
      } finally {
        setLoading(false);
      }
    };
    fetchReturnsData();
  }, [selectedScheme]); // Only depend on selectedScheme

  const calculateReturns = (annualizedReturn) => {
    const rate = annualizedReturn; // Annualized return as a decimal (e.g., 0.12 for 12%)
    const totalValue = investmentAmount * Math.pow(1 + rate, duration);
    const profit = totalValue - investmentAmount;
    setReturnsData({
      totalValue: totalValue.toFixed(2),
      profit: profit.toFixed(2),
      annualizedReturn: (rate * 100).toFixed(2),
    });
  };

  const handleAmountChange = (e) => {
    const value = parseFloat(e.target.value) || 0;
    setInvestmentAmount(value);
    if (returnsData) {
      calculateReturns(returnsData.annualizedReturn / 100); // Recalculate with new amount
    }
  };

  const handleDurationChange = (e) => {
    const value = parseInt(e.target.value) || 1;
    setDuration(value);
    if (returnsData) {
      calculateReturns(returnsData.annualizedReturn / 100); // Recalculate with new duration
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 shadow-md">
      <h3 className="text-white text-lg font-semibold mb-2">Calculate Your Returns</h3>
      <div className="text-gray-300 text-sm">
        {loading ? (
          <p>Loading...</p>
        ) : error ? (
          <p className="text-red-500">{error}</p>
        ) : selectedScheme && returnsData ? (
          <div>
            <div className="mb-4">
              <label className="block mb-1">Investment Amount (₹):</label>
              <input
                type="number"
                value={investmentAmount}
                onChange={handleAmountChange}
                className="p-2 rounded bg-gray-900 text-white w-full focus:outline-none border border-gray-700"
                min="1000"
                step="1000"
              />
            </div>
            <div className="mb-4">
              <label className="block mb-1">Duration (Years):</label>
              <input
                type="number"
                value={duration}
                onChange={handleDurationChange}
                className="p-2 rounded bg-gray-900 text-white w-full focus:outline-none border border-gray-700"
                min="1"
                max="10"
              />
            </div>
            <p><span className="font-medium">Estimated Total Value:</span> ₹{returnsData.totalValue}</p>
            <p><span className="font-medium">Estimated Profit:</span> ₹{returnsData.profit}</p>
            <p><span className="font-medium">Annualized Return:</span> {returnsData.annualizedReturn}%</p>
            <p className="text-xs mt-2 text-dimWhite">
              *Based on historical annualized return, actual returns may vary.
            </p>
          </div>
        ) : (
          <p>No data available yet. Select a fund to calculate returns.</p>
        )}
      </div>
    </div>
  );
};

export default CalculateReturns;