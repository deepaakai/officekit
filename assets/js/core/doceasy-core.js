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

    /* Pill Nav (Row 1) */
    pillNav: [
      { href: 'index.html',           label: 'Home',       root: true },
      { href: 'index.html#tools',     label: 'Tools',      root: true },
      { href: 'index.html#ai',        label: 'AI Tools',   root: true },
      { href: 'index.html#templates', label: 'Templates',  root: true },
      { href: 'index.html#faq',       label: 'FAQ',        root: true },
      { href: 'index.html#blog',      label: 'Blog',       root: true }
    ],

    /* Top Nav (Row 2) — Quick tools */
    topNav: [
      { href: 'pdf-merge.html',         label: 'Merge PDF',        page: 'pdf-merge' },
      { href: 'pdf-compressor.html',    label: 'Compress PDF',     page: 'pdf-compressor' },
      { href: 'image-compressor.html',  label: 'Compress Image',   page: 'image-compressor' },
      { href: 'passport-maker.html',    label: 'Passport Photo',   page: 'passport-maker' },
      { href: 'signature-resize.html',  label: 'Signature Resize', page: 'signature-resize' },
      { href: 'image-bg-remover.html',  label: 'BG Remover',       page: 'image-bg-remover' },
      { href: 'card-cropper.html',      label: 'ID Card Crop',     page: 'card-cropper' },
      { href: 'qr-generator.html',      label: 'QR Code',          page: 'qr-generator' }
    ],

    /* Category Nav (Row 3) — All pages */
    categoryNav: [
      { href: '#pdf-tools',       label: 'PDF' },
      { href: '#image-tools',     label: 'Image' },
      { href: '#id-tools',        label: 'ID Cards' },
      { href: '#converter-tools', label: 'Converters' },
      { href: '#utility-tools',   label: 'Utilities' },
      { href: '#faq',             label: 'FAQ' }
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
        { href: 'image-compressor.html',  label: 'Image Compressor' },
        { href: 'image-bg-remover.html',  label: 'Background Remover' },
        { href: 'passport-maker.html',    label: 'Passport Photo' },
        { href: 'card-cropper.html',      label: 'ID Card Cropper' },
        { href: 'signature-resize.html',  label: 'Signature Resize' }
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
        'excel-to-pdf','ppt-to-pdf','pan-photo-signature-resizer'
      ];
      var name = href.replace('.html', '');
      if (TOOL_PAGES.indexOf(name) !== -1) return 'tools/' + href;
    }
    return href;
  }

  /* ---------- Header builder ---------- */
  function buildHeader() {
    var pills = CONFIG.pillNav.map(function (p) {
      return '<a href="' + resolvePath(p.href, p.root) + '">' + p.label + '</a>';
    }).join('');

    var tools = CONFIG.topNav.map(function (t) {
      return '<a href="' + resolvePath(t.href, false) + '" data-page="' + t.page + '">' + t.label + '</a>';
    }).join('');

    var catLinks = CONFIG.categoryNav.map(function (c) {
      var href = c.href;
      if (CONFIG.isSubPage && href.charAt(0) === '#') {
        href = '../index.html' + href;
      }
      return '<a href="' + href + '">' + c.label + '</a>';
    }).join('');

    var homeHref = resolvePath('index.html', true);

    /* ============ SUPPORT MODAL HTML ============ */
    var supportModal =
      '<div class="support-modal-backdrop" id="supportModal">' +
        '<div class="support-modal">' +
          '<div class="support-modal-header">' +
            '<div class="coffee-badge">☕ Buy Me a Coffee · एक कॉफ़ी सपोर्ट करें</div>' +
            '<button type="button" class="support-modal-close" onclick="docEasyCloseSupport()" aria-label="Close">✕</button>' +
          '</div>' +
          '<h2>Keep DocEasy 100% Free &amp; Private</h2>' +
          '<p class="sm-sub-hi">DocEasy पूरी तरह मुफ़्त, बिना लॉगिन और बिना किसी सर्वर अपलोड के काम करता है। अगर इसने आपका समय बचाया है, तो डेवलपर को सपोर्ट करें।</p>' +
          '<p class="sm-sub-en">100% local, zero limits. If it saved your day, fuel the project with a small coffee!</p>' +
          '<div class="sm-grid">' +
            '<div class="sm-pay-box">' +
              '<span class="sm-badge-country">🇮🇳 India (UPI)</span>' +
              '<div class="sm-qr-frame">' +
                '<img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=upi://pay?pa=deepaakai@dbs%26pn=DocEasy%26am=110%26cu=INR" alt="UPI QR Code" class="sm-upi-qr">' +
              '</div>' +
              '<p class="sm-upi-id">deepaakai@dbs</p>' +
              '<p class="sm-upi-text">GPay / PhonePe / Paytm</p>' +
              '<span class="sm-amount-tag">☕ ₹110 (1 Coffee)</span>' +
            '</div>' +
            '<div class="sm-pay-box">' +
              '<span class="sm-badge-country">🌍 Worldwide</span>' +
              '<div class="sm-paypal-content">' +
                '<svg viewBox="0 0 24 24" width="42" height="42" fill="#003087"><path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944 3.72a.78.78 0 0 1 .77-.655h6.634c3.275 0 5.64 1.34 6.183 4.293.447 2.435-.45 4.498-2.344 5.56 1.954.767 2.613 2.73 2.158 5.207-.547 2.977-3.037 4.545-6.674 4.545H7.71a.64.64 0 0 1-.634-.533l-.001-.005z"/></svg>' +
                '<h4>Buy a $1 Coffee</h4>' +
                '<p class="sm-pp-desc">Quick &amp; secure international contribution</p>' +
                '<a href="https://www.paypal.me/DPaswan198/1" target="_blank" rel="noopener" class="sm-paypal-btn">Gift $1 via PayPal →</a>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    return '<header class="site-header">' +
      '<div class="header-inner">' +
        '<a class="brand-link" href="' + homeHref + '" aria-label="DocEasy Home">' +
          '<span class="brand-badge">' +
            '<img src="' + resolvePath('assets/images/logo-full.png', true) + '" alt="DocEasy" onerror="this.parentElement.textContent=\'DocEasy\'">' +
          '</span>' +
        '</a>' +
        '<nav class="pill-nav" aria-label="Sections">' + pills + '</nav>' +
        '<button type="button" class="support-link" onclick="docEasyOpenSupport()" aria-label="Support">' +
          '<span class="support-icon">☕</span>' +
          '<span class="support-text">Support</span>' +
        '</button>' +
        '<label class="theme-switch" aria-label="Toggle theme">' +
          '<input type="checkbox" id="theme-checkbox" onchange="docEasyToggleTheme()">' +
          '<span class="slider"></span>' +
        '</label>' +
      '</div>' +
      '<nav class="top-nav" aria-label="Quick tools">' + tools + '</nav>' +
      '<nav class="category-nav" aria-label="Categories">' + catLinks + '</nav>' +
    '</header>' + supportModal;
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
        '<button type="button" class="footer-support-btn" onclick="docEasyOpenSupport()">' +
          '<span>☕</span> Support DocEasy' +
        '</button>' +
      '</div>' +
      col('PDF Tools',   CONFIG.footer.pdfTools,   false) +
      col('Image Tools', CONFIG.footer.imageTools, false) +
      col('Company',     CONFIG.footer.legal,      true)  +
      '</div><div class="footer-bottom-bar">' +
        '<div>© <span id="de-year"></span> DocEasy. All rights reserved.</div>' +
        '<div><a class="made-with-love-link" href="https://deepaakai.github.io/portfolio/" target="_blank" rel="noopener noreferrer">Made with ❤️ by Deepaak Kumar</a></div>' +
      '</div></footer>';
  }

  /* ---------- Inject ---------- */
  function inject() {
    var h = document.getElementById('doceasy-header');
    if (h && !document.querySelector('.site-header')) h.outerHTML = buildHeader();

    var f = document.getElementById('doceasy-footer');
    if (f && !document.querySelector('.site-footer')) f.outerHTML = buildFooter();

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
  window.officekitToggleTheme = window.docEasyToggleTheme;

  /* ---------- Support Modal Open/Close ---------- */
  window.docEasyOpenSupport = function () {
    var m = document.getElementById('supportModal');
    if (m) {
      m.classList.add('show');
      document.body.style.overflow = 'hidden';
    }
  };
  window.docEasyCloseSupport = function () {
    var m = document.getElementById('supportModal');
    if (m) {
      m.classList.remove('show');
      document.body.style.overflow = '';
    }
  };

  document.addEventListener('click', function (e) {
    var m = document.getElementById('supportModal');
    if (m && e.target === m) {
      window.docEasyCloseSupport();
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') window.docEasyCloseSupport();
  });

  /* ---------- Init ---------- */
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inject);
  else inject();
})();
