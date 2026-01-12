/**
 * Dashboard Module
 * Handles the user dashboard for managing saved filters
 */

const Dashboard = (function() {
    // State
    let currentEditFilter = null;
    let previewImage = null;

    // DOM Elements
    let elements = {};

    /**
     * Initialize the dashboard module
     */
    function init() {
        elements = {
            // Dashboard
            filtersGrid: document.getElementById('filters-grid'),
            emptyState: document.getElementById('empty-state'),
            newQuizBtn: document.getElementById('new-quiz-btn'),
            uploadPhotoBtn: document.getElementById('upload-photo-btn'),
            dashboardBackBtn: document.getElementById('dashboard-back-btn'),
            dashboardLogoutBtn: document.getElementById('dashboard-logout-btn'),
            
            // Filter Edit
            filterEditTitle: document.getElementById('filter-edit-title'),
            editPreviewCanvas: document.getElementById('edit-preview-canvas'),
            editParamsList: document.getElementById('edit-params-list'),
            textEditInput: document.getElementById('text-edit-input'),
            textEditBtn: document.getElementById('text-edit-btn'),
            styleImageZone: document.getElementById('style-image-zone'),
            styleImageInput: document.getElementById('style-image-input'),
            filterEditBackBtn: document.getElementById('filter-edit-back-btn'),
            filterDeleteBtn: document.getElementById('filter-delete-btn'),
            useFilterCameraBtn: document.getElementById('use-filter-camera-btn'),
            
            // Advanced sliders
            advancedToggle: document.getElementById('advanced-toggle'),
            advancedSliders: document.getElementById('advanced-sliders'),
            applySlidersBtn: document.getElementById('apply-sliders-btn'),
            sliders: {
                brightness: document.getElementById('slider-brightness'),
                contrast: document.getElementById('slider-contrast'),
                saturation: document.getElementById('slider-saturation'),
                temperature: document.getElementById('slider-temperature'),
                tint: document.getElementById('slider-tint'),
                grain: document.getElementById('slider-grain'),
                vignette: document.getElementById('slider-vignette'),
                fade: document.getElementById('slider-fade')
            },
            sliderValues: {
                brightness: document.getElementById('brightness-value'),
                contrast: document.getElementById('contrast-value'),
                saturation: document.getElementById('saturation-value'),
                temperature: document.getElementById('temperature-value'),
                tint: document.getElementById('tint-value'),
                grain: document.getElementById('grain-value'),
                vignette: document.getElementById('vignette-value'),
                fade: document.getElementById('fade-value')
            }
        };

        setupEventListeners();
        
        // Listen for filter changes
        FilterStore.onFiltersChange(renderFilters);
    }

    /**
     * Set up event listeners
     */
    function setupEventListeners() {
        // Dashboard buttons
        if (elements.newQuizBtn) {
            elements.newQuizBtn.addEventListener('click', () => {
                App.showScreen('quiz');
                Quiz.reset();
            });
        }

        if (elements.uploadPhotoBtn) {
            elements.uploadPhotoBtn.addEventListener('click', () => {
                App.showScreen('photo-editor');
            });
        }

        if (elements.dashboardBackBtn) {
            elements.dashboardBackBtn.addEventListener('click', () => {
                App.showScreen('welcome');
            });
        }

        if (elements.dashboardLogoutBtn) {
            elements.dashboardLogoutBtn.addEventListener('click', () => {
                Auth.signOut();
            });
        }

        // Filter edit buttons
        if (elements.filterEditBackBtn) {
            elements.filterEditBackBtn.addEventListener('click', () => {
                App.showScreen('dashboard');
            });
        }

        if (elements.filterDeleteBtn) {
            elements.filterDeleteBtn.addEventListener('click', handleDeleteFilter);
        }

        if (elements.textEditBtn) {
            elements.textEditBtn.addEventListener('click', handleTextEdit);
        }

        if (elements.textEditInput) {
            elements.textEditInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') handleTextEdit();
            });
        }

        if (elements.useFilterCameraBtn) {
            elements.useFilterCameraBtn.addEventListener('click', handleUseInCamera);
        }

        // Image upload zone
        if (elements.styleImageZone) {
            elements.styleImageZone.addEventListener('click', () => {
                elements.styleImageInput.click();
            });

            elements.styleImageZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                elements.styleImageZone.classList.add('dragover');
            });

            elements.styleImageZone.addEventListener('dragleave', () => {
                elements.styleImageZone.classList.remove('dragover');
            });

            elements.styleImageZone.addEventListener('drop', (e) => {
                e.preventDefault();
                elements.styleImageZone.classList.remove('dragover');
                const file = e.dataTransfer.files[0];
                if (file && file.type.startsWith('image/')) {
                    handleStyleImageUpload(file);
                }
            });
        }

        if (elements.styleImageInput) {
            elements.styleImageInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    handleStyleImageUpload(file);
                }
            });
        }

        // Advanced toggle
        if (elements.advancedToggle) {
            elements.advancedToggle.addEventListener('click', () => {
                elements.advancedSliders.classList.toggle('hidden');
                elements.advancedToggle.classList.toggle('open');
            });
        }

        // Sliders
        Object.keys(elements.sliders).forEach(param => {
            const slider = elements.sliders[param];
            if (slider) {
                slider.addEventListener('input', () => {
                    updateSliderDisplay(param, slider.value);
                    updatePreviewWithSliders();
                });
            }
        });

        // Apply sliders button
        if (elements.applySlidersBtn) {
            elements.applySlidersBtn.addEventListener('click', handleApplySliders);
        }
    }

    /**
     * Load and render filters
     */
    async function loadFilters() {
        const filters = await FilterStore.getFilters();
        renderFilters(filters);
    }

    /**
     * Render filters grid
     */
    function renderFilters(filters) {
        if (!elements.filtersGrid) return;

        if (!filters || filters.length === 0) {
            elements.filtersGrid.innerHTML = '';
            if (elements.emptyState) {
                elements.emptyState.classList.remove('hidden');
            }
            return;
        }

        if (elements.emptyState) {
            elements.emptyState.classList.add('hidden');
        }

        elements.filtersGrid.innerHTML = filters.map(filter => `
            <div class="filter-card" data-filter-id="${filter.id}">
                <div class="filter-card-preview">
                    <canvas class="filter-preview-mini" data-params='${JSON.stringify(filter.params)}'></canvas>
                </div>
                <div class="filter-card-info">
                    <h3 class="filter-card-name">${escapeHtml(filter.name)}</h3>
                    <span class="filter-card-source">${filter.source || 'quiz'}</span>
                </div>
                <div class="filter-card-actions">
                    <button class="filter-card-btn edit-filter-btn" title="Edit">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                    </button>
                    <button class="filter-card-btn use-filter-btn" title="Use">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                            <circle cx="12" cy="13" r="4"/>
                        </svg>
                    </button>
                </div>
            </div>
        `).join('');

        // Add click handlers
        elements.filtersGrid.querySelectorAll('.edit-filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const card = btn.closest('.filter-card');
                const filterId = card.dataset.filterId;
                openFilterEdit(filterId);
            });
        });

        elements.filtersGrid.querySelectorAll('.use-filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const card = btn.closest('.filter-card');
                const filterId = card.dataset.filterId;
                useFilterInCamera(filterId);
            });
        });

        // Render mini previews
        renderMiniPreviews();
    }

    /**
     * Render mini preview canvases with gradient
     */
    function renderMiniPreviews() {
        const canvases = elements.filtersGrid.querySelectorAll('.filter-preview-mini');
        
        canvases.forEach(canvas => {
            const params = JSON.parse(canvas.dataset.params || '{}');
            const ctx = canvas.getContext('2d');
            
            canvas.width = 120;
            canvas.height = 80;

            // Create a gradient background to show filter effect
            const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
            
            // Base colors influenced by temperature
            const warmth = (params.temperature || 0) / 30;
            const r = Math.min(255, 180 + warmth * 40);
            const g = 160;
            const b = Math.max(120, 180 - warmth * 40);
            
            gradient.addColorStop(0, `rgb(${r}, ${g + 40}, ${b + 60})`);
            gradient.addColorStop(0.5, `rgb(${r + 20}, ${g + 20}, ${b + 20})`);
            gradient.addColorStop(1, `rgb(${r - 40}, ${g - 20}, ${b - 20})`);
            
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Apply brightness/contrast simulation
            const brightness = params.brightness || 1;
            const contrast = params.contrast || 1;
            const saturation = params.saturation || 1;

            ctx.globalCompositeOperation = 'source-atop';
            
            if (brightness !== 1) {
                ctx.fillStyle = brightness > 1 
                    ? `rgba(255, 255, 255, ${(brightness - 1) * 0.3})`
                    : `rgba(0, 0, 0, ${(1 - brightness) * 0.3})`;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }

            ctx.globalCompositeOperation = 'source-over';

            // Add vignette if present
            if (params.vignette > 0.05) {
                const vignette = ctx.createRadialGradient(
                    canvas.width / 2, canvas.height / 2, 0,
                    canvas.width / 2, canvas.height / 2, canvas.width * 0.7
                );
                vignette.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
                vignette.addColorStop(1, `rgba(0, 0, 0, ${params.vignette})`);
                ctx.fillStyle = vignette;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
        });
    }

    /**
     * Open filter edit screen
     */
    async function openFilterEdit(filterId) {
        const filter = await FilterStore.getFilter(filterId);
        if (!filter) return;

        currentEditFilter = filter;
        
        if (elements.filterEditTitle) {
            elements.filterEditTitle.textContent = filter.name;
        }

        updateEditParamsDisplay(filter.params);
        setSliderValues(filter.params);
        loadPreviewImage();
        
        // Reset advanced section state
        if (elements.advancedSliders) {
            elements.advancedSliders.classList.add('hidden');
        }
        if (elements.advancedToggle) {
            elements.advancedToggle.classList.remove('open');
        }
        
        App.showScreen('filterEdit');
    }

    /**
     * Update the parameters display in edit screen
     */
    function updateEditParamsDisplay(params) {
        if (!elements.editParamsList) return;

        const displayParams = FilterEngine.getParameterDisplay(params);
        
        elements.editParamsList.innerHTML = displayParams.map(param => `
            <div class="edit-param-item">
                <span class="edit-param-name">${param.icon} ${param.name}</span>
                <span class="edit-param-value">${param.displayValue}</span>
            </div>
        `).join('');
    }

    /**
     * Load a sample image for the preview canvas
     */
    function loadPreviewImage() {
        if (!elements.editPreviewCanvas) return;

        // Create a sample gradient image for preview
        const canvas = elements.editPreviewCanvas;
        const ctx = canvas.getContext('2d');
        
        canvas.width = 300;
        canvas.height = 200;

        // Draw a sample scene (gradient with some shapes)
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, '#87CEEB');
        gradient.addColorStop(0.6, '#98D8C8');
        gradient.addColorStop(1, '#2D5016');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Add some "plant" shapes
        ctx.fillStyle = '#228B22';
        ctx.beginPath();
        ctx.ellipse(100, 180, 30, 50, 0, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#32CD32';
        ctx.beginPath();
        ctx.ellipse(200, 170, 25, 45, 0.3, 0, Math.PI * 2);
        ctx.fill();

        // Apply current filter if editing
        if (currentEditFilter) {
            applyFilterToCanvas(ctx, canvas.width, canvas.height, currentEditFilter.params);
        }
    }

    /**
     * Apply filter to a canvas context
     */
    function applyFilterToCanvas(ctx, width, height, params) {
        // Get image data
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        // Apply basic adjustments
        for (let i = 0; i < data.length; i += 4) {
            let r = data[i];
            let g = data[i + 1];
            let b = data[i + 2];

            // Brightness
            if (params.brightness && params.brightness !== 1) {
                r *= params.brightness;
                g *= params.brightness;
                b *= params.brightness;
            }

            // Contrast
            if (params.contrast && params.contrast !== 1) {
                r = 128 + (r - 128) * params.contrast;
                g = 128 + (g - 128) * params.contrast;
                b = 128 + (b - 128) * params.contrast;
            }

            // Temperature
            if (params.temperature) {
                r += params.temperature;
                b -= params.temperature;
            }

            // Saturation
            if (params.saturation && params.saturation !== 1) {
                const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
                r = gray + params.saturation * (r - gray);
                g = gray + params.saturation * (g - gray);
                b = gray + params.saturation * (b - gray);
            }

            // Clamp values
            data[i] = Math.max(0, Math.min(255, r));
            data[i + 1] = Math.max(0, Math.min(255, g));
            data[i + 2] = Math.max(0, Math.min(255, b));
        }

        ctx.putImageData(imageData, 0, 0);

        // Apply vignette
        if (params.vignette > 0.01) {
            const vignette = ctx.createRadialGradient(
                width / 2, height / 2, width * 0.3,
                width / 2, height / 2, width * 0.7
            );
            vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
            vignette.addColorStop(1, `rgba(0, 0, 0, ${params.vignette})`);
            ctx.fillStyle = vignette;
            ctx.fillRect(0, 0, width, height);
        }
    }

    /**
     * Update slider display value
     */
    function updateSliderDisplay(param, value) {
        if (elements.sliderValues[param]) {
            // Format display based on parameter type
            if (param === 'temperature' || param === 'tint') {
                elements.sliderValues[param].textContent = Math.round(value);
            } else {
                elements.sliderValues[param].textContent = parseFloat(value).toFixed(2);
            }
        }
    }

    /**
     * Get current slider values
     */
    function getSliderValues() {
        return {
            brightness: parseFloat(elements.sliders.brightness?.value || 1),
            contrast: parseFloat(elements.sliders.contrast?.value || 1),
            saturation: parseFloat(elements.sliders.saturation?.value || 1),
            temperature: parseFloat(elements.sliders.temperature?.value || 0),
            tint: parseFloat(elements.sliders.tint?.value || 0),
            grain: parseFloat(elements.sliders.grain?.value || 0),
            vignette: parseFloat(elements.sliders.vignette?.value || 0),
            fade: parseFloat(elements.sliders.fade?.value || 0)
        };
    }

    /**
     * Set slider values from filter params
     */
    function setSliderValues(params) {
        Object.keys(elements.sliders).forEach(param => {
            const slider = elements.sliders[param];
            if (slider && params[param] !== undefined) {
                slider.value = params[param];
                updateSliderDisplay(param, params[param]);
            }
        });
    }

    /**
     * Update preview with current slider values
     */
    function updatePreviewWithSliders() {
        if (!elements.editPreviewCanvas) return;
        
        const params = getSliderValues();
        loadPreviewImageWithParams(params);
    }

    /**
     * Load preview image with specific params
     */
    function loadPreviewImageWithParams(params) {
        if (!elements.editPreviewCanvas) return;

        const canvas = elements.editPreviewCanvas;
        const ctx = canvas.getContext('2d');
        
        canvas.width = 300;
        canvas.height = 200;

        // Draw a sample scene (gradient with some shapes)
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, '#87CEEB');
        gradient.addColorStop(0.6, '#98D8C8');
        gradient.addColorStop(1, '#2D5016');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Add some "plant" shapes
        ctx.fillStyle = '#228B22';
        ctx.beginPath();
        ctx.ellipse(100, 180, 30, 50, 0, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#32CD32';
        ctx.beginPath();
        ctx.ellipse(200, 170, 25, 45, 0.3, 0, Math.PI * 2);
        ctx.fill();

        // Apply filter
        applyFilterToCanvas(ctx, canvas.width, canvas.height, params);
    }

    /**
     * Handle apply sliders
     */
    async function handleApplySliders() {
        if (!currentEditFilter) {
            console.error('No filter selected for editing');
            return;
        }

        const newParams = getSliderValues();
        
        elements.applySlidersBtn.disabled = true;
        elements.applySlidersBtn.textContent = 'Saving...';

        try {
            // Check if user is logged in
            if (!Auth.isLoggedIn()) {
                throw new Error('Please sign in to save changes');
            }

            // Check if Supabase is configured
            if (!Supabase.isConfigured()) {
                // Save locally only - update UI without database
                console.log('Supabase not configured, updating locally only');
                currentEditFilter.params = newParams;
                updateEditParamsDisplay(newParams);
                elements.applySlidersBtn.textContent = 'Saved locally!';
                setTimeout(() => {
                    elements.applySlidersBtn.textContent = 'Apply Changes';
                }, 1500);
                return;
            }

            // Update filter in database
            console.log('Updating filter:', currentEditFilter.id, newParams);
            await FilterStore.updateFilter(currentEditFilter.id, {
                name: currentEditFilter.name,
                params: newParams,
                source: 'manual'
            });

            // Update local state
            currentEditFilter.params = newParams;
            updateEditParamsDisplay(newParams);
            
            elements.applySlidersBtn.textContent = 'Saved!';
            setTimeout(() => {
                elements.applySlidersBtn.textContent = 'Apply Changes';
            }, 1500);
            
        } catch (error) {
            console.error('Apply sliders error:', error);
            alert('Failed to update filter: ' + (error.message || 'Unknown error'));
        } finally {
            elements.applySlidersBtn.disabled = false;
            // Ensure button text is reset if not already set
            setTimeout(() => {
                if (elements.applySlidersBtn.textContent === 'Saving...') {
                    elements.applySlidersBtn.textContent = 'Apply Changes';
                }
            }, 100);
        }
    }

    /**
     * Handle text-based filter editing
     */
    async function handleTextEdit() {
        if (!currentEditFilter || !elements.textEditInput) return;

        const instruction = elements.textEditInput.value.trim();
        if (!instruction) return;

        elements.textEditBtn.disabled = true;
        elements.textEditBtn.classList.add('loading');

        try {
            const newParams = await FilterEngine.refineFilterWithText(
                currentEditFilter.params,
                instruction
            );

            // Update filter in database
            await FilterStore.updateFilter(currentEditFilter.id, {
                name: currentEditFilter.name,
                params: newParams,
                source: 'manual'
            });

            // Update local state
            currentEditFilter.params = newParams;
            updateEditParamsDisplay(newParams);
            loadPreviewImage();
            
            elements.textEditInput.value = '';
        } catch (error) {
            console.error('Text edit error:', error);
            alert('Failed to update filter: ' + error.message);
        } finally {
            elements.textEditBtn.disabled = false;
            elements.textEditBtn.classList.remove('loading');
        }
    }

    /**
     * Handle style image upload
     */
    async function handleStyleImageUpload(file) {
        if (!currentEditFilter) return;

        elements.styleImageZone.classList.add('loading');

        try {
            // Convert file to base64
            const base64 = await fileToBase64(file);

            // Call AI to analyze image and adjust current filter params
            const newParams = await FilterEngine.matchImageStyle(base64, currentEditFilter.params);

            // Update filter in database
            await FilterStore.updateFilter(currentEditFilter.id, {
                name: currentEditFilter.name,
                params: newParams,
                source: 'image-match'
            });

            // Update local state
            currentEditFilter.params = newParams;
            updateEditParamsDisplay(newParams);
            loadPreviewImage();
        } catch (error) {
            console.error('Image style match error:', error);
            alert('Failed to analyze image style: ' + error.message);
        } finally {
            elements.styleImageZone.classList.remove('loading');
            elements.styleImageInput.value = '';
        }
    }

    /**
     * Convert file to base64
     */
    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    /**
     * Handle delete filter
     */
    async function handleDeleteFilter() {
        if (!currentEditFilter) return;

        if (!confirm('Delete this filter? This cannot be undone.')) return;

        try {
            await FilterStore.deleteFilter(currentEditFilter.id);
            currentEditFilter = null;
            App.showScreen('dashboard');
        } catch (error) {
            console.error('Delete error:', error);
            alert('Failed to delete filter');
        }
    }

    /**
     * Use current edit filter in camera
     */
    function handleUseInCamera() {
        if (!currentEditFilter) return;
        useFilterInCamera(currentEditFilter.id);
    }

    /**
     * Use a filter in the camera
     */
    async function useFilterInCamera(filterId) {
        const filter = await FilterStore.getFilter(filterId);
        if (!filter) return;

        // Set filter and go to camera
        App.setCurrentFilter(filter.params, filter.name);
        App.showScreen('camera');
        
        const cameraStarted = await Camera.start();
        if (cameraStarted) {
            Camera.setFilter(filter.params);
        }
    }

    /**
     * Escape HTML for safe rendering
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Public API
    return {
        init,
        loadFilters,
        renderFilters,
        openFilterEdit
    };
})();
