import { useState, useEffect } from "react";
import axios from "axios";
import Plotly from "react-plotly.js";
import styles from "../../style";

const API_URL = import.meta.env.VITE_API_URL || "https://codezen-backend-bz1g.onrender.com";

const PerformanceHeatmap = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [selectedScheme, setSelectedScheme] = useState(null);
  const [heatmapData, setHeatmapData] = useState([]);
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

  // Fetch heatmap data when a scheme is selected
  useEffect(() => {
    const fetchHeatmapData = async () => {
      if (!selectedScheme) {
        setHeatmapData([]);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const response = await axios.get(`${API_URL}/api/performance-heatmap/${selectedScheme.code}`);
        setHeatmapData(response.data);
      } catch (err) {
        console.error("Error fetching heatmap data:", err);
        setError("Failed to fetch heatmap data. Please try again.");
        setHeatmapData([]);
      } finally {
        setLoading(false);
      }
    };
    fetchHeatmapData();
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

  const plotData = heatmapData.length > 0
    ? [{
        x: heatmapData.map((d) => d.month),
        y: heatmapData.map((d) => d.dayChange),
        z: heatmapData.map((d) => d.dayChange),
        type: "heatmap",
        colorscale: "Viridis",
      }]
    : [];

  return (
    <section className={`${styles.paddingY} ${styles.flexCenter} flex-col min-h-[50vh]`}>
      <h2 className={styles.heading2}>Performance Heatmap</h2>
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
        ) : selectedScheme && heatmapData.length > 0 ? (
          <div className="flex justify-center">
            <Plotly
              data={plotData}
              layout={{
                title: "Performance Heatmap",
                xaxis: { title: "Month" },
                yaxis: { title: "Day Change" },
                width: 600, // Fixed width to fit container
                height: 400, // Fixed height
              }}
              config={{ responsive: false }} // Prevent resizing issues
            />
          </div>
        ) : (
          <p className={styles.paragraph}>Search and select a scheme to view heatmap</p>
        )}
      </div>
    </section>
  );
};

export default PerformanceHeatmap;