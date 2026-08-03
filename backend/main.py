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
import certifi
from dotenv import load_dotenv
import os
import json
from datetime import datetime
from bson import ObjectId

# Load environment variables from the .env file next to this script
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- MONKEYPATCH MFTOOL TO AVOID HANGS AND AMFI HOST BLOCKING ---
# Cache path for scheme codes
SCHEME_CODES_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "scheme_codes.json")

# Version-agnostic memory cache
_LOCAL_SCHEME_CODES_CACHE = {}

def patched_get_scheme_codes(self, as_json=False):
    cache_key = f"scheme_codes:{as_json}"
    if cache_key in _LOCAL_SCHEME_CODES_CACHE:
        return _LOCAL_SCHEME_CODES_CACHE[cache_key]

    scheme_info = {}
    
    # 1. Try to load from local file first to ensure instant startup
    if os.path.exists(SCHEME_CODES_FILE):
        try:
            with open(SCHEME_CODES_FILE, 'r', encoding='utf-8') as f:
                scheme_info = json.load(f)
            logger.info("Loaded scheme codes from local backup cache.")
        except Exception:
            logger.exception("Failed to read local scheme codes backup")

    # 2. Try fetching from api.mfapi.in if no local backup exists
    if not scheme_info:
        logger.info("No local scheme codes backup. Fetching from api.mfapi.in...")
        try:
            response = self._session.get("https://api.mfapi.in/mf", timeout=10)
            response.raise_for_status()
            data = response.json()
            for item in data:
                code = str(item.get("schemeCode"))
                name = item.get("schemeName")
                if code and name:
                    scheme_info[code] = name
            
            # Save backup to local file
            try:
                with open(SCHEME_CODES_FILE, 'w', encoding='utf-8') as f:
                    json.dump(scheme_info, f, indent=2)
                logger.info("Saved scheme codes to local backup cache.")
            except Exception:
                logger.exception("Failed to write scheme codes backup")
        except Exception as e:
            logger.exception("Failed to fetch scheme codes from api.mfapi.in")
            
    try:
        from mftool.utils import render_response
        result = render_response(scheme_info, as_json)
    except ImportError:
        if as_json:
            result = json.dumps(scheme_info)
        else:
            result = scheme_info

    _LOCAL_SCHEME_CODES_CACHE[cache_key] = result
    return result

# Replace get_scheme_codes
Mftool.get_scheme_codes = patched_get_scheme_codes

# Patch is_valid_code to not block if scheme_codes cache is empty
def patched_is_valid_code(self, code):
    if not code:
        return False
    code_str = str(code)
    if code_str in self._scheme_codes:
        return True
    return code_str.isdigit()

Mftool.is_valid_code = patched_is_valid_code
# -------------------------------------------------------------

app = FastAPI()
mf = Mftool()

# MongoDB connection
MONGODB_URL = os.getenv("MONGODB_URL")
if not MONGODB_URL:
    logger.error("MONGODB_URL environment variable is not set. MongoDB connection will likely fail.")
# Ensure we use the system/packaged CA bundle (certifi) for TLS verification
def create_mongo_client_with_certifi(url: str):
    ca_file = certifi.where()
    logger.info(f"Using certifi CA file at: {ca_file}")
    return MongoClient(url, tls=True, tlsCAFile=ca_file)

# Custom Local JSON Collection to fall back to if MongoDB is not available
class LocalJSONCollection:
    def __init__(self, filename):
        self.filename = os.path.join(os.path.dirname(os.path.abspath(__file__)), filename)
        self._load_data()

    def _load_data(self):
        if os.path.exists(self.filename):
            try:
                with open(self.filename, 'r', encoding='utf-8') as f:
                    self.data = json.load(f)
            except Exception:
                self.data = []
        else:
            self.data = []

    def _save_data(self):
        try:
            with open(self.filename, 'w', encoding='utf-8') as f:
                json.dump(self.data, f, default=str, indent=2)
        except Exception:
            pass

    def find(self, query):
        self._load_data()
        results = []
        for doc in self.data:
            match = True
            for k, v in query.items():
                if doc.get(k) != v:
                    match = False
                    break
            if match:
                results.append(doc.copy())
        return results

    def find_one(self, query):
        self._load_data()
        for doc in self.data:
            match = True
            for k, v in query.items():
                if doc.get(k) != v:
                    match = False
                    break
            if match:
                return doc.copy()
        return None

    def insert_one(self, document):
        self._load_data()
        doc = document.copy()
        if '_id' not in doc:
            doc['_id'] = str(ObjectId())
        self.data.append(doc)
        self._save_data()
        
        class InsertResult:
            def __init__(self, inserted_id):
                self.inserted_id = inserted_id
        return InsertResult(doc['_id'])

    def delete_one(self, query):
        self._load_data()
        initial_len = len(self.data)
        for i, doc in enumerate(self.data):
            match = True
            for k, v in query.items():
                if doc.get(k) != v:
                    match = False
                    break
            if match:
                self.data.pop(i)
                self._save_data()
                break
        
        class DeleteResult:
            def __init__(self, deleted_count):
                self.deleted_count = deleted_count
        return DeleteResult(1 if len(self.data) < initial_len else 0)

    def update_one(self, query, update_op, upsert=False):
        self._load_data()
        doc_to_update = None
        for doc in self.data:
            match = True
            for k, v in query.items():
                if doc.get(k) != v:
                    match = False
                    break
            if match:
                doc_to_update = doc
                break
        
        set_fields = update_op.get('$set', {}) if isinstance(update_op, dict) else {}
        
        class UpdateResult:
            def __init__(self, modified_count):
                self.modified_count = modified_count

        if doc_to_update is None:
            if upsert:
                new_doc = query.copy()
                new_doc.update(set_fields)
                if '_id' not in new_doc:
                    new_doc['_id'] = str(ObjectId())
                self.data.append(new_doc)
                self._save_data()
                return UpdateResult(1)
            return UpdateResult(0)
        
        doc_to_update.update(set_fields)
        self._save_data()
        return UpdateResult(1)

client = None
try:
    if MONGODB_URL:
        client = create_mongo_client_with_certifi(MONGODB_URL)
        # quick ping to validate the connection immediately
        try:
            client.admin.command('ping')
            logger.info("MongoClient created with certifi and ping succeeded")
        except Exception:
            logger.exception("MongoDB ping failed with certifi CA bundle")
            # If the environment explicitly allows insecure TLS (for debugging), try fallback
            allow_insecure = os.getenv("MONGODB_ALLOW_INVALID_CERTS", "false").lower() in ("1", "true", "yes")
            if allow_insecure:
                logger.warning("MONGODB_ALLOW_INVALID_CERTS is set; attempting insecure TLS connection (not for production)")
                try:
                    client = MongoClient(MONGODB_URL, tls=True, tlsAllowInvalidCertificates=True, serverSelectionTimeoutMS=10000)
                    client.admin.command('ping')
                    logger.info("MongoClient connected using tlsAllowInvalidCertificates=True (insecure)")
                except Exception:
                    logger.exception("Insecure TLS fallback also failed")
                    client = None
            else:
                logger.error("Certifi-based connection failed and insecure fallback not allowed by env var")
                client = None
    else:
        logger.warning("Skipping MongoDB client creation because MONGODB_URL is not set")
except Exception:
    logger.exception("Failed to create MongoClient with certifi CA bundle; attempting default client creation")
    try:
        if MONGODB_URL:
            client = MongoClient(MONGODB_URL, serverSelectionTimeoutMS=10000)
            client.admin.command('ping')
        else:
            client = None
    except Exception:
        logger.exception("Failed to create default MongoClient")
        client = None

db = None
users_collection = None
portfolio_collection = None

if client is not None:
    try:
        db = client["codezen"]
        users_collection = db["users"]
        portfolio_collection = db["portfolio"]
        logger.info("Successfully connected to MongoDB.")
    except Exception:
        logger.exception("Failed to connect to MongoDB collections")

if portfolio_collection is None:
    logger.warning("MongoDB is unavailable. Falling back to local JSON database storage.")
    users_collection = LocalJSONCollection("users_db.json")
    portfolio_collection = LocalJSONCollection("portfolio_db.json")

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
allowed_origins = [FRONTEND_URL, "http://localhost:5173", "http://127.0.0.1:5173"]

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_cors_headers(request, call_next):
    try:
        response = await call_next(request)
    except HTTPException as exc:
        response = JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
    except Exception as e:
        logger.error(f"Unhandled exception in request {request.url}: {str(e)}")
        response = JSONResponse(status_code=500, content={"detail": str(e)})
    
    origin = request.headers.get("origin")
    if origin in allowed_origins:
        response.headers["Access-Control-Allow-Origin"] = origin
    else:
        response.headers["Access-Control-Allow-Origin"] = FRONTEND_URL
        
    response.headers["Access-Control-Allow-Methods"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "*"
    return response

# Helper functions
scheme_names = {k: v for k, v in mf.get_scheme_codes().items()}

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
        logger.exception("Error fetching schemes; returning empty result for search=%s", search)
        return {}

@app.get("/api/scheme-details/{scheme_code}")
async def get_scheme_details(scheme_code: str) -> Dict[str, str]:
    try:
        details = mf.get_scheme_details(scheme_code)
        return stringify_dict(details) if details else {}
    except Exception as e:
        logger.exception("Error fetching scheme details for scheme_code: %s", scheme_code)
        return {}

@app.get("/api/historical-nav/{scheme_code}")
async def get_historical_nav(scheme_code: str) -> List[Dict[str, str]]:
    try:
        nav_data = mf.get_scheme_historical_nav(scheme_code, as_Dataframe=True)
        if nav_data is None or nav_data.empty:
            logger.warning("No historical NAV data found for scheme_code: %s", scheme_code)
            return []

        nav_data = nav_data.reset_index()
        if "nav" in nav_data.columns:
            nav_data["nav"] = pd.to_numeric(nav_data["nav"], errors="coerce")
        nav_data = nav_data.replace([np.inf, -np.inf], np.nan).fillna("")
        nav_data = nav_data.astype(str)
        return nav_data.to_dict(orient="records")
    except Exception as e:
        logger.exception("Error fetching historical NAV for scheme_code: %s", scheme_code)
        return []

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
        try:
            aum_data = mf.get_average_aum(period, False)
            if not aum_data or not isinstance(aum_data, list) or (len(aum_data) > 0 and isinstance(aum_data[0], str)):
                raise ValueError("Empty or invalid AUM data returned from AMFI")
        except Exception as ae:
            logger.warning(f"Error fetching real-time AUM data: {ae}. Falling back to static cache data.")
            aum_data = [
                {"Fund Name": "SBI Mutual Fund", "AAUM Overseas": "0.00", "AAUM Domestic": "980000.50"},
                {"Fund Name": "ICICI Prudential Mutual Fund", "AAUM Overseas": "0.00", "AAUM Domestic": "750000.20"},
                {"Fund Name": "HDFC Mutual Fund", "AAUM Overseas": "0.00", "AAUM Domestic": "720000.80"},
                {"Fund Name": "Nippon India Mutual Fund", "AAUM Overseas": "0.00", "AAUM Domestic": "450000.40"},
                {"Fund Name": "Kotak Mahindra Mutual Fund", "AAUM Overseas": "0.00", "AAUM Domestic": "420000.10"},
                {"Fund Name": "Aditya Birla Sun Life Mutual Fund", "AAUM Overseas": "0.00", "AAUM Domestic": "350000.90"},
                {"Fund Name": "Axis Mutual Fund", "AAUM Overseas": "0.00", "AAUM Domestic": "280000.30"},
                {"Fund Name": "UTI Mutual Fund", "AAUM Overseas": "0.00", "AAUM Domestic": "270000.60"},
                {"Fund Name": "DSP Mutual Fund", "AAUM Overseas": "0.00", "AAUM Domestic": "150000.10"},
                {"Fund Name": "Mirae Asset Mutual Fund", "AAUM Overseas": "0.00", "AAUM Domestic": "140000.50"}
            ]
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
        if portfolio_collection is None:
            return {"items": [], "total_latest_nav": 0.0}
        portfolio_items = list(portfolio_collection.find({"user_id": user_id}))
        if not portfolio_items:
            return {"items": [], "total_latest_nav": 0.0}

        summary_items = []
        total_latest_nav = 0.0
        for item in portfolio_items:
            if item["item_type"] == "mutual_fund":
                nav_data = mf.get_scheme_historical_nav(item["item_id"], as_Dataframe=True)
                try:
                    monte_carlo = await get_monte_carlo_prediction(item["item_id"])
                except HTTPException:
                    logger.exception("Monte Carlo failed for portfolio item %s", item["item_id"])
                    monte_carlo = {}

                try:
                    risk = await get_risk_volatility(item["item_id"])
                except HTTPException:
                    logger.exception("Risk volatility failed for portfolio item %s", item["item_id"])
                    risk = {}

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
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error fetching portfolio summary")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/api/save-user")
async def save_user(user: Dict[str, Any]):
    try:
        if users_collection is None:
            raise HTTPException(status_code=503, detail="User database is unavailable")
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
    except HTTPException:
        raise
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
        if client is not None:
            try:
                client.admin.command('ping')
                mongo_ok = True
            except Exception as me:
                logger.exception("MongoDB ping failed")

        return {"ok": True, "mongo_connected": mongo_ok}
    except Exception:
        logger.exception("Health check failed")
        raise HTTPException(status_code=500, detail="Health check failed")


@app.get("/api/debug-ssl")
async def debug_ssl():
    """Debug endpoint to surface SSL/OpenSSL and certifi details and attempt a short MongoDB ping.
    Use only for debugging; remove or protect in production."""
    import ssl
    import sys
    import traceback
    import os
    result = {
        "python_version": sys.version,
        "openssl_version": getattr(ssl, 'OPENSSL_VERSION', 'unknown'),
    }
    try:
        ca = certifi.where()
        result["certifi_path"] = ca
        result["certifi_exists"] = os.path.exists(ca)
    except Exception as e:
        result["certifi_error"] = str(e)

    # Attempt a short MongoDB ping using the certifi CA bundle
    try:
        test_client = MongoClient(MONGODB_URL, tls=True, tlsCAFile=certifi.where(), serverSelectionTimeoutMS=5000)
        test_client.admin.command('ping')
        result["mongo_ping"] = True
    except Exception as e:
        result["mongo_ping"] = False
        result["mongo_error"] = str(e)
        result["mongo_traceback"] = traceback.format_exc()[-2000:]

    return result

@app.get("/api/get-user/{user_id}")
async def get_user(user_id: str):
    try:
        user_data = users_collection.find_one({"user_id": user_id})
        if not user_data:
            raise HTTPException(status_code=404, detail="User not found")
        user_data.pop("_id", None)
        return user_data
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error fetching user")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/api/add-to-portfolio")
async def add_to_portfolio(item: Dict[str, Any]):
    try:
        if portfolio_collection is None:
            raise HTTPException(status_code=503, detail="Portfolio database is unavailable")
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
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error adding to portfolio")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.delete("/api/remove-from-portfolio/{user_id}/{item_id}")
async def remove_from_portfolio(user_id: str, item_id: str):
    try:
        if portfolio_collection is None:
            raise HTTPException(status_code=503, detail="Portfolio database is unavailable")
        result = portfolio_collection.delete_one({"user_id": user_id, "item_id": item_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Item not found in portfolio")
        logger.info(f"Removed item {item_id} from portfolio for user {user_id}")
        return {"message": "Item removed from portfolio"}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error removing item from portfolio")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/api/get-portfolio/{user_id}")
async def get_portfolio(user_id: str):
    try:
        if portfolio_collection is None:
            return []
        portfolio_items = list(portfolio_collection.find({"user_id": user_id}))
        for item in portfolio_items:
            item.pop("_id", None)
        return portfolio_items
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error fetching portfolio")
        raise HTTPException(status_code=500, detail="Internal server error")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000, reload=True)
