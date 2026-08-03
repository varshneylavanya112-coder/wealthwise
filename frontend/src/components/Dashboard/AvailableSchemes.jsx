// frontend/src/components/Dashboard/AvailableSchemes.jsx
import { useState, useEffect } from "react";
import axios from "axios";
import styles from "../../style";

const API_URL = import.meta.env.VITE_API_URL || "https://codezen-backend-bz1g.onrender.com";

const AvailableSchemes = () => {
  const [amc, setAmc] = useState("ICICI");
  const [schemes, setSchemes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const schemesPerPage = 10;
  const [debouncedAmc, setDebouncedAmc] = useState(amc);

  // Debounce the AMC input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedAmc(amc);
    }, 500);
    return () => clearTimeout(timer);
  }, [amc]);

  // Fetch schemes based on debounced AMC
  useEffect(() => {
    const fetchSchemes = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await axios.get(`${API_URL}/api/schemes?search=${debouncedAmc}`);
        const schemesArray = Object.entries(response.data).map(([code, name]) => ({
          code,
          name,
        }));
        setSchemes(schemesArray);
        setCurrentPage(1);
      } catch (err) {
        console.error("Error fetching schemes:", err);
        setError("Failed to fetch schemes. Please try again.");
        setSchemes([]);
      } finally {
        setLoading(false);
      }
    };
    fetchSchemes();
  }, [debouncedAmc]);

  // Pagination logic
  const totalSchemes = schemes.length;
  const totalPages = Math.ceil(totalSchemes / schemesPerPage);
  const startIndex = (currentPage - 1) * schemesPerPage;
  const endIndex = startIndex + schemesPerPage;
  const currentSchemes = schemes.slice(startIndex, endIndex);

  const handlePrevious = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handleSearchChange = (e) => {
    e.preventDefault(); // Prevent any form-like submission
    setAmc(e.target.value);
  };

  return (
    <section className={`${styles.paddingY} ${styles.flexCenter} flex-col min-h-[50vh]`}>
      <h2 className={styles.heading2}>View Available Schemes</h2>
      <input
        type="text"
        value={amc}
        onChange={handleSearchChange}
        className="p-2 rounded bg-dimBlue text-white mb-4 w-full max-w-[600px] focus:outline-none"
        placeholder="Enter AMC or scheme name..."
      />
      <div className="w-full max-w-[600px]">
        {loading ? (
          <p className={styles.paragraph}>Loading...</p>
        ) : error ? (
          <p className={styles.paragraph}>{error}</p>
        ) : schemes.length > 0 ? (
          <>
            <table className="w-full text-white bg-black-gradient rounded-lg">
              <thead>
                <tr>
                  <th className="p-2">Scheme Code</th>
                  <th className="p-2">Scheme Name</th>
                </tr>
              </thead>
              <tbody>
                {currentSchemes.map((scheme) => (
                  <tr key={scheme.code}>
                    <td className="p-2">{scheme.code}</td>
                    <td className="p-2">{scheme.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-between items-center mt-4">
              <button
                onClick={handlePrevious}
                disabled={currentPage === 1}
                className={`py-2 px-4 rounded bg-blue-gradient text-primary font-poppins font-medium ${
                  currentPage === 1 ? "opacity-50 cursor-not-allowed" : "hover:bg-secondary"
                }`}
              >
                Previous
              </button>
              <span className="text-white font-poppins">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={handleNext}
                disabled={currentPage === totalPages}
                className={`py-2 px-4 rounded bg-blue-gradient text-primary font-poppins font-medium ${
                  currentPage === totalPages ? "opacity-50 cursor-not-allowed" : "hover:bg-secondary"
                }`}
              >
                Next
              </button>
            </div>
          </>
        ) : (
          <p className={styles.paragraph}>No schemes found for the given search</p>
        )}
      </div>
    </section>
  );
};

export default AvailableSchemes;