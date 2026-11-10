# Operación y runbook

> **Para qué sirve:** rutinas concretas para operar SOIT en producción y
> decidir qué hacer cuando algo falla. No es una lista de comandos: es el
> orden, la verificación y el rollback.

## Checklist diaria

Ejecuta desde la raíz de infraestructura:

```bash
# 1. Salud general
soit doctor
soit stack health --check

# 2. Estado de instancias
soit instance list

# 3. Certificados (exit 3 si quedan ≤30 días)
soit cert status --check

# 4. Errores recientes de Odoo
soit stack logs odoo18 --follow=false --tail 200 --since 24h
```

Interpreta los códigos:

- `0`: todo correcto.
- `3`: hay deriva o un servicio no sano; no es un fallo de ejecución.
- `1`: el comando no pudo completar su trabajo.
- `2`: error de uso (flag o argumento inválido).

Si algo sale con `3`, revisa el detalle antes de reiniciar nada.

## Checklist semanal

```bash
# Actualizar el binario solo si hay release nueva
soit upgrade --check
# sudo soit upgrade

# Actualizar imágenes y recrear solo lo que cambió
soit stack pull
soit stack update
soit stack health --wait --check

# Revisar certificados y timer
soit cert list
cat /etc/cron.d/soit-cert-reload
tail -n 50 .soit/logs/cert-reload.log

# Revisar espacio y contenedores
docker system df
soit stack ps
```

## Desplegar una instancia nueva

```bash
# 1. Plan
soit --dry-run instance create odoo18.example.com --odoo-version 18.0

# 2. Crear
soit instance create odoo18.example.com --odoo-version 18.0

# 3. Verificar
soit instance status odoo18
soit stack health --wait --check
curl -I https://odoo18.example.com
```

Si vas a restaurar un backup, añade `--skip-init` y sigue el flujo de
[Bases de datos y restore](Bases-de-Datos-y-Restore#restaurar-en-una-instancia-nueva).

## Actualizar una instancia

```bash
# 1. Ver qué cambiaría
soit --dry-run stack update --only odoo18

# 2. Actualizar
soit stack update --only odoo18

# 3. Verificar
soit stack health --wait --check
soit instance status odoo18
```

`stack update` hace `pull` y recrea solo si la huella de la imagen cambió.
`--force` recrea aunque no haya cambiado; úsalo con intención.

### Ventana de mantenimiento

Para un cambio controlado, detén solo el stack (la infraestructura sigue
corriendo):

```bash
soit stack stop --only odoo18
# ... mantenimiento ...
soit stack start --only odoo18
soit stack health --wait --check
```

`stack stop` no elimina contenedores ni volúmenes. `stack down` sí elimina
contenedores y redes del stack; evita `down` si no quieres recrear. Para bajar
todo, usa el alias agregado `soit stop` o baja primero los stacks y luego
`soit infra down`.

## Backup y restore

SOIT crea backups con `soit db backup` (BD + filestore) y con
`soit infra backup` / `soit stack backup` / `soit backup` (configuración).
No instala un cron de backups: programa el comando con tu planificador.

Antes de restaurar:

1. Verifica que el ZIP abre y contiene dump + filestore.
2. Crea o elige el stack destino.
3. Si la BD existe, decide `--on-exists`.
4. Ten claro el `--stack` y el `--db`.

```bash
# Crear un backup
soit db backup demo --stack demo

# Restaurar en una instancia nueva
soit instance create demo.example.com \
  --odoo-version 17.0 --skip-init --skip-dns --skip-tls
soit db restore dbs/demo.zip --db demo --stack demo

# Reemplazar una BD existente (destructivo)
soit db restore dbs/demo.zip \
  --db demo --stack demo --on-exists=replace --yes

# Verificar
soit instance status demo
soit stack logs demo --follow=false --tail 200
```

El log del restore queda en `.soit/logs/restore-*.log`. Más detalle:
[Backups](Backups) y [Bases de datos y restore](Bases-de-Datos-y-Restore).

## Certificados

```bash
# Estado
soit cert list
soit cert status --check

# Renovación manual
soit cert renew
soit cert reload

# Probar sin rate limit
soit cert renew --simulate

# Timer del host
sudo soit cert install-timer --every-minutes 15
```

Si un certificado no se renueva:

1. `soit cert status --check`
2. `dig +short <domain>`
3. `curl -I http://<domain>/.well-known/acme-challenge/<token>` (si tienes un
   token de prueba)
4. `soit infra logs --follow=false --tail 200`
5. `soit cert renew <domain> --staging` para validar sin rate limit.

## Incidentes

### Odoo no responde

```bash
soit stack ps
soit instance status <stack>
soit stack logs <stack> --follow=false --tail 300
soit stack compose <stack> config
```

Si el contenedor está unhealthy:

```bash
soit stack restart --only <stack>
soit stack health --wait --wait-timeout 5m
```

Si el fallo es de inicialización, de configuración o un `502` en Odoo 20,
revisa [Troubleshooting](Troubleshooting).

### nginx no sirve el sitio

```bash
soit service list
soit infra logs --follow=false --tail 200
soit cert list
soit cert reload
```

Si `nginx -t` falla, SOIT restaura el archivo anterior y vuelve a probar. El
sitio puede quedar deshabilitado; revisa `nginx/conf.d/.disabled/`.

### La base de datos no conecta

```bash
soit infra ps
soit config show
soit infra logs --follow=false --tail 200
```

Comprueba `POSTGRES_USER`, `POSTGRES_PASSWORD`, que el contenedor `db` esté
healthy y que la red compartida exista.

### Disco lleno

```bash
docker system df
du -sh .soit/* stacks/*/data
```

Limpia backups antiguos, logs de restore y volúmenes que ya no uses. **No**
borres `stacks/<name>/data/` sin backup: contiene el filestore.

### Lock bloqueado

```bash
ps aux | grep '[s]oit'
```

El lock es un `flock` del sistema operativo; si el proceso murió, se libera
solo. Si hay un proceso vivo, espera o usa `--lock-timeout`. No borres
`.soit/soit.lock` a ciegas.

## Automatización

### CI: salud y deriva

```bash
set -euo pipefail

soit --no-color --timeout 10m doctor --strict
soit --no-color --timeout 10m stack health --wait --check -q
soit --no-color --timeout 5m cert status --check -q
```

`doctor --strict`, `stack health --check` y `cert status --check` usan código
`3` para distinguir “deriva” de “error de ejecución”.

### JSON

```bash
soit instance list -o json | jq -r '.[] | [.stack, .odoo, .database] | @tsv'
soit doctor -o json | jq '.checks[] | select(.status != "ok")'
```

La salida principal va a stdout; el progreso y los diagnósticos a stderr.

### Cron de ejemplo

```cron
# Salud cada 15 minutos
*/15 * * * * root /usr/local/bin/soit --root /srv/odoo-infra --quiet stack health --check

# Certificados: estado diario
0 6 * * * root /usr/local/bin/soit --root /srv/odoo-infra --quiet cert status --check

# Backup diario de la BD principal
30 2 * * * root cd /srv/odoo-infra && /usr/local/bin/soit db backup ydr_prod --stack ydrsoluciones --output /backups/soit/ydr_prod-$(date +\%Y\%m\%d).zip >> /var/log/soit-backup.log 2>&1
```

El timer de recarga de nginx lo instala SOIT; no lo dupliques a mano.

## Seguridad operativa

- No pases contraseñas por `argv`; usa `SOIT_ODOO_ADMIN_PASSWD`,
  `SOIT_AUTH_PASSWORD` o secretos generados.
- Revisa permisos de `.env` y `.soit/secrets/` (`0600`).
- Rota `POSTGRES_PASSWORD` y `admin_passwd` con un procedimiento probado.
- Mantén `--force` para casos excepcionales: sobrescribe archivos no
  gestionados.
- Haz backup antes de `db drop`, `db restore --on-exists=replace` y
  `stack down --volumes`.
- Prueba los cambios en staging con `--skip-dns --skip-tls` o `--staging`.

## Rollback

| Cambio | Rollback |
| --- | --- |
| Archivo gestionado | SOIT guarda la versión anterior en `.soit/backups/`; restaura el archivo y recarga nginx. |
| Vhost nginx inválido | SOIT restaura automáticamente si `nginx -t` falla. |
| Imagen Odoo | Cambia el tag anterior en el compose y ejecuta `soit stack up --only <stack>`. |
| Base de datos | Restaurar el backup anterior con `db restore`. |
| Certificado | `soit cert issue`/`renew`; conserva el certificado anterior en `certbot/conf/live/` hasta que certbot lo reemplace. |

No hay rollback automático de datos. Un backup verificado es la única red de
seguridad real.

## Ver también

- [Instancias Odoo](Instancias-Odoo)
- [Stacks y servicios](Stacks-y-Servicios)
- [Bases de datos y restore](Bases-de-Datos-y-Restore)
- [TLS y certificados](TLS-y-Certificados)
- [Troubleshooting](Troubleshooting)
