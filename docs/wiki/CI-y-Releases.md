# CI y releases

SOIT se distribuye como binario único para Linux y macOS. Windows no se
compila en CI ni se publica en releases.

## Plataformas soportadas

| OS | Arquitecturas | Estado |
| --- | --- | --- |
| Linux | `amd64`, `arm64` | Soportado y publicado. |
| macOS | `amd64`, `arm64` | Soportado y publicado. |
| Windows | — | **No soportado** en CI/releases. El código fuente puede compilar, pero no hay binarios ni pruebas. |

Los binarios se construyen con `CGO_ENABLED=0`, `-trimpath` y `-s -w`.

## CI

`.github/workflows/ci.yml` se ejecuta en:

- `push` a `main`,
- `push` de tags `v*`,
- `pull_request`.

### Job `test`

Matriz:

```yaml
os: [ubuntu-latest, macos-latest]
```

Pasos:

```bash
go version
go build ./...
go vet ./...
go test -race ./...
```

La versión de Go se toma de `go.mod` (`go 1.27.3`). `actions/setup-go` con
`go-version-file` y caché acelera las ejecuciones.

### Job `smoke`

Matriz Linux/macOS. Compila con `-ldflags` (versión, commit y fecha), instala
el binario en un directorio temporal y comprueba:

```bash
soit install --dir "$RUNNER_TEMP/soit-install"
soit version
soit --dry-run install --dir "$RUNNER_TEMP/soit-dry"
soit install --help
soit upgrade --help
soit self-update --help
```

Así se valida que `install` no depende de la red ni de la infraestructura y
que los comandos nuevos están registrados en el árbol de Cobra.

### Job `cross-build`

Compila `linux/amd64`, `linux/arm64`, `darwin/amd64` y `darwin/arm64` con
`CGO_ENABLED=0`. Es la misma matriz que publica GoReleaser y detecta imports
específicos de plataforma (por ejemplo, `syscall.Stat_t` en el reemplazo
atómico del binario).

### Job `vuln`

En Ubuntu:

```bash
go install golang.org/x/vuln/cmd/govulncheck@latest
govulncheck ./...
```

### Job `release`

Solo en tags `v*`, después de `test`, `smoke`, `cross-build` y `vuln`:

```yaml
if: startsWith(github.ref, 'refs/tags/v')
needs: [test, smoke, cross-build, vuln]
permissions:
  contents: write
```

Usa `goreleaser/goreleaser-action@v6` con `release --clean` y
`GITHUB_TOKEN`. Después verifica que `dist/checksums.txt` exista, que los
archivos `tar.gz` contengan el binario `soit` en la raíz y que
`sha256sum -c checksums.txt --ignore-missing` pase. Esto protege el contrato
que consume `soit upgrade`.

## GoReleaser

`.goreleaser.yaml` (v2) define:

- `project_name: soit`
- `before.hooks`: `go mod tidy`, `go test ./...`
- `builds`: `linux`/`darwin` × `amd64`/`arm64`
- `archives`: `tar.gz` con `README.md`, `USAGE.md`, `Makefile`
- `checksum`: `checksums.txt` (SHA-256)
- `snapshot.version_template`: `{{ incpatch .Version }}-next`
- `changelog`: excluye `docs:`, `test:`, `chore:`
- `release`: draft `false`, prerelease automático

Nombres de archivo:

```text
soit_<version>_linux_amd64.tar.gz
soit_<version>_linux_arm64.tar.gz
soit_<version>_darwin_amd64.tar.gz
soit_<version>_darwin_arm64.tar.gz
checksums.txt
```

## Versión inyectada

`make build` y GoReleaser pasan:

```text
-X main.version=<version>
-X main.commit=<commit>
-X main.date=<date>
```

`soit version` y `soit --version` muestran esos valores. Una compilación
manual sin `-ldflags` muestra `dev`.

## Desarrollo local

```bash
make build              # ./bin/soit
make test               # go test ./...
make test-race          # go test -race ./...
make vet                # go vet ./...
make lint               # golangci-lint
make vuln               # govulncheck
make release-snapshot   # goreleaser release --snapshot --clean
```

`make release-snapshot` requiere `goreleaser` en `PATH`:

```bash
go install github.com/goreleaser/goreleaser/v2@latest
```

El snapshot genera artefactos en `dist/` sin publicar nada.

## Publicar una release

```bash
# 1. Asegura main verde
git checkout main
git pull

# 2. Crea y publica el tag
git tag v0.1.0
git push origin v0.1.0
```

El push del tag dispara CI y, si `test` y `vuln` pasan, GoReleaser publica
los archivos y `checksums.txt` en GitHub Releases.

Checklist:

- [ ] `go build ./...`, `go vet ./...`, `go test -race ./...` pasan.
- [ ] `goreleaser check` pasa.
- [ ] El changelog no incluye commits internos innecesarios.
- [ ] El tag es semver (`vMAJOR.MINOR.PATCH`).
- [ ] El release incluye Linux/macOS amd64/arm64 y checksums.
- [ ] `README.md`/`USAGE.md` reflejan los cambios de comportamiento.

## Reintentar una release fallida

Si el job `release` falló (por ejemplo, por un error de configuración de
GoReleaser), tienes dos opciones:

1. **Nuevo tag** (recomendado): corrige, commitea y publica `v0.1.1`.
2. **Mover el tag** (solo si nadie consumió la release):
   ```bash
   git tag -f v0.1.0
   git push -f origin v0.1.0
   ```
   Esto reescribe historia pública; úsalo con cuidado.

No muevas un tag si ya hay usuarios o artefactos descargados. Es mejor un
tag nuevo.

## Instalar desde un release

```bash
sha256sum -c checksums.txt --ignore-missing
tar -xzf soit_<version>_<os>_<arch>.tar.gz
sudo install -m 0755 soit /usr/local/bin/soit
soit version
```

En macOS usa `shasum -a 256`.

También puedes extraer el binario y usar el propio SOIT para instalarlo:

```bash
tar -xzf soit_<version>_<os>_<arch>.tar.gz
./soit install --dir ~/.local/bin
```

## Actualizar el binario

`soit upgrade` consume exactamente los assets que produce GoReleaser:

1. Resuelve la última release estable (`/releases/latest`) o la indicada con
   `--version`; `--prerelease` usa la lista de releases.
2. Elige `soit_<version>_<os>_<arch>.tar.gz` según `runtime.GOOS/GOARCH`.
3. Descarga `checksums.txt` y el asset; verifica el SHA-256 (obligatorio).
4. Extrae `soit` del `tar.gz` sin escribir rutas del archivo.
5. Resuelve symlinks del binario en ejecución y hace un rename atómico en el
   mismo directorio.

```bash
soit upgrade --check
soit upgrade
soit upgrade --dry-run
soit upgrade --prerelease
sudo soit upgrade
```

El alias `soit self-update` es equivalente. `soit update` sigue siendo el
actualizador agregado de imágenes Docker; no cambia el binario.

Variables: `GITHUB_TOKEN`/`SOIT_GITHUB_TOKEN` (rate limit),
`SOIT_UPDATE_REPO` (`owner/name`) y `SOIT_UPDATE_API_URL` (GitHub Enterprise o
tests).

## Notas de compatibilidad

- Los binarios son estáticos (`CGO_ENABLED=0`); no dependen de libc.
- Linux `arm64` y macOS `arm64` (Apple Silicon) están soportados.
- No se publican binarios Windows; si los necesitas, compila desde fuente
  bajo tu propio riesgo.
- La wiki y `USAGE.md` se actualizan en el repositorio; los releases incluyen
  `README.md`, `USAGE.md` y `Makefile` en el archivo.

## Ver también

- [Arquitectura](Arquitectura)
- [Instalación y primeros pasos](Instalacion-y-Primeros-Pasos)
- [Novedades](Novedades)
