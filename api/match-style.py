"""
Match Style API - Vercel Serverless Function
Analyzes a reference image and adjusts filter parameters to match its style using GPT-4o Vision
"""

from http.server import BaseHTTPRequestHandler
import json
import os
import urllib.request
import urllib.error

# OpenRouter API configuration
API_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL = "openai/gpt-4o"

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
    if not isinstance(value, (int, float)) or value != value:
        return (range_def["min"] + range_def["max"]) / 2
    return max(range_def["min"], min(range_def["max"], value))


def build_vision_prompt(current_params: dict) -> str:
    """Build prompt for image style matching"""
    return f"""Analyze this reference image's color grading, mood, and visual style. Then ADJUST the user's current filter to incorporate elements of this style.

CURRENT FILTER PARAMETERS (starting point):
- brightness: {current_params.get('brightness', 1.0)}
- contrast: {current_params.get('contrast', 1.0)}
- saturation: {current_params.get('saturation', 1.0)}
- temperature: {current_params.get('temperature', 0)}
- tint: {current_params.get('tint', 0)}
- grain: {current_params.get('grain', 0)}
- vignette: {current_params.get('vignette', 0)}
- fade: {current_params.get('fade', 0)}

Analyze the reference image for:
- Overall brightness and exposure
- Color temperature (warm/cool)
- Saturation levels
- Contrast and tonal range
- Any vintage/film effects (grain, fade)
- Vignetting

IMPORTANT: Make INCREMENTAL adjustments to blend the reference image's style INTO the current filter.
- Don't completely replace the current values
- Shift parameters TOWARD the reference style by 30-60% of the difference
- Preserve some of the original filter's character

Parameter ranges:
- brightness: 0.7 to 1.3
- contrast: 0.7 to 1.3
- saturation: 0.7 to 1.4
- temperature: -30 to +30
- tint: -20 to +20
- grain: 0 to 0.25
- vignette: 0 to 0.35
- fade: 0 to 0.22

Respond ONLY with valid JSON:
{{
  "brightness": {current_params.get('brightness', 1.0)},
  "contrast": {current_params.get('contrast', 1.0)},
  "saturation": {current_params.get('saturation', 1.0)},
  "temperature": {current_params.get('temperature', 0)},
  "tint": {current_params.get('tint', 0)},
  "grain": {current_params.get('grain', 0)},
  "vignette": {current_params.get('vignette', 0)},
  "fade": {current_params.get('fade', 0)}
}}"""


def parse_response(response_text: str) -> dict:
    """Parse and validate GPT response"""
    cleaned = response_text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.replace("```json", "").replace("```", "").strip()
    
    parsed = json.loads(cleaned)
    
    return {
        "brightness": round(clamp_value(parsed.get("brightness", 1.0), RANGES["brightness"]), 2),
        "contrast": round(clamp_value(parsed.get("contrast", 1.0), RANGES["contrast"]), 2),
        "saturation": round(clamp_value(parsed.get("saturation", 1.0), RANGES["saturation"]), 2),
        "temperature": round(clamp_value(parsed.get("temperature", 0), RANGES["temperature"])),
        "tint": round(clamp_value(parsed.get("tint", 0), RANGES["tint"])),
        "grain": round(clamp_value(parsed.get("grain", 0), RANGES["grain"]), 3),
        "vignette": round(clamp_value(parsed.get("vignette", 0), RANGES["vignette"]), 2),
        "fade": round(clamp_value(parsed.get("fade", 0), RANGES["fade"]), 3)
    }


def call_openrouter_vision(prompt: str, base64_image: str, api_key: str) -> str:
    """Call OpenRouter API with vision using urllib"""
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
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": base64_image}}
                ]
            }
        ],
        "temperature": 0.3,
        "max_tokens": 300
    }).encode('utf-8')
    
    req = urllib.request.Request(API_URL, data=data, headers=headers, method='POST')
    
    with urllib.request.urlopen(req, timeout=90) as response:
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
            
            current_params = data.get("currentParams", {})
            base64_image = data.get("image", "")
            
            if not base64_image:
                self.send_error_response(400, "Missing image")
                return
            
            # Default params if none provided
            if not current_params:
                current_params = {
                    "brightness": 1.0,
                    "contrast": 1.0,
                    "saturation": 1.0,
                    "temperature": 0,
                    "tint": 0,
                    "grain": 0,
                    "vignette": 0,
                    "fade": 0
                }
            
            # Build prompt and call API
            prompt = build_vision_prompt(current_params)
            gpt_response = call_openrouter_vision(prompt, base64_image, api_key)
            
            # Parse and validate response
            new_params = parse_response(gpt_response)
            
            # Send success response
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({"success": True, "params": new_params}).encode())
            
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
