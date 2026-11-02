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
   DocEasy Core — Auto-injects clean header, footer, theme toggle, search.
   ========================================================================== */
(function () {
  'use strict';

  /* ---------- Early theme restore ---------- */
  try {
    var saved = localStorage.getItem('doceasy_theme') || 'light';
    if (saved === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  } catch (e) {}

  /* ---------- ROOT-LEVEL PAGES ---------- */
  var ROOT_PAGES = [
    'index', 'about', 'contact', 'privacy', 'terms', 'feedback',
    'business-tools', 'finance-tools', 'printing-tools', 'career-tools',
    'media-tools', 'categories', 'blog'
  ];

  /* ---------- MASTER TOOLS DATABASE (For Search) ---------- */
  // जैसे-जैसे आप नए टूल्स बनाएंगे, उन्हें यहाँ जोड़ते रहें
  var TOOLS_DB = [
    // Finance & Math
    { name: 'EMI Calculator', url: 'emi-calculator.html', desc: 'Car, Home & Personal loan EMI', root: false },
    { name: 'SIP Calculator', url: 'sip-calculator.html', desc: 'Mutual fund returns with chart', root: false },
    { name: 'Private Loan (Monthly)', url: 'private-loan-calculator.html', desc: 'Moneylender monthly interest', root: false },
    { name: 'Percentage Calculator', url: 'percentage-calculator.html', desc: 'Find X% of Y and % change', root: false },
    { name: 'Age Calculator', url: 'age-calculator.html', desc: 'Calculate exact age from DOB', root: false },
    { name: 'Date Calculator', url: 'date-calculator.html', desc: 'Days between dates, add/subtract', root: false },
    { name: 'BMI Calculator', url: 'bmi-calculator.html', desc: 'Check Body Mass Index (WHO/Asian)', root: false },
    { name: 'Unit Converter', url: 'unit-converter.html', desc: 'Length, Weight, Temperature', root: false },
    { name: 'Number to Words', url: 'number-to-words.html', desc: 'Convert numbers to English words', root: false },
    { name: 'Tip Calculator', url: 'tip-calculator.html', desc: 'Calculate tips & split bills', root: false },
    { name: 'Simple Interest', url: 'simple-interest-calculator.html', desc: 'Calculate SI on loans', root: false },
    { name: 'Average Calculator', url: 'average-calculator.html', desc: 'Mean, Median, Mode', root: false },

    // Security & Utility
    { name: 'Document Masker', url: 'document-masker.html', desc: 'Hide Aadhaar, PAN, DL, RC', root: false },
    { name: 'Password Generator', url: 'password-generator.html', desc: 'Create strong secure passwords', root: false },
    { name: 'Base64 & URL Encoder', url: 'encoder-decoder.html', desc: 'Encode/decode text safely', root: false },
    { name: 'Random Generator & Dice', url: 'random-generator.html', desc: 'Random numbers, dice, lottery', root: false },
    { name: 'Case Converter', url: 'case-converter.html', desc: 'UPPER, lower, Title case text', root: false },

    // PDF & Office
    { name: 'Merge PDF', url: 'pdf-merge.html', desc: 'Combine multiple PDFs', root: false },
    { name: 'Compress PDF', url: 'pdf-compressor.html', desc: 'Reduce PDF file size', root: false },
    { name: 'PDF to Word', url: 'pdf-to-word.html', desc: 'Convert PDF to editable DOCX', root: false },
    { name: 'Image to PDF', url: 'jpg-to-pdf.html', desc: 'Convert JPG/PNG to PDF', root: false },
    
    // Image & ID Tools
    { name: 'Image Compressor', url: 'image-compressor.html', desc: 'Reduce JPG/PNG size to KB', root: false },
    { name: 'ID Card Cropper', url: 'card-cropper.html', desc: 'Aadhaar/PAN print at 300 DPI', root: false },
    { name: 'Passport Photo Maker', url: 'passport-maker.html', desc: '35x45mm photo sheet on A4', root: false },
    { name: 'PAN Photo & Signature', url: 'pan-photo-signature-resizer.html', desc: 'Exact pixels & KB for UTI/Protean', root: false },
    
    // Root Hubs
    { name: 'Finance Tools Hub', url: 'finance-tools.html', desc: 'All financial calculators', root: true },
    { name: 'Printing Tools Hub', url: 'printing-tools.html', desc: 'Print IDs, Aadhaar, Photos', root: true },
    { name: 'All Categories', url: 'categories.html', desc: 'Browse all 90+ tools', root: true }
  ];

  /* ---------- Config ---------- */
  var CONFIG = {
    brand: 'DocEasy',
    isSubPage: location.pathname.indexOf('/tools/') !== -1,
    mainNav: [
      { href: 'index.html',                 label: 'Home',       root: true },
      { href: 'index.html#pdf-tools',       label: 'PDF',        root: true },
      { href: 'index.html#image-tools',     label: 'Images',     root: true },
      { href: 'index.html#id-forms',        label: 'ID Cards',   root: true },
      { href: 'index.html#finance',         label: 'Finance',    root: true },
      { href: 'categories.html',            label: 'All Tools',  root: true }
    ],
    quickTools: [
      { href: 'card-cropper.html',          label: 'ID Card Crop' },
      { href: 'resume-builder.html',        label: 'Resume Builder' },
      { href: 'invoice-generator.html',     label: 'Invoice Maker' },
      { href: 'printing-tools.html',        label: 'Printing Suite',  root: true },
      { href: 'business-tools.html',        label: 'Business Tools',  root: true },
      { href: 'finance-tools.html',         label: 'Finance Tools',   root: true },
      { href: 'career-tools.html',          label: 'Career Tools',    root: true },
      { href: 'emitra-csc-tools.html',      label: 'eMitra / CSC' },
      { href: 'pdf-merge.html',             label: 'Merge PDF' },
      { href: 'image-compressor.html',      label: 'Compress Image' },
      { href: 'passport-maker.html',        label: 'Passport Photo' }
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
        { href: 'career-tools.html',      label: 'Career Suite',        root: true },
        { href: 'invoice-generator.html', label: 'GST Invoice Maker' },
        { href: 'resume-builder.html',    label: 'Resume Builder' },
        { href: 'emitra-csc-tools.html',  label: 'eMitra / CSC Tools' }
      ],
      idTools: [
        { href: 'printing-tools.html',               label: 'Printing Hub',        root: true },
        { href: 'card-cropper.html',                 label: 'ID Card Cropper' },
        { href: 'id-2in1-maker.html',                label: '2 in 1 ID Maker' },
        { href: 'passport-maker.html',               label: 'Passport Photo Maker' },
        { href: 'pan-photo-signature-resizer.html',  label: 'PAN Photo & Signature' },
        { href: 'signature-resize.html',             label: 'Signature Resize' },
        { href: 'photo-size-resize.html',            label: 'Photo Size Resize' }
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

  /* ---------- Path Resolver ---------- */
  function resolvePath(href, isRoot) {
    if (!href) return '#';
    if (/^https?:\/\//.test(href) || href.charAt(0) === '#') return href;

    var baseName = href.split('#')[0].replace(/\.html$/, '');
    var isRootPage = isRoot === true || ROOT_PAGES.indexOf(baseName) !== -1;

    if (CONFIG.isSubPage) {
      if (isRootPage) return '../' + href;
      return href;
    } else {
      if (isRootPage) return href;
      return 'tools/' + href;
    }
  }

  /* ---------- Header Builder (With Search Box) ---------- */
  function buildHeader() {
    var navLinks = CONFIG.mainNav.map(function (p) {
      return '<a href="' + resolvePath(p.href, p.root) + '">' + p.label + '</a>';
    }).join('');

    var quickLinks = CONFIG.quickTools.map(function (t) {
      return '<a href="' + resolvePath(t.href, t.root) + '" data-page="' + t.href.replace('.html', '') + '">' + t.label + '</a>';
    }).join('');

    var homeHref = resolvePath('index.html', true);

    return '<header class="site-header">' +
      '<div class="header-inner">' +
        '<a class="brand-link" href="' + homeHref + '" aria-label="DocEasy Home">' +
          '<span class="brand-badge">' +
            '<img src="' + resolvePath('assets/images/logo-full.png', true) + '" alt="DocEasy" onerror="this.parentElement.textContent=\'DocEasy\'">' +
          '</span>' +
        '</a>' +
        
        /* --- SEARCH BOX START --- */
        '<div class="de-search-wrapper">' +
          '<div class="de-search-box">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/></svg>' +
            '<input type="text" id="de-global-search" placeholder="Search 90+ tools..." autocomplete="off">' +
          '</div>' +
          '<div class="de-search-results" id="de-search-results"></div>' +
        '</div>' +
        /* --- SEARCH BOX END --- */

        '<nav class="pill-nav" aria-label="Sections">' + navLinks + '</nav>' +
        
        '<label class="theme-switch" aria-label="Toggle theme">' +
          '<input type="checkbox" id="theme-checkbox" onchange="docEasyToggleTheme()">' +
          '<span class="slider"></span>' +
        '</label>' +
      '</div>' +
      '<nav class="top-nav" aria-label="Quick tools">' + quickLinks + '</nav>' +
    '</header>';
  }

  /* ---------- Footer Builder ---------- */
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
          '90+ free browser-based tools for PDFs, images, and commercial documents. 100% private — your files never leave your device.' +
        '</p>' +
      '</div>' +
      col('PDF Tools',      CONFIG.footer.pdfTools) +
      col('Business Suite', CONFIG.footer.businessTools) +
      col('ID & Print',     CONFIG.footer.idTools) +
      col('Company',        CONFIG.footer.legal) +
      '</div><div class="footer-bottom-bar">' +
        '<div>© <span id="de-year"></span> DocEasy. All rights reserved.</div>' +
        '<div><a class="made-with-love-link" href="https://deepaakai.github.io/portfolio/" target="_blank" rel="noopener noreferrer">Made with ❤️ by Deepaak Kumar</a></div>' +
      '</div></footer>';
  }

  /* ---------- Search Logic ---------- */
  function initSearch() {
    var input = document.getElementById('de-global-search');
    var dropdown = document.getElementById('de-search-results');
    if (!input || !dropdown) return;

    input.addEventListener('input', function() {
      var q = this.value.toLowerCase().trim();
      if (!q) { dropdown.classList.remove('show'); return; }

      var matches = TOOLS_DB.filter(function(t) {
        return t.name.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q);
      });

      if (matches.length > 0) {
        dropdown.innerHTML = matches.map(function(t) {
          // Path resolver for search results
          var url = resolvePath(t.url, t.root);
          return '<a href="' + url + '" class="de-search-item">' +
                   '<div class="de-si-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg></div>' +
                   '<div class="de-si-text"><h4>' + t.name + '</h4><p>' + t.desc + '</p></div>' +
                 '</a>';
        }).join('');
      } else {
        dropdown.innerHTML = '<div class="de-search-empty">No tools found for "' + this.value + '"</div>';
      }
      dropdown.classList.add('show');
    });

    // Enter key logic
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        var first = dropdown.querySelector('.de-search-item');
        if (first) window.location.href = first.href;
      }
    });

    // Close on click outside
    document.addEventListener('click', function(e) {
      if (!input.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.remove('show');
      }
    });
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

    // Initialize Search after Header is injected
    initSearch();
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
  window.docEasyOpenSupport = function () {};
  window.docEasyCloseSupport = function () {};

  /* ---------- Init ---------- */
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inject);
  else inject();
})();

/* ============ Auto-Hide Header On Scroll ============ */
(function () {
  'use strict';
  var lastScrollY = window.pageYOffset || document.documentElement.scrollTop;
  var ticking = false;
  var HIDE_THRESHOLD = 120;
  var DELTA = 15;

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
