import os
import json
import re
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from dotenv import load_dotenv
from anthropic import Anthropic

load_dotenv()

app = Flask(__name__)
CORS(app)

# Initialize Anthropic client
anthropic = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
MODEL_NAME = "claude-sonnet-4-20250514"

def get_claude_json(system_prompt, messages):
    """Helper function to call Claude API and ensure JSON output"""
    try:
        response = anthropic.messages.create(
            model=MODEL_NAME,
            max_tokens=2048,
            system=system_prompt,
            messages=messages
        )
        content = response.content[0].text
        # Clean up possible markdown wrappers
        content = re.sub(r'```json\s*', '', content)
        content = re.sub(r'```\s*', '', content)
        return json.loads(content.strip())
    except Exception as e:
        print(f"Error calling Claude API: {e}")
        return None

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/auth')
def auth():
    return render_template('auth.html')

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({"status": "ok", "app": "StudyMind AI", "version": "1.0.0"})

@app.route('/generate-plan', methods=['POST'])
def generate_plan():
    data = request.json
    if not data:
        return jsonify({"success": False, "error": "Invalid request"}), 400
        
    mood = data.get('mood', 'normal')
    subject = data.get('subject', 'General Study')
    time_mins = data.get('time', 60)
    difficulty = data.get('difficulty', 'intermediate')

    system_prompt = """You are an expert AI study planner that generates Pomodoro-based study schedules.
Always return ONLY valid JSON without any markdown or code fences.
Output JSON structure:
{
  "success": true,
  "plan": {
    "title": "String title for the plan",
    "motivation": "A string containing a personalized motivational message",
    "studyMethod": "Pomodoro",
    "focusScore": 75,
    "tasks": [
      {"id": 1, "type": "study", "icon": "📖", "activity": "Specific task action", "duration": 25},
      {"id": 2, "type": "break", "icon": "☕", "activity": "Specific break action", "duration": 5}
    ],
    "tips": ["tip1", "tip2", "tip3"]
  }
}

Rules for Generation:
- Mood 'tired' -> recommend lighter tasks, videos, revision, mindmaps, shorter sessions.
- Mood 'motivated' -> recommend hard problems, new concepts, deep dives.
- Mood 'stressed' -> recommend small achievable wins, calming break activities.
- Mood 'normal' -> recommend balanced progression.
- Tasks MUST BE SPECIFIC and actionable (e.g., 'write 3 functions using for loops'). Do not use generic phrases like 'study chapter 1'.
- Structure tasks using roughly 25min focus and 5min breaks (Pomodoro) that sum up to the total requested time."""
    
    user_prompt = f"Plan a study session. Subject: {subject}, Mood: {mood}, Difficulty: {difficulty}, Total Time Available: {time_mins} minutes."
    
    result = get_claude_json(system_prompt, [{"role": "user", "content": user_prompt}])
    if result:
        return jsonify(result)
    else:
        return jsonify({"success": False, "error": "Failed to generate study plan from AI"}), 500

@app.route('/api/motivation', methods=['POST'])
def motivation():
    data = request.json
    if not data:
        return jsonify({"success": False, "error": "Invalid request"}), 400
        
    mood = data.get('mood', 'normal')
    subject = data.get('subject', 'General Study')
    
    system_prompt = """You are an AI generating motivational messages for a student.
Always return ONLY valid JSON without any markdown or code fences.
Output JSON structure:
{
  "success": true, 
  "messages": ["msg1", "msg2", "msg3"]
}
Rules:
- Give exactly 3 motivational messages.
- Make them fresh and highly specific to the given mood and subject.
- Do NOT use generic quotes."""
    
    user_prompt = f"The student is studying {subject} and currently feels {mood}. Generate 3 targeted motivational messages for them."
    result = get_claude_json(system_prompt, [{"role": "user", "content": user_prompt}])
    if result:
        return jsonify(result)
    return jsonify({"success": False, "error": "Failed to generate motivation"}), 500

@app.route('/api/detect-mood', methods=['POST'])
def detect_mood():
    data = request.json
    if not data:
        return jsonify({"success": False, "error": "Invalid request"}), 400
        
    text = data.get('text', '')
    
    system_prompt = """You are an AI that analyzes user text to determine their study mood.
Always return ONLY valid JSON without any markdown or code fences.
The mood MUST be exactly one of: 'motivated', 'tired', 'stressed', 'normal'.
Output JSON structure:
{
  "success": true, 
  "mood": "tired", 
  "confidence": 0.95, 
  "reason": "Brief explanation of why this mood was chosen based on the text."
}"""
    
    user_prompt = f"Determine the mood from this text: '{text}'"
    result = get_claude_json(system_prompt, [{"role": "user", "content": user_prompt}])
    if result:
        return jsonify(result)
    return jsonify({"success": False, "error": "Failed to detect mood"}), 500

@app.route('/api/analyze-weak-topics', methods=['POST'])
def analyze_weak_topics():
    data = request.json
    if not data:
        return jsonify({"success": False, "error": "Invalid request"}), 400
        
    sessions = data.get('sessions', [])
    
    system_prompt = """You are an AI that analyzes a student's past study session data to find weak and strong topics, and recommends the best study methods.
Always return ONLY valid JSON without any markdown or code fences.
Output JSON structure:
{
  "success": true, 
  "weakTopics": ["Topic 1", "Topic 2"], 
  "strongTopics": ["Topic A"], 
  "recommendation": "Detailed actionable advice based on performance.", 
  "bestStudyTime": "morning/afternoon/evening", 
  "suggestedMethod": "e.g., Flashcards, Feynman method, etc."
}"""
    
    user_prompt = f"Analyze this past session data: {json.dumps(sessions)}"
    result = get_claude_json(system_prompt, [{"role": "user", "content": user_prompt}])
    if result:
        return jsonify(result)
    return jsonify({"success": False, "error": "Failed to analyze topics"}), 500

if __name__ == '__main__':
    # Ensure templates and static folders exist
    os.makedirs('templates', exist_ok=True)
    os.makedirs('static', exist_ok=True)
    app.run(debug=True, port=5000)
