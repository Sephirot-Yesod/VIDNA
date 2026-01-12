/**
 * Build script for Vercel deployment
 * Generates js/config.js from environment variables
 */

const fs = require('fs');
const path = require('path');

const openrouterKey = process.env.OPENROUTER_API_KEY || '';
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

const configContent = `/**
 * Auto-generated during build - do not edit directly
 * Set environment variables to configure:
 * - OPENROUTER_API_KEY
 * - SUPABASE_URL
 * - SUPABASE_ANON_KEY
 */

const CONFIG = {
    OPENROUTER_API_KEY: '${openrouterKey}',
    SUPABASE_URL: '${supabaseUrl}',
    SUPABASE_ANON_KEY: '${supabaseAnonKey}'
};
`;

const configPath = path.join(__dirname, 'js', 'config.js');

fs.writeFileSync(configPath, configContent);

console.log('✓ Generated js/config.js');
if (openrouterKey) console.log('  - OpenRouter API key: configured');
else console.log('  - OpenRouter API key: missing');
if (supabaseUrl && supabaseAnonKey) console.log('  - Supabase: configured');
else console.log('  - Supabase: not configured (user features disabled)');
