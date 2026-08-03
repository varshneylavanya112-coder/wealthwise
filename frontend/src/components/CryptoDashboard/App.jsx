import { useState, useEffect, useContext } from "react";
import axios from "axios";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import Plotly from "react-plotly.js";
import styles from "../../style";
import { CoinContext } from "../../context/CoinContext";
import Chatbot from "../Chatbot";
import Groq from "groq-sdk";
import { useUser } from "@clerk/clerk-react";
import { motion } from "framer-motion";

const API_URL = import.meta.env.VITE_API_URL || "https://codezen-backend-bz1g.onrender.com";

// Custom Components (Now Rendering JSX)
const RiskVolatility = ({ selectedCoin, historicalPrice }) => {
  const [metrics, setMetrics] = useState({});
  useEffect(() => {
    if (!selectedCoin || !historicalPrice.length) return;
    const returns = historicalPrice.slice(1).map((curr, i) => {
      const prev = historicalPrice[i].nav;
      return (curr.nav - prev) / prev;
    });
    const annualizedVolatility = (returns.reduce((sum, r) => sum + r * r, 0) / returns.length) ** 0.5 * (252 ** 0.5);
    const annualizedReturn = (returns.reduce((sum, r) => sum + r, 0) / returns.length * 252);
    const sharpeRatio = annualizedVolatility > 0 ? (annualizedReturn - 0.02) / annualizedVolatility : 0; // 2% risk-free rate
    setMetrics({
      annualized_volatility: annualizedVolatility,
      annualized_return: annualizedReturn,
      sharpe_ratio: sharpeRatio,
    });
  }, [selectedCoin, historicalPrice]);

  return (
    <div className="text-gray-300 text-sm">
      {metrics.annualized_volatility ? (
        <>
          <p>Volatility (Yearly): {(metrics.annualized_volatility * 100).toFixed(2)}%</p>
          <p>Return (Yearly): {(metrics.annualized_return * 100).toFixed(2)}%</p>
          <p>Sharpe Ratio: {metrics.sharpe_ratio.toFixed(2)}</p>
        </>
      ) : (
        <p>No risk data available yet.</p>
      )}
    </div>
  );
};

const MonteCarloPrediction = ({ selectedCoin, historicalPrice }) => {
  const [prediction, setPrediction] = useState({});
  useEffect(() => {
    if (!selectedCoin || !historicalPrice.length) return;
    const returns = historicalPrice.slice(1).map((curr, i) => (curr.nav - historicalPrice[i].nav) / historicalPrice[i].nav);
    const mu = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const sigma = (returns.reduce((sum, r) => sum + r * r, 0) / returns.length - mu * mu) ** 0.5;
    const lastPrice = historicalPrice[historicalPrice.length - 1].nav;
    const days = 252;
    const numSimulations = 1000;
    let simulations = Array(numSimulations).fill(lastPrice);
    for (let t = 1; t < days; t++) {
      const randomReturns = Array(numSimulations).fill(0).map(() => mu + sigma * (Math.random() * 2 - 1));
      simulations = simulations.map((price, i) => price * (1 + randomReturns[i]));
    }
    const expectedPrice = simulations.reduce((sum, p) => sum + p, 0) / numSimulations;
    const probPositive = simulations.filter(p => p > lastPrice).length / numSimulations;
    setPrediction({
      expected_price: expectedPrice,
      probability_positive_return: probPositive * 100,
      last_price: lastPrice,
    });
  }, [selectedCoin, historicalPrice]);

  return (
    <div className="text-gray-300 text-sm">
      {prediction.expected_price ? (
        <>
          <p>Expected Price (1 Year): ${prediction.expected_price.toFixed(2)}</p>
          <p>Chance of Gain: {prediction.probability_positive_return.toFixed(1)}%</p>
          <p>Current Price: ${prediction.last_price.toFixed(2)}</p>
        </>
      ) : (
        <p>No prediction data available yet.</p>
      )}
    </div>
  );
};

const CalculateReturns = ({ selectedCoin, historicalPrice }) => {
  const [returns, setReturns] = useState({});
  useEffect(() => {
    if (!selectedCoin || !historicalPrice.length) return;
    const latestPrice = historicalPrice[historicalPrice.length - 1].nav;
    const oneYearAgoPrice = historicalPrice.length > 252 ? historicalPrice[historicalPrice.length - 252].nav : latestPrice;
    const oneYearReturn = oneYearAgoPrice > 0 ? ((latestPrice - oneYearAgoPrice) / oneYearAgoPrice * 100) : "N/A";
    setReturns({ one_year_return: oneYearReturn });
  }, [selectedCoin, historicalPrice]);

  return (
    <div className="text-gray-300 text-sm">
      {returns.one_year_return !== undefined ? (
        <p>1-Year Return: {typeof returns.one_year_return === "string" ? returns.one_year_return : `${returns.one_year_return.toFixed(1)}%`}</p>
      ) : (
        <p>No return data available yet.</p>
      )}
    </div>
  );
};

// Helper functions to compute data for AI prompt
const computeRiskVolatility = (historicalPrice) => {
  if (!historicalPrice.length) return {};
  const returns = historicalPrice.slice(1).map((curr, i) => {
    const prev = historicalPrice[i].nav;
    return (curr.nav - prev) / prev;
  });
  const annualizedVolatility = (returns.reduce((sum, r) => sum + r * r, 0) / returns.length) ** 0.5 * (252 ** 0.5);
  const annualizedReturn = (returns.reduce((sum, r) => sum + r, 0) / returns.length * 252);
  const sharpeRatio = annualizedVolatility > 0 ? (annualizedReturn - 0.02) / annualizedVolatility : 0;
  return {
    annualized_volatility: annualizedVolatility,
    annualized_return: annualizedReturn,
    sharpe_ratio: sharpeRatio,
  };
};

const computeMonteCarloPrediction = (historicalPrice) => {
  if (!historicalPrice.length) return {};
  const returns = historicalPrice.slice(1).map((curr, i) => (curr.nav - historicalPrice[i].nav) / historicalPrice[i].nav);
  const mu = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const sigma = (returns.reduce((sum, r) => sum + r * r, 0) / returns.length - mu * mu) ** 0.5;
  const lastPrice = historicalPrice[historicalPrice.length - 1].nav;
  const days = 252;
  const numSimulations = 1000;
  let simulations = Array(numSimulations).fill(lastPrice);
  for (let t = 1; t < days; t++) {
    const randomReturns = Array(numSimulations).fill(0).map(() => mu + sigma * (Math.random() * 2 - 1));
    simulations = simulations.map((price, i) => price * (1 + randomReturns[i]));
  }
  const expectedPrice = simulations.reduce((sum, p) => sum + p, 0) / numSimulations;
  const probPositive = simulations.filter(p => p > lastPrice).length / numSimulations;
  return {
    expected_price: expectedPrice,
    probability_positive_return: probPositive * 100,
    last_price: lastPrice,
  };
};

const computeReturns = (historicalPrice) => {
  if (!historicalPrice.length) return {};
  const latestPrice = historicalPrice[historicalPrice.length - 1].nav;
  const oneYearAgoPrice = historicalPrice.length > 252 ? historicalPrice[historicalPrice.length - 252].nav : latestPrice;
  const oneYearReturn = oneYearAgoPrice > 0 ? ((latestPrice - oneYearAgoPrice) / oneYearAgoPrice * 100) : "N/A";
  return { one_year_return: oneYearReturn };
};

const CryptoDashboard = () => {
  const { allCoin, currency } = useContext(CoinContext);
  const { user, isSignedIn } = useUser();
  const [searchTerm, setSearchTerm] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [selectedCoin, setSelectedCoin] = useState(null);
  const [randomCoins, setRandomCoins] = useState([]);
  const [coinDetails, setCoinDetails] = useState({});
  const [historicalPrice, setHistoricalPrice] = useState([]);
  const [heatmapData, setHeatmapData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [aiReport, setAiReport] = useState("");
  const [loadingReport, setLoadingReport] = useState(false);
  const [priceRange, setPriceRange] = useState("365"); // Default to 1 year

  const groqClient = new Groq({
    apiKey: import.meta.env.VITE_GROQ_API_KEY,
    dangerouslyAllowBrowser: true,
  });

  // Fetch random coins on initial load
  useEffect(() => {
    if (allCoin.length > 0) {
      const shuffled = [...allCoin].sort(() => 0.5 - Math.random());
      setRandomCoins(shuffled.slice(0, 5));
    }
  }, [allCoin]);

  // Fetch suggestions based on search term
  useEffect(() => {
    if (searchTerm.length < 2) {
      setSuggestions([]);
      return;
    }
    const filtered = allCoin
      .filter((coin) => coin.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .slice(0, 10);
    setSuggestions(filtered);
  }, [searchTerm, allCoin]);

  // Fetch coin details and historical price
  useEffect(() => {
    const fetchCoinDetails = async () => {
      if (!selectedCoin) {
        setCoinDetails({});
        setHistoricalPrice([]);
        setHeatmapData([]);
        setAiAnalysis("");
        setAiReport("");
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const detailsResponse = await axios.get(
          `https://api.coingecko.com/api/v3/coins/${selectedCoin.id}`,
          { headers: { "x-cg-demo-api-key": "CG-yDF1jqFeSyQ6SL3MbpeuPuMc" } }
        );
        setCoinDetails(detailsResponse.data);

        const priceResponse = await axios.get(
          `https://api.coingecko.com/api/v3/coins/${selectedCoin.id}/market_chart?vs_currency=usd&days=${priceRange}&interval=daily`,
          { headers: { "x-cg-demo-api-key": "CG-yDF1jqFeSyQ6SL3MbpeuPuMc" } }
        );
        const prices = priceResponse.data.prices.map(([timestamp, price]) => ({
          date: new Date(timestamp).toISOString().split("T")[0],
          nav: price,
        }));
        setHistoricalPrice(prices);

        const monthlyReturns = prices.slice(1).reduce((acc, curr, i) => {
          const month = new Date(curr.date).getMonth() + 1;
          const dailyChange = (curr.nav - prices[i].nav) / prices[i].nav;
          acc[month] = acc[month] ? (acc[month] + dailyChange) / 2 : dailyChange;
          return acc;
        }, {});
        setHeatmapData(
          Object.entries(monthlyReturns).map(([month, dayChange]) => ({
            month,
            dayChange,
          }))
        );
      } catch (err) {
        console.error("Error fetching coin details:", err);
        setError("Failed to fetch coin details.");
      } finally {
        setLoading(false);
      }
    };
    fetchCoinDetails();
  }, [selectedCoin, priceRange]);

  const handleSearchChange = (e) => {
    e.preventDefault();
    setSearchTerm(e.target.value);
    setSelectedCoin(null);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") e.preventDefault();
  };

  const handleSelectCoin = (coin) => {
    setSelectedCoin(coin);
    setSearchTerm(coin.name);
    setSuggestions([]);
  };

  const addToPortfolio = async (coin) => {
    if (!isSignedIn || !user) {
      alert("Please log in to add items to your portfolio!");
      return;
    }
    try {
      const response = await axios.post(
        `${API_URL}/api/add-to-portfolio`,
        {
          user_id: user.id,
          item_type: "crypto",
          item_id: coin.id,
          name: coin.name,
        }
      );
      alert(response.data.message);
    } catch (err) {
      console.error("Error adding to portfolio:", err);
      alert(err.response?.data?.detail || "Failed to add to portfolio");
    }
  };

  const handleAiAnalysis = async () => {
    if (!selectedCoin || Object.keys(coinDetails).length === 0 || !historicalPrice.length) {
      setAiAnalysis("Please select a coin first and wait for data to load!");
      return;
    }

    setLoading(true);
    setAiAnalysis("");

    const latestPrice = historicalPrice[historicalPrice.length - 1].nav;
    const oneYearAgoPrice = historicalPrice.length > 252 ? historicalPrice[historicalPrice.length - 252].nav : latestPrice;
    const oneYearGrowth = oneYearAgoPrice > 0 ? ((latestPrice - oneYearAgoPrice) / oneYearAgoPrice * 100).toFixed(1) : "N/A";
    const bestMonth = heatmapData.length > 0 ? heatmapData.reduce((max, curr) => max.dayChange > curr.dayChange ? max : curr) : { month: "N/A", dayChange: 0 };
    const worstMonth = heatmapData.length > 0 ? heatmapData.reduce((min, curr) => min.dayChange < curr.dayChange ? min : curr) : { month: "N/A", dayChange: 0 };

    // Compute data for AI prompt
    const returnsData = computeReturns(historicalPrice);
    const monteCarloData = computeMonteCarloPrediction(historicalPrice);
    const riskData = computeRiskVolatility(historicalPrice);

    const summary = {
      coin_name: selectedCoin.name,
      launched: coinDetails.genesis_date || "N/A",
      current_price: coinDetails.market_data?.current_price?.usd || latestPrice,
      one_year_growth: oneYearGrowth,
      best_month: bestMonth.month ? `${bestMonth.month} (+${(bestMonth.dayChange * 100).toFixed(2)}%)` : "N/A",
      worst_month: worstMonth.month ? `${worstMonth.month} (${(worstMonth.dayChange * 100).toFixed(2)}%)` : "N/A",
      market_cap: coinDetails.market_cap?.usd || selectedCoin.market_cap,
      monte_carlo_prediction: monteCarloData,
      risk_volatility: riskData,
    };

    const prompt = `
      I have data about a cryptocurrency called '${summary.coin_name}'. Please provide a simple, friendly explanation for someone new to investing based on this data:
      - Coin Name: ${summary.coin_name}
      - Launched: ${summary.launched}
      - Current Price: $${summary.current_price.toFixed(2)}
      - 1-Year Growth: ${summary.one_year_growth}%
      - Best Month: ${summary.best_month}
      - Worst Month: ${summary.worst_month}
      - Market Cap: $${summary.market_cap.toLocaleString()}
      - Monte Carlo Prediction: ${JSON.stringify(summary.monte_carlo_prediction)}
      - Risk & Volatility: ${JSON.stringify(summary.risk_volatility)}
      Give me a clear, conversational breakdown in a point-by-point format—like advice from a friend. Cover these points without repeating the questions:
      1. What this crypto is and what it’s used for.
      2. How it’s been doing lately, looking at its growth and price changes.
      3. What the best and worst months tell us about its ups and downs.
      4. Whether it’s a good pick for a beginner—think about ease, risk, and volatility—and why.
      5. What the Monte Carlo prediction suggests about its future—use the prediction data (expected price, probability of positive return) for a simple outlook.
      Format each point as a numbered item starting with "1. ", "2. ", etc., and keep it short, avoid complicated terms, and make it feel warm and helpful!
    `;

    try {
      console.log("Starting AI DOST generation with data:", summary);
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
      console.log("AI DOST generation completed:", analysis);
    } catch (err) {
      console.error("Error generating AI analysis:", err);
      setAiAnalysis("Oops, something went wrong!");
    } finally {
      setLoading(false);
    }
  };

  const handleAiReport = async () => {
    if (!selectedCoin || Object.keys(coinDetails).length === 0) {
      setAiReport("Please select a coin first!");
      return;
    }

    setLoadingReport(true);
    setAiReport("");

    const latestPrice = historicalPrice.length > 0 ? historicalPrice[historicalPrice.length - 1].nav : 0;
    const oneYearAgoPrice = historicalPrice.length > 252 ? historicalPrice[historicalPrice.length - 252].nav : latestPrice;
    const oneYearGrowth = oneYearAgoPrice > 0 ? ((latestPrice - oneYearAgoPrice) / oneYearAgoPrice * 100).toFixed(1) : "N/A";
    const bestMonth = heatmapData.length > 0 ? heatmapData.reduce((max, curr) => max.dayChange > curr.dayChange ? max : curr) : { month: "N/A", dayChange: 0 };
    const worstMonth = heatmapData.length > 0 ? heatmapData.reduce((min, curr) => min.dayChange < curr.dayChange ? min : curr) : { month: "N/A", dayChange: 0 };

    const summary = {
      name: selectedCoin.name,
      symbol: selectedCoin.symbol,
      current_price: coinDetails.market_data?.current_price?.usd || latestPrice,
      price_change_percentage_24h: selectedCoin.price_change_percentage_24h,
      market_cap: coinDetails.market_cap?.usd || selectedCoin.market_cap,
      total_volume: coinDetails.market_data?.total_volume?.usd || selectedCoin.total_volume,
      one_year_growth: oneYearGrowth,
      best_month: bestMonth.month ? `${bestMonth.month} (+${(bestMonth.dayChange * 100).toFixed(2)}%)` : "N/A",
      worst_month: worstMonth.month ? `${worstMonth.month} (${(worstMonth.dayChange * 100).toFixed(2)}%)` : "N/A",
      launched: coinDetails.genesis_date || "N/A",
    };

    const prompt = `
      Act as a Cryptocurrency Expert Advisor. I have data about a cryptocurrency called '${summary.name}'. Provide a detailed, friendly report for a beginner investor, guiding them on how to proceed with this crypto based on this data:
      - Crypto Name: ${summary.name}
      - Symbol: ${summary.symbol}
      - Current Price: $${summary.current_price.toFixed(2)}
      - 24h Price Change: ${summary.price_change_percentage_24h.toFixed(2)}%
      - Market Cap: $${summary.market_cap.toLocaleString()}
      - 24h Trading Volume: $${summary.total_volume.toLocaleString()}
      - 1-Year Growth: ${summary.one_year_growth}%
      - Best Month: ${summary.best_month}
      - Worst Month: ${summary.worst_month}
      - Launched: ${summary.launched}
      Provide a report with these sections:
      Crypto Overview - Briefly explain what this cryptocurrency is and its purpose.
      Performance Summary - Summarize its recent performance based on price, volume, and growth.
      Risk Assessment - Evaluate its risk level using price changes and monthly swings.
      Future Outlook - Give a simple prediction about its future potential based on the data.
      Action Plan - Provide simple, actionable steps (e.g., buy, hold, research more) with reasons.
      Format each section with a heading in bold (e.g., **Crypto Overview**) followed by a short paragraph. Keep it easy to understand, avoid technical jargon, and make it feel like friendly expert advice!
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
        report += chunkContent.replace(/\*/g, "");
        setAiReport(report);
      }
      console.log("AI Report generation completed:", report);
    } catch (err) {
      console.error("Error generating AI report:", err);
      setAiReport(`Error: ${err.message || "Unknown error occurred while generating the report."}`);
    } finally {
      setLoadingReport(false);
    }
  };

  const handleRangeChange = (days) => {
    setPriceRange(days);
  };

  const filteredPriceData = historicalPrice;

  const plotData = heatmapData.length > 0
    ? [{
        x: heatmapData.map((d) => d.month),
        y: heatmapData.map((d) => d.dayChange),
        z: heatmapData.map((d) => d.dayChange),
        type: "heatmap",
        colorscale: "Viridis",
      }]
    : [];

  const randomCoinsSection = (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {randomCoins.map((coin) => (
        <div
          key={coin.id}
          className="bg-gray-800 rounded-lg p-4 shadow-md hover:bg-gray-700 transition-colors"
        >
          <h3 className="text-white text-md font-semibold mb-2">{coin.name}</h3>
          <p className="text-gray-400 text-sm">Symbol: {coin.symbol.toUpperCase()}</p>
          <p className="text-gray-400 text-sm">Price: {currency.Symbol}{coin.current_price.toLocaleString()}</p>
          <div className="flex justify-between mt-2">
            <button
              onClick={() => handleSelectCoin(coin)}
              className="py-1 px-3 bg-blue-gradient text-primary rounded font-poppins text-sm"
            >
              View Details
            </button>
            <button
              onClick={() => addToPortfolio(coin)}
              className="py-1 px-3 bg-green-600 text-white rounded font-poppins text-sm hover:bg-green-700"
            >
              Add to Portfolio
            </button>
          </div>
        </div>
      ))}
    </div>
  );

  const selectedCoinSection = selectedCoin && (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-gray-800 rounded-lg p-4 shadow-md">
        <h3 className="text-white text-lg font-semibold mb-2">{selectedCoin.name}</h3>
        <div className="text-gray-300 text-sm">
          <p><span className="font-medium">Symbol:</span> {coinDetails.symbol?.toUpperCase()}</p>
          <p><span className="font-medium">Market Cap:</span> ${coinDetails.market_cap?.usd?.toLocaleString()}</p>
          <p><span className="font-medium">Current Price:</span> ${coinDetails.market_data?.current_price?.usd?.toFixed(2)}</p>
          <p><span className="font-medium">Launch Date:</span> {coinDetails.genesis_date || "N/A"}</p>
          <p><span className="font-medium">Volume (24h):</span> ${coinDetails.market_data?.total_volume?.usd?.toLocaleString()}</p>
        </div>
        <button
          onClick={() => addToPortfolio(selectedCoin)}
          className="mt-4 py-1 px-3 bg-green-600 text-white rounded font-poppins text-sm hover:bg-green-700"
        >
          Add to Portfolio
        </button>
      </div>

      <div className="bg-gray-800 rounded-lg p-4 shadow-md flex flex-col">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-white text-lg font-semibold">Historical Price</h3>
          <div className="flex gap-2">
            <button
              onClick={() => handleRangeChange("30")}
              className={`py-1 px-2 rounded text-white ${priceRange === "30" ? "bg-blue-gradient" : "bg-gray-700"} hover:bg-secondary`}
            >
              1M
            </button>
            <button
              onClick={() => handleRangeChange("90")}
              className={`py-1 px-2 rounded text-white ${priceRange === "90" ? "bg-blue-gradient" : "bg-gray-700"} hover:bg-secondary`}
            >
              3M
            </button>
            <button
              onClick={() => handleRangeChange("180")}
              className={`py-1 px-2 rounded text-white ${priceRange === "180" ? "bg-blue-gradient" : "bg-gray-700"} hover:bg-secondary`}
            >
              6M
            </button>
            <button
              onClick={() => handleRangeChange("365")}
              className={`py-1 px-2 rounded text-white ${priceRange === "365" ? "bg-blue-gradient" : "bg-gray-700"} hover:bg-secondary`}
            >
              1Y
            </button>
          </div>
        </div>
        {filteredPriceData.length > 0 ? (
          <LineChart width={350} height={200} data={filteredPriceData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#444" />
            <XAxis dataKey="date" stroke="#fff" tick={{ fontSize: 10 }} interval="preserveStartEnd" tickCount={6} />
            <YAxis stroke="#fff" tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
            <Tooltip contentStyle={{ backgroundColor: "#333", border: "none" }} />
            <Line type="monotone" dataKey="nav" stroke="#00f6ff" dot={false} strokeWidth={2} />
          </LineChart>
        ) : (
          <p className="text-gray-400">No price data</p>
        )}
      </div>

      <div className="bg-gray-800 rounded-lg p-4 shadow-md">
        <h3 className="text-white text-lg font-semibold mb-2">Calculate Returns</h3>
        <CalculateReturns selectedCoin={selectedCoin} historicalPrice={historicalPrice} />
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
        <h3 className="text-white text-lg font-semibold mb-2">Risk & Volatility</h3>
        <RiskVolatility selectedCoin={selectedCoin} historicalPrice={historicalPrice} />
      </div>

      <div className="bg-gray-800 rounded-lg p-4 shadow-md">
        <h3 className="text-white text-lg font-semibold mb-2">Monte Carlo Prediction</h3>
        <MonteCarloPrediction selectedCoin={selectedCoin} historicalPrice={historicalPrice} />
      </div>
    </div>
  );

  return (
    <div className={`bg-primary ${styles.paddingX} min-h-screen py-6`}>
      <div className="max-w-[1200px] mx-auto">
        {/* Heading */}
        <motion.h1
          className={`${styles.heading2} text-center text-gradient mb-6`}
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          Cryptocurrency Dashboard
        </motion.h1>
        <div className="bg-gray-800 rounded-lg p-4 mb-6 shadow-md relative">
          <input
            type="text"
            value={searchTerm}
            onChange={handleSearchChange}
            onKeyDown={handleKeyDown}
            className="w-full p-2 rounded bg-gray-900 text-white focus:outline-none border border-gray-700"
            placeholder="Search for a cryptocurrency..."
          />
          {suggestions.length > 0 && (
            <ul className="absolute z-10 bg-gray-800 text-white rounded-lg w-[300px] max-h-60 overflow-y-auto mt-2 shadow-lg">
              {suggestions.map((coin) => (
                <li
                  key={coin.id}
                  onClick={() => handleSelectCoin(coin)}
                  className="p-2 hover:bg-gray-700 cursor-pointer"
                >
                  {coin.name}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex gap-4">
            <button
              onClick={handleAiAnalysis}
              disabled={loading || loadingReport || !selectedCoin}
              className={`py-2 px-4 rounded bg-blue-gradient text-primary font-poppins font-medium ${
                loading || loadingReport || !selectedCoin ? "opacity-50 cursor-not-allowed" : "hover:bg-secondary"
              }`}
            >
              {loading ? "Generating..." : "AI DOST"}
            </button>
            <button
              onClick={handleAiReport}
              disabled={loading || loadingReport || !selectedCoin}
              className={`py-2 px-4 rounded bg-purple-600 text-white font-poppins font-medium ${
                loading || loadingReport || !selectedCoin ? "opacity-50 cursor-not-allowed" : "hover:bg-purple-700"
              }`}
            >
              {loadingReport ? "Generating..." : "AI Report"}
            </button>
          </div>
        </div>

        {aiAnalysis && (
          <div className="bg-gray-800 rounded-lg p-4 mb-6 shadow-md text-white">
            <h3 className="text-lg font-semibold mb-2 text-blue-300">AI DOST Analysis</h3>
            <div
              className="text-gray-200 text-base leading-relaxed"
              style={{ whiteSpace: "pre-line" }}
            >
              {aiAnalysis}
            </div>
          </div>
        )}

        {aiReport && (
          <div className="bg-gray-900 rounded-lg p-6 mb-6 shadow-lg border border-purple-500">
            <h3 className="text-2xl font-bold mb-6 text-purple-300 tracking-wide">AI Crypto Report</h3>
            <div
              className="text-gray-100 text-lg leading-loose font-light"
              style={{ whiteSpace: "pre-wrap" }}
            >
              {aiReport}
            </div>
          </div>
        )}

        {loading && !aiAnalysis && !aiReport ? (
          <p className="text-white text-center">Loading...</p>
        ) : error ? (
          <p className="text-red-500 text-center">{error}</p>
        ) : selectedCoin ? (
          selectedCoinSection
        ) : (
          randomCoinsSection
        )}
      </div>
      <Chatbot selectedFund={selectedCoin} />
    </div>
  );
};

export default CryptoDashboard;