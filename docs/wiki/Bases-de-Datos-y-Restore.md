# Bases de datos y restore

> **Resultado:** podrás crear, respaldar y restaurar una base de datos Odoo
> completa (dump + filestore) sin `psql` en el host.
>
> **Tiempo estimado:** 10–20 minutos según el tamaño del backup. **Riesgo:**
> alto en `drop` y `restore --on-exists=replace`.

SOIT opera PostgreSQL dentro del contenedor `db` de la infraestructura. No
necesitas `psql` en el host ni una `DATABASE_URL`: los comandos usan
`docker compose exec` y pasan credenciales por stdin, no por `argv`.

## Antes de empezar

```bash
soit infra up
soit infra health --check
soit db list
```

Si `db list` falla, revisa `soit infra ps` y
[Troubleshooting](Troubleshooting#la-base-de-datos-no-responde).

## Paso 1 — Lista las bases de datos

```bash
soit db list
soit db list -o json
```

La tabla muestra nombre, tamaño, dueño y conexiones activas. Usa el nombre
exacto de la columna `name` en los comandos siguientes.

## Paso 2 — Crea una base de datos

```bash
soit db create demo_db
```

`db create` usa `CREATE DATABASE ... TEMPLATE template0 ENCODING UTF8` y es
idempotente: si la base ya existe, no hace nada y avisa.

```bash
soit db create demo_db
soit --dry-run db create demo_db
```

Los nombres deben ser identificadores PostgreSQL válidos: letras, dígitos y
guiones bajos, empezando por letra o dígito, máximo 63 caracteres. Las
mayúsculas se permiten en bases existentes y se citan siempre.

> **Nota:** crear la base no crea el stack, el `odoo.conf`, el vhost ni el
> filestore. Para una instancia completa usa
> [Instancias Odoo](Instancias-Odoo#paso-2--crea-la-instancia).

## Paso 3 — Borra una base de datos

```bash
soit db drop <name> [--terminate] --yes
```

**⚠️ Destructivo.** Sin `--yes` falla como error de uso (código `2`). Con
`--terminate` usa `DROP DATABASE ... WITH (FORCE)` para cortar conexiones
activas; sin él, una base en uso falla.

```bash
soit db drop demo_db --yes
soit db drop demo_db --terminate --yes
soit --dry-run db drop demo_db
```

`db drop` **no** borra el filestore, el stack, el vhost nginx ni el
certificado. Es solo la base de datos. Antes de ejecutarlo, decide qué
conservar:

```bash
soit db backup demo_db --stack demo   # si aún no tienes backup
soit db drop demo_db --terminate --yes
```

## Paso 4 — Backup de BD + filestore

```bash
soit db backup <db> --stack <stack>
```

Crea un ZIP estilo Odoo con `dump.sql` (o `dump.dump` con `--format custom`),
`filestore/<db>/` y `META-INF/soit.json`. Por defecto se guarda en
`<root>/dbs/<db>-<timestamp>.zip` (0600) con sidecar `.zip.sha256`.

```bash
soit db backup ydr_prod --stack ydrsoluciones
soit db backup demo --no-filestore
soit db backup demo --format custom --output dbs/demo.zip
```

| Flag | Default | Uso |
| --- | --- | --- |
| `--stack` | inferido de `odoo.conf` | Stack dueño del filestore. Pásalo siempre explícito. |
| `--output` | `<root>/dbs/<db>-<timestamp>.zip` | Ruta exacta del ZIP. |
| `--format` | `odoo` | `odoo` = `dump.sql`; `custom` = `dump.dump` (`-Fc`). |
| `--no-filestore` | `false` | Solo base de datos. |

Contenido del ZIP:

```text
dump.sql                    # o dump.dump con --format custom
filestore/<db>/...          # filestore del stack
META-INF/soit.json          # database, stack, formato, creado, archivos
```

El dump se ejecuta con `pg_dump` dentro del contenedor `db` y se transmite
por stdout: la contraseña nunca aparece en `argv`. Si el filestore no existe,
SOIT avisa y continúa solo con la base de datos.

Verifica el ZIP antes de moverlo:

```bash
unzip -l dbs/demo-20261110T120000.zip
unzip -p dbs/demo-20261110T120000.zip META-INF/soit.json
sha256sum -c dbs/demo-20261110T120000.zip.sha256
```

## Paso 5 — Restaura un backup

```bash
soit db restore <backup.zip> --db <database> [flags]
```

El ZIP debe contener:

```text
backup.zip
├── dump.sql | dump.dump | dump.backup | PGDMP
└── filestore/
    └── <database>/...
```

SOIT detecta el formato:

- `.sql`: SQL plano; se pasa a `psql`.
- `.dump`, `.backup`, `PGDMP`: formato custom; se pasa a `pg_restore`.
- Si hay varios, prefiere el custom.

El dump se extrae a `.soit/tmp/restore-*` con protección contra *zip-slip* y
se hace *streaming* a `psql`/`pg_restore` dentro del contenedor `db`. La
contraseña nunca se pasa por `argv`.

### Restaurar en una instancia nueva

```bash
# 1. Crear la instancia SIN inicializar la BD
soit instance create demo.example.com \
  --odoo-version 17.0 --skip-init --skip-dns --skip-tls

# 2. Restaurar dump + filestore
soit db restore dbs/demo.zip --db demo --stack demo

# 3. Verificar
soit instance status demo
soit stack logs demo --follow=false --tail 200
curl -I http://demo.example.com
```

### Restaurar sobre una BD existente

Primero decide qué hacer con `--on-exists`:

| Valor | Comportamiento |
| --- | --- |
| `fail` | Aborta si la BD existe (default seguro). |
| `skip` | No hace nada y termina con éxito. |
| `replace` | **Destructivo**: hace `DROP` y recrea. Requiere `--yes`. |

```bash
# Reponer una BD existente (destructivo)
soit db restore dbs/backup.zip --db ydr_prod --on-exists=replace --yes

# Si ya existe, no hacer nada
soit db restore dbs/backup.zip --db ydr_prod --on-exists=skip
```

### Flags de restore

| Flag | Default | Uso |
| --- | --- | --- |
| `--db string` | — (**requerido**) | Base de datos destino. |
| `--stack string` | `ydrsoluciones` | Stack que usará la BD; define `odoo.conf` y filestore destino. **Pásalo siempre explícito**; el default es legacy. |
| `--odoo-version string` | inferida del compose | Solo para detectar `uid/gid` del filestore. |
| `--on-exists fail\|skip\|replace` | `fail` | Qué hacer si la BD existe. |
| `--filestore auto\|skip` | `auto` | Sincronizar filestore si el ZIP lo trae. |
| `--prune-filestore` | `false` | Borra archivos destino que no estén en el backup. |
| `--uid int` / `--gid int` | `0` (detectar) | Dueño del filestore. |
| `--no-chown` | `false` | No cambia la propiedad del filestore. |

### Filestore y ownership

Si el ZIP trae `filestore/`, SOIT lo sincroniza archivo por archivo hacia:

```text
stacks/<stack>/data/filestore/<database>/
```

- `--prune-filestore` elimina archivos destino que no estén en el backup.
  **Peligroso** si el backup es parcial.
- El UID/GID se detecta de la imagen Odoo (`odoo:<version>` → `id -u odoo`,
  fallback `101:101`). La versión se toma de `--odoo-version` o del `image:`
  del compose del stack.
- Si no eres root, SOIT avisa y muestra el `chown` exacto que debes ejecutar.
- `--no-chown` deja la propiedad como está; útil si el host ya tiene el
  UID/GID correcto o no tienes permisos.

```bash
soit db restore dbs/backup.zip --db demo --stack demo --no-chown
soit db restore dbs/backup.zip --db demo --stack demo --uid 101 --gid 101
soit db restore dbs/backup.zip --db demo --stack demo --filestore=skip
```

### Verificación y logs

Después del dump, SOIT cuenta las tablas de la BD. Si hay menos de 10,
considera el restore fallido y muestra las últimas líneas del log:

```text
restore failed: demo has only 3 tables
last log lines:
...
```

El log completo queda en:

```text
.soit/logs/restore-*.log
```

Además, SOIT converge `db_name` en `stacks/<stack>/odoo.conf`, reinicia Odoo
solo si el archivo cambió y verifica `http://odoo-<stack>:8069/web/health`.

## Ejemplos completos

```bash
# Flujo estándar
soit db restore dbs/odoo17_ydr_prod.zip --db ydr_prod --stack ydrsoluciones

# Reemplazar una BD existente
soit db restore dbs/backup.zip --db ydr_prod --on-exists=replace --yes

# Solo dump, sin filestore ni chown (CI/staging)
soit db restore dbs/backup.zip --db test --filestore=skip --no-chown

# Forzar versión para ownership cuando el stack aún no tiene compose
soit db restore dbs/backup.zip --db ydr_prod --stack ydrsoluciones --odoo-version 17.0

# Plan sin mutar
soit --dry-run db restore dbs/backup.zip --db demo --stack demo
```

## Troubleshooting

| Síntoma | Qué revisar |
| --- | --- |
| `db` no está corriendo | `soit infra up`; `soit infra ps`. |
| `password authentication failed` | `soit config show`; revisa `POSTGRES_USER`/`POSTGRES_PASSWORD`. |
| `database ... already exists` | Usa `--on-exists=skip` o `--on-exists=replace --yes`. |
| `only N tables` | El dump está incompleto o falló; revisa `.soit/logs/restore-*.log`. |
| Filestore con dueño incorrecto | Revisa `--uid/--gid`, `--no-chown` y el `chown` sugerido. |
| Odoo no healthy tras restore | `soit stack logs <stack> --follow=false --tail 200`; revisa `odoo.conf`. |
| `--stack` incorrecto | El default es `ydrsoluciones`; pasa el stack real. |
| ZIP sin filestore | Se restaura solo la BD; aviso en la salida. |

Más casos: [Troubleshooting](Troubleshooting).
