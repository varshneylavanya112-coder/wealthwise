import { useState, useEffect } from "react";
import axios from "axios";
import styles from "../../style";
const API_URL = import.meta.env.VITE_API_URL || "https://codezen-backend-bz1g.onrender.com";

const AverageAUM = () => {
  const [aumData, setAumData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const aumPerPage = 10; // Number of AUM entries per page

  useEffect(() => {
    const fetchAumData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await axios.get(`${API_URL}/api/average-aum?period=${selectedPeriod}`);
        setAumData(response.data);
        setCurrentPage(1); // Reset to first page on data fetch
      } catch (err) {
        console.error("Error fetching AUM data:", err);
        setError("Failed to fetch AUM data. Please try again.");
        setAumData([]);
      } finally {
        setLoading(false);
      }
    };
    fetchAumData();
  }, []);

  // Pagination logic
  const totalAum = aumData.length;
  const totalPages = Math.ceil(totalAum / aumPerPage);
  const startIndex = (currentPage - 1) * aumPerPage;
  const endIndex = startIndex + aumPerPage;
  const currentAumData = aumData.slice(startIndex, endIndex);

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

  return (
    <section className={`${styles.paddingY} ${styles.flexCenter} flex-col min-h-[50vh]`}>
      <h2 className={styles.heading2}>Average AUM</h2>
      <div className="w-full max-w-[600px]">
        {loading ? (
          <p className={styles.paragraph}>Loading...</p>
        ) : error ? (
          <p className={styles.paragraph}>{error}</p>
        ) : aumData.length > 0 ? (
          <>
            <table className="w-full text-white bg-black-gradient rounded-lg">
              <thead>
                <tr>
                  <th className="p-2">Fund Name</th>
                  <th className="p-2">Total AUM</th>
                </tr>
              </thead>
              <tbody>
                {currentAumData.map((item, index) => (
                  <tr key={index}>
                    <td className="p-2">{item["Fund Name"]}</td>
                    <td className="p-2">{item["Total AUM"]}</td>
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
          <p className={styles.paragraph}>No AUM data available</p>
        )}
      </div>
    </section>
  );
};

export default AverageAUM;