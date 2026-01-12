/**
 * Photo Editor Module
 * Handles uploading photos and applying saved filters to them
 */

const PhotoEditor = (function() {
    // State
    let uploadedImage = null;
    let selectedFilter = null;
    let originalImageData = null;

    // DOM Elements
    let elements = {};

    /**
     * Initialize the photo editor module
     */
    function init() {
        elements = {
            photoUploadSection: document.getElementById('photo-upload-section'),
            photoPreviewSection: document.getElementById('photo-preview-section'),
            photoUploadZone: document.getElementById('photo-upload-zone'),
            photoUploadInput: document.getElementById('photo-upload-input'),
            photoPreviewCanvas: document.getElementById('photo-preview-canvas'),
            filterSelectorList: document.getElementById('filter-selector-list'),
            photoEditorBackBtn: document.getElementById('photo-editor-back-btn'),
            changePhotoBtn: document.getElementById('change-photo-btn'),
            downloadEditedBtn: document.getElementById('download-edited-btn')
        };

        setupEventListeners();
    }

    /**
     * Set up event listeners
     */
    function setupEventListeners() {
        // Back button
        if (elements.photoEditorBackBtn) {
            elements.photoEditorBackBtn.addEventListener('click', () => {
                reset();
                App.showScreen('dashboard');
            });
        }

        // Upload zone click
        if (elements.photoUploadZone) {
            elements.photoUploadZone.addEventListener('click', () => {
                elements.photoUploadInput.click();
            });

            // Drag and drop
            elements.photoUploadZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                elements.photoUploadZone.classList.add('dragover');
            });

            elements.photoUploadZone.addEventListener('dragleave', () => {
                elements.photoUploadZone.classList.remove('dragover');
            });

            elements.photoUploadZone.addEventListener('drop', (e) => {
                e.preventDefault();
                elements.photoUploadZone.classList.remove('dragover');
                const file = e.dataTransfer.files[0];
                if (file && file.type.startsWith('image/')) {
                    handleImageUpload(file);
                }
            });
        }

        // File input change
        if (elements.photoUploadInput) {
            elements.photoUploadInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    handleImageUpload(file);
                }
            });
        }

        // Change photo button
        if (elements.changePhotoBtn) {
            elements.changePhotoBtn.addEventListener('click', () => {
                reset();
                showUploadSection();
            });
        }

        // Download button
        if (elements.downloadEditedBtn) {
            elements.downloadEditedBtn.addEventListener('click', handleDownload);
        }
    }

    /**
     * Handle image upload
     */
    function handleImageUpload(file) {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                uploadedImage = img;
                showPreviewSection();
                drawOriginalImage();
                loadFilterOptions();
            };
            img.src = e.target.result;
        };
        
        reader.readAsDataURL(file);
    }

    /**
     * Show upload section, hide preview
     */
    function showUploadSection() {
        if (elements.photoUploadSection) {
            elements.photoUploadSection.classList.remove('hidden');
        }
        if (elements.photoPreviewSection) {
            elements.photoPreviewSection.classList.add('hidden');
        }
    }

    /**
     * Show preview section, hide upload
     */
    function showPreviewSection() {
        if (elements.photoUploadSection) {
            elements.photoUploadSection.classList.add('hidden');
        }
        if (elements.photoPreviewSection) {
            elements.photoPreviewSection.classList.remove('hidden');
        }
    }

    /**
     * Draw the original uploaded image to canvas
     */
    function drawOriginalImage() {
        if (!uploadedImage || !elements.photoPreviewCanvas) return;

        const canvas = elements.photoPreviewCanvas;
        const ctx = canvas.getContext('2d');

        // Set canvas size to match image (with max dimensions)
        const maxWidth = 800;
        const maxHeight = 600;
        let width = uploadedImage.width;
        let height = uploadedImage.height;

        if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
        }
        if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
        }

        canvas.width = width;
        canvas.height = height;

        // Draw image
        ctx.drawImage(uploadedImage, 0, 0, width, height);

        // Store original image data
        originalImageData = ctx.getImageData(0, 0, width, height);
    }

    /**
     * Load filter options from user's saved filters
     */
    async function loadFilterOptions() {
        if (!elements.filterSelectorList) return;

        const filters = await FilterStore.getFilters();

        if (!filters || filters.length === 0) {
            elements.filterSelectorList.innerHTML = `
                <div class="no-filters-message">
                    <p>No saved filters yet.</p>
                    <p>Take the quiz to create your first filter!</p>
                </div>
            `;
            return;
        }

        // Add "No Filter" option first
        let html = `
            <div class="filter-option ${!selectedFilter ? 'selected' : ''}" data-filter-id="none">
                <div class="filter-option-preview none">
                    <span>None</span>
                </div>
                <span class="filter-option-name">Original</span>
            </div>
        `;

        // Add user's filters
        html += filters.map(filter => `
            <div class="filter-option" data-filter-id="${filter.id}">
                <div class="filter-option-preview">
                    <canvas class="filter-option-canvas" data-params='${JSON.stringify(filter.params)}'></canvas>
                </div>
                <span class="filter-option-name">${escapeHtml(filter.name)}</span>
            </div>
        `).join('');

        elements.filterSelectorList.innerHTML = html;

        // Add click handlers
        elements.filterSelectorList.querySelectorAll('.filter-option').forEach(option => {
            option.addEventListener('click', () => {
                // Update selection state
                elements.filterSelectorList.querySelectorAll('.filter-option').forEach(o => {
                    o.classList.remove('selected');
                });
                option.classList.add('selected');

                const filterId = option.dataset.filterId;
                if (filterId === 'none') {
                    selectedFilter = null;
                    applyFilterToPreview(null);
                } else {
                    const filter = filters.find(f => f.id === filterId);
                    if (filter) {
                        selectedFilter = filter;
                        applyFilterToPreview(filter.params);
                    }
                }
            });
        });

        // Render mini previews
        renderFilterPreviews(filters);
    }

    /**
     * Render small preview thumbnails for each filter
     */
    function renderFilterPreviews(filters) {
        const canvases = elements.filterSelectorList.querySelectorAll('.filter-option-canvas');
        
        canvases.forEach(canvas => {
            const params = JSON.parse(canvas.dataset.params || '{}');
            const ctx = canvas.getContext('2d');
            
            canvas.width = 60;
            canvas.height = 60;

            // If we have the original image, use a scaled version
            if (uploadedImage) {
                ctx.drawImage(uploadedImage, 0, 0, 60, 60);
                applyFilterToContext(ctx, 60, 60, params);
            } else {
                // Fallback gradient preview
                renderGradientPreview(ctx, canvas.width, canvas.height, params);
            }
        });
    }

    /**
     * Render a gradient preview for a filter
     */
    function renderGradientPreview(ctx, width, height, params) {
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        
        const warmth = (params.temperature || 0) / 30;
        const r = Math.min(255, 180 + warmth * 40);
        const g = 160;
        const b = Math.max(120, 180 - warmth * 40);
        
        gradient.addColorStop(0, `rgb(${r}, ${g + 40}, ${b + 60})`);
        gradient.addColorStop(1, `rgb(${r - 40}, ${g - 20}, ${b - 20})`);
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
    }

    /**
     * Apply filter to the preview canvas
     */
    function applyFilterToPreview(params) {
        if (!elements.photoPreviewCanvas || !originalImageData) return;

        const canvas = elements.photoPreviewCanvas;
        const ctx = canvas.getContext('2d');

        // Restore original image
        ctx.putImageData(originalImageData, 0, 0);

        // Apply filter if selected
        if (params) {
            applyFilterToContext(ctx, canvas.width, canvas.height, params);
        }
    }

    /**
     * Apply filter parameters to a canvas context
     */
    function applyFilterToContext(ctx, width, height, params) {
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        // Apply all adjustments
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

            // Tint
            if (params.tint) {
                r += params.tint * 0.5;
                g -= params.tint * 0.7;
                b += params.tint * 0.3;
            }

            // Saturation
            if (params.saturation && params.saturation !== 1) {
                const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
                r = gray + params.saturation * (r - gray);
                g = gray + params.saturation * (g - gray);
                b = gray + params.saturation * (b - gray);
            }

            // Fade (lift blacks)
            if (params.fade && params.fade > 0) {
                const lift = params.fade * 60;
                r += lift * (1 - r / 255);
                g += lift * (1 - g / 255);
                b += lift * (1 - b / 255);
            }

            // Clamp values
            data[i] = Math.max(0, Math.min(255, r));
            data[i + 1] = Math.max(0, Math.min(255, g));
            data[i + 2] = Math.max(0, Math.min(255, b));
        }

        ctx.putImageData(imageData, 0, 0);

        // Apply vignette
        if (params.vignette && params.vignette > 0.01) {
            const centerX = width / 2;
            const centerY = height / 2;
            const radius = Math.max(width, height) * 0.7;

            const gradient = ctx.createRadialGradient(
                centerX, centerY, radius * 0.3,
                centerX, centerY, radius
            );

            gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
            gradient.addColorStop(0.5, `rgba(0, 0, 0, ${params.vignette * 0.3})`);
            gradient.addColorStop(1, `rgba(0, 0, 0, ${params.vignette})`);

            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, width, height);
        }

        // Apply grain
        if (params.grain && params.grain > 0.01) {
            ctx.globalAlpha = params.grain;
            ctx.globalCompositeOperation = 'overlay';
            
            const grainImageData = ctx.createImageData(width, height);
            const grainData = grainImageData.data;
            
            for (let i = 0; i < grainData.length; i += 4) {
                const noise = Math.random() * 255;
                grainData[i] = noise;
                grainData[i + 1] = noise;
                grainData[i + 2] = noise;
                grainData[i + 3] = 255;
            }
            
            // Create temporary canvas for grain
            const grainCanvas = document.createElement('canvas');
            grainCanvas.width = width;
            grainCanvas.height = height;
            const grainCtx = grainCanvas.getContext('2d');
            grainCtx.putImageData(grainImageData, 0, 0);
            
            ctx.drawImage(grainCanvas, 0, 0);
            
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';
        }
    }

    /**
     * Handle download of edited photo
     */
    function handleDownload() {
        if (!elements.photoPreviewCanvas) return;

        const canvas = elements.photoPreviewCanvas;
        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);

        // Create download link
        const link = document.createElement('a');
        link.href = dataUrl;
        
        const filterName = selectedFilter 
            ? selectedFilter.name.toLowerCase().replace(/\s+/g, '-')
            : 'original';
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
        link.download = `plart-${filterName}-${timestamp}.jpg`;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    /**
     * Reset the editor state
     */
    function reset() {
        uploadedImage = null;
        selectedFilter = null;
        originalImageData = null;
        
        if (elements.photoUploadInput) {
            elements.photoUploadInput.value = '';
        }
        
        showUploadSection();
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
        reset,
        loadFilterOptions
    };
})();
