/**
 * App Controller
 * Orchestrates screen transitions and connects all modules
 */

const App = (function() {
    // State
    let currentScreen = 'welcome';
    let currentFilter = null;
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
            quiz: document.getElementById('quiz-screen'),
            generating: document.getElementById('generating-screen'),
            camera: document.getElementById('camera-screen'),
            result: document.getElementById('result-screen')
        };

        buttons = {
            startQuiz: document.getElementById('start-quiz-btn'),
            settings: document.getElementById('settings-btn'),
            quizBack: document.getElementById('quiz-back-btn'),
            cameraBack: document.getElementById('camera-back-btn'),
            toggleParams: document.getElementById('toggle-params-btn'),
            flipCamera: document.getElementById('flip-camera-btn'),
            capture: document.getElementById('capture-btn'),
            retakeQuiz: document.getElementById('retake-quiz-btn'),
            resultBack: document.getElementById('result-back-btn'),
            retake: document.getElementById('retake-btn'),
            download: document.getElementById('download-btn')
        };

        modal = {
            container: document.getElementById('api-modal'),
            backdrop: document.querySelector('.modal-backdrop'),
            closeBtn: document.getElementById('close-modal-btn'),
            input: document.getElementById('api-key-input'),
            saveBtn: document.getElementById('save-api-key-btn')
        };

        // Initialize modules
        Quiz.init();
        Camera.init();

        // Set up event listeners
        setupEventListeners();

        // Set up quiz completion callback
        Quiz.onComplete(handleQuizComplete);

        // Load existing API key if present
        if (FilterEngine.hasApiKey()) {
            modal.input.value = '••••••••••••••••••••';
        }

        // Hide settings button if key is from config file
        if (FilterEngine.isKeyFromConfig()) {
            buttons.settings.style.display = 'none';
        }
    }

    /**
     * Set up all event listeners
     */
    function setupEventListeners() {
        // Welcome screen
        buttons.startQuiz.addEventListener('click', handleStartQuiz);
        buttons.settings.addEventListener('click', openModal);

        // Modal
        modal.closeBtn.addEventListener('click', closeModal);
        modal.backdrop.addEventListener('click', closeModal);
        modal.saveBtn.addEventListener('click', saveApiKey);
        modal.input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') saveApiKey();
        });
        // Clear placeholder when focusing if it's masked
        modal.input.addEventListener('focus', () => {
            if (modal.input.value === '••••••••••••••••••••') {
                modal.input.value = '';
            }
        });

        // Quiz screen
        buttons.quizBack.addEventListener('click', () => {
            showScreen('welcome');
        });

        // Camera screen
        buttons.cameraBack.addEventListener('click', async () => {
            Camera.stop();
            showScreen('quiz');
        });

        buttons.toggleParams.addEventListener('click', () => {
            Camera.toggleParamsPanel();
        });

        buttons.flipCamera.addEventListener('click', async () => {
            await Camera.flip();
        });

        buttons.capture.addEventListener('click', handleCapture);

        buttons.retakeQuiz.addEventListener('click', () => {
            Camera.stop();
            showScreen('quiz');
            Quiz.reset();
        });

        // Result screen
        buttons.resultBack.addEventListener('click', () => {
            showScreen('camera');
        });

        buttons.retake.addEventListener('click', () => {
            showScreen('camera');
        });

        buttons.download.addEventListener('click', handleDownload);
    }

    /**
     * Handle start quiz button click
     */
    function handleStartQuiz() {
        if (!FilterEngine.hasApiKey()) {
            // Show modal to enter API key
            openModal();
            showError('Please enter your OpenAI API key to continue.');
            return;
        }

        showScreen('quiz');
        Quiz.reset();
    }

    /**
     * Open API key modal
     */
    function openModal() {
        modal.container.classList.remove('hidden');
        clearError();
        // Focus input after animation
        setTimeout(() => modal.input.focus(), 100);
    }

    /**
     * Close API key modal
     */
    function closeModal() {
        modal.container.classList.add('hidden');
    }

    /**
     * Save API key from modal
     */
    function saveApiKey() {
        const key = modal.input.value.trim();
        
        if (!key) {
            showError('Please enter an API key.');
            return;
        }

        if (key.length < 10) {
            showError('Invalid API key format. Please enter a valid OpenRouter key.');
            return;
        }

        FilterEngine.setApiKey(key);
        modal.input.value = '••••••••••••••••••••';
        closeModal();
        
        // If user was trying to start quiz, continue
        if (currentScreen === 'welcome') {
            showScreen('quiz');
            Quiz.reset();
        }
    }

    /**
     * Show error message in modal
     */
    function showError(message) {
        clearError();
        const errorEl = document.createElement('div');
        errorEl.className = 'error-message';
        errorEl.textContent = message;
        modal.input.parentElement.insertAdjacentElement('beforebegin', errorEl);
    }

    /**
     * Clear error message
     */
    function clearError() {
        const existing = document.querySelector('.modal-body .error-message');
        if (existing) existing.remove();
    }

    /**
     * Show a specific screen
     * @param {string} screenName - Name of the screen to show
     */
    function showScreen(screenName) {
        // Hide all screens
        Object.values(screens).forEach(screen => {
            screen.classList.remove('active');
        });

        // Show target screen
        if (screens[screenName]) {
            screens[screenName].classList.add('active');
            currentScreen = screenName;
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
     * Handle photo download
     */
    function handleDownload() {
        if (!capturedPhotoUrl) return;

        // Create download link
        const link = document.createElement('a');
        link.href = capturedPhotoUrl;
        
        // Generate filename with filter name
        const filterName = FilterEngine.generateFilterName(currentFilter)
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
        getFilter,
        getCurrentScreen
    };
})();

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
