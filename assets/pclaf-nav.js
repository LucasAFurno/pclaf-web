(function () {
  const nav = document.createElement('nav');
  nav.className = 'pclaf-standard-nav';
  nav.setAttribute('aria-label', 'Navegación principal');
  const root = location.pathname.replace(/\\/g, '/').split('/').pop() || 'index.html';
  const link = (href, label) => `<a href="${href}"${root === href ? ' aria-current="page"' : ''}>${label}</a>`;
  nav.innerHTML = `<div class="pclaf-standard-nav__inner"><a class="pclaf-standard-nav__brand" href="index.html" aria-label="PCLAF, inicio"><span class="brand-mark">P<span>/</span>F</span><span class="brand-copy"><strong>PCLAF</strong><small>TECNOLOGÍA SIN VUELTAS</small></span></a><div class="pclaf-standard-nav__primary">${link('service-tecnico-pc-flores-floresta.html','Soporte')}${link('diseno-web.html','Web')}${link('precios.html','Precios')}${link('ubicacion.html','Dónde estamos')}</div><a class="pclaf-nav-cta" href="turnos.html">Reservar turno <span>↗</span></a></div>`;
  const existing = document.querySelector('body > nav, body > .topbar, body > header.topbar, body > header.top, body > header.nav');
  if (existing) existing.replaceWith(nav); else document.body.prepend(nav);
  document.body.classList.add('pclaf-nav-enabled');
})();
