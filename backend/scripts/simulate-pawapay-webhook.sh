#!/usr/bin/env bash
# Simule un callback PawaPay v2 (sans signature — OK en dev si PAWAPAY_WEBHOOK_SECRET vide).
# Usage:
#   ./scripts/simulate-pawapay-webhook.sh deposit <depositUuid> [amount] [currency]
#   ./scripts/simulate-pawapay-webhook.sh payout   <payoutUuid>   [amount] [currency]
set -euo pipefail
API="${API_URL:-http://localhost:4000}"
KIND="${1:?deposit|payout}"
ID="${2:?uuid}"
AMOUNT="${3:-100}"
CUR="${4:-CDF}"

if [[ "$KIND" == "deposit" ]]; then
  BODY=$(jq -nc \
    --arg id "$ID" \
    --arg amt "$AMOUNT" \
    --arg cur "$CUR" \
    '{depositId:$id,status:"COMPLETED",amount:$amt,currency:$cur}')
elif [[ "$KIND" == "payout" ]]; then
  BODY=$(jq -nc \
    --arg id "$ID" \
    --arg amt "$AMOUNT" \
    --arg cur "$CUR" \
    '{payoutId:$id,status:"COMPLETED",amount:$amt,currency:$cur}')
else
  echo "usage: $0 deposit|payout <uuid> [amount] [currency]" >&2
  exit 1
fi

curl -sS -X POST "$API/api/webhooks/pawapay" \
  -H "Content-Type: application/json" \
  -d "$BODY" | jq .
