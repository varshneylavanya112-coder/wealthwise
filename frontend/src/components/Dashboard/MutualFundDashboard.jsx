import { useState, useEffect } from "react";
import axios from "axios";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import Plotly from "react-plotly.js";
import styles from "../../style";
import RiskVolatility from "./RiskVolatility";
import MonteCarloPrediction from "./MonteCarloPrediiction"; // Fix typo in production to "MonteCarloPrediction"
import CalculateReturns from "./CalculateReturns";
import CompareNAVs from "./CompareNAVs";
import Chatbot from "../Chatbot";
import Groq from "groq-sdk";
import { useUser } from "@clerk/clerk-react";
import { motion } from "framer-motion";

const API_URL = import.meta.env.VITE_API_URL || "https://codezen-backend-bz1g.onrender.com";

const MutualFundDashboard = () => {
  const { user, isSignedIn } = useUser();
  const [searchTerm, setSearchTerm] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [selectedFund, setSelectedFund] = useState(null);
  const [randomFunds, setRandomFunds] = useState([]);
  const [fundDetails, setFundDetails] = useState({});
  const [historicalNav, setHistoricalNav] = useState([]);
  const [heatmapData, setHeatmapData] = useState([]);
  const [monteCarloData, setMonteCarloData] = useState(null);
  const [riskVolatilityData, setRiskVolatilityData] = useState(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);
  const [error, setError] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [aiReport, setAiReport] = useState("");
  const [timePeriod, setTimePeriod] = useState("1M");

  const groqClient = new Groq({
    apiKey: import.meta.env.VITE_GROQ_API_KEY,
    dangerouslyAllowBrowser: true,
  });

  // Token estimation function (rough approximation: 1 token ~ 4 characters)
  const estimateTokens = (text) => Math.ceil(text.length / 4);

  // TPM limit for the model
  const TPM_LIMIT = 6000;

  useEffect(() => {
    const fetchRandomFunds = async () => {
      setLoadingAnalysis(true);
      try {
        const response = await axios.get(`${API_URL}/api/schemes?search=`);
        const allFunds = Object.entries(response.data).map(([code, name]) => ({ code, name }));
        const shuffled = allFunds.sort(() => 0.5 - Math.random());
        setRandomFunds(shuffled.slice(0, 5));
      } catch (err) {
        console.error("Error fetching random funds:", err);
        setError("Failed to load initial funds.");
      } finally {
        setLoadingAnalysis(false);
      }
    };
    fetchRandomFunds();
  }, []);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (searchTerm.length < 2) {
        setSuggestions([]);
        return;
      }
      setLoadingAnalysis(true);
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
        setError("Failed to fetch suggestions.");
        setSuggestions([]);
      } finally {
        setLoadingAnalysis(false);
      }
    };
    const timer = setTimeout(fetchSuggestions, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    const fetchFundDetails = async () => {
      if (!selectedFund) {
        setFundDetails({});
        setHistoricalNav([]);
        setHeatmapData([]);
        setMonteCarloData(null);
        setRiskVolatilityData(null);
        setAiAnalysis("");
        setAiReport("");
        return;
      }
      setLoadingAnalysis(true);
      setError(null);
      try {
        const detailsResponse = await axios.get(`${API_URL}/api/scheme-details/${selectedFund.code}`);
        setFundDetails(detailsResponse.data);
        const navResponse = await axios.get(`${API_URL}/api/historical-nav/${selectedFund.code}`);
        setHistoricalNav(navResponse.data);
        const heatmapResponse = await axios.get(`${API_URL}/api/performance-heatmap/${selectedFund.code}`);
        setHeatmapData(heatmapResponse.data);
        const monteCarloResponse = await axios.get(`${API_URL}/api/monte-carlo-prediction/${selectedFund.code}`);
        setMonteCarloData(monteCarloResponse.data);
        const riskResponse = await axios.get(`${API_URL}/api/risk-volatility/${selectedFund.code}`);
        setRiskVolatilityData(riskResponse.data);
      } catch (err) {
        console.error("Error fetching fund details:", err);
        setError(`Failed to fetch fund details: ${err.message}`);
      } finally {
        setLoadingAnalysis(false);
      }
    };
    fetchFundDetails();
  }, [selectedFund]);

  const handleSearchChange = (e) => {
    e.preventDefault();
    setSearchTerm(e.target.value);
    setSelectedFund(null);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
    }
  };

  const handleSelectFund = (fund) => {
    setSelectedFund(fund);
    setSearchTerm(fund.name);
    setSuggestions([]);
  };

  const addToPortfolio = async (item) => {
    if (!isSignedIn || !user) {
      alert("Please log in to add items to your portfolio!");
      return;
    }
    try {
      const response = await axios.post(`${API_URL}/api/add-to-portfolio`, {
        user_id: user.id,
        item_type: "mutual_fund",
        item_id: item.code,
        name: item.name,
      });
      alert(response.data.message);
    } catch (err) {
      console.error("Error adding to portfolio:", err);
      alert(err.response?.data?.detail || "Failed to add to portfolio");
    }
  };

  const handleAiAnalysis = async () => {
    if (!selectedFund || Object.keys(fundDetails).length === 0) {
      setAiAnalysis("Please select a fund first!");
      return;
    }

    setLoadingAnalysis(true);
    setAiAnalysis("");

    const latestNav = historicalNav.length > 0 ? parseFloat(historicalNav[historicalNav.length - 1].nav) : 0;
    const oneYearAgoNav = historicalNav.length > 252 ? parseFloat(historicalNav[historicalNav.length - 252].nav) : latestNav;
    const oneYearGrowth = oneYearAgoNav > 0 ? ((latestNav - oneYearAgoNav) / oneYearAgoNav * 100).toFixed(1) : "N/A";
    const bestMonth = heatmapData.length > 0 ? heatmapData.reduce((max, curr) => max.dayChange > curr.dayChange ? max : curr) : { month: "N/A", dayChange: 0 };
    const worstMonth = heatmapData.length > 0 ? heatmapData.reduce((min, curr) => min.dayChange < curr.dayChange ? min : curr) : { month: "N/A", dayChange: 0 };

    const summary = {
      fund_name: selectedFund.name,
      type: `${fundDetails.scheme_type} ${fundDetails.scheme_category}`,
      launched: fundDetails.scheme_start_date ? JSON.parse(fundDetails.scheme_start_date.replace(/'/g, '"')).date : "N/A",
      starting_nav: fundDetails.scheme_start_date ? parseFloat(JSON.parse(fundDetails.scheme_start_date.replace(/'/g, '"')).nav) : 0,
      latest_nav: latestNav,
      one_year_growth: oneYearGrowth,
      best_month: bestMonth.month ? `${bestMonth.month} (+${(bestMonth.dayChange * 100).toFixed(2)}%)` : "N/A",
      worst_month: worstMonth.month ? `${worstMonth.month} (${(worstMonth.dayChange * 100).toFixed(2)}%)` : "N/A",
      monte_carlo_prediction: monteCarloData || "N/A",
    };

    const prompt = `
      I have data about a mutual fund called '${summary.fund_name}'. Please provide a simple, friendly explanation...
      - Fund Name: ${summary.fund_name}
      - Type: ${summary.type}
      - Launched: ${summary.launched}
      - Starting NAV: ₹${summary.starting_nav.toFixed(2)}
      - Latest NAV: ₹${summary.latest_nav.toFixed(2)}
      - 1-Year Growth: ${summary.one_year_growth}%
      - Best Month: ${summary.best_month}
      - Worst Month: ${summary.worst_month}
      - Monte Carlo Prediction: ${JSON.stringify(summary.monte_carlo_prediction)}
      ...
    `; // Keeping this as is since it’s already working

    try {
      const chatCompletion = await groqClient.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "openai/gpt-oss-120b",
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
    } catch (err) {
      console.error("Error generating AI analysis:", err.message, err.stack);
      setAiAnalysis(`Error: ${err.message || "Unknown error occurred while generating the analysis."}`);
    } finally {
      setLoadingAnalysis(false);
    }
  };

  const handleAiReport = async () => {
    if (!selectedFund || Object.keys(fundDetails).length === 0) {
      setAiReport("Please select a fund first!");
      return;
    }

    setLoadingReport(true);
    setAiReport("");

    if (!historicalNav.length || !heatmapData.length || !monteCarloData || !riskVolatilityData) {
      setAiReport("Incomplete data fetched from backend. Please try again.");
      setLoadingReport(false);
      return;
    }

    const latestNav = parseFloat(historicalNav[historicalNav.length - 1].nav);
    const oneYearAgoNav = historicalNav.length > 252 ? parseFloat(historicalNav[historicalNav.length - 252].nav) : latestNav;
    const oneYearGrowth = oneYearAgoNav > 0 ? ((latestNav - oneYearAgoNav) / oneYearAgoNav * 100).toFixed(1) : "N/A";
    const bestMonth = heatmapData.reduce((max, curr) => max.dayChange > curr.dayChange ? max : curr, { month: "N/A", dayChange: 0 });
    const worstMonth = heatmapData.reduce((min, curr) => min.dayChange < curr.dayChange ? min : curr, { month: "N/A", dayChange: 0 });

    const summary = {
      fund_name: selectedFund.name,
      type: `${fundDetails.scheme_type} ${fundDetails.scheme_category}`,
      latest_nav: latestNav,
      one_year_growth: oneYearGrowth,
      best_month: bestMonth.month ? `${bestMonth.month} (+${(bestMonth.dayChange * 100).toFixed(2)}%)` : "N/A",
      worst_month: worstMonth.month ? `${worstMonth.month} (${(worstMonth.dayChange * 100).toFixed(2)}%)` : "N/A",
      monte_carlo_prediction: monteCarloData,
      risk_volatility: riskVolatilityData,
    };

    // Simplified data for prompt to reduce token count
    const monteCarloSummary = {
      expected_nav: summary.monte_carlo_prediction?.expected_nav || "N/A",
      probability_positive: summary.monte_carlo_prediction?.probability_positive || "N/A",
    };
    const riskVolatilitySummary = {
      risk_level: summary.risk_volatility?.risk_level || "N/A",
      volatility: summary.risk_volatility?.volatility || "N/A",
    };

    const prompt = `
      Act as a Mutual Fund Expert Advisor. I have data about a mutual fund called '${summary.fund_name}'. Provide a detailed, friendly report for a beginner investor, guiding them on how to proceed with this fund based on this data:
      - Fund Name: ${summary.fund_name}
      - Type: ${summary.type}
      - Latest NAV: ₹${summary.latest_nav.toFixed(2)}
      - 1-Year Growth: ${summary.one_year_growth}%
      - Best Month: ${summary.best_month}
      - Worst Month: ${summary.worst_month}
      - Monte Carlo Prediction (Expected NAV): ₹${monteCarloSummary.expected_nav} (Probability of Positive Return: ${monteCarloSummary.probability_positive})
      - Risk & Volatility: Risk Level - ${riskVolatilitySummary.risk_level}, Volatility - ${riskVolatilitySummary.volatility}
      Create a clear, conversational report in a sectioned format with these headings:
      Fund Overview - Briefly explain what this fund is and its investment focus.
      Performance Summary - Summarize its recent performance and trends.
      Risk Assessment - Evaluate its risk level using volatility and monthly swings.
      Future Outlook - Use Monte Carlo data to predict future performance and potential.
      Action Plan - Provide simple, actionable steps (e.g., invest, hold, diversify) with reasons based on the data.
      Format each section as plain text with the heading in bold (e.g., **Fund Overview**) followed by a short paragraph. Keep it easy to understand, avoid jargon, and offer expert yet friendly guidance!
    `;

    const tokenCount = estimateTokens(prompt) + 2048; // Input + max output tokens
    console.log("Estimated token count for AI Report:", tokenCount);

    if (tokenCount > TPM_LIMIT) {
      setAiReport("Error: Request too large. Please try a simpler fund or wait a moment before retrying.");
      setLoadingReport(false);
      return;
    }

    try {
      console.log("Starting AI Report generation with data:", summary);
      const chatCompletion = await groqClient.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "openai/gpt-oss-120b",
        temperature: 0.8,
        max_completion_tokens: 2048,
        top_p: 1,
        stream: true,
        stop: null,
      });

      let report = "";
      for await (const chunk of chatCompletion) {
        report += chunk.choices[0]?.delta?.content || "";
        setAiReport(report);
      }
      console.log("AI Report generation completed:", report);
    } catch (err) {
      console.error("Error generating AI report:", err.message, err.stack);
      setAiReport(`Error: ${err.message || "Unknown error occurred while generating the report."}`);
    } finally {
      setLoadingReport(false);
    }
  };

  const getFilteredNavData = () => {
    if (!historicalNav.length) return [];
    let days;
    switch (timePeriod) {
      case "1M": days = 30; break;
      case "3M": days = 90; break;
      case "6M": days = 180; break;
      case "1Y": days = 365; break;
      default: days = 30;
    }
    const filtered = historicalNav.slice(-days);
    return filtered.length > 30 ? filtered.filter((_, index) => index % Math.ceil(filtered.length / 30) === 0) : filtered;
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

  const filteredNavData = getFilteredNavData();

  const randomFundsSection = (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {randomFunds.map((fund) => (
        <div key={fund.code} className="bg-gray-800 rounded-lg p-4 shadow-md hover:bg-gray-700 transition-colors">
          <h3 className="text-white text-md font-semibold mb-2">{fund.name}</h3>
          <p className="text-gray-400 text-sm">Code: {fund.code}</p>
          <div className="flex justify-between mt-2">
            <button onClick={() => handleSelectFund(fund)} className="py-1 px-3 bg-blue-gradient text-primary rounded font-poppins text-sm">
              View Details
            </button>
            <button onClick={() => addToPortfolio(fund)} className="py-1 px-3 bg-green-600 text-white rounded font-poppins text-sm hover:bg-green-700">
              Add to Portfolio
            </button>
          </div>
        </div>
      ))}
    </div>
  );

  const selectedFundSection = selectedFund && (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-gray-800 rounded-lg p-4 shadow-md">
        <h3 className="text-white text-lg font-semibold mb-2">{selectedFund.name}</h3>
        <div className="text-gray-300 text-sm">
          {Object.entries(fundDetails).slice(0, 5).map(([key, value]) => (
            <p key={key} className="mb-1">
              <span className="font-medium">{key.replace(/_/g, " ")}:</span>{" "}
              {key === "scheme_start_date" && value.includes("date")
                ? (() => {
                    const parsed = JSON.parse(value.replace(/'/g, '"'));
                    return `${parsed.date} (NAV: ${parsed.nav})`;
                  })()
                : value}
            </p>
          ))}
        </div>
        <button onClick={() => addToPortfolio(selectedFund)} className="mt-4 py-1 px-3 bg-green-600 text-white rounded font-poppins text-sm hover:bg-green-700">
          Add to Portfolio
        </button>
      </div>
      <div className="bg-gray-800 rounded-lg p-4 shadow-md">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-white text-lg font-semibold">Historical NAV</h3>
          <div className="flex gap-2">
            {["1M", "3M", "6M", "1Y"].map((period) => (
              <button key={period} onClick={() => setTimePeriod(period)} className={`px-2 py-1 rounded text-sm ${timePeriod === period ? "bg-blue-gradient text-primary" : "bg-gray-700 text-white"} hover:bg-secondary`}>
                {period}
              </button>
            ))}
          </div>
        </div>
        {filteredNavData.length > 0 ? (
          <LineChart width={350} height={200} data={filteredNavData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#444" />
            <XAxis dataKey="date" stroke="#fff" tick={{ fontSize: 10 }} interval="preserveStartEnd" tickCount={6} />
            <YAxis stroke="#fff" tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
            <Tooltip contentStyle={{ backgroundColor: "#333", border: "none" }} />
            <Line type="monotone" dataKey="nav" stroke="#00f6ff" dot={false} strokeWidth={2} />
          </LineChart>
        ) : (
          <p className="text-gray-400">No NAV data</p>
        )}
      </div>
      <div className="bg-gray-800 rounded-lg p-4 shadow-md">
        <CalculateReturns selectedScheme={selectedFund} />
      </div>
      <div className="bg-gray-800 rounded-lg p-4 shadow-md">
        <h3 className="text-white text-lg font-semibold mb-2">Performance Heatmap</h3>
        {heatmapData.length > 0 ? (
          <Plotly
            data={plotData}
            layout={{
              xaxis: { title: "Month", color: "#fff", tickfont: { size: 10 } },
              yaxis: { title: "Day Change", color: "#fff", tickfont: { size: 10 } },
              width: 350,
              height: 200,
              margin: { t: 20, b: 40, l: 40, r: 20 },
            }}
            config={{ displayModeBar: false }}
          />
        ) : (
          <p className="text-gray-400">No heatmap data</p>
        )}
      </div>
      <div className="bg-gray-800 rounded-lg p-4 shadow-md">
        <RiskVolatility selectedScheme={selectedFund} />
      </div>
      <div className="bg-gray-800 rounded-lg p-4 shadow-md">
        <MonteCarloPrediction selectedScheme={selectedFund} />
      </div>
    </div>
  );

  return (
    <div className={`bg-primary ${styles.paddingX} min-h-screen py-6`}>
      <div className="max-w-[1200px] mx-auto">
        <motion.h1 className={`${styles.heading2} text-center text-gradient mb-6`} initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
          Mutual Fund Dashboard
        </motion.h1>
        <div className="bg-gray-800 rounded-lg p-4 mb-6 shadow-md relative">
          <input
            type="text"
            value={searchTerm}
            onChange={handleSearchChange}
            onKeyDown={handleKeyDown}
            className="w-full p-2 rounded bg-gray-900 text-white focus:outline-none border border-gray-700"
            placeholder="Search for a mutual fund..."
          />
          {suggestions.length > 0 && (
            <ul className="absolute z-10 bg-gray-800 text-white rounded-lg w-[300px] max-h-60 overflow-y-auto mt-2 shadow-lg">
              {suggestions.map((fund) => (
                <li key={fund.code} onClick={() => handleSelectFund(fund)} className="p-2 hover:bg-gray-700 cursor-pointer">
                  {fund.name}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex gap-4">
            <button
              onClick={handleAiAnalysis}
              disabled={loadingAnalysis || loadingReport || !selectedFund}
              className={`py-2 px-4 rounded bg-blue-gradient text-primary font-poppins font-medium ${loadingAnalysis || loadingReport || !selectedFund ? "opacity-50 cursor-not-allowed" : "hover:bg-blue-500"}`}
            >
              {loadingAnalysis ? "Generating..." : "AI DOST"}
            </button>
            <button
              onClick={handleAiReport}
              disabled={loadingAnalysis || loadingReport || !selectedFund}
              className={`py-2 px-4 rounded bg-purple-600 text-white font-poppins font-medium ${loadingAnalysis || loadingReport || !selectedFund ? "opacity-50 cursor-not-allowed" : "hover:bg-purple-700"}`}
            >
              {loadingReport ? "Generating..." : "AI Report"}
            </button>
          </div>
        </div>
        {aiAnalysis && (
          <div className="bg-gray-800 rounded-lg p-6 mb-6 shadow-md text-white">
            <h3 className="text-xl font-semibold mb-4 text-blue-300">AI DOST Analysis</h3>
            <div className="text-gray-200 text-base leading-relaxed" style={{ whiteSpace: "pre-line" }} dangerouslySetInnerHTML={{ __html: aiAnalysis.replace(/\*/g, "") }} />
          </div>
        )}
        {aiReport && (
          <div className="bg-gray-900 rounded-lg p-6 mb-6 shadow-lg border border-purple-500">
            <h3 className="text-2xl font-bold mb-6 text-purple-300 tracking-wide">AI Investment Report</h3>
            <div className="text-gray-100 text-lg leading-loose font-light" style={{ whiteSpace: "pre-line" }} dangerouslySetInnerHTML={{ __html: aiReport.replace(/\*/g, "").replace(/\n\n/g, "<br/><br/>") }} />
          </div>
        )}
        {(loadingAnalysis || loadingReport) && !aiAnalysis && !aiReport ? (
          <p className="text-white text-center">Loading...</p>
        ) : error ? (
          <p className="text-red-500 text-center">{error}</p>
        ) : selectedFund ? (
          selectedFundSection
        ) : (
          randomFundsSection
        )}
        <div className="mt-8">
          <CompareNAVs />
        </div>
      </div>
      <Chatbot selectedFund={selectedFund} />
    </div>
  );
};

export default MutualFundDashboard;