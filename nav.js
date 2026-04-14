(() => {
  const pages = [
    { href: 'index.html',      label: 'Home' },
    { href: 'commands.html',   label: 'Commands' },
    { href: 'subnetting.html', label: 'Subnetting' },
    { href: 'explainer.html',  label: 'Config Explainer' },
    { href: 'guides.html',     label: 'PT Guides' },
    { href: 'quiz.html',       label: 'Quiz' },
  ];

  const current = window.location.pathname.split('/').pop() || 'index.html';

  const nav = document.createElement('nav');
  nav.innerHTML = `
    <a class="nav-logo" href="index.html">Cisco<span>Learn</span></a>
    <div class="nav-links">
      ${pages.map(p => `<a href="${p.href}" class="${p.href === current ? 'active' : ''}">${p.label}</a>`).join('')}
    </div>
  `;
  document.body.prepend(nav);
})();
