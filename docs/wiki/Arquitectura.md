# Arquitectura

> **Para quién es esta página:** lectores que quieren entender cómo está
> construido SOIT y por qué aplica cambios de forma convergente. Si solo
> necesitas operar, usa [Guía de uso](Guia-de-uso).

SOIT es un binario Go único que envuelve Docker Compose, PostgreSQL, nginx y
certbot. No es un daemon: cada invocación es un proceso que inspecciona el
estado, planea y aplica diferencias.

## Capas

```text
cmd/soit
  └── internal/cli          comandos Cobra, flags, validación de uso
        ├── infra / infra_init  bootstrap y ciclo de vida de infra
        ├── stack              ciclo de vida de stacks
        ├── aggregate          alias agregados de raíz (compatibilidad)
        └── backup             comandos de backup (raíz, infra y stacks)
      └── internal/app    wiring de configuración, layout y clientes
            ├── internal/config     .env, precedencia, redacción
            ├── internal/infra      descubrimiento de raíz, stacks, flock, layout de init
            ├── internal/compose    docker compose (up/down/ps/logs/exec)
            ├── internal/nginx      test/reload/rollback, sitios
            ├── internal/certs      parsing de certs, certbot, timer
            ├── internal/database   psql/pg_restore/pg_dump
            ├── internal/backup     ZIP de BD + filestore e infra/stacks
            ├── internal/restore    ZIP, dump, filestore
            ├── internal/selfupdate GitHub Releases, checksum, reemplazo atómico
              ├── internal/filestore  copia tipo rsync, ownership
              ├── internal/fileutil   escrituras atómicas, marcadores, backups
              ├── internal/templates  plantillas embebidas
              ├── internal/naming     validación compartida
              ├── internal/dns        resolución y IP pública
              ├── internal/odoo       lectura/escritura de odoo.conf
              ├── internal/runner     única capa que ejecuta procesos
              └── internal/ui         tablas, JSON, colores, exit codes
```

La regla de dependencias es deliberada: `internal/runner` es el **único**
paquete que ejecuta procesos externos. Los demás paquetes construyen
argumentos y consumen resultados; así se centralizan dry-run, logging,
captura de salida, timeouts y errores.

## Flujo de un comando

```text
Cobra parsea flags
  └── Runtime.app()
        ├── config.Load(.env + env + flags)
        ├── infra.Discover(--root / SOIT_ROOT / cwd)
        ├── layout.EnsureStateDirs()
        └── app.New(...)
              └── comando
                    ├── lecturas (ps, SELECT, nginx -t)
                    ├── plan (--dry-run)
                    └── mutaciones (writer, compose, psql, nginx)
```

`Runtime` mantiene las opciones globales (`--dry-run`, `--yes`, `--force`,
`--output`, etc.) y las pasa a `app.Options`. Los comandos mutantes llaman a
`markMutating`, que toma el lock y aplica el timeout global.

## Idempotencia

El contrato se implementa en `internal/fileutil` y en cada orquestador:

1. **Inspeccionar** el estado actual.
2. **Planear** con `--dry-run` (imprime `+ comando`).
3. **Aplicar** solo diferencias.

Propiedades:

- Escritura atómica: temporal en el mismo directorio, `fsync`, `rename`.
- Backup de la versión anterior en `.soit/backups/` (últimas 10).
- Marcador `# managed-by: soit` para distinguir archivos gestionados.
- Sin cambios en bytes → sin escritura, sin `nginx -t`, sin recarga.
- `nginx -t` antes de recargar; si falla, se restaura el archivo anterior.
- Certificados reutilizados si cubren el dominio y tienen >30 días.
- Bases de datos creadas solo si faltan.
- `db restore` no reemplaza una BD existente sin `--on-exists=replace --yes`.

## Runner y diagnóstico

`internal/runner` encapsula `os/exec` y ofrece:

- `Run`: ejecuta y devuelve stdout/stderr.
- `RunCapture`: ejecuta, transmite la salida a stderr en vivo y la conserva
  para diagnóstico.
- `Result` con `Stdout`, `Stderr`, `ExitCode`.
- `SummarizeOutput`: elige la última línea significativa de error, ignora
  ruido y avisos benignos como `Can't find .pfb for face 'Courier'`.
- `Error.Detail()`: añade el resumen al error final.

`internal/compose.RunCapture` usa un `lockedWriter` para serializar stdout y
stderr del contenedor y enviarlos a `UI.Err()`. Así la salida de `-o json`
sigue limpia en stdout.

## Errores con hints

`internal/ui/hints.go` define:

```go
type HintError struct {
    Err   error
    Hints []string
}
```

Los comandos envuelven errores con `ui.WithHints(err, ...)`. `cmd/soit/main.go`
imprime el error y, después, las pistas a stderr. Esto mantiene stdout/JSON
limpio y permite que un error de Odoo incluya comandos exactos para
investigar.

## UI y salida

`internal/ui` centraliza:

- `Info`, `Success`, `Warn`, `Error`, `Step`, `Hint`, `Plan`.
- Tablas y JSON (`PrintJSON`).
- Colores y `--no-color`.
- `ExitError` con códigos 1/2/3.
- Redacción de secretos en `config show`.

La salida principal va a stdout; el progreso y los diagnósticos a stderr. Los
comandos que devuelven datos usan `-o json` y no deben imprimir nada más en
stdout.

## Configuración

`internal/config`:

- Lee `.env` sin ejecutar shell.
- Precedencia flags > ambiente > `.env` > defaults.
- Valida claves requeridas (`POSTGRES_USER`, `POSTGRES_PASSWORD`).
- Redacta secretos.
- Resuelve `ACME_EMAIL`/`EMAIL`.

`internal/infra`:

- Descubre la raíz.
- Construye `Layout` con todas las rutas.
- Lista stacks ordenados.
- Implementa `flock` (`.soit/soit.lock`).
- Crea `.soit/{backups,logs,secrets,tmp}` con `0700`.

## Plantillas

`internal/templates` embebe:

- `stack-compose.yml`
- `odoo.conf`
- vhosts nginx (HTTP/TLS, bootstrap)
- `cert-reload.cron`

Las plantillas se renderizan con `text/template` y se escriben con
`fileutil.Writer`, que aplica marcador, backup y modo.

## Seguridad

- Validación centralizada en `internal/naming`: dominios, stack, DB, email,
  backend `host:port`.
- Sin `sh -c`: los argumentos se pasan directamente a `exec`.
- Dumps y contraseñas de PostgreSQL por stdin, no por `argv`.
- Secretos generados en `.soit/secrets/` con `0600`.
- `config show` redacta.
- `doctor` avisa de permisos laxos, secretos en claro e imágenes `:latest`.
- Lock para evitar carreras entre comandos mutantes.

## Extender SOIT

### Añadir un comando

1. Crea `internal/cli/<area>.go` con un `newXxxCmd()`.
2. Añádelo a `root.AddCommand(...)` y al grupo correcto.
3. Usa `markMutating` si escribe.
4. Implementa `Args` para validar posición y flags requeridos.
5. Añade `Example` y `Long` con contexto.
6. Si el error es accionable, envuélvelo con `ui.WithHints`.

### Añadir una plantilla

1. Crea el archivo en `internal/templates/files/`.
2. Añade el `//go:embed` correspondiente.
3. Renderiza con `templates.Render`.
4. Escribe con `fileutil.Writer` (nunca `os.WriteFile` directo).

### Añadir una comprobación a `doctor`

1. Añade un `diagnostic` en `runDiagnostics`.
2. Usa `statusOK`, `statusWarn` o `statusError`.
3. Si es un aviso, `--strict` lo convertirá en exit 3.

## Pruebas

```bash
make test
make test-race
make vet
make lint
make vuln
```

Las pruebas cubren, entre otras cosas:

- Hints y formato de errores.
- Resumen de salida y filtrado del warning de Courier.
- Captura de `RunCapture` y separación stdout/stderr.
- Migración de `logfile` legacy.
- Idempotencia de archivos y backups.
- Parsing de certificados y ventana de renovación.
- Restore de ZIP, dump y filestore.

## Decisiones de diseño

| Decisión | Motivo |
| --- | --- |
| Un binario, sin daemon | Fácil de instalar, auditar y ejecutar en cron/CI. |
| Sin `sh -c` | Evita inyección y problemas de quoting. |
| Marcador `managed-by` | No pisar archivos del usuario. |
| `--dry-run` global | Mismo contrato para todos los comandos. |
| Hints en errores | El operador ve el siguiente paso sin buscar documentación. |
| Logs de Odoo a stdout | `soit stack logs` es el punto único de logs de stacks; `soit infra logs` para infra. |
| Init con `--logfile=/dev/stderr` | Capturar la excepción real de Odoo. |
| Linux/macOS only | Evitar releases Windows sin soporte real. |

## Ver también

- [CI y releases](CI-y-Releases)
- [Troubleshooting](Troubleshooting)
- [Referencia de comandos](Referencia-de-Comandos)
