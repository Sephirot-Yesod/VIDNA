/**
 * Filter Engine Module - Plant Photography Edition
 * Calls backend API for LLM-powered filter generation
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

    // Parameter ranges - expanded for creative freedom
    const ranges = {
        brightness: { min: 0.6, max: 1.5 },
        contrast: { min: 0.6, max: 1.5 },
        saturation: { min: 0.3, max: 1.8 },
        temperature: { min: -40, max: 40 },
        tint: { min: -25, max: 25 },
        grain: { min: 0, max: 0.4 },
        vignette: { min: 0, max: 0.6 },
        fade: { min: 0, max: 0.35 }
    };

    // API endpoints (relative URLs for Vercel serverless functions)
    const API_ENDPOINTS = {
        generateFilter: '/api/generate-filter',
        refineFilter: '/api/refine-filter',
        matchStyle: '/api/match-style'
    };

    /**
     * Get the base URL for API calls
     * In development, this might need to be adjusted
     */
    function getApiBaseUrl() {
        // Use relative URLs - works both locally and on Vercel
        return '';
    }

    /**
     * Make API call with retry logic
     */
    async function callApi(endpoint, body, retries = 2) {
        const url = getApiBaseUrl() + endpoint;
        let lastError;

        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                if (attempt > 0) {
                    console.log(`Retry attempt ${attempt}/${retries}...`);
                    await new Promise(r => setTimeout(r, 1000 * attempt));
                }

                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(body)
                });

                const data = await response.json();

                if (!response.ok || !data.success) {
                    throw new Error(data.error || `API request failed (${response.status})`);
                }

                return data;

            } catch (error) {
                lastError = error;
                console.error(`API call attempt ${attempt + 1} failed:`, error.message);

                // Don't retry on auth errors
                if (error.message.includes('401') || error.message.includes('403')) {
                    throw error;
                }
            }
        }

        throw lastError;
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
     * Ensure filter params are valid
     */
    function ensureValidParams(params) {
        return {
            name: params.name || 'Custom Filter',
            brightness: clampValue(params.brightness, ranges.brightness),
            contrast: clampValue(params.contrast, ranges.contrast),
            saturation: clampValue(params.saturation, ranges.saturation),
            temperature: clampValue(params.temperature, ranges.temperature),
            tint: clampValue(params.tint, ranges.tint),
            grain: clampValue(params.grain, ranges.grain),
            vignette: clampValue(params.vignette, ranges.vignette),
            fade: clampValue(params.fade, ranges.fade)
        };
    }

    /**
     * Calculate filter parameters from quiz results using backend API
     */
    async function calculateFilter(quizResults, questions) {
        console.log('=== QUIZ ANSWERS ===');
        quizResults.forEach((r, i) => {
            const q = questions[i];
            const selected = q.options.find(o => o.value === r.answer);
            console.log(`Q${i + 1}: ${selected?.label || r.answer}`);
        });

        try {
            const data = await callApi(API_ENDPOINTS.generateFilter, {
                quizResults: quizResults,
                questions: questions.map(q => ({
                    text: q.text,
                    options: q.options.map(o => ({
                        value: o.value,
                        label: o.label,
                        description: o.description
                    }))
                }))
            });

            const filter = ensureValidParams(data.filter);

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
            console.error('Filter generation failed:', error);
            // Fall back to deterministic algorithm
            console.log('Falling back to deterministic filter generation...');
            return calculateFilterFallback(quizResults);
        }
    }

    /**
     * Fallback: Calculate filter using deterministic algorithm
     */
    function calculateFilterFallback(quizResults) {
        const answers = quizResults.map(r => r.answer);

        const light = answers[0];
        const feeling = answers[1];
        const background = answers[2];
        const moment = answers[3];
        const comfort = answers[4];

        const intensity = 0.7;

        let temperature = 0;
        if (light === 1) temperature = 8;
        else if (light === 2) temperature = 0;
        else if (light === 3) temperature = 12;
        else if (light === 4) temperature = -5;

        let brightness = 1.0;
        let contrast = 1.0;
        if (feeling === 1) { brightness = 0.95; contrast = 0.92; }
        else if (feeling === 2) { brightness = 1.02; contrast = 1.0; }
        else if (feeling === 3) { brightness = 1.08; contrast = 1.05; }
        else if (feeling === 4) { brightness = 0.98; contrast = 0.95; }

        let saturation = 1.0;
        if (comfort === 1) saturation = 0.9;
        else if (comfort === 2) saturation = 1.0;
        else if (comfort === 3) saturation = 1.15;
        else if (comfort === 4) saturation = 0.85;

        const vignette = (background - 1) * 0.08;

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
     * Refine an existing filter based on text instructions using backend API
     */
    async function refineFilterWithText(currentParams, instruction) {
        try {
            const data = await callApi(API_ENDPOINTS.refineFilter, {
                currentParams: currentParams,
                instruction: instruction
            });

            const newParams = ensureValidParams(data.params);

            console.log('=== REFINED FILTER ===');
            console.log('Instruction:', instruction);
            console.log('Original params:', currentParams);
            console.log('Adjusted params:', newParams);
            console.log('======================');

            return newParams;
        } catch (error) {
            console.error('Filter refinement failed:', error);
            throw error;
        }
    }

    /**
     * Analyze an image and adjust current filter parameters to incorporate its style
     * Uses backend API with GPT-4o Vision
     */
    async function matchImageStyle(base64Image, currentParams = null) {
        const params = currentParams || {
            brightness: 1.0,
            contrast: 1.0,
            saturation: 1.0,
            temperature: 0,
            tint: 0,
            grain: 0,
            vignette: 0,
            fade: 0
        };

        try {
            const data = await callApi(API_ENDPOINTS.matchStyle, {
                currentParams: params,
                image: base64Image
            });

            const newParams = ensureValidParams(data.params);

            console.log('=== IMAGE STYLE MATCH ===');
            console.log('Original params:', params);
            console.log('Blended params:', newParams);
            console.log('=========================');

            return newParams;
        } catch (error) {
            console.error('Image style matching failed:', error);
            throw error;
        }
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

    // Legacy API key functions - kept for backwards compatibility but no longer used
    function getApiKey() {
        console.warn('getApiKey() is deprecated - API calls now go through backend');
        return null;
    }

    function setApiKey(key) {
        console.warn('setApiKey() is deprecated - API key is now stored on backend');
    }

    function hasApiKey() {
        // Always return true since API key is on backend
        return true;
    }

    function isKeyFromConfig() {
        // Always return true since API key is on backend
        return true;
    }

    // Public API
    return {
        calculateFilter,
        calculateFilterFallback,
        refineFilterWithText,
        matchImageStyle,
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
