/**
 * Filter Engine Module - Plant Photography Edition
 * Uses OpenRouter to generate custom filter parameters from quiz answers
 */

const FilterEngine = (function() {
    // Default filter values (neutral/no effect)
    const defaults = {
        brightness: 1.0,
        contrast: 1.0,
        saturation: 1.0,
        temperature: 0,
        tint: 0,
        grain: 0,
        vignette: 0,
        fade: 0
    };

    // Parameter ranges - subtle, never drastic
    const ranges = {
        brightness: { min: 0.85, max: 1.15 },    // Very subtle brightness
        contrast: { min: 0.85, max: 1.2 },       // Gentle contrast
        saturation: { min: 0.7, max: 1.4 },      // Modest saturation range
        temperature: { min: -20, max: 20 },      // Subtle warm/cool
        tint: { min: -10, max: 10 },             // Minimal tint shifts
        grain: { min: 0, max: 0.15 },            // Light grain only
        vignette: { min: 0, max: 0.35 },         // Subtle vignette
        fade: { min: 0, max: 0.12 }              // Very subtle fade
    };

    // API configuration - OpenRouter
    const API_URL = 'https://openrouter.ai/api/v1/chat/completions';
    const MODEL = 'openai/gpt-4o';

    /**
     * Get API key from config or localStorage fallback
     */
    function getApiKey() {
        if (typeof CONFIG !== 'undefined' && CONFIG.OPENROUTER_API_KEY && CONFIG.OPENROUTER_API_KEY.length > 10) {
            return CONFIG.OPENROUTER_API_KEY;
        }
        return localStorage.getItem('plart_openrouter_key');
    }

    /**
     * Set API key (saves to localStorage as fallback)
     */
    function setApiKey(key) {
        localStorage.setItem('plart_openrouter_key', key);
    }

    /**
     * Check if API key is set
     */
    function hasApiKey() {
        const key = getApiKey();
        return key && key.length > 10;
    }

    /**
     * Check if key is from config file
     */
    function isKeyFromConfig() {
        return typeof CONFIG !== 'undefined' && CONFIG.OPENROUTER_API_KEY && CONFIG.OPENROUTER_API_KEY.length > 10;
    }

    /**
     * Build the prompt for GPT - Plant Photography Specialist
     */
    function buildPrompt(quizResults, questions) {
        const answerSummary = quizResults.map((result, index) => {
            const question = questions[index];
            const selectedOption = question.options.find(opt => opt.value === result.answer);
            return `Q${index + 1}: "${question.text}" → "${selectedOption.label}" (${selectedOption.description})`;
        }).join('\n');

        return `You are an expert plant photography specialist. Based on the user's answers about their aesthetic preferences, create a great looking photo filter.

USER'S ANSWERS:
${answerSummary}


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
This mimics the imperfections of analog film. It’s great for casual photos, memories, and outdoor shots.

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
{
  "name": "Filter Name",
  "brightness": 1.0,
  "contrast": 1.0,
  "saturation": 1.0,
  "temperature": 0,
  "tint": 0,
  "grain": 0,
  "vignette": 0,
  "fade": 0
}`;
    }

    /**
     * Call OpenRouter API to generate filter
     */
    async function callGPT(prompt) {
        const apiKey = getApiKey();
        
        if (!apiKey) {
            throw new Error('API key not set');
        }

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': window.location.origin,
                'X-Title': 'Plart - Plant Photography Filter App'
            },
            body: JSON.stringify({
                model: MODEL,
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert plant photography color grading specialist. Create tasteful, cohesive filters. Always respond with valid JSON only, no markdown formatting.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.3,  // Conservative, consistent outputs
                max_tokens: 250
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'API request failed');
        }

        const data = await response.json();
        return data.choices[0].message.content;
    }

    /**
     * Parse and validate GPT response
     */
    function parseGPTResponse(responseText) {
        let cleaned = responseText.trim();
        if (cleaned.startsWith('```')) {
            cleaned = cleaned.replace(/```json?\n?/g, '').replace(/```/g, '');
        }

        const parsed = JSON.parse(cleaned);

        const filter = {
            name: parsed.name || 'Botanical Custom',
            brightness: clampValue(parsed.brightness, ranges.brightness),
            contrast: clampValue(parsed.contrast, ranges.contrast),
            saturation: clampValue(parsed.saturation, ranges.saturation),
            temperature: clampValue(parsed.temperature, ranges.temperature),
            tint: clampValue(parsed.tint, ranges.tint),
            grain: clampValue(parsed.grain, ranges.grain),
            vignette: clampValue(parsed.vignette, ranges.vignette),
            fade: clampValue(parsed.fade, ranges.fade)
        };

        return filter;
    }

    /**
     * Clamp value to valid range
     */
    function clampValue(value, range) {
        if (typeof value !== 'number' || isNaN(value)) {
            return (range.min + range.max) / 2;
        }
        return Math.max(range.min, Math.min(range.max, value));
    }

    /**
     * Calculate filter parameters from quiz results using GPT
     */
    async function calculateFilter(quizResults, questions) {
        const prompt = buildPrompt(quizResults, questions);
        
        console.log('=== QUIZ ANSWERS ===');
        quizResults.forEach((r, i) => {
            const q = questions[i];
            const selected = q.options.find(o => o.value === r.answer);
            console.log(`Q${i + 1}: ${selected?.label || r.answer}`);
        });
        
        try {
            const response = await callGPT(prompt);
            const filter = parseGPTResponse(response);
            
            // Round values for cleaner display
            filter.brightness = Math.round(filter.brightness * 100) / 100;
            filter.contrast = Math.round(filter.contrast * 100) / 100;
            filter.saturation = Math.round(filter.saturation * 100) / 100;
            filter.temperature = Math.round(filter.temperature);
            filter.tint = Math.round(filter.tint);
            filter.grain = Math.round(filter.grain * 1000) / 1000;
            filter.vignette = Math.round(filter.vignette * 100) / 100;
            filter.fade = Math.round(filter.fade * 1000) / 1000;

            // Log the generated filter
            console.log('=== GENERATED FILTER ===');
            console.log(`Name: ${filter.name}`);
            console.log(`Brightness: ${filter.brightness}`);
            console.log(`Contrast: ${filter.contrast}`);
            console.log(`Saturation: ${filter.saturation}`);
            console.log(`Temperature: ${filter.temperature}`);
            console.log(`Tint: ${filter.tint}`);
            console.log(`Grain: ${filter.grain}`);
            console.log(`Vignette: ${filter.vignette}`);
            console.log(`Fade: ${filter.fade}`);
            console.log('========================');

            return filter;
        } catch (error) {
            console.error('GPT filter generation failed:', error);
            throw error;
        }
    }

    /**
     * Fallback: Calculate filter using deterministic algorithm
     * Based on 5 questions about light, mood, and photography preferences
     */
    function calculateFilterFallback(quizResults) {
        const answers = quizResults.map(r => r.answer);
        
        const light = answers[0];      // 1=morning soft, 2=bright sunny, 3=afternoon warm, 4=overcast
        const feeling = answers[1];    // 1=quiet, 2=calm alive, 3=fresh energetic, 4=low-key
        const background = answers[2]; // 1-4, higher = wants more focus
        const moment = answers[3];     // 1=new growth, 2=textures, 3=balanced, 4=change
        const comfort = answers[4];    // 1=soft, 2=clean, 3=bright colors, 4=subtle

        // Moderate intensity for natural results
        const intensity = 0.7;

        // Temperature based on light preference
        let temperature = 0;
        if (light === 1) temperature = 8;       // Morning = slightly warm
        else if (light === 2) temperature = 0;  // Midday = neutral
        else if (light === 3) temperature = 12; // Afternoon = warm
        else if (light === 4) temperature = -5; // Overcast = slightly cool

        // Brightness and contrast based on feeling
        let brightness = 1.0;
        let contrast = 1.0;
        if (feeling === 1) { brightness = 0.95; contrast = 0.92; }      // Quiet
        else if (feeling === 2) { brightness = 1.02; contrast = 1.0; }  // Calm alive
        else if (feeling === 3) { brightness = 1.08; contrast = 1.05; } // Fresh energetic
        else if (feeling === 4) { brightness = 0.98; contrast = 0.95; } // Low-key

        // Saturation based on comfort preference
        let saturation = 1.0;
        if (comfort === 1) saturation = 0.9;       // Soft
        else if (comfort === 2) saturation = 1.0;  // Clean
        else if (comfort === 3) saturation = 1.15; // Bright colors
        else if (comfort === 4) saturation = 0.85; // Subtle

        // Vignette based on background preference
        const vignette = (background - 1) * 0.08;

        // Contrast boost for texture lovers
        if (moment === 2) contrast += 0.05;

        return {
            name: 'Natural Light',
            brightness: 1 + (brightness - 1) * intensity,
            contrast: 1 + (contrast - 1) * intensity,
            saturation: 1 + (saturation - 1) * intensity,
            temperature: temperature * intensity,
            tint: 0,
            grain: 0,
            vignette: vignette * intensity,
            fade: feeling === 4 ? 0.05 * intensity : 0
        };
    }

    /**
     * Generate a CSS filter string for basic filters
     */
    function toCSSFilter(filter) {
        const parts = [];
        
        if (filter.brightness !== 1.0) {
            parts.push(`brightness(${filter.brightness})`);
        }
        if (filter.contrast !== 1.0) {
            parts.push(`contrast(${filter.contrast})`);
        }
        if (filter.saturation !== 1.0) {
            parts.push(`saturate(${filter.saturation})`);
        }
        
        // Temperature approximation
        if (filter.temperature > 0) {
            const sepiaAmount = Math.min(filter.temperature / 80, 0.4);
            parts.push(`sepia(${sepiaAmount})`);
        } else if (filter.temperature < 0) {
            const hueAmount = filter.temperature * 0.4;
            parts.push(`hue-rotate(${hueAmount}deg)`);
        }

        return parts.length > 0 ? parts.join(' ') : 'none';
    }

    /**
     * Generate a human-readable filter name based on parameters
     */
    function generateFilterName(filter) {
        if (filter.name && filter.name !== 'Custom Filter' && filter.name !== 'Botanical Custom') {
            return filter.name;
        }

        const descriptors = [];

        if (filter.brightness > 1.3) descriptors.push('Luminous');
        else if (filter.brightness < 0.7) descriptors.push('Shadow');

        if (filter.saturation > 1.6) descriptors.push('Lush');
        else if (filter.saturation < 0.5) descriptors.push('Muted');

        if (filter.temperature > 20) descriptors.push('Golden');
        else if (filter.temperature < -20) descriptors.push('Forest');

        if (filter.grain > 0.2) descriptors.push('Film');
        if (filter.vignette > 0.5) descriptors.push('Focused');
        if (filter.fade > 0.2) descriptors.push('Faded');

        if (descriptors.length === 0) {
            return 'Natural Botanical';
        } else if (descriptors.length === 1) {
            return `${descriptors[0]} Leaf`;
        } else {
            return `${descriptors[0]} ${descriptors[1]}`;
        }
    }

    /**
     * Get parameter display info
     */
    function getParameterDisplay(filter) {
        return [
            { 
                name: 'Brightness', 
                value: filter.brightness,
                displayValue: `${Math.round((filter.brightness - 1) * 100)}%`,
                icon: '☀️'
            },
            { 
                name: 'Contrast', 
                value: filter.contrast,
                displayValue: `${Math.round((filter.contrast - 1) * 100)}%`,
                icon: '◐'
            },
            { 
                name: 'Saturation', 
                value: filter.saturation,
                displayValue: `${Math.round((filter.saturation - 1) * 100)}%`,
                icon: '🌿'
            },
            { 
                name: 'Temperature', 
                value: filter.temperature,
                displayValue: filter.temperature > 0 ? `+${filter.temperature}` : `${filter.temperature}`,
                icon: filter.temperature >= 0 ? '🌅' : '🌲'
            },
            { 
                name: 'Tint', 
                value: filter.tint,
                displayValue: filter.tint > 0 ? `+${filter.tint}` : `${filter.tint}`,
                icon: '🌸'
            },
            { 
                name: 'Grain', 
                value: filter.grain,
                displayValue: `${Math.round(filter.grain * 100)}%`,
                icon: '📽️'
            },
            { 
                name: 'Vignette', 
                value: filter.vignette,
                displayValue: `${Math.round(filter.vignette * 100)}%`,
                icon: '🎯'
            },
            { 
                name: 'Fade', 
                value: filter.fade,
                displayValue: `${Math.round(filter.fade * 100)}%`,
                icon: '🌫️'
            }
        ];
    }

    // Public API
    return {
        calculateFilter,
        calculateFilterFallback,
        toCSSFilter,
        generateFilterName,
        getParameterDisplay,
        getApiKey,
        setApiKey,
        hasApiKey,
        isKeyFromConfig,
        defaults,
        ranges
    };
})();
