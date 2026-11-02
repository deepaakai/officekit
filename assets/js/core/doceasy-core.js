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

  /* ==========================================================================
     ROOT-LEVEL PAGES (जो फाइलें मेन फोल्डर में हैं)
     ========================================================================== */
  var ROOT_PAGES = [
    'index', 'about', 'contact', 'privacy', 'terms', 'feedback',
    'business-tools', 'finance-tools', 'printing-tools', 'career-tools',
    'categories'
  ];

  /* ==========================================================================
     MASTER TOOLS DATABASE (आपके GitHub स्क्रीनशॉट के अनुसार 100% सटीक)
     ========================================================================== */
  var TOOLS_DB = [
    // --- Finance & Loan ---
    { name: 'EMI Calculator', url: 'emi-loan-calculator.html', desc: 'Car, Home & Personal loan EMI', root: false },
    { name: 'SIP Calculator', url: 'investment-calculator.html', desc: 'Mutual fund returns with chart', root: false },
    { name: 'FD Calculator', url: 'fd-calculator.html', desc: 'Fixed Deposit maturity', root: false },
    { name: 'In-Hand Salary', url: 'in-hand-salary-calculator.html', desc: 'CTC to take-home salary', root: false },
    { name: 'Percentage Calculator', url: 'percentage-calculator.html', desc: 'Find X% of Y and % change', root: false },
    { name: 'Tip Calculator', url: 'tip-calculator.html', desc: 'Calculate tips & split bills', root: false },
    { name: 'Average Calculator', url: 'average-calculator.html', desc: 'Mean, Median, Mode', root: false },
    { name: 'Marks & CGPA', url: 'marks-cgpa-calculator.html', desc: 'Convert marks to percentage', root: false },

    // --- Health, Date & Age ---
    { name: 'BMI Calculator', url: 'bmi-calculator.html', desc: 'Check Body Mass Index (WHO/Asian)', root: false },
    { name: 'Age Calculator', url: 'age-calculator.html', desc: 'Calculate exact age from DOB', root: false },
    { name: 'Date Calculator', url: 'date-calculator.html', desc: 'Days between dates, add/subtract', root: false },
    { name: 'Working Days', url: 'working-days-calculator.html', desc: 'Business days excluding weekends', root: false },
    { name: 'Countdown Timer', url: 'countdown-timer.html', desc: 'Event countdown timer', root: false },
    { name: 'Leap Year Checker', url: 'leap-year-checker.html', desc: 'Check if a year is a leap year', root: false },

    // --- Math & Converters ---
    { name: 'Unit Converter', url: 'unit-converter.html', desc: 'Length, Weight, Temperature', root: false },
    { name: 'Number to Words', url: 'number-to-words.html', desc: 'Convert numbers to English words', root: false },
    { name: 'Roman Numeral', url: 'roman-numeral-converter.html', desc: 'Numbers to Roman numerals', root: false },
    { name: 'Case Converter', url: 'case-converter.html', desc: 'UPPER, lower, Title case text', root: false },
    { name: 'Base64 & URL Encoder', url: 'encoder-decoder.html', desc: 'Encode/decode Base64 & URL', root: false },
    { name: 'Random Generator', url: 'random-generator.html', desc: 'Random numbers, dice, lottery', root: false },
    { name: 'Name Picker', url: 'random-name-picker.html', desc: 'Spin wheel to pick names', root: false },
    
    // --- Security & Utility ---
    { name: 'Password Generator', url: 'password-generator.html', desc: 'Create strong secure passwords', root: false },
    { name: 'Document Masker', url: 'document-masker.html', desc: 'Hide Aadhaar, PAN, DL, RC', root: false },
    { name: 'Word Counter', url: 'word-counter.html', desc: 'Count words, characters & SEO', root: false },
    { name: 'Word Writer', url: 'word-writer.html', desc: 'Write & export as DOCX', root: false },
    { name: 'QR Code Generator', url: 'qr-generator.html', desc: 'Create custom QR codes', root: false },
    { name: 'QR Code Scanner', url: 'qr-scanner.html', desc: 'Scan QR from camera', root: false },

    // --- ID & Photo Printing ---
    { name: 'Exam Photo Resizer', url: 'exam-photo-resizer.html', desc: 'Resize photo for exam forms', root: false },
    { name: 'ID Card Cropper', url: 'card-cropper.html', desc: 'Aadhaar/PAN print at 300 DPI', root: false },
    { name: '2 in 1 ID Maker', url: 'id-2in1-maker.html', desc: 'Front & back on one page', root: false },
    { name: 'Passport Photo Maker', url: 'passport-maker.html', desc: '35x45mm photo sheet on A4', root: false },
    { name: 'Photo Size Resize', url: 'photo-size-resize.html', desc: 'Exact mm / px / KB for print', root: false },
    { name: 'PAN Photo & Signature', url: 'pan-photo-signature-resizer.html', desc: 'Exact pixels & KB for UTI', root: false },
    { name: 'Signature Resize', url: 'signature-resize.html', desc: 'Exact pixel / KB for exams', root: false },
    { name: 'Signature BG Remover', url: 'signature-bg-remover.html', desc: 'Clean white background', root: false },

    // --- PDF Tools ---
    { name: 'Merge PDF', url: 'pdf-merge.html', desc: 'Combine multiple PDFs', root: false },
    { name: 'Universal Merger', url: 'merger.html', desc: 'Merge Word, Excel, PPT & PDF', root: false },
    { name: 'Split PDF', url: 'pdf-split.html', desc: 'Extract pages from PDF', root: false },
    { name: 'Compress PDF', url: 'pdf-compressor.html', desc: 'Reduce PDF file size', root: false },
    { name: 'Lock / Unlock PDF', url: 'pdf-lock-unlock.html', desc: 'Add or remove PDF password', root: false },
    { name: 'PDF Editor', url: 'pdf-editor.html', desc: 'Edit text and images in PDF', root: false },
    { name: 'PDF Writer', url: 'pdf-writer.html', desc: 'Create PDF from scratch', root: false },
    { name: 'Word to PDF', url: 'word-to-pdf.html', desc: 'DOC, DOCX to PDF converter', root: false },
    { name: 'JPG to PDF', url: 'jpg-to-pdf.html', desc: 'Convert images to PDF', root: false },
    { name: 'Excel to PDF', url: 'excel-to-pdf.html', desc: 'Convert XLS, XLSX to PDF', root: false },
    { name: 'PPT to PDF', url: 'ppt-to-pdf.html', desc: 'Convert PowerPoint to PDF', root: false },
    { name: 'PDF to Word', url: 'pdf-to-word.html', desc: 'Convert PDF to editable DOCX', root: false },
    { name: 'PDF to JPG', url: 'pdf-to-jpg.html', desc: 'Save PDF pages as images', root: false },
    { name: 'PDF to Excel', url: 'pdf-to-excel.html', desc: 'Extract tables from PDF', root: false },
    { name: 'DWG to PDF', url: 'dwg-to-pdf.html', desc: 'AutoCAD drawings to PDF', root: false },

    // --- Image Tools ---
    { name: 'Image Compressor', url: 'image-compressor.html', desc: 'Reduce JPG/PNG size', root: false },
    { name: 'Image Converter', url: 'image-converter.html', desc: 'JPG, PNG, WEBP converter', root: false },
    { name: 'Background Remover', url: 'image-bg-remover.html', desc: 'Remove image background', root: false },
    { name: 'Image Beautifier', url: 'image-beautifier.html', desc: 'Sharpen and enhance photos', root: false },
    { name: 'Document Scanner', url: 'doc-scanner.html', desc: 'Photo to scanned PDF', root: false },

    // --- Media Tools ---
    { name: 'Screen Recorder', url: 'media-screen-recorder.html', desc: 'Record screen with audio', root: false },
    { name: 'Webcam Recorder', url: 'media-webcam-recorder.html', desc: 'Record video from camera', root: false },
    { name: 'Voice Recorder', url: 'media-voice-recorder.html', desc: 'Record audio with waveform', root: false },
    { name: 'Text to Speech', url: 'media-text-to-speech.html', desc: 'Turn text into voice', root: false },
    { name: 'Noise Remover', url: 'noise-remover.html', desc: 'Remove background noise', root: false },
    { name: 'Video Voice Changer', url: 'video-voice-changer.html', desc: 'Change voice in video', root: false },
    { name: 'Video Enhancer', url: 'video-enhancer.html', desc: 'Upscale and sharpen video', root: false },
    { name: 'Media Editor', url: 'media-editor.html', desc: 'Trim and edit video/audio', root: false },
    { name: 'Meme Generator', url: 'media-meme-generator.html', desc: 'Make memes online', root: false },
    { name: 'Mic Test', url: 'media-mic-test.html', desc: 'Check your microphone', root: false },
    { name: 'Webcam Test', url: 'media-webcam-test.html', desc: 'Check camera FPS', root: false },

    // --- Career & Business ---
    { name: 'Resume Builder', url: 'resume-builder.html', desc: '30 ATS-friendly templates', root: false },
    { name: 'Invoice Generator', url: 'invoice-generator.html', desc: 'Professional GST invoices', root: false },
    { name: 'eMitra / CSC Tools', url: 'emitra-csc-tools.html', desc: 'Citizen service utilities', root: false },
    
    // --- Root Hubs ---
    { name: 'Finance Tools Hub', url: 'finance-tools.html', desc: 'All financial calculators', root: true },
    { name: 'Business Tools Hub', url: 'business-tools.html', desc: 'GST, profit margin, ROI', root: true },
    { name: 'Career Tools Hub', url: 'career-tools.html', desc: 'Cover letter, interview prep', root: true },
    { name: 'Printing Tools Hub', url: 'printing-tools.html', desc: 'Print IDs, Aadhaar, Photos', root: true },
    { name: 'All Categories', url: 'categories.html', desc: 'Browse all 90+ tools', root: true },
    { name: 'All Tools Directory', url: 'all-tools.html', desc: 'Browse complete tool list', root: false } // यह tools फोल्डर के अंदर है
  ];

  /* ---------- Config ---------- */
  var CONFIG = {
    brand: 'DocEasy',
    isSubPage: location.pathname.indexOf('/tools/') !== -1,

    mainNav: [
      { href: 'index.html',                 label: 'Home',       root: true },
      { href: 'index.html#pdf-tools',       label: 'PDF Tools',  root: true },
      { href: 'index.html#image-tools',     label: 'Images',     root: true },
      { href: 'index.html#id-forms',        label: 'ID Cards',   root: true },
      { href: 'index.html#media',           label: 'Media',      root: true },
      { href: 'index.html#utility',         label: 'Utilities',  root: true },
      { href: 'categories.html',            label: 'All Hubs',   root: true }
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

  /* ---------- Header builder ---------- */
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

  /* ---------- Search Logic (FIXED: Hyphens & spaces handled perfectly) ---------- */
  function initSearch() {
    var input = document.getElementById('de-global-search');
    var dropdown = document.getElementById('de-search-results');
    if (!input || !dropdown) return;

    input.addEventListener('input', function() {
      var q = this.value.toLowerCase().trim();
      if (!q) { dropdown.classList.remove('show'); return; }

      // हाइफन (-) और अंडरस्कोर (_) को स्पेस से बदल दें ताकि "in hand" और "in-hand" दोनों मैच हों
      var cleanQ = q.replace(/[-_]/g, ' ');

      var matches = TOOLS_DB.filter(function(t) {
        var target = (t.name + ' ' + t.desc).toLowerCase().replace(/[-_]/g, ' ');
        return target.indexOf(cleanQ) !== -1;
      });

      if (matches.length > 0) {
        dropdown.innerHTML = matches.map(function(t) {
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

  /* ---------- Support Modal Open/Close (Stubbed safely) ---------- */
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
