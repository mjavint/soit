# Configuración

SOIT usa tres capas de configuración y una regla simple de precedencia:

```text
flags de línea de comandos  >  variables de ambiente  >  .env  >  defaults
```

El `.env` se lee sin ejecutar shell: solo se aceptan líneas `CLAVE=valor`,
comentarios `#` y valores entre comillas simples o dobles. Las claves
desconocidas se muestran en `soit config show` pero no se usan.

## Configuración mínima paso a paso

### 1. Crea la raíz

```bash
soit infra init ./odoo-infra
cd ./odoo-infra
```

### 2. Edita `.env`

Como mínimo, define `POSTGRES_PASSWORD` y `ACME_EMAIL`:

```dotenv
POSTGRES_PASSWORD=una-contraseña-larga
ACME_EMAIL=ops@example.com
```

### 3. Valida

```bash
soit config validate
soit doctor
```

### 4. Revisa la configuración efectiva

```bash
soit config show
soit config show -o json
```

`config show` redacta secretos y muestra de dónde sale cada valor. Si un flag
y una variable de ambiente discrepan, gana el flag.

## Claves del `.env`

| Clave | Default | Obligatoria | Uso |
| --- | --- | --- | --- |
| `PROJECT_NAME` | `odoo-infra` | No | Nombre del proyecto Compose; define la red `<name>_shared`. |
| `POSTGRES_USER` | `odoo` | No | Usuario PostgreSQL de infra y stacks. |
| `POSTGRES_PASSWORD` | *(vacío)* | **Sí** | Contraseña PostgreSQL. Nunca se imprime. |
| `PG_VERSION` | `16` | No | Tag de `postgres:<ver>-alpine` en la infra. |
| `ACME_EMAIL` | `""` | No | Email de Let's Encrypt por defecto. |
| `EMAIL` | `""` | No | Alias legacy de `ACME_EMAIL`; se usa si `ACME_EMAIL` está vacío. |

Ejemplo mínimo:

```dotenv
PROJECT_NAME=odoo-infra
POSTGRES_USER=odoo
POSTGRES_PASSWORD=una-contraseña-larga
PG_VERSION=16
ACME_EMAIL=ops@example.com
```

> **La versión de Odoo no se configura en `.env`.** Es un argumento por
> instancia: `soit instance create <dominio> --odoo-version 18.0`. El valor
> termina en el `image: odoo:<ver>` de `stacks/<stack>/docker-compose.yml`.

## Variables de ambiente

Se leen aunque no exista `.env`, lo que permite CI sin secretos en disco.

| Variable | Equivale a | Efecto |
| --- | --- | --- |
| `SOIT_ROOT` | `--root` | Raíz de infraestructura. |
| `SOIT_PUBLIC_IP` | `--public-ip` | IP esperada en los chequeos DNS. |
| `SOIT_ODOO_ADMIN_PASSWD` | `--admin-passwd` | `admin_passwd` de `instance create`. |
| `SOIT_AUTH_PASSWORD` | `--auth-password` | Password de basic-auth de `service expose`. |
| `GITHUB_TOKEN` / `SOIT_GITHUB_TOKEN` | — | Rate limit de la API de GitHub para `soit upgrade`. |
| `SOIT_UPDATE_REPO` | — | Repositorio alternativo `owner/name` para `soit upgrade`. |
| `SOIT_UPDATE_API_URL` | — | API alternativa de GitHub (Enterprise o tests). |

```bash
SOIT_ROOT=/srv/odoo-infra SOIT_PUBLIC_IP=203.0.113.10 soit doctor
GITHUB_TOKEN=ghp_... soit upgrade --check
```

## Flags globales

Están disponibles en todos los comandos y pueden ir antes o después del
subcomando:

```bash
soit --dry-run stack up
soit infra up --dry-run
```

| Flag | Default | Uso |
| --- | --- | --- |
| `--root string` | auto | Raíz de infraestructura. |
| `--env-file string` | `<root>/.env` | `.env` alternativo; las rutas relativas se resuelven contra la raíz. |
| `--public-ip string` | `$SOIT_PUBLIC_IP` | IP que debe devolver el DNS. Si se omite, se detecta automáticamente. |
| `--dry-run` | `false` | Planifica sin mutar; las lecturas sí se ejecutan. |
| `-y`, `--yes` | `false` | Confirma operaciones destructivas. |
| `--force` | `false` | Sobrescribe archivos no gestionados y fuerza reemisión de certificados. |
| `--no-color` | `false` | Sin colores (CI, pipes, logs). |
| `-v`, `--verbose` | `false` | Diagnóstico adicional. |
| `-q`, `--quiet` | `false` | Solo errores. |
| `--log-format text\|json` | `text` | Formato de los mensajes de diagnóstico. |
| `-o`, `--output table\|json\|plain` | `table` | Formato del resultado principal. |
| `--timeout duration` | `0` | Timeout global; `0` significa sin límite. |
| `--lock-timeout duration` | `15s` | Espera para adquirir `.soit/soit.lock`. |
| `-h`, `--help` | — | Ayuda del comando. |
| `--version` | — | Solo en el root: versión, commit y fecha. |

### `--dry-run` no es `--simulate`

- `--dry-run` es global: imprime `+ comando` en vez de ejecutar mutaciones,
  pero ejecuta lecturas (`docker compose ps`, `SELECT`, `nginx -t`) para que el
  plan refleje la realidad.
- `soit cert renew --simulate` ejecuta el `--dry-run` propio de certbot. No
  consume rate limits y no sustituye al `--dry-run` global.

### Los dos `--force`

- `--force` global: sobrescribe archivos que no llevan el marcador
  `# managed-by: soit` y fuerza la reemisión de certificados.
- `soit stack update --force`: fuerza la recreación aunque la imagen no haya
  cambiado. Es local de ese comando.

## Salida: tablas, JSON y logs

La salida principal va a **stdout**; los diagnósticos y el progreso van a
**stderr**. Esto permite usar `-o json` en tuberías sin contaminar el JSON.

```bash
soit instance list -o json | jq '.[].stack'
soit doctor -o json > doctor.json
soit config show -o json | jq '.project_name'
```

- `-o table` (default): tablas legibles.
- `-o json`: objetos/arrays para automatización.
- `-o plain`: solo para `version` y `completion`.
- `--log-format json`: los mensajes de diagnóstico se emiten como JSON en
  stderr; no cambia el formato del resultado principal.
- `-q`: oculta el progreso; los errores siguen saliendo por stderr.
- `-v`: añade detalle, por ejemplo intentos de `/web/health`.

Ejemplo de automatización:

```bash
if ! soit --timeout 5m stack health --wait --check -q; then
  soit infra ps
  exit 1
fi
```

## Códigos de salida

| Código | Significado |
| --- | --- |
| `0` | Éxito, incluido “nada que hacer”. |
| `1` | Error de ejecución. |
| `2` | Error de uso: argumento faltante, flag inválido, conflicto. |
| `3` | Deriva detectada: `--check` o `doctor --strict` con avisos. |

Los errores de uso (código 2) se detectan antes de tocar el sistema: por
ejemplo, `instance create` exige exactamente un dominio y `--odoo-version`;
`db restore` exige exactamente un backup y `--db`; `service expose` exige
exactamente un dominio y `--backend`.

## Secretos

- `POSTGRES_PASSWORD` se lee del `.env` o del ambiente y se pasa a
  `psql`/`pg_restore` por stdin, no por `argv`.
- `--admin-passwd` es un flag: queda visible en `ps` y en el historial del
  shell. Prefiere `SOIT_ODOO_ADMIN_PASSWD` o deja que SOIT genere el secreto.
- Los secretos generados se guardan en `.soit/secrets/<stack>.admin_passwd`
  con permisos `0600`.
- `soit config show` redacta contraseñas; `-o json` también.
- `soit doctor` avisa de secretos en claro y permisos laxos.

## Estado interno y archivos

SOIT escribe solo en la raíz de infraestructura:

```text
.soit/
├── backups/     # últimas 10 versiones de archivos gestionados
├── logs/        # logs de restore y otras operaciones
├── secrets/     # secretos generados (0600)
├── tmp/         # extracción temporal de backups
└── soit.lock    # flock para operaciones mutantes
```

Los archivos que SOIT gestiona llevan el marcador:

```text
# managed-by: soit
```

Si un archivo existe pero no lleva el marcador, SOIT no lo sobrescribe salvo
`--force`. Antes de reemplazar un archivo gestionado, guarda una copia en
`.soit/backups/` y conserva las 10 más recientes.

## Concurrencia y lock

Los comandos mutantes toman un `flock` exclusivo en `.soit/soit.lock`. Si otro
proceso lo tiene, esperan hasta `--lock-timeout` (15s por defecto) y luego
fallan. Esto evita dos `instance create` o dos `db restore` simultáneos.

```bash
soit --lock-timeout 2m stack up
```

Si el proceso anterior murió, el lock del sistema operativo se libera solo; no
hay que borrar archivos a mano. Si sospechas un bloqueo, revisa procesos
`soit` vivos antes de tocar `.soit/soit.lock`.

## Configuración en CI

```bash
export SOIT_ROOT="$PWD/odoo-infra"
export SOIT_PUBLIC_IP="203.0.113.10"
export SOIT_ODOO_ADMIN_PASSWD="$(cat "$SECRET_FILE")"

soit --no-color --timeout 10m doctor --strict
soit --no-color --timeout 10m stack health --wait --check
```

No pongas secretos en `argv` ni en logs. Si el `.env` no está disponible en
CI, exporta solo las variables necesarias.

## Ver también

- [Primeros pasos](Instalacion-y-Primeros-Pasos)
- [Referencia de comandos](Referencia-de-Comandos)
- [Troubleshooting](Troubleshooting)
