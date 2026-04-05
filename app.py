"""
StudyMind AI — Python Backend
Flask server with Anthropic Claude API integration
"""

import os
import json
from flask import Flask, request, jsonify
from flask_cors import CORS
import anthropic
from dotenv import load_dotenv
load_dotenv()
app = Flask(__name__)
CORS(app)

# Initialize Anthropic client
client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))
from flask import Flask, render_template

app = Flask(__name__)

@app.route("/")
def home():
    return render_template("index.html")
#if __name__ == "__main__"
#app.run(debug=True)
# ─── STUDY PLAN GENERATOR ───────────────────────────────────────────────────
@app.route("/generate-plan", methods=["POST"])
def generate_plan():
    data = request.get_json()
    mood       = data.get("mood", "normal")
    subject    = data.get("subject", "General")
    time_mins  = int(data.get("time", 60))
    difficulty = data.get("difficulty", "intermediate")

    hours = time_mins // 60
    mins  = time_mins % 60
    time_str = ""
    if hours > 0:
        time_str += f"{hours} hour{'s' if hours > 1 else ''} "
    if mins > 0:
        time_str += f"{mins} minutes"
    time_str = time_str.strip() or f"{time_mins} minutes"

    prompt = f"""You are StudyMind AI, an expert study planner using cognitive science and the Pomodoro Technique.

Student Details:
- Mood: {mood}
- Subject/Topic: {subject}
- Available Time: {time_str}
- Difficulty: {difficulty}

Create a personalized study plan. Rules:
- Use Pomodoro (25min study + 5min break cycles), adjusted for mood
- Tired → lighter activities (videos, revision, mindmaps)
- Motivated → deeper activities (hard problems, new concepts)
- Stressed → small wins + calming breaks
- Normal → balanced progression
- Be SPECIFIC about activities (not "study python" but "code 3 small functions using loops")

Return ONLY valid JSON (no markdown, no commentary):
{{
  "title": "short descriptive plan title",
  "motivation": "personalized motivational sentence based on mood and subject",
  "studyMethod": "primary method (Pomodoro/Active Recall/Spaced Repetition/Practice Problems/Flashcards)",
  "focusScore": number between 0 and 100,
  "tasks": [
    {{
      "id": 1,
      "type": "study|break|review",
      "icon": "single relevant emoji",
      "activity": "very specific activity description",
      "duration": duration_in_minutes_as_integer
    }}
  ],
  "tips": ["study tip 1", "study tip 2", "study tip 3"]
}}"""

    try:
        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}]
        )
        raw = message.content[0].text.strip()
        raw = raw.replace("```json", "").replace("```", "").strip()
        plan = json.loads(raw)
        plan["subject"] = subject
        plan["mood"]    = mood
        plan["time"]    = time_mins
        return jsonify({"success": True, "plan": plan})

    except json.JSONDecodeError as e:
        return jsonify({"success": False, "error": f"JSON parse error: {str(e)}"}), 500
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# ─── MOTIVATION GENERATOR ───────────────────────────────────────────────────
@app.route("/api/motivation", methods=["POST"])
def get_motivation():
    data    = request.get_json()
    mood    = data.get("mood", "normal")
    subject = data.get("subject", "studying")

    prompt = f"""Generate 3 short, powerful, unique motivational messages for a student who is feeling {mood} about studying {subject}.
Each message should be 1-2 sentences, genuine, not cliché. 
Return ONLY a JSON array: ["message1", "message2", "message3"]"""

    try:
        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=300,
            messages=[{"role": "user", "content": prompt}]
        )
        raw = message.content[0].text.strip().replace("```json","").replace("```","").strip()
        messages = json.loads(raw)
        return jsonify({"success": True, "messages": messages})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# ─── MOOD DETECTOR FROM TEXT ────────────────────────────────────────────────
@app.route("/api/detect-mood", methods=["POST"])
def detect_mood():
    data = request.get_json()
    text = data.get("text", "")

    prompt = f"""Analyze this student's message and detect their mood for studying.
Message: "{text}"

Return ONLY valid JSON:
{{"mood": "motivated|tired|stressed|normal", "confidence": 0.0_to_1.0, "reason": "brief explanation"}}"""

    try:
        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=100,
            messages=[{"role": "user", "content": prompt}]
        )
        raw = message.content[0].text.strip().replace("```json","").replace("```","").strip()
        result = json.loads(raw)
        return jsonify({"success": True, **result})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# ─── WEAK TOPIC ANALYSIS ────────────────────────────────────────────────────
@app.route("/api/analyze-weak-topics", methods=["POST"])
def analyze_weak_topics():
    data     = request.get_json()
    sessions = data.get("sessions", [])

    if not sessions:
        return jsonify({"success": True, "weakTopics": [], "recommendation": "No data yet. Start studying!"})

    sessions_summary = "\n".join([
        f"- Subject: {s.get('subject')}, Focus: {s.get('focusScore')}%, Duration: {s.get('duration')}min, Mood: {s.get('mood')}"
        for s in sessions[-10:]
    ])

    prompt = f"""Analyze these recent study sessions and identify patterns:

{sessions_summary}

Return ONLY valid JSON:
{{
  "weakTopics": ["topic1", "topic2"],
  "strongTopics": ["topic1"],
  "recommendation": "personalized study recommendation in 2 sentences",
  "bestStudyTime": "morning|afternoon|evening|night",
  "suggestedMethod": "method name"
}}"""

    try:
        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=400,
            messages=[{"role": "user", "content": prompt}]
        )
        raw = message.content[0].text.strip().replace("```json","").replace("```","").strip()
        result = json.loads(raw)
        return jsonify({"success": True, **result})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# ─── HEALTH CHECK ───────────────────────────────────────────────────────────
@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "app": "StudyMind AI",
        "version": "1.0.0",
        "api_configured": bool(os.environ.get("ANTHROPIC_API_KEY"))
    })


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_ENV", "production") == "development"
    print(f"🚀 StudyMind AI Backend running on port {port}")
    app.run(host="0.0.0.0", port=port, debug=debug)
