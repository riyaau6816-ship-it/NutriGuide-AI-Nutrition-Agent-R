# ============================================================
#  NutriGuide — Main Flask Application
#  IBM Watsonx.ai + Granite Model Powered Nutrition Agent
# ============================================================
import os
import json
import logging
from datetime import datetime
from flask import Flask, render_template, request, jsonify, session
from dotenv import load_dotenv
from ibm_watsonx_ai import Credentials
from ibm_watsonx_ai.foundation_models import ModelInference
from ibm_watsonx_ai.metanames import GenTextParamsMetaNames as GenParams
from agent_config import build_system_prompt, AGENT_INSTRUCTIONS

# ── Load environment ─────────────────────────────────────────
load_dotenv()

# ── Logging ──────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# ── Flask app ─────────────────────────────────────────────────
app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "nutriguide-dev-secret-key-change-in-prod")

# ── IBM Watsonx.ai Configuration ─────────────────────────────
IBM_API_KEY    = os.getenv("IBM_API_KEY", "")
IBM_PROJECT_ID = os.getenv("IBM_PROJECT_ID", "")
IBM_URL        = os.getenv("IBM_WATSONX_URL", "https://us-south.ml.cloud.ibm.com")

# ── Model Selection ───────────────────────────────────────────
#  Best available instruct model in au-syd region
GRANITE_MODEL_ID = "meta-llama/llama-3-3-70b-instruct"

# ── Generation Parameters ─────────────────────────────────────
GENERATION_PARAMS = {
    GenParams.MAX_NEW_TOKENS: 1024,
    GenParams.MIN_NEW_TOKENS: 50,
    GenParams.TEMPERATURE: 0.7,
    GenParams.TOP_P: 0.9,
    GenParams.TOP_K: 50,
    GenParams.REPETITION_PENALTY: 1.1,
}


def get_watsonx_model() -> ModelInference | None:
    """Initialise and return a Watsonx ModelInference instance."""
    if not IBM_API_KEY or not IBM_PROJECT_ID:
        logger.warning("IBM credentials not set — running in demo mode.")
        return None
    try:
        credentials = Credentials(url=IBM_URL, api_key=IBM_API_KEY)
        model = ModelInference(
            model_id=GRANITE_MODEL_ID,
            credentials=credentials,
            project_id=IBM_PROJECT_ID,
            params=GENERATION_PARAMS,
        )
        logger.info("Watsonx model initialised: %s", GRANITE_MODEL_ID)
        return model
    except Exception as exc:
        err = str(exc)
        if "BXNIM0415E" in err or "API key could not be found" in err:
            logger.error("IBM API key is invalid or has been deleted. "
                         "Regenerate it at cloud.ibm.com → Manage → Access (IAM) → API keys")
        elif "404" in err or "not found" in err.lower():
            logger.error("Model '%s' not found in region '%s'. "
                         "Check available models in your Watsonx project.", GRANITE_MODEL_ID, IBM_URL)
        elif "project" in err.lower():
            logger.error("Project ID '%s' not accessible. Verify it in your Watsonx Studio project settings.", IBM_PROJECT_ID)
        else:
            logger.error("Failed to initialise Watsonx model: %s", exc)
        return None


# ── Nutrition utilities ───────────────────────────────────────

BMI_CATEGORIES = [
    (0,  18.5, "Underweight",     "You may need to increase calorie intake with nutrient-dense foods."),
    (18.5, 25, "Normal Weight",   "Great job! Maintain your current healthy lifestyle."),
    (25,  30, "Overweight",       "Consider a moderate calorie deficit with increased physical activity."),
    (30, 100, "Obese",            "Consult a healthcare professional for a personalised weight-management plan."),
]

DEMO_RESPONSES = {
    "greeting": AGENT_INSTRUCTIONS["persona"]["greeting"],
    "default": (
        "⚠️ **Demo Mode** — IBM credentials not configured.\n\n"
        "I'm NutriGuide running in demo mode. Please set your IBM_API_KEY and "
        "IBM_PROJECT_ID in the `.env` file to enable full AI-powered responses.\n\n"
        "**Quick tip:** For a balanced Indian meal, try:\n"
        "• 🍚 1 cup brown rice or 2 rotis\n"
        "• 🥣 1 cup dal (protein + fibre)\n"
        "• 🥗 1 cup mixed sabzi\n"
        "• 🥛 1 glass buttermilk (probiotics)\n\n"
        "💧 Remember to drink 8–10 glasses of water daily!"
    ),
}


def calculate_bmi(weight_kg: float, height_cm: float) -> dict:
    """Return BMI value, category, and advice."""
    if height_cm <= 0 or weight_kg <= 0:
        return {"error": "Invalid height or weight values."}
    height_m = height_cm / 100
    bmi = round(weight_kg / (height_m ** 2), 1)
    category, advice = "Unknown", ""
    for low, high, cat, adv in BMI_CATEGORIES:
        if low <= bmi < high:
            category, advice = cat, adv
            break
    return {"bmi": bmi, "category": category, "advice": advice}


def calculate_tdee(weight_kg: float, height_cm: float, age: int,
                   gender: str, activity: str) -> dict:
    """Harris-Benedict BMR → TDEE calculation."""
    if gender.lower() == "male":
        bmr = 88.362 + (13.397 * weight_kg) + (4.799 * height_cm) - (5.677 * age)
    else:
        bmr = 447.593 + (9.247 * weight_kg) + (3.098 * height_cm) - (4.330 * age)

    activity_multipliers = {
        "sedentary": 1.2,
        "light": 1.375,
        "moderate": 1.55,
        "active": 1.725,
        "very_active": 1.9,
    }
    multiplier = activity_multipliers.get(activity.lower(), 1.55)
    tdee = round(bmr * multiplier)
    bmr  = round(bmr)

    return {
        "bmr": bmr,
        "tdee": tdee,
        "weight_loss": tdee - 500,
        "weight_gain": tdee + 500,
        "maintenance": tdee,
    }


def build_chat_prompt(user_message: str, history: list, family_context: str) -> str:
    """
    Constructs the full Granite-compatible prompt:
      <|system|> … <|user|> … <|assistant|>
    """
    system_prompt = build_system_prompt(family_context)

    parts = [f"<|system|>\n{system_prompt}\n"]

    # Append conversation history (last 6 turns to stay within token budget)
    for turn in history[-6:]:
        role = turn.get("role", "user")
        content = turn.get("content", "")
        if role == "user":
            parts.append(f"<|user|>\n{content}\n")
        else:
            parts.append(f"<|assistant|>\n{content}\n")

    parts.append(f"<|user|>\n{user_message}\n<|assistant|>\n")
    return "".join(parts)


# ── Routes ────────────────────────────────────────────────────

@app.route("/")
def index():
    """Serve the main SPA."""
    if "chat_history" not in session:
        session["chat_history"] = []
    if "family_profiles" not in session:
        session["family_profiles"] = []
    return render_template("index.html",
                           agent_name=AGENT_INSTRUCTIONS["persona"]["name"],
                           greeting=AGENT_INSTRUCTIONS["persona"]["greeting"])


@app.route("/api/chat", methods=["POST"])
def chat():
    """Main chat endpoint — calls Watsonx Granite or returns demo response."""
    data = request.get_json(silent=True) or {}
    user_message = (data.get("message") or "").strip()
    if not user_message:
        return jsonify({"error": "Empty message"}), 400

    history         = session.get("chat_history", [])
    family_profiles = session.get("family_profiles", [])

    # Build family context string
    family_context = ""
    if family_profiles:
        lines = ["Family members:"]
        for m in family_profiles:
            lines.append(
                f"• {m.get('name')} | Age: {m.get('age')} | Gender: {m.get('gender')} | "
                f"Diet: {m.get('diet_type')} | Conditions: {m.get('conditions', 'None')} | "
                f"Goal: {m.get('goal', 'Healthy eating')}"
            )
        family_context = "\n".join(lines)

    model = get_watsonx_model()

    if model is None:
        # Demo mode
        ai_response = DEMO_RESPONSES["default"]
    else:
        try:
            prompt = build_chat_prompt(user_message, history, family_context)
            result = model.generate_text(prompt=prompt)
            ai_response = result.strip() if isinstance(result, str) else result
        except Exception as exc:
            logger.error("Watsonx generation error: %s", exc)
            ai_response = (
                "I'm having trouble connecting to the AI service right now. "
                "Please check your credentials or try again shortly."
            )

    # Persist history in session
    history.append({"role": "user",      "content": user_message})
    history.append({"role": "assistant", "content": ai_response})
    session["chat_history"] = history[-20:]  # keep last 20 turns
    session.modified = True

    return jsonify({
        "response": ai_response,
        "timestamp": datetime.now().strftime("%I:%M %p"),
    })


@app.route("/api/bmi", methods=["POST"])
def bmi_endpoint():
    """BMI + TDEE calculation endpoint."""
    data = request.get_json(silent=True) or {}
    try:
        weight   = float(data["weight"])
        height   = float(data["height"])
        age      = int(data.get("age", 25))
        gender   = data.get("gender", "male")
        activity = data.get("activity", "moderate")
    except (KeyError, ValueError, TypeError) as exc:
        return jsonify({"error": f"Invalid input: {exc}"}), 400

    bmi_data  = calculate_bmi(weight, height)
    tdee_data = calculate_tdee(weight, height, age, gender, activity)
    return jsonify({**bmi_data, **tdee_data})


@app.route("/api/meal-plan", methods=["POST"])
def meal_plan():
    """Generate a personalised meal plan via Watsonx."""
    data = request.get_json(silent=True) or {}
    days            = min(int(data.get("days", 3)), AGENT_INSTRUCTIONS["response_format"]["max_meal_plan_days"])
    dietary_pref    = data.get("dietary_preference", "vegetarian")
    calorie_target  = data.get("calorie_target", 2000)
    cuisine         = data.get("cuisine", "Indian")
    health_goal     = data.get("health_goal", "balanced nutrition")
    allergies       = data.get("allergies", "none")

    prompt_text = (
        f"Create a detailed {days}-day {cuisine} {dietary_pref} meal plan with "
        f"approximately {calorie_target} calories/day for goal: {health_goal}. "
        f"Allergies to avoid: {allergies}. "
        f"Include breakfast, lunch, snack, and dinner for each day. "
        f"Provide calorie counts and macro breakdown (protein/carbs/fat) per meal. "
        f"Use realistic Indian food items with quantities."
    )

    model = get_watsonx_model()
    if model is None:
        response_text = (
            f"**{days}-Day Sample Indian {dietary_pref.title()} Meal Plan (~{calorie_target} kcal/day)**\n\n"
            "**Day 1**\n"
            "🌅 **Breakfast:** Oats upma with vegetables + 1 banana — ~350 kcal\n"
            "☀️ **Lunch:** 2 rotis + rajma curry + cucumber raita + salad — ~550 kcal\n"
            "🍎 **Snack:** Roasted chana + green tea — ~150 kcal\n"
            "🌙 **Dinner:** Brown rice + palak dal + stir-fried sabzi — ~500 kcal\n\n"
            "*(Demo mode — connect IBM credentials for full AI-generated plans)*"
        )
    else:
        try:
            family_context = ""
            if session.get("family_profiles"):
                family_context = "Generate a plan suitable for the family profile on record."
            full_prompt = build_chat_prompt(prompt_text, [], family_context)
            result = model.generate_text(prompt=full_prompt)
            response_text = result.strip() if isinstance(result, str) else result
        except Exception as exc:
            logger.error("Meal plan generation error: %s", exc)
            response_text = "Error generating meal plan. Please try again."

    return jsonify({"meal_plan": response_text, "days": days})


@app.route("/api/family", methods=["GET", "POST", "DELETE"])
def family():
    """CRUD for family member profiles stored in session."""
    if request.method == "GET":
        return jsonify({"members": session.get("family_profiles", [])})

    if request.method == "POST":
        data   = request.get_json(silent=True) or {}
        member = {
            "id":         data.get("id", str(int(datetime.now().timestamp()))),
            "name":       data.get("name", "Member"),
            "age":        data.get("age", 25),
            "gender":     data.get("gender", "male"),
            "weight":     data.get("weight", 65),
            "height":     data.get("height", 165),
            "diet_type":  data.get("diet_type", "vegetarian"),
            "conditions": data.get("conditions", ""),
            "allergies":  data.get("allergies", ""),
            "goal":       data.get("goal", "healthy eating"),
        }
        profiles = session.get("family_profiles", [])
        # Update existing or append
        existing_ids = [p["id"] for p in profiles]
        if member["id"] in existing_ids:
            profiles = [m if m["id"] != member["id"] else member for m in profiles]
        else:
            profiles.append(member)
        session["family_profiles"] = profiles
        session.modified = True
        return jsonify({"success": True, "member": member})

    if request.method == "DELETE":
        member_id = (request.get_json(silent=True) or {}).get("id")
        profiles  = [m for m in session.get("family_profiles", []) if m["id"] != member_id]
        session["family_profiles"] = profiles
        session.modified = True
        return jsonify({"success": True})


@app.route("/api/clear-chat", methods=["POST"])
def clear_chat():
    """Clear chat history from session."""
    session["chat_history"] = []
    session.modified = True
    return jsonify({"success": True})


@app.route("/api/nutrition-info", methods=["POST"])
def nutrition_info():
    """Get quick nutrition info for a specific food item."""
    data      = request.get_json(silent=True) or {}
    food_item = (data.get("food") or "").strip()
    if not food_item:
        return jsonify({"error": "No food item provided"}), 400

    prompt_text = (
        f"Provide detailed nutritional information for: {food_item}. "
        f"Include per-100g values: calories, protein, carbohydrates, fats, fibre, "
        f"key vitamins and minerals. Also mention health benefits and best ways to consume it."
    )

    model = get_watsonx_model()
    if model is None:
        response_text = (
            f"**Nutritional Info: {food_item}** *(Demo Mode)*\n\n"
            "Connect your IBM credentials for accurate AI-powered nutritional analysis."
        )
    else:
        try:
            full_prompt = build_chat_prompt(prompt_text, [], "")
            result = model.generate_text(prompt=full_prompt)
            response_text = result.strip() if isinstance(result, str) else result
        except Exception as exc:
            logger.error("Nutrition info error: %s", exc)
            response_text = "Error fetching nutritional information."

    return jsonify({"info": response_text, "food": food_item})


@app.route("/api/status")
def status():
    """Health check — reports credential status and connection test."""
    has_credentials = bool(IBM_API_KEY and IBM_PROJECT_ID)
    connection_error = None

    if has_credentials:
        try:
            credentials = Credentials(url=IBM_URL, api_key=IBM_API_KEY)
            ModelInference(
                model_id=GRANITE_MODEL_ID,
                credentials=credentials,
                project_id=IBM_PROJECT_ID,
                params={},
            )
            mode = "AI-powered"
        except Exception as exc:
            err = str(exc)
            mode = "demo"
            if "BXNIM0415E" in err or "API key could not be found" in err:
                connection_error = "API key invalid or deleted — regenerate at cloud.ibm.com"
            elif "404" in err or "not found" in err.lower():
                connection_error = f"Model '{GRANITE_MODEL_ID}' not available in this region"
            elif "project" in err.lower():
                connection_error = f"Project ID not accessible — check Watsonx Studio"
            else:
                connection_error = err[:120]
    else:
        mode = "demo"
        connection_error = "IBM_API_KEY or IBM_PROJECT_ID not set in .env"

    return jsonify({
        "status": "running",
        "model": GRANITE_MODEL_ID,
        "region": IBM_URL,
        "credentials_configured": has_credentials,
        "mode": mode,
        "error": connection_error,
        "agent": AGENT_INSTRUCTIONS["persona"]["name"],
    })


# ── Main ──────────────────────────────────────────────────────
if __name__ == "__main__":
    port  = int(os.getenv("APP_PORT", 5000))
    debug = os.getenv("FLASK_DEBUG", "True").lower() == "true"
    logger.info("🥗 NutriGuide starting on http://localhost:%d", port)
    app.run(host="0.0.0.0", port=port, debug=debug)
