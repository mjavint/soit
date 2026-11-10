# Wiki de SOIT

Esta carpeta contiene la documentación pública de SOIT. Se publica en
**GitHub Pages** desde `docs/wiki/` y también puede copiarse a la **GitHub
Wiki** del repositorio.

## Índice para lectura en el repositorio

### Empezar

- [Home](Home.md)
- [Primeros pasos](Instalacion-y-Primeros-Pasos.md)
- [Guía de uso](Guia-de-uso.md)
- [Preguntas frecuentes](Preguntas-Frecuentes.md)

### Guías

- [Infraestructura](Infraestructura.md)
- [Instancias Odoo](Instancias-Odoo.md)
- [Stacks y servicios](Stacks-y-Servicios.md)
- [Bases de datos y restore](Bases-de-Datos-y-Restore.md)
- [Backups](Backups.md)
- [TLS y certificados](TLS-y-Certificados.md)

### Referencia

- [Referencia de comandos](Referencia-de-Comandos.md)
- [Configuración](Configuracion.md)
- [Arquitectura](Arquitectura.md)
- [CI y releases](CI-y-Releases.md)
- [Migración y alias](Migracion-y-Alias.md)

### Operación

- [Operación y runbook](Operacion-y-Runbook.md)
- [Troubleshooting](Troubleshooting.md)
- [Notas de versión](Novedades.md)

## Publicar en GitHub Pages

La wiki se despliega con `.github/workflows/wiki-pages.yml`. El workflow
construye `docs/wiki/` con Jekyll y genera el índice de búsqueda con Pagefind:

```bash
jekyll build --source docs/wiki --destination _site
npx --yes pagefind@1.6.0 --site _site
```

Para desplegar:

1. Sube cambios a `main` que toquen `docs/wiki/**`.
2. O ejecuta el workflow manualmente desde **Actions → wiki-pages → Run workflow**.
3. En **Settings → Pages**, selecciona **GitHub Actions** como origen.

Sitio publicado: `https://mjavint.github.io/soit/`

## Publicar en GitHub Wiki

GitHub mantiene la wiki en un repositorio Git separado. Para publicar esta
documentación:

```bash
# 1. Clonar el repositorio de la wiki
git clone https://github.com/mjavint/soit.wiki.git
cd soit.wiki

# 2. Copiar las páginas y el sidebar
cp /ruta/a/soit/docs/wiki/*.md .
rm -f README.md

# 3. Revisar y publicar
git add .
git commit -m "docs: actualizar wiki de SOIT"
git push origin master
```

Notas:

- En GitHub Wiki, `Home.md` es la portada y `_Sidebar.md` la barra lateral.
- La navegación y el diseño visual enriquecido pertenecen a GitHub Pages;
  en GitHub Wiki se conserva el contenido Markdown.
- `README.md` no se copia a la wiki.
- Si renombras o añades una página, actualiza `_Sidebar.md`,
  `docs/wiki/_data/navigation.yml` y los enlaces entrantes.

## Convenciones de contenido

- Las guías se escriben paso a paso: objetivo, requisitos, pasos, resultado
  esperado, verificación y errores comunes.
- `Novedades.md` es histórico (notas de versión), no la introducción de una
  funcionalidad.
- Los comandos y flags se escriben en bloques `bash` o `text`.
- Los ejemplos usan dominios `example.com`; reemplázalos por los reales.
- Las advertencias destructivas van marcadas con **⚠️**.
- La fuente de verdad de flags es `soit <comando> --help`; si esta wiki y el
  binario difieren, gana el binario.
