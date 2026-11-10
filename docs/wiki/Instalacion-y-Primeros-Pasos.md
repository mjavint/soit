# Primeros pasos

> **Resultado:** al terminar tendrás SOIT instalado, una infraestructura con
> PostgreSQL, nginx y certbot, y una instancia Odoo healthy con TLS.
>
> **Tiempo estimado:** 10–15 minutos. **Riesgo:** medio; vas a crear
> contenedores, una base de datos y un certificado.

## Antes de empezar

| Necesitas | Detalle |
| --- | --- |
| Sistema operativo | Linux o macOS (`amd64` o `arm64`). Windows no está soportado. |
| Docker | Docker Engine o Docker Desktop con el plugin `docker compose`. |
| Dominio | Un FQDN que apunte al servidor, por ejemplo `odoo18.example.com`. |
| Puertos | `80` y `443` libres si vas a emitir un certificado con HTTP-01. |
| Acceso | Permisos para crear directorios y ejecutar Docker. |

Comprueba lo básico:

```bash
docker --version
docker compose version
```

Si `docker compose version` falla, instala el plugin de Compose antes de
continuar.

## Paso 1 — Instala el binario

Elige una de las dos rutas.

### Opción A: desde un release

Descarga el archivo de tu plataforma desde
[GitHub Releases](https://github.com/mjavint/soit/releases):

```text
soit_<version>_linux_amd64.tar.gz
soit_<version>_linux_arm64.tar.gz
soit_<version>_darwin_amd64.tar.gz
soit_<version>_darwin_arm64.tar.gz
checksums.txt
```

Verifica el checksum, extrae el binario y cópialo a un directorio del `PATH`:

```bash
sha256sum -c checksums.txt --ignore-missing
tar -xzf soit_<version>_darwin_arm64.tar.gz
sudo install -m 0755 soit /usr/local/bin/soit
```

En macOS puedes usar `shasum -a 256 -c checksums.txt --ignore-missing` en
lugar de `sha256sum`.

### Opción B: desde fuente

```bash
git clone https://github.com/mjavint/soit.git
cd soit

make build          # genera ./bin/soit
./bin/soit install  # copia el binario a un directorio del PATH
```

`soit install` no usa red ni `sudo`. Como root prefiere `/usr/local/bin` si es
escribible; como usuario normal prefiere `~/.local/bin` o `~/bin` si ya están
en `PATH`. Si el directorio elegido no está en `PATH`, imprime la línea exacta
que debes exportar.

También puedes elegir el destino:

```bash
soit install --dir ~/.local/bin
sudo soit install --dir /usr/local/bin
```

### Verifica la instalación

```bash
soit version
```

Salida esperada, con tus propios valores:

```text
soit 1.0.0
commit:   abc123...
built:    2026-11-10T13:11:41Z
go:       go1.27.3
platform: darwin/arm64
```

Si el binario se compiló a mano sin `-ldflags`, la versión puede mostrar
`dev`; es normal. Para una release instalada debe mostrar la versión real.

> **Nota:** no hay instalador `curl | sh`. La descarga, verificación de
> checksum y colocación del binario son pasos explícitos.

## Paso 2 — Crea la raíz de infraestructura

La raíz es el directorio donde viven el compose de infraestructura, el `.env`
y los stacks.

```bash
soit infra init ./odoo-infra
cd ./odoo-infra
```

La estructura mínima queda así:

```text
odoo-infra/
├── docker-compose.infra.yml
├── .env
├── .env.example
├── .gitignore
├── stacks/
├── nginx/
├── certbot/
└── .soit/
```

Comprueba que SOIT encuentra la raíz y que Docker responde:

```bash
soit doctor
```

`soit doctor` es de solo lectura. Revisa Docker/Compose, permisos de la raíz,
el `.env`, la red compartida, los servicios de infraestructura, certificados,
el timer de renovación, imágenes `:latest` sin pin y secretos en claro. Con
`--strict`, los avisos hacen que salga con código `3`.

Si el comando falla, revisa [Troubleshooting](Troubleshooting) antes de
continuar.

## Paso 3 — Configura el `.env`

Abre `.env` y revisa, como mínimo:

```dotenv
PROJECT_NAME=odoo-infra
POSTGRES_USER=odoo
POSTGRES_PASSWORD=cambia-esto
PG_VERSION=16
ACME_EMAIL=ops@example.com
```

- `POSTGRES_PASSWORD` es obligatoria.
- `ACME_EMAIL` también puede llamarse `EMAIL` por compatibilidad.
- La versión de Odoo **no** va aquí: se pasa por instancia con
  `--odoo-version`.

Valida la configuración y revisa la configuración efectiva con secretos
redactados:

```bash
soit config validate
soit config show
```

La precedencia es: **flags > variables de ambiente > `.env` > defaults**.

## Paso 4 — Arranca la infraestructura

```bash
soit infra up
```

Este comando arranca PostgreSQL, nginx y certbot. Después verifica:

```bash
soit infra ps
soit infra health --check
```

`infra health --check` devuelve código `3` si detecta deriva o un servicio no
sano. Si algo falla:

```bash
soit infra logs --follow=false --tail 200
```

## Paso 5 — Crea la primera instancia Odoo

Antes de crear la instancia, el dominio debe resolver al servidor:

```bash
dig +short odoo18.example.com
```

Si no tienes `dig`, usa `nslookup` o comprueba el DNS desde tu proveedor. Para
staging sin DNS ni TLS, usa `--skip-dns --skip-tls` y salta esta comprobación.

Crea la instancia:

```bash
soit instance create odoo18.example.com --odoo-version 18.0
```

El comando converge, en orden:

1. DNS y comprobaciones previas.
2. Infraestructura corriendo.
3. Stack, `docker-compose.yml`, `odoo.conf`, `data/` y `addons/`.
4. Base de datos PostgreSQL.
5. Certificado TLS y sitio nginx.
6. `--init=base` solo si la base está vacía.
7. `docker compose up -d --wait`.
8. Timer de renovación y verificación de `/web/health`.

El nombre del stack se deriva del primer label del dominio:
`odoo18.example.com` → stack `odoo18`. Los guiones se convierten en guiones
bajos (`odoo-18.example.com` → `odoo_18`).

### Variantes útiles

```bash
# Ver el plan sin mutar nada
soit --dry-run instance create odoo18.example.com --odoo-version 18.0

# Staging privado: sin DNS ni TLS
soit instance create staging.example.com \
  --odoo-version 18.0 --skip-dns --skip-tls

# Nombre de stack, base de datos y workers explícitos
soit instance create odoo18.example.com \
  --odoo-version 18.0 --stack odoo18 --db ydr_prod --workers 8

# No inicializar la base: se restaurará un dump después
soit instance create demo.example.com \
  --odoo-version 17.0 --skip-init --skip-dns --skip-tls
```

## Paso 6 — Verifica

```bash
soit instance list
soit instance status odoo18
soit stack health --wait --check
curl -I https://odoo18.example.com
```

Deberías ver el stack `odoo18`, el contenedor Odoo healthy y una respuesta
HTTP del dominio. Si `curl` devuelve `502`, revisa
[Troubleshooting: Odoo 20 devuelve 502](Troubleshooting#odoo-20-devuelve-502-o-no-acepta-conexiones).

## Actualizar SOIT

`soit upgrade` actualiza **solo el binario** desde GitHub Releases. No
confundirlo con `soit update`, que actualiza las imágenes Docker de la
infraestructura y los stacks.

```bash
soit upgrade --check        # exit 3 si hay una versión estable más nueva
soit upgrade                # descarga, verifica SHA-256 y reemplaza
soit upgrade --dry-run      # muestra versión y asset sin escribir
soit upgrade --prerelease   # incluye release candidates
soit upgrade --version v0.1.0
sudo soit upgrade           # si el binario está en /usr/local/bin
```

La release debe publicar `checksums.txt`; si falta o el SHA-256 no coincide,
la actualización se aborta. El binario se resuelve a través de symlinks y se
reemplaza con un rename atómico. El alias `soit self-update` es equivalente.

Variables opcionales:

| Variable | Uso |
| --- | --- |
| `GITHUB_TOKEN` / `SOIT_GITHUB_TOKEN` | Subir el rate limit de la API de GitHub. |
| `SOIT_UPDATE_REPO` | Repositorio alternativo `owner/name` (default `mjavint/soit`). |
| `SOIT_UPDATE_API_URL` | API alternativa (GitHub Enterprise o tests). |

## Autocompletado del shell

```bash
# Bash
soit completion bash > /etc/bash_completion.d/soit

# Zsh (en una ruta de tu $fpath)
soit completion zsh > "${fpath[1]}/_soit"

# Fish
soit completion fish > ~/.config/fish/completions/soit.fish
```

`soit completion` es el único comando que acepta `-o plain` además de la tabla
por defecto.

## Siguiente paso

- [Instancias Odoo](Instancias-Odoo): flags, inicialización y diagnóstico.
- [Infraestructura](Infraestructura): ciclo de vida y actualización de imágenes.
- [Bases de datos y restore](Bases-de-Datos-y-Restore): restaurar un backup.
- [TLS y certificados](TLS-y-Certificados): emisión, renovación y timer.
- [Operación y runbook](Operacion-y-Runbook): rutinas de producción.
