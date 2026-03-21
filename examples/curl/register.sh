#!/bin/bash
# Register a new pay: alias. Requires an API key.
# Replace YOUR_API_KEY with your actual key.
curl -s -X POST https://api.dnsofmoney.com/v1/aliases \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "alias_name": "pay:yourcompany.payments",
    "display_name": "Your Company LLC",
    "preferred_rail": "fednow",
    "routing_number": "021000021",
    "account_number": "9876543210",
    "account_type": "checking"
  }' | python3 -m json.tool
