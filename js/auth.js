/**
 * Authentication Module
 * Handles user signup, login, logout, and session management via Supabase
 */

const Auth = (function() {
    let currentUser = null;
    let authStateListeners = [];
    let isSignUpMode = false;

    // DOM Elements
    let elements = {};

    /**
     * Initialize the auth module
     */
    function init() {
        elements = {
            authScreen: document.getElementById('auth-screen'),
            authForm: document.getElementById('auth-form'),
            authEmail: document.getElementById('auth-email'),
            authPassword: document.getElementById('auth-password'),
            authSubmitBtn: document.getElementById('auth-submit-btn'),
            authToggleBtn: document.getElementById('auth-toggle-btn'),
            authSwitchText: document.getElementById('auth-switch-text'),
            authSubtitle: document.getElementById('auth-subtitle'),
            authError: document.getElementById('auth-error'),
            authBackBtn: document.getElementById('auth-back-btn'),
            welcomeAuthBtn: document.getElementById('welcome-auth-btn'),
            myFiltersBtn: document.getElementById('my-filters-btn')
        };

        setupEventListeners();
        checkSession();

        // Listen for auth state changes
        if (Supabase.isConfigured()) {
            const client = Supabase.getClient();
            client.auth.onAuthStateChange((event, session) => {
                handleAuthStateChange(event, session);
            });
        }
    }

    /**
     * Set up event listeners
     */
    function setupEventListeners() {
        if (elements.authForm) {
            elements.authForm.addEventListener('submit', handleAuthSubmit);
        }
        if (elements.authToggleBtn) {
            elements.authToggleBtn.addEventListener('click', toggleAuthMode);
        }
        if (elements.authBackBtn) {
            elements.authBackBtn.addEventListener('click', () => {
                App.showScreen('welcome');
            });
        }
    }

    /**
     * Check for existing session on load
     */
    async function checkSession() {
        if (!Supabase.isConfigured()) {
            updateUIForGuest();
            return;
        }

        try {
            const user = await Supabase.getUser();
            if (user) {
                currentUser = user;
                updateUIForLoggedIn(user);
                notifyListeners(user);
            } else {
                updateUIForGuest();
                notifyListeners(null);
            }
        } catch (error) {
            console.error('Session check error:', error);
            updateUIForGuest();
        }
    }

    /**
     * Handle auth state changes
     */
    function handleAuthStateChange(event, session) {
        console.log('Auth state change:', event);
        
        if (event === 'SIGNED_IN' && session?.user) {
            currentUser = session.user;
            updateUIForLoggedIn(session.user);
            notifyListeners(session.user);
        } else if (event === 'SIGNED_OUT') {
            currentUser = null;
            updateUIForGuest();
            notifyListeners(null);
        }
    }

    /**
     * Handle auth form submission
     */
    async function handleAuthSubmit(e) {
        e.preventDefault();
        
        if (!Supabase.isConfigured()) {
            showError('User accounts are not configured. Please set up Supabase.');
            return;
        }

        const email = elements.authEmail.value.trim();
        const password = elements.authPassword.value;

        if (!email || !password) {
            showError('Please enter email and password.');
            return;
        }

        setLoading(true);
        clearError();

        try {
            const client = Supabase.getClient();
            let result;

            if (isSignUpMode) {
                result = await client.auth.signUp({
                    email,
                    password
                });
            } else {
                result = await client.auth.signInWithPassword({
                    email,
                    password
                });
            }

            if (result.error) {
                throw result.error;
            }

            // Success - auth state change listener will handle UI updates
            elements.authForm.reset();
            
            // Navigate based on context
            if (App.getCurrentScreen() === 'auth') {
                App.showScreen('dashboard');
            }
        } catch (error) {
            console.error('Auth error:', error);
            showError(error.message || 'Authentication failed. Please try again.');
        } finally {
            setLoading(false);
        }
    }

    /**
     * Toggle between sign in and sign up modes
     */
    function toggleAuthMode() {
        isSignUpMode = !isSignUpMode;
        
        if (isSignUpMode) {
            elements.authSubmitBtn.querySelector('span').textContent = 'Sign Up';
            elements.authToggleBtn.textContent = 'Sign In';
            elements.authSwitchText.textContent = 'Already have an account?';
            elements.authSubtitle.textContent = 'Create an account to save your filters';
        } else {
            elements.authSubmitBtn.querySelector('span').textContent = 'Sign In';
            elements.authToggleBtn.textContent = 'Sign Up';
            elements.authSwitchText.textContent = "Don't have an account?";
            elements.authSubtitle.textContent = 'Sign in to save your filters';
        }
        
        clearError();
    }

    /**
     * Sign out the current user
     */
    async function signOut() {
        if (!Supabase.isConfigured()) return;

        try {
            const client = Supabase.getClient();
            await client.auth.signOut();
            currentUser = null;
            updateUIForGuest();
            notifyListeners(null);
            App.showScreen('welcome');
        } catch (error) {
            console.error('Sign out error:', error);
        }
    }

    /**
     * Update UI for logged in state
     */
    function updateUIForLoggedIn(user) {
        if (elements.welcomeAuthBtn) {
            elements.welcomeAuthBtn.textContent = user.email?.split('@')[0] || 'Account';
        }
        if (elements.myFiltersBtn) {
            elements.myFiltersBtn.classList.remove('hidden');
        }
    }

    /**
     * Update UI for guest state
     */
    function updateUIForGuest() {
        if (elements.welcomeAuthBtn) {
            elements.welcomeAuthBtn.textContent = 'Sign In';
        }
        if (elements.myFiltersBtn) {
            elements.myFiltersBtn.classList.add('hidden');
        }
    }

    /**
     * Show error message
     */
    function showError(message) {
        if (elements.authError) {
            elements.authError.textContent = message;
            elements.authError.classList.remove('hidden');
        }
    }

    /**
     * Clear error message
     */
    function clearError() {
        if (elements.authError) {
            elements.authError.textContent = '';
            elements.authError.classList.add('hidden');
        }
    }

    /**
     * Set loading state
     */
    function setLoading(loading) {
        if (elements.authSubmitBtn) {
            elements.authSubmitBtn.disabled = loading;
            if (loading) {
                elements.authSubmitBtn.classList.add('loading');
            } else {
                elements.authSubmitBtn.classList.remove('loading');
            }
        }
    }

    /**
     * Add auth state listener
     */
    function onAuthStateChange(callback) {
        authStateListeners.push(callback);
        // Call immediately with current state
        callback(currentUser);
    }

    /**
     * Notify all listeners of auth state change
     */
    function notifyListeners(user) {
        authStateListeners.forEach(callback => callback(user));
    }

    /**
     * Get current user
     */
    function getUser() {
        return currentUser;
    }

    /**
     * Check if user is logged in
     */
    function isLoggedIn() {
        return currentUser !== null;
    }

    /**
     * Check if Supabase is configured
     */
    function isEnabled() {
        return Supabase.isConfigured();
    }

    // Public API
    return {
        init,
        signOut,
        onAuthStateChange,
        getUser,
        isLoggedIn,
        isEnabled,
        checkSession
    };
})();
