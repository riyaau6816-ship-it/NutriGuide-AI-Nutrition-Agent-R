# 🥗 NutriGuide — AI-Powered Nutrition Agent

> **IBM Watsonx.ai + Granite | Flask | Bootstrap 5 | Indian Cuisine Aware**

NutriGuide is a full-stack web application that puts an intelligent nutrition coach in your browser. It is powered by IBM's **Granite** large language model via **Watsonx.ai** and provides:

- 💬 **AI Chat** — Real-time nutrition Q&A, meal ideas, recipe analysis
- 📊 **BMI & TDEE Dashboard** — Animated gauges, calorie targets, macro split charts
- 🗓️ **Meal Plan Generator** — AI-crafted Indian cuisine plans (1–7 days)
- 👨‍👩‍👧‍👦 **Family Profiles** — Per-member nutrition goals, allergies, health conditions
- 🔍 **Food Nutrition Lookup** — Detailed macro/micro info for any food item
- 💧 **Water Tracker** — Daily intake gamification
- 🌙 **Dark Mode** — Persistent theme preference
- 📱 **Mobile Responsive** — Full Bootstrap 5 responsive layout

---

## 📁 Project Structure

```
NutriGuide/
├── app.py                  ← Flask backend (routes, Watsonx integration)
├── agent_config.py         ← ⭐ AGENT INSTRUCTIONS (customize here!)
├── requirements.txt        ← Python dependencies
├── .env.example            ← Environment variable template
├── .env                    ← Your credentials (create from .env.example)
│
├── templates/
│   └── index.html          ← Single-page application HTML
│
└── static/
    ├── css/
    │   └── style.css       ← Full stylesheet with dark mode
    └── js/
        ├── app.js          ← Main application JavaScript
        └── markdown.js     ← Lightweight markdown renderer
```

---

## ⚙️ Prerequisites

| Tool | Version |
|------|---------|
| Python | 3.10 or newer |
| pip | latest |
| IBM Cloud Account | Free tier works |
| IBM Watsonx.ai Project | Required |

---

## 🚀 Quick Start (5 Steps)

### Step 1 — Clone / Download the Project

```bash
cd path/to/NutriGuide
```

### Step 2 — Create a Virtual Environment

```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS / Linux
python3 -m venv venv
source venv/bin/activate
```

### Step 3 — Install Dependencies

```bash
pip install -r requirements.txt
```

### Step 4 — Configure IBM Credentials

```bash
# Copy the template
copy .env.example .env          # Windows
cp .env.example .env            # macOS/Linux

# Edit .env — fill in your values:
#   IBM_API_KEY=<your IBM Cloud API key>
#   IBM_PROJECT_ID=<your Watsonx project ID>
#   FLASK_SECRET_KEY=<random string, 32+ chars>
```

**How to get IBM credentials:**

1. Sign up / log in at [cloud.ibm.com](https://cloud.ibm.com)
2. Create a **Watsonx.ai** service instance
3. Create a **project** inside Watsonx Studio
4. Generate an **API key**: Manage → Security → API keys → Create
5. Copy your **Project ID** from the Watsonx project settings

### Step 5 — Run the Application

```bash
python app.py
```

Open your browser at **http://localhost:5000**

---

## 🤖 Customizing the AI Agent

All agent behavior is controlled in **`agent_config.py`** — no need to touch `app.py`.

```python
# agent_config.py

AGENT_INSTRUCTIONS = {
    "persona": {
        "name": "NutriGuide",              # Change the agent's name
        "tone": "warm, empathetic, ...",   # Adjust communication style
        "greeting": "Hello! I'm ...",      # Custom welcome message
    },

    "diet_specializations": [
        "Indian vegetarian & vegan diets",
        "Diabetic-friendly meal planning",
        # Add or remove specializations
    ],

    "indian_food_preferences": {
        "prioritize_indian_foods": True,   # Set False for global cuisine
        "preferred_grains": [...],         # Edit preferred ingredients
    },

    "safety_rules": [
        "NEVER diagnose medical conditions...",
        # Add custom safety rules
    ],

    "response_format": {
        "include_calorie_estimates": True,
        "include_macros": True,
        "emoji_use": "moderate",           # none | moderate | rich
        "max_meal_plan_days": 7,
    },
}
```

---

## 🌐 API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Main application SPA |
| `/api/chat` | POST | Chat with AI agent |
| `/api/bmi` | POST | BMI + TDEE calculation |
| `/api/meal-plan` | POST | Generate AI meal plan |
| `/api/family` | GET/POST/DELETE | CRUD family profiles |
| `/api/nutrition-info` | POST | Food nutrition lookup |
| `/api/clear-chat` | POST | Clear chat session |
| `/api/status` | GET | Health check + credential status |

### Example: Chat Request

```bash
curl -X POST http://localhost:5000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Give me a diabetic-friendly Indian breakfast"}'
```

### Example: BMI Calculation

```bash
curl -X POST http://localhost:5000/api/bmi \
  -H "Content-Type: application/json" \
  -d '{"weight": 70, "height": 170, "age": 30, "gender": "female", "activity": "moderate"}'
```

---

## ☁️ Deployment

### Option A — Gunicorn (Linux / Production)

```bash
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

### Option B — IBM Code Engine

```bash
# Build & push Docker image
docker build -t nutriguide .
docker tag nutriguide icr.io/<namespace>/nutriguide:latest
docker push icr.io/<namespace>/nutriguide:latest

# Deploy
ibmcloud ce app create \
  --name nutriguide \
  --image icr.io/<namespace>/nutriguide:latest \
  --env-from-secret nutriguide-secrets
```

### Option C — Heroku

```bash
# Add Procfile
echo "web: gunicorn app:app" > Procfile

heroku create nutriguide-app
heroku config:set IBM_API_KEY=<key> IBM_PROJECT_ID=<id> FLASK_SECRET_KEY=<secret>
git push heroku main
```

### Option D — Docker

```bash
# Dockerfile (create in project root)
docker build -t nutriguide .
docker run -p 5000:5000 \
  -e IBM_API_KEY=<key> \
  -e IBM_PROJECT_ID=<id> \
  -e FLASK_SECRET_KEY=<secret> \
  nutriguide
```

---

## 🔒 Security Best Practices

- ✅ Never commit `.env` — it is in `.gitignore`
- ✅ Use environment variables for all secrets in production
- ✅ Rotate your IBM API key regularly
- ✅ Set a strong random `FLASK_SECRET_KEY` in production
- ✅ Use HTTPS behind a reverse proxy (nginx/Caddy)
- ✅ Set `FLASK_DEBUG=False` in production

---

## 🧪 Running in Demo Mode

If you haven't configured IBM credentials, NutriGuide runs in **Demo Mode**:

- A banner appears indicating demo mode is active
- Sample responses are returned for all AI endpoints
- BMI / TDEE calculations work fully (they are computed locally)
- All UI features remain functional

---

## 🛠️ Troubleshooting

| Issue | Fix |
|-------|-----|
| `IBM credentials not set` banner | Add `IBM_API_KEY` and `IBM_PROJECT_ID` to `.env` |
| `ModuleNotFoundError: ibm_watsonx_ai` | Run `pip install -r requirements.txt` |
| `401 Unauthorized` from Watsonx | Check API key validity and project ID |
| Port 5000 busy | Set `APP_PORT=5001` in `.env` |
| Chat not responding | Check browser console and Flask logs |

---

## 📦 Dependencies

```
flask>=3.0.0          — Web framework
python-dotenv>=1.0.0  — .env file loader
ibm-watsonx-ai>=0.2.6 — IBM Watsonx AI SDK
requests>=2.31.0      — HTTP client
gunicorn>=21.2.0      — Production WSGI server
```

---

## 📜 License

MIT License — Free to use, modify, and distribute.

---

*Built with ❤️ using IBM Watsonx.ai, Granite LLM, Python Flask, and Bootstrap 5*
