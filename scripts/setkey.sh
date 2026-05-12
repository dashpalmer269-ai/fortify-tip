#!/bin/bash
read -s -p "Paste API key: " KEY
echo ""
echo "$KEY" | npx vercel env add ANTHROPIC_API_KEY production --yes
echo "ANTHROPIC_API_KEY=$KEY" > /tmp/ak.txt
echo "Done."
