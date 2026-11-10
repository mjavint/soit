# Backups

> **Resultado:** sabrás qué backup usar en cada caso, cómo verificarlo y cómo
> restaurarlo sin confundir configuración con datos.
>
> **Tiempo estimado:** 5–15 minutos. **Riesgo:** bajo al crear; alto al
> restaurar o al elegir un backup incompleto.

SOIT distingue dos tipos de salva:

- **Base de datos + filestore** (`soit db backup`): ZIP estilo Odoo,
  restaurable con `soit db restore`.
- **Archivos de infraestructura y stacks** (`soit infra backup`,
  `soit stack backup`, `soit backup`): ZIP de configuración, sin dumps ni
  filestore por defecto.

Todos los ZIP se escriben con modo `0600`, incluyen `META-INF/soit.json` y
generan un sidecar `.zip.sha256`.

## Antes de empezar

```bash
soit infra health --check
soit db list
soit stack list
```

Decide qué necesitas proteger:

| Quiero proteger… | Comando |
| --- | --- |
| Datos de Odoo (BD + filestore) | `soit db backup` |
| Configuración de infraestructura | `soit infra backup` |
| Configuración de stacks | `soit stack backup` |
| Todo lo anterior (solo configuración) | `soit backup` |

## Base de datos + filestore

```bash
soit db backup odoo18c --stack odoo18c
soit db backup ydr_prod --stack ydrsoluciones
soit db backup staging --no-filestore
soit db backup staging --format custom --output dbs/staging.zip
soit --dry-run db backup staging --stack demo
```

| Flag | Default | Uso |
| --- | --- | --- |
| `--stack` | inferido de `odoo.conf` | Stack dueño del filestore. Pásalo explícito. |
| `--output` | `<root>/dbs/<db>-<timestamp>.zip` | Ruta exacta del ZIP. |
| `--format` | `odoo` | `odoo` = `dump.sql`; `custom` = `dump.dump` (`-Fc`). |
| `--no-filestore` | `false` | Solo base de datos. |

Contenido:

```text
dump.sql                    # o dump.dump con --format custom
filestore/<db>/...          # filestore del stack
META-INF/soit.json          # database, stack, formato, creado, archivos
```

El dump se ejecuta con `pg_dump` dentro del contenedor `db` y se transmite
por stdout: la contraseña nunca aparece en `argv`. Si el filestore no existe,
SOIT avisa y continúa solo con la base de datos.

Restauración:

```bash
soit db restore dbs/odoo18c-20261107T120000.zip --db odoo18c --stack odoo18c
```

Ver [Bases de datos y restore](Bases-de-Datos-y-Restore#paso-5--restaura-un-backup)
para el flujo completo.

## Infraestructura

```bash
soit infra backup
soit infra backup --no-secrets
soit infra backup --output-dir /backups/soit
```

Incluye `docker-compose.infra.yml`, nginx, certbot, `certbot/www` y
`stacks/.order`. Por defecto también incluye `.env` y las claves de certbot:
mantén el ZIP privado o usa `--no-secrets` para compartirlo.

## Stacks

```bash
soit stack backup
soit stack backup odoo18c
soit stack backup --only odoo18c --only odoo17c
soit stack backup odoo18c --include-data
```

Incluye `docker-compose.yml`, `odoo.conf` y `addons/` de cada stack. No
incluye la base de datos ni el filestore; para eso usa `soit db backup`.
Con `--include-data` también incluye `data/` completo (puede ser grande).

## Todo (configuración)

```bash
soit backup
soit backup --no-secrets
soit backup --output-dir /backups/soit
```

`soit backup` crea un solo ZIP con la infraestructura y todos los stacks
(solo configuración). Es la salva más simple para versionar la
infraestructura, pero no sustituye a `soit db backup`.

## Verificar un ZIP

```bash
zipinfo mi-backup.zip
unzip -p mi-backup.zip META-INF/soit.json
sha256sum -c mi-backup.zip.sha256
```

Comprueba tres cosas:

1. El ZIP abre sin errores.
2. `META-INF/soit.json` lista la base, el stack y el formato esperados.
3. El SHA-256 coincide con el sidecar.

La restauración de archivos de infraestructura/stacks no está automatizada:
descomprime el ZIP en un árbol nuevo y revisa los diffs antes de arrancar.

## Programar backups

SOIT no instala un cron de backups. Programa `soit db backup` con el
planificador de tu sistema. Ejemplo de cron diario a las 02:30:

```cron
30 2 * * * cd /srv/odoo-infra && /usr/local/bin/soit db backup ydr_prod --stack ydrsoluciones --output /backups/soit/ydr_prod-$(date +\%Y\%m\%d).zip >> /var/log/soit-backup.log 2>&1
```

Ajusta rutas, usuario y retención. Verifica el backup de vez en cuando con
`unzip -l` y un restore en staging; un backup que nunca se prueba no es un
backup.

## Qué incluye cada backup

| Backup | BD | Filestore | `.env` / secretos | Configuración |
| --- | --- | --- | --- | --- |
| `db backup` | ✅ | ✅ (salvo `--no-filestore`) | ❌ | ❌ |
| `infra backup` | ❌ | ❌ | ✅ (salvo `--no-secrets`) | ✅ |
| `stack backup` | ❌ | ❌ (salvo `--include-data`) | ❌ | ✅ |
| `backup` | ❌ | ❌ | ✅ (salvo `--no-secrets`) | ✅ |

## Siguiente paso

- [Bases de datos y restore](Bases-de-Datos-y-Restore): restaurar un backup.
- [Operación y runbook](Operacion-y-Runbook): rutinas de producción.
- [Troubleshooting](Troubleshooting): diagnosticar fallos de backup/restore.
