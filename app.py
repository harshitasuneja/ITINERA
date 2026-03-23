"""
ITINERA – AI Smart Travel Planner
Flask Backend Application
"""

from flask import Flask, render_template, request, jsonify, redirect, url_for
import pandas as pd
import sqlite3
import json
import os
import random
from datetime import datetime, timedelta

app = Flask(__name__)

# ─── Database Setup ────────────────────────────────────────────────────────────

DB_PATH = "itinera.db"

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Create tables if they don't exist."""
    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS trips (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            destination TEXT,
            start_date TEXT,
            end_date TEXT,
            num_days INTEGER,
            budget REAL,
            travel_style TEXT,
            activities TEXT,
            specially_abled INTEGER DEFAULT 0,
            disability_type TEXT,
            accessibility_needs TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS itineraries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            trip_id INTEGER,
            itinerary_json TEXT,
            FOREIGN KEY (trip_id) REFERENCES trips(id)
        )
    """)

    conn.commit()
    conn.close()

# ─── Data Loading ──────────────────────────────────────────────────────────────

def load_data():
    hotels_df     = pd.read_csv("datasets/hotels.csv")
    attractions_df = pd.read_csv("datasets/attractions.csv")
    transport_df  = pd.read_csv("datasets/transport.csv")
    return hotels_df, attractions_df, transport_df

# ─── AI Recommendation Logic ──────────────────────────────────────────────────

def recommend_hotel(city, budget, style, accessibility_needs, hotels_df):
    """Filter and score hotels based on user prefs."""
    city_hotels = hotels_df[hotels_df["city"].str.lower() == city.lower()].copy()

    if city_hotels.empty:
        return None

    # Budget cap: 40% of total budget / num_days (budget in USD)
    max_price = budget * 0.4

    affordable = city_hotels[city_hotels["price_per_night"] <= max_price]
    if affordable.empty:
        affordable = city_hotels  # fallback: show cheapest

    # Accessibility filter
    needs = accessibility_needs if isinstance(accessibility_needs, list) else []
    if needs:
        col_map = {
            "wheelchair": "wheelchair_accessible",
            "ramp":       "ramp_access",
            "elevator":   "elevator",
            "transport":  "accessible_transport",
            "hotel":      "accessible_hotel"
        }
        for need in needs:
            for key, col in col_map.items():
                if key in need.lower() and col in affordable.columns:
                    filtered = affordable[affordable[col].astype(str).str.lower() == "true"]
                    if not filtered.empty:
                        affordable = filtered

    # Style preference
    style_match = affordable[affordable["style"].str.lower() == style.lower()]
    if not style_match.empty:
        affordable = style_match

    affordable = affordable.sort_values("rating", ascending=False)
    return affordable.iloc[0].to_dict()

def recommend_attractions(city, activities, num_days, accessibility_needs, weather_data, attractions_df):
    """Pick relevant attractions per day."""
    city_attr = attractions_df[attractions_df["city"].str.lower() == city.lower()].copy()

    if city_attr.empty:
        return []

    acts = activities if isinstance(activities, list) else []

    # If rain → prefer indoor
    is_raining = any("rain" in str(w).lower() for w in weather_data) if weather_data else False
    if is_raining:
        indoor  = city_attr[city_attr["indoor"].astype(str).str.lower() == "true"]
        outdoor = city_attr[city_attr["indoor"].astype(str).str.lower() == "false"]
        city_attr = pd.concat([indoor, outdoor])

    # Accessibility filter
    needs = accessibility_needs if isinstance(accessibility_needs, list) else []
    if needs and any("wheelchair" in n.lower() for n in needs):
        acc = city_attr[city_attr["wheelchair_accessible"].astype(str).str.lower() == "true"]
        if not acc.empty:
            city_attr = acc

    # Activity category filter
    if acts:
        act_filtered = city_attr[city_attr["category"].isin(acts)]
        if not act_filtered.empty:
            city_attr = act_filtered

    city_attr    = city_attr.drop_duplicates("name")
    spots_per_day = 3
    selected      = city_attr.head(num_days * spots_per_day).to_dict("records")

    daily = []
    for d in range(num_days):
        daily.append(selected[d * spots_per_day : (d + 1) * spots_per_day])
    return daily

def recommend_transport(city, accessibility_needs, transport_df):
    """Pick best transport option."""
    city_trans = transport_df[transport_df["city"].str.lower() == city.lower()]

    needs = accessibility_needs if isinstance(accessibility_needs, list) else []
    if needs:
        acc = city_trans[city_trans["accessible"].astype(str).str.lower() == "true"]
        if not acc.empty:
            return acc.iloc[0].to_dict()

    if not city_trans.empty:
        return city_trans.iloc[0].to_dict()
    return {"type": "Local Taxi", "price_per_day_usd": 50, "description": "Local taxi service"}

def budget_breakdown(total_budget, num_days, hotel_price, transport_price):
    """Allocate budget across categories (all in USD)."""
    hotel_total      = hotel_price * num_days
    transport_total  = transport_price * num_days
    food_total       = total_budget * 0.20
    activities_total = total_budget * 0.10

    return {
        "hotel":      round(hotel_total, 2),
        "transport":  round(transport_total, 2),
        "food":       round(food_total, 2),
        "activities": round(activities_total, 2),
        "total":      round(total_budget, 2),
        "remaining":  round(total_budget - hotel_total - transport_total - food_total - activities_total, 2),
        "currency":   "USD"
    }

# ─── Mock Weather ──────────────────────────────────────────────────────────────

WEATHER_CONDITIONS = {
    "tropical":   [("sunny", "☀️", 30, 38), ("partly cloudy", "⛅", 28, 35), ("thunderstorm", "⛈️", 26, 32)],
    "temperate":  [("sunny", "☀️", 18, 25), ("partly cloudy", "⛅", 15, 22), ("light rain", "🌦️", 12, 18)],
    "desert":     [("sunny", "☀️", 35, 44), ("hot", "🌡️", 33, 42), ("clear", "🌤️", 30, 40)],
    "cold":       [("clear", "🌤️", 5, 12),  ("cloudy", "☁️", 3, 9),  ("light snow", "🌨️", -2, 5)],
}
CITY_CLIMATE = {
    "dubai": "desert", "bali": "tropical", "bangkok": "tropical",
    "singapore": "tropical", "nairobi": "tropical", "rio de janeiro": "tropical",
    "tokyo": "temperate", "london": "temperate", "paris": "temperate",
    "amsterdam": "temperate", "barcelona": "temperate", "vienna": "temperate",
    "new york": "temperate", "los angeles": "temperate", "sydney": "temperate",
    "cape town": "temperate", "istanbul": "temperate", "venice": "temperate",
    "new delhi": "desert", "utah": "desert",
}

def get_mock_weather(city, num_days):
    """Generate contextual mock weather based on city climate."""
    climate = CITY_CLIMATE.get(city.lower(), "temperate")
    conditions = WEATHER_CONDITIONS[climate]
    weather = []
    for i in range(num_days):
        cond, icon, tlo, thi = random.choice(conditions)
        temp_hi = random.randint(tlo, thi)
        weather.append({
            "day":       i + 1,
            "condition": cond,
            "icon":      icon,
            "temp_high": temp_hi,
            "temp_low":  temp_hi - random.randint(6, 11),
            "humidity":  random.randint(30, 80)
        })
    return weather

# ─── Routes ────────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/plan")
def plan():
    return render_template("plan.html")

@app.route("/api/generate", methods=["POST"])
def generate_itinerary():
    """Main API: receive form data → generate itinerary."""
    data = request.get_json()

    destination        = data.get("destination", "London")
    start_date         = data.get("start_date", "")
    end_date           = data.get("end_date", "")
    num_days           = int(data.get("num_days", 3))
    budget             = float(data.get("budget", 10000))
    travel_style       = data.get("travel_style", "cultural")
    activities         = data.get("activities", [])
    specially_abled    = data.get("specially_abled", False)
    disability_type    = data.get("disability_type", "")
    accessibility_needs = data.get("accessibility_needs", [])

    hotels_df, attractions_df, transport_df = load_data()
    weather = get_mock_weather(destination, num_days)

    hotel     = recommend_hotel(destination, budget, travel_style, accessibility_needs, hotels_df)
    daily_plan = recommend_attractions(destination, activities, num_days, accessibility_needs, [w["condition"] for w in weather], attractions_df)
    transport = recommend_transport(destination, accessibility_needs, transport_df)

    hotel_price     = hotel["price_per_night"] if hotel else budget * 0.4 / num_days
    transport_price = transport.get("price_per_day_usd", transport.get("price_per_day", 50))
    budget_info     = budget_breakdown(budget, num_days, hotel_price, transport_price)

    itinerary = {
        "destination": destination,
        "start_date":  start_date,
        "end_date":    end_date,
        "num_days":    num_days,
        "hotel":       hotel,
        "daily_plan":  daily_plan,
        "transport":   transport,
        "budget":      budget_info,
        "weather":     weather,
        "accessibility": {
            "specially_abled": specially_abled,
            "disability_type": disability_type,
            "needs": accessibility_needs
        }
    }

    # Save to DB
    conn = get_db()
    cur  = conn.cursor()
    cur.execute("""
        INSERT INTO trips (destination, start_date, end_date, num_days, budget,
            travel_style, activities, specially_abled, disability_type, accessibility_needs)
        VALUES (?,?,?,?,?,?,?,?,?,?)
    """, (
        destination, start_date, end_date, num_days, budget,
        travel_style, json.dumps(activities),
        1 if specially_abled else 0,
        disability_type, json.dumps(accessibility_needs)
    ))
    trip_id = cur.lastrowid
    cur.execute("INSERT INTO itineraries (trip_id, itinerary_json) VALUES (?,?)",
                (trip_id, json.dumps(itinerary)))
    conn.commit()
    conn.close()

    return jsonify({"success": True, "itinerary": itinerary})

@app.route("/result")
def result():
    return render_template("result.html")

if __name__ == "__main__":
    init_db()
    app.run(debug=True)
