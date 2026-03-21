# dnsofmoney — TypeScript SDK

Resolve, register, and check availability of `pay:` aliases using the DNS of Money API.

**No external dependencies** — uses only the built-in `fetch()` API.

## Install

```bash
npm install dnsofmoney
```

> Not yet on npm — coming soon. For now, clone the repo and build from source:
> ```bash
> cd sdk/typescript && npm install && npm run build
> ```

## Quick Start

### Resolve a pay: alias

```typescript
import { resolve } from "dnsofmoney";

const result = await resolve("pay:vendor.alpha");
console.log(result.entity?.display_name);
console.log(result.endpoints[0].rail);
console.log(result.resolution_status);
```

### Register a pay: alias

```typescript
import { register } from "dnsofmoney";

const result = await register(
  "pay:your.name",
  "Your Name",
  "fednow",
  "fas_live_...",
);
console.log(result.alias_name);
console.log(result.registration_number);
```

### Check availability

```typescript
import { checkAvailability } from "dnsofmoney";

const available = await checkAvailability("pay:desired.name");
console.log(available ? "Available!" : "Taken.");
```

### Client instance (reuse connections)

```typescript
import { DNSOfMoneyClient } from "dnsofmoney";

const client = new DNSOfMoneyClient({ apiKey: "fas_live_..." });
const result = await client.resolve("pay:vendor.alpha");
const available = await client.checkAvailability("pay:new.name");
```

## Error Handling

```typescript
import { resolve, AliasNotFoundError, AuthenticationError } from "dnsofmoney";

try {
  const result = await resolve("pay:nonexistent.alias");
} catch (err) {
  if (err instanceof AliasNotFoundError) {
    console.log("Alias does not exist");
  } else if (err instanceof AuthenticationError) {
    console.log("Invalid API key");
  }
}
```

## Links

- [Full documentation](https://docs.dnsofmoney.com)
- [FAS-1 specification](https://github.com/dnsofmoney/dns-of-money/blob/main/docs/FAS-1-spec.md)
- [Examples](https://github.com/dnsofmoney/dns-of-money/tree/main/examples)
- [JSON schemas](https://github.com/dnsofmoney/dns-of-money/tree/main/schemas)
