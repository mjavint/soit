(function () {
  "use strict";

  var root = document.documentElement;
  var body = document.body;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Theme ----------------------------------------------------------------- */

  var themeToggle = document.querySelector("[data-theme-toggle]");

  function systemTheme() {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function currentTheme() {
    return root.dataset.theme === "light" || root.dataset.theme === "dark"
      ? root.dataset.theme
      : systemTheme();
  }

  function updateThemeLabel() {
    if (!themeToggle) return;
    var next = currentTheme() === "dark" ? "claro" : "oscuro";
    themeToggle.setAttribute("aria-label", "Cambiar a tema " + next);
    themeToggle.setAttribute("title", "Cambiar a tema " + next);
  }

  if (themeToggle) {
    updateThemeLabel();
    themeToggle.addEventListener("click", function () {
      var next = currentTheme() === "dark" ? "light" : "dark";
      root.dataset.theme = next;
      try {
        localStorage.setItem("soit-theme", next);
      } catch (error) {
        /* Ignore unavailable storage. */
      }
      updateThemeLabel();
    });
  }

  var themeQuery = window.matchMedia("(prefers-color-scheme: dark)");
  if (themeQuery.addEventListener) {
    themeQuery.addEventListener("change", function () {
      if (!root.dataset.theme) updateThemeLabel();
    });
  }

  /* Mobile navigation ----------------------------------------------------- */

  var navToggle = document.querySelector("[data-nav-toggle]");
  var sidebar = document.getElementById("docs-sidebar");
  var overlay = document.querySelector("[data-nav-close]");
  var mobileQuery = window.matchMedia("(max-width: 980px)");

  function setNav(open) {
    if (!navToggle || !sidebar) return;
    body.classList.toggle("nav-open", open);
    navToggle.setAttribute("aria-expanded", String(open));
    if (overlay) overlay.hidden = !open;
    syncSidebarAccessibility();
  }

  function syncSidebarAccessibility() {
    if (!sidebar) return;
    var hidden = mobileQuery.matches && !body.classList.contains("nav-open");
    if (hidden) {
      sidebar.setAttribute("inert", "");
    } else {
      sidebar.removeAttribute("inert");
    }
  }

  if (navToggle && sidebar) {
    navToggle.addEventListener("click", function () {
      setNav(!body.classList.contains("nav-open"));
    });
  }

  if (overlay) {
    overlay.addEventListener("click", function () {
      setNav(false);
    });
  }

  if (sidebar) {
    sidebar.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        if (mobileQuery.matches) setNav(false);
      });
    });
  }

  if (mobileQuery.addEventListener) {
    mobileQuery.addEventListener("change", function () {
      setNav(false);
    });
  }

  syncSidebarAccessibility();

  /* Table of contents ----------------------------------------------------- */

  var toc = document.getElementById("page-toc");
  var content = document.querySelector(".content");

  function slugify(text) {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function buildToc() {
    if (!toc || !content) return;

    var headings = Array.prototype.slice.call(content.querySelectorAll("h2, h3"));
    if (headings.length === 0) return;

    var list = document.createElement("ul");

    headings.forEach(function (heading, index) {
      if (!heading.id) {
        var base = slugify(heading.textContent) || "seccion";
        var candidate = base;
        var suffix = 2;
        while (document.getElementById(candidate)) {
          candidate = base + "-" + suffix;
          suffix += 1;
        }
        heading.id = candidate;
      }

      var item = document.createElement("li");
      var link = document.createElement("a");
      link.href = "#" + heading.id;
      link.textContent = heading.textContent.trim();
      link.dataset.target = heading.id;
      if (heading.tagName === "H3") link.classList.add("level-3");
      item.appendChild(link);
      list.appendChild(item);
    });

    toc.replaceChildren(list);

    var links = Array.prototype.slice.call(toc.querySelectorAll("a"));
    var ticking = false;

    function setActive(id) {
      links.forEach(function (link) {
        var active = link.dataset.target === id;
        link.classList.toggle("active", active);
        if (active) {
          link.setAttribute("aria-current", "true");
        } else {
          link.removeAttribute("aria-current");
        }
      });
    }

    function updateActive() {
      ticking = false;
      var current = headings[0];
      var threshold = 130;
      headings.forEach(function (heading) {
        if (heading.getBoundingClientRect().top <= threshold) current = heading;
      });
      if (current) setActive(current.id);
    }

    function requestUpdate() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(updateActive);
    }

    links.forEach(function (link) {
      link.addEventListener("click", function () {
        setActive(link.dataset.target);
      });
    });

    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate, { passive: true });
    updateActive();
  }

  buildToc();

  /* Heading anchors ------------------------------------------------------- */

  if (content) {
    content.querySelectorAll("h2, h3").forEach(function (heading) {
      if (!heading.id) return;
      var anchor = document.createElement("a");
      anchor.className = "heading-anchor";
      anchor.href = "#" + heading.id;
      anchor.setAttribute("aria-label", "Enlace a esta sección");
      anchor.setAttribute("data-pagefind-ignore", "");
      anchor.textContent = "#";
      heading.appendChild(anchor);
    });
  }

  /* Code blocks ----------------------------------------------------------- */

  function copyText(text, onSuccess, onFailure) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(onSuccess).catch(onFailure);
      return;
    }

    var textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand("copy") ? onSuccess() : onFailure();
    } catch (error) {
      onFailure();
    } finally {
      document.body.removeChild(textarea);
    }
  }

  if (content) {
    content.querySelectorAll("pre").forEach(function (pre) {
      if (pre.closest(".code-block")) return;

      var wrapper = pre.closest(".highlighter-rouge") || pre.parentElement;
      if (!wrapper) return;

      if (wrapper === pre.parentElement && wrapper.tagName === "DIV" && wrapper.classList.contains("highlight")) {
        wrapper = wrapper.parentElement || wrapper;
      }

      wrapper.classList.add("code-block");

      var language = "text";
      var match = (wrapper.className + " " + pre.className).match(/language-([a-z0-9_+-]+)/i);
      if (match) language = match[1];

      var header = document.createElement("div");
      header.className = "code-header";
      header.setAttribute("data-pagefind-ignore", "");

      var label = document.createElement("span");
      label.className = "code-language";
      label.textContent = language;

      var button = document.createElement("button");
      button.type = "button";
      button.className = "copy-button";
      button.textContent = "Copiar";
      button.setAttribute("aria-label", "Copiar bloque de código");

      button.addEventListener("click", function () {
        var code = pre.querySelector("code");
        var text = code ? code.innerText : pre.innerText;
        copyText(text, function () {
          button.textContent = "Copiado";
          button.classList.add("is-copied");
          window.setTimeout(function () {
            button.textContent = "Copiar";
            button.classList.remove("is-copied");
          }, 1600);
        }, function () {
          button.textContent = "No disponible";
          window.setTimeout(function () {
            button.textContent = "Copiar";
          }, 1600);
        });
      });

      header.appendChild(label);
      header.appendChild(button);
      wrapper.insertBefore(header, wrapper.firstChild);
    });
  }

  /* Responsive tables ----------------------------------------------------- */

  if (content) {
    content.querySelectorAll("table").forEach(function (table) {
      if (table.closest(".table-wrap")) return;
      var wrap = document.createElement("div");
      wrap.className = "table-wrap";
      wrap.setAttribute("tabindex", "0");
      wrap.setAttribute("role", "region");
      wrap.setAttribute("aria-label", "Tabla con desplazamiento horizontal");
      table.parentNode.insertBefore(wrap, table);
      wrap.appendChild(table);
    });
  }

  /* Search ---------------------------------------------------------------- */

  var searchDialog = document.getElementById("search-dialog");
  var searchOpenButton = document.querySelector("[data-search-open]");
  var searchCloseButton = document.querySelector("[data-search-close]");
  var searchResults = document.querySelector("[data-search-results]");
  var searchKbd = document.querySelector("[data-search-kbd]");
  var pagefindPromise = null;
  var searchInitialized = false;

  var isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
  if (searchKbd) searchKbd.textContent = isMac ? "⌘K" : "Ctrl K";

  function withTrailingSlash(value) {
    return value.endsWith("/") ? value : value + "/";
  }

  function searchBundle() {
    var bundle = searchDialog ? searchDialog.dataset.searchBundle : "/pagefind/";
    return withTrailingSlash(bundle || "/pagefind/");
  }

  function searchSiteBase() {
    var base = searchDialog ? searchDialog.dataset.searchBase : "/";
    return withTrailingSlash(base || "/");
  }

  function fixSearchUrl(url) {
    if (!url) return url;
    if (/^https?:\/\//i.test(url) || url.charAt(0) === "#") return url;

    var base = searchSiteBase();
    if (url.indexOf(base) === 0) return url;
    if (url.charAt(0) === "/") return base + url.slice(1);
    return base + url;
  }

  function fixSearchResult(result) {
    if (!result) return result;
    result.url = fixSearchUrl(result.url);
    if (Array.isArray(result.sub_results)) {
      result.sub_results.forEach(function (subResult) {
        subResult.url = fixSearchUrl(subResult.url);
      });
    }
    return result;
  }

  function loadPagefind() {
    if (window.PagefindUI) return Promise.resolve();
    if (pagefindPromise) return pagefindPromise;

    pagefindPromise = new Promise(function (resolve, reject) {
      var base = searchBundle();

      var stylesheet = document.createElement("link");
      stylesheet.rel = "stylesheet";
      stylesheet.href = base + "pagefind-ui.css";
      document.head.appendChild(stylesheet);

      var script = document.createElement("script");
      script.src = base + "pagefind-ui.js";
      script.async = true;
      script.onload = function () {
        if (window.PagefindUI) resolve();
        else reject(new Error("PagefindUI no está disponible"));
      };
      script.onerror = function () {
        reject(new Error("No se pudo cargar Pagefind"));
      };
      document.head.appendChild(script);
    });

    return pagefindPromise;
  }

  function initPagefind() {
    if (searchInitialized || !window.PagefindUI || !searchResults) return;
    searchInitialized = true;

    new window.PagefindUI({
      element: "#search",
      bundlePath: searchBundle(),
      showSubResults: true,
      showImages: false,
      resetStyles: false,
      autofocus: true,
      pageSize: 8,
      excerptLength: 20,
      translations: {
        placeholder: "Buscar comandos, errores o guías…",
        clear_search: "Limpiar",
        load_more: "Cargar más resultados",
        search_label: "Buscar en la documentación",
        filters_label: "Filtros",
        zero_results: "No se encontraron resultados para [SEARCH_TERM]",
        many_results: "[COUNT] resultados para [SEARCH_TERM]",
        one_result: "[COUNT] resultado para [SEARCH_TERM]",
        alt_search: "No se encontraron resultados para [SEARCH_TERM]. Mostrando resultados para [DIFFERENT_TERM]",
        search_suggestion: "No se encontraron resultados para [SEARCH_TERM]. Prueba con otra búsqueda.",
        searching: "Buscando [SEARCH_TERM]…"
      },
      processResult: fixSearchResult
    });
  }

  function showSearchUnavailable() {
    if (!searchResults) return;
    searchResults.innerHTML =
      '<p class="search-unavailable">La búsqueda no está disponible en esta vista local. ' +
      "El índice se genera al compilar el sitio con Pagefind.</p>";
  }

  function openSearch() {
    if (!searchDialog) return;
    if (searchDialog.open) {
      var existingInput = searchDialog.querySelector("input[type='search'], input");
      if (existingInput) existingInput.focus();
      return;
    }
    if (typeof searchDialog.showModal === "function") {
      searchDialog.showModal();
    } else {
      searchDialog.setAttribute("open", "");
    }
    body.classList.add("search-open");

    loadPagefind()
      .then(initPagefind)
      .catch(showSearchUnavailable)
      .finally(function () {
        var input = searchDialog.querySelector("input[type='search'], input");
        if (input) input.focus();
      });
  }

  function closeSearch() {
    if (!searchDialog) return;
    if (typeof searchDialog.close === "function") {
      searchDialog.close();
    } else {
      searchDialog.removeAttribute("open");
    }
  }

  if (searchOpenButton) {
    searchOpenButton.addEventListener("click", openSearch);
  }

  if (searchCloseButton) {
    searchCloseButton.addEventListener("click", closeSearch);
  }

  if (searchDialog) {
    searchDialog.addEventListener("click", function (event) {
      if (event.target === searchDialog) closeSearch();
    });

    searchDialog.addEventListener("close", function () {
      body.classList.remove("search-open");
      if (searchOpenButton) searchOpenButton.focus();
    });
  }

  function isEditable(target) {
    if (!target) return false;
    var tag = target.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
  }

  document.addEventListener("keydown", function (event) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      openSearch();
      return;
    }

    if (event.key === "/" && !isEditable(event.target)) {
      event.preventDefault();
      openSearch();
      return;
    }

    if (event.key === "Escape" && searchDialog && searchDialog.open) {
      closeSearch();
    }
  });

  /* Back to top ----------------------------------------------------------- */

  var backToTop = document.querySelector("[data-back-to-top]");

  if (backToTop) {
    function updateBackToTop() {
      backToTop.classList.toggle("is-visible", window.scrollY > 600);
    }

    backToTop.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    });

    window.addEventListener("scroll", updateBackToTop, { passive: true });
    updateBackToTop();
  }

  /* External links -------------------------------------------------------- */

  document.querySelectorAll("a[target='_blank']").forEach(function (link) {
    var rel = link.getAttribute("rel") || "";
    if (rel.indexOf("noopener") === -1) {
      link.setAttribute("rel", (rel + " noopener noreferrer").trim());
    }
  });
})();
