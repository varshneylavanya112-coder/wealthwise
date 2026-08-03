import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import styles from "../../style";

const API_URL = import.meta.env.VITE_API_URL || "https://codezen-backend-bz1g.onrender.com";

// Sub-component for displaying details
const DetailsDisplay = ({ selectedScheme, loading, error, details }) => {
  console.log("DetailsDisplay rendered");
  return (
    <div className="w-full max-w-[600px] text-white">
      {loading ? (
        <p className={styles.paragraph}>Loading...</p>
      ) : error ? (
        <p className={styles.paragraph}>{error}</p>
      ) : selectedScheme && Object.keys(details).length > 0 ? (
        <div className="bg-black-gradient p-4 rounded-lg">
          {Object.entries(details).map(([key, value]) => (
            <p key={key} className="mb-2">
              <span className="font-semibold">{key.replace(/_/g, " ")}:</span>{" "}
              {key === "scheme_start_date" && value.includes("date")
                ? (() => {
                    const parsed = JSON.parse(value.replace(/'/g, '"'));
                    return `${parsed.date} (NAV: ${parsed.nav})`;
                  })()
                : value}
            </p>
          ))}
        </div>
      ) : (
        <p className={styles.paragraph}>Search and select a scheme to view details</p>
      )}
    </div>
  );
};

const SchemeDetails = () => {
  console.log("SchemeDetails rendered");
  const [searchTerm, setSearchTerm] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [selectedScheme, setSelectedScheme] = useState(null);
  const [details, setDetails] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch suggestions with debouncing
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

    const timer = setTimeout(fetchSuggestions, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch details when a scheme is selected
  const fetchDetails = useCallback(async () => {
    if (!selectedScheme) {
      setDetails({});
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API_URL}/api/scheme-details/${selectedScheme.code}`);
      setDetails(response.data);
    } catch (err) {
      console.error("Error fetching scheme details:", err);
      setError("Failed to fetch scheme details. Please try again.");
      setDetails({});
    } finally {
      setLoading(false);
    }
  }, [selectedScheme]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  const handleSearchChange = (e) => {
    e.preventDefault();
    e.stopPropagation(); // Stop event bubbling
    console.log("Search term changed:", e.target.value);
    setSearchTerm(e.target.value);
    setSelectedScheme(null);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      console.log("Enter pressed, prevented reload");
    }
  };

  const handleSelectScheme = (e, scheme) => {
    e.preventDefault(); // Prevent any click-related reloads
    setSelectedScheme(scheme);
    setSearchTerm(scheme.name);
    setSuggestions([]);
  };

  // Prevent form-like submission on the container
  const handleContainerSubmit = (e) => {
    e.preventDefault();
  };

  return (
    <section
      className={`${styles.paddingY} ${styles.flexCenter} flex-col min-h-[50vh]`}
      onSubmit={handleContainerSubmit} // Catch any stray form submissions
    >
      <h2 className={styles.heading2}>Scheme Details</h2>
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
                onClick={(e) => handleSelectScheme(e, scheme)}
                className="p-2 hover:bg-gray-700 cursor-pointer"
              >
                {scheme.name}
              </li>
            ))}
          </ul>
        )}
      </div>
      <DetailsDisplay
        selectedScheme={selectedScheme}
        loading={loading}
        error={error}
        details={details}
      />
    </section>
  );
};

export default SchemeDetails;