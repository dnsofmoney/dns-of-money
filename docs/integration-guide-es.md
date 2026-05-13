# Guia de Integracion

Comienza a resolver y acunar nombres `pay:`.

## Enlaces Rapidos

- [Resolver un alias pay:](#resolver-un-alias-pay) (para desarrolladores integrando resolucion)
- [Acunar un nombre fundador](#acunar-un-nombre-fundador) (para usuarios que quieren un nombre pay:)
- [Referencia de API](#campos-de-respuesta-tier-3)
- [SDKs](#sdks)

---

## Acunar un Nombre Fundador

El tier fundador esta activo. 600 nombres en total. Una vez agotados, el tier se cierra permanentemente.

### Precio Escalonado

| Acunaciones | Precio | Espacios |
|-------------|--------|----------|
| 1-10 | Gratis (1 drop) | 10 (completados) |
| 11-79 | 1 XRP | ~50 |
| 80-129 | 2 XRP | 50 |
| 130-179 | 3 XRP | 50 |
| 180-229 | 4 XRP | 50 |
| 230-600 | 5 XRP | 371 |

El precio aumenta automaticamente a medida que cada tier se llena. Consulta el precio actual:

```bash
curl https://api.dnsofmoney.com/api/v1/founding/status
```

Devuelve `price_xrp`, `slots_at_price` y `tier_label`.

### Como Acunar

1. **Ve a [dnsofmoney.com](https://dnsofmoney.com)** y haz clic en "Mint your name"
2. **Elige tu nombre** — escribelo y verifica disponibilidad
3. **Conecta tu wallet Xaman (XUMM)** — escanea el QR o toca el deeplink en movil
4. **Firma el pago** — se muestra el precio actual en XRP. Un toque en Xaman.
5. **Espera tu identidad** — el sistema genera una llama fractal unica, la sube a IPFS, y acuna un NFT XLS-20 en XRPL mainnet
6. **Reclama tu NFT** — escanea el QR de reclamo para aceptar el NFT en tu wallet

### Reglas

- Un nombre por wallet XRPL
- Nombres de una sola etiqueta permitidos (ej: `pay:tunombre`)
- Los nombres fundadores mantienen permanentemente su precio de tier fundador
- Cada nombre recibe una identidad NFT generativa que evoluciona con el uso
- Prueba on-chain via transaccion memo FAS-1 en XRPL

### Consultar Estado Actual

```bash
curl https://api.dnsofmoney.com/api/v1/founding/status
```

```json
{
  "success": true,
  "data": {
    "total": 600,
    "claimed": 31,
    "remaining": 569,
    "price_xrp": "1",
    "tier_label": "1 XRP (48 left at this price)",
    "slots_at_price": 48
  }
}
```

### Verificar Disponibilidad

```bash
curl https://api.dnsofmoney.com/api/v1/founding/available/pay:tunombre
```

---

## URL Base

```
https://api.dnsofmoney.com
```

## Autenticacion

Pasa tu clave API via el header `X-API-Key`. La resolucion funciona sin clave (tier 0) pero devuelve campos redactados. Tiers mas altos desbloquean mas datos.

| Tier | Acceso | Campos |
|------|--------|--------|
| 0 | Sin clave | alias, status, resolution_id, message_id |
| 1 | Clave lectura | + entity, endpoints (routing redactado) |
| 2 | Clave estandar | + routing metadata completo, compliance |
| 3 | Clave admin | + bloque identidad, rail_score, cache_hit |

## Resolver un Alias pay:

```
GET /resolve/pay:{nombre}
```

### curl

```bash
# Tier 0 (sin clave)
curl https://api.dnsofmoney.com/resolve/pay:architect

# Tier 3 (acceso completo)
curl -H "X-API-Key: fas_live_..." \
  https://api.dnsofmoney.com/resolve/pay:architect
```

### Python

```python
from dnsofmoney import DNSOfMoneyClient

client = DNSOfMoneyClient(api_key="fas_live_...")
result = client.resolve("pay:architect")

# Endpoint de pago
ep = result.endpoints[0]
print(ep.rail)                         # "xrpl"
print(ep.routing_metadata["xrpl_address"])  # "r3VG..."

# Identidad (tier 3)
print(result.identity.image_url)       # URL gateway IPFS
print(result.identity.nft_token_id)    # ID NFT XLS-20
print(result.identity.generation)      # generacion del genoma

# Compliance
print(result.compliance.result)        # "LOW"
print(result.compliance.screened)      # True

# Indicacion ISO 20022
print(result.iso20022_hint["message_family"])  # "pacs.008"
```

### TypeScript

```typescript
import { DNSOfMoneyClient } from "dnsofmoney";

const client = new DNSOfMoneyClient({ apiKey: "fas_live_..." });
const result = await client.resolve("pay:architect");

// Endpoint de pago
const ep = result.endpoints[0];
console.log(ep.rail);                          // "xrpl"
console.log(ep.routingMetadata.xrplAddress);   // "r3VG..."

// Identidad (tier 3)
console.log(result.identity?.imageUrl);
console.log(result.identity?.nftTokenId);
```

## Sobre de Respuesta

Todas las respuestas estan envueltas:

```json
{
  "success": true,
  "data": { ... },
  "error_code": null,
  "message": null,
  "timestamp": "2026-03-24T21:59:44Z"
}
```

En caso de error:

```json
{
  "success": false,
  "data": null,
  "error_code": "ALIAS_NOT_FOUND",
  "message": "No alias registered for pay:nonexistent",
  "timestamp": "2026-03-24T21:59:44Z"
}
```

## Campos de Respuesta (Tier 3)

### Metadata de resolucion

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `resolution_id` | UUID | ID unico del evento de resolucion. Mapea a EndToEndId en ISO 20022. |
| `message_id` | string | Identificador de mensaje FAS-1 |
| `alias` | string | El alias `pay:` resuelto |
| `status` | string | `resolved`, `partial`, o `failed` |
| `resolved_at` | ISO 8601 | Cuando se realizo la resolucion |
| `cache_hit` | boolean | Si se sirvio desde cache |
| `caller_tier` | int | 0-3, tu tier de autenticacion |

### Endpoints

Endpoints de pago clasificados. Ordenados por prioridad (1 = mas alto).

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `rail_type` | string | `xrpl`, `ach`, `fednow`, `swift` |
| `currency` | string | Codigo ISO 4217 (`XRP`, `USD`) |
| `priority` | int | 1 = mas preferido |
| `routing_metadata` | object | Detalles de routing especificos del rail |
| `settlement_latency` | string | `3-5s`, `instant`, `1-3 days` |
| `fee_estimate` | string | Comision estimada |

### Bloque de Identidad

Presente en tier 3 para aliases con identidades NFT acunadas.

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `nft_token_id` | string | ID de token NFT XLS-20 en XRPL mainnet |
| `image_uri` | string | URI `ipfs://` para la imagen de identidad generativa |
| `metadata_uri` | string | URI `ipfs://` para el JSON de metadata del NFT |
| `image_url` | string | URL de gateway HTTPS para la imagen |
| `nft_explorer_url` | string | Enlace del explorador XRPL para el NFT |
| `generation` | int | Generacion del genoma (aumenta con la evolucion) |
| `identity_status` | string | `pending`, `complete`, `render_failed`, etc. |
| `tier` | string | `founding`, `standard`, `enterprise` |

### Compliance

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `screened` | boolean | Si se realizo screening OFAC/sanciones |
| `result` | string | `LOW`, `MEDIUM`, `HIGH`, `BLOCKED` |
| `provider` | string | Proveedor de screening |
| `screened_at` | ISO 8601 | Cuando se realizo el ultimo screening |

### Indicacion ISO 20022

Indicaciones para la construccion de mensajes downstream para el rail preferido.

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `message_family` | string | `pacs.008`, `pain.001` |
| `service_level` | string | ISO 20022 SvcLvl/Cd |
| `travel_rule_required` | boolean | Si aplica la Regla de Viaje |

### Puntuacion de Rail

Desglose de puntuacion determinista para cada rail disponible.

```json
{
  "xrpl": {
    "score": 116,
    "breakdown": {
      "priority": 1,
      "xrpl_rail": 90,
      "fx_corridor": 25
    }
  }
}
```

## Verificar Disponibilidad

```
GET /api/v1/aliases/check/{nombre}
```

```bash
curl https://api.dnsofmoney.com/api/v1/aliases/check/pay:nombre.deseado
```

```python
available = client.check_availability("pay:nombre.deseado")
```

## Registrar un Alias

```
POST /api/v1/aliases
```

Requiere una clave API. Consulta la [especificacion FAS-1](FAS-1-spec.md) para los requisitos de registro.

## Codigos de Error

| Codigo | HTTP | Descripcion |
|--------|------|-------------|
| `ALIAS_NOT_FOUND` | 404 | El alias no existe |
| `ALIAS_INACTIVE` | 404 | El alias existe pero esta desactivado |
| `COMPLIANCE_BLOCKED` | 403 | Alias bloqueado por screening de sanciones |
| `COMPLIANCE_PENDING` | 202 | Screening en progreso, reintenta despues |
| `INVALID_ALIAS_FORMAT` | 400 | El alias no cumple el formato FAS-1 |
| `RATE_LIMITED` | 429 | Demasiadas solicitudes |
| `CAP_EXCEEDED` | 409 | Limite del tier fundador alcanzado |
| `WALLET_ALREADY_REGISTERED` | 409 | El wallet ya tiene un nombre fundador |
| `TX_HASH_ALREADY_USED` | 409 | TX de pago ya usada para otro registro |
| `ALIAS_UNAVAILABLE` | 409 | Nombre ocupado o reservado |

## SDKs

- [Python SDK](../sdk/python/) — cero dependencias, solo libreria estandar
- [TypeScript SDK](../sdk/typescript/) — cero dependencias, fetch nativo

## Enlaces

- [Especificacion FAS-1](FAS-1-spec.md)
- [Esquemas JSON](../schemas/)
- [Ejemplos](../examples/)
- [CHANGELOG](../CHANGELOG.md)
