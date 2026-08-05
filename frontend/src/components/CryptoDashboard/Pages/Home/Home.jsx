// frontend/src/components/CryptoDashboard/pages/Home/Home.jsx
import React, { useContext, useEffect, useState } from "react";
import "./Home.css";
import { CoinContext } from "../../../../context/CoinContext";
import { Link } from "react-router-dom";
import styles from "../../../../style";

function Home() {
  const { allCoin, currency } = useContext(CoinContext);
  const [displayCoin, setDisplayCoin] = useState([]);
  const [input, setInput] = useState("");

  const inputHandler = (event) => {
    setInput(event.target.value);
    if (event.target.value === "") {
      setDisplayCoin(allCoin);
    }
  };

  const searchHandler = async (event) => {
    event.preventDefault();
    const coins = await allCoin.filter((item) =>
      item.name.toLowerCase().includes(input.toLowerCase())
    );
    setDisplayCoin(coins);
  };

  useEffect(() => {
    setDisplayCoin(allCoin);
  }, [allCoin]);

  return (
    <div className={`bg-primary ${styles.paddingX} ${styles.paddingY}`}>
      <div className={`${styles.boxWidth}`}>
        <div className="hero max-w-[600px] mx-auto mt-20 flex flex-col items-center text-center gap-8 text-white">
          <h1 className={`${styles.heading2}`}>
            Largest <br /> Crypto Marketplace
          </h1>
          <p className={`${styles.paragraph} max-w-[75%] text-dimWhite`}>
            Lorem ipsum dolor sit amet consectetur adipisicing elit. Ea possimus
            ut voluptate sint amet, ipsa asperiores deserunt quo in quam facere
            cumque aliquid dolores similique fugit quasi nemo delectus! Officia.
          </p>
          <form onSubmit={searchHandler} className="flex items-center gap-2 w-[80%] bg-white p-2 rounded">
            <input
              type="text"
              placeholder="Search crypto..."
              onChange={inputHandler}
              required
              value={input}
              list="coinlist"
              className="flex-1 text-black outline-none p-2"
            />
            <datalist id="coinlist">
              {allCoin.map((item, index) => (
                <option key={index} value={item.name} />
              ))}
            </datalist>
            <button type="submit" className="bg-[#7927ff] text-white px-6 py-2 rounded">
              Search
            </button>
          </form>
        </div>
        <div className="crypto-table max-w-[800px] mx-auto mt-12 bg-black-gradient rounded-lg">
          <div className="table-layout grid grid-cols-[0.5fr_2fr_1fr_1fr_1.5fr] p-4 border-b border-gray-600 text-white">
            <p>#</p>
            <p>Coins</p>
            <p>Price</p>
            <p className="text-center">24H Change</p>
            <p className="market-cap text-right">Market Cap</p>
          </div>
          {displayCoin.slice(0, 10).map((item, index) => (
            <Link
              to={`/dashboard/crypto/coin/${item.id}`}
              className="table-layout grid grid-cols-[0.5fr_2fr_1fr_1fr_1.5fr] p-4 border-b border-gray-600 text-white hover:bg-gray-800"
              key={index}
            >
              <p>{item.market_cap_rank}</p>
              <div className="flex items-center gap-2">
                <img src={item.image} alt="" className="w-[35px]" />
                <p>{item.name + " - " + item.symbol}</p>
              </div>
              <p>
                {currency.Symbol}
                {(item.current_price ?? 0).toLocaleString()}
              </p>
              <p
                className={`text-center ${
                  (item.price_change_percentage_24h ?? 0) > 0 ? "text-green-500" : "text-red-500"
                }`}
              >
                {Math.floor((item.price_change_percentage_24h ?? 0) * 100) / 100}
              </p>
              <p className="market-cap text-right">
                {currency.Symbol} {(item.market_cap ?? 0).toLocaleString()}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Home;