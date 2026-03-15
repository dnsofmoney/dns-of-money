# Examples

## Resolve an alias
```bash
curl https://api.dnsofmoney.com/resolve/pay:vendor.alpha \
  -H "X-API-Key: your_key"
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

## Send a payment
```bash
curl -X POST https://api.dnsofmoney.com/payments \
  -H "X-API-Key: your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "creditor_alias": "pay:vendor.alpha",
    "amount": 125.00,
    "currency": "USD",
    "payment_purpose": "services"
  }'
```

## Python example
```python
import httpx

client = httpx.Client(
    base_url="https://api.dnsofmoney.com",
    headers={"X-API-Key": "your_key"}
)

# Resolve
result = client.get("/resolve/pay:vendor.alpha")
print(result.json())

# Pay
payment = client.post("/payments", json={
    "creditor_alias": "pay:vendor.alpha",
    "amount": 125.00,
    "currency": "USD"
})
print(payment.json())
```
