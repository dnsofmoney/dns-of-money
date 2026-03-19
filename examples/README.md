# Examples

## Resolve an alias

```bash
curl -H "X-API-Key: your_key" \
  https://api.dnsofmoney.com/api/v1/resolve/pay:vendor.alpha
```

**Response:**
```json
{
  "alias_name": "pay:vendor.alpha",
  "display_name": "Alpha Vendors LLC",
  "preferred_rail": "fednow",
  "account_type": "checking",
  "is_active": true,
  "resolved": true
}
```

## Register an alias

```bash
curl -X POST https://api.dnsofmoney.com/api/v1/aliases \
  -H "X-API-Key: your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "alias_name": "pay:your.name",
    "preferred_rail": "fednow",
    "routing_number": "021000021",
    "account_number": "9999999999"
  }'
```

## Python SDK

```python
from sdk import PayClient

client = PayClient(api_key="your_key")

# Resolve
result = client.resolve("pay:vendor.alpha")
print(f"{result.alias_name} → {result.preferred_rail}")

# Check availability
status = client.check_availability("pay:my.name")
print(f"Status: {status}")

# Register
if status == "available":
    alias = client.register(
        alias_name="pay:my.name",
        preferred_rail="fednow",
        routing_number="021000021",
        account_number="9876543210",
        display_name="My Company LLC"
    )
    print(f"Registered: {alias.alias_name}")
```

## Health check (no auth)

```bash
curl https://api.dnsofmoney.com/health
```

```json
{
  "status": "healthy",
  "service": "financial-autonomy-stack",
  "version": "0.1.0"
}
```
