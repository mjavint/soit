# Notas de versión

> **Resumen histórico:** esta página recoge cambios relevantes de
> comportamiento y operación. No es una guía de uso; para aprender a usar
> cada funcionalidad empieza por [Inicio](Home), [Guía de uso](Guia-de-uso) o
> [Primeros pasos](Instalacion-y-Primeros-Pasos).
>
> Para el changelog oficial por release, consulta
> [GitHub Releases](https://github.com/mjavint/soit/releases).

## Instalación y actualización del binario

- `soit install [--dir <dir>]` copia el binario en ejecución a un directorio
  del `PATH`, sin red y sin `sudo`. Es idempotente y elige `/usr/local/bin`
  para root o `~/.local/bin`/`~/bin` para usuarios normales.
- `soit upgrade` (alias `self-update`) descarga la última release estable de
  GitHub, verifica el SHA-256 contra `checksums.txt` y reemplaza el binario
  con un rename atómico.
- `--check` sale con código `3` si hay actualización; `--dry-run` no descarga
  ni escribe; `--prerelease` incluye release candidates; `--version` fija un
  tag.
- `soit update` **no cambia**: sigue siendo el actualizador agregado de
  imágenes Docker (infra + stacks). `soit infra update` y `soit stack update`
  mantienen su ámbito.
- No hay instalador `curl | sh`; la verificación de checksum es obligatoria.
- La CI añade jobs `smoke` (instalación real en Linux/macOS) y `cross-build`
  (linux/darwin × amd64/arm64), y el job de release verifica que los archivos
  publicados contengan `soit` y que `checksums.txt` sea válido.

Guía: [Primeros pasos](Instalacion-y-Primeros-Pasos#actualizar-soit).

## Odoo 20 en Docker

- Los `odoo.conf` generados incluyen `http_interface = 0.0.0.0`. Odoo 20
  escucha solo en `127.0.0.1` dentro del contenedor por defecto, lo que hace
  que nginx devuelva `502` aunque el contenedor esté healthy.
- `instance create` añade la clave a los `odoo.conf` gestionados que no la
  tengan. Reinicia el stack (`soit stack restart <stack>`) para aplicarla.

Guía: [Instancias Odoo](Instancias-Odoo#odoo-20-y-http_interface) y
[Troubleshooting](Troubleshooting#odoo-20-devuelve-502-o-no-acepta-conexiones).

## Arquitectura por grupos y backups

- Grupo `soit infra *` para la infraestructura (db, nginx, certbot): `init`,
  `up/down/start/stop/restart`, `ps`, `health`, `logs`, `pull`, `update`,
  `build`, `validate`, `backup` y `compose`.
- `soit stack *` es ahora solo ciclo de vida de stacks; `up/start/restart`
  exigen infra corriendo salvo `--with-infra`. Los alias de raíz
  (`soit up`, `soit down`, ...) mantienen el comportamiento agregado.
- `soit infra init [dir]` crea el árbol mínimo de infra sin Docker.
- `soit db backup <db> --stack <stack>` crea un ZIP Odoo (dump + filestore);
  `soit infra backup`, `soit stack backup` y `soit backup` crean ZIP de
  archivos de infra/stacks.

Guías: [Infraestructura](Infraestructura), [Stacks y servicios](Stacks-y-Servicios)
y [Backups](Backups).

## Diagnóstico de instancias

- `instance create` ejecuta la inicialización de Odoo con
  `--logfile=/dev/stderr`, de modo que la excepción real se captura y se
  resume en el error.
- El aviso `Can't find .pfb for face 'Courier'` se trata como benigno
  (ReportLab) y no se elige como causa del fallo.
- Los errores de inicialización incluyen hints con:
  - `soit stack logs <stack> --follow=false --tail 200`,
  - reintento manual con `--logfile=/dev/stderr`,
  - flujo `--skip-init` + `soit db restore`.
- Si se detecta un fallo de conexión/autenticación a PostgreSQL, se añaden
  hints para revisar `soit infra ps` y `soit config show`.
- Si se detecta el `logfile` legacy, se sugiere re-ejecutar `instance create`
  para migrarlo.
- Si Odoo falla con `PermissionError` en `/var/lib/odoo/filestore`, hay un hint
  para `sudo chown -R 101:101 <root>/stacks/<stack>/data`. Además,
  `instance create` crea `data/filestore`, `data/sessions` y `data/addons` y,
  como root, ajusta el dueño de `data/` al UID/GID de la imagen Odoo.

Guía: [Instancias Odoo](Instancias-Odoo#inicialización-y-diagnóstico).

## Logs de Odoo

- Los `odoo.conf` nuevos usan `logfile = /dev/stdout`.
- Los stacks gestionados antiguos migran de `/var/log/odoo/odoo.log` a
  `/dev/stdout` en el siguiente `instance create`.
- Los logs se ven con `soit stack logs <stack>`.

Guía: [Stacks y servicios](Stacks-y-Servicios#paso-3--lee-los-logs).

## Salida y errores

- `compose.RunCapture` transmite stdout y stderr del contenedor a stderr en
  vivo, serializados con un `lockedWriter`. Así `-o json` sigue limpio en
  stdout.
- `runner.SummarizeOutput` elige la última línea significativa, ignora ruido y
  filtra el warning de Courier.
- `ui.WithHints` permite adjuntar pistas a cualquier error; `main` las imprime
  después del error en stderr.
- Los errores de uso (código `2`) se detectan antes de tocar el sistema.

Guía: [Configuración](Configuracion#códigos-de-salida) y
[Troubleshooting](Troubleshooting#códigos-de-salida).

## Stacks

- `soit stack up|down|start|stop|restart` aceptan un stack posicional
  (`soit stack up odoo18`) además de `--only`.
- `soit stack validate [stack]` valida compose files con
  `docker compose config --quiet`, sin arrancar contenedores.
- `soit stack remove <stack>` baja un stack; `--volumes` y `--files` permiten
  borrar volúmenes y `stacks/<stack>/` con `--yes`.
- `soit stack order` define el orden de arranque por defecto en
  `stacks/.order` (`--first`, orden completo, `--reset`, `--pretty`).

Guía: [Stacks y servicios](Stacks-y-Servicios).

## Ayuda y ergonomía

- El comando raíz agrupa comandos (`start`, `infra`, `instances`, `data`,
  `meta`).
- `Long` y `Example` incluyen contexto y ejemplos por comando.
- Alias visibles: `instance new`, `instance show`, `instance ls`, `stack ls`,
  `cert ls`, `service ls`, `service add`, `db ls`.
- Alias de grupo: `stacks`, `infrastructure`, `instances`, `services`,
  `certs`, `certificate`, `certificates`, `database`, `databases`.
- Validación fail-fast de argumentos:
  - `instance create` exige un dominio y `--odoo-version`,
  - `db restore` exige un ZIP y `--db`,
  - `service expose` exige un dominio y `--backend`.
- Los errores de flags incluyen `run '<cmd> --help' to see valid flags and
  examples`.
- `instance create` acepta `--wait-timeout` (default `3m`).

Guía: [Referencia de comandos](Referencia-de-Comandos).

## Releases y CI

- Se eliminó Windows de GoReleaser y de la matriz de CI.
- Plataformas publicadas: Linux/macOS × amd64/arm64.
- Se corrigió la configuración de GoReleaser v2 (sin `format_overrides` v1).
- La CI valida `go build`, `go vet` y `go test -race` en Ubuntu y macOS, más
  `govulncheck`.

Guía: [CI y releases](CI-y-Releases).

## Documentación

- `README.md` y `USAGE.md` se actualizaron con `--wait-timeout`, alias,
  comportamiento de `logfile` y hints.
- La wiki usa layout con navegación, tabla de contenidos y búsqueda, y las
  páginas principales están escritas como guías paso a paso.

## Compatibilidad

- El contrato de idempotencia no cambió: inspeccionar, planear, aplicar solo
  diferencias.
- Los archivos no gestionados siguen protegidos; `--force` sigue siendo
  explícito.
- El default legacy de `db restore --stack` sigue siendo `ydrsoluciones` por
  compatibilidad; se recomienda pasar `--stack` explícito.

## Estado en desarrollo

Si trabajas con un binario compilado desde la rama principal o de
desarrollo, usa `soit <comando> --help` como fuente de verdad de la versión
instalada. Los cambios se consolidan en
[GitHub Releases](https://github.com/mjavint/soit/releases).
