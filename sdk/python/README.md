# dnsofmoney — Python SDK

Resolve, register, and check availability of `pay:` aliases using the DNS of Money API.

**No external dependencies** — uses only the Python standard library.

## Install

```bash
pip install dnsofmoney
```

> Not yet on PyPI — coming soon. For now, install from source:
> ```bash
> cd sdk/python && pip install -e .
> ```

## Quick Start

### Resolve a pay: alias

```python
from dnsofmoney import resolve

result = resolve("pay:vendor.alpha")
print(result.entity.display_name)
print(result.endpoints[0].rail)
print(result.resolution_status)
```

### Register a pay: alias

```python
from dnsofmoney import register

result = register(
    alias_name="pay:your.name",
    display_name="Your Name",
    preferred_rail="fednow",
    api_key="fas_live_...",
    routing_number="021000021",
    account_number="9876543210",
)
print(result.alias_name)
print(result.registration_number)
```

### Check availability

```python
from dnsofmoney import check_availability

available = check_availability("pay:desired.name")
print("Available!" if available else "Taken.")
```

### Client instance (reuse connections)

```python
from dnsofmoney import DNSOfMoneyClient

client = DNSOfMoneyClient(api_key="fas_live_...")
result = client.resolve("pay:vendor.alpha")
available = client.check_availability("pay:new.name")
```

## Error Handling

```python
from dnsofmoney import resolve, AliasNotFoundError, AuthenticationError

try:
    result = resolve("pay:nonexistent.alias")
except AliasNotFoundError:
    print("Alias does not exist")
except AuthenticationError:
    print("Invalid API key")
```

## Links

- [Full documentation](https://docs.dnsofmoney.com)
- [FAS-1 specification](https://github.com/dnsofmoney/dns-of-money/blob/main/docs/FAS-1-spec.md)
- [Examples](https://github.com/dnsofmoney/dns-of-money/tree/main/examples)
- [JSON schemas](https://github.com/dnsofmoney/dns-of-money/tree/main/schemas)
