# Instancias Odoo

> **Resultado:** una instancia Odoo con stack, base de datos, TLS, nginx y
> contenedor healthy, verificada de principio a fin.
>
> **Tiempo estimado:** 5–10 minutos. **Riesgo:** medio; crea contenedores,
> base de datos y certificado.

Una **instancia** en SOIT es la combinación de:

- un stack Docker (`stacks/<stack>/docker-compose.yml`),
- una base de datos PostgreSQL,
- un `odoo.conf` con `db_name`, `admin_passwd`, `workers`, `logfile` y
  `http_interface`,
- un sitio nginx con TLS (salvo `--skip-tls`),
- un certificado (salvo `--skip-tls`),
- y el estado de salud del contenedor Odoo.

`soit instance create` converge todo eso. No es un instalador de un solo uso:
puedes ejecutarlo de nuevo con los mismos argumentos y no duplica ni
reinicializa nada.

## Antes de empezar

| Necesitas | Detalle |
| --- | --- |
| Infraestructura | `soit infra up` debe estar corriendo. |
| DNS | El dominio debe resolver al servidor (salvo `--skip-dns`). |
| Versión de Odoo | `--odoo-version 17.0`, `18.0`, `19.0` o `20.0`. |
| Email TLS | `--email` o `ACME_EMAIL` en el `.env`. |
| Puertos | `80` y `443` libres para HTTP-01. |

Comprueba el estado antes de crear:

```bash
soit infra ps
soit infra health --check
```

## Paso 1 — Planifica

Empieza con un plan sin mutar nada:

```bash
soit --dry-run instance create odoo18.example.com --odoo-version 18.0
```

Revisa el stack, la base de datos, el certificado y el vhost que va a crear.
Si el dominio no resuelve todavía, usa `--skip-dns` solo en staging.

### Nombres derivados

| Valor | Default | Ejemplo |
| --- | --- | --- |
| Stack | primera etiqueta del dominio | `odoo18.example.com` → `odoo18` |
| Base de datos | nombre del stack | `odoo18` |
| Certificado | dominio completo | `odoo18.example.com` |
| URL | `https://<domain>` | `https://odoo18.example.com` |

Los guiones del primer label se convierten en guiones bajos:
`odoo-18.example.com` → stack `odoo_18`. Puedes desacoplar todo con `--stack`
y `--db`.

## Paso 2 — Crea la instancia

```bash
soit instance create odoo18.example.com --odoo-version 18.0
```

El comando converge, en orden:

1. Valida dominio y `--odoo-version`.
2. Verifica DNS (salvo `--skip-dns`).
3. Exige que `db` y `nginx` estén corriendo.
4. Crea `stacks/<stack>/` con compose, `odoo.conf`, `addons/` y `data/`.
5. Crea la base de datos solo si falta.
6. Emite o reutiliza el certificado y escribe el vhost TLS.
7. Ejecuta `odoo --init=base` solo si la base está vacía.
8. Ejecuta `docker compose up -d --wait`.
9. Instala el timer de renovación (salvo `--no-timer`).
10. Verifica `/web/health`.

Cada paso es idempotente:

- Si el stack existe, no se sobrescribe el compose sin `--force`.
- Si el `odoo.conf` existe, solo se convergen `db_name`, el `logfile` legacy
  y un `http_interface` faltante; se conservan comentarios y ajustes.
- Si la base ya tiene tablas, no se ejecuta `--init=base`.
- Si el certificado cubre el dominio y tiene más de 30 días, se reutiliza.
- Si nginx ya tiene el vhost correcto, no se reescribe ni se recarga.
- Si el contenedor ya está healthy, `up --wait` no cambia nada.

## Paso 3 — Verifica

```bash
soit instance status odoo18
soit instance list
soit stack health --wait --check
curl -I https://odoo18.example.com
```

Columnas habituales de `status`:

| Columna | Significado |
| --- | --- |
| `stack` | Nombre del stack. |
| `domain` | Dominio del vhost. |
| `odoo` | Versión inferida del `image:` del compose. |
| `database` | `db_name` de `odoo.conf`. |
| `tables` | Número de tablas de la base de datos. |
| `cert` | Días restantes del certificado. |
| `health` | Estado de salud del contenedor. |

`status` sin argumento muestra todas; `list` es el resumen equivalente.
`instance list -o json` es útil para scripts.

## Flags de `instance create`

| Flag | Default | Uso |
| --- | --- | --- |
| `--odoo-version string` | — (**requerido**) | Tag `odoo:<ver>` de la instancia. |
| `--email string` | `ACME_EMAIL` | Email Let's Encrypt para este dominio. |
| `--stack string` | primera etiqueta | Directorio `stacks/<name>` y proyecto Compose. |
| `--db string` | nombre del stack | Base de datos PostgreSQL. |
| `--skip-dns` | `false` | No verifica que el DNS apunte a este servidor. |
| `--allow-dns-mismatch` | `false` | Avisa en vez de fallar si el DNS no coincide. |
| `--skip-tls` | `false` | No crea certificado ni vhost TLS; usa `http://`. |
| `--skip-challenge` | `false` | No prueba el reto HTTP-01 antes de pedir el certificado. |
| `--skip-init` | `false` | No ejecuta `--init=base` aunque la base esté vacía. |
| `--no-timer` | `false` | No instala el cron de recarga de nginx. |
| `--timer-every int` | `15` | Minutos entre chequeos del timer. |
| `--admin-passwd string` | `SOIT_ODOO_ADMIN_PASSWD` o generado | `admin_passwd` de Odoo. |
| `--workers int` | `4` | Workers de Odoo en `odoo.conf`. |
| `--wait-timeout duration` | `3m` | Espera máxima de `docker compose up --wait`. |

### `--admin-passwd` y secretos

Si no pasas `--admin-passwd` ni defines `SOIT_ODOO_ADMIN_PASSWD`, SOIT genera
una contraseña y la guarda en:

```text
.soit/secrets/<stack>.admin_passwd   # 0600
```

La ruta se muestra en el resultado (`admin_secret` en JSON). Evita pasar la
contraseña por `argv` en producción: queda visible en `ps` y en el historial.

## Escenarios frecuentes

### Staging sin DNS ni TLS

```bash
soit instance create staging.example.com \
  --odoo-version 18.0 --skip-dns --skip-tls
```

La URL del resultado será `http://staging.example.com`. No se emite
certificado ni se escribe vhost TLS.

### Segunda versión en la misma infraestructura

```bash
soit instance create odoo17.example.com --odoo-version 17.0
soit instance create odoo18.example.com --odoo-version 18.0
soit instance list
```

Cada stack tiene su propio `image: odoo:<ver>`; no hay una versión global.

### Stack, base de datos y workers explícitos

```bash
soit instance create odoo18.example.com \
  --odoo-version 18.0 --stack odoo18 --db ydr_prod --workers 8
```

### Restaurar un backup

```bash
# 1. Crear la instancia sin inicializar la base
soit instance create demo.example.com \
  --odoo-version 17.0 --skip-init --skip-dns --skip-tls

# 2. Restaurar dump + filestore
soit db restore dbs/demo.zip --db demo --stack demo

# 3. Verificar
soit instance status demo
soit stack logs demo --follow=false --tail 200
```

Ver [Bases de datos y restore](Bases-de-Datos-y-Restore) para el flujo
completo y las opciones de `--on-exists`.

### Host lento

```bash
soit instance create odoo18.example.com \
  --odoo-version 18.0 --wait-timeout 10m
```

Si el stack tarda más que el timeout, el error incluye sugerencias para
inspeccionar logs y validar el compose.

## Inicialización y diagnóstico

SOIT ejecuta la inicialización como un one-shot:

```bash
docker compose ... run --rm -T odoo \
  odoo -d <db> --init=base --stop-after-init --no-http --logfile=/dev/stderr
```

`--logfile=/dev/stderr` es deliberado: obliga a Odoo a emitir la excepción
real por stderr, de modo que SOIT pueda capturarla y resumirla. Sin eso, un
fallo solo mostraba `exited with code 255` y un warning de fuente.

### El aviso `Can't find .pfb for face 'Courier'`

```text
Warn: Can't find .pfb for face 'Courier'
```

Es un aviso de **ReportLab** (fuentes para PDF), no la causa del fallo. SOIT
lo ignora al elegir la línea de error y, si aparece, añade una aclaración.
No pierdas tiempo instalando fuentes: busca la excepción real de Odoo más
arriba o más abajo en la salida.

### Hints cuando falla `--init=base`

Si la inicialización falla, SOIT imprime sugerencias además del error:

```text
hint: if the stack is already running, inspect logs:
      soit stack logs <stack> --follow=false --tail 200
hint: retry initialization with visible logs:
      soit stack compose <stack> run --rm -T odoo odoo -d <db> \
        --init=base --stop-after-init --no-http --logfile=/dev/stderr
hint: if you are restoring a backup, re-run create with --skip-init and then:
      soit db restore <backup.zip> --db <db> --stack <stack>
```

Si detecta un fallo de conexión o autenticación a PostgreSQL, añade:

```text
hint: verify PostgreSQL is healthy: soit infra ps
hint: verify POSTGRES_USER/POSTGRES_PASSWORD in <env>: soit config show
```

Si detecta el `logfile` legacy, sugiere volver a ejecutar `instance create`
para migrar el `odoo.conf`.

Si detecta `PermissionError` o `/var/lib/odoo/filestore`, la causa es que el
`data/` del host no es escribible por el usuario del contenedor Odoo. La
sugerencia exacta es:

```text
hint: Odoo cannot write /var/lib/odoo/filestore: ...
hint: fix ownership of the host data directory ...:
      sudo chown -R 101:101 <root>/stacks/<stack>/data
```

Las instancias nuevas crean `data/filestore`, `data/sessions` y `data/addons`
y, si SOIT corre como root, ajustan el dueño de `data/` al UID/GID de la
imagen Odoo (detectado, o `101:101` por defecto).

### Odoo 20 y `http_interface`

Odoo 20 en Docker escucha solo en `127.0.0.1` por defecto. Los `odoo.conf`
nuevos incluyen `http_interface = 0.0.0.0` para que nginx pueda alcanzar el
contenedor y no devuelva `502 Bad Gateway`.

Si un stack gestionado antiguo no tiene la clave, re-ejecuta `instance create`
y reinicia el stack para aplicarla:

```bash
soit instance create <domain> --odoo-version <ver>
soit stack restart <stack>
```

Los archivos no gestionados se respetan; añade la clave a mano o usa
`--force` con backup.

### Logs normales de Odoo

Los `odoo.conf` nuevos usan:

```ini
logfile = /dev/stdout
```

Así los logs se ven con:

```bash
soit stack logs <stack> --follow=false --tail 200
soit stack logs <stack> -f
```

Los stacks gestionados antiguos que todavía tengan
`/var/log/odoo/odoo.log` migran a `/dev/stdout` la próxima vez que se ejecute
`instance create`. Si el archivo no es gestionado por SOIT, se respeta.

## Borrar una instancia

No existe un `soit instance delete`. Una baja completa es una secuencia
manual y destructiva:

```bash
# ⚠️ Revisa cada paso; no hay vuelta atrás para la BD ni los volúmenes
soit service remove odoo18.example.com
soit db drop odoo18 --terminate --yes
soit stack down --only odoo18
# Los archivos de stacks/odoo18/ y el certificado se conservan.
# Bórralos manualmente si ya no los necesitas.
```

`stack down` no borra `stacks/<name>/`, el filestore ni los certificados.
`db drop` no borra el filestore. Decide qué conservar antes de ejecutar.

## Troubleshooting rápido

| Síntoma | Qué revisar |
| --- | --- |
| `--odoo-version is required` | Añade `--odoo-version 18.0`. |
| DNS no coincide | `dig +short <domain>`; usa `--skip-dns` o `--allow-dns-mismatch` solo si es intencional. |
| `db` o `nginx` no están corriendo | `soit infra up`. |
| Fallo de `--init=base` | `soit stack logs <stack> --follow=false --tail 200`; ignora el warning de Courier. |
| Timeout de salud | Sube `--wait-timeout`; revisa `soit infra ps`, `soit stack ps` y logs. |
| Certificado no emitido | Revisa DNS, puerto 80 y `ACME_EMAIL`. |
| `odoo.conf` no cambia | Puede ser un archivo no gestionado; revisa el marcador o usa `--force`. |
| 502 en Odoo 20 | Verifica `http_interface = 0.0.0.0` y reinicia el stack. |

Más casos: [Troubleshooting](Troubleshooting).
