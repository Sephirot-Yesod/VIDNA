/**
 * App Controller
 * Orchestrates screen transitions and connects all modules
 */

const App = (function() {
    // State
    let currentScreen = 'welcome';
    let previousScreen = null;
    let currentFilter = null;
    let currentFilterName = null;
    let capturedPhotoUrl = null;

    // DOM Elements
    let screens = {};
    let buttons = {};
    let modal = {};

    /**
     * Initialize the application
     */
    function init() {
        // Cache DOM elements
        screens = {
            welcome: document.getElementById('welcome-screen'),
            auth: document.getElementById('auth-screen'),
            dashboard: document.getElementById('dashboard-screen'),
            filterEdit: document.getElementById('filter-edit-screen'),
            photoEditor: document.getElementById('photo-editor-screen'),
            quiz: document.getElementById('quiz-screen'),
            generating: document.getElementById('generating-screen'),
            camera: document.getElementById('camera-screen'),
            result: document.getElementById('result-screen')
        };

        buttons = {
            // Welcome
            startQuiz: document.getElementById('start-quiz-btn'),
            welcomeAuth: document.getElementById('welcome-auth-btn'),
            myFilters: document.getElementById('my-filters-btn'),
            // Quiz
            quizBack: document.getElementById('quiz-back-btn'),
            // Camera
            cameraBack: document.getElementById('camera-back-btn'),
            toggleParams: document.getElementById('toggle-params-btn'),
            flipCamera: document.getElementById('flip-camera-btn'),
            capture: document.getElementById('capture-btn'),
            saveFilter: document.getElementById('save-filter-btn'),
            retakeQuiz: document.getElementById('retake-quiz-btn'),
            // Result
            resultBack: document.getElementById('result-back-btn'),
            retake: document.getElementById('retake-btn'),
            download: document.getElementById('download-btn')
        };

        modal = {
            container: document.getElementById('save-filter-modal'),
            closeBtn: document.getElementById('save-modal-close-btn'),
            nameInput: document.getElementById('filter-name-input'),
            confirmBtn: document.getElementById('save-filter-confirm-btn'),
            error: document.getElementById('save-filter-error')
        };

        // Initialize Supabase first
        Supabase.init();

        // Initialize modules
        Auth.init();
        Quiz.init();
        Camera.init();
        Dashboard.init();
        PhotoEditor.init();

        // Set up event listeners
        setupEventListeners();

        // Set up quiz completion callback
        Quiz.onComplete(handleQuizComplete);

        // Listen for auth state changes
        Auth.onAuthStateChange(handleAuthStateChange);
    }

    /**
     * Set up all event listeners
     */
    function setupEventListeners() {
        // Welcome screen
        if (buttons.startQuiz) {
            buttons.startQuiz.addEventListener('click', handleStartQuiz);
        }
        
        if (buttons.welcomeAuth) {
            buttons.welcomeAuth.addEventListener('click', () => {
                if (Auth.isLoggedIn()) {
                    showScreen('dashboard');
                    Dashboard.loadFilters();
                } else {
                    showScreen('auth');
                }
            });
        }

        if (buttons.myFilters) {
            buttons.myFilters.addEventListener('click', () => {
                showScreen('dashboard');
                Dashboard.loadFilters();
            });
        }

        // Quiz screen
        if (buttons.quizBack) {
            buttons.quizBack.addEventListener('click', () => {
                showScreen('welcome');
            });
        }

        // Camera screen
        if (buttons.cameraBack) {
            buttons.cameraBack.addEventListener('click', async () => {
                Camera.stop();
                // Go back to where we came from
                if (previousScreen === 'dashboard' || previousScreen === 'filter-edit') {
                    showScreen('dashboard');
                } else {
                    showScreen('welcome');
                }
            });
        }

        if (buttons.toggleParams) {
            buttons.toggleParams.addEventListener('click', () => {
                Camera.toggleParamsPanel();
            });
        }

        if (buttons.flipCamera) {
            buttons.flipCamera.addEventListener('click', async () => {
                await Camera.flip();
            });
        }

        if (buttons.capture) {
            buttons.capture.addEventListener('click', handleCapture);
        }

        if (buttons.saveFilter) {
            buttons.saveFilter.addEventListener('click', handleSaveFilterClick);
        }

        if (buttons.retakeQuiz) {
            buttons.retakeQuiz.addEventListener('click', () => {
                Camera.stop();
                showScreen('quiz');
                Quiz.reset();
            });
        }

        // Result screen
        if (buttons.resultBack) {
            buttons.resultBack.addEventListener('click', async () => {
                await returnToCamera();
            });
        }

        if (buttons.retake) {
            buttons.retake.addEventListener('click', async () => {
                await returnToCamera();
            });
        }

        if (buttons.download) {
            buttons.download.addEventListener('click', handleDownload);
        }

        // Save filter modal
        if (modal.closeBtn) {
            modal.closeBtn.addEventListener('click', closeSaveModal);
        }
        
        if (modal.container) {
            modal.container.querySelector('.modal-backdrop')?.addEventListener('click', closeSaveModal);
        }

        if (modal.confirmBtn) {
            modal.confirmBtn.addEventListener('click', handleSaveFilterConfirm);
        }

        if (modal.nameInput) {
            modal.nameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') handleSaveFilterConfirm();
            });
        }
    }

    /**
     * Handle auth state changes
     */
    function handleAuthStateChange(user) {
        // Update UI based on auth state
        if (user && currentScreen === 'auth') {
            showScreen('dashboard');
            Dashboard.loadFilters();
        }
    }

    /**
     * Handle start quiz button click
     */
    function handleStartQuiz() {
        showScreen('quiz');
        Quiz.reset();
    }

    /**
     * Show a specific screen
     * @param {string} screenName - Name of the screen to show
     */
    function showScreen(screenName) {
        // Store previous screen
        previousScreen = currentScreen;

        // Hide all screens
        Object.values(screens).forEach(screen => {
            if (screen) screen.classList.remove('active');
        });

        // Show target screen
        if (screens[screenName]) {
            screens[screenName].classList.add('active');
            currentScreen = screenName;
        }

        // Handle screen-specific logic
        if (screenName === 'dashboard') {
            Dashboard.loadFilters();
        } else if (screenName === 'photo-editor') {
            PhotoEditor.loadFilterOptions();
        }
    }

    /**
     * Handle quiz completion
     * @param {Array} results - Quiz results
     */
    async function handleQuizComplete(results) {
        // Show generating screen
        showScreen('generating');
        
        const generatingText = document.querySelector('.generating-text');
        const generatingTitle = document.querySelector('.generating-title');

        try {
            generatingText.textContent = 'AI is analyzing your personality...';
            
            // Get questions from Quiz module
            const questions = Quiz.getQuestions();
            
            // Call GPT to generate filter
            currentFilter = await FilterEngine.calculateFilter(results, questions);
            currentFilterName = currentFilter.name || 'Custom Filter';
            
            generatingText.textContent = 'Starting camera...';
            await new Promise(resolve => setTimeout(resolve, 500));

            // Start camera and show camera screen
            showScreen('camera');
            
            const cameraStarted = await Camera.start();
            
            if (cameraStarted) {
                Camera.setFilter(currentFilter);
            } else {
                alert('Unable to access camera. Please ensure you have granted camera permissions.');
                showScreen('quiz');
            }
        } catch (error) {
            console.error('Filter generation error:', error);
            
            // Show error and offer fallback
            generatingTitle.textContent = 'Generation Failed';
            generatingText.innerHTML = `
                <span style="color: #ff5252;">${error.message}</span>
                <br><br>
                <button id="use-fallback-btn" class="secondary-btn" style="margin-top: 16px;">
                    Use Basic Algorithm
                </button>
                <button id="retry-btn" class="primary-btn" style="margin-top: 8px;">
                    Retry
                </button>
            `;

            // Add fallback button handler
            document.getElementById('use-fallback-btn').addEventListener('click', async () => {
                generatingTitle.textContent = 'Crafting Your Filter';
                generatingText.textContent = 'Using fallback algorithm...';
                
                currentFilter = FilterEngine.calculateFilterFallback(results);
                currentFilterName = 'Natural Light';
                
                await new Promise(resolve => setTimeout(resolve, 500));
                generatingText.textContent = 'Starting camera...';
                await new Promise(resolve => setTimeout(resolve, 500));

                showScreen('camera');
                const cameraStarted = await Camera.start();
                
                if (cameraStarted) {
                    Camera.setFilter(currentFilter);
                } else {
                    alert('Unable to access camera.');
                    showScreen('quiz');
                }
            });

            // Add retry button handler
            document.getElementById('retry-btn').addEventListener('click', () => {
                generatingTitle.textContent = 'Crafting Your Filter';
                handleQuizComplete(results);
            });
        }
    }

    /**
     * Handle photo capture
     */
    function handleCapture() {
        // Add capture animation
        buttons.capture.classList.add('capturing');
        
        // Flash effect
        const flash = document.createElement('div');
        flash.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: white;
            opacity: 0;
            z-index: 1000;
            pointer-events: none;
            animation: flash 0.3s ease-out;
        `;
        
        // Add flash animation style if not exists
        if (!document.getElementById('flash-style')) {
            const style = document.createElement('style');
            style.id = 'flash-style';
            style.textContent = `
                @keyframes flash {
                    0% { opacity: 0.8; }
                    100% { opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(flash);
        
        setTimeout(() => {
            flash.remove();
            buttons.capture.classList.remove('capturing');
        }, 300);

        // Capture photo
        capturedPhotoUrl = Camera.capture();
        
        if (capturedPhotoUrl) {
            // Show result screen
            const capturedPhoto = document.getElementById('captured-photo');
            capturedPhoto.src = capturedPhotoUrl;
            showScreen('result');
        }
    }

    /**
     * Handle save filter button click
     */
    function handleSaveFilterClick() {
        if (!Auth.isLoggedIn()) {
            // Show auth screen
            alert('Please sign in to save filters');
            showScreen('auth');
            return;
        }

        // Open save modal
        openSaveModal();
    }

    /**
     * Open save filter modal
     */
    function openSaveModal() {
        if (!modal.container) return;
        
        modal.container.classList.remove('hidden');
        modal.nameInput.value = currentFilterName || FilterEngine.generateFilterName(currentFilter);
        modal.error.classList.add('hidden');
        
        setTimeout(() => modal.nameInput.focus(), 100);
    }

    /**
     * Close save filter modal
     */
    function closeSaveModal() {
        if (modal.container) {
            modal.container.classList.add('hidden');
        }
    }

    /**
     * Handle save filter confirm
     */
    async function handleSaveFilterConfirm() {
        const name = modal.nameInput.value.trim();
        
        if (!name) {
            modal.error.textContent = 'Please enter a filter name';
            modal.error.classList.remove('hidden');
            return;
        }

        modal.confirmBtn.disabled = true;
        modal.confirmBtn.textContent = 'Saving...';

        try {
            await FilterStore.saveFilter(name, currentFilter, 'quiz');
            closeSaveModal();
            
            // Show success feedback
            const saveBtn = buttons.saveFilter;
            if (saveBtn) {
                saveBtn.classList.add('saved');
                setTimeout(() => saveBtn.classList.remove('saved'), 2000);
            }
        } catch (error) {
            console.error('Save filter error:', error);
            modal.error.textContent = error.message || 'Failed to save filter';
            modal.error.classList.remove('hidden');
        } finally {
            modal.confirmBtn.disabled = false;
            modal.confirmBtn.textContent = 'Save Filter';
        }
    }

    /**
     * Return to camera screen with filter preserved
     */
    async function returnToCamera() {
        showScreen('camera');
        
        // If camera isn't active, restart it with the same filter
        if (!Camera.isActive()) {
            const cameraStarted = await Camera.start();
            if (cameraStarted && currentFilter) {
                Camera.setFilter(currentFilter);
            }
        }
    }

    /**
     * Handle photo download
     */
    function handleDownload() {
        if (!capturedPhotoUrl) return;

        // Create download link
        const link = document.createElement('a');
        link.href = capturedPhotoUrl;
        
        // Generate filename with filter name
        const filterName = (currentFilterName || FilterEngine.generateFilterName(currentFilter))
            .toLowerCase()
            .replace(/\s+/g, '-');
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
        link.download = `plart-${filterName}-${timestamp}.jpg`;
        
        // Trigger download
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    /**
     * Set current filter (used by dashboard when selecting a saved filter)
     */
    function setCurrentFilter(params, name) {
        currentFilter = params;
        currentFilterName = name;
    }

    /**
     * Get current filter
     */
    function getFilter() {
        return currentFilter;
    }

    /**
     * Get current screen
     */
    function getCurrentScreen() {
        return currentScreen;
    }

    // Public API
    return {
        init,
        showScreen,
        setCurrentFilter,
        getFilter,
        getCurrentScreen
    };
})();

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
