/* ==========================================================================
   DocEasy Core — Auto-injects header + footer + theme toggle on every page.
   Made with ❤️ by Deepaak Kumar · https://deepaakai.github.io/portfolio/
   ========================================================================== */
(function () {
  'use strict';

  /* ---------- Early theme restore ---------- */
  try {
    var saved = localStorage.getItem('doceasy_theme') || 'light';
    if (saved === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');
  } catch (e) {}

  /* ========================================================================
     CONFIG — Edit here, everything updates everywhere.
     ======================================================================== */
  var CONFIG = {
    brand: 'DocEasy',
    domain: 'doceasy.org',
    author: 'Deepaak Kumar',
    authorPortfolio: 'https://deepaakai.github.io/portfolio/',
    isSubPage: location.pathname.indexOf('/tools/') !== -1,

    // Floating pill navigation (like Doclio's center nav)
    pillNav: [
      { href: '#tools',     label: 'Tools' },
      { href: '#ai',        label: 'AI Tools' },
      { href: '#templates', label: 'Templates' },
      { href: '#features',  label: 'Why DocEasy' },
      { href: '#faq',       label: 'FAQ' },
      { href: '#blog',      label: 'Blog' }
    ],

    topNav: [
      { href: 'jpg-to-pdf.html',        label: 'JPG to PDF',       page: 'jpg-to-pdf' },
      { href: 'pdf-editor.html',        label: 'PDF Editor',       page: 'pdf-editor' },
      { href: 'pdf-merge.html',         label: 'Merge PDF',        page: 'pdf-merge' },
      { href: 'image-compressor.html',  label: 'Image Compressor', page: 'image-compressor' },
      { href: 'passport-maker.html',    label: 'Passport Photo',   page: 'passport-maker' },
      { href: 'invoice-generator.html', label: 'Invoice',          page: 'invoice-generator' }
    ],

    footer: {
      pdfTools: [
        { href: 'pdf-editor.html',      label: 'Edit PDF' },
        { href: 'pdf-merge.html',       label: 'Merge PDF' },
        { href: 'pdf-split.html',       label: 'Split PDF' },
        { href: 'jpg-to-pdf.html',      label: 'JPG to PDF' },
        { href: 'pdf-to-jpg.html',      label: 'PDF to JPG' },
        { href: 'image-converter.html', label: 'Format Converter' }
      ],
      imageTools: [
        { href: 'image-compressor.html',      label: 'Compress Image' },
        { href: 'image-bg-remover.html',      label: 'Background Remover' },
        { href: 'image-beautifier.html',      label: 'AI Photo Beautifier' },
        { href: 'signature-resize.html',      label: 'Signature Resize' },
        { href: 'signature-bg-remover.html',  label: 'Signature BG Remover' },
        { href: 'card-cropper.html',          label: 'ID Card Cropper' }
      ],
      company: [
        { href: 'about.html',    label: 'About Us',           root: true },
        { href: 'contact.html',  label: 'Contact',            root: true },
        { href: 'privacy.html',  label: 'Privacy Policy',     root: true },
        { href: 'terms.html',    label: 'Terms & Conditions', root: true }
      ]
    }
  };

  /* ---------- Path resolver ---------- */
  function resolvePath(href, isRoot) {
    if (!href) return '#';
    if (/^https?:\/\//.test(href) || href.charAt(0) === '#') return href;
    if (!isRoot && CONFIG.isSubPage) return href;
    if (isRoot && CONFIG.isSubPage) return '../' + href;
    if (!isRoot && !CONFIG.isSubPage && /\.html$/.test(href)) {
      var TOOL_PAGES = [
        'image-compressor','signature-resize','image-bg-remover','image-converter',
        'image-beautifier','invoice-generator','pdf-merge','pdf-split','jpg-to-pdf',
        'pdf-to-jpg','doc-scanner','card-cropper','passport-maker','signature-bg-remover',
        'pdf-editor','qr-generator','qr-scanner','word-counter'
      ];
      var name = href.replace('.html', '');
      if (TOOL_PAGES.indexOf(name) !== -1) return 'tools/' + href;
    }
    return href;
  }

  /* ---------- Header (Doclio-style: floating pill nav + search) ---------- */
  function buildHeader() {
    var pillLinks = CONFIG.pillNav.map(function (item) {
      return '<a href="' + item.href + '">' + item.label + '</a>';
    }).join('');

    var toolLinks = CONFIG.topNav.map(function (item) {
      return '<a href="' + resolvePath(item.href, false) + '" data-page="' + item.page + '">' +
             item.label + '</a>';
    }).join('');

    var homeHref = resolvePath('index.html', true);

    return '<header class="site-header"><div class="header-inner">' +
     '<a class="brand-link" href="' + homeHref + '" aria-label="' + CONFIG.brand + ' Home">' +
  '<span class="brand-badge">' +
    '<img src="' + resolvePath('assets/images/logo-icon.png', true) + '" alt="DocEasy" style="width:18px;height:18px;display:block;">' +
    CONFIG.brand +
  '</span>' +
'</a>' +
      '<nav class="pill-nav" aria-label="Sections">' + pillLinks + '</nav>' +
      '<div class="nav-right">' +
        '<nav class="top-nav" aria-label="Quick tools">' + toolLinks + '</nav>' +
        '<label class="theme-switch" aria-label="Toggle theme">' +
          '<input type="checkbox" id="theme-checkbox" onchange="docEasyToggleTheme()">' +
          '<span class="slider"></span>' +
        '</label>' +
      '</div>' +
    '</div></header>';
  }

  /* ---------- Footer ---------- */
  function buildFooter() {
    function col(title, items, isRoot) {
      var lis = items.map(function (it) {
        return '<li><a href="' + resolvePath(it.href, isRoot || it.root) + '">' +
               it.label + '</a></li>';
      }).join('');
      return '<div class="footer-col"><h5>' + title + '</h5><ul>' + lis + '</ul></div>';
    }
    
    return '<footer class="site-footer">' +
      '<div class="footer-container">' +
        '<div>' +
          '<div class="footer-brand-box">' +
            '<img src="' + resolvePath('assets/images/logo-icon.png', true) + '" alt="DocEasy" style="width:18px;height:18px;display:block;">' +
            CONFIG.brand +
          '</div>' +
          '<p style="font-size:12.5px; color:#e0e7ff; margin:0;">' +
            '100% client-side browser processing. Your files never leave your device.' +
          '</p>' +
        '</div>' +
        col('PDF Tools',    CONFIG.footer.pdfTools,   false) +
        col('Image Tools',  CONFIG.footer.imageTools, false) +
        col('Company',      CONFIG.footer.company,    true)  +
      '</div>' +
      '<div class="footer-bottom-bar">' +
        '<div>© <span id="de-year"></span> ' + CONFIG.brand + '. All rights reserved.</div>' +
        '<div>' +
          '<a class="made-with-love-link" ' +
            'href="' + CONFIG.authorPortfolio + '" ' +
            'target="_blank" rel="noopener noreferrer">' +
            'Made with ❤️ by ' + CONFIG.author +
          '</a>' +
        '</div>' +
      '</div>' +
    '</footer>';
  }

  /* ---------- Inject ---------- */
  function inject() {
    var h = document.getElementById('doceasy-header') || document.getElementById('-header');
    if (h && !h.querySelector('.site-header')) h.innerHTML = buildHeader();

    var f = document.getElementById('doceasy-footer') || document.getElementById('-footer');
    if (f && !f.querySelector('.site-footer')) f.innerHTML = buildFooter();

    var current = location.pathname.split('/').pop().replace('.html', '');
    document.querySelectorAll('.top-nav a[data-page]').forEach(function (a) {
      if (a.getAttribute('data-page') === current) a.classList.add('active');
    });

    var cb = document.getElementById('theme-checkbox');
    if (cb) cb.checked = document.documentElement.getAttribute('data-theme') === 'dark';

    var y = document.getElementById('de-year');
    if (y) y.textContent = new Date().getFullYear();
  }

  /* ---------- Theme toggle ---------- */
  window.docEasyToggleTheme = function () {
    var cb = document.getElementById('theme-checkbox');
    if (cb && cb.checked) {
      document.documentElement.setAttribute('data-theme', 'dark');
      try { localStorage.setItem('doceasy_theme', 'dark'); } catch (e) {}
    } else {
      document.documentElement.removeAttribute('data-theme');
      try { localStorage.setItem('doceasy_theme', 'light'); } catch (e) {}
    }
  };

  /* Legacy alias — safe if any old code still calls it */
  window.officekitToggleTheme = window.docEasyToggleTheme;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inject);
  else inject();
})();
