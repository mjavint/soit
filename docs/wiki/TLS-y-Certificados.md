# TLS y certificados

> **Resultado:** un certificado válido emitido, nginx sirviendo HTTPS y un
> timer que recarga nginx cuando certbot renueva.
>
> **Tiempo estimado:** 5–10 minutos. **Riesgo:** medio; depende de DNS,
> puertos y rate limits de Let's Encrypt.

SOIT gestiona certificados con **certbot** dentro del contenedor de
infraestructura y nginx como terminador TLS. La validación es HTTP-01 por el
puerto 80.

## Modelo

```text
Internet :80  ──► nginx ──► certbot www (reto HTTP-01)
Internet :443 ──► nginx ──► odoo / backend
```

El contenedor certbot **no tiene el socket de Docker** y no puede recargar
nginx. Por eso SOIT instala un cron del host que llama a:

```bash
soit cert reload-if-changed
```

Ese comando compara los `mtime` de los certificados con
`.soit/cert-reload.json` y recarga nginx solo si hubo una renovación real.

## Antes de empezar

| Necesitas | Detalle |
| --- | --- |
| DNS | El dominio debe resolver a la IP pública del servidor. |
| Puertos | `80` y `443` abiertos y sin otro proxy delante. |
| Email | `ACME_EMAIL` en `.env` o `--email` en el comando. |
| Infra | `soit infra up` y nginx healthy. |

```bash
dig +short odoo18.example.com
soit infra ps
soit infra health --check
```

## Paso 1 — Lista y comprueba

```bash
soit cert list
soit cert status
soit cert status --check
soit cert list -o json
```

`list` muestra `name|domains|days|expires|issuer`. `status --check` devuelve
código `3` si algún certificado vence en 30 días o menos; es el comando para
cron/CI.

```bash
soit cert status --check || echo "renovar certificados"
```

## Paso 2 — Emite un certificado

```bash
soit cert issue <domain> [flags]
```

`issue` pide el certificado **solo si** falta, está expirado o no cubre el
dominio. Si ya existe un certificado válido que incluye el dominio (por
ejemplo, un SAN compartido), no hace nada.

| Flag | Default | Uso |
| --- | --- | --- |
| `--email string` | `ACME_EMAIL` | Email ACME. |
| `--cert-name string` | dominio | Nombre en `certbot/conf/live/<name>`. |
| `--staging` | `false` | Let's Encrypt staging; certificados no confiables, sin rate limit. |
| `--skip-challenge` | `false` | Omite la sonda HTTP-01 en `:80`. |
| `--bootstrap` | `false` | Escribe un vhost HTTP temporal si el sitio no existe. |
| `--no-reload` | `false` | No recarga nginx tras emitir. |

```bash
# Dominio nuevo, sin vhost previo
soit cert issue odoo18.example.com --bootstrap

# Probar el flujo sin consumir rate limit
soit cert issue odoo18.example.com --staging --bootstrap

# Agrupar varios dominios bajo un nombre de certificado
soit cert issue odoo18.example.com --cert-name odoo18.example.com
```

### `--bootstrap`

Si el dominio todavía no tiene un vhost nginx, certbot no puede servir el
reto HTTP-01. `--bootstrap` escribe un vhost HTTP temporal, lo prueba, emite el
certificado y luego SOIT escribe el vhost TLS definitivo.

Sin `--bootstrap`, el dominio debe tener ya un sitio HTTP que responda en el
puerto 80.

### `--skip-challenge`

SOIT hace una sonda HTTP-01 antes de invocar certbot para fallar rápido si el
puerto 80 no es alcanzable. `--skip-challenge` omite esa sonda; úsalo solo si
ya verificaste manualmente que el reto funciona.

## Paso 3 — Renueva

```bash
soit cert renew [domain] [flags]
```

- Sin dominio: renueva todos los certificados que estén dentro de la ventana
  de renovación.
- Con dominio: renueva ese certificado; conserva los SAN compartidos.

| Flag | Default | Uso |
| --- | --- | --- |
| `--simulate` | `false` | Ejecuta el `--dry-run` de certbot; valida el flujo sin consumir rate limit. |
| `--no-reload` | `false` | No recarga nginx tras renovar. |

```bash
soit cert renew
soit cert renew odoo18.example.com
soit cert renew --simulate
soit --dry-run cert renew          # plan global: no ejecuta certbot
```

### `--simulate` no es `--dry-run`

- `soit --dry-run cert renew`: SOIT no ejecuta nada; solo muestra el plan.
- `soit cert renew --simulate`: SOIT ejecuta certbot con su propio
  `--dry-run`; valida el flujo real sin gastar rate limit.

Para probar una emisión completa sin rate limit, usa `--staging` en `issue`.

## Paso 4 — Recarga nginx

```bash
soit cert reload
soit cert reload-if-changed
soit cert reload-if-changed -q -v
```

- `reload`: recarga nginx ahora (`nginx -s reload` con fallback
  `docker kill -s HUP`).
- `reload-if-changed`: recarga solo si el `mtime` de algún certificado cambió
  desde la última ejecución. Es seguro ejecutarlo con frecuencia.

El estado se guarda en `.soit/cert-reload.json`.

## Paso 5 — Instala el timer

```bash
sudo soit cert install-timer
sudo soit cert install-timer --every-minutes 10
soit cert install-timer --print-cron
sudo soit cert uninstall-timer
```

Instala `/etc/cron.d/soit-cert-reload`:

```cron
*/15 * * * * root mkdir -p <root>/.soit/logs && \
  <soit> cert reload-if-changed --quiet --root <root> >> <root>/.soit/logs/cert-reload.log 2>&1
```

| Flag | Default | Uso |
| --- | --- | --- |
| `--every-minutes int` | `15` | Frecuencia del chequeo. |
| `--print-cron` | `false` | Imprime el cron sin escribir ni requerir root. |

`install-timer` y `uninstall-timer` requieren root, salvo `--print-cron` o
`--dry-run`. El log del timer queda en `.soit/logs/cert-reload.log`.

> El timer solo **recarga nginx**. La renovación la hace certbot dentro de su
> propio contenedor según su programación. Si usas otro mecanismo de
> renovación, igualmente puedes llamar a `soit cert reload-if-changed` desde
> tu cron.

## Certificados compartidos y servicios

`service expose` reutiliza certificados que ya cubren el dominio. Para forzar
un certificado existente:

```bash
soit service expose app.example.com \
  --backend app:8000 \
  --shared-cert wildcard.example.com
```

Si el certificado no cubre el dominio, la emisión fallará; revisa los SAN con
`soit cert list`.

## Troubleshooting

| Síntoma | Qué revisar |
| --- | --- |
| `ACME email is required` | Define `ACME_EMAIL` en `.env` o pasa `--email`. |
| DNS no coincide | `dig +short <domain>`; el dominio debe apuntar a la IP pública. |
| Reto HTTP-01 falla | Puerto 80 abierto, nginx sirviendo `/.well-known/acme-challenge/`, firewall/proxy. |
| `--bootstrap` no basta | Puede haber un proxy/CDN delante; revisa `--allow-dns-mismatch` y el vhost. |
| Rate limit de Let's Encrypt | Usa `--staging` para pruebas; espera la ventana de rate limit. |
| Certificado renovado pero nginx sirve el viejo | `soit cert reload`; revisa el timer y `.soit/cert-reload.json`. |
| Timer no corre | `cat /etc/cron.d/soit-cert-reload`; `tail -f .soit/logs/cert-reload.log`; permisos de root. |
| `install-timer` falla | Ejecuta con `sudo` o usa `--print-cron`. |
| `nginx -t` falla tras emitir | SOIT restaura el vhost anterior; revisa `soit infra logs --follow=false`. |

Más casos: [Troubleshooting](Troubleshooting).
