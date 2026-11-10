# Guía de uso

Esta página es el mapa de funcionalidades de SOIT. Busca la tarea que
necesitas y sigue la guía enlazada; cada guía explica los pasos, el resultado
esperado y cómo verificar que todo quedó bien.

> **¿Primera vez?** Empieza por [Primeros pasos](Instalacion-y-Primeros-Pasos).
> Si ya tienes SOIT instalado, usa la tabla siguiente como índice.

## Instalación y binario

| Quiero… | Comando | Guía |
| --- | --- | --- |
| Instalar el binario en el `PATH` | `soit install` | [Primeros pasos](Instalacion-y-Primeros-Pasos#paso-1--instala-el-binario) |
| Instalar en un directorio concreto | `soit install --dir ~/.local/bin` | [Primeros pasos](Instalacion-y-Primeros-Pasos#paso-1--instala-el-binario) |
| Comprobar si hay una versión nueva | `soit upgrade --check` | [Primeros pasos](Instalacion-y-Primeros-Pasos#actualizar-soit) |
| Actualizar el binario | `soit upgrade` | [Primeros pasos](Instalacion-y-Primeros-Pasos#actualizar-soit) |
| Instalar una release concreta | `soit upgrade --version v0.1.0` | [Primeros pasos](Instalacion-y-Primeros-Pasos#actualizar-soit) |
| Ver versión, commit y plataforma | `soit version` | [Primeros pasos](Instalacion-y-Primeros-Pasos#paso-1--instala-el-binario) |
| Activar autocompletado | `soit completion bash` | [Primeros pasos](Instalacion-y-Primeros-Pasos#autocompletado-del-shell) |

> **No confundas:** `soit upgrade` actualiza el binario de SOIT. `soit update`
> actualiza las imágenes Docker de infraestructura y stacks.

## Infraestructura

| Quiero… | Comando | Guía |
| --- | --- | --- |
| Crear la raíz de infraestructura | `soit infra init ./odoo-infra` | [Infraestructura](Infraestructura#paso-1--crea-la-raíz) |
| Ver la configuración efectiva | `soit config show` | [Configuración](Configuracion) |
| Validar `.env` y rutas | `soit config validate` | [Infraestructura](Infraestructura#paso-2--valida-la-configuración) |
| Diagnosticar Docker, red y secretos | `soit doctor` | [Infraestructura](Infraestructura#paso-2--valida-la-configuración) |
| Arrancar PostgreSQL, nginx y certbot | `soit infra up` | [Infraestructura](Infraestructura#paso-3--arranca-la-infraestructura) |
| Ver estado y salud | `soit infra ps` / `soit infra health` | [Infraestructura](Infraestructura#paso-4--verifica) |
| Ver logs | `soit infra logs --follow=false --tail 200` | [Infraestructura](Infraestructura#logs-de-infraestructura) |
| Detener o reiniciar | `soit infra stop` / `soit infra restart` | [Infraestructura](Infraestructura#ciclo-de-vida) |
| Actualizar imágenes de infra | `soit infra update` | [Infraestructura](Infraestructura#actualizar-imágenes) |
| Validar el compose sin arrancar | `soit infra validate` | [Infraestructura](Infraestructura#validar-el-compose) |
| Backup de archivos de infra | `soit infra backup --no-secrets` | [Backups](Backups#infraestructura) |
| Pasar un comando a Docker Compose | `soit infra compose ps` | [Infraestructura](Infraestructura#escape-hatch-infra-compose) |

## Instancias Odoo

| Quiero… | Comando | Guía |
| --- | --- | --- |
| Crear una instancia | `soit instance create <domain> --odoo-version 18.0` | [Instancias Odoo](Instancias-Odoo#paso-2--crea-la-instancia) |
| Ver qué haría sin mutar | `soit --dry-run instance create ...` | [Instancias Odoo](Instancias-Odoo#paso-1--planifica) |
| Crear staging sin DNS ni TLS | `soit instance create ... --skip-dns --skip-tls` | [Instancias Odoo](Instancias-Odoo#staging-sin-dns-ni-tls) |
| Elegir stack, BD y workers | `soit instance create ... --stack odoo18 --db ydr_prod --workers 8` | [Instancias Odoo](Instancias-Odoo#flags-de-instance-create) |
| Crear sin inicializar la BD | `soit instance create ... --skip-init` | [Bases de datos y restore](Bases-de-Datos-y-Restore#restaurar-en-una-instancia-nueva) |
| Ver estado de una instancia | `soit instance status odoo18` | [Instancias Odoo](Instancias-Odoo#paso-3--verifica) |
| Listar instancias | `soit instance list` | [Instancias Odoo](Instancias-Odoo#paso-3--verifica) |
| Diagnosticar `--init=base` | `soit instance status` + logs | [Instancias Odoo](Instancias-Odoo#inicialización-y-diagnóstico) |
| Borrar una instancia | `soit stack remove` + `soit db drop` | [Instancias Odoo](Instancias-Odoo#borrar-una-instancia) |

## Stacks

| Quiero… | Comando | Guía |
| --- | --- | --- |
| Listar stacks detectados | `soit stack list` | [Stacks y servicios](Stacks-y-Servicios#paso-1--lista-los-stacks) |
| Ver estado y salud | `soit stack ps` | [Stacks y servicios](Stacks-y-Servicios#paso-1--lista-los-stacks) |
| Arrancar un stack | `soit stack up odoo18` | [Stacks y servicios](Stacks-y-Servicios#paso-2--arranca-y-detén) |
| Bajar un stack | `soit stack down odoo18` | [Stacks y servicios](Stacks-y-Servicios#paso-2--arranca-y-detén) |
| Reiniciar sin tocar infra | `soit stack restart odoo18` | [Stacks y servicios](Stacks-y-Servicios#paso-2--arranca-y-detén) |
| Ver logs | `soit stack logs odoo18 --follow=false --tail 200` | [Stacks y servicios](Stacks-y-Servicios#paso-3--lee-los-logs) |
| Ejecutar un comando dentro del contenedor | `soit stack exec odoo18 odoo -- odoo shell -d odoo18` | [Stacks y servicios](Stacks-y-Servicios#paso-4--ejecuta-comandos-en-un-contenedor) |
| Actualizar imágenes del stack | `soit stack update odoo18` | [Stacks y servicios](Stacks-y-Servicios#paso-5--actualiza-imágenes) |
| Validar el compose | `soit stack validate odoo18` | [Stacks y servicios](Stacks-y-Servicios#paso-6--valida-el-compose) |
| Cambiar el orden de arranque | `soit stack order --first odoo20` | [Stacks y servicios](Stacks-y-Servicios#orden-de-arranque) |
| Eliminar un stack | `soit stack remove odoo18` | [Stacks y servicios](Stacks-y-Servicios#paso-7--elimina-un-stack) |
| Backup de archivos del stack | `soit stack backup odoo18` | [Backups](Backups#stacks) |

## Servicios nginx

| Quiero… | Comando | Guía |
| --- | --- | --- |
| Listar sitios nginx | `soit service list` | [Stacks y servicios](Stacks-y-Servicios#servicios-nginx) |
| Exponer un backend con TLS | `soit service expose pgadmin.example.com --backend pgadmin:80` | [Stacks y servicios](Stacks-y-Servicios#paso-1--expón-un-servicio) |
| Proteger con basic auth | `soit service expose ... --auth-basic` | [Stacks y servicios](Stacks-y-Servicios#proteger-con-basic-auth) |
| Deshabilitar un sitio | `soit service disable pgadmin.example.com` | [Stacks y servicios](Stacks-y-Servicios#paso-2--deshabilita-y-habilita) |
| Volver a habilitarlo | `soit service enable pgadmin.example.com` | [Stacks y servicios](Stacks-y-Servicios#paso-2--deshabilita-y-habilita) |
| Eliminar un sitio | `soit service remove pgadmin.example.com` | [Stacks y servicios](Stacks-y-Servicios#paso-3--elimina-un-sitio) |

## Bases de datos y restore

| Quiero… | Comando | Guía |
| --- | --- | --- |
| Listar bases de datos | `soit db list` | [Bases de datos y restore](Bases-de-Datos-y-Restore#paso-1--lista-las-bases-de-datos) |
| Crear una base de datos | `soit db create demo_db` | [Bases de datos y restore](Bases-de-Datos-y-Restore#paso-2--crea-una-base-de-datos) |
| Borrar una base de datos | `soit db drop demo_db --yes` | [Bases de datos y restore](Bases-de-Datos-y-Restore#paso-3--borra-una-base-de-datos) |
| Backup de BD + filestore | `soit db backup odoo18 --stack odoo18` | [Bases de datos y restore](Bases-de-Datos-y-Restore#paso-4--backup-de-bd--filestore) |
| Restaurar un ZIP | `soit db restore backup.zip --db odoo18 --stack odoo18` | [Bases de datos y restore](Bases-de-Datos-y-Restore#paso-5--restaura-un-backup) |
| Reemplazar una BD existente | `soit db restore ... --on-exists=replace --yes` | [Bases de datos y restore](Bases-de-Datos-y-Restore#reemplazar-una-bd-existente) |

## Backups

| Quiero… | Comando | Guía |
| --- | --- | --- |
| Backup de BD + filestore | `soit db backup` | [Backups](Backups#base-de-datos--filestore) |
| Backup de infraestructura | `soit infra backup` | [Backups](Backups#infraestructura) |
| Backup de stacks | `soit stack backup` | [Backups](Backups#stacks) |
| Backup completo de configuración | `soit backup` | [Backups](Backups#todo-la-configuración) |
| Verificar un ZIP | `unzip -l backup.zip` | [Backups](Backups#verificar-un-zip) |

## TLS y certificados

| Quiero… | Comando | Guía |
| --- | --- | --- |
| Listar certificados | `soit cert list` | [TLS y certificados](TLS-y-Certificados#paso-1--lista-y-comprueba) |
| Comprobar vencimientos | `soit cert status --check` | [TLS y certificados](TLS-y-Certificados#paso-1--lista-y-comprueba) |
| Emitir un certificado | `soit cert issue odoo18.example.com` | [TLS y certificados](TLS-y-Certificados#paso-2--emite-un-certificado) |
| Renovar | `soit cert renew` | [TLS y certificados](TLS-y-Certificados#paso-3--renueva) |
| Recargar nginx | `soit cert reload` | [TLS y certificados](TLS-y-Certificados#paso-4--recarga-nginx) |
| Instalar el timer | `sudo soit cert install-timer` | [TLS y certificados](TLS-y-Certificados#paso-5--instala-el-timer) |

## Diagnóstico y operación

| Quiero… | Comando | Guía |
| --- | --- | --- |
| Diagnóstico general | `soit doctor` | [Troubleshooting](Troubleshooting#kit-de-diagnóstico) |
| Ver salud de infra y stacks | `soit infra health --check` / `soit stack health --check` | [Operación y runbook](Operacion-y-Runbook#checklist-diaria) |
| Revisar certificados | `soit cert status --check` | [Operación y runbook](Operacion-y-Runbook#checklist-semanal) |
| Ver logs de Odoo | `soit stack logs odoo18` | [Stacks y servicios](Stacks-y-Servicios#paso-3--lee-los-logs) |
| Resolver un 502 | `soit stack ps` + logs + `http_interface` | [Troubleshooting](Troubleshooting#odoo-20-devuelve-502-o-no-acepta-conexiones) |
| Entender códigos de salida | `0`, `1`, `2`, `3` | [Troubleshooting](Troubleshooting#códigos-de-salida) |

## Convenciones de esta documentación

- Los ejemplos usan `example.com`, `odoo18.example.com` y `/srv/odoo-infra`.
  Reemplázalos por tus valores reales.
- `<domain>`, `<stack>`, `<db>` y `<version>` son placeholders.
- Los comandos se ejecutan desde la raíz de infraestructura salvo que se
  indique otra cosa.
- Antes de un comando destructivo, verás **⚠️** y una explicación de lo que
  se pierde.
- `--dry-run` está disponible en los comandos mutantes: úsalo para ver el plan
  sin escribir nada.
- La fuente de verdad de flags es `soit <comando> --help`; si esta wiki y el
  binario difieren, gana el binario.
