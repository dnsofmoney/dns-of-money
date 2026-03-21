#!/bin/bash
# Resolve a pay: alias to its payment endpoints.
# No authentication required for basic resolution.
curl -s https://api.dnsofmoney.com/v1/resolve/pay:vendor.alpha | python3 -m json.tool
