/* ==========================================================================
   DocEasy Auto-Favicon Injector — Replaces old icons on all 90+ tools
   ========================================================================== */
(function () {
  'use strict';
  try {
    var oldIcons = document.querySelectorAll("link[rel*='icon']");
    oldIcons.forEach(function (el) { el.remove(); });

    var link = document.createElement('link');
    link.type = 'image/png';
    link.rel = 'icon';
    link.href = '/assets/images/favicon.png?v=2';
    document.head.appendChild(link);

    var appleTouch = document.createElement('link');
    appleTouch.rel = 'apple-touch-icon';
    appleTouch.href = '/assets/images/favicon.png?v=2';
    document.head.appendChild(appleTouch);
  } catch (e) {}
})();

/* ==========================================================================
   DocEasy Core — Auto-injects clean header, footer, theme toggle on every page.
   IDs: #doceasy-header, #doceasy-footer  |  Theme key: doceasy_theme
   ========================================================================== */
(function () {
  'use strict';

  /* ---------- Early theme restore ---------- */
  try {
    var saved = localStorage.getItem('doceasy_theme') || 'light';
    if (saved === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  } catch (e) {}

  /* ==========================================================================
     ROOT-LEVEL PAGES — these live in the SITE ROOT (not inside tools/)
     Everything else is assumed to be inside /tools/
     ========================================================================== */
  var ROOT_PAGES = [
    'index',
    'about',
    'contact',
    'privacy',
    'terms',
    'feedback',
    'business-tools',
    'finance-tools',
    'printing-tools',
    'career-tools',
    'media-tools',
    'categories',
    'blog'
  ];

  /* ---------- Config ---------- */
  var CONFIG = {
    brand: 'DocEasy',
    isSubPage: location.pathname.indexOf('/tools/') !== -1,

    /* Clean Main Nav */
    mainNav: [
      { href: 'index.html',                 label: 'Home',       root: true },
      { href: 'index.html#pdf-tools',       label: 'PDF Tools',  root: true },
      { href: 'index.html#image-tools',     label: 'Images',     root: true },
      { href: 'index.html#id-tools',        label: 'ID Cards',   root: true },
      { href: 'index.html#media-tools',     label: 'Media',      root: true },
      { href: 'index.html#utility-tools',   label: 'Utilities',  root: true },
      { href: 'index.html#more-tools',      label: 'More Hubs',  root: true }
    ],

    /* Quick Top Bar Tools */
    quickTools: [
      { href: 'card-cropper.html',          label: 'ID Card Crop' },
      { href: 'resume-builder.html',        label: 'Resume Builder' },
      { href: 'invoice-generator.html',     label: 'Invoice Maker' },
      { href: 'business-tools.html',        label: 'Business Tools',  root: true },
      { href: 'finance-tools.html',         label: 'Finance Tools',   root: true },
      { href: 'emitra-csc-tools.html',      label: 'eMitra / CSC' },
      { href: 'pdf-merge.html',             label: 'Merge PDF' },
      { href: 'image-compressor.html',      label: 'Compress Image' },
      { href: 'passport-maker.html',        label: 'Passport Photo' },
      { href: 'qr-generator.html',          label: 'QR Code' },
      { href: 'word-writer.html',           label: 'Word Writer' }
    ],

    footer: {
      pdfTools: [
        { href: 'pdf-merge.html',       label: 'Merge PDF' },
        { href: 'pdf-split.html',       label: 'Split PDF' },
        { href: 'pdf-compressor.html',  label: 'Compress PDF' },
        { href: 'pdf-editor.html',      label: 'PDF Editor' },
        { href: 'pdf-to-word.html',     label: 'PDF to Word' },
        { href: 'pdf-lock-unlock.html', label: 'Lock / Unlock PDF' }
      ],
      businessTools: [
        { href: 'business-tools.html',    label: 'Business Suite',      root: true },
        { href: 'finance-tools.html',     label: 'Finance Calculators', root: true },
        { href: 'invoice-generator.html', label: 'GST Invoice Maker' },
        { href: 'resume-builder.html',    label: 'Resume Builder' },
        { href: 'word-writer.html',       label: 'Word Writer' },
        { href: 'emitra-csc-tools.html',  label: 'eMitra / CSC Tools' }
      ],
      idTools: [
        { href: 'card-cropper.html',                 label: 'ID Card Cropper' },
        { href: 'id-2in1-maker.html',                label: '2 in 1 ID Maker' },
        { href: 'passport-maker.html',               label: 'Passport Photo Maker' },
        { href: 'pan-photo-signature-resizer.html',  label: 'PAN Photo & Signature' },
        { href: 'signature-resize.html',             label: 'Signature Resize' },
        { href: 'signature-bg-remover.html',         label: 'Signature BG Remover' }
      ],
      legal: [
        { href: 'about.html',    label: 'About',                    root: true },
        { href: 'contact.html',  label: 'Contact',                  root: true },
        { href: 'privacy.html',  label: 'Privacy Policy',           root: true },
        { href: 'terms.html',    label: 'Terms & Conditions',       root: true },
        { href: 'feedback.html', label: 'Report Error / Feedback',  root: true }
      ]
    }
  };

  /* ==========================================================================
     FIXED PATH RESOLVER
     Correctly handles:
       • Root pages (index, business-tools, finance-tools, about, etc.)
       • Tool pages (pdf-merge, resume-builder, etc. inside /tools/)
       • Anchor links (index.html#pdf-tools)
       • External URLs (https://...)
     ========================================================================== */
  function resolvePath(href, isRoot) {
    if (!href) return '#';
    if (/^https?:\/\//.test(href) || href.charAt(0) === '#') return href;

    // Extract base name (without .html and without #anchor)
    var baseName = href.split('#')[0].replace(/\.html$/, '');

    // Is this link pointing to a page that lives in the ROOT folder?
    var isRootPage = isRoot === true || ROOT_PAGES.indexOf(baseName) !== -1;

    if (CONFIG.isSubPage) {
      // We are currently inside /tools/ folder
      if (isRootPage) {
        // Root page → go up one level
        return '../' + href;
      }
      // Tool page → same folder, use as-is
      return href;
    } else {
      // We are currently at site root (index.html, business-tools.html, etc.)
      if (isRootPage) {
        // Root page → use as-is
        return href;
      }
      // Tool page → prefix with tools/
      return 'tools/' + href;
    }
  }

  /* ---------- Header builder ---------- */
  function buildHeader() {
    var navLinks = CONFIG.mainNav.map(function (p) {
      return '<a href="' + resolvePath(p.href, p.root) + '">' + p.label + '</a>';
    }).join('');

    var quickLinks = CONFIG.quickTools.map(function (t) {
      return '<a href="' + resolvePath(t.href, t.root) + '" data-page="' + t.href.replace('.html', '') + '">' + t.label + '</a>';
    }).join('');

    var homeHref = resolvePath('index.html', true);

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
                '<img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=upi://pay?pa=deepaakai@dbs%26pn=DocEasy" alt="UPI QR Code" class="sm-upi-qr">' +
              '</div>' +
              '<p class="sm-upi-id">deepaakai@dbs</p>' +
              '<p class="sm-upi-text">GPay / PhonePe / Paytm</p>' +
            '</div>' +
            '<div class="sm-pay-box">' +
              '<span class="sm-badge-country">🌍 Worldwide</span>' +
              '<div class="sm-paypal-content">' +
                '<svg viewBox="0 0 24 24" width="42" height="42" fill="#003087"><path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944 3.72a.78.78 0 0 1 .77-.655h6.634c3.275 0 5.64 1.34 6.183 4.293.447 2.435-.45 4.498-2.344 5.56 1.954.767 2.613 2.73 2.158 5.207-.547 2.977-3.037 4.545-6.674 4.545H7.71a.64.64 0 0 1-.634-.533l-.001-.005z"/></svg>' +
                '<h4>Buy a Coffee</h4>' +
                '<p class="sm-pp-desc">Quick &amp; secure international contribution</p>' +
                '<a href="https://www.paypal.me/DPaswan198" target="_blank" rel="noopener" class="sm-paypal-btn">Gift a Coffee via PayPal →</a>' +
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
        '<nav class="pill-nav" aria-label="Sections">' + navLinks + '</nav>' +
        '<button type="button" class="support-link" onclick="docEasyOpenSupport()" aria-label="Support">' +
          '<span class="support-icon">☕</span>' +
          '<span class="support-text">Support</span>' +
        '</button>' +
        '<label class="theme-switch" aria-label="Toggle theme">' +
          '<input type="checkbox" id="theme-checkbox" onchange="docEasyToggleTheme()">' +
          '<span class="slider"></span>' +
        '</label>' +
      '</div>' +
      '<nav class="top-nav" aria-label="Quick tools">' + quickLinks + '</nav>' +
    '</header>' + supportModal;
  }

  /* ---------- Footer builder ---------- */
  function buildFooter() {
    function col(title, items) {
      var lis = items.map(function (it) {
        return '<li><a href="' + resolvePath(it.href, it.root) + '">' + it.label + '</a></li>';
      }).join('');
      return '<div class="footer-col"><h5>' + title + '</h5><ul>' + lis + '</ul></div>';
    }

    return '<footer class="site-footer"><div class="footer-container">' +
      '<div class="footer-col">' +
        '<span class="footer-brand-box">' +
          '<img src="' + resolvePath('assets/images/logo-full.png', true) + '" alt="DocEasy" onerror="this.parentElement.textContent=\'DocEasy\'">' +
        '</span>' +
        '<p style="color:#e0e7ff;font-size:12.5px;line-height:1.65;margin:12px 0 0;max-width:280px;">' +
          '49+ free browser-based tools for PDFs, images, and commercial documents. 100% private — your files never leave your device.' +
        '</p>' +
        '<button type="button" class="footer-support-btn" onclick="docEasyOpenSupport()">' +
          '<span>☕</span> Support DocEasy' +
        '</button>' +
      '</div>' +
      col('PDF Tools',      CONFIG.footer.pdfTools) +
      col('Business Suite', CONFIG.footer.businessTools) +
      col('ID Tools',       CONFIG.footer.idTools) +
      col('Company',        CONFIG.footer.legal) +
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

    /* Mark active quick tool link */
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

/* ============ Auto-Hide Header On Scroll ============ */
(function () {
  'use strict';

  var lastScrollY = window.pageYOffset || document.documentElement.scrollTop;
  var ticking = false;
  var HIDE_THRESHOLD = 80;
  var DELTA = 8;

  function updateHeader() {
    var currentScrollY = window.pageYOffset || document.documentElement.scrollTop;
    var header = document.querySelector('.site-header');

    if (!header) { ticking = false; return; }

    if (currentScrollY > lastScrollY + DELTA && currentScrollY > HIDE_THRESHOLD) {
      header.classList.add('header-hidden');
    } else if (currentScrollY < lastScrollY - DELTA) {
      header.classList.remove('header-hidden');
    }

    if (currentScrollY <= 10) {
      header.classList.remove('header-hidden');
    }

    lastScrollY = currentScrollY;
    ticking = false;
  }

  window.addEventListener('scroll', function () {
    if (!ticking) {
      window.requestAnimationFrame(updateHeader);
      ticking = true;
    }
  }, { passive: true });
})();
