/* ==========================================================================
   OfficeKit Core — Auto-injects header, footer, theme toggle on every page.
   Update this single file and ALL pages update automatically.
   ========================================================================== */
(function () {
  'use strict';

  /* ---------- Early theme restore (no flash) ---------- */
  try {
    var saved = localStorage.getItem('officekit_theme') || 'light';
    if (saved === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  } catch (e) {}

  /* ========================================================================
     CONFIG — Ye change karo, saare pages pe apply ho jayega
     ======================================================================== */
  var CONFIG = {
    brand: 'OfficeKit',
    isSubPage: location.pathname.indexOf('/tools/') !== -1,

    topNav: [
      { href: 'card-cropper.html',         label: 'ID & PAN Cropper',  page: 'card-cropper' },
      { href: 'passport-maker.html',       label: 'Passport Maker',    page: 'passport-maker' },
      { href: 'signature-bg-remover.html', label: 'Signature BG',      page: 'signature-bg-remover' },
      { href: 'invoice-generator.html',    label: 'GST Invoice',       page: 'invoice-generator' },
      { href: 'pdf-editor.html',           label: 'PDF Editor',        page: 'pdf-editor' }
    ],

    footer: {
      imageTools: [
        { href: 'image-compressor.html',     label: 'Image Compressor' },
        { href: 'signature-resize.html',     label: 'Target KB Resizer' },
        { href: 'image-bg-remover.html',     label: 'Background Remover' },
        { href: 'image-converter.html',      label: 'Format Converter' },
        { href: 'image-beautifier.html',     label: 'Image Beautifier' }
      ],
      documentTools: [
        { href: 'invoice-generator.html',    label: 'GST Invoice Generator' },
        { href: 'pdf-merge.html',            label: 'Merge PDF' },
        { href: 'pdf-split.html',            label: 'Split PDF' },
        { href: 'jpg-to-pdf.html',           label: 'JPG to PDF' },
        { href: 'pdf-to-jpg.html',           label: 'PDF to JPG (ZIP)' },
        { href: 'doc-scanner.html',          label: 'Document Scanner OCR' }
      ],
      legal: [
        { href: 'terms.html',                label: 'Terms & Conditions',  root: true },
        { href: 'privacy.html',              label: 'Privacy Policy',      root: true },
        { href: 'about.html',                label: 'About Us',            root: true },
        { href: 'contact.html',              label: 'Contact',             root: true }
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
      var TOOL_PAGES = ['image-compressor','signature-resize','image-bg-remover','image-converter','image-beautifier',
                        'invoice-generator','pdf-merge','pdf-split','jpg-to-pdf','pdf-to-jpg','doc-scanner',
                        'card-cropper','passport-maker','signature-bg-remover','pdf-editor','qr-generator',
                        'qr-scanner','word-counter'];
      var name = href.replace('.html', '');
      if (TOOL_PAGES.indexOf(name) !== -1) return 'tools/' + href;
    }
    return href;
  }

  var LOGO_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>';

  function buildHeader() {
    var nav = CONFIG.topNav.map(function (item) {
      return '<a href="' + resolvePath(item.href, false) + '" data-page="' + item.page + '">' + item.label + '</a>';
    }).join('');
    var homeHref = resolvePath('index.html', true);

    return '<header class="site-header"><div class="header-inner">' +
      '<a class="brand-link" href="' + homeHref + '" aria-label="' + CONFIG.brand + ' Home">' +
        '<span class="brand-badge">' + LOGO_SVG + CONFIG.brand + '</span></a>' +
      '<div class="nav-right">' +
        '<nav class="top-nav" aria-label="Quick tools">' + nav + '</nav>' +
        '<label class="theme-switch" aria-label="Toggle theme">' +
          '<input type="checkbox" id="theme-checkbox" onchange="officekitToggleTheme()">' +
          '<span class="slider"></span></label>' +
      '</div></div></header>';
  }

  function buildFooter() {
    function col(title, items, isRoot) {
      var lis = items.map(function (it) {
        return '<li><a href="' + resolvePath(it.href, isRoot || it.root) + '">' + it.label + '</a></li>';
      }).join('');
      return '<div class="footer-col"><h5>' + title + '</h5><ul>' + lis + '</ul></div>';
    }
    return '<footer class="site-footer"><div class="footer-container">' +
      '<div><div class="footer-brand-box">' + LOGO_SVG + CONFIG.brand + '</div>' +
      '<p style="font-size:12.5px; color:#e0e7ff; margin:0;">100% client-side browser processing. Your files never leave your device.</p></div>' +
      col('Image Tools',    CONFIG.footer.imageTools,    false) +
      col('Document Tools', CONFIG.footer.documentTools, false) +
      col('Legal & Info',   CONFIG.footer.legal,         true)  +
      '</div><div class="footer-bottom-bar">' +
        '<div>© <span id="ok-year"></span> ' + CONFIG.brand + '. All rights reserved.</div>' +
        '<div><a class="made-with-love-link" href="https://deepaakai.github.io/portfolio/" target="_blank" rel="noopener noreferrer">Made with ❤️ by Deepaak Kumar</a></div>' +
      '</div></footer>';
  }

  function inject() {
    var h = document.getElementById('officekit-header');
    if (h && !h.querySelector('.site-header')) h.innerHTML = buildHeader();
    var f = document.getElementById('officekit-footer');
    if (f && !f.querySelector('.site-footer')) f.innerHTML = buildFooter();

    var current = location.pathname.split('/').pop().replace('.html', '');
    document.querySelectorAll('.top-nav a[data-page]').forEach(function (a) {
      if (a.getAttribute('data-page') === current) {
        a.style.background = 'rgba(255,255,255,0.16)';
        a.style.fontWeight = '600';
      }
    });

    var cb = document.getElementById('theme-checkbox');
    if (cb) cb.checked = document.documentElement.getAttribute('data-theme') === 'dark';
    var y = document.getElementById('ok-year');
    if (y) y.textContent = new Date().getFullYear();
  }

  window.officekitToggleTheme = function () {
    var cb = document.getElementById('theme-checkbox');
    if (cb && cb.checked) {
      document.documentElement.setAttribute('data-theme', 'dark');
      try { localStorage.setItem('officekit_theme', 'dark'); } catch (e) {}
    } else {
      document.documentElement.removeAttribute('data-theme');
      try { localStorage.setItem('officekit_theme', 'light'); } catch (e) {}
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inject);
  else inject();
})();