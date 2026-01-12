/**
 * Build script for Vercel deployment
 * Generates js/config.js from environment variables
 */

const fs = require('fs');
const path = require('path');

const apiKey = process.env.OPENROUTER_API_KEY || '';

const configContent = `/**
 * Auto-generated during build - do not edit directly
 * Set OPENROUTER_API_KEY environment variable to configure
 */

const CONFIG = {
    OPENROUTER_API_KEY: '${apiKey}'
};
`;

const configPath = path.join(__dirname, 'js', 'config.js');

fs.writeFileSync(configPath, configContent);

if (apiKey) {
    console.log('✓ Generated js/config.js with API key');
} else {
    console.log('⚠ Generated js/config.js (no API key found in environment)');
}
