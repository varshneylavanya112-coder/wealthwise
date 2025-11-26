# WealthWise - Investment Management Platform

WealthWise is a comprehensive investment management platform designed to help users track, analyze, and optimize their investments in mutual funds, cryptocurrencies, and other financial instruments. Built during **CodeZen**, WealthWise integrates AI-driven insights, real-time data, and user-friendly interfaces to make investment strategies accessible and efficient.

---

## Table of Contents

1. [Project Structure](#project-structure)
2. [Features](#features)
3. [Tech Stack](#tech-stack)
4. [Environment Variables](#environment-variables)
5. [Installation](#installation)
6. [Usage](#usage)
7. [API Endpoints](#api-endpoints)
8. [Contributing](#contributing)
9. [License](#license)

---

## Project Structure

```
anamiiikka-codezen/
├── vercel.json
├── backend/
│   ├── Readme.md
│   ├── main.py
│   ├── package-lock.json
│   ├── package.json
│   ├── requirements.txt
│   ├── .gitignore
│   └── __pycache__/
└── frontend/
    ├── README.md
    ├── eslint.config.js
    ├── index.html
    ├── package-lock.json
    ├── package.json
    ├── postcss.config.cjs
    ├── tailwind.config.js
    ├── vite.config.js
    ├── .gitignore
    ├── public/
    └── src/
        ├── App.jsx
        ├── index.css
        ├── main.jsx
        ├── style.js
        ├── EducationHub/
        │   ├── App.jsx
        │   └── index.js
        ├── assets/
        │   └── index.js
        ├── components/
        │   ├── Billing.jsx
        │   ├── Business.jsx
        │   ├── Button.jsx
        │   ├── CTA.jsx
        │   ├── CardDeal.jsx
        │   ├── Chatbot.jsx
        │   ├── Clients.jsx
        │   ├── FeedbackCard.jsx
        │   ├── Footer.jsx
        │   ├── GetStarted.jsx
        │   ├── Hero.jsx
        │   ├── MutualFund.jsx
        │   ├── Navbar.jsx
        │   ├── Stats.jsx
        │   ├── StockMarket.jsx
        │   ├── Testimonials.jsx
        │   ├── index.js
        │   ├── CryptoDashboard/
        │   │   ├── App.jsx
        │   │   ├── Footer/
        │   │   │   ├── Footer.css
        │   │   │   └── Footer.jsx
        │   │   ├── LineChart/
        │   │   │   ├── LineChart.css
        │   │   │   └── LineChart.jsx
        │   │   ├── Navbar/
        │   │   │   ├── Navbar.css
        │   │   │   └── Navbar.jsx
        │   │   └── Pages/
        │   │       ├── Coin/
        │   │       │   ├── Coin.css
        │   │       │   └── Coin.jsx
        │   │       └── Home/
        │   │           ├── Home.css
        │   │           └── Home.jsx
        │   └── Dashboard/
        │       ├── AvailableSchemes.jsx
        │       ├── AverageAUM.jsx
        │       ├── CalculateReturns.jsx
        │       ├── CompareNAVs.jsx
        │       ├── HistoricalNAV.jsx
        │       ├── MonteCarloPrediiction.jsx
        │       ├── MutualFundDashboard.jsx
        │       ├── PerformanceHeatmap.jsx
        │       ├── Portfolio.jsx
        │       ├── RiskVolatility.jsx
        │       ├── SchemeDetails.jsx
        │       └── index.js
        ├── constants/
        │   └── index.js
        └── context/
            └── CoinContext.jsx
```

---

## Features

- **Mutual Fund Dashboard**: Track and analyze mutual funds with historical NAV, risk assessment, and Monte Carlo predictions.
- **Cryptocurrency Dashboard**: Real-time crypto price tracking, risk analysis, and AI-driven insights.
- **Portfolio Management**: Add, remove, and track investments in mutual funds and cryptocurrencies.
- **AI-Powered Insights**: Get AI-generated analysis and reports for your investments.
- **Education Hub**: Learn about financial markets with curated videos and trending news.
 - **Authentication**: Secure login and user management via Clerk.

---

## Tech Stack

- **Frontend**: React, Vite, TailwindCSS, Framer Motion, Recharts, Plotly.js
- **Backend**: FastAPI, MongoDB, Python (mftool, pandas, numpy)
- **AI Integration**: Groq API (Llama 3.3-70b)
 - **Authentication**: Clerk
- **Deployment**: Vercel

---

## Environment Variables

### Backend (`.env`)

```plaintext
MONGODB_URL=your_mongodb_connection_string
FRONTEND_URL=http://localhost:5173
```

### Frontend (`.env`)

```plaintext
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
VITE_API_URL=http://localhost:8000
VITE_GROQ_API_KEY=your_groq_api_key
VITE_YOUTUBE_API_KEY=your_youtube_api_key
```

---

## Installation

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/your-username/wealthwise.git
   cd wealthwise
   ```

2. **Install Dependencies**:
   - Backend:
     ```bash
     cd backend
     pip install -r requirements.txt
     ```
   - Frontend:
     ```bash
     cd ../frontend
     npm install
     ```

3. **Set Up Environment Variables**:
   - Create `.env` files in both `backend` and `frontend` directories as shown above.

4. **Run the Backend**:
   ```bash
   cd ../backend
   uvicorn main:app --reload
   ```

5. **Run the Frontend**:
   ```bash
   cd ../frontend
   npm run dev
   ```

---

## Usage

1. **Home Page**: Explore the platform's features and navigate to dashboards.
2. **Mutual Fund Dashboard**: Search for mutual funds, view historical NAV, and get AI-driven insights.
3. **Cryptocurrency Dashboard**: Track crypto prices, analyze risk, and generate AI reports.
4. **Portfolio**: Add and manage your investments.
5. **Education Hub**: Watch financial education videos and read trending news.

---

## API Endpoints

### Mutual Funds
- `GET /api/schemes`: Fetch all mutual fund schemes.
- `GET /api/scheme-details/{scheme_code}`: Get details of a specific scheme.
- `GET /api/historical-nav/{scheme_code}`: Fetch historical NAV data.
- `GET /api/compare-navs`: Compare NAVs of multiple schemes.
- `GET /api/average-aum`: Fetch average AUM data.
- `GET /api/performance-heatmap/{scheme_code}`: Get performance heatmap data.
- `GET /api/risk-volatility/{scheme_code}`: Fetch risk and volatility metrics.
- `GET /api/monte-carlo-prediction/{scheme_code}`: Run Monte Carlo simulations.

### Portfolio
- `POST /api/add-to-portfolio`: Add an item to the user's portfolio.
- `DELETE /api/remove-from-portfolio/{user_id}/{item_id}`: Remove an item from the portfolio.
- `GET /api/get-portfolio/{user_id}`: Fetch the user's portfolio.
- `GET /api/portfolio-summary/{user_id}`: Get a summary of the user's portfolio.

### User Management
- `POST /api/save-user`: Save or update user data.
- `GET /api/get-user/{user_id}`: Fetch user data.

---

## Contributing

1. Fork the repository.
2. Create a new branch: `git checkout -b feature/your-feature-name`.
3. Commit your changes: `git commit -m "Add some feature"`.
4. Push to the branch: `git push origin feature/your-feature-name`.
5. Submit a pull request.

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

Built with ❤️ at **CodeZen** by Phoenix Arcana🐦‍🔥 
