#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "=========================================================="
echo "🎙️  Starting EchoMe AI Voicemail & Call Gatekeeper Agent..."
echo "=========================================================="

# Check Ollama
if curl -s http://127.0.0.1:11434/api/tags > /dev/null 2>&1; then
  echo "✓ Local Ollama service detected and reachable."
else
  echo "⚠️  Ollama is not running on http://127.0.0.1:11434."
  echo "   If using cloud providers (Groq/OpenAI), ensure your API keys are in .env"
fi

# Run Node server
node src/server.js
