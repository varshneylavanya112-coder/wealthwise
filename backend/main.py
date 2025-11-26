# D:/codezen/backend/main.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from mftool import Mftool
import pandas as pd
import numpy as np
from typing import Dict, List, Any
import logging
from starlette.responses import JSONResponse
from pymongo import MongoClient
from dotenv import load_dotenv
import os
from datetime import datetime

# Load environment variables
load_dotenv()

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()
mf = Mftool()

# MongoDB connection
MONGODB_URL = os.getenv("MONGODB_URL")
if not MONGODB_URL:
    logger.error("MONGODB_URL environment variable is not set. MongoDB connection will likely fail.")
client = MongoClient(MONGODB_URL)
db = client["codezen"]
users_collection = db["users"]
portfolio_collection = db["portfolio"]

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_cors_headers(request, call_next):
    try:
        response = await call_next(request)
    except Exception as e:
        logger.error(f"Unhandled exception in request {request.url}: {str(e)}")
        response = JSONResponse(status_code=500, content={"detail": str(e)})
    response.headers["Access-Control-Allow-Origin"] = FRONTEND_URL
    response.headers["Access-Control-Allow-Methods"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "*"
    return response

# Helper functions
scheme_names = {v: k for k, v in mf.get_scheme_codes().items()}

def stringify_dict(data: Dict[str, Any]) -> Dict[str, str]:
    result = {}
    for key, value in data.items():
        if isinstance(value, dict):
            result[key] = str(value)
        else:
            result[key] = str(value)
    return result

# Existing endpoints
@app.get("/api/schemes")
async def get_schemes(search: str = "") -> Dict[str, str]:
    try:
        all_schemes = mf.get_scheme_codes()
        if search:
            filtered_schemes = {code: name for code, name in all_schemes.items() if search.lower() in name.lower()}
            return filtered_schemes if filtered_schemes else {}
        return all_schemes
    except Exception as e:
        logger.exception("Error fetching schemes")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/api/scheme-details/{scheme_code}")
async def get_scheme_details(scheme_code: str) -> Dict[str, str]:
    try:
        details = mf.get_scheme_details(scheme_code)
        return stringify_dict(details) if details else {}
    except Exception as e:
        logger.exception("Error fetching scheme details")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/api/historical-nav/{scheme_code}")
async def get_historical_nav(scheme_code: str) -> List[Dict[str, str]]:
    try:
        nav_data = mf.get_scheme_historical_nav(scheme_code, as_Dataframe=True)
        if nav_data is not None and not nav_data.empty:
            nav_data = nav_data.astype(str)
            return nav_data.to_dict(orient="records")
        return []
    except Exception as e:
        logger.exception("Error fetching historical NAV")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/api/compare-navs")
async def compare_navs(scheme_codes: str) -> List[Dict[str, Any]]:
    try:
        codes = scheme_codes.split(",")
        if not codes:
            return []
        comparison_data = {}
        for code in codes:
            data = mf.get_scheme_historical_nav(code.strip(), as_Dataframe=True)
            if data is not None and not data.empty:
                data = data.reset_index().rename(columns={"index": "date"})
                data["date"] = pd.to_datetime(data["date"], dayfirst=True).dt.strftime("%Y-%m-%d")
                data["nav"] = pd.to_numeric(data["nav"], errors="coerce").replace(0, None).interpolate()
                comparison_data[code] = data[["date", "nav"]].to_dict(orient="records")
        if comparison_data:
            merged_df = None
            for code, records in comparison_data.items():
                df = pd.DataFrame(records).set_index("date")
                df = df.rename(columns={"nav": scheme_names.get(code, code)})
                merged_df = df if merged_df is None else merged_df.join(df, how="outer")
            return merged_df.reset_index().to_dict(orient="records")
        return []
    except Exception as e:
        logger.exception("Error comparing NAVs")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/api/average-aum")
async def get_average_aum(period: str = "July - September 2024") -> List[Dict[str, str]]:
    try:
        aum_data = mf.get_average_aum(period, False)
        if aum_data:
            aum_df = pd.DataFrame(aum_data)
            aum_df["Total AUM"] = aum_df[["AAUM Overseas", "AAUM Domestic"]].astype(float).sum(axis=1)
            return aum_df[["Fund Name", "Total AUM"]].astype(str).to_dict(orient="records")
        return []
    except Exception as e:
        logger.exception("Error fetching AUM")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/api/performance-heatmap/{scheme_code}")
async def get_performance_heatmap(scheme_code: str) -> List[Dict[str, Any]]:
    try:
        nav_data = mf.get_scheme_historical_nav(scheme_code, as_Dataframe=True)
        if nav_data is not None and not nav_data.empty:
            nav_data = nav_data.reset_index().rename(columns={"index": "date"})
            nav_data["date"] = pd.to_datetime(nav_data["date"], dayfirst=True)
            nav_data["nav"] = nav_data["nav"].astype(float)
            nav_data["dayChange"] = nav_data["nav"].pct_change().fillna(0)
            nav_data["month"] = nav_data["date"].dt.month
            heatmap_data = nav_data.groupby("month")["dayChange"].mean().reset_index()
            heatmap_data["dayChange"] = heatmap_data["dayChange"].replace([np.inf, -np.inf], None)
            heatmap_data["month"] = heatmap_data["month"].astype(str)
            return heatmap_data.to_dict(orient="records")
        return []
    except Exception as e:
        logger.exception("Error fetching performance heatmap")
        raise HTTPException(status_code=500, detail="Internal server error")

# Updated Risk Volatility Endpoint
@app.get("/api/risk-volatility/{scheme_code}")
async def get_risk_volatility(scheme_code: str) -> Dict[str, Any]:
    try:
        logger.info(f"Fetching risk volatility for scheme_code: {scheme_code}")
        nav_data = mf.get_scheme_historical_nav(scheme_code, as_Dataframe=True)
        if nav_data is None or nav_data.empty:
            logger.warning(f"No NAV data found for scheme_code: {scheme_code}")
            return {
                "annualized_volatility": 0.0,
                "annualized_return": 0.0,
                "sharpe_ratio": 0.0,
                "returns": []
            }
        
        nav_data = nav_data.reset_index().rename(columns={"index": "date"})
        nav_data["date"] = pd.to_datetime(nav_data["date"], dayfirst=True)
        nav_data["nav"] = pd.to_numeric(nav_data["nav"], errors="coerce")
        nav_data = nav_data.dropna(subset=["nav"])
        nav_data["returns"] = nav_data["nav"].pct_change()
        nav_data = nav_data.dropna(subset=["returns"])
        
        annualized_volatility = nav_data["returns"].std() * np.sqrt(252)
        annualized_return = (nav_data["returns"].mean() + 1) ** 252 - 1
        risk_free_rate = 0.06
        sharpe_ratio = (
            (annualized_return - risk_free_rate) / annualized_volatility 
            if annualized_volatility > 0 else 0
        )
        
        # Format returns for frontend
        returns_list = nav_data[["date", "returns"]].to_dict(orient="records")
        for item in returns_list:
            item["date"] = item["date"].strftime("%Y-%m-%d")
            item["returns"] = float(item["returns"])
        
        logger.info(f"Successfully calculated risk metrics for {scheme_code}")
        return {
            "annualized_volatility": float(annualized_volatility),
            "annualized_return": float(annualized_return),
            "sharpe_ratio": float(sharpe_ratio),
            "returns": returns_list
        }
    except Exception as e:
        logger.exception("Error fetching risk volatility")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/api/monte-carlo-prediction/{scheme_code}")
async def get_monte_carlo_prediction(scheme_code: str, num_simulations: int = 1000, days: int = 252) -> Dict[str, Any]:
    try:
        nav_data = mf.get_scheme_historical_nav(scheme_code, as_Dataframe=True)
        if nav_data is None or nav_data.empty:
            return {}

        nav_data = nav_data.reset_index().rename(columns={"index": "date"})
        nav_data["nav"] = pd.to_numeric(nav_data["nav"], errors="coerce")
        nav_data = nav_data.dropna(subset=["nav"])
        nav_data["returns"] = nav_data["nav"].pct_change().dropna()

        if len(nav_data["returns"]) < 2:
            return {"message": "Insufficient data for Monte Carlo simulation"}

        mu = nav_data["returns"].mean()
        sigma = nav_data["returns"].std()
        last_nav = float(nav_data["nav"].iloc[-1])
        simulations = np.zeros((num_simulations, days))
        simulations[:, 0] = last_nav

        for t in range(1, days):
            random_returns = np.random.normal(mu, sigma, num_simulations)
            simulations[:, t] = simulations[:, t - 1] * (1 + random_returns)

        expected_nav = float(np.mean(simulations[:, -1]))
        prob_positive = float(np.mean(simulations[:, -1] > last_nav))
        percentile_5 = float(np.percentile(simulations[:, -1], 5))
        percentile_95 = float(np.percentile(simulations[:, -1], 95))

        return {
            "expected_nav": expected_nav,
            "probability_positive_return": prob_positive * 100,
            "lower_bound_5th_percentile": percentile_5,
            "upper_bound_95th_percentile": percentile_95,
            "last_nav": last_nav,
        }
    except Exception as e:
        logger.exception("Error in Monte Carlo prediction")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/api/portfolio-summary/{user_id}")
async def get_portfolio_summary(user_id: str) -> Dict[str, Any]:
    try:
        portfolio_items = list(portfolio_collection.find({"user_id": user_id}))
        if not portfolio_items:
            return {"items": [], "total_latest_nav": 0.0}

        summary_items = []
        total_latest_nav = 0.0
        for item in portfolio_items:
            if item["item_type"] == "mutual_fund":
                nav_data = mf.get_scheme_historical_nav(item["item_id"], as_Dataframe=True)
                monte_carlo = await get_monte_carlo_prediction(item["item_id"])
                risk = await get_risk_volatility(item["item_id"])

                if nav_data is not None and not nav_data.empty:
                    nav_data = nav_data.reset_index().rename(columns={"index": "date"})
                    nav_data["nav"] = pd.to_numeric(nav_data["nav"], errors="coerce")
                    nav_data = nav_data.dropna(subset=["nav"])
                    latest_nav = float(nav_data["nav"].iloc[-1])
                    one_year_ago_idx = max(0, len(nav_data) - 252)
                    one_year_ago_nav = float(nav_data["nav"].iloc[one_year_ago_idx])
                    one_year_growth = ((latest_nav - one_year_ago_nav) / one_year_ago_nav * 100) if one_year_ago_nav > 0 else "N/A"
                    total_latest_nav += latest_nav
                else:
                    latest_nav = "N/A"
                    one_year_growth = "N/A"

                summary_items.append({
                    "name": item["name"],
                    "type": item["item_type"],
                    "latest_nav": latest_nav,
                    "one_year_growth": one_year_growth,
                    "monte_carlo": {
                        "expected_nav": monte_carlo.get("expected_nav", "N/A"),
                        "probability_positive": monte_carlo.get("probability_positive_return", "N/A"),
                    } if monte_carlo else "N/A",
                    "risk_volatility": {
                        "volatility": risk.get("annualized_volatility", "N/A"),
                        "sharpe_ratio": risk.get("sharpe_ratio", "N/A")
                    } if risk else "N/A",
                })
            else:
                summary_items.append({
                    "name": item["name"],
                    "type": item["item_type"],
                    "latest_nav": "N/A",
                    "one_year_growth": "N/A",
                    "monte_carlo": "N/A",
                    "risk_volatility": "N/A",
                })

        return {"items": summary_items, "total_latest_nav": total_latest_nav}
    except Exception as e:
        logger.exception("Error fetching portfolio summary")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/api/save-user")
async def save_user(user: Dict[str, Any]):
    try:
        # Support both Auth0 and Clerk payload shapes.
        # Auth0 often sends `sub`; Clerk will send `id` and `firstName`/`lastName`/`fullName`.
        user_id = user.get("sub") or user.get("id") or user.get("user_id")
        if not user_id:
            raise HTTPException(status_code=400, detail="User ID (sub or id) is required")

        # Normalize fields for storage
        email = user.get("email") or user.get("primaryEmailAddress") or None
        # If Clerk passed primaryEmailAddress object, try to extract email
        if isinstance(email, dict):
            email = email.get("emailAddress")

        first_name = user.get("given_name") or user.get("firstName") or None
        last_name = user.get("family_name") or user.get("lastName") or None
        full_name = user.get("name") or user.get("fullName") or None
        picture = user.get("picture") or user.get("avatar_url") or None
        last_login = user.get("updated_at") or user.get("last_sign_in_at") or None

        result = users_collection.update_one(
            {"user_id": user_id},
            {"$set": {
                "user_id": user_id,
                "email": email,
                "given_name": first_name,
                "family_name": last_name,
                "name": full_name,
                "picture": picture,
                "last_login": last_login,
            }},
            upsert=True
        )
        logger.info(f"User {user_id} saved/updated successfully")
        return {"message": "User saved successfully", "modified_count": result.modified_count}
    except Exception:
        # Log full exception with stack trace for easier debugging in server logs
        logger.exception("Error saving user")
        # Return a generic error to the client; check server logs for details
        raise HTTPException(status_code=500, detail="Internal server error while saving user")


@app.get("/api/health")
async def health_check():
    """Simple health check that verifies MongoDB connectivity."""
    try:
        # Try a lightweight ping to MongoDB
        mongo_ok = False
        try:
            client.admin.command('ping')
            mongo_ok = True
        except Exception as me:
            logger.exception("MongoDB ping failed")

        return {"ok": True, "mongo_connected": mongo_ok}
    except Exception:
        logger.exception("Health check failed")
        raise HTTPException(status_code=500, detail="Health check failed")

@app.get("/api/get-user/{user_id}")
async def get_user(user_id: str):
    try:
        user_data = users_collection.find_one({"user_id": user_id})
        if not user_data:
            raise HTTPException(status_code=404, detail="User not found")
        user_data.pop("_id", None)
        return user_data
    except Exception as e:
        logger.exception("Error fetching user")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/api/add-to-portfolio")
async def add_to_portfolio(item: Dict[str, Any]):
    try:
        user_id = item.get("user_id")
        if not user_id:
            raise HTTPException(status_code=400, detail="User ID is required")
        
        existing_item = portfolio_collection.find_one({
            "user_id": user_id,
            "item_type": item.get("item_type"),
            "item_id": item.get("item_id")
        })
        if existing_item:
            raise HTTPException(status_code=400, detail="Item already in portfolio")

        result = portfolio_collection.insert_one({
            "user_id": user_id,
            "item_type": item.get("item_type"),
            "item_id": item.get("item_id"),
            "name": item.get("name"),
            "added_at": datetime.now().isoformat()
        })
        logger.info(f"Added {item.get('name')} to portfolio for user {user_id}")
        return {"message": "Item added to portfolio", "id": str(result.inserted_id)}
    except Exception as e:
        logger.exception("Error adding to portfolio")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.delete("/api/remove-from-portfolio/{user_id}/{item_id}")
async def remove_from_portfolio(user_id: str, item_id: str):
    try:
        result = portfolio_collection.delete_one({"user_id": user_id, "item_id": item_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Item not found in portfolio")
        logger.info(f"Removed item {item_id} from portfolio for user {user_id}")
        return {"message": "Item removed from portfolio"}
    except Exception as e:
        logger.exception("Error removing item from portfolio")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/api/get-portfolio/{user_id}")
async def get_portfolio(user_id: str):
    try:
        portfolio_items = list(portfolio_collection.find({"user_id": user_id}))
        for item in portfolio_items:
            item.pop("_id", None)
        return portfolio_items
    except Exception as e:
        logger.exception("Error fetching portfolio")
        raise HTTPException(status_code=500, detail="Internal server error")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000, reload=True)