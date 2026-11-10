# Troubleshooting

Esta página asume que ya leíste [Primeros pasos](Instalacion-y-Primeros-Pasos)
y que SOIT encuentra la raíz de infraestructura. Si no la encuentra, empieza
por la sección [La raíz no se encuentra](#la-raíz-no-se-encuentra).

Cada sección sigue el mismo patrón: **síntoma → diagnóstico → solución →
verificación**. Empieza por el [kit de diagnóstico](#kit-de-diagnóstico) y no
cambies nada hasta tener evidencia.

## Kit de diagnóstico

Antes de cambiar nada, recoge evidencia:

```bash
soit version
soit doctor
soit doctor -o json
soit config show
soit config show -o json
soit infra ps
soit stack ps
soit stack ps -o json
soit instance list -o json
soit cert list
```

Para un fallo concreto:

```bash
# Reproduce con diagnóstico
soit -v <comando>

# Logs del stack afectado
soit stack logs <stack> --follow=false --tail 300

# Logs de infra (db, nginx, certbot)
soit infra logs --follow=false --tail 300
```

La salida principal va a stdout; el progreso y los errores a stderr. Si
rediriges a un archivo, separa ambos:

```bash
soit -v instance create ... >out.log 2>err.log
```

## Códigos de salida

| Código | Significado | Qué hacer |
| --- | --- | --- |
| `0` | Éxito, incluido “nada que hacer”. | Nada. |
| `1` | Error de ejecución. | Revisa el mensaje y los logs. |
| `2` | Error de uso. | Falta un argumento/flag o hay un conflicto. |
| `3` | Deriva detectada. | `doctor --strict`, `stack health --check` o `cert status --check`. |

Si ves código 2, casi siempre es un flag mal escrito o un requerido faltante.
El error incluye una pista con `--help`.

## `Can't find .pfb for face 'Courier'`

```text
Warn: Can't find .pfb for face 'Courier'
```

**No es la causa del fallo.** Es un aviso de ReportLab (fuentes para PDF) que
Odoo emite al generar reportes. SOIT lo ignora al elegir la línea de error y
añade una aclaración.

Qué hacer:

1. No instales fuentes ni cambies la imagen por este aviso.
2. Busca la excepción real de Odoo en la salida o en los logs.
3. Ejecuta la inicialización manualmente con logs visibles:

```bash
soit stack compose <stack> run --rm -T odoo \
  odoo -d <db> --init=base --stop-after-init --no-http \
  --logfile=/dev/stderr
```

4. Si el stack ya está corriendo:

```bash
soit stack logs <stack> --follow=false --tail 300
```

## `exited with code 255` al inicializar

`255` es el código genérico de fallo de Odoo. El mensaje real está en la
salida de Odoo, no en el código. SOIT ejecuta la inicialización con
`--logfile=/dev/stderr` justamente para capturarlo y resume la última línea
significativa.

Checklist:

```bash
# 1. ¿La infra está sana?
soit infra ps
soit stack ps
soit infra logs --follow=false --tail 200

# 2. ¿La BD conecta?
soit config show
soit infra logs --follow=false --tail 200

# 3. Reintenta con logs visibles
soit stack compose <stack> run --rm -T odoo \
  odoo -d <db> --init=base --stop-after-init --no-http \
  --logfile=/dev/stderr

# 4. Si vas a restaurar un dump, no inicialices
soit instance create <domain> --odoo-version <ver> --skip-init
soit db restore <backup.zip> --db <db> --stack <stack>
```

Causas frecuentes:

| Causa | Señal | Solución |
| --- | --- | --- |
| PostgreSQL no disponible | `connection refused`, `could not connect` | `soit infra up`; revisa `soit infra ps`. |
| Credenciales incorrectas | `password authentication failed` | Corrige `POSTGRES_USER`/`POSTGRES_PASSWORD`; `soit config show`. |
| BD inexistente | `database ... does not exist` | Deja que `instance create` la cree o usa `db create`. |
| `logfile` legacy | ruta `/var/log/odoo/odoo.log` | Re-ejecuta `instance create` para migrar a `/dev/stdout`. |
| Filestore sin permiso | `PermissionError: ... '/var/lib/odoo/filestore'` | `sudo chown -R 101:101 <root>/stacks/<stack>/data` y re-ejecuta `instance create`. Las instancias nuevas crean `data/filestore|data/sessions|data/addons` y hacen `chown` si SOIT corre como root. |
| Módulo/addon inválido | traceback Python | Revisa el addon y los logs. |
| Falta de memoria | OOM kill, contenedor reiniciado | Revisa `docker inspect` y recursos del host. |

## DNS no coincide

```text
DNS <domain> -> <otra-ip> (server <ip>)
```

Comprueba:

```bash
dig +short <domain>
soit doctor
```

Opciones:

- Corrige el registro A/AAAA para que apunte a la IP pública.
- Para staging/privado: `--skip-dns`.
- Si hay CDN/proxy y la IP no coincide a propósito: `--allow-dns-mismatch`
  (avisa y continúa; el certificado puede fallar igual).
- Si la detección automática de IP falla, pasa `--public-ip` o define
  `SOIT_PUBLIC_IP`.

```bash
soit --public-ip 203.0.113.10 instance create ...
soit instance create ... --skip-dns
soit instance create ... --allow-dns-mismatch
```

## La base de datos no responde

Síntomas habituales:

```text
connection refused
could not connect to server
password authentication failed for user "odoo"
database "<name>" does not exist
```

Diagnóstico:

```bash
soit infra ps
soit infra health --check
soit config show
soit infra logs --follow=false --tail 300
```

Solución según la causa:

| Señal | Causa | Solución |
| --- | --- | --- |
| `connection refused` | El contenedor `db` no está corriendo o no está healthy. | `soit infra up`; revisa `soit infra ps`. |
| `password authentication failed` | `POSTGRES_PASSWORD` no coincide con el volumen existente. | Corrige `.env` o rota la contraseña con un procedimiento probado; `soit config show`. |
| `database ... does not exist` | La BD no se creó o el nombre es distinto. | `soit db list`; `soit db create <name>` o usa el nombre correcto. |
| `too many connections` | Conexiones agotadas. | Revisa `pg_stat_activity`; reinicia el stack con cuidado. |

Verificación:

```bash
soit db list
soit stack health --wait --check
```

## La infraestructura no está corriendo

`instance create` exige que `db` y `nginx` estén disponibles.

```bash
soit infra up
soit infra ps
soit stack ps
soit stack health --wait --check
```

Si `infra up` falla:

```bash
soit infra compose config
soit infra logs --follow=false --tail 300
docker compose -f docker-compose.infra.yml ps
```

## La raíz no se encuentra

```text
infrastructure root not found: run from the odoo-infra directory or pass --root
```

SOIT busca `docker-compose.infra.yml` en:

1. `--root <ruta>`
2. `$SOIT_ROOT`
3. El directorio actual y sus padres.
4. Un subdirectorio `odoo-infra/`.

```bash
soit --root /srv/odoo-infra doctor
SOIT_ROOT=/srv/odoo-infra soit doctor
cd /srv/odoo-infra && soit doctor
```

Si la ruta existe pero no contiene `docker-compose.infra.yml`, SOIT falla con
`<ruta> does not contain docker-compose.infra.yml`.

## Error de uso (código 2)

| Mensaje | Causa | Solución |
| --- | --- | --- |
| `--odoo-version is required` | Falta la versión | `--odoo-version 18.0`. |
| `instance create requires exactly one domain` | 0 o >1 dominios | Pasa un solo FQDN. |
| `db restore requires exactly one backup path` | Falta el ZIP o hay varios | Pasa un solo `.zip`. |
| `--db is required` | Falta destino | `--db <name>`. |
| `--backend is required` | Falta backend | `--backend host:port`. |
| `--on-exists=replace will drop ... re-run with --yes` | Confirmación faltante | Añade `--yes`. |
| `--volumes requires --yes` | Confirmación faltante | Añade `--yes`. |
| `unknown flag` | Flag inexistente | `soit <cmd> --help`. |

## Lock ocupado

```text
could not acquire lock ... after 15s
```

Otro proceso `soit` está ejecutando una operación mutante. Opciones:

```bash
# Esperar más
soit --lock-timeout 2m stack up

# Ver procesos
ps aux | grep '[s]oit'
```

No borres `.soit/soit.lock` mientras haya un proceso vivo. Si el proceso
murió, el `flock` se libera solo.

## Archivos no gestionados

SOIT no sobrescribe archivos sin el marcador:

```text
# managed-by: soit
```

Si un `docker-compose.yml`, `odoo.conf` o vhost no lleva el marcador, SOIT lo
deja intacto y avisa. Opciones:

1. Revisa el archivo y añade el marcador si quieres que SOIT lo gestione.
2. Usa `--force` para sobrescribirlo (SOIT guarda backup).
3. Mueve el archivo a otro nombre si quieres conservarlo.

```bash
soit --force instance create <domain> --odoo-version <ver>
```

## Salud y timeouts

```text
stack <name> did not become healthy within 3m
```

```bash
# Ver estado
soit stack ps

# Ver logs
soit stack logs <stack> --follow=false --tail 300

# Validar compose
soit stack compose <stack> config

# Esperar más
soit stack health --wait --wait-timeout 10m
soit instance create ... --wait-timeout 10m
```

Si el contenedor reinicia en bucle, revisa `docker inspect <container>` y los
logs; no es un problema de timeout.

## Odoo 20 devuelve 502 o no acepta conexiones

Odoo 20 en Docker escucha en `127.0.0.1` por defecto, así que el healthcheck
puede pasar mientras nginx recibe `502 Bad Gateway`. Verifica que el
`odoo.conf` del stack tenga:

```ini
http_interface = 0.0.0.0
```

Si falta, re-ejecuta `instance create` (solo toca archivos gestionados) y
reinicia el stack:

```bash
soit instance create <domain> --odoo-version <ver>
soit stack restart <stack>
soit stack logs <stack> --follow=false --tail 100
```

## Restore falla

| Síntoma | Causa probable | Solución |
| --- | --- | --- |
| `database ... already exists` | `--on-exists=fail` | `--on-exists=skip` o `--on-exists=replace --yes`. |
| `only N tables` | Dump incompleto o error de `pg_restore` | Revisa `.soit/logs/restore-*.log`. |
| `no .sql, .dump or .backup file found` | ZIP sin dump | Verifica el contenido del ZIP. |
| `refusing unsafe path in zip` | Zip-slip | El ZIP es sospechoso; no lo uses. |
| Filestore con dueño incorrecto | UID/GID | `--uid/--gid`, `--no-chown`, o ejecuta el `chown` sugerido. |
| Odoo no healthy | `db_name` o filestore | Revisa `odoo.conf` y logs del stack. |
| `--stack` incorrecto | Default legacy `ydrsoluciones` | Pasa `--stack <real>`. |

```bash
soit db restore backup.zip --db demo --stack demo --on-exists=skip
soit db restore backup.zip --db demo --stack demo --filestore=skip --no-chown
```

## nginx y certificados

```bash
soit service list
soit cert list
soit cert status --check
soit infra logs --follow=false --tail 300
soit cert reload
```

- Si `nginx -t` falla, SOIT restaura el archivo anterior. Revisa el log y el
  vhost en `nginx/conf.d/`.
- Si el certificado está por vencer, `soit cert renew`.
- Si certbot falla por DNS, revisa el registro A y el puerto 80.
- Si el timer no recarga, revisa `/etc/cron.d/soit-cert-reload` y
  `.soit/logs/cert-reload.log`.

## Logs de Odoo no aparecen

Los `odoo.conf` nuevos usan `logfile = /dev/stdout`. Si un stack antiguo usa
`/var/log/odoo/odoo.log`, los logs no salen por `soit stack logs`.

```bash
# Ver el valor actual
grep -n 'logfile' stacks/<stack>/odoo.conf

# Migrar (re-ejecuta create; solo toca archivos gestionados)
soit instance create <domain> --odoo-version <ver>
```

Si el archivo no es gestionado, SOIT no lo cambia; edítalo a mano o usa
`--force` con backup.

## JSON contaminado o scripts rotos

La salida principal va a stdout y los diagnósticos a stderr. Si un script
mezcla ambos, separa los flujos:

```bash
soit instance list -o json > instances.json 2> instances.err
```

Para logs de inicialización, SOIT los envía a stderr a propósito. No los
redirijas al mismo archivo que el JSON.

## Docker y permisos

```bash
docker version
docker compose version
docker ps
```

- Si Docker no está corriendo, arráncalo.
- Si el usuario no tiene permisos, añade el usuario al grupo `docker` o usa
  `sudo` para las operaciones que lo requieran.
- `cert install-timer` y `cert uninstall-timer` requieren root; usa
  `--print-cron` para inspeccionar sin root.

## Cómo pedir ayuda

Incluye:

1. `soit version`.
2. El comando exacto y su salida completa (stdout y stderr).
3. `soit doctor -o json`.
4. `soit config show -o json` (revisa que no haya secretos sin redactar).
5. `soit infra ps -o json` y `soit stack ps -o json`.
6. Logs relevantes: `soit stack logs <stack> --follow=false --tail 300`.
7. Qué esperabas que pasara y qué pasó.

**Nunca** adjuntes `.env`, contraseñas, dumps ni claves privadas sin
redactarlos.

## Ver también

- [Instancias Odoo](Instancias-Odoo)
- [Stacks y servicios](Stacks-y-Servicios)
- [Bases de datos y restore](Bases-de-Datos-y-Restore)
- [TLS y certificados](TLS-y-Certificados)
- [Operación y runbook](Operacion-y-Runbook)
