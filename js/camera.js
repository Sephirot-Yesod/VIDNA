/**
 * Camera Module
 * Handles WebRTC camera access, live filter preview, and photo capture
 * All filters are applied via canvas for consistent preview and capture
 */

const Camera = (function() {
    // State
    let stream = null;
    let currentFilter = null;
    let facingMode = 'user';
    let animationFrameId = null;
    let isCapturing = false;

    // DOM Elements
    let elements = {};

    // Grain noise canvas (pre-generated for performance)
    let noiseCanvas = null;
    let noiseCtx = null;

    // Temporal smoothing for noise reduction
    let previousFrameData = null;
    let smoothingEnabled = true;
    const SMOOTHING_FACTOR = 0.15; // Blend 15% of previous frame for noise reduction

    /**
     * Initialize the camera module
     */
    function init() {
        elements = {
            video: document.getElementById('camera-feed'),
            filterCanvas: document.getElementById('filter-canvas'),
            captureCanvas: document.getElementById('capture-canvas'),
            paramsPanel: document.getElementById('filter-params-panel'),
            paramsList: document.getElementById('params-list'),
            filterName: document.getElementById('filter-name')
        };

        // Create noise canvas for grain effect
        createNoiseCanvas();
    }

    /**
     * Create a pre-generated noise texture for grain effect
     */
    function createNoiseCanvas() {
        noiseCanvas = document.createElement('canvas');
        noiseCanvas.width = 256;
        noiseCanvas.height = 256;
        noiseCtx = noiseCanvas.getContext('2d');
        
        const imageData = noiseCtx.createImageData(256, 256);
        const data = imageData.data;
        
        for (let i = 0; i < data.length; i += 4) {
            const noise = Math.random() * 255;
            data[i] = noise;
            data[i + 1] = noise;
            data[i + 2] = noise;
            data[i + 3] = 255;
        }
        
        noiseCtx.putImageData(imageData, 0, 0);
    }

    /**
     * Start the camera with optimized settings for iOS/mobile
     */
    async function start() {
        try {
            // Optimized constraints for better quality on iOS
            const constraints = {
                video: {
                    facingMode: facingMode,
                    width: { ideal: 1920, min: 1280 },
                    height: { ideal: 1080, min: 720 },
                    // iOS and modern browsers support these for better quality
                    frameRate: { ideal: 30, max: 30 },
                    // Advanced constraints for noise reduction
                    advanced: [
                        { exposureMode: 'continuous' },
                        { focusMode: 'continuous' },
                        { whiteBalanceMode: 'continuous' }
                    ]
                },
                audio: false
            };

            // Try with advanced constraints first
            try {
                stream = await navigator.mediaDevices.getUserMedia(constraints);
            } catch (advancedError) {
                // Fallback to simpler constraints if advanced not supported
                console.log('Advanced constraints not supported, using basic');
                stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: facingMode,
                        width: { ideal: 1920 },
                        height: { ideal: 1080 }
                    },
                    audio: false
                });
            }

            elements.video.srcObject = stream;

            // Apply iOS-specific video element optimizations
            elements.video.setAttribute('playsinline', 'true');
            elements.video.setAttribute('autoplay', 'true');
            elements.video.setAttribute('muted', 'true');

            await new Promise((resolve) => {
                elements.video.onloadedmetadata = () => {
                    elements.video.play();
                    resolve();
                };
            });

            // Log actual video resolution
            console.log('Camera started:', elements.video.videoWidth, 'x', elements.video.videoHeight);

            // Reset noise reduction state
            previousFrameData = null;

            setupCanvases();
            startRenderLoop();

            return true;
        } catch (error) {
            console.error('Camera access error:', error);
            return false;
        }
    }

    /**
     * Stop the camera
     */
    function stop() {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }

        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
        }

        elements.video.srcObject = null;
        previousFrameData = null; // Clear smoothing buffer
    }

    /**
     * Toggle noise reduction / temporal smoothing
     */
    function toggleSmoothing() {
        smoothingEnabled = !smoothingEnabled;
        previousFrameData = null;
        console.log('Noise reduction:', smoothingEnabled ? 'enabled' : 'disabled');
        return smoothingEnabled;
    }

    /**
     * Flip between front and back camera
     */
    async function flip() {
        facingMode = facingMode === 'user' ? 'environment' : 'user';
        stop();
        await start();
    }

    /**
     * Set up canvas dimensions to match video
     */
    function setupCanvases() {
        const video = elements.video;
        const width = video.videoWidth;
        const height = video.videoHeight;

        elements.filterCanvas.width = width;
        elements.filterCanvas.height = height;
        elements.captureCanvas.width = width;
        elements.captureCanvas.height = height;

        // Hide the raw video, show only the filtered canvas
        elements.video.style.opacity = '0';
        elements.video.style.position = 'absolute';
        elements.filterCanvas.style.opacity = '1';
    }

    /**
     * Set the current filter
     */
    function setFilter(filter) {
        currentFilter = filter;

        // Clear any CSS filter on video (we do everything on canvas now)
        elements.video.style.filter = 'none';

        const name = FilterEngine.generateFilterName(filter);
        elements.filterName.textContent = name;

        updateParamsDisplay(filter);
    }

    /**
     * Update the parameters display panel
     */
    function updateParamsDisplay(filter) {
        const params = FilterEngine.getParameterDisplay(filter);
        
        elements.paramsList.innerHTML = params.map(param => `
            <div class="param-item">
                <span class="param-name">${param.icon} ${param.name}</span>
                <span class="param-value">${param.displayValue}</span>
            </div>
        `).join('');
    }

    /**
     * Toggle parameters panel visibility
     */
    function toggleParamsPanel() {
        elements.paramsPanel.classList.toggle('hidden');
    }

    /**
     * Start the render loop - ALL effects applied on canvas
     */
    function startRenderLoop() {
        const ctx = elements.filterCanvas.getContext('2d', { 
            alpha: false,
            willReadFrequently: true // Optimize for getImageData
        });
        
        function render() {
            if (!stream) {
                animationFrameId = requestAnimationFrame(render);
                return;
            }

            const video = elements.video;
            const canvas = elements.filterCanvas;
            const width = canvas.width;
            const height = canvas.height;

            // Draw video frame to canvas
            ctx.drawImage(video, 0, 0, width, height);

            // Apply temporal smoothing (noise reduction) on mobile
            if (smoothingEnabled && width > 0 && height > 0) {
                applyTemporalSmoothing(ctx, width, height);
            }

            // Apply filter if set
            if (currentFilter) {
                applyAllFilters(ctx, width, height, currentFilter);
            }

            animationFrameId = requestAnimationFrame(render);
        }

        render();
    }

    /**
     * Apply temporal smoothing to reduce video noise
     * Blends current frame with previous frame
     */
    function applyTemporalSmoothing(ctx, width, height) {
        const currentData = ctx.getImageData(0, 0, width, height);
        const data = currentData.data;

        if (previousFrameData && previousFrameData.length === data.length) {
            const blend = SMOOTHING_FACTOR;
            const invBlend = 1 - blend;

            for (let i = 0; i < data.length; i += 4) {
                // Only smooth if pixel values are similar (not for edges/motion)
                const diffR = Math.abs(data[i] - previousFrameData[i]);
                const diffG = Math.abs(data[i + 1] - previousFrameData[i + 1]);
                const diffB = Math.abs(data[i + 2] - previousFrameData[i + 2]);
                
                // Only apply smoothing to low-difference pixels (noise, not motion)
                if (diffR < 30 && diffG < 30 && diffB < 30) {
                    data[i] = data[i] * invBlend + previousFrameData[i] * blend;
                    data[i + 1] = data[i + 1] * invBlend + previousFrameData[i + 1] * blend;
                    data[i + 2] = data[i + 2] * invBlend + previousFrameData[i + 2] * blend;
                }
            }

            ctx.putImageData(currentData, 0, 0);
        }

        // Store current frame for next iteration
        previousFrameData = new Uint8ClampedArray(data);
    }

    /**
     * Apply all filter effects to a canvas context
     */
    function applyAllFilters(ctx, width, height, filter) {
        // Get image data for pixel manipulation
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        // Apply brightness
        if (filter.brightness !== 1.0) {
            applyBrightness(data, filter.brightness);
        }

        // Apply contrast
        if (filter.contrast !== 1.0) {
            applyContrast(data, filter.contrast);
        }

        // Apply saturation
        if (filter.saturation !== 1.0) {
            applySaturation(data, filter.saturation);
        }

        // Apply temperature and tint
        if (Math.abs(filter.temperature) > 0.5 || Math.abs(filter.tint) > 0.5) {
            applyTemperatureTint(data, filter.temperature, filter.tint);
        }

        // Apply fade (lift blacks)
        if (filter.fade > 0.01) {
            applyFade(data, filter.fade);
        }

        // Put modified image back
        ctx.putImageData(imageData, 0, 0);

        // Apply vignette (uses canvas drawing)
        if (filter.vignette > 0.01) {
            applyVignette(ctx, width, height, filter.vignette);
        }

        // Apply grain
        if (filter.grain > 0.01) {
            applyGrain(ctx, width, height, filter.grain);
        }
    }

    /**
     * Apply brightness adjustment
     */
    function applyBrightness(data, brightness) {
        const factor = brightness;
        for (let i = 0; i < data.length; i += 4) {
            data[i] = clamp(data[i] * factor);
            data[i + 1] = clamp(data[i + 1] * factor);
            data[i + 2] = clamp(data[i + 2] * factor);
        }
    }

    /**
     * Apply contrast adjustment
     * contrast: 1.0 = no change, <1 = less contrast, >1 = more contrast
     */
    function applyContrast(data, contrast) {
        // Simple contrast: multiply distance from middle gray
        for (let i = 0; i < data.length; i += 4) {
            data[i] = clamp(128 + (data[i] - 128) * contrast);
            data[i + 1] = clamp(128 + (data[i + 1] - 128) * contrast);
            data[i + 2] = clamp(128 + (data[i + 2] - 128) * contrast);
        }
    }

    /**
     * Apply saturation adjustment
     */
    function applySaturation(data, saturation) {
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            // Calculate luminance
            const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            
            // Interpolate between grayscale and original
            data[i] = clamp(gray + saturation * (r - gray));
            data[i + 1] = clamp(gray + saturation * (g - gray));
            data[i + 2] = clamp(gray + saturation * (b - gray));
        }
    }

    /**
     * Apply temperature and tint adjustments
     */
    function applyTemperatureTint(data, temperature, tint) {
        const tempFactor = temperature / 100;
        const tintFactor = tint / 100;

        for (let i = 0; i < data.length; i += 4) {
            // Temperature: warm adds red, removes blue
            data[i] = clamp(data[i] + tempFactor * 30);
            data[i + 2] = clamp(data[i + 2] - tempFactor * 30);

            // Tint: positive adds magenta (red+blue), negative adds green
            data[i] = clamp(data[i] + tintFactor * 15);
            data[i + 1] = clamp(data[i + 1] - tintFactor * 20);
            data[i + 2] = clamp(data[i + 2] + tintFactor * 10);
        }
    }

    /**
     * Apply fade effect (lift blacks)
     */
    function applyFade(data, fadeAmount) {
        const lift = fadeAmount * 60;

        for (let i = 0; i < data.length; i += 4) {
            data[i] = clamp(data[i] + lift * (1 - data[i] / 255));
            data[i + 1] = clamp(data[i + 1] + lift * (1 - data[i + 1] / 255));
            data[i + 2] = clamp(data[i + 2] + lift * (1 - data[i + 2] / 255));
        }
    }

    /**
     * Apply vignette effect
     */
    function applyVignette(ctx, width, height, strength) {
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.max(width, height) * 0.7;

        const gradient = ctx.createRadialGradient(
            centerX, centerY, radius * 0.3,
            centerX, centerY, radius
        );

        gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(0.5, `rgba(0, 0, 0, ${strength * 0.3})`);
        gradient.addColorStop(1, `rgba(0, 0, 0, ${strength})`);

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
    }

    /**
     * Apply grain effect
     */
    function applyGrain(ctx, width, height, amount) {
        ctx.globalAlpha = amount;
        ctx.globalCompositeOperation = 'overlay';
        
        const offsetX = Math.random() * 256;
        const offsetY = Math.random() * 256;
        
        for (let x = -256; x < width + 256; x += 256) {
            for (let y = -256; y < height + 256; y += 256) {
                ctx.drawImage(noiseCanvas, x + offsetX, y + offsetY);
            }
        }

        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
    }

    /**
     * Clamp value to 0-255 range
     */
    function clamp(value) {
        return Math.max(0, Math.min(255, value));
    }

    /**
     * Capture a photo with all filters applied
     */
    function capture() {
        if (isCapturing || !stream || !currentFilter) return null;
        isCapturing = true;

        const video = elements.video;
        const canvas = elements.captureCanvas;
        const ctx = canvas.getContext('2d');

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Draw video frame
        ctx.drawImage(video, 0, 0);

        // Apply all filters (same as preview)
        applyAllFilters(ctx, canvas.width, canvas.height, currentFilter);

        // Get data URL
        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);

        isCapturing = false;
        return dataUrl;
    }

    /**
     * Get current filter
     */
    function getFilter() {
        return currentFilter;
    }

    /**
     * Check if camera is active
     */
    function isActive() {
        return stream !== null;
    }

    // Public API
    return {
        init,
        start,
        stop,
        flip,
        setFilter,
        capture,
        toggleParamsPanel,
        toggleSmoothing,
        getFilter,
        isActive
    };
})();
