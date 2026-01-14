"""
Generate Filter API - Vercel Serverless Function
Creates filter parameters from quiz answers using GPT-4o via OpenRouter
"""

from http.server import BaseHTTPRequestHandler
import json
import os
import urllib.request
import urllib.error

# OpenRouter API configuration
API_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL = "google/gemini-3-pro-preview"


def build_prompt(quiz_results: list, questions: list) -> str:
    """Build the prompt for GPT - Plant Photography Specialist"""
    
    answer_summary = "\n".join([
        f'Q{i+1}: "{q["text"]}" → "{next((opt["label"] for opt in q["options"] if opt["value"] == r["answer"]), r["answer"])}" ({next((opt["description"] for opt in q["options"] if opt["value"] == r["answer"]), "")})'
        for i, (r, q) in enumerate(zip(quiz_results, questions))
    ])
    
    return f"""You are an expert plant photography specialist. Based on the user's answers about their aesthetic preferences, create a great looking photo filter.

USER'S ANSWERS:
{answer_summary}


PARAMETERS (be creative, use the full range when appropriate):
- brightness: 0.6 to 1.5 (1.0 = no change, lower = darker, higher = brighter)
- contrast: 0.6 to 1.5 (1.0 = no change, lower = flatter, higher = punchier)
- saturation: 0.3 to 1.8 (1.0 = no change, lower = muted, higher = vivid)
- temperature: -40 to +40 (0 = neutral, negative = cool/blue, positive = warm/orange)
- tint: -25 to +25 (0 = neutral, negative = green, positive = magenta)
- grain: 0 to 0.4 (0 = none, higher = more film grain)
- vignette: 0 to 0.6 (0 = none, higher = darker edges)
- fade: 0 to 0.35 (0 = none, higher = lifted blacks/matte look)


Brightness & Contrast: The foundation. Brightness sets the exposure; Contrast adds "pop" and depth.

Saturation: Controls color intensity. Pro tip: Lower saturation often looks more expensive/cinematic.

Temperature & Tint: The "White Balance." Temperature moves between Blue (Cool) and Yellow (Warm). Tint moves between Green and Magenta.

Fade, Grain & Vignette: The "Texture." These mimic old camera limitations to add character.

Recipe 1: The "Moody Cinematic" Look
The Vibe: Emotional, dramatic, serious.
Brightness: -10 to -20, Contrast: +15 to +25, Saturation: -10 to -20, Temperature: -5 to -10, Tint: +5, Grain: 0, Vignette: +15, Fade: +10

Recipe 2: The "Vintage Film" Look
The Vibe: Nostalgic, warm, soft.
Brightness: +10, Contrast: -10 to -15, Saturation: -5, Temperature: +15 to +25, Tint: -5, Grain: +25 to +40, Vignette: +10, Fade: +30

Recipe 3: The "Modern Clean" Look
The Vibe: Sharp, energetic, true-to-life.
Brightness: +20 to +30, Contrast: +10, Saturation: +10 to +15, Temperature: 0, Tint: 0, Grain: 0, Vignette: 0, Fade: 0

Generate a gentle 2-3 word name.

Respond ONLY with valid JSON:
{{
  "name": "Filter Name",
  "brightness": 1.0,
  "contrast": 1.0,
  "saturation": 1.0,
  "temperature": 0,
  "tint": 0,
  "grain": 0,
  "vignette": 0,
  "fade": 0
}}"""


# Parameter ranges for validation - expanded for more creative freedom
RANGES = {
    "brightness": {"min": 0.6, "max": 1.5},
    "contrast": {"min": 0.6, "max": 1.5},
    "saturation": {"min": 0.3, "max": 1.8},
    "temperature": {"min": -40, "max": 40},
    "tint": {"min": -25, "max": 25},
    "grain": {"min": 0, "max": 0.4},
    "vignette": {"min": 0, "max": 0.6},
    "fade": {"min": 0, "max": 0.35}
}


def clamp_value(value, range_def):
    """Clamp value to valid range"""
    if not isinstance(value, (int, float)) or value != value:
        return (range_def["min"] + range_def["max"]) / 2
    return max(range_def["min"], min(range_def["max"], value))


def parse_response(response_text: str) -> dict:
    """Parse and validate GPT response"""
    cleaned = response_text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.replace("```json", "").replace("```", "").strip()
    
    parsed = json.loads(cleaned)
    
    return {
        "name": parsed.get("name", "Botanical Custom"),
        "brightness": round(clamp_value(parsed.get("brightness", 1.0), RANGES["brightness"]), 2),
        "contrast": round(clamp_value(parsed.get("contrast", 1.0), RANGES["contrast"]), 2),
        "saturation": round(clamp_value(parsed.get("saturation", 1.0), RANGES["saturation"]), 2),
        "temperature": round(clamp_value(parsed.get("temperature", 0), RANGES["temperature"])),
        "tint": round(clamp_value(parsed.get("tint", 0), RANGES["tint"])),
        "grain": round(clamp_value(parsed.get("grain", 0), RANGES["grain"]), 3),
        "vignette": round(clamp_value(parsed.get("vignette", 0), RANGES["vignette"]), 2),
        "fade": round(clamp_value(parsed.get("fade", 0), RANGES["fade"]), 3)
    }


def call_openrouter(prompt: str, api_key: str) -> str:
    """Call OpenRouter API using urllib (no external dependencies)"""
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
        "HTTP-Referer": "https://plart.vercel.app",
        "X-Title": "Plart - Plant Photography Filter App"
    }
    
    data = json.dumps({
        "model": MODEL,
        "messages": [
            {
                "role": "system",
                "content": "You are an expert plant photography color grading specialist. Create tasteful, cohesive filters. Always respond with valid JSON only, no markdown formatting."
            },
            {
                "role": "user",
                "content": prompt
            }
        ],
        "temperature": 0.3,
        "max_tokens": 250
    }).encode('utf-8')
    
    req = urllib.request.Request(API_URL, data=data, headers=headers, method='POST')
    
    with urllib.request.urlopen(req, timeout=60) as response:
        result = json.loads(response.read().decode('utf-8'))
        return result["choices"][0]["message"]["content"]


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            # Get API key from environment
            api_key = os.environ.get("OPENROUTER_API_KEY")
            if not api_key:
                self.send_error_response(500, "API key not configured")
                return
            
            # Parse request body
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            data = json.loads(body)
            
            quiz_results = data.get("quizResults", [])
            questions = data.get("questions", [])
            
            if not quiz_results or not questions:
                self.send_error_response(400, "Missing quizResults or questions")
                return
            
            # Build prompt and call API
            prompt = build_prompt(quiz_results, questions)
            gpt_response = call_openrouter(prompt, api_key)
            
            # Parse and validate response
            filter_params = parse_response(gpt_response)
            
            # Send success response
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({"success": True, "filter": filter_params}).encode())
            
        except urllib.error.HTTPError as e:
            error_body = e.read().decode('utf-8')
            try:
                error_data = json.loads(error_body)
                message = error_data.get("error", {}).get("message", str(e))
            except:
                message = str(e)
            self.send_error_response(e.code, message)
        except json.JSONDecodeError as e:
            self.send_error_response(400, f"Invalid JSON: {str(e)}")
        except Exception as e:
            self.send_error_response(500, f"Server error: {str(e)}")
    
    def do_OPTIONS(self):
        """Handle CORS preflight"""
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
    
    def send_error_response(self, status_code: int, message: str):
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps({"success": False, "error": message}).encode())
