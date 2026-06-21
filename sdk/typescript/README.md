# dnsofmoney — TypeScript SDK

Resolve, register, send to, and check availability of `pay:` aliases using the DNS of Money API.

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

### Preview a payment (dry-run, no API key)

```typescript
import { sendPreview } from "dnsofmoney";

const preview = await sendPreview("pay:vendor.alpha");
console.log(preview.resolved, preview.rail, preview.destination_address);
```

### Send money to a pay: alias

```typescript
import { send } from "dnsofmoney";

const receipt = await send("pay:vendor.alpha", 5.0, "fas_live_...", {
  currency: "XRP",
  memo: "invoice 1234",
  // idempotencyKey auto-generated if omitted — safe to retry
});
console.log(receipt.status, receipt.rail, receipt.tx_hash);
```

### Client instance (reuse connections)

```typescript
import { DNSOfMoneyClient } from "dnsofmoney";

const client = new DNSOfMoneyClient({ apiKey: "fas_live_..." });
const result = await client.resolve("pay:vendor.alpha");
const available = await client.checkAvailability("pay:new.name");
const preview = await client.sendPreview("pay:vendor.alpha");
const receipt = await client.send("pay:vendor.alpha", 5.0, { currency: "XRP" });
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
