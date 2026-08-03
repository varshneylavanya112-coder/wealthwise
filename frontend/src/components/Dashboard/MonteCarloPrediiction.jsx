// frontend/src/components/Dashboard/MonteCarloPrediction.jsx
import { useState, useEffect } from "react";
import axios from "axios";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import styles from "../../style";

const API_URL = import.meta.env.VITE_API_URL || "https://codezen-backend-bz1g.onrender.com";

const MonteCarloPrediction = ({ selectedScheme }) => {
  const [monteCarloData, setMonteCarloData] = useState([]);
  const [historicalData, setHistoricalData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const SIMULATIONS = 100;
  const DAYS_AHEAD = 252;

  useEffect(() => {
    const fetchDataAndSimulate = async () => {
      if (!selectedScheme || !selectedScheme.code) {
        setMonteCarloData([]);
        setHistoricalData([]);
        setError("No scheme selected.");
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const navResponse = await axios.get(`${API_URL}/api/historical-nav/${selectedScheme.code}`);
        const navData = navResponse.data.map(item => ({
          ...item,
          date: parseDate(item.date),
        }));
        setHistoricalData(navData);

        const riskResponse = await axios.get(`${API_URL}/api/risk-volatility/${selectedScheme.code}`);
        const { annualized_return, annualized_volatility } = riskResponse.data;
        const dailyReturn = annualized_return / 252;
        const dailyVolatility = annualized_volatility / Math.sqrt(252);
        const simulatedPaths = runMonteCarloSimulation(dailyReturn, dailyVolatility, navData);
        setMonteCarloData(simulatedPaths);
      } catch (err) {
        console.error("Error fetching data for Monte Carlo:", err);
        setError(`Failed to fetch data: ${err.message}`);
        setMonteCarloData([]);
        setHistoricalData([]);
      } finally {
        setLoading(false);
      }
    };
    fetchDataAndSimulate();
  }, [selectedScheme]);

  const parseDate = (dateStr) => {
    if (!dateStr) return new Date().toISOString().split("T")[0];
    const parts = dateStr.split("-");
    if (parts.length !== 3) return dateStr;
    let [day, month, year] = parts;
    if (parseInt(day) > 12 && parseInt(month) <= 12) {
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }
    return `${day}-${month.padStart(2, "0")}-${year.padStart(2, "0")}`;
  };

  const runMonteCarloSimulation = (dailyReturn, dailyVolatility, navData) => {
    if (!navData || navData.length === 0) return [];
    const lastEntry = navData[navData.length - 1];
    const lastNav = parseFloat(lastEntry.nav);
    const lastDate = new Date(lastEntry.date);
    if (isNaN(lastNav) || isNaN(lastDate.getTime())) return [];

    const simulations = [];
    for (let i = 0; i < SIMULATIONS; i++) {
      const path = [{ date: lastEntry.date, nav: lastNav }];
      let currentNav = lastNav;
      for (let j = 1; j <= DAYS_AHEAD; j++) {
        const randomReturn = dailyReturn + dailyVolatility * gaussianRandom();
        currentNav *= (1 + randomReturn);
        const previousDate = new Date(path[j - 1].date);
        previousDate.setDate(previousDate.getDate() + 1);
        path.push({ date: previousDate.toISOString().split("T")[0], nav: currentNav });
      }
      simulations.push(path);
    }
    return simulations;
  };

  const gaussianRandom = () => {
    const u = Math.random();
    const v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  };

  const combinedData = historicalData.concat(monteCarloData.length > 0 ? monteCarloData[0] : []);

  return (
    <div className="flex flex-col">
      <h3 className="text-white text-lg font-semibold mb-2">Monte Carlo Prediction (1 Year)</h3>
      <div className="w-full">
        {loading ? (
          <p className="text-gray-400">Loading...</p>
        ) : error ? (
          <p className="text-red-500">{error}</p>
        ) : selectedScheme && monteCarloData.length > 0 ? (
          <div className="flex justify-center">
            <LineChart width={350} height={200} data={combinedData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#444" />
              <XAxis dataKey="date" stroke="#fff" tick={{ fontSize: 10 }} interval="preserveStartEnd" tickCount={6} />
              <YAxis stroke="#fff" tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
              <Tooltip contentStyle={{ backgroundColor: "#333", border: "none" }} />
              <Legend />
              <Line type="monotone" dataKey="nav" stroke="#8884d8" name="Historical + Predicted" dot={false} strokeWidth={2} />
              {monteCarloData.slice(1, 5).map((path, index) => (
                <Line
                  key={index}
                  type="monotone"
                  dataKey="nav"
                  data={path}
                  stroke="#82ca9d"
                  name={`Simulation ${index + 1}`}
                  dot={false}
                  strokeOpacity={0.3}
                  strokeWidth={2}
                />
              ))}
            </LineChart>
          </div>
        ) : (
          <p className="text-gray-400">No data available for Monte Carlo simulation</p>
        )}
      </div>
    </div>
  );
};

export default MonteCarloPrediction;