# SOIT — Uso completo (argumentos, flags y ejemplos)

`soit` es un binario Go único para operar la infra Docker de Odoo
(`docker-compose.infra.yml` + `stacks/*/docker-compose.yml`).
Todo comando mutante es idempotente: inspecciona, planea con `--dry-run`
y solo aplica diferencias (escrituras atómicas, backups, `nginx -t`
antes de recargar).

> **Fuente de verdad:** `soit <comando> --help` (cobra). Esta guía
> añade el *contexto* que `--help` no muestra: cuándo usar cada argumento,
> defaults, valores permitidos y ejemplos de flujo completo.
> El orden aquí sigue el árbol de comandos (`soit --help`).
>
> **Wiki operativa:** [`docs/wiki/Home.md`](docs/wiki/Home.md)
> (flujos, runbook, troubleshooting y arquitectura).

---

## 1. Cómo leer esta referencia

- `<...>` = argumento posicional **requerido**. `[<...>]` = opcional.
  `soit stack logs [stack|infra]`: máx. 1 posicional, o bien un nombre de
  stack o bien la palabra `infra`.
- `--flag valor` = flag con valor. `--flag` solo = booleano. Las formas
  cortas (`-v`, `-q`, `-o`, `-y`, `-f`, `-V`, `-e`, `-u`, `-w`) son alias.
- Los **flags globales** (sección 3) están disponibles en *todo* comando;
  pueden ir antes o después del subcomando:
  `soit --dry-run stack up` ≡ `soit stack up --dry-run`.
- `soit stack compose` desactiva el parseo de flags (`DisableFlagParsing`):
  todo lo que sigue tras `<infra|stack>` va tal cual a `docker compose`.
- **Alias ocultos** (raíz): `up`, `down`, `start`, `stop`, `restart`,
  `ps`, `status`, `health`, `logs`, `pull`, `update`, `build`, `list`,
  `ls`, `exec`, `certs`. Son idénticos a sus equivalentes `stack`/`cert`.
  Secciones 5–8 ya indican el comando completo; los alias se listan en §9.

---

## 2. Requisitos y raíz

**Requisitos de runtime:** Docker + plugin Compose. No se necesita `dig`,
`date -d`, `xargs -r`, `tac` ni `rsync` (antes sí, en los scripts legacy).

`soit` localiza `docker-compose.infra.yml` en este orden:

1. `--root <path>` (flag global).
2. `$SOIT_ROOT`.
3. Directorio actual y cada padre.
4. `odoo-infra/` hijo de cada directorio al bajar.

Por eso `cd odoo-infra && soit doctor` y `cd odoo-stack && soit doctor`
funcionan igual.

```bash
soit doctor                                  # auto-detección desde cwd
soit --root /srv/odoo-infra doctor           # raíz explícita
SOIT_ROOT=/srv/odoo-infra soit doctor        # vía ambiente
soit --root odoo-infra --dry-run stack up    # root + plan sin tocar nada
```

---

## 3. Configuración: `.env`, ambiente y precedencia

Precedencia: **flags > ambiente > `.env` > defaults**.

Solo estas claves del `.env` tienen efecto (el resto se muestra en
`soit config show` pero se ignora):

| Clave | Default | Uso | Ejemplo |
|---|---|---|---|
| `PROJECT_NAME` | `odoo-infra` | Nombre del proyecto Compose; define la red `<name>_shared` | `PROJECT_NAME=odoo-infra` |
| `POSTGRES_USER` | `odoo` | Usuario PostgreSQL de infra y stacks | `POSTGRES_USER=odoo` |
| `POSTGRES_PASSWORD` | *(vacío, requerido)* | Contraseña PostgreSQL; nunca se imprime | `POSTGRES_PASSWORD=...` |
| `PG_VERSION` | `16` | Tag de `postgres:<ver>-alpine` en infra | `PG_VERSION=16` |
| `ACME_EMAIL` (o `EMAIL`) | `""` | Email Let's Encrypt por defecto | `ACME_EMAIL=ops@example.com` |

Variables de ambiente relevantes (leídas aunque falte el `.env`, para CI sin
secretos en disco):

| Variable | Efecto |
|---|---|
| `SOIT_ROOT` | Raíz de infra (equivale a `--root`) |
| `SOIT_PUBLIC_IP` | IP pública esperada para chequeos DNS (equivale a `--public-ip`) |
| `SOIT_ODOO_ADMIN_PASSWD` | `admin_passwd` de `instance create` si no se pasa `--admin-passwd` |
| `SOIT_AUTH_PASSWORD` | Password de basic-auth de `service expose` si no se pasa `--auth-password` |

> **La versión de Odoo NO está en el `.env`.** Es un argumento por instancia
> (`soit instance create … --odoo-version 17.0`). Así una misma infra puede
> tener `odoo17c` en `17.0` y otro stack en `18.0`: lo que fija la versión es
> el `image: odoo:<ver>` de su `stacks/<name>/docker-compose.yml`.

```bash
soit config show            # tabla efectiva, secretos redactados
soit config show -o json    # lo mismo en JSON (para CI)
soit config validate        # valida requeridos y rutas
```

---

## 4. Flags globales (todos los comandos)

| Flag | Tipo / default | Contexto | Ejemplo |
|---|---|---|---|
| `--root string` | `""` (auto) | Raíz de infra; se ignora si se encuentra por autodetección. Útil en CI o con múltiples infra. | `soit --root ../odoo-infra stack up` |
| `--env-file string` | `""` → `<root>/.env` | Ruta alternativa al `.env` (relativa → relativa a la raíz). Útil para staging o multi-ambiente. | `soit --env-file .env.staging stack up` |
| `--public-ip string` | `""` → `$SOIT_PUBLIC_IP` | IP que el DNS debe resolver. Si se omite, se obtiene automáticamente vía un servicio público de IP. | `soit --public-ip 203.0.113.10 instance create odoo18.example.com --odoo-version 18.0` |
| `--dry-run` (bool) | `false` | **Plan sin mutar**: imprime `+ comando` en vez de ejecutarlo. Las lecturas (`ps`, `SELECT`, `nginx -t`) sí corren, para que el plan sea real. | `soit --dry-run instance create odoo18.example.com --odoo-version 18.0` |
| `-y`, `--yes` | `false` | Asume `sí` en confirmaciones destructivas (`db drop`, `db restore --on-exists=replace`, `stack down --volumes`). Sin esto, esos comandos fallan con error de uso. | `soit db restore b.zip --db x --on-exists=replace --yes` |
| `--force` | `false` | Sobrescribe archivos **no gestionados** por `soit` y fuerza reemisión de certificados. Sin esto, un `docker-compose.yml` sin marcador `# managed-by: soit` se deja intacto con aviso. | `soit --force instance create odoo18.example.com --odoo-version 18.0` |
| `--no-color` | `false` | Desactiva colores (pipes, logs, CI). | `soit --no-color stack health` |
| `-v`, `--verbose` | `false` | Diagnóstico extra (p. ej. intentos de `/web/health`). Útil al depurar DNS/cert/Docker. | `soit -v doctor` |
| `-q`, `--quiet` | `false` | Solo errores. Útil en scripts/cron. | `soit cert reload-if-changed -q` |
| `--log-format text\|json` | `text` | Formato de los mensajes de diagnóstico (no el de tablas). | `soit --log-format json doctor -o json` |
| `-o`, `--output table\|json\|plain` | `table` | Formato del resultado principal (tablas vs JSON). `plain` no aplica a tablas; es válido para `version`/`completion`. | `soit config show -o json` |
| `--timeout duration` | `0` (= sin límite) | Timeout global del comando. Útil en CI para no colgar indefinidamente. | `soit --timeout 3m stack health --wait` |
| `--lock-timeout duration` | `15s` | Espera del lock advisory `.soit/soit.lock` que evita dos runs mutantes concurrentes. Subirlo si en CI se solapan jobs. | `soit --lock-timeout 60s stack up` |
| `-h`, `--help` | — | Ayuda del comando. Cobra la genera; esta guía resume. | `soit instance create --help` |
| `--version` | — | Solo en el root: imprime versión de build (`soit <ver> (commit…, built…)`). | `soit --version` |

Notas de contexto:

- `--dry-run` **no es** lo mismo que `--simulate` (este último solo existe en
  `cert renew` y ejecuta el `--dry-run` del propio certbot para validar la
  renovación sin quemar *rate limit*).
- `--force` (global) y `--force` (local de `stack update`) coexisten: el local
  fuerza recrear aunque la imagen no haya cambiado; el global fuerza
  sobrescribir archivos no gestionados / certificados.

---

## 5. Diagnóstico

### 5.1 `soit doctor [--strict]`

**Sintaxis:** `soit doctor [flags]`

**Qué hace:** Diagnóstico de solo lectura (nada se modifica): Docker,
Compose, raíz, `.env`/permisos, red compartida, infra corriendo,
certificados (expirados ≤30 días), timer de renovación, imágenes
`:latest` sin fijar, secretos en claro en `odoo.conf`/compose y exposición
de pgadmin. Códigos: `0` ok, `1` errores duros, `3` con `--strict` si hay
avisos.

| Flag local | Tipo / default | Contexto | Ejemplo |
|---|---|---|---|
| `--strict` | bool `false` | Trata avisos como fallo (exit 3). Útil en CI para “deuda técnica”. | `soit doctor --strict` |

**Ejemplos:**

```bash
soit doctor                        # diagnóstico legible
soit doctor -o json                # para dashboards/CI
soit doctor --strict -v            # estricto y verboso
```

### 5.2 `soit config show` / `soit config validate`

**Sintaxis:** `soit config show [flags]` · `soit config validate [flags]`

**Qué hace:** `show` imprime la configuración efectiva (secretos
redactados). `validate` comprueba requeridos (`POSTGRES_USER`,
`POSTGRES_PASSWORD`, `PROJECT_NAME`) y rutas (`docker-compose.infra.yml`,
`stacks/`, `nginx/conf.d/`, `certbot/conf/live/`); exit 1 si falla.

**Contexto:** Son los primeros comandos tras instalar o al cambiar el
`.env`. `show -o json` alimenta verificaciones automatizadas.

```bash
soit config show
soit config show -o json
soit config validate
soit --env-file .env.staging config show
```

---

## 6. Infraestructura y stacks

> `infra` = `docker-compose.infra.yml` (db, nginx, certbot). `stack` = alias
> `stacks` (`stacks/<name>/docker-compose.yml`). Los stacks arrancan según
> `soit stack order` (`stacks/.order`); si no hay archivo de orden, se usa el
> orden alfabético. Todo es convergente (re-ejecutar no duplica ni rompe la
> red compartida). Los comandos de raíz `up/down/start/stop/restart/ps/...`
> son alias ocultos agregados (infra + stacks).

### 6.1 `soit infra init [dir]`

**Sintaxis:** `soit infra init [dir] [flags]`

Crea la estructura mínima de una infraestructura nueva sin Docker: directorios,
`docker-compose.infra.yml`, `.env` (0600), `.env.example`, `.gitignore`,
certbot SSL y `stacks/.order`. No sobrescribe un `.env` existente. Si `--root`
se pasa y no hay `[dir]`, se usa `--root`.

| Flag | Tipo / default | Contexto | Ejemplo |
|---|---|---|---|
| `--project-name string` | `odoo-infra` | Prefijo del proyecto Compose. | `soit infra init --project-name acme` |
| `--postgres-user string` | `odoo` | Usuario PostgreSQL. | `soit infra init --postgres-user odoo` |
| `--postgres-password string` | generado | Contraseña PostgreSQL. | `soit infra init --postgres-password 'Pass-123!'` |
| `--pg-version string` | `16` | Versión de PostgreSQL. | `soit infra init --pg-version 16` |
| `--acme-email string` | `""` | Email para Let's Encrypt. | `soit infra init --acme-email ops@example.com` |
| `--with-pgadmin` | `false` | Incluye pgAdmin en `127.0.0.1:5050`. | `soit infra init --with-pgadmin` |
| `--force` | `false` | Sobrescribe archivos no gestionados (con backup). | `soit infra init --force` |

```bash
soit infra init ./odoo-infra
soit infra init --project-name acme --acme-email ops@example.com
soit --dry-run infra init ./odoo-infra
```

### 6.2 `soit infra up` / `down` / `start` / `stop` / `restart`

**Sintaxis:** `soit infra up|down|start|stop|restart [flags]`

Gestionan **solo** la infraestructura. `infra down` y `infra stop` se niegan
mientras haya stacks corriendo; primero baja/stop los stacks o usa `--force`.

| Flag | Tipo / default | Contexto | Ejemplo |
|---|---|---|---|
| `--wait` (solo `up`) | `true` | Espera a `healthy`. | `soit infra up --wait=false` |
| `--wait-timeout duration` | `3m` | Timeout de salud. | `soit infra up --wait-timeout 5m` |
| `-V`, `--volumes` (solo `down`) | `false` | **Destructivo**: borra volúmenes nombrados. Requiere `--yes`. | `soit infra down --volumes --yes` |
| `--force` | `false` | Permite `down`/`stop` con stacks activos. | `soit infra down --force` |

```bash
soit infra up
soit infra ps
soit infra restart
soit infra down
soit infra down --force
```

### 6.3 `soit infra ps` / `health` / `logs` / `validate` / `pull` / `update` / `build` / `compose` / `backup`

**Sintaxis:** `soit infra ps|health|logs|validate|pull|update|build|compose|backup [flags]`

- `ps`: tabla `project|service|state|health|image` de la infraestructura.
- `health`: informe consolidado; con `--check` devuelve exit 3 si algo está enfermo.
- `logs`: logs de db, nginx y certbot.
- `validate`: `docker compose config --quiet` sin arrancar nada.
- `pull|update|build`: mantenimiento de imágenes de infra.
- `compose`: escape hatch a `docker compose` (flag parsing desactivado).
- `backup`: ZIP de archivos de infra (`.env` y certbot incluidos salvo `--no-secrets`).

```bash
soit infra ps
soit infra health --wait --check
soit infra logs --follow=false --tail 200
soit infra validate
soit infra update
soit infra compose ps
soit infra backup --no-secrets
```

### 6.4 `soit stack up`

**Sintaxis:** `soit stack up [stack...] [flags]`

Sube stacks en orden de arranque, con espera de salud. Por defecto **no**
toca la infraestructura: exige que `db` y `nginx` estén corriendo. Usa
`--with-infra` para arrancar infra primero (equivale a `soit infra up`)
o usa el alias agregado `soit up` para infra + todos los stacks.

| Flag | Tipo / default | Contexto | Ejemplo |
|---|---|---|---|
| `--only stringArray` (repetible) | `[]` | Limita a stacks concretos. Útil para subir solo el stack caro de inicializar. | `soit stack up --only odoo17c` / `--only odoo17c --only ydrsoluciones` |
| `--wait` (bool) | `true` | Espera a `healthy`. Poner `=false` para arranque rápido asíncrono. | `soit stack up --wait=false` |
| `--wait-timeout duration` | `3m` | Cuánto esperar a salud por proyecto. Subir en hosts lentos. | `soit stack up --wait-timeout 5m` |
| `--continue-on-error` | `false` | Sigue con el resto de stacks aunque uno falle (útil en multi-stack). | `soit stack up --continue-on-error` |
| `--with-infra` | `false` | Arranca la infraestructura primero. | `soit stack up --with-infra` |

```bash
soit stack up                              # todos los stacks (infra ya arriba)
soit stack up odoo17c                      # solo odoo17c
soit stack up --with-infra                 # infra + todos
soit stack up --only odoo17c --dry-run     # plan de un stack
```

### 6.5 `soit stack down`

**Sintaxis:** `soit stack down [stack...] [flags]`

Baja stacks en orden inverso. La infraestructura no se toca. Para bajar todo
(infra incluida) usa `soit down` o `soit infra down` (con stacks detenidos).

| Flag | Tipo / default | Contexto | Ejemplo |
|---|---|---|---|
| `--only stringArray` | `[]` | Solo esos stacks (sin tocar infra). | `soit stack down --only odoo17c` |
| `-V`, `--volumes` | `false` | **Destructivo**: borra volúmenes nombrados. Requiere `--yes` o falla como error de uso. | `soit stack down --volumes --yes` |
| `--continue-on-error` | `false` | Como en `up`. | `soit stack down --continue-on-error` |

```bash
soit stack down --dry-run
soit stack down odoo17c
soit stack down --volumes --yes
```

### 6.6 `soit stack start` / `stop` / `restart`

**Sintaxis:** `soit stack start|stop|restart [stack...] [flags]`

`start` = arranca contenedores detenidos (exige infra o `--with-infra`).
`stop` = detiene stacks en orden inverso, **sin** eliminar contenedores y sin
tocar infra. `restart` = `stop` + `start` (exige infra o `--with-infra`).

| Flag | Tipo / default | Contexto | Ejemplo |
|---|---|---|---|
| `--only stringArray` | `[]` | Filtra stacks como en `up`. | `soit stack restart --only ydrsoluciones` |
| `--with-infra` | `false` | Arranca/reinicia infra primero (solo `start`/`restart`). | `soit stack start --with-infra` |

```bash
soit stack start
soit stack stop odoo17c
soit stack stop --dry-run
soit stack restart --only odoo17c
```

### 6.7 `soit stack ps` (alias `status`) / `soit stack list`

**Sintaxis:** `soit stack ps [flags]` · `soit stack list [flags]`

- `ps`: tabla `project|service|state|health|image` de cada stack (sin infra; usa `soit infra ps`).
- `list`: stacks detectados con su `database` (de `odoo.conf::db_name`) y
  `compose file`.

**Contexto:** Solo lectura; combinables con `-o json` para scripts.

```bash
soit stack ps
soit stack ps -o json
soit stack list
```

### 6.8 `soit stack health`

**Sintaxis:** `soit stack health [flags]`

Informe consolidado de salud de los stacks. Con `--check` devuelve exit 3 si
algo está enfermo (para CI/cron). Usa `soit infra health` para la infraestructura.

| Flag | Tipo / default | Contexto | Ejemplo |
|---|---|---|---|
| `--wait` (bool) | `false` | Reintenta hasta que todo esté `healthy` (cada 5s hasta el timeout). | `soit stack health --wait` |
| `--wait-timeout duration` | `2m` | Plazo de `--wait`. | `soit stack health --wait --wait-timeout 5m` |
| `--check` | `false` | Exit 3 si hay servicios no sanos (excluye `starting` mientras espera). | `soit stack health --check` |

```bash
soit stack health --wait --check
soit stack health -o json
```

### 6.9 `soit stack logs [stack]`

**Sintaxis:** `soit stack logs [stack] [flags]`

- Sin argumento: logs de todos los stacks. Sin `-f`, secuenciales;
  con `-f` (default), concurrentes con `errgroup`.
- Con argumento: solo ese stack. Usa `soit infra logs` para la infraestructura.

| Flag | Tipo / default | Contexto | Ejemplo |
|---|---|---|---|
| `-f`, `--follow` (bool) | `true` | Seguir en vivo (`false` = volcar y salir). | `soit stack logs ydrsoluciones --follow=false` |
| `--tail int` | `100` | Líneas finales por servicio. | `soit stack logs odoo17c --tail 50` |
| `--since string` | `""` | Desde timestamp o duración (`24h`, `2026-11-01`) según `docker compose logs`. | `soit stack logs --since 24h` |

```bash
soit stack logs
soit stack logs ydrsoluciones -f --tail 200
soit stack logs odoo17c --follow=false --tail 20 --since 1h
```

### 6.10 `soit stack pull` / `build` / `update`

**Sintaxis:** `soit stack pull [stack...] [flags]` · `soit stack build [stack...] [flags]` ·
`soit stack update [stack...] [flags]`

- `pull`: `docker compose pull` de los stacks seleccionados.
- `build`: `docker compose build` (solo si el compose tiene `build:`).
- `update`: `pull` + recrea **solo** stacks cuya huella de imagen cambió
  (comparando IDs antes/después). Si nada cambió, no recrea.

| Flag | Tipo / default | Contexto | Ejemplo |
|---|---|---|---|
| `--only stringArray` | `[]` | Limita stacks. | `soit stack update --only odoo17c` |
| `--force` (solo `update`) | `false` | Recrea aunque la imagen no haya cambiado. | `soit stack update --force` |

```bash
soit stack pull
soit stack build --only odoo17c
soit stack update
soit stack update --only ydrsoluciones --force --dry-run
```

### 6.11 `soit stack exec <stack> <service> -- <command...>`

**Sintaxis:** `soit stack exec <stack> <service> -- <command...> [flags]`

Ejecuta un comando dentro del contenedor del servicio (pasa por
`docker compose exec` del stack).

| Flag | Tipo / default | Contexto | Ejemplo |
|---|---|---|---|
| `--no-tty` | `false` | Sin pseudo-TTY (necesario en CI o cuando no hay terminal). | `soit stack exec ydrsoluciones odoo --no-tty -- odoo shell -d ydr_prod` |
| `-u`, `--user string` | `""` | Usuario dentro del contenedor (nombre o `uid:gid`). | `soit stack exec ydrsoluciones odoo -u odoo -- bash` |
| `-w`, `--workdir string` | `""` | Directorio de trabajo dentro del contenedor. | `soit stack exec ydrsoluciones odoo -w /tmp -- ls` |
| `-e`, `--env stringArray` | `[]` | Variables `KEY=VALUE` (repetible). `--env` va antes de `--`. | `soit stack exec ydrsoluciones odoo -e LANG=es_ES.UTF-8 -- env` |

```bash
soit stack exec ydrsoluciones odoo -- odoo shell -d ydr_prod
soit stack exec ydrsoluciones odoo -- bash
soit stack exec odoo17c odoo --no-tty -- odoo --help
```

> El `--` separa flags de `soit` del comando interior. Sin `--`, cobra
> confundiría flags del comando con flags de `soit`.

### 6.12 `soit stack compose <stack> <args...>`

**Sintaxis:** `soit stack compose <stack> <docker compose args...>`
(flag parsing desactivado: todo pasa tal cual).

Escape hatch a `docker compose -f <stack> <args...>`. No tiene flags
propios; los flags son los de `docker compose`. Usa `soit infra compose`
para la infraestructura.

```bash
soit stack compose odoo17c ps
soit stack compose odoo17c restart odoo
```

### 6.13 `soit stack validate [stack...]`

**Sintaxis:** `soit stack validate [stack...] [flags]`

Valida el compose de cada stack seleccionado con
`docker compose config --quiet`. Solo lectura: no crea ni arranca contenedores.
Usa `soit infra validate` para `docker-compose.infra.yml`.

```bash
soit stack validate
soit stack validate odoo17c
soit stack validate --only odoo17c --only ydrsoluciones
soit stack validate -o json
```

### 6.14 `soit stack remove <stack>`

**Sintaxis:** `soit stack remove <stack> [flags]`

Elimina **un stack** (hace `down` solo de ese proyecto; no toca infra). Por
defecto conserva `stacks/<stack>/`, la BD, el vhost nginx y el certificado.

| Flag | Tipo / default | Contexto | Ejemplo |
|---|---|---|---|
| `-V`, `--volumes` | `false` | **Destructivo**: también borra volúmenes nombrados. Requiere `--yes`. | `soit stack remove odoo17c --volumes --yes` |
| `--files` | `false` | **Destructivo**: tras el `down`, borra el directorio `stacks/<stack>/` y lo quita de `stacks/.order`. Requiere `--yes`. | `soit stack remove odoo17c --files --yes` |

```bash
soit stack remove odoo17c
soit stack remove odoo17c --volumes --yes
soit --dry-run stack remove odoo17c --files --yes
```

> Para una baja completa de instancia, además: `soit service remove <domain>`
> y `soit db drop <db> --terminate --yes`.

### 6.15 `soit stack order [stack...]`

**Sintaxis:** `soit stack order [stack...] [flags]`

Define el **orden de arranque por defecto** en `stacks/.order` (un stack por
línea). `infra` siempre va primero; los stacks no listados se añaden en orden
alfabético al final. `down`/`stop` usan el orden inverso.

```bash
soit stack order                          # ver el orden efectivo
soit stack order odoo20c odoo18c odoo17c  # definir orden completo
soit stack order --first odoo20c          # odoo20c arranca primero
soit stack order --reset                  # volver al orden alfabético
soit stack order --pretty                 # un stack por línea
soit stack order -o json                  # para scripts
```

| Flag | Tipo / default | Contexto | Ejemplo |
|---|---|---|---|
| `--first string` | `""` | Mueve un stack al frente sin reescribir el resto. | `soit stack order --first odoo20c` |
| `--reset` | `false` | Borra `stacks/.order` y vuelve al orden alfabético. | `soit stack order --reset` |
| `--pretty` | `false` | Imprime un stack por línea (útil en tuberías). | `soit stack order --pretty` |

### 6.16 `soit stack backup [stack...]`

**Sintaxis:** `soit stack backup [stack...] [flags]`

Crea un ZIP con `docker-compose.yml`, `odoo.conf` y `addons/` de cada stack.
No incluye la base de datos ni el filestore; usa `soit db backup` para eso.
Con `--include-data` también incluye `data/` completo.

| Flag | Tipo / default | Contexto | Ejemplo |
|---|---|---|---|
| `--only stringArray` | `[]` | Limita stacks. | `soit stack backup --only odoo17c` |
| `--output-dir string` | `<root>/.soit/backups` | Directorio del ZIP. | `soit stack backup --output-dir /backups/soit` |
| `--include-data` | `false` | Incluye `data/` completo (puede ser grande). | `soit stack backup odoo17c --include-data` |

```bash
soit stack backup
soit stack backup odoo17c
soit stack backup --only odoo17c --only ydrsoluciones
```

---

## 7. `soit instance` — crear e inspeccionar instancias Odoo

### 7.1 `soit instance create <domain> --odoo-version <version>`

**Sintaxis:** `soit instance create <domain> --odoo-version <version> [flags]`

Converge: DNS → infra corriendo → stack (`compose`, `odoo.conf`,
`addons/`, `data/`) → BD → TLS/nginx → `--init=base` solo si la BD está
vacía → `up --wait` → timer de renovación → `/web/health`.

Pasos idempotentes: re-ejecutar con los mismos argumentos no duplica ni
reinicializa.

El `odoo.conf` generado incluye `http_interface = 0.0.0.0`, necesario para
que Odoo 20 en Docker acepte tráfico desde nginx. En stacks gestionados
antiguos, `instance create` añade la clave si falta; reinicia el stack para
aplicarla.

| Argumento / flag | Tipo / default | Requerido | Contexto | Ejemplo |
|---|---|---|---|---|
| `<domain>` | string posicional | ✅ | FQDN público; el stack se llama como su primera etiqueta. Debe resolver a este servidor (salvo `--skip-dns`). | `odoo18.example.com` |
| `--odoo-version string` | string, ej. `17.0` | ✅ | **Tag Docker `odoo:<ver>`** de esta instancia. Arg por instancia, **nunca** del `.env`. Decide el `image:` del compose del stack. | `--odoo-version 18.0` |
| `--email string` | `""` → `ACME_EMAIL` | — | Email Let's Encrypt. Útil para mezclar dominios con emails distintos en la misma infra. | `--email ops@example.com` |
| `--stack string` | `""` → 1ª etiqueta | — | Nombre del directorio `stacks/<name>` cuando quieres desacoplarlo del dominio. | `--stack odoo18` |
| `--db string` | `""` → nombre del stack | — | Nombre de la BD PostgreSQL cuando difiere del stack. | `--db ydr_prod` |
| `--skip-dns` | bool `false` | — | No verifica que el DNS apunte aquí. Para staging/local o si el DNS se propaga aún. Peligroso en prod (el TLS fallará). | `--skip-dns` |
| `--allow-dns-mismatch` | `false` | — | Avisa en vez de fallar si el DNS no coincide. Útil con CDN/proxy delante. | `--allow-dns-mismatch` |
| `--skip-tls` | `false` | — | Crea stack+BD sin nginx TLS ni certificado (esquema `http`). Para entornos sin TLS. | `--skip-tls` |
| `--skip-challenge` | `false` | — | No comprueba el reto HTTP-01 `:80` antes de pedir el cert. Para ahorrar tiempo cuando ya sabes que pasa. | `--skip-challenge` |
| `--skip-init` | `false` | — | No corre `odoo -d … --init=base` aunque la BD esté vacía. Usar si vas a restaurar un dump encima. | `--skip-init` |
| `--no-timer` | `false` | — | No instala el cron `/etc/cron.d/soit-cert-reload` que recarga nginx tras renovar. | `--no-timer` |
| `--timer-every int` | `15` | — | Minutos de chequeo del timer (solo si no se usa `--no-timer`). | `--timer-every 30` |
| `--admin-passwd string` | `""` → `$SOIT_ODOO_ADMIN_PASSWD` o generado | — | `admin_passwd` de `odoo.conf`. Si se genera, queda en `.soit/secrets/<stack>.admin_passwd` (0600). | `--admin-passwd 'Secreta123!'` |
| `--workers int` | `4` | — | Workers Odoo en `odoo.conf`. Subir si el host tiene CPU/RAM. | `--workers 8` |
| `--wait-timeout duration` | `3m` | — | Cuánto esperar a que el stack quede healthy tras `docker compose up --wait`. Subir en hosts lentos. | `--wait-timeout 5m` |

**Ejemplos (con contexto):**

```bash
# Producción típica
soit instance create odoo18.example.com --odoo-version 18.0

# Ver qué haría sin tocar nada
soit instance create odoo18.example.com --odoo-version 18.0 --dry-run

# Staging privado sin DNS/TLS (solo stack+BD)
soit instance create odoo18.internal --odoo-version 18.0 --skip-dns --skip-tls

# Nombres desacoplados: stack odoo18 con BD ydr_prod y 8 workers
soit instance create odoo18.example.com --odoo-version 18.0 --stack odoo18 --db ydr_prod --workers 8

# Con password de admin explícito y email distinto
soit instance create odoo17c.example.com --odoo-version 17.0 --email ops@example.com --admin-passwd 'Secreta123!'

# Vas a restaurar un dump: no inicializar base en BD vacía
soit instance create demo.example.com --odoo-version 17.0 --skip-init --skip-dns --skip-tls
```

> Si falta `--odoo-version`, el comando falla con:
> `--odoo-version is required (e.g. --odoo-version 17.0); …`.

**Diagnóstico de `--init=base`:** soit ejecuta la inicialización con
`--logfile=/dev/stderr` para que la excepción real de Odoo se vea en la
terminal y quede en el resumen del error. Si aparece
`Warn: Can't find .pfb for face 'Courier'`, es un aviso de ReportLab
(fuentes PDF), no la causa: soit lo ignora al elegir el error y añade
sugerencias como `soit stack logs <stack>`, el reintento manual con
`--logfile=/dev/stderr` o el flujo `--skip-init` + `soit db restore`.

Si Odoo falla con `PermissionError: Permission denied:
'/var/lib/odoo/filestore'`, la causa es que el `data/` del host no es
escribible por el usuario del contenedor Odoo (normalmente UID/GID `101`).
SOIT crea `data/filestore`, `data/sessions` y `data/addons` y, ejecutándose
como root, hace `chown` de `data/` al UID/GID detectado de la imagen
(`101:101` por defecto). Para un stack existente fallido, corrige a mano:

```bash
sudo chown -R 101:101 /opt/odoo-infra/stacks/odoo18c/data
soit instance create odoo18c.ydrsoluciones.com --odoo-version 18.0
```

Los `odoo.conf` nuevos usan `logfile = /dev/stdout` para que
`soit stack logs` muestre los logs de Odoo. Los stacks gestionados antiguos
migran ese valor automáticamente la próxima vez que se ejecuta
`soit instance create`.

### 7.2 `soit instance status [stack]` / `soit instance list`

**Sintaxis:** `soit instance status [stack] [flags]` · `soit instance list [flags]`

- `status`: sin argumento muestra **todos**; con `<stack>` solo ese.
  Columnas: stack, domain, **odoo** (inferida del `image:` del compose),
  database, tables, cert (días), health.
- `list`: igual que `status` sin argumento, resumido.

**Contexto:** Diagnóstico antes de operar (¿qué versión corre cada stack?
¿cuántas tablas tiene la BD?). JSON con `-o json`.

```bash
soit instance status
soit instance status odoo17c
soit instance list -o json
```

---

## 8. `soit cert` — certificados y timer

> El contenedor certbot no tiene socket Docker: no puede recargar nginx.
> Por eso `soit` instala un **timer del host** que llama a
> `soit cert reload-if-changed`.

### 8.1 `soit cert list` / `soit cert status`

**Sintaxis:** `soit cert list [flags]` · `soit cert status [flags]`

- `list`: tabla `name|domains|days|expires|issuer` de `certbot/conf/live/`.
- `status`: idéntico + opción de fallo.

| Flag (`status`) | Tipo / default | Contexto | Ejemplo |
|---|---|---|---|
| `--check` | bool `false` | Exit 3 si algún cert vence en ≤30 días. Para cron/CI con alertas. | `soit cert status --check` |

```bash
soit cert list
soit cert status --check
soit certs          # alias oculto de `cert list`
```

### 8.2 `soit cert issue <domain>`

**Sintaxis:** `soit cert issue <domain> [flags]`

Pide el cert **solo si** falta, está expirado o no cubre el dominio
(SAN compartido válido = no-op). Con `--bootstrap` escribe primero un
vhost HTTP temporal (obligatorio si el dominio aún no tiene sitio).

| Flag | Tipo / default | Contexto | Ejemplo |
|---|---|---|---|
| `--email string` | `""` → `ACME_EMAIL` | Email ACME. | `--email ops@example.com` |
| `--cert-name string` | `""` → dominio | Nombre en `live/<name>` cuando quieres agrupar SANs. | `--cert-name odoo18.example.com` |
| `--staging` | `false` | Servidor staging de Let's Encrypt (sin *rate limit*, certs no confiables). Para probar el flujo. | `--staging --bootstrap` |
| `--skip-challenge` | `false` | Omite la sonda HTTP-01 en `:80`. | `--skip-challenge` |
| `--bootstrap` | `false` | Escribe vhost `:80` temporal si el sitio no existe. Necesario en dominios nuevos. | `--bootstrap` |
| `--no-reload` | `false` | No recarga nginx tras emitir (útil si vas a recargar después una sola vez). | `--no-reload` |

```bash
soit cert issue odoo18.example.com --bootstrap
soit cert issue odoo18.example.com --staging --bootstrap
soit cert issue odoo18.example.com --cert-name odoo18.example.com
```

### 8.3 `soit cert renew [domain]`

**Sintaxis:** `soit cert renew [domain] [flags]`

- Sin dominio: renueva los que toquen.
- Con dominio: renueva ese cert (preserva SANs compartidos).

| Flag | Tipo / default | Contexto | Ejemplo |
|---|---|---|---|
| `--simulate` | `false` | Ejecuta el `--dry-run` **de certbot** (valida sin gastar *rate limit*). Distinto del global `--dry-run` (no ejecuta nada). | `soit cert renew --simulate` |
| `--no-reload` | `false` | No recarga nginx tras renovar. | `soit cert renew odoo18.example.com --no-reload` |

```bash
soit cert renew
soit cert renew odoo18.example.com
soit cert renew --simulate
soit --dry-run cert renew          # plan global: no toca certbot ni nginx
```

### 8.4 `soit cert reload` / `reload-if-changed`

**Sintaxis:** `soit cert reload [flags]` ·
`soit cert reload-if-changed [flags]`

- `reload`: recarga nginx ya (`nginx -s reload` con fallback
  `docker kill -s HUP`).
- `reload-if-changed`: compara mtimes con
  `.soit/cert-reload.json` y recarga **solo si** hubo renovación real.
  Es lo que invoca el cron; úsalo también a mano tras renovar a mano.

```bash
soit cert reload
soit cert reload-if-changed
soit cert reload-if-changed -q -v   # silencioso salvo cambio
```

### 8.5 `soit cert install-timer` / `uninstall-timer`

**Sintaxis:** `soit cert install-timer [flags]` ·
`soit cert uninstall-timer [flags]`

Instala/quita `/etc/cron.d/soit-cert-reload`. Requiere root, salvo
`--print-cron` o `--dry-run`.

| Flag (`install-timer`) | Tipo / default | Contexto | Ejemplo |
|---|---|---|---|
| `--every-minutes int` | `15` | Frecuencia de chequeo del timer. | `--every-minutes 10` |
| `--print-cron` | `false` | Imprime el cron en vez de escribirlo (sin root). | `soit cert install-timer --print-cron` |

```bash
sudo soit cert install-timer
sudo soit cert install-timer --every-minutes 10
soit cert install-timer --print-cron        # inspeccionar sin root
sudo soit cert uninstall-timer
```

---

## 9. `soit service` — exponer backends no-Odoo con TLS

### 9.1 `soit service list`

**Sintaxis:** `soit service list [flags]`

Lista sitios de `nginx/conf.d/` (incluye `.disabled`) con
`domain|backend|certificate|enabled|owner` (`soit` = gestionado, `user` = otro).
Solo lectura.

```bash
soit service list
soit service list -o json
```

### 9.2 `soit service expose <domain>`

**Sintaxis:** `soit service expose <domain> [flags]`

Crea/converge el vhost TLS genérico. El `--backend` se usa **tal cual**
(`host:port`), sin añadir prefijo `odoo-`. Idempotente; reutiliza certs que
ya cubren el dominio.

| Flag | Tipo / default | Requerido | Contexto | Ejemplo |
|---|---|---|---|---|
| `--backend string` | `host:port` | ✅ | Backend en la red `shared` (nombre de servicio + puerto). | `--backend pgadmin:80` |
| `--websocket string` | `""` | — | Backend WS (`/websocket`, `/longpolling`). Para Odoo: `8069` (HTTP) + `8072` (WS). | `--websocket odoo-odoo18:8072` |
| `--email string` | `""` → `ACME_EMAIL` | — | Email ACME. | `--email ops@example.com` |
| `--cert-name string` | `""` → dominio | — | Nombre del cert en `live/`. | `--cert-name odoo18.example.com` |
| `--shared-cert string` | `""` | — | Reutiliza un cert existente en vez de pedir uno nuevo (SAN compartido). | `--shared-cert wildcard.example.com` |
| `--auth-basic` | `false` | — | Protege con HTTP basic auth (`.htpasswd` en `conf.d`, que sí está montado). | `--auth-basic` |
| `--auth-user string` | `admin` | — | Usuario basic-auth. | `--auth-user ops` |
| `--auth-password string` | `""` → `$SOIT_AUTH_PASSWORD` o generado | — | Password basic-auth. Si se genera, se imprime **una sola vez** al crear. | `--auth-password 'Infra2026!'` |
| `--skip-dns` | `false` | — | Omite verificación DNS. | `--skip-dns` |
| `--allow-dns-mismatch` | `false` | — | Avisa en vez de fallar ante DNS ≠ IP del host. | `--allow-dns-mismatch` |
| `--skip-challenge` | `false` | — | Omite sonda HTTP-01. | `--skip-challenge` |

```bash
soit service expose pgadmin.example.com --backend pgadmin:80 --auth-basic
soit service expose portainer.example.com --backend portainer:9000
soit service expose odoo18.example.com --backend odoo-odoo18:8069 --websocket odoo-odoo18:8072
soit service expose pgadmin.example.com --backend pgadmin:80 --auth-basic --auth-user ops --auth-password 'Infra2026!'
soit service expose app.example.com --backend app:8000 --skip-dns --skip-challenge
```

### 9.3 `soit service disable|enable|remove <domain>`

**Sintaxis:** `soit service disable <domain> [flags]` (y `enable`/`remove`)

- `disable`: mueve a `conf.d/.disabled/` y recarga nginx.
- `enable`: restaura desde `.disabled/` y recarga nginx.
- `remove`: elimina el sitio activo (el certificado **se conserva**).

**Contexto:** `disable`/`enable` sirven para mantenimiento sin borrar
config; `remove` es baja definitiva (el cert queda para reutilizar).

```bash
soit service disable pgadmin.example.com
soit service enable pgadmin.example.com
soit service remove pgadmin.example.com
soit service list       # verificar estado
```

---

## 10. `soit db` — PostgreSQL

### 10.1 `soit db list` / `create <name>`

**Sintaxis:** `soit db list [flags]` · `soit db create <name> [flags]`

- `list`: nombres de BD en el contenedor `db`.
- `create`: crea solo si no existe (`CREATE DATABASE … TEMPLATE template0
  ENCODING UTF8`); si existe, no-op con aviso.

```bash
soit db list
soit db create demo_db
soit db create demo_db --dry-run
```

### 10.2 `soit db drop <name>`

**Sintaxis:** `soit db drop <name> [flags]`

**Destructivo**: requiere `--yes` (global) salvo `--dry-run`.

| Flag | Tipo / default | Contexto | Ejemplo |
|---|---|---|---|
| `--terminate` | `false` | `DROP … WITH (FORCE)`: corta conexiones activas. Sin esto, una BD en uso falla. | `soit db drop demo_db --terminate --yes` |

```bash
soit db drop demo_db --yes
soit db drop demo_db --terminate --yes
soit db drop demo_db --dry-run
```

### 10.3 `soit db backup <db>`

**Sintaxis:** `soit db backup <db> [flags]`

Crea un ZIP Odoo (dump + filestore) con `pg_dump` dentro del contenedor `db`.
El dump se transmite por stdout (la contraseña nunca va en `argv`). El ZIP
incluye `dump.sql` (o `dump.dump` con `--format custom`), `filestore/<db>/`
y `META-INF/soit.json`. Se escribe en `<root>/dbs/<db>-<timestamp>.zip`
(0600) con un sidecar `.zip.sha256`.

| Flag | Tipo / default | Contexto | Ejemplo |
|---|---|---|---|
| `--stack string` | inferido de `odoo.conf` | Stack dueño del filestore. | `soit db backup ydr_prod --stack ydrsoluciones` |
| `--output string` | `<root>/dbs/<db>-<timestamp>.zip` | Ruta exacta del ZIP. | `soit db backup demo --output dbs/demo.zip` |
| `--format odoo\|custom` | `odoo` | `odoo` = plain SQL; `custom` = `pg_dump -Fc`. | `soit db backup demo --format custom` |
| `--no-filestore` | `false` | Solo base de datos. | `soit db backup demo --no-filestore` |

```bash
soit db backup ydr_prod --stack ydrsoluciones
soit db backup demo --no-filestore
soit db backup demo --format custom --output dbs/demo.zip
```

### 10.4 `soit db restore <backup.zip>`

**Sintaxis:** `soit db restore <backup.zip> [flags]`

Restaura ZIP Odoo (dump + filestore): extrae a
`.soit/tmp/restore-*`, detecta `.sql`/`.dump`/`.backup`/`PGDMP`, lo hace
*streaming* a `psql`/`pg_restore` dentro de `db` (password nunca en argv),
verifica ≥10 tablas, sincroniza filestore, converge `db_name`,
reinicia `odoo` solo si cambió `odoo.conf` y verifica `/web/health`.

| Flag | Tipo / default | Requerido | Contexto | Ejemplo |
|---|---|---|---|---|
| `--db string` | — | ✅ | BD destino. | `--db ydr_prod` |
| `--stack string` | `ydrsoluciones` | — | Stack (`stacks/<name>`) que usará la BD; define `odoo.conf` y el filestore destino. | `--stack ydrsoluciones` |
| `--odoo-version string` | `""` → inferida del compose del stack | — | Tag `odoo:<ver>` solo para detectar `uid/gid` del filestore. Si se omite, se lee del `image:` del stack destino. | `--odoo-version 17.0` |
| `--on-exists fail\|skip\|replace` | `fail` | — | Si la BD existe: `fail` (aborta), `skip` (no-op), `replace` (DROP+recrea). `replace` exige `--yes`. | `--on-exists=replace --yes` |
| `--filestore auto\|skip` | `auto` | — | `auto` = sincroniza filestore si el ZIP trae uno; `skip` = solo dump. | `--filestore=skip` |
| `--prune-filestore` | `false` | — | Borra destino que no esté en el backup (sincrónico estricto). Peligroso si el backup es parcial. | `--prune-filestore` |
| `--uid int` / `--gid int` | `0` (= detectar) | — | Dueño del filestore destino. `0` = detectar del imagen Odoo (`odoo:<ver>` → `id -u odoo`), fallback `101:101`. | `--uid 101 --gid 101` |
| `--no-chown` | `false` | — | No toca propiedad del filestore (útil si el host ya tiene `uid/gid` correcto o no tienes root). | `--no-chown` |

```bash
# Flujo estándar: restaurar sobre nombre nuevo, stack existente
soit db restore dbs/odoo17_ydr_prod.zip --db ydr_prod --stack ydrsoluciones

# Reponer BD existente (destructivo → --yes)
soit db restore dbs/backup.zip --db ydr_prod --on-exists=replace --yes

# Solo dump, sin filestore y sin chown (CI/staging)
soit db restore dbs/backup.zip --db test --filestore=skip --no-chown

# Forzar versión para ownership cuando el stack aún no tiene compose
soit db restore dbs/backup.zip --db ydr_prod --stack ydrsoluciones --odoo-version 17.0
```

---

## 11. Miscelánea

### 11.1 `soit backup`

**Sintaxis:** `soit backup [flags]`

Crea un solo ZIP con la infraestructura y todos los stacks (solo
configuración). Incluye `.env` y certbot salvo `--no-secrets`.

```bash
soit backup
soit backup --no-secrets
soit backup --output-dir /backups/soit
```

### 11.2 `soit install`

**Sintaxis:** `soit install [--dir <dir>]`

Copia el binario en ejecución a un directorio del `PATH`. No descarga nada,
no usa la red y no invoca `sudo`. Es idempotente: si el destino ya tiene los
mismos bytes, no escribe.

Destino por defecto:

| Usuario | Destino |
|---|---|
| root | `/usr/local/bin` si es escribible; si no, `~/.local/bin`. |
| no-root | `~/.local/bin` o `~/bin` si ya está en `PATH`; si no, `~/.local/bin`. |

| Flag | Tipo / default | Contexto | Ejemplo |
|---|---|---|---|
| `--dir string` | `""` (auto) | Directorio destino. Se crea si falta. | `soit install --dir ~/.local/bin` |
| `--force` (global) | `false` | Reemplaza un destino que es un symlink. | `soit install --force --dir /usr/local/bin` |
| `--dry-run` (global) | `false` | Muestra el plan sin escribir. | `soit --dry-run install` |

```bash
./bin/soit install
soit install --dir ~/.local/bin
sudo soit install --dir /usr/local/bin
```

Si el directorio no está en `PATH`, el comando imprime la línea exacta
`export PATH=...` para añadir a `~/.zshrc` o `~/.bashrc`.

### 11.3 `soit upgrade` (alias `self-update`)

**Sintaxis:** `soit upgrade [flags]`

Actualiza **el binario** desde GitHub Releases. No es lo mismo que
`soit update`: este último actualiza imágenes Docker de infra y stacks.
`soit infra update` y `soit stack update` siguen siendo los actualizadores
de imágenes por ámbito.

Por defecto usa la última release **estable**. El asset se elige por
`runtime.GOOS`/`GOARCH` (`soit_<version>_<os>_<arch>.tar.gz`), se verifica
obligatoriamente contra `checksums.txt` y se reemplaza el binario con un
rename atómico en el mismo directorio. Si el binario es un symlink, se
reemplaza el destino y se conserva el enlace.

| Flag | Tipo / default | Contexto | Ejemplo |
|---|---|---|---|
| `--check` | `false` | No descarga: informa si hay actualización y sale con código 3 si la hay. | `soit upgrade --check` |
| `--version string` | `""` (última) | Fija una release concreta; acepta `0.1.0` o `v0.1.0`. | `soit upgrade --version v0.1.0` |
| `--prerelease` | `false` | Incluye release candidates al resolver la última release. | `soit upgrade --prerelease` |
| `--target string` | `""` (binario en ejecución) | Reemplaza otra ruta (avanzado; útil en tests o instalaciones side-by-side). | `soit upgrade --target ./bin/soit` |
| `--force` (global) | `false` | Reinstala aunque la versión sea la misma. | `soit --force upgrade` |
| `--dry-run` (global) | `false` | Muestra versión y asset sin descargar ni escribir. | `soit upgrade --dry-run` |

```bash
soit upgrade --check
soit upgrade
soit upgrade --prerelease
soit upgrade --version v0.1.0
sudo soit upgrade              # binario en /usr/local/bin
```

Variables de ambiente:

| Variable | Efecto |
|---|---|
| `GITHUB_TOKEN` / `SOIT_GITHUB_TOKEN` | Sube el rate limit de la API de GitHub o permite un fork privado. |
| `SOIT_UPDATE_REPO` | Repositorio alternativo en formato `owner/name` (default `mjavint/soit`). |
| `SOIT_UPDATE_API_URL` | Base URL alternativa de la API (GitHub Enterprise o tests). |

No se ejecuta código descargado ni un instalador tipo `curl | sh`. Si la
release no publica `checksums.txt`, o el SHA-256 no coincide, la actualización
se aborta. Si el directorio no es escribible, el error sugiere `sudo soit upgrade`.

### 11.4 `soit version`

**Sintaxis:** `soit version [flags]` (sin preparación de infra:
funciona aunque falte `.env`).

```bash
soit version
soit version -o json      # {version, commit, built, go, platform}
soit --version            # equivalente corto (root)
```

### 11.5 `soit completion <shell>`

Comando de cobra para autocompletado. Shells: `bash`, `zsh`, `fish`,
`powershell`.

```bash
soit completion bash > /etc/bash_completion.d/soit
soit completion zsh > "${fpath[1]}/_soit"
soit completion fish > ~/.config/fish/completions/soit.fish
soit completion powershell > $PROFILE
```

### 11.6 `soit help [command]`

```bash
soit help
soit help stack up
soit help infra up
soit help backup
```

---

## 12. Flujos completos (ejemplos con contexto)

### A. Nueva infra desde cero

```bash
# 1. (Opcional) crea el árbol con soit infra init ./odoo-infra
# 2. Edita odoo-infra/.env (PROJECT_NAME, POSTGRES_USER, POSTGRES_PASSWORD, PG_VERSION, ACME_EMAIL)
# 3. Diagnóstico y validación
soit doctor
soit config validate

# 4. Levanta infra
soit infra up

# 5. Crea la primera instancia Odoo 18
soit instance create odoo18.example.com --odoo-version 18.0

# 6. Verifica
soit instance list
soit stack health --wait --check
curl -I https://odoo18.example.com
```

### B. Segunda instancia con otra versión en la misma infra

```bash
soit instance create odoo17c.example.com --odoo-version 17.0 --dry-run
soit instance create odoo17c.example.com --odoo-version 17.0
soit instance list      # odoo18 18.0 / odoo17c 17.0 conviven
```

### C. Actualizar imágenes

```bash
soit stack pull
soit stack update --only odoo18           # recrea solo si la imagen cambió
soit stack health --wait --check
```

### D. Exponer pgadmin tras nginx (en vez de `:5050` público)

```bash
soit service expose pgadmin.example.com --backend pgadmin:80 --auth-basic --auth-user admin
soit service list
```

### E. Restaurar un backup Odoo

```bash
soit instance create demo.example.com --odoo-version 17.0 --skip-init --skip-dns --skip-tls --stack demo --db demo
soit db restore dbs/demo.zip --db demo --stack demo
```

### F. Renovación y timer

```bash
soit cert status --check
soit cert renew --simulate   # valida sin quemar rate limit
soit cert renew              # renueva lo que toque + recarga nginx
sudo soit cert install-timer
soit cert reload-if-changed -q
```

### G. Instalar y actualizar el binario

```bash
# Instalación local desde el binario compilado (sin red)
make build
./bin/soit install
./bin/soit install --dir ~/.local/bin

# Actualización del binario desde GitHub Releases
soit upgrade --check         # exit 3 si hay una versión más nueva
soit upgrade                 # descarga, verifica SHA-256 y reemplaza
sudo soit upgrade            # si está en /usr/local/bin

# Las imágenes Docker se actualizan con otro comando:
soit update                  # infra + stacks (agregado)
```

---

## 13. Códigos de salida

| Código | Significado |
|---|---|
| `0` | Éxito (incluye “nada que hacer”). |
| `1` | Error (Docker, BD, certificados, archivos…). |
| `2` | Error de uso (flag desconocido, falta `--odoo-version`/`--backend`/`--db`, falta `--yes`, `--on-exists` inválido…). |
| `3` | Deriva detectada: `doctor --strict` con avisos, o `--check` (`stack health`, `cert status`, `upgrade --check`) con servicios/certs no sanos o una actualización disponible. |

---

## 14. Aliases y nombres alternativos

| Alias | Equivalente |
|---|---|
| `stacks` | `stack` |
| `infrastructure` | `infra` |
| `certs` (grupo) | `cert` |
| `database` | `db` |
| `ps` (raíz) | `soit ps` agregado (infra + stacks) |
| `status` (raíz) | `soit ps` agregado |
| `up` / `down` / `start` / `stop` / `restart` | agregado infra + stacks |
| `health` / `logs` / `pull` / `update` / `build` | agregado infra + stacks |
| `list` / `ls` / `exec` | `stack list` / `stack exec` |
| `certs` (raíz) | `cert list` |
| `self-update` | `upgrade` (solo el binario) |

```bash
soit up                     # infra + stacks (agregado)
soit health --check         # infra + stacks (agregado)
soit ps                     # infra + stacks (agregado)
soit certs                  # ≡ soit cert list
soit self-update --check    # ≡ soit upgrade --check
```

---

## 15. Lista rápida de flags (chuleta)

```bash
# Globales (en todo comando)
soit [cmd] --root <dir> --env-file <file> --public-ip <ip> \
     --dry-run -y/--yes --force --no-color -v/--verbose -q/--quiet \
     --log-format text|json -o/--output table|json|plain \
     --timeout 3m --lock-timeout 60s

# Infra
soit infra init [dir] --project-name <p> --postgres-user <u> --pg-version 16 --acme-email <e> [--with-pgadmin]
soit infra up|down|start|stop|restart [--wait --wait-timeout 2m] [--volumes --yes] [--force]
soit infra ps|health --check|logs --follow --tail 100 --since 24h
soit infra pull|update|build [--force]
soit infra compose <docker compose args>
soit infra backup [--no-secrets] --output-dir <dir>

# Stack
soit stack up|down|start|stop|restart|pull|build|update [stack...] --only <stack> [--with-infra] [--continue-on-error]
soit stack down -V/--volumes --yes
soit stack update --force
soit stack health --wait --wait-timeout 2m --check
soit stack logs [stack] -f/--follow --tail 100 --since 24h
soit stack exec <stack> <svc> --no-tty -u <user> -w <dir> -e KEY=VAL -- <cmd>
soit stack compose <stack> <docker compose args>
soit stack backup [stack...] --only <stack> --output-dir <dir> [--include-data]

# Backup común
soit backup [--no-secrets] --output-dir <dir>

# Instalación y actualización del binario
soit install [--dir <dir>] [--force] [--dry-run]
soit upgrade [--check] [--dry-run] [--prerelease] [--version <tag>] [--target <path>] [--force]
soit self-update              # alias de upgrade

# Instancia
soit instance create <domain> --odoo-version 17.0 \
  --email <e> --stack <n> --db <bd> --skip-dns --allow-dns-mismatch \
  --skip-tls --skip-challenge --skip-init --no-timer --timer-every 15 \
  --admin-passwd <pw> --workers 4 --wait-timeout 3m

# Cert
soit cert status --check
soit cert issue <domain> --email <e> --cert-name <n> --staging \
  --bootstrap --skip-challenge --no-reload
soit cert renew [domain] --simulate --no-reload
soit cert install-timer --every-minutes 15 --print-cron

# Servicio
soit service expose <domain> --backend <h:p> [--websocket <h:p>] \
  --email <e> --cert-name <n> --shared-cert <n> \
  --auth-basic --auth-user admin --auth-password <pw> \
  --skip-dns --allow-dns-mismatch --skip-challenge

# BD
soit db create <name> | soit db drop <name> [--terminate] [--yes]
soit db restore <zip> --db <bd> --stack <s> --odoo-version <v> \
  --on-exists fail|skip|replace --filestore auto|skip \
  --prune-filestore --uid 101 --gid 101 --no-chown
```
