# Infraestructura

> **Resultado:** una infraestructura Docker con PostgreSQL, nginx y certbot
> corriendo, validada y lista para recibir stacks Odoo.
>
> **Tiempo estimado:** 5–10 minutos. **Riesgo:** medio.

La infraestructura es el proyecto Compose compartido que SOIT gestiona con
`soit infra *`. Contiene los servicios de red y datos que usan todos los
stacks: PostgreSQL, nginx y certbot. Los stacks Odoo viven en `stacks/<name>/`
y se gestionan con `soit stack *`.

## Antes de empezar

- Docker Engine o Docker Desktop con el plugin `docker compose`.
- Un directorio donde crear la raíz, por ejemplo `/srv/odoo-infra`.
- Puertos `80` y `443` disponibles si vas a emitir certificados.
- Un email para Let's Encrypt, por ejemplo `ops@example.com`.

## Paso 1 — Crea la raíz

```bash
soit infra init ./odoo-infra
cd ./odoo-infra
```

`infra init` no necesita Docker ni una raíz existente. Crea:

```text
<root>/
├── docker-compose.infra.yml
├── .env                     # 0600, secretos generados
├── .env.example
├── .gitignore
├── nginx/conf.d/.disabled/
├── certbot/conf/
├── certbot/www/.well-known/acme-challenge/
├── stacks/.order
├── dbs/
└── .soit/{backups,logs,secrets,tmp}/
```

Flags principales:

| Flag | Default | Uso |
| --- | --- | --- |
| `--project-name` | `odoo-infra` | Prefijo del proyecto Compose. |
| `--postgres-user` | `odoo` | Usuario PostgreSQL. |
| `--postgres-password` | generado | Contraseña PostgreSQL. |
| `--pg-version` | `16` | Versión de PostgreSQL. |
| `--acme-email` | — | Email para Let's Encrypt. |
| `--with-pgadmin` | `false` | Incluye pgAdmin en `127.0.0.1:5050`. |
| `--force` | `false` | Sobrescribe archivos no gestionados tras backup. |

Un `.env` existente nunca se sobrescribe: los secretos no se rotan al
re-ejecutar `init`. Los archivos gestionados llevan el marcador
`# managed-by: soit`; un archivo distinto sin marcador se deja intacto salvo
`--force`.

## Paso 2 — Valida la configuración

Revisa `.env` y ejecuta:

```bash
soit config validate
soit doctor
soit infra validate
```

- `config validate` comprueba requeridos y rutas.
- `doctor` revisa Docker, red, servicios, certificados, timer, imágenes y
  secretos. Con `--strict`, los avisos devuelven código `3`.
- `infra validate` ejecuta `docker compose config --quiet` sin arrancar nada.

Salida esperada de `doctor`: un resumen con checks en verde. Si hay avisos,
léelos antes de seguir; muchos se convierten en fallos más adelante.

## Paso 3 — Arranca la infraestructura

```bash
soit infra up
```

Por defecto espera a que los servicios estén healthy. Si el host es lento:

```bash
soit infra up --wait-timeout 5m
```

## Paso 4 — Verifica

```bash
soit infra ps
soit infra health --check
```

`infra ps` muestra `project|service|state|health|image`. `infra health
--check` devuelve código `3` si algo está enfermo, lo que es útil en CI o cron.

Si algo falla:

```bash
soit infra logs --follow=false --tail 200
```

## Ciclo de vida

```bash
soit infra start
soit infra stop
soit infra restart
soit infra down
```

`infra down` y `infra stop` se niegan mientras haya stacks corriendo, porque
la red compartida y la base de datos desaparecerían debajo de ellos. Primero
baja los stacks (`soit stack down`) o usa `--force`.

| Flag | Comando | Uso |
| --- | --- | --- |
| `--wait=false` | `up` | No esperar a healthy. |
| `--wait-timeout` | `up` | Subir el timeout. |
| `--volumes` + `--yes` | `down` | **Destructivo:** borra volúmenes nombrados. |
| `--force` | `down`, `stop` | Permite bajar infra con stacks activos. |

## Logs de infraestructura

```bash
soit infra logs --follow=false --tail 200
soit infra logs -f --tail 50
```

Los logs incluyen `db`, `nginx` y `certbot`. Para los logs de Odoo usa
`soit stack logs`.

## Actualizar imágenes

```bash
soit infra pull
soit infra update
soit infra update --force
soit infra build
```

`update` compara el fingerprint de las imágenes antes y después del pull. Si
no cambió, deja la infraestructura corriendo; con `--force` recrea igualmente.

> **No confundas:** `soit infra update` actualiza imágenes Docker. Para
> actualizar el binario de SOIT usa `soit upgrade`.

## Validar el compose

```bash
soit infra validate
soit infra compose config
soit infra compose ps
```

`infra compose` pasa argumentos directamente a Docker Compose y desactiva el
parseo de flags de SOIT. Úsalo como escape hatch cuando necesites un comando
que SOIT no envuelve.

## Backup de archivos de infraestructura

```bash
soit infra backup
soit infra backup --no-secrets
soit infra backup --output-dir /backups/soit
```

El ZIP incluye el `.env` y los certificados salvo `--no-secrets`. Ver
[Backups](Backups) para el formato, el manifiesto y la verificación.

## Si algo falla

| Síntoma | Qué revisar |
| --- | --- |
| `infra up` no queda healthy | `soit infra logs --follow=false --tail 200` |
| `infra down` se niega | Hay stacks activos; baja stacks o usa `--force`. |
| `config validate` falla | `.env`, `POSTGRES_PASSWORD`, rutas y permisos. |
| nginx no arranca | `soit infra compose config`, certificados y puertos 80/443. |
| Docker no responde | `docker info`, permisos del usuario y contexto de Docker. |

## Siguiente paso

- [Instancias Odoo](Instancias-Odoo): crear la primera instancia.
- [Stacks y servicios](Stacks-y-Servicios): operar los stacks y sitios nginx.
- [TLS y certificados](TLS-y-Certificados): emitir y renovar certificados.
- [Backups](Backups): proteger configuración y datos.
