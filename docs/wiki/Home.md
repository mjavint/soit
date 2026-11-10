<div class="hero">
  <p class="hero-eyebrow">Secure Odoo Infra Tools</p>
  <h1>SOIT en 5 minutos</h1>
  <p>
    SOIT es un binario Go para instalar, operar y diagnosticar una
    infraestructura Docker de Odoo: PostgreSQL, nginx, certbot y uno o varios
    stacks. Esta documentación está pensada para que puedas seguir una tarea
    de principio a fin, sin perderte entre flags y conceptos.
  </p>
  <div class="hero-actions">
    <a class="button button-primary" href="{{ '/Instalacion-y-Primeros-Pasos.html' | relative_url }}">Empezar desde cero →</a>
    <a class="button" href="{{ '/Guia-de-uso.html' | relative_url }}">Ver todas las funcionalidades</a>
  </div>
</div>

## ¿Qué quieres hacer?

<div class="route-grid">
  <a class="route-card" href="{{ '/Instalacion-y-Primeros-Pasos.html' | relative_url }}">
    <strong>Instalar SOIT</strong>
    <span>Descargar el binario, verificarlo y dejarlo en el PATH.</span>
    <span class="route-card-command">soit install</span>
  </a>
  <a class="route-card" href="{{ '/Instancias-Odoo.html' | relative_url }}">
    <strong>Crear una instancia Odoo</strong>
    <span>DNS, stack, base de datos, TLS y primera verificación.</span>
    <span class="route-card-command">soit instance create</span>
  </a>
  <a class="route-card" href="{{ '/Bases-de-Datos-y-Restore.html' | relative_url }}">
    <strong>Restaurar un backup</strong>
    <span>Restaurar dump + filestore en una instancia nueva o existente.</span>
    <span class="route-card-command">soit db restore</span>
  </a>
  <a class="route-card" href="{{ '/Troubleshooting.html' | relative_url }}">
    <strong>Diagnosticar un problema</strong>
    <span>502, errores de inicialización, DNS, certificados o contenedores.</span>
    <span class="route-card-command">soit doctor</span>
  </a>
</div>

## Ruta rápida

Si ya tienes Docker y un dominio apuntando al servidor:

```bash
# 1. Instala el binario en un directorio del PATH
soit install

# 2. Crea la raíz de infraestructura y revisa la configuración
soit infra init ./odoo-infra
cd odoo-infra
soit config validate

# 3. Arranca PostgreSQL, nginx y certbot
soit infra up

# 4. Crea la primera instancia Odoo
soit instance create odoo18.example.com --odoo-version 18.0

# 5. Verifica
soit instance status odoo18
curl -I https://odoo18.example.com
```

> **Resultado esperado:** `soit instance status` muestra el stack `odoo18` y
> `curl -I` devuelve un `HTTP/2 200` o una redirección al login de Odoo.

Si algo no encaja, empieza por [Primeros pasos](Instalacion-y-Primeros-Pasos),
que explica cada comando, sus requisitos y cómo comprobar el resultado.

## Conceptos clave

<div class="concept-grid">
  <div class="concept-card">
    <strong>Raíz de infraestructura</strong>
    <span>Directorio con <code>docker-compose.infra.yml</code>, <code>.env</code> y <code>stacks/</code>.</span>
  </div>
  <div class="concept-card">
    <strong>Stack</strong>
    <span>Un compose de Odoo con su base de datos, <code>odoo.conf</code>, datos y addons.</span>
  </div>
  <div class="concept-card">
    <strong>Instancia</strong>
    <span>La combinación de un stack, una base de datos, un sitio nginx y un certificado.</span>
  </div>
  <div class="concept-card">
    <strong>Infraestructura</strong>
    <span>Los servicios compartidos: PostgreSQL, nginx y certbot.</span>
  </div>
  <div class="concept-card">
    <strong>Servicio nginx</strong>
    <span>Un sitio TLS que apunta a un backend como pgadmin, portainer o una app.</span>
  </div>
  <div class="concept-card">
    <strong>Binario vs. imágenes</strong>
    <span><code>soit upgrade</code> actualiza SOIT; <code>soit update</code> actualiza imágenes Docker.</span>
  </div>
</div>

## Cómo leer esta documentación

| Si necesitas… | Empieza por… |
| --- | --- |
| Instalar y crear tu primera instancia | [Primeros pasos](Instalacion-y-Primeros-Pasos) |
| Saber qué comando usar para una tarea | [Guía de uso](Guia-de-uso) |
| Operar el día a día | [Operación y runbook](Operacion-y-Runbook) |
| Resolver un error concreto | [Troubleshooting](Troubleshooting) |
| Consultar flags y variables | [Referencia de comandos](Referencia-de-Comandos) y [Configuración](Configuracion) |
| Entender cómo está construido SOIT | [Arquitectura](Arquitectura) |

## Plataformas soportadas

- Linux y macOS, `amd64` y `arm64`.
- Docker Engine o Docker Desktop con el plugin `docker compose`.
- Windows no se publica en releases ni se prueba en CI.
- No hacen falta `dig`, `date -d`, `xargs -r`, `tac` ni `rsync`.

## Fuentes de verdad

1. `soit <comando> --help`: sintaxis y flags exactos de la versión instalada.
2. [`USAGE.md`](https://github.com/mjavint/soit/blob/main/USAGE.md): referencia
   exhaustiva de argumentos y defaults.
3. Esta wiki: flujos, operación, diagnóstico y decisiones de diseño.
4. El código: `internal/cli`, `internal/instance`, `internal/runner`, etc.
