# Referencia de comandos

Esta página es un mapa para consultar el árbol de comandos. Si buscas un
flujo guiado, empieza por [Guía de uso](Guia-de-uso). La sintaxis exacta y
los flags de la versión instalada siempre están en:

```bash
soit --help
soit <comando> --help
soit help <comando>
```

La referencia exhaustiva con defaults y ejemplos está en
[`USAGE.md`](https://github.com/mjavint/soit/blob/main/USAGE.md). Aquí se
resume qué hace cada comando y cuándo usarlo.

## Grupos del comando raíz

| Grupo | Comandos | Para qué |
| --- | --- | --- |
| `start` | `doctor`, `config`, `install` | Diagnóstico, configuración inicial e instalación del binario. |
| `infra` | `stack` | Infraestructura Docker y stacks Odoo. |
| `instances` | `instance`, `service` | Instancias Odoo y sitios nginx genéricos. |
| `data` | `cert`, `db` | Certificados y PostgreSQL. |
| `meta` | `version`, `upgrade`, `completion`, `help` | Versión, actualización del binario, autocompletado y ayuda. |

## Diagnóstico y configuración

| Comando | Qué hace | Flags principales |
| --- | --- | --- |
| `soit doctor` | Diagnóstico de solo lectura: Docker, Compose, raíz, `.env`, red, servicios, certificados, timer, imágenes `:latest`, secretos. | `--strict` |
| `soit config show` | Configuración efectiva con secretos redactados. | `-o json` |
| `soit config validate` | Valida requeridos y rutas de la infraestructura. | — |

```bash
soit doctor --strict
soit doctor -o json
soit config show
soit --env-file .env.staging config show
```

## Infraestructura

Alias del grupo: `infrastructure`.

| Comando | Qué hace |
| --- | --- |
| `soit infra init [dir]` | Crea el árbol mínimo de infra sin Docker. |
| `soit infra up` | Arranca db, nginx y certbot. |
| `soit infra down` / `stop` | Baja/detiene infra; se niega con stacks activos salvo `--force`. |
| `soit infra start` / `restart` | Arranca/reinicia infra. |
| `soit infra ps` (alias `status`) | Estado y salud de infra. |
| `soit infra health` | Informe de salud; `--check` devuelve exit 3. |
| `soit infra logs` | Logs de infra. |
| `soit infra pull` / `build` / `update` | Actualiza imágenes, construye o recrea solo si cambió. |
| `soit infra validate` | Valida `docker-compose.infra.yml` sin arrancar nada. |
| `soit infra backup` | ZIP de archivos de infra. |
| `soit infra compose <args>` | Pasa argumentos directamente a `docker compose` para infra. |

```bash
soit infra init ./odoo-infra
soit infra up
soit infra ps
soit infra logs --follow=false --tail 200
soit infra validate
soit infra backup --no-secrets
soit infra compose ps
```

Detalle: [Infraestructura](Infraestructura).

## Stacks

Alias del grupo: `stacks`.

| Comando | Qué hace |
| --- | --- |
| `soit stack up [stack...]` | Arranca stacks; requiere infra salvo `--with-infra`. |
| `soit stack down [stack...]` | Baja stacks en orden inverso (no toca infra). |
| `soit stack start` / `stop` / `restart [stack...]` | Arranca, detiene o reinicia stacks sin tocar infra. |
| `soit stack ps` (alias `status`) | Estado y salud de los stacks. |
| `soit stack list` (alias `ls`) | Stacks detectados, base de datos y compose. |
| `soit stack health` | Informe de salud de stacks; `--check` devuelve exit 3. |
| `soit stack logs [stack]` | Logs de un stack o de todos los stacks. |
| `soit stack pull` / `build` / `update [stack...]` | Actualiza imágenes, construye o recrea solo lo que cambió. |
| `soit stack validate [stack...]` | Valida compose files de stacks sin arrancar nada. |
| `soit stack remove <stack>` | Elimina un stack (down; volúmenes/archivos opcionales). |
| `soit stack order [stack...]` | Ver o definir el orden de arranque por defecto (`stacks/.order`). |
| `soit stack backup [stack...]` | ZIP de archivos de stacks. |
| `soit stack exec <stack> <svc> -- <cmd>` | Ejecuta un comando dentro de un contenedor. |
| `soit stack compose <stack> <args>` | Pasa argumentos directamente a `docker compose` para un stack. |

Flags más usados:

```bash
soit stack up odoo18
soit stack up --with-infra
soit stack up --only odoo18 --wait-timeout 5m
soit stack down odoo18
soit stack down --volumes --yes
soit stack validate odoo18
soit stack remove odoo18
soit stack order --first odoo20
soit stack health --wait --check
soit stack logs odoo18 --follow=false --tail 200 --since 1h
soit stack exec odoo18 odoo --no-tty -- odoo shell -d odoo18
soit stack compose odoo18 ps
```

Detalle: [Stacks y servicios](Stacks-y-Servicios).

## Instancias Odoo

Alias del grupo: `instances`.

| Comando | Qué hace |
| --- | --- |
| `soit instance create <domain> --odoo-version <ver>` | Crea o converge DNS, stack, BD, TLS, inicialización y salud. |
| `soit instance status [stack]` | Estado de una instancia o de todas. |
| `soit instance list` (alias `ls`) | Lista resumida de stacks Odoo. |

Alias de subcomandos: `instance new` = `create`; `instance show` = `status`;
`instance ls` = `list`.

```bash
soit instance create odoo18.example.com --odoo-version 18.0
soit instance create staging.example.com --odoo-version 18.0 --skip-dns --skip-tls
soit instance status
soit instance status odoo18
soit instance list -o json
```

Detalle: [Instancias Odoo](Instancias-Odoo).

## Certificados

Alias del grupo: `certs`, `certificate`, `certificates`.

| Comando | Qué hace |
| --- | --- |
| `soit cert list` (alias `ls`) | Lista certificados, dominios, días y emisor. |
| `soit cert status` | Igual que `list`; `--check` devuelve exit 3 si vence en ≤30 días. |
| `soit cert issue <domain>` | Emite un certificado si falta o no cubre el dominio. |
| `soit cert renew [domain]` | Renueva los certificados que toquen. |
| `soit cert reload` | Recarga nginx ahora. |
| `soit cert reload-if-changed` | Recarga solo si hubo renovación real. |
| `soit cert install-timer` | Instala `/etc/cron.d/soit-cert-reload`. |
| `soit cert uninstall-timer` | Quita el timer. |

```bash
soit cert list
soit cert status --check
soit cert issue odoo18.example.com --bootstrap
soit cert renew --simulate
sudo soit cert install-timer --every-minutes 15
soit cert install-timer --print-cron
```

Detalle: [TLS y certificados](TLS-y-Certificados).

## Servicios nginx

Alias del grupo: `services`.

| Comando | Qué hace |
| --- | --- |
| `soit service list` (alias `ls`) | Lista sitios nginx, incluidos los deshabilitados. |
| `soit service expose <domain>` (alias `add`) | Expone un backend `host:port` con TLS. |
| `soit service disable <domain>` | Mueve el sitio a `conf.d/.disabled/`. |
| `soit service enable <domain>` | Restaura el sitio desde `.disabled/`. |
| `soit service remove <domain>` | Elimina el sitio; conserva el certificado. |

```bash
soit service expose pgadmin.example.com --backend pgadmin:80 --auth-basic
soit service expose app.example.com --backend app:8000 --skip-dns --skip-challenge
soit service disable pgadmin.example.com
soit service enable pgadmin.example.com
soit service remove pgadmin.example.com
```

Detalle: [Stacks y servicios](Stacks-y-Servicios).

## Bases de datos

Alias del grupo: `database`, `databases`.

| Comando | Qué hace |
| --- | --- |
| `soit db list` (alias `ls`) | Lista bases de datos no-template. |
| `soit db create <name>` | Crea la BD si no existe. |
| `soit db drop <name>` | **Destructivo**; requiere `--yes`. |
| `soit db backup <db>` | Crea un ZIP Odoo (dump + filestore). |
| `soit db restore <backup.zip>` | Restaura dump + filestore y converge el stack. |

```bash
soit db list
soit db create demo_db
soit db drop demo_db --terminate --yes
soit db backup demo_db --stack odoo18
soit db restore dbs/backup.zip --db ydr_prod --stack ydrsoluciones
soit db restore dbs/backup.zip --db ydr_prod --on-exists=replace --yes
```

Detalle: [Bases de datos y restore](Bases-de-Datos-y-Restore).

## Instalación y actualización del binario

| Comando | Qué hace |
| --- | --- |
| `soit install [--dir <dir>]` | Copia el binario en ejecución a un directorio del `PATH`; sin red ni `sudo`. |
| `soit upgrade` (alias `self-update`) | Actualiza el binario desde GitHub Releases, verificando SHA-256. |
| `soit upgrade --check` | Informa si hay actualización; exit 3 si la hay. |
| `soit upgrade --prerelease` | Incluye release candidates. |
| `soit upgrade --version <tag>` | Fija una release concreta (`0.1.0` o `v0.1.0`). |

```bash
./bin/soit install
soit install --dir ~/.local/bin
soit upgrade --check
soit upgrade
soit upgrade --prerelease
sudo soit upgrade
```

`soit upgrade` **no** actualiza imágenes Docker: para eso están `soit update`,
`soit infra update` y `soit stack update`.

## Miscelánea

| Comando | Qué hace |
| --- | --- |
| `soit backup` | ZIP con infra + todos los stacks (solo configuración). |
| `soit version` | Versión, commit, fecha, Go y plataforma. |
| `soit completion <shell>` | Genera autocompletado para bash, zsh, fish o powershell. |
| `soit help [command]` | Ayuda de Cobra. |
| `soit --version` | Atajo de versión en el root. |

## Alias de la raíz

Estos alias existen por comodidad y por compatibilidad con los scripts
legacy. Son comandos ocultos en `--help`:

| Alias | Equivalente |
| --- | --- |
| `soit up` / `down` / `start` / `stop` / `restart` | agregado infra + stacks |
| `soit ps` / `status` | agregado infra + stacks |
| `soit health` / `logs` / `pull` / `update` / `build` | agregado infra + stacks |
| `soit list` / `ls` / `exec` | `soit stack list` / `soit stack exec` |
| `soit certs` | `soit cert list` |
| `soit self-update` | `soit upgrade` (solo el binario) |

## Flags globales

Disponibles en todos los comandos: `--root`, `--env-file`, `--public-ip`,
`--dry-run`, `--yes`, `--force`, `--no-color`, `--verbose`, `--quiet`,
`--log-format`, `--output`, `--timeout` y `--lock-timeout`.

Detalle y precedencia: [Configuración](Configuracion).

## Códigos de salida

| Código | Significado |
| --- | --- |
| `0` | Éxito, incluido “nada que hacer”. |
| `1` | Error de ejecución. |
| `2` | Error de uso. |
| `3` | Deriva detectada (`--check`, `upgrade --check` o `doctor --strict`). |

## Chuleta

```bash
# Infra
soit doctor
soit infra up
soit infra ps
soit infra health --wait --check

# Stacks
soit stack up odoo18
soit stack ps
soit stack health --wait --check

# Instancia
soit instance create odoo18.example.com --odoo-version 18.0
soit instance status odoo18

# Logs y shell
soit stack logs odoo18 --follow=false --tail 200
soit stack exec odoo18 odoo -- odoo shell -d odoo18
soit infra logs --follow=false --tail 200

# Datos
soit db list
soit db backup odoo18 --stack odoo18
soit db restore dbs/backup.zip --db odoo18 --stack odoo18

# Backups
soit backup --no-secrets

# TLS
soit cert status --check
sudo soit cert install-timer

# Binario
soit install
soit upgrade --check
soit upgrade
```
