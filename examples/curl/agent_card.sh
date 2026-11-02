#!/bin/bash
# Fetch the A2A-003 agent card (capabilities manifest).
# No authentication required.
curl -s https://api.dnsofmoney.com/.well-known/agent.json | python3 -m json.tool
