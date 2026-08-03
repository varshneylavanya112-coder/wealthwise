import { useState, useEffect } from "react";
import axios from "axios";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import styles from "../../style";

const API_URL = import.meta.env.VITE_API_URL || "https://codezen-backend-bz1g.onrender.com";

const HistoricalNAV = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [selectedScheme, setSelectedScheme] = useState(null);
  const [navData, setNavData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch suggestions based on search term
  useEffect(() => {
    const fetchSuggestions = async () => {
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

    const timer = setTimeout(fetchSuggestions, 500); // Debounce
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch NAV data when a scheme is selected
  useEffect(() => {
    const fetchNavData = async () => {
      if (!selectedScheme) {
        setNavData([]);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const response = await axios.get(`${API_URL}/api/historical-nav/${selectedScheme.code}`);
        setNavData(response.data);
      } catch (err) {
        console.error("Error fetching NAV data:", err);
        setError("Failed to fetch NAV data. Please try again.");
        setNavData([]);
      } finally {
        setLoading(false);
      }
    };
    fetchNavData();
  }, [selectedScheme]);

  const handleSearchChange = (e) => {
    e.preventDefault();
    setSearchTerm(e.target.value);
    setSelectedScheme(null); // Clear selection when typing
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
    }
  };

  const handleSelectScheme = (scheme) => {
    setSelectedScheme(scheme);
    setSearchTerm(scheme.name);
    setSuggestions([]);
  };

  return (
    <section className={`${styles.paddingY} ${styles.flexCenter} flex-col min-h-[50vh]`}>
      <h2 className={styles.heading2}>Historical NAV</h2>
      <div className="relative w-full max-w-[600px] mb-4">
        <input
          type="text"
          value={searchTerm}
          onChange={handleSearchChange}
          onKeyDown={handleKeyDown}
          className="p-2 rounded bg-dimBlue text-white w-full focus:outline-none"
          placeholder="Search for a mutual fund..."
        />
        {suggestions.length > 0 && (
          <ul className="absolute z-10 bg-black-gradient text-white rounded-lg w-full max-h-60 overflow-y-auto mt-1 shadow-lg">
            {suggestions.map((scheme) => (
              <li
                key={scheme.code}
                onClick={() => handleSelectScheme(scheme)}
                className="p-2 hover:bg-gray-700 cursor-pointer"
              >
                {scheme.name}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="w-full max-w-[600px]">
        {loading ? (
          <p className={styles.paragraph}>Loading...</p>
        ) : error ? (
          <p className={styles.paragraph}>{error}</p>
        ) : selectedScheme && navData.length > 0 ? (
          <div className="flex justify-center">
            <LineChart width={600} height={300} data={navData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="nav" stroke="#00f6ff" />
            </LineChart>
          </div>
        ) : (
          <p className={styles.paragraph}>Search and select a scheme to view NAV</p>
        )}
      </div>
    </section>
  );
};

export default HistoricalNAV;