/**
 * Supabase Client Configuration
 * Initialize Supabase client for auth, database, and storage
 */

const Supabase = (function() {
    let client = null;

    // Get config from config.js or environment
    function getConfig() {
        if (typeof CONFIG !== 'undefined') {
            return {
                url: CONFIG.SUPABASE_URL || '',
                anonKey: CONFIG.SUPABASE_ANON_KEY || ''
            };
        }
        return { url: '', anonKey: '' };
    }

    /**
     * Initialize Supabase client
     */
    function init() {
        const config = getConfig();
        
        if (!config.url || !config.anonKey) {
            console.warn('Supabase not configured. User features will be disabled.');
            return false;
        }

        try {
            client = supabase.createClient(config.url, config.anonKey);
            console.log('Supabase client initialized');
            return true;
        } catch (error) {
            console.error('Failed to initialize Supabase:', error);
            return false;
        }
    }

    /**
     * Get the Supabase client instance
     */
    function getClient() {
        return client;
    }

    /**
     * Check if Supabase is configured and ready
     */
    function isConfigured() {
        return client !== null;
    }

    /**
     * Get current session
     */
    async function getSession() {
        if (!client) return null;
        const { data: { session } } = await client.auth.getSession();
        return session;
    }

    /**
     * Get current user
     */
    async function getUser() {
        if (!client) return null;
        const { data: { user } } = await client.auth.getUser();
        return user;
    }

    // Public API
    return {
        init,
        getClient,
        isConfigured,
        getSession,
        getUser
    };
})();
