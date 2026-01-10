#!/bin/bash
# Reads .env and generates js/config.js

# Load .env
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

# Generate config.js
cat > js/config.js << EOF
/**
 * Auto-generated from .env - do not edit directly
 * Run ./setup.sh to regenerate
 */

const CONFIG = {
    OPENROUTER_API_KEY: '${OPENROUTER_API_KEY}'
};
EOF

echo "✓ Generated js/config.js from .env"

