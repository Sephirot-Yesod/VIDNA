# VIDNA API Documentation

This document describes the REST API endpoints for the VIDNA photo filter application.

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Error Handling](#error-handling)
- [API Endpoints](#api-endpoints)
  - [Filter Generation](#filter-generation)
  - [Filter Refinement](#filter-refinement)
  - [Style Matching](#style-matching)
- [Filter Parameters](#filter-parameters)
- [Supabase Integration](#supabase-integration)
- [Development](#development)

---

## Overview

### Base URL

- **Production**: `https://vidna.vercel.app`
- **Development**: `http://localhost:3000`

All API paths are prefixed with `/api`.

### Request Format

- **Content-Type**: `application/json`
- **Character Encoding**: UTF-8

### Response Format

All responses are JSON format:

```json
{
  "success": true,
  "data": { ... }
}
```

Or on error:

```json
{
  "success": false,
  "error": "Error description"
}
```

---

## Authentication

### Current Implementation

The filter generation APIs do not require authentication. User authentication and filter storage are handled by Supabase on the client side.

### Future Consideration

For production deployments with rate limiting, consider adding JWT authentication similar to the plantie project.

---

## Error Handling

### HTTP Status Codes

| Code | Description |
|------|-------------|
| `200 OK` | Request successful |
| `400 Bad Request` | Invalid request parameters |
| `401 Unauthorized` | Authentication required (future) |
| `500 Internal Server Error` | Server error or API failure |

### Common Error Scenarios

- **API Key Not Configured**: Returns `500` with message "API key not configured"
- **Missing Parameters**: Returns `400` with specific field name
- **OpenRouter API Failure**: Returns the upstream error code and message
- **JSON Parse Error**: Returns `400` with "Invalid JSON" message

---

## API Endpoints

### Filter Generation

#### Generate Filter from Quiz

**Endpoint**: `POST /api/generate-filter`

**Description**: Generate photo filter parameters based on personality quiz answers using Google Gemini 3 Pro.

**Request Body**:

```json
{
  "quizResults": [
    { "questionId": 1, "answer": 2 },
    { "questionId": 2, "answer": 1 },
    { "questionId": 3, "answer": 3 },
    { "questionId": 4, "answer": 2 },
    { "questionId": 5, "answer": 3 }
  ],
  "questions": [
    {
      "text": "You walk into a crowded room full of strangers. What is your immediate instinct?",
      "options": [
        { "value": 1, "label": "Step into the center and introduce myself", "description": "Open and inviting" },
        { "value": 2, "label": "Find a quiet corner and observe", "description": "Private and thoughtful" },
        { "value": 3, "label": "Find one interesting person for deep conversation", "description": "Focused connection" }
      ]
    }
  ]
}
```

**Response** (200 OK):

```json
{
  "success": true,
  "filter": {
    "name": "Soft Autumn",
    "brightness": 0.98,
    "contrast": 0.95,
    "saturation": 0.88,
    "temperature": 12,
    "tint": -2,
    "grain": 0.08,
    "vignette": 0.15,
    "fade": 0.05
  }
}
```

**Error Response**:

```json
{
  "success": false,
  "error": "Missing quizResults or questions"
}
```

**Example**:

```bash
curl -X POST https://vidna.vercel.app/api/generate-filter \
  -H "Content-Type: application/json" \
  -d '{
    "quizResults": [{"questionId": 1, "answer": 2}],
    "questions": [{"text": "Question 1", "options": [{"value": 1, "label": "A", "description": "Desc A"}, {"value": 2, "label": "B", "description": "Desc B"}]}]
  }'
```

---

### Filter Refinement

#### Refine Filter with Text Instructions

**Endpoint**: `POST /api/refine-filter`

**Description**: Adjust existing filter parameters based on natural language instructions using Google Gemini 3 Pro.

**Request Body**:

```json
{
  "currentParams": {
    "brightness": 1.0,
    "contrast": 1.0,
    "saturation": 1.0,
    "temperature": 0,
    "tint": 0,
    "grain": 0,
    "vignette": 0,
    "fade": 0
  },
  "instruction": "make it warmer and more contrasty"
}
```

**Response** (200 OK):

```json
{
  "success": true,
  "params": {
    "brightness": 1.02,
    "contrast": 1.12,
    "saturation": 1.0,
    "temperature": 15,
    "tint": 0,
    "grain": 0,
    "vignette": 0,
    "fade": 0
  }
}
```

**Supported Instructions**:

| Instruction | Affected Parameters |
|-------------|---------------------|
| "warmer" / "cooler" | temperature |
| "brighter" / "darker" | brightness |
| "more contrast" / "less contrast" | contrast |
| "more saturated" / "less saturated" | saturation |
| "more vintage" / "film look" | grain, fade |
| "add vignette" | vignette |
| "softer" | contrast (decrease) |

**Example**:

```bash
curl -X POST https://vidna.vercel.app/api/refine-filter \
  -H "Content-Type: application/json" \
  -d '{
    "currentParams": {"brightness": 1.0, "contrast": 1.0, "saturation": 1.0, "temperature": 0, "tint": 0, "grain": 0, "vignette": 0, "fade": 0},
    "instruction": "make it look like a vintage film photo"
  }'
```

---

### Style Matching

#### Match Image Style

**Endpoint**: `POST /api/match-style`

**Description**: Analyze a reference image and adjust filter parameters to match its visual style using Google Gemini 3 Pro Vision.

**Request Body**:

```json
{
  "currentParams": {
    "brightness": 1.0,
    "contrast": 1.0,
    "saturation": 1.0,
    "temperature": 0,
    "tint": 0,
    "grain": 0,
    "vignette": 0,
    "fade": 0
  },
  "image": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAA..."
}
```

**Field Descriptions**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `currentParams` | object | No | Current filter parameters (defaults to neutral if omitted) |
| `image` | string | Yes | Base64-encoded image with data URL prefix |

**Response** (200 OK):

```json
{
  "success": true,
  "params": {
    "brightness": 1.05,
    "contrast": 0.92,
    "saturation": 0.85,
    "temperature": 18,
    "tint": -3,
    "grain": 0.12,
    "vignette": 0.08,
    "fade": 0.1
  }
}
```

**Notes**:

- Image should be JPEG or PNG format
- Maximum recommended image size: 2MB (larger images will work but increase latency)
- The API blends the reference style with current parameters (30-60% adjustment)
- Processing time: 3-10 seconds depending on image size

**Example**:

```bash
# First, convert image to base64
BASE64_IMAGE=$(base64 -i reference.jpg)

curl -X POST https://vidna.vercel.app/api/match-style \
  -H "Content-Type: application/json" \
  -d "{
    \"currentParams\": {\"brightness\": 1.0, \"contrast\": 1.0, \"saturation\": 1.0, \"temperature\": 0, \"tint\": 0, \"grain\": 0, \"vignette\": 0, \"fade\": 0},
    \"image\": \"data:image/jpeg;base64,${BASE64_IMAGE}\"
  }"
```

---

## Filter Parameters

### Parameter Reference

| Parameter | Type | Range | Default | Description |
|-----------|------|-------|---------|-------------|
| `brightness` | float | 0.6 - 1.5 | 1.0 | Image brightness (1.0 = no change) |
| `contrast` | float | 0.6 - 1.5 | 1.0 | Tonal contrast (1.0 = no change) |
| `saturation` | float | 0.3 - 1.8 | 1.0 | Color intensity (1.0 = no change) |
| `temperature` | int | -40 to +40 | 0 | Color temperature (negative = cool, positive = warm) |
| `tint` | int | -25 to +25 | 0 | Green/Magenta shift (negative = green, positive = magenta) |
| `grain` | float | 0 - 0.4 | 0 | Film grain overlay intensity |
| `vignette` | float | 0 - 0.6 | 0 | Edge darkening intensity |
| `fade` | float | 0 - 0.35 | 0 | Black level lift (matte effect) |

### Parameter Effects

```
Brightness & Contrast
├── brightness: Overall exposure
└── contrast: Distance from middle gray

Color
├── saturation: Color intensity
├── temperature: Warm (orange) ↔ Cool (blue)
└── tint: Magenta ↔ Green

Texture
├── grain: Film noise overlay
├── vignette: Dark edges
└── fade: Lifted blacks (matte look)
```

### Example Filter Presets

**Moody Cinematic**:
```json
{
  "brightness": 0.92,
  "contrast": 1.15,
  "saturation": 0.85,
  "temperature": -8,
  "tint": 3,
  "grain": 0,
  "vignette": 0.2,
  "fade": 0.08
}
```

**Vintage Film**:
```json
{
  "brightness": 1.05,
  "contrast": 0.9,
  "saturation": 0.92,
  "temperature": 15,
  "tint": -3,
  "grain": 0.12,
  "vignette": 0.1,
  "fade": 0.1
}
```

**Modern Clean**:
```json
{
  "brightness": 1.1,
  "contrast": 1.05,
  "saturation": 1.1,
  "temperature": 3,
  "tint": 0,
  "grain": 0,
  "vignette": 0,
  "fade": 0
}
```

---

## Supabase Integration

### Overview

User authentication and filter storage are handled by Supabase on the client side.

### Database Schema

```sql
-- Filters table
CREATE TABLE filters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  params JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE filters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own filters"
  ON filters
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### Client-Side Usage

```javascript
// Save filter
const { data, error } = await supabase
  .from('filters')
  .insert({
    user_id: user.id,
    name: filter.name,
    params: filter
  });

// Get user's filters
const { data, error } = await supabase
  .from('filters')
  .select('*')
  .eq('user_id', user.id)
  .order('created_at', { ascending: false });

// Update filter
const { data, error } = await supabase
  .from('filters')
  .update({ params: newParams, updated_at: new Date() })
  .eq('id', filterId);

// Delete filter
const { data, error } = await supabase
  .from('filters')
  .delete()
  .eq('id', filterId);
```

---

## Development

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENROUTER_API_KEY` | Yes | OpenRouter API key for Gemini 3 Pro access |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | Supabase anonymous/public key |

### Local Development

```bash
# Install dependencies
npm install

# Create .env file
cp .env.example .env
# Edit .env with your API keys

# Run build script
npm run build

# Start local server
npx serve -l 3000
```

### Testing API Endpoints

```bash
# Test generate-filter
curl -X POST http://localhost:3000/api/generate-filter \
  -H "Content-Type: application/json" \
  -d '{"quizResults": [...], "questions": [...]}'

# Test refine-filter
curl -X POST http://localhost:3000/api/refine-filter \
  -H "Content-Type: application/json" \
  -d '{"currentParams": {...}, "instruction": "make it warmer"}'
```

### Vercel Deployment

1. Push to GitHub
2. Connect repository to Vercel
3. Add environment variables in Vercel dashboard:
   - `OPENROUTER_API_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
4. Deploy

### Rate Limits

| Endpoint | Timeout | Notes |
|----------|---------|-------|
| `/api/generate-filter` | 90s | Reasoning model, may take 10-30s |
| `/api/refine-filter` | 90s | Reasoning model, usually 5-15s |
| `/api/match-style` | 120s | Vision + reasoning, 10-30s depending on image |

---

## Version Information

- **Document Version**: 1.1.0
- **API Version**: 1.1.0
- **Last Updated**: 2026-01-14
- **AI Model**: `google/gemini-3-pro-preview` via [OpenRouter](https://openrouter.ai/google/gemini-3-pro-preview)

---

## Contact

For issues or questions, please open a GitHub issue on [VIDNA](https://github.com/Sephirot-Yesod/VIDNA).
