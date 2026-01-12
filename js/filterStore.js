/**
 * Filter Store Module
 * Handles CRUD operations for filters in Supabase database
 */

const FilterStore = (function() {
    // Cache of user's filters
    let filtersCache = [];
    let filterChangeListeners = [];

    /**
     * Get all filters for the current user
     */
    async function getFilters() {
        if (!Supabase.isConfigured() || !Auth.isLoggedIn()) {
            return [];
        }

        try {
            const client = Supabase.getClient();
            const { data, error } = await client
                .from('filters')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            filtersCache = data || [];
            return filtersCache;
        } catch (error) {
            console.error('Error fetching filters:', error);
            return [];
        }
    }

    /**
     * Get a single filter by ID
     */
    async function getFilter(filterId) {
        if (!Supabase.isConfigured() || !Auth.isLoggedIn()) {
            return null;
        }

        try {
            const client = Supabase.getClient();
            const { data, error } = await client
                .from('filters')
                .select('*')
                .eq('id', filterId)
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error fetching filter:', error);
            return null;
        }
    }

    /**
     * Save a new filter
     */
    async function saveFilter(name, params, source = 'quiz') {
        if (!Supabase.isConfigured()) {
            throw new Error('Database not configured');
        }
        
        if (!Auth.isLoggedIn()) {
            throw new Error('Please sign in to save filters');
        }

        const user = Auth.getUser();

        try {
            const client = Supabase.getClient();
            const { data, error } = await client
                .from('filters')
                .insert({
                    user_id: user.id,
                    name: name,
                    params: params,
                    source: source
                })
                .select()
                .single();

            if (error) throw error;

            // Update cache
            filtersCache.unshift(data);
            notifyListeners();

            return data;
        } catch (error) {
            console.error('Error saving filter:', error);
            throw error;
        }
    }

    /**
     * Update an existing filter
     */
    async function updateFilter(filterId, updates) {
        if (!Supabase.isConfigured() || !Auth.isLoggedIn()) {
            throw new Error('Not authenticated');
        }

        try {
            const client = Supabase.getClient();
            const { data, error } = await client
                .from('filters')
                .update({
                    name: updates.name,
                    params: updates.params,
                    source: updates.source
                })
                .eq('id', filterId)
                .select()
                .single();

            if (error) throw error;

            // Update cache
            const index = filtersCache.findIndex(f => f.id === filterId);
            if (index !== -1) {
                filtersCache[index] = data;
            }
            notifyListeners();

            return data;
        } catch (error) {
            console.error('Error updating filter:', error);
            throw error;
        }
    }

    /**
     * Delete a filter
     */
    async function deleteFilter(filterId) {
        if (!Supabase.isConfigured() || !Auth.isLoggedIn()) {
            throw new Error('Not authenticated');
        }

        try {
            const client = Supabase.getClient();
            const { error } = await client
                .from('filters')
                .delete()
                .eq('id', filterId);

            if (error) throw error;

            // Update cache
            filtersCache = filtersCache.filter(f => f.id !== filterId);
            notifyListeners();

            return true;
        } catch (error) {
            console.error('Error deleting filter:', error);
            throw error;
        }
    }

    /**
     * Get cached filters (without fetching)
     */
    function getCachedFilters() {
        return filtersCache;
    }

    /**
     * Clear cache (on logout)
     */
    function clearCache() {
        filtersCache = [];
        notifyListeners();
    }

    /**
     * Add listener for filter changes
     */
    function onFiltersChange(callback) {
        filterChangeListeners.push(callback);
    }

    /**
     * Remove listener
     */
    function offFiltersChange(callback) {
        filterChangeListeners = filterChangeListeners.filter(cb => cb !== callback);
    }

    /**
     * Notify listeners of changes
     */
    function notifyListeners() {
        filterChangeListeners.forEach(callback => callback(filtersCache));
    }

    /**
     * Convert filter params to a preview-friendly format
     */
    function formatFilterParams(params) {
        return {
            brightness: params.brightness || 1.0,
            contrast: params.contrast || 1.0,
            saturation: params.saturation || 1.0,
            temperature: params.temperature || 0,
            tint: params.tint || 0,
            grain: params.grain || 0,
            vignette: params.vignette || 0,
            fade: params.fade || 0
        };
    }

    // Listen for auth changes to clear cache on logout
    if (typeof Auth !== 'undefined') {
        // Will be called after Auth.init()
        setTimeout(() => {
            Auth.onAuthStateChange((user) => {
                if (!user) {
                    clearCache();
                }
            });
        }, 0);
    }

    // Public API
    return {
        getFilters,
        getFilter,
        saveFilter,
        updateFilter,
        deleteFilter,
        getCachedFilters,
        clearCache,
        onFiltersChange,
        offFiltersChange,
        formatFilterParams
    };
})();
