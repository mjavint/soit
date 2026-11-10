# SOIT — Secure Odoo Infra Tools

Este repositorio público distribuye **SOIT**: binarios de release, checksums y documentación.

- **Descargas y releases:** [GitHub Releases](https://github.com/mjavint/soit/releases)
- **Documentación:** https://mjavint.github.io/soit/
- **Guía de uso:** [USAGE.md](USAGE.md)

## Instalación

Descarga el archivo de tu plataforma desde [Releases](https://github.com/mjavint/soit/releases), verifica el checksum y coloca el binario en tu `PATH`:

```bash
sha256sum -c checksums.txt --ignore-missing
tar -xzf soit_<version>_<os>_<arch>.tar.gz
sudo install -m 0755 soit /usr/local/bin/soit
soit version
```

Plataformas soportadas: Linux y macOS (`amd64`, `arm64`).

## Actualización

```bash
soit upgrade --check
soit upgrade
```

`soit upgrade` actualiza el binario desde las releases publicadas en este repositorio y verifica el SHA-256 contra `checksums.txt`.

> El código fuente de SOIT se mantiene en un repositorio privado.
