/* ==========================================================================
   DocEasy Core — Auto-injects header, footer, theme toggle on every page.
   IDs: #doceasy-header, #doceasy-footer  |  Theme key: doceasy_theme
   ========================================================================== */
(function () {
  'use strict';

  /* ---------- Early theme restore ---------- */
  try {
    var saved = localStorage.getItem('doceasy_theme') || 'light';
    if (saved === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  } catch (e) {}

  /* ---------- Config ---------- */
  var CONFIG = {
    brand: 'DocEasy',
    isSubPage: location.pathname.indexOf('/tools/') !== -1,

    pillNav: [
      { href: '#tools',     label: 'Tools' },
      { href: '#ai',        label: 'AI Tools' },
      { href: '#templates', label: 'Templates' },
      { href: '#features',  label: 'Why DocEasy' },
      { href: '#faq',       label: 'FAQ' },
      { href: '#blog',      label: 'Blog' }
    ],

    topNav: [
      { href: 'pdf-merge.html',         label: 'Merge PDF',      page: 'pdf-merge' },
      { href: 'pdf-compressor.html',    label: 'Compress PDF',   page: 'pdf-compressor' },
      { href: 'image-compressor.html',  label: 'Compress Image', page: 'image-compressor' },
      { href: 'image-bg-remover.html',  label: 'BG Remover',     page: 'image-bg-remover' },
      { href: 'qr-generator.html',      label: 'QR Code',        page: 'qr-generator' }
    ],

    footer: {
      pdfTools: [
        { href: 'pdf-merge.html',       label: 'Merge PDF' },
        { href: 'pdf-split.html',       label: 'Split PDF' },
        { href: 'pdf-compressor.html',  label: 'Compress PDF' },
        { href: 'pdf-editor.html',      label: 'PDF Editor' },
        { href: 'pdf-to-word.html',     label: 'PDF to Word' }
      ],
      imageTools: [
        { href: 'image-compressor.html',      label: 'Image Compressor' },
        { href: 'image-bg-remover.html',      label: 'Background Remover' },
        { href: 'passport-maker.html',        label: 'Passport Photo' },
        { href: 'card-cropper.html',          label: 'ID Card Cropper' },
        { href: 'signature-resize.html',      label: 'Signature Resize' }
      ],
      legal: [
        { href: 'about.html',   label: 'About',   root: true },
        { href: 'contact.html', label: 'Contact', root: true },
        { href: 'privacy.html', label: 'Privacy', root: true },
        { href: 'terms.html',   label: 'Terms',   root: true }
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
        'pdf-editor','pdf-compressor','pdf-to-word','pdf-to-excel','pdf-writer',
        'qr-generator','qr-scanner','word-counter','word-writer','word-to-pdf',
        'excel-to-pdf','ppt-to-pdf'
      ];
      var name = href.replace('.html', '');
      if (TOOL_PAGES.indexOf(name) !== -1) return 'tools/' + href;
    }
    return href;
  }

  /* ---------- Header builder ---------- */
  function buildHeader() {
    var pills = CONFIG.pillNav.map(function (p) {
      return '<a href="' + p.href + '">' + p.label + '</a>';
    }).join('');

    var tools = CONFIG.topNav.map(function (t) {
      return '<a href="' + resolvePath(t.href, false) + '" data-page="' + t.page + '">' + t.label + '</a>';
    }).join('');

    var homeHref = resolvePath('index.html', true);

    return '<header class="site-header"><div class="header-inner">' +
      '<a class="brand-link" href="' + homeHref + '" aria-label="DocEasy Home">' +
        '<span class="brand-badge">' +
          '<img src="' + resolvePath('assets/images/logo-full.png', true) + '" alt="DocEasy" onerror="this.parentElement.textContent=\'DocEasy\'">' +
        '</span>' +
      '</a>' +
      '<nav class="pill-nav" aria-label="Sections">' + pills + '</nav>' +
      '<div class="nav-right">' +
        '<nav class="top-nav" aria-label="Quick tools">' + tools + '</nav>' +
        '<label class="theme-switch" aria-label="Toggle theme">' +
          '<input type="checkbox" id="theme-checkbox" onchange="docEasyToggleTheme()">' +
          '<span class="slider"></span>' +
        '</label>' +
      '</div>' +
    '</div></header>';
  }

  /* ---------- Footer builder ---------- */
  function buildFooter() {
    function col(title, items, isRoot) {
      var lis = items.map(function (it) {
        return '<li><a href="' + resolvePath(it.href, isRoot || it.root) + '">' + it.label + '</a></li>';
      }).join('');
      return '<div class="footer-col"><h5>' + title + '</h5><ul>' + lis + '</ul></div>';
    }

    return '<footer class="site-footer"><div class="footer-container">' +
      '<div class="footer-col">' +
        '<span class="footer-brand-box">' +
          '<img src="' + resolvePath('assets/images/logo-full.png', true) + '" alt="DocEasy" onerror="this.parentElement.textContent=\'DocEasy\'">' +
        '</span>' +
        '<p style="color:#e0e7ff;font-size:12.5px;line-height:1.65;margin:12px 0 0;max-width:280px;">' +
          '25+ free browser-based tools for PDFs, images, and documents. 100% private — your files never leave your device.' +
        '</p>' +
      '</div>' +
      col('PDF Tools',   CONFIG.footer.pdfTools,   false) +
      col('Image Tools', CONFIG.footer.imageTools, false) +
      col('Company',     CONFIG.footer.legal,      true)  +
      '</div><div class="footer-bottom-bar">' +
        '<div>© <span id="de-year"></span> DocEasy. All rights reserved.</div>' +
        '<div><a class="made-with-love-link" href="https://deepaakai.github.io/portfolio/" target="_blank" rel="noopener noreferrer">Made with ❤️ by Deepaak Kumar</a></div>' +
      '</div></footer>';
  }

  /* ---------- Inject (outerHTML = replace placeholder divs) ---------- */
  function inject() {
    var h = document.getElementById('doceasy-header');
    if (h && !document.querySelector('.site-header')) h.outerHTML = buildHeader();

    var f = document.getElementById('doceasy-footer');
    if (f && !document.querySelector('.site-footer')) f.outerHTML = buildFooter();

    /* Mark active top-nav link */
    var current = location.pathname.split('/').pop().replace('.html', '');
    document.querySelectorAll('.top-nav a[data-page]').forEach(function (a) {
      if (a.getAttribute('data-page') === current) a.classList.add('active');
    });

    /* Theme checkbox sync */
    var cb = document.getElementById('theme-checkbox');
    if (cb) cb.checked = document.documentElement.getAttribute('data-theme') === 'dark';

    /* Year */
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
  window.officekitToggleTheme = window.docEasyToggleTheme;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inject);
  else inject();
})();
