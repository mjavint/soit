# Migración y alias

> **Para quién es esta página:** equipos que vienen de flujos legacy basados
> en scripts y necesitan saber qué comando usar hoy con SOIT.

SOIT sustituye los flujos operativos anteriores por un binario único, sin
cambiar los archivos existentes de tu infraestructura. Esta página resume el
mapa de migración, los alias de compatibilidad y los cambios de comportamiento
que afectan a una infraestructura ya creada.

## Flujos legacy → SOIT

| Flujo legacy | SOIT |
| --- | --- |
| Arranque general de infraestructura y stacks | `soit up` (o `soit infra up` + `soit stack up`) |
| Apagado general | `soit down` |
| Inicio general | `soit start` |
| Parada general | `soit stop` |
| Reinicio general | `soit restart` |
| Estado general | `soit ps` (o `soit infra ps` + `soit stack ps`) |
| Salud general | `soit health` (o `soit infra health` + `soit stack health`) |
| Logs de infra/stacks | `soit logs [stack|infra]` (o `soit stack logs` / `soit infra logs`) |
| Pull de imágenes | `soit pull` (o `soit infra pull` / `soit stack pull`) |
| Actualización de imágenes | `soit update` (o `soit infra update` / `soit stack update`) |
| Build de imágenes | `soit build` (o `soit infra build` / `soit stack build`) |
| Listado de stacks/instancias | `soit stack list` / `soit instance list` |
| Ejecutar un comando en un contenedor | `soit stack exec <stack> <svc> -- <cmd...>` |
| Compose directo de infra | `soit infra compose <args...>` |
| Compose directo de un stack | `soit stack compose <name> <args...>` |
| Crear una instancia Odoo | `soit instance create <domain> --odoo-version <ver>` |
| Renovar certificados | `soit cert renew [domain]` |
| Simular renovación de certificados | `soit cert renew --simulate` |
| Listar/ver certificados | `soit cert list` / `soit cert status` |
| Restaurar backup Odoo | `soit db restore <zip> --db <db> --stack <stack>` |
| Exponer un servicio con TLS | `soit service expose <domain> --backend <host:port>` |
| Exponer servicio con websocket | `soit service expose ... --websocket h:p` |
| Exponer servicio con basic auth | `soit service expose ... --auth-basic` |
| Exponer servicio con certificado compartido | `soit service expose ... --shared-cert X` |

SOIT no depende de esos flujos anteriores: el binario contiene la lógica de
operación, validación y diagnóstico.

## Alias de compatibilidad

Además de los comandos nuevos, la raíz acepta alias ocultos:

| Alias | Equivalente |
| --- | --- |
| `soit up` / `down` / `start` / `stop` / `restart` | agregado infra + stacks |
| `soit ps` / `status` | agregado infra + stacks |
| `soit health` / `logs` / `pull` / `update` / `build` | agregado infra + stacks |
| `soit list` / `ls` / `exec` | `soit stack list` / `soit stack exec` |
| `soit certs` | `soit cert list` |
| `soit self-update` | `soit upgrade` (actualiza solo el binario) |

> `soit update` sigue siendo el actualizador agregado de **imágenes Docker**
> (infra + stacks). Para actualizar el **binario** usa `soit upgrade`.

Alias de subcomandos:

| Alias | Equivalente |
| --- | --- |
| `soit instance new` | `soit instance create` |
| `soit instance show` | `soit instance status` |
| `soit instance ls` | `soit instance list` |
| `soit stack status` | `soit stack ps` |
| `soit stack ls` | `soit stack list` |
| `soit cert ls` | `soit cert list` |
| `soit service ls` | `soit service list` |
| `soit service add` | `soit service expose` |
| `soit db ls` | `soit db list` |

Los alias de grupo: `stacks`, `infrastructure`, `instances`, `services`,
`certs`, `certificate`, `certificates`, `database`, `databases`.

## Cambios de comportamiento

### `infra` vs `stack`

`soit stack ...` opera solo stacks y `soit infra ...` solo infraestructura;
los alias de raíz (`soit up`, `soit down`, ...) mantienen el comportamiento
agregado. `soit stack up/start/restart` exigen infra corriendo salvo
`--with-infra`.

### `odoo.conf`: `logfile`

Los archivos nuevos usan:

```ini
logfile = /dev/stdout
```

Así `soit stack logs <stack>` muestra los logs de Odoo. Los `odoo.conf`
gestionados con el valor legacy se migran la próxima vez que se ejecuta
`instance create`. Los archivos no gestionados se respetan; usa `--force` si
quieres sobrescribirlos (con backup).

### `odoo.conf`: `http_interface`

Odoo 20 en Docker escucha solo en `127.0.0.1` por defecto. Los archivos nuevos
incluyen:

```ini
http_interface = 0.0.0.0
```

Los `odoo.conf` gestionados que no la tengan se actualizan la próxima vez que
se ejecuta `instance create`; reinicia el stack para aplicarla.

### Inicialización de Odoo

- La inicialización se ejecuta con `--logfile=/dev/stderr`.
- SOIT captura la salida y resume la última línea significativa.
- Ignora el aviso benigno `Can't find .pfb for face 'Courier'`.
- Añade hints con comandos exactos para investigar.
- `--skip-init` permite crear la instancia y restaurar un dump después.

### Timer de certificados

- `soit cert install-timer` escribe `/etc/cron.d/soit-cert-reload`.
- El timer llama a `soit cert reload-if-changed`.
- Solo recarga nginx si un certificado cambió de `mtime`.
- La frecuencia se ajusta con `--every-minutes` (15 por defecto).

Si tienes un cron legacy, puedes retirarlo después de instalar el nuevo:

```bash
sudo soit cert install-timer
# revisa y elimina el cron anterior solo si ya no lo necesitas
```

### Archivos gestionados

Los archivos que SOIT genera llevan:

```text
# managed-by: soit
```

Si un archivo existente no lo lleva, SOIT no lo sobrescribe. Esto es
intencional para no pisar personalizaciones. Para migrar un archivo manual:

1. Revisa el diff.
2. Haz backup.
3. Ejecuta con `--force` o añade el marcador.

### Restore de bases de datos

SOIT realiza el restore de forma segura y observable:

- Hace streaming del dump por stdin.
- Extrae a `.soit/tmp/restore-*`.
- Usa `--on-exists=fail|skip|replace` (default `fail`).
- Verifica el número de tablas.
- Sincroniza el filestore en Go.
- No expone la contraseña.

### Exposición de servicios

`soit service expose` usa el backend tal cual, escribe el archivo de
autenticación en la ruta correcta y genera un vhost válido.

## Checklist de migración

- [ ] Instala SOIT y ejecuta `soit doctor`.
- [ ] Revisa `soit config show` y `soit config validate`.
- [ ] Comprueba que `POSTGRES_PASSWORD` y `ACME_EMAIL` están bien.
- [ ] Ejecuta `soit infra ps`, `soit stack ps` y `soit stack health --check`.
- [ ] Prueba un `instance create --dry-run` sobre una instancia existente.
- [ ] Ejecuta `instance create` para migrar `odoo.conf` gestionados.
- [ ] Instala el timer nuevo y retira el cron legacy.
- [ ] Revisa `soit cert list` y `soit cert status --check`.
- [ ] Prueba `soit db restore` en staging antes de producción.
- [ ] Documenta los alias que uses en tus scripts.

## Ver también

- [Primeros pasos](Instalacion-y-Primeros-Pasos)
- [Configuración](Configuracion)
- [TLS y certificados](TLS-y-Certificados)
- [Notas de versión](Novedades)
