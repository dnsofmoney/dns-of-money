#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────────────────
# Send money to a pay: alias — DNS://Money API
#
# Two operations:
#   1. Preview (public, no auth) — see where money would go
#   2. Send (requires API key)   — execute the payment
#
# Usage:
#   bash send.sh                          # preview only
#   API_KEY=fas_live_... bash send.sh     # preview + send
# ───────────────────────────────────────────────────────────────────────

BASE="https://api.dnsofmoney.com"
ALIAS="pay:dnsofmoney"

echo "=== Preview: $ALIAS ==="
curl -s "$BASE/api/v1/send/preview/$ALIAS" | python3 -m json.tool
echo ""

if [ -z "$API_KEY" ]; then
    echo "Preview only. To send a real payment:"
    echo "  API_KEY=fas_live_... bash send.sh"
    exit 0
fi

echo "=== Send \$5.00 to $ALIAS ==="
IDEM_KEY="curl-example-$(openssl rand -hex 16)"

curl -s -X POST "$BASE/api/v1/send" \
    -H "X-API-Key: $API_KEY" \
    -H "Content-Type: application/json" \
    -d "{
        \"alias\": \"$ALIAS\",
        \"amount\": 5.00,
        \"currency\": \"USD\",
        \"memo\": \"curl example\",
        \"idempotency_key\": \"$IDEM_KEY\"
    }" | python3 -m json.tool
