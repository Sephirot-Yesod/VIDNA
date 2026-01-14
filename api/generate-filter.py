"""
Generate Filter API - Vercel Serverless Function
Creates filter parameters from quiz answers using GPT-4o via OpenRouter
"""

from http.server import BaseHTTPRequestHandler
import json
import os
import httpx

# OpenRouter API configuration
API_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL = "openai/gpt-4o"


def build_prompt(quiz_results: list, questions: list) -> str:
    """Build the prompt for GPT - Plant Photography Specialist"""
    
    answer_summary = "\n".join([
        f'Q{i+1}: "{q["text"]}" → "{next((opt["label"] for opt in q["options"] if opt["value"] == r["answer"]), r["answer"])}" ({next((opt["description"] for opt in q["options"] if opt["value"] == r["answer"]), "")})'
        for i, (r, q) in enumerate(zip(quiz_results, questions))
    ])
    
    return f"""You are an expert plant photography specialist. Based on the user's answers about their aesthetic preferences, create a great looking photo filter.

USER'S ANSWERS:
{answer_summary}


PARAMETERS (keep subtle, within these ranges):
- brightness: 0.7 to 1.3 (1.0 = no change)
- contrast: 0.7 to 1.3 (1.0 = no change)
- saturation: 0.7 to 1.4 (1.0 = no change)
- temperature: -30 to +30 (0 = neutral, negative = cooler, positive = warmer)
- tint: -20 to +20 (0 = neutral)
- grain: 0 to 0.25 (0 = none)
- vignette: 0 to 0.35 (0 = none)
- fade: 0 to 0.22 (0 = none)


Brightness & Contrast: The foundation. Brightness sets the exposure; Contrast adds "pop" and depth.

Saturation: Controls color intensity. Pro tip: Lower saturation often looks more expensive/cinematic.

Temperature & Tint: The "White Balance." Temperature moves between Blue (Cool) and Yellow (Warm). Tint moves between Green and Magenta.

Fade, Grain & Vignette: The "Texture." These mimic old camera limitations to add character.

Recipe 1: The "Moody Cinematic" Look
This style is popular for street photography, portraits, and travel. It focuses on deep shadows and slightly desaturated colors to draw focus to the subject.

The Vibe: Emotional, dramatic, serious.

The Settings:

Brightness: -10 to -20 (Slightly underexpose to preserve highlights).
Contrast: +15 to +25 (Deepen the shadows).
Saturation: -10 to -20 (Desaturate to remove distracting colors).
Temperature: -5 to -10 (Cooler tones look more modern/cinematic).
Tint: +5 (Adding a slight magenta tint can help skin tones in cool light).
Grain: 0 (Keep it clean).
Vignette: +15 (Draws the eye to the center).
Fade: +10 (Lift the blacks slightly for a "matte" finish).

Recipe 2: The "Vintage Film" Look
This mimics the imperfections of analog film. It's great for casual photos, memories, and outdoor shots.

The Vibe: Nostalgic, warm, soft.

The Settings:

Brightness: +10 (Film often looks slightly overexposed).
Contrast: -10 to -15 (Flattens the image for a softer look).
Saturation: -5 (Film colors are rarely neon-bright).
Temperature: +15 to +25 (Warm/Yellow is key for that "golden hour" feel).
Tint: -5 (A slight shift toward green mimics Fujifilm stocks).
Grain: +25 to +40 (The most important setting here; adds texture).
Vignette: +10 (Subtle lens darkening).
Fade: +30 (Washes out the shadows significantly).

Recipe 3: The "Modern Clean" Look (Influencer Style)
This is the standard "bright and airy" look used for food, product, and lifestyle photography. It makes images look high-definition and happy.

The Vibe: Sharp, energetic, true-to-life.

The Settings:

Brightness: +20 to +30 (Brighten it up significantly).
Contrast: +10 (Adds definition back after brightening).
Saturation: +10 to +15 (Makes colors pop, but don't overdo it).
Temperature: 0 (Or slightly +5 if the original is too blue).
Tint: 0 (Keep colors accurate).
Grain: 0 (Digital clean look).
Vignette: 0 (No dark corners).
Fade: 0 (Keep blacks pure black for sharpness).

In addition, Generate a gentle 2-3 word name.

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


# Parameter ranges for validation
RANGES = {
    "brightness": {"min": 0.85, "max": 1.15},
    "contrast": {"min": 0.85, "max": 1.2},
    "saturation": {"min": 0.7, "max": 1.4},
    "temperature": {"min": -20, "max": 20},
    "tint": {"min": -10, "max": 10},
    "grain": {"min": 0, "max": 0.15},
    "vignette": {"min": 0, "max": 0.35},
    "fade": {"min": 0, "max": 0.12}
}


def clamp_value(value, range_def):
    """Clamp value to valid range"""
    if not isinstance(value, (int, float)) or value != value:  # NaN check
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
            
            # Build prompt
            prompt = build_prompt(quiz_results, questions)
            
            # Call OpenRouter API
            with httpx.Client(timeout=60.0) as client:
                response = client.post(
                    API_URL,
                    headers={
                        "Content-Type": "application/json",
                        "Authorization": f"Bearer {api_key}",
                        "HTTP-Referer": os.environ.get("VERCEL_URL", "https://plart.vercel.app"),
                        "X-Title": "Plart - Plant Photography Filter App"
                    },
                    json={
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
                    }
                )
                
                if response.status_code != 200:
                    error_data = response.json()
                    self.send_error_response(response.status_code, error_data.get("error", {}).get("message", "API request failed"))
                    return
                
                result = response.json()
                gpt_response = result["choices"][0]["message"]["content"]
            
            # Parse and validate response
            filter_params = parse_response(gpt_response)
            
            # Send success response
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({"success": True, "filter": filter_params}).encode())
            
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
