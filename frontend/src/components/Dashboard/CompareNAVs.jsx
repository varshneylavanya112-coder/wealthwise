import { useState, useEffect } from "react";
import axios from "axios";
import styles from "../../style";

const API_URL = import.meta.env.VITE_API_URL || "https://codezen-backend-bz1g.onrender.com";

const CompareNAVs = () => {
  const [searchTerm1, setSearchTerm1] = useState("");
  const [searchTerm2, setSearchTerm2] = useState("");
  const [suggestions1, setSuggestions1] = useState([]);
  const [suggestions2, setSuggestions2] = useState([]);
  const [selectedFund1, setSelectedFund1] = useState(null);
  const [selectedFund2, setSelectedFund2] = useState(null);
  const [comparisonData, setComparisonData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch suggestions for both inputs
  const fetchSuggestions = async (searchTerm, setSuggestions) => {
    if (searchTerm.length < 2) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API_URL}/api/schemes?search=${searchTerm}`);
      const schemesArray = Object.entries(response.data).map(([code, name]) => ({
        code,
        name,
      }));
      setSuggestions(schemesArray.slice(0, 10));
    } catch (err) {
      console.error("Error fetching suggestions:", err);
      setError("Failed to fetch suggestions. Please try again.");
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => fetchSuggestions(searchTerm1, setSuggestions1), 500);
    return () => clearTimeout(timer);
  }, [searchTerm1]);

  useEffect(() => {
    const timer = setTimeout(() => fetchSuggestions(searchTerm2, setSuggestions2), 500);
    return () => clearTimeout(timer);
  }, [searchTerm2]);

  // Fetch comparison data when both funds are selected
  useEffect(() => {
    const fetchComparisonData = async () => {
      if (!selectedFund1 || !selectedFund2) {
        setComparisonData({});
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const [navResponse, risk1Response, risk2Response, monte1Response, monte2Response] = await Promise.all([
          axios.get(`${API_URL}/api/compare-navs?scheme_codes=${selectedFund1.code},${selectedFund2.code}`),
          axios.get(`${API_URL}/api/risk-volatility/${selectedFund1.code}`),
          axios.get(`${API_URL}/api/risk-volatility/${selectedFund2.code}`),
          axios.get(`${API_URL}/api/monte-carlo-prediction/${selectedFund1.code}`),
          axios.get(`${API_URL}/api/monte-carlo-prediction/${selectedFund2.code}`),
        ]);

        const navData = navResponse.data;
        const latestNav1 = navData.length > 0 ? parseFloat(navData[navData.length - 1][selectedFund1.name] || 0) : "N/A";
        const latestNav2 = navData.length > 0 ? parseFloat(navData[navData.length - 1][selectedFund2.name] || 0) : "N/A";
        const oneYearAgoIdx = Math.max(0, navData.length - 252);
        const oneYearAgoNav1 = navData.length > 252 ? parseFloat(navData[oneYearAgoIdx][selectedFund1.name] || 0) : latestNav1;
        const oneYearAgoNav2 = navData.length > 252 ? parseFloat(navData[oneYearAgoIdx][selectedFund2.name] || 0) : latestNav2;
        const growth1 = oneYearAgoNav1 > 0 ? ((latestNav1 - oneYearAgoNav1) / oneYearAgoNav1 * 100).toFixed(2) : "N/A";
        const growth2 = oneYearAgoNav2 > 0 ? ((latestNav2 - oneYearAgoNav2) / oneYearAgoNav2 * 100).toFixed(2) : "N/A";

        setComparisonData({
          fund1: {
            name: selectedFund1.name,
            latest_nav: latestNav1,
            one_year_growth: growth1,
            volatility: risk1Response.data.annualized_volatility ? (risk1Response.data.annualized_volatility * 100).toFixed(2) : "N/A",
            sharpe_ratio: risk1Response.data.sharpe_ratio ? risk1Response.data.sharpe_ratio.toFixed(2) : "N/A",
            monte_carlo_expected_nav: monte1Response.data.expected_nav ? monte1Response.data.expected_nav.toFixed(2) : "N/A",
            monte_carlo_probability: monte1Response.data.probability_positive_return ? monte1Response.data.probability_positive_return.toFixed(2) : "N/A",
          },
          fund2: {
            name: selectedFund2.name,
            latest_nav: latestNav2,
            one_year_growth: growth2,
            volatility: risk2Response.data.annualized_volatility ? (risk2Response.data.annualized_volatility * 100).toFixed(2) : "N/A",
            sharpe_ratio: risk2Response.data.sharpe_ratio ? risk2Response.data.sharpe_ratio.toFixed(2) : "N/A",
            monte_carlo_expected_nav: monte2Response.data.expected_nav ? monte2Response.data.expected_nav.toFixed(2) : "N/A",
            monte_carlo_probability: monte2Response.data.probability_positive_return ? monte2Response.data.probability_positive_return.toFixed(2) : "N/A",
          },
        });
      } catch (err) {
        console.error("Error fetching comparison data:", err);
        setError("Failed to fetch comparison data. Please try again.");
        setComparisonData({});
      } finally {
        setLoading(false);
      }
    };
    fetchComparisonData();
  }, [selectedFund1, selectedFund2]);

  const handleSearchChange = (e, setSearchTerm, setSelectedFund) => {
    e.preventDefault();
    setSearchTerm(e.target.value);
    setSelectedFund(null);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
    }
  };

  const handleSelectFund = (fund, setSelectedFund, setSearchTerm, setSuggestions) => {
    setSelectedFund(fund);
    setSearchTerm(fund.name);
    setSuggestions([]);
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 shadow-md w-full">
      <h3 className="text-white text-lg font-semibold mb-4">Compare Funds</h3>
      <div className="flex flex-col sm:flex-row gap-4 mb-4">
        {/* Fund 1 Search */}
        <div className="relative flex-1">
          <input
            type="text"
            value={searchTerm1}
            onChange={(e) => handleSearchChange(e, setSearchTerm1, setSelectedFund1)}
            onKeyDown={handleKeyDown}
            className="w-full p-2 rounded bg-gray-900 text-white focus:outline-none border border-gray-700"
            placeholder="Search for first fund..."
          />
          {suggestions1.length > 0 && (
            <ul className="absolute z-10 bg-gray-800 text-white rounded-lg w-full max-h-60 overflow-y-auto mt-2 shadow-lg">
              {suggestions1.map((fund) => (
                <li
                  key={fund.code}
                  onClick={() =>
                    handleSelectFund(fund, setSelectedFund1, setSearchTerm1, setSuggestions1)
                  }
                  className="p-2 hover:bg-gray-700 cursor-pointer"
                >
                  {fund.name}
                </li>
              ))}
            </ul>
          )}
        </div>
        {/* Fund 2 Search */}
        <div className="relative flex-1">
          <input
            type="text"
            value={searchTerm2}
            onChange={(e) => handleSearchChange(e, setSearchTerm2, setSelectedFund2)}
            onKeyDown={handleKeyDown}
            className="w-full p-2 rounded bg-gray-900 text-white focus:outline-none border border-gray-700"
            placeholder="Search for second fund..."
          />
          {suggestions2.length > 0 && (
            <ul className="absolute z-10 bg-gray-800 text-white rounded-lg w-full max-h-60 overflow-y-auto mt-2 shadow-lg">
              {suggestions2.map((fund) => (
                <li
                  key={fund.code}
                  onClick={() =>
                    handleSelectFund(fund, setSelectedFund2, setSearchTerm2, setSuggestions2)
                  }
                  className="p-2 hover:bg-gray-700 cursor-pointer"
                >
                  {fund.name}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="w-full">
        {loading ? (
          <p className="text-gray-400 text-center">Loading...</p>
        ) : error ? (
          <p className="text-red-500 text-center">{error}</p>
        ) : Object.keys(comparisonData).length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-gray-300">
              <thead>
                <tr className="bg-gray-700">
                  <th className="p-2">Metric</th>
                  <th className="p-2">{comparisonData.fund1.name}</th>
                  <th className="p-2">{comparisonData.fund2.name}</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-600">
                  <td className="p-2">Latest NAV (₹)</td>
                  <td className="p-2">{comparisonData.fund1.latest_nav !== "N/A" ? comparisonData.fund1.latest_nav.toFixed(2) : "N/A"}</td>
                  <td className="p-2">{comparisonData.fund2.latest_nav !== "N/A" ? comparisonData.fund2.latest_nav.toFixed(2) : "N/A"}</td>
                </tr>
                <tr className="border-b border-gray-600">
                  <td className="p-2">1-Year Growth (%)</td>
                  <td className="p-2">{comparisonData.fund1.one_year_growth}</td>
                  <td className="p-2">{comparisonData.fund2.one_year_growth}</td>
                </tr>
                <tr className="border-b border-gray-600">
                  <td className="p-2">Annualized Volatility (%)</td>
                  <td className="p-2">{comparisonData.fund1.volatility}</td>
                  <td className="p-2">{comparisonData.fund2.volatility}</td>
                </tr>
                <tr className="border-b border-gray-600">
                  <td className="p-2">Sharpe Ratio</td>
                  <td className="p-2">{comparisonData.fund1.sharpe_ratio}</td>
                  <td className="p-2">{comparisonData.fund2.sharpe_ratio}</td>
                </tr>
                <tr className="border-b border-gray-600">
                  <td className="p-2">Monte Carlo Expected NAV (₹)</td>
                  <td className="p-2">{comparisonData.fund1.monte_carlo_expected_nav}</td>
                  <td className="p-2">{comparisonData.fund2.monte_carlo_expected_nav}</td>
                </tr>
                <tr>
                  <td className="p-2">Probability of Positive Return (%)</td>
                  <td className="p-2">{comparisonData.fund1.monte_carlo_probability}</td>
                  <td className="p-2">{comparisonData.fund2.monte_carlo_probability}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-400 text-center">
            Select two funds to compare their performance metrics
          </p>
        )}
      </div>
    </div>
  );
};

export default CompareNAVs;