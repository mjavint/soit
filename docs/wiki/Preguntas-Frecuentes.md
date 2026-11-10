# Preguntas frecuentes

> Si buscas un procedimiento completo, usa la [Guía de uso](Guia-de-uso) o
> [Primeros pasos](Instalacion-y-Primeros-Pasos). Esta página resuelve dudas
> puntuales.

## ¿SOIT crea la infraestructura desde cero?

Sí. `soit infra init ./odoo-infra` genera el compose de infraestructura, el
`.env`, los directorios (`stacks/`, `nginx/`, `certbot/`) y `stacks/.order`.
Si la raíz ya existe, la descubre, la valida y opera sobre ella.

## ¿Dónde se configura la versión de Odoo?

En cada instancia, no en el `.env`:

```bash
soit instance create odoo18.example.com --odoo-version 18.0
```

La versión termina en el `image: odoo:<ver>` de
`stacks/<stack>/docker-compose.yml`. Así puedes tener 17.0 y 18.0 en la misma
infraestructura.

## ¿Puedo tener varias versiones de Odoo?

Sí. Cada stack tiene su propia imagen y su propia base de datos. La infra
comparte PostgreSQL y nginx.

```bash
soit instance create odoo17.example.com --odoo-version 17.0
soit instance create odoo18.example.com --odoo-version 18.0
soit instance list
```

## ¿`instance create` borra datos si lo ejecuto otra vez?

No. Es convergente:

- No reinicializa una BD con tablas.
- No sobrescribe archivos gestionados si no cambiaron.
- No reemite un certificado válido que cubre el dominio.
- No recrea contenedores si ya están healthy.

Solo `--force` sobrescribe archivos no gestionados y fuerza certificados.
Las operaciones destructivas (`db drop`, `db restore --on-exists=replace`,
`stack down --volumes`) exigen `--yes`.

## ¿Cómo borro una instancia?

No hay un `soit instance delete`. La baja es manual y destructiva:

```bash
soit service remove <domain>
soit db drop <db> --terminate --yes
soit stack down --only <stack>
```

Los archivos de `stacks/<stack>/`, el filestore y los certificados se
conservan. Bórralos a mano si ya no los necesitas. Haz backup antes.

## ¿SOIT hace backups?

Sí, con comandos explícitos:

```bash
soit db backup <db> --stack <stack>   # BD + filestore
soit infra backup                     # configuración de infra
soit stack backup                     # configuración de stacks
soit backup                           # todo (solo configuración)
```

SOIT **no instala un cron de backups**; programa `soit db backup` con tu
planificador. Para restaurar:

```bash
soit instance create demo.example.com --odoo-version 17.0 --skip-init
soit db restore dbs/demo.zip --db demo --stack demo
```

Ver [Backups](Backups) y [Bases de datos y restore](Bases-de-Datos-y-Restore).

## ¿Cuál es la diferencia entre `soit update` y `soit upgrade`?

| Comando | Qué actualiza |
| --- | --- |
| `soit upgrade` / `soit self-update` | El **binario** de SOIT desde GitHub Releases. |
| `soit update` | Las **imágenes Docker** de infraestructura y stacks. |
| `soit infra update` | Solo las imágenes de infraestructura. |
| `soit stack update` | Solo las imágenes de los stacks. |

```bash
soit upgrade --check
soit upgrade
soit update
```

## ¿Dónde están los logs?

| Log | Ubicación |
| --- | --- |
| Odoo | `soit stack logs <stack>` (gracias a `logfile = /dev/stdout`). |
| Infra (db, nginx, certbot) | `soit infra logs`. |
| Restore | `.soit/logs/restore-*.log`. |
| Timer de certificados | `.soit/logs/cert-reload.log`. |
| Diagnóstico de un comando | stderr; usa `-v` para más detalle. |

## ¿Por qué no veo logs de Odoo en `stack logs`?

Un stack antiguo puede seguir usando:

```ini
logfile = /var/log/odoo/odoo.log
```

Re-ejecuta `instance create` para migrar los `odoo.conf` gestionados a
`logfile = /dev/stdout`. Si el archivo no es gestionado por SOIT, edítalo a
mano o usa `--force` con backup.

## ¿Por qué Odoo 20 devuelve 502?

Odoo 20 en Docker escucha solo en `127.0.0.1` por defecto. Los `odoo.conf`
nuevos incluyen `http_interface = 0.0.0.0`; si un stack antiguo no lo tiene,
re-ejecuta `instance create` y reinicia el stack. Ver
[Troubleshooting](Troubleshooting#odoo-20-devuelve-502-o-no-acepta-conexiones).

## ¿Qué es `Can't find .pfb for face 'Courier'`?

Un aviso benigno de ReportLab (fuentes PDF). No es la causa de un fallo de
inicialización. SOIT lo ignora al resumir el error y añade una aclaración.
Busca la excepción real de Odoo.

## ¿Por qué falla `instance create` con `exited with code 255`?

Odoo falló durante `--init=base`. El código 255 es genérico; el mensaje real
está en la salida. SOIT ejecuta la inicialización con
`--logfile=/dev/stderr` para capturarlo y añade hints:

```bash
soit stack logs <stack> --follow=false --tail 300
soit stack compose <stack> run --rm -T odoo \
  odoo -d <db> --init=base --stop-after-init --no-http \
  --logfile=/dev/stderr
```

Si vas a restaurar un dump, usa `--skip-init` y luego `db restore`.

## ¿Por qué `--dry-run` ejecuta algunas cosas?

Porque las lecturas (`docker compose ps`, `SELECT`, `nginx -t`) son necesarias
para que el plan refleje la realidad. `--dry-run` no ejecuta mutaciones;
imprime `+ comando` en su lugar. `cert renew --simulate` es distinto: ejecuta
el `--dry-run` de certbot.

## ¿Qué diferencia hay entre los dos `--force`?

- `--force` global: sobrescribe archivos no gestionados y fuerza reemisión de
  certificados.
- `soit stack update --force`: recrea aunque la imagen no haya cambiado.

## ¿Cómo funciona el timer de certificados?

El contenedor certbot no puede recargar nginx (no tiene socket Docker). SOIT
instala `/etc/cron.d/soit-cert-reload`, que llama a
`soit cert reload-if-changed` cada 15 minutos por defecto. Ese comando
recarga nginx solo si detecta un certificado renovado.

```bash
sudo soit cert install-timer
soit cert install-timer --print-cron
sudo soit cert uninstall-timer
```

## ¿Por qué `cert install-timer` pide root?

Porque escribe en `/etc/cron.d/`. Sin root, usa `--print-cron` para ver la
entrada o `--dry-run` para simular.

## ¿Cómo expongo pgadmin o portainer?

```bash
soit service expose pgadmin.example.com --backend pgadmin:80 --auth-basic
soit service expose portainer.example.com --backend portainer:9000
soit service list
```

El backend se usa tal cual (`host:port`). Si el servicio no está en la red
compartida, nginx no podrá resolverlo.

## ¿Cómo protejo un servicio con basic auth?

```bash
soit service expose app.example.com \
  --backend app:8000 --auth-basic --auth-user ops
```

Si no pasas `--auth-password` ni `SOIT_AUTH_PASSWORD`, SOIT genera una y la
imprime una sola vez. Guárdala.

## ¿Por qué no encuentra la raíz?

SOIT busca `docker-compose.infra.yml` en `--root`, `SOIT_ROOT`, el directorio
actual/padres y `odoo-infra/`. Si no lo encuentra:

```bash
soit --root /srv/odoo-infra doctor
SOIT_ROOT=/srv/odoo-infra soit doctor
```

## ¿Cómo actualizo SOIT?

```bash
soit upgrade --check        # exit 3 si hay una versión nueva
soit upgrade                # estable
sudo soit upgrade           # si está en /usr/local/bin
soit version
```

`soit upgrade` verifica el SHA-256 de la release y reemplaza el ejecutable de
forma atómica. También puedes descargar el `tar.gz` y reemplazar el binario
manualmente:

```bash
tar -xzf soit_<version>_<os>_<arch>.tar.gz
sudo install -m 0755 soit /usr/local/bin/soit
soit version
```

El estado en `.soit/` es compatible entre versiones; igualmente revisa las
notas de release antes de actualizar en producción.

## ¿Funciona en Windows?

No está soportado. El código fuente puede compilar, pero no hay binarios ni
CI para Windows. Usa Linux o macOS, o un contenedor Linux.

## ¿Cómo reporto un bug?

Incluye:

1. `soit version`
2. El comando exacto y su salida (stdout/stderr).
3. `soit doctor -o json`
4. `soit config show -o json` (revisa secretos)
5. `soit infra ps` / `soit stack ps -o json`
6. Logs relevantes.

No adjuntes `.env`, contraseñas, dumps ni claves privadas sin redactar.

## ¿Dónde está la referencia completa de flags?

- `soit <comando> --help` (fuente de verdad de la versión instalada).
- [`USAGE.md`](https://github.com/mjavint/soit/blob/main/USAGE.md) (referencia
  exhaustiva).
- [Referencia de comandos](Referencia-de-Comandos) (mapa de esta wiki).
