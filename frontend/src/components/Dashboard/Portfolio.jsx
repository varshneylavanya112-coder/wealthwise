import { useState, useEffect } from "react";
import axios from "axios";
import styles from "../../style";
import Groq from "groq-sdk";
import { useUser } from "@clerk/clerk-react";

const Portfolio = () => {
  const { user, isSignedIn } = useUser();
  const [portfolioItems, setPortfolioItems] = useState([]);
  const [portfolioSummary, setPortfolioSummary] = useState({ items: [], total_latest_nav: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [aiReport, setAiReport] = useState("");
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);

  const groqClient = new Groq({
    apiKey: import.meta.env.VITE_GROQ_API_KEY,
    dangerouslyAllowBrowser: true,
  });

  useEffect(() => {
    const fetchPortfolio = async () => {
      if (!isSignedIn || !user) {
        setError("Please log in to view your portfolio.");
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const itemsResponse = await axios.get(`${import.meta.env.VITE_API_URL}/api/get-portfolio/${user.id}`);
        setPortfolioItems(itemsResponse.data);

        const summaryResponse = await axios.get(`${import.meta.env.VITE_API_URL}/api/portfolio-summary/${user.id}`);
        setPortfolioSummary(summaryResponse.data);
      } catch (err) {
        console.error("Error fetching portfolio:", err);
        setError("Failed to fetch your portfolio. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    fetchPortfolio();
  }, [isSignedIn, user]);

  const handleRemoveItem = async (itemId) => {
    if (!isSignedIn || !user) {
      alert("Please log in to remove items.");
      return;
    }
    try {
      await axios.delete(`${import.meta.env.VITE_API_URL}/api/remove-from-portfolio/${user.id}/${itemId}`);
      setPortfolioItems(portfolioItems.filter((item) => item.item_id !== itemId));
      setPortfolioSummary((prev) => ({
        ...prev,
        items: prev.items.filter((item) => item.item_id !== itemId),
      }));
      alert("Item removed successfully!");
    } catch (err) {
      console.error("Error removing item:", err);
      alert(err.response?.data?.detail || "Failed to remove item.");
    }
  };

  const handleAiAnalysis = async () => {
    if (!isSignedIn || !user || portfolioItems.length === 0) {
      setAiAnalysis("Please add items to your portfolio to get an AI analysis!");
      return;
    }

    setLoadingAnalysis(true);
    setAiAnalysis("");

    const portfolioSummarySimple = portfolioItems.map((item) => ({
      name: item.name,
      type: item.item_type,
      added_at: item.added_at,
    }));

    const prompt = `
      I have a portfolio with these items: ${JSON.stringify(portfolioSummarySimple, null, 2)}.
      Provide a simple, friendly analysis for a beginner investor. Analyze the mix of mutual funds and cryptocurrencies, suggest how diversified it is, and offer basic insights on potential risks or benefits. Keep it conversational, short, and easy to understand!
    `;

    try {
      console.log("Starting AI DOST analysis with:", portfolioSummarySimple);
      const chatCompletion = await groqClient.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "llama-3.3-70b-versatile",
        temperature: 1,
        max_completion_tokens: 1024,
        top_p: 1,
        stream: true,
        stop: null,
      });

      let analysis = "";
      for await (const chunk of chatCompletion) {
        analysis += chunk.choices[0]?.delta?.content || "";
        setAiAnalysis(analysis);
      }
      console.log("AI DOST analysis completed:", analysis);
    } catch (err) {
      console.error("Error generating AI analysis:", err.message, err.stack);
      setAiAnalysis(`Error: ${err.message || "Unknown error occurred while generating the analysis."}`);
    } finally {
      setLoadingAnalysis(false);
    }
  };

  const handleAiReport = async () => {
    if (!isSignedIn || !user || portfolioItems.length === 0) {
      setAiReport("Please add items to your portfolio to get an AI report!");
      return;
    }

    setLoadingReport(true);
    setAiReport("");

    if (portfolioSummary.items.length === 0) {
      setAiReport("Portfolio summary data is not loaded. Please wait and try again.");
      setLoadingReport(false);
      return;
    }

    const totalNav = portfolioSummary.total_latest_nav;
    const summary = {
      items: portfolioSummary.items.map(item => ({
        name: item.name,
        type: item.type,
        latest_nav: item.latest_nav,
        one_year_growth: item.one_year_growth,
        monte_carlo_prediction: item.monte_carlo,
        risk_volatility: item.risk_volatility,
      })),
      total_latest_nav: totalNav,
    };

    const prompt = `
      Act as a Mutual Fund Expert Advisor. I have a portfolio with the following data:
      - Portfolio Items: ${JSON.stringify(summary.items, null, 2)}
      - Total Latest NAV: ₹${summary.total_latest_nav.toFixed(2)}
      Provide a detailed, friendly report for a beginner investor, guiding them on how to proceed with this portfolio based on this data:
      Fund Overview - Briefly explain what this portfolio contains and its investment focus.
      Performance Summary - Summarize its recent performance and trends.
      Risk Assessment - Evaluate its risk level using volatility and monthly swings.
      Future Outlook - Use Monte Carlo data to predict future performance and potential.
      Action Plan - Provide simple, actionable steps (e.g., invest, hold, diversify) with reasons based on the data.
      Format each section with a heading in bold (e.g., **Fund Overview**) followed by a short paragraph. Keep it easy to understand, avoid complicated terms, and make it feel like expert yet friendly guidance!
    `;

    try {
      console.log("Starting AI Report generation with:", summary);
      const chatCompletion = await groqClient.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "llama-3.3-70b-versatile",
        temperature: 0.8,
        max_completion_tokens: 2048,
        top_p: 1,
        stream: true,
        stop: null,
      });

      let report = "";
      for await (const chunk of chatCompletion) {
        const chunkContent = chunk.choices[0]?.delta?.content || "";
        report += chunkContent.replace(/\*/g, ""); // Remove asterisks during streaming
        setAiReport(report);
      }
      console.log("AI Report generation completed:", report);
    } catch (err) {
      console.error("Error generating AI report:", err.message, err.stack);
      setAiReport(`Error: ${err.message || "Unknown error occurred while generating the report. Check your API key or network."}`);
    } finally {
      setLoadingReport(false);
    }
  };

  if (!isSignedIn) {
    // Redirect to Clerk sign-in route
    window.location.href = "/sign-in";
    return null;
  }

  return (
    <div className={`bg-primary ${styles.paddingX} min-h-screen py-6`}>
      <div className="max-w-[1200px] mx-auto">
        <div className="bg-gray-800 rounded-lg p-6 mb-6 shadow-md">
          <h1 className="text-white text-3xl font-semibold mb-2">
            Welcome, {user?.fullName || user?.firstName || user?.primaryEmailAddress?.emailAddress || "User"}!
          </h1>
          <p className="text-gray-400 text-lg mb-4">
            Here’s everything you’ve added to your portfolio:
          </p>
          <div className="flex gap-4">
            <button
              onClick={handleAiAnalysis}
              disabled={loadingAnalysis || loadingReport || portfolioItems.length === 0}
              className={`py-2 px-4 rounded bg-blue-gradient text-primary font-poppins font-medium ${
                loadingAnalysis || loadingReport || portfolioItems.length === 0
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:bg-blue-500"
              }`}
            >
              {loadingAnalysis ? "Generating..." : "AI DOST"}
            </button>
            <button
              onClick={handleAiReport}
              disabled={loadingAnalysis || loadingReport || portfolioItems.length === 0}
              className={`py-2 px-4 rounded bg-purple-600 text-white font-poppins font-medium ${
                loadingAnalysis || loadingReport || portfolioItems.length === 0
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:bg-purple-700"
              }`}
            >
              {loadingReport ? "Generating..." : "AI Report"}
            </button>
          </div>
        </div>

        {aiAnalysis && (
          <div className="bg-gray-800 rounded-lg p-6 mb-6 shadow-md text-white">
            <h3 className="text-xl font-semibold mb-4 text-blue-300">AI DOST Analysis</h3>
            <div
              className="text-gray-200 text-base leading-relaxed"
              style={{ whiteSpace: "pre-wrap" }}
            >
              {aiAnalysis}
            </div>
          </div>
        )}

        {aiReport && (
          <div className="bg-gray-900 rounded-lg p-6 mb-6 shadow-lg border border-purple-500">
            <h3 className="text-2xl font-bold mb-6 text-purple-300 tracking-wide">AI Investment Report</h3>
            <div
              className="text-gray-100 text-lg leading-loose font-light"
              style={{ whiteSpace: "pre-wrap" }}
            >
              {aiReport}
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-white text-center">Loading your portfolio...</p>
        ) : error ? (
          <p className="text-red-500 text-center">{error}</p>
        ) : portfolioItems.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {portfolioItems.map((item, index) => (
              <div
                key={index}
                className="bg-gray-700 rounded-lg p-4 shadow-md flex flex-col"
              >
                <h3 className="text-white text-lg font-semibold mb-2">{item.name}</h3>
                <p className="text-gray-300 text-sm">Type: {item.item_type}</p>
                <p className="text-gray-300 text-sm">
                  Added: {new Date(item.added_at).toLocaleDateString()}
                </p>
                <button
                  onClick={() => handleRemoveItem(item.item_id)}
                  className="mt-2 py-1 px-3 bg-red-600 text-white rounded font-poppins text-sm hover:bg-red-700"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-center">
            Your portfolio is empty. Add some funds or coins from the dashboards!
          </p>
        )}
      </div>
    </div>
  );
};

export default Portfolio;