"""
Refine Filter API - Vercel Serverless Function
Adjusts existing filter parameters based on text instructions using GPT-4o
"""

from http.server import BaseHTTPRequestHandler
import json
import os
import httpx

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


def build_refine_prompt(current_params: dict, instruction: str) -> str:
    """Build prompt for filter refinement"""
    return f"""You are a photo filter expert. The user has an existing filter and wants to ADJUST it based on their feedback.

CURRENT FILTER PARAMETERS (these are the starting point):
- brightness: {current_params.get('brightness', 1.0)}
- contrast: {current_params.get('contrast', 1.0)}
- saturation: {current_params.get('saturation', 1.0)}
- temperature: {current_params.get('temperature', 0)}
- tint: {current_params.get('tint', 0)}
- grain: {current_params.get('grain', 0)}
- vignette: {current_params.get('vignette', 0)}
- fade: {current_params.get('fade', 0)}

USER'S ADJUSTMENT REQUEST: "{instruction}"

IMPORTANT: Make INCREMENTAL adjustments to the CURRENT values above. Do NOT start from scratch.
- If they say "warmer", ADD to the current temperature (e.g., {current_params.get('temperature', 0)} + 5 to 15)
- If they say "more contrast", INCREASE from current (e.g., {current_params.get('contrast', 1.0)} + 0.05 to 0.15)
- Only change parameters relevant to their request
- Keep other parameters UNCHANGED from their current values

Parameter ranges for reference:
- brightness: 0.7 to 1.3
- contrast: 0.7 to 1.3  
- saturation: 0.7 to 1.4
- temperature: -30 to +30
- tint: -20 to +20
- grain: 0 to 0.25
- vignette: 0 to 0.35
- fade: 0 to 0.22

Respond ONLY with valid JSON containing the ADJUSTED values:
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
            instruction = data.get("instruction", "")
            
            if not current_params or not instruction:
                self.send_error_response(400, "Missing currentParams or instruction")
                return
            
            # Build prompt
            prompt = build_refine_prompt(current_params, instruction)
            
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
            new_params = parse_response(gpt_response)
            
            # Send success response
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({"success": True, "params": new_params}).encode())
            
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
