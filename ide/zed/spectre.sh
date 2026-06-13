#!/usr/bin/env bash
# Spectre Proxy helper for Zed
# Usage: ./spectre.sh <command> [args]
set -euo pipefail

PROXY_URL="${SPECTRE_PROXY_URL:-http://127.0.0.1:8082}"
API_KEY="${SPECTRE_API_KEY:-spectre-proxy}"
DASHBOARD_URL="${SPECTRE_DASHBOARD_URL:-http://localhost:3000}"

case "${1:-help}" in
  chat)
    # Send a chat message via the proxy (Anthropic-compatible format)
    MSG="${2:-Hello}"
    MODEL="${3:-}"
    echo "→ Sending: $MSG"
    curl -s -X POST "$PROXY_URL/v1/messages" \
      -H "Content-Type: application/json" \
      -H "x-api-key: $API_KEY" \
      -d "$(cat <<EOF
{
  "model": "$MODEL",
  "messages": [{"role": "user", "content": [{"type": "text", "text": "$MSG"}]}],
  "max_tokens": 4096,
  "stream": false
}
EOF
      )" | python3 -c "
import sys, json
data = json.load(sys.stdin)
if 'content' in data:
    for block in data['content']:
        if block.get('type') == 'text':
            print(block['text'])
elif 'error' in data:
    print(f'Error: {data[\"error\"]}')
else:
    print(json.dumps(data, indent=2))
"
    ;;

  stream)
    # Stream a chat response
    MSG="${2:-Hello}"
    MODEL="${3:-}"
    echo "→ Streaming: $MSG"
    curl -s -N -X POST "$PROXY_URL/v1/messages" \
      -H "Content-Type: application/json" \
      -H "x-api-key: $API_KEY" \
      -d "$(cat <<EOF
{
  "model": "$MODEL",
  "messages": [{"role": "user", "content": [{"type": "text", "text": "$MSG"}]}],
  "max_tokens": 4096,
  "stream": true
}
EOF
      )" | while IFS= read -r line; do
        if [[ "$line" =~ ^data:\  ]]; then
          local data="${line#data: }"
          if [[ "$data" != "[DONE]" ]] && [[ -n "$data" ]]; then
            echo "$data" | python3 -c "
import sys, json
try:
    d = json.loads(sys.stdin.read().strip())
    if d.get('type') == 'content_block_delta' and d.get('delta', {}).get('type') == 'text_delta':
        print(d['delta']['text'], end='')
except:
    pass
" 2>/dev/null || true
          fi
        fi
      done
    echo
    ;;

  status)
    # Check proxy health
    echo "→ Checking proxy at $PROXY_URL/health ..."
    curl -s "$PROXY_URL/health" | python3 -m json.tool 2>/dev/null || echo "Proxy not running"
    ;;

  dashboard)
    # Open dashboard in browser
    open "$DASHBOARD_URL"
    ;;

  activity)
    # Show recent activity (requires dashboard API)
    echo "→ Fetching activity..."
    curl -s "$DASHBOARD_URL/api/spectre-proxy/activity" 2>/dev/null | python3 -m json.tool 2>/dev/null || echo "Dashboard not running"
    ;;

  config)
    # Show current config
    echo "Proxy URL:    $PROXY_URL"
    echo "Dashboard:    $DASHBOARD_URL"
    echo "API Key:      ${API_KEY:0:4}..."
    ;;

  help|*)
    echo "Spectre Proxy Helper — Usage:"
    echo "  ./spectre.sh chat <message> [model]    Send a chat message"
    echo "  ./spectre.sh stream <message> [model]  Stream a chat response"
    echo "  ./spectre.sh status                    Check proxy health"
    echo "  ./spectre.sh dashboard                 Open dashboard in browser"
    echo "  ./spectre.sh activity                  Show recent activity"
    echo "  ./spectre.sh config                    Show current configuration"
    echo ""
    echo "Environment variables:"
    echo "  SPECTRE_PROXY_URL     (default: http://127.0.0.1:8082)"
    echo "  SPECTRE_API_KEY       (default: spectre-proxy)"
    echo "  SPECTRE_DASHBOARD_URL (default: http://localhost:3000)"
    ;;
esac
