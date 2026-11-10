# Stacks y servicios

> **Resultado:** sabrás arrancar, detener, inspeccionar y actualizar tus
> stacks Odoo, y exponer servicios auxiliares detrás de nginx con TLS.
>
> **Tiempo estimado:** 10 minutos de lectura. **Riesgo:** variable; algunos
> comandos son destructivos.

SOIT distingue dos tipos de proyecto Compose:

- **infra**: `docker-compose.infra.yml` en la raíz. Contiene `db`, `nginx`,
  `certbot` y los servicios compartidos. Se identifica con el nombre `infra`.
- **stack**: un directorio `stacks/<name>/docker-compose.yml`. Contiene una
  instancia Odoo y sus volúmenes/addons.

El orden importa: `soit infra` gestiona la infraestructura; `soit stack`
gestiona solo stacks. Los stacks arrancan en el orden de `stacks/.order`; si
no existe, se usa orden alfabético. En los alias agregados de raíz
(`soit up`, `soit down`, ...), infra va primero en `up/start` y al final en
`down/stop` para no romper la red compartida.

## Antes de empezar

```bash
soit infra up
soit infra health --check
soit stack list
```

`soit stack up/start/restart` no tocan la infraestructura por defecto: exigen
que `db` y `nginx` estén corriendo, o que pases `--with-infra`.

## Parte 1 — Stacks

### Paso 1 — Lista los stacks

```bash
soit stack list
soit stack ps
```

- `stack list` muestra los stacks detectados, su base de datos (`db_name` de
  `odoo.conf`) y el compose.
- `stack ps` muestra `project|service|state|health|image`.

Para scripts:

```bash
soit stack ps -o json
soit stack list -o json
```

### Paso 2 — Arranca y detén

```bash
soit stack up odoo18
soit stack ps
soit stack down odoo18
```

| Comando | Efecto |
| --- | --- |
| `up` | Crea/arranca stacks y espera salud. Requiere infra salvo `--with-infra`. |
| `down` | Detiene y elimina contenedores/redes de stacks (no toca infra). |
| `start` | Arranca stacks detenidos. Requiere infra salvo `--with-infra`. |
| `stop` | Detiene stacks sin eliminarlos (no toca infra). |
| `restart` | `stop` + `start` de stacks. Requiere infra salvo `--with-infra`. |

Flags más usados:

| Flag | Default | Uso |
| --- | --- | --- |
| `--only stringArray` | `[]` | Limita a stacks concretos; repetible. |
| `--wait` | `true` (`up`) | Espera a que los servicios estén healthy. |
| `--wait-timeout duration` | `3m` (`up`) | Espera máxima por proyecto. |
| `--continue-on-error` | `false` | Sigue con el resto si un stack falla. |
| `--with-infra` | `false` | Arranca/reinicia infra primero (`up`, `start`, `restart`). |
| `-V`, `--volumes` | `false` | **Destructivo** en `down`: elimina volúmenes. Requiere `--yes`. |

```bash
soit stack up --with-infra
soit stack up --only odoo18 --wait-timeout 10m
soit stack up --wait=false
soit stack down --only odoo18
soit stack down --volumes --yes
```

> `stack down` y `stack stop` nunca tocan infra. Para bajar todo, usa los
> alias agregados `soit down`/`soit stop` o baja primero los stacks y luego
> `soit infra down`.

### Paso 3 — Lee los logs

```bash
soit stack logs odoo18 --follow=false --tail 200
soit stack logs odoo18 -f --tail 50
soit stack logs --since 24h
```

| Flag | Default | Uso |
| --- | --- | --- |
| `-f`, `--follow` | `true` | Seguir en vivo; `--follow=false` vuelca y sale. |
| `--tail int` | `100` | Líneas finales por servicio. |
| `--since string` | `""` | Timestamp o duración según `docker compose logs`. |

Con `-f` y varios proyectos, los logs se leen en paralelo. Sin `-f`, se
muestran secuencialmente para que la salida sea legible.

Los `odoo.conf` nuevos usan `logfile = /dev/stdout`, así que los logs de Odoo
aparecen aquí. Si un stack antiguo sigue escribiendo en
`/var/log/odoo/odoo.log`, ejecuta `instance create` para migrarlo.

Los `odoo.conf` nuevos también incluyen `http_interface = 0.0.0.0` para que
Odoo 20 en Docker acepte tráfico desde nginx.

### Paso 4 — Ejecuta comandos en un contenedor

```bash
soit stack exec <stack> <service> [flags] -- <command...>
```

| Flag | Default | Uso |
| --- | --- | --- |
| `--no-tty` | `false` | Sin pseudo-TTY; necesario en CI o sin terminal. |
| `-u`, `--user string` | `""` | Usuario dentro del contenedor. |
| `-w`, `--workdir string` | `""` | Directorio de trabajo. |
| `-e`, `--env stringArray` | `[]` | Variables `KEY=VALUE`; repetible. |

```bash
soit stack exec odoo18 odoo -- odoo shell -d odoo18
soit stack exec odoo18 odoo -- bash
soit stack exec odoo18 odoo --no-tty -- odoo --version
soit stack exec odoo18 odoo -u odoo -w /tmp -- env
soit stack exec odoo18 odoo -e LANG=es_ES.UTF-8 -- env
```

El `--` separa los flags de SOIT del comando interior. Sin `--`, Cobra puede
interpretar los flags del comando interno como propios.

### Paso 5 — Actualiza imágenes

```bash
soit stack pull
soit stack build --only odoo18
soit stack update
soit stack update --only odoo18
soit stack update --force
soit --dry-run stack update
```

`update` compara los IDs de imagen antes y después de `pull` y recrea solo los
stacks cuya huella cambió. Si nada cambió, no recrea. `--force` fuerza la
recreación aunque la imagen sea la misma. Usa `soit infra update` para la
infraestructura y `soit upgrade` para el binario.

### Paso 6 — Valida el compose

```bash
soit stack validate
soit stack validate odoo18
soit stack validate --only odoo18 --only odoo17
soit stack validate -o json
```

Ejecuta `docker compose config --quiet` para los stacks seleccionados. Es de
solo lectura: valida sintaxis, interpolación y servicios sin crear ni arrancar
contenedores. Úsalo tras editar un compose y antes de `stack up`. Para la
infraestructura usa `soit infra validate`.

### Paso 7 — Elimina un stack

```bash
soit stack remove odoo18
soit stack remove odoo18 --volumes --yes
soit stack remove odoo18 --files --yes
soit --dry-run stack remove odoo18 --files --yes
```

`remove` hace `down` **solo** de ese stack; no toca infra. Por defecto
conserva `stacks/<stack>/`, la base de datos, el vhost nginx y el certificado.

- `--volumes`: también elimina volúmenes nombrados. **Destructivo**, requiere
  `--yes`.
- `--files`: tras un `down` exitoso, borra `stacks/<stack>/` y lo quita de
  `stacks/.order`. **Destructivo**, requiere `--yes`.

Para una baja completa de instancia, además:

```bash
soit service remove odoo18.example.com
soit db drop odoo18 --terminate --yes
```

### Orden de arranque

Por defecto los stacks arrancan en orden alfabético. Para definir cuál debe
arrancar primero, usa `stacks/.order`, un stack por línea:

```bash
soit stack order                          # ver el orden efectivo
soit stack order odoo20 odoo18 odoo17     # definir orden completo
soit stack order --first odoo20           # odoo20 primero, resto igual
soit stack order --reset                  # volver al orden alfabético
soit stack order --pretty                 # un stack por línea
soit stack order -o json                  # para scripts
```

`stack up`/`start`/`restart` respetan ese orden; `down`/`stop` lo recorren al
revés. Los stacks no listados se añaden al final en orden alfabético.

### Backup de un stack

```bash
soit stack backup odoo18
soit stack backup --only odoo18 --no-secrets
```

El ZIP incluye los archivos del stack, no la base de datos. Para la base de
datos y el filestore usa `soit db backup`. Ver [Backups](Backups).

### Escape hatch: `stack compose`

```bash
soit stack compose <stack> <docker compose args...>
```

Pasa todo tal cual a `docker compose -f <stack> ...`. Este comando
**desactiva el parseo de flags** de SOIT: lo que sigue al target es para
Docker. Para elegir la raíz, usa `--root` o `SOIT_ROOT` antes del comando.
Para la infraestructura usa `soit infra compose`.

```bash
soit stack compose odoo18 restart odoo
soit stack compose odoo18 config
soit --root /srv/odoo-infra stack compose odoo18 config
```

### Troubleshooting de stacks

| Síntoma | Qué revisar |
| --- | --- |
| `db`/`nginx` no están corriendo | `soit infra up`; `soit infra ps`; `soit stack ps`. |
| Un servicio queda `starting` | `soit stack logs <stack> --follow=false`; `soit stack health --wait --wait-timeout 5m`. |
| `stack update` no recrea | La imagen no cambió; usa `--force` si quieres recrear igual. |
| `stack down --volumes` falla | Falta `--yes`; es destructivo. |
| `nginx -t` falla | SOIT restaura el archivo anterior; revisa `soit infra logs --follow=false`. |

## Parte 2 — Servicios nginx

`soit service` expone backends que no son Odoo (pgadmin, portainer, paneles,
APIs) detrás de nginx con TLS. El backend se usa **tal cual**: `host:port`,
sin prefijo `odoo-`.

### Paso 1 — Expón un servicio

```bash
soit service expose <domain> --backend <host:port> [flags]
```

Ejemplo con pgAdmin:

```bash
soit service expose pgadmin.example.com --backend pgadmin:80 --auth-basic
```

Flags principales:

| Flag | Default | Uso |
| --- | --- | --- |
| `--backend string` | — (**requerido**) | Backend en la red compartida. |
| `--websocket string` | `""` | Backend WS para `/websocket` y `/longpolling`. |
| `--email string` | `ACME_EMAIL` | Email ACME. |
| `--cert-name string` | dominio | Nombre del certificado. |
| `--shared-cert string` | `""` | Reutiliza un certificado existente. |
| `--auth-basic` | `false` | Activa HTTP basic auth. |
| `--auth-user string` | `admin` | Usuario basic auth. |
| `--auth-password string` | `SOIT_AUTH_PASSWORD` o generado | Password basic auth. |
| `--skip-dns` | `false` | Omite verificación DNS. |
| `--allow-dns-mismatch` | `false` | Avisa si el DNS no coincide. |
| `--skip-challenge` | `false` | Omite la sonda HTTP-01. |

Si se genera una contraseña de basic auth, se imprime **una sola vez**.
Guárdala o pásala explícitamente con `--auth-password` /
`SOIT_AUTH_PASSWORD`.

### Protege con basic auth

```bash
soit service expose app.example.com \
  --backend app:8000 \
  --auth-basic --auth-user admin
```

SOIT escribe el `.htpasswd` y configura nginx. Si no pasas contraseña, se
genera y se muestra una única vez. Para rotarla, vuelve a ejecutar `expose`
con `--force` o edita el `.htpasswd` y recarga nginx.

### Paso 2 — Deshabilita y habilita

```bash
soit service list
soit service disable pgadmin.example.com
soit service enable pgadmin.example.com
```

`disable` mueve el sitio a `nginx/conf.d/.disabled/` y recarga nginx.
`enable` lo restaura. El certificado no se toca.

### Paso 3 — Elimina un sitio

```bash
soit service remove pgadmin.example.com
```

`remove` elimina el vhost, pero **no** borra el certificado: queda en
`certbot/conf/live/` para reutilizarlo. Para una baja completa, elimina el
certificado manualmente si ya no lo necesitas.

### Troubleshooting de servicios

| Síntoma | Qué revisar |
| --- | --- |
| `service expose` falla por DNS | `dig +short <domain>`; `--skip-dns` solo para staging. |
| nginx devuelve 502 | Backend mal escrito o no está en la red compartida. |
| Basic auth no aparece | Revisa `--auth-basic`, `.htpasswd` y `soit service list`. |
| El sitio no se deshabilita | Comprueba que el vhost sea gestionado por SOIT. |

## Propiedad de archivos

Los archivos generados por SOIT llevan:

```text
# managed-by: soit
```

- Si el archivo existe y es gestionado, SOIT lo converge y guarda backup.
- Si existe y no es gestionado, no lo toca salvo `--force`.
- Si no existe, lo crea.

Esto aplica a `docker-compose.yml`, `odoo.conf`, vhosts nginx, `.htpasswd` y
otros archivos gestionados.

## Siguiente paso

- [Bases de datos y restore](Bases-de-Datos-y-Restore): backups y restores.
- [TLS y certificados](TLS-y-Certificados): emisión y renovación.
- [Operación y runbook](Operacion-y-Runbook): rutinas de producción.
