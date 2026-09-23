/* ==========================================================================
   DocEasy — Core JS
   Injects header and footer. Handles theme toggle.
   Works on both GitHub Pages and custom domain.
   ========================================================================== */

(function () {
  'use strict';

  /* ---------- Detect base path (for GitHub Pages) ---------- */
  function getBasePath() {
    var host = window.location.hostname;
    var path = window.location.pathname;
    // If on GitHub Pages like /officekit/...
    if (host.indexOf('github.io') !== -1) {
      var parts = path.split('/').filter(Boolean);
      if (parts.length > 0) {
        var first = parts[0];
        if (first !== 'tools' && first !== 'assets' && first.indexOf('.') === -1) {
          return '/' + first + '/';
        }
      }
    }
    return '/';
  }

  var BASE = getBasePath();

  /* ---------- HEADER ---------- */
  var headerEl = document.getElementById('doceasy-header');
  if (headerEl) {
    headerEl.outerHTML =
      '<header class="site-header">' +
        '<div class="header-inner">' +
          '<a class="brand-link" href="' + BASE + '" aria-label="DocEasy home">' +
            '<span class="brand-badge">' +
              '<img src="' + BASE + 'assets/images/logo-full.png" alt="DocEasy" ' +
                   'onerror="this.parentElement.innerHTML=\'DocEasy\'">' +
            '</span>' +
          '</a>' +
          '<nav class="pill-nav" aria-label="Main navigation">' +
            '<a href="' + BASE + '#tools">Tools</a>' +
            '<a href="' + BASE + '#ai">AI Tools</a>' +
            '<a href="' + BASE + '#templates">Templates</a>' +
            '<a href="' + BASE + '#features">Why DocEasy</a>' +
            '<a href="' + BASE + '#faq">FAQ</a>' +
          '</nav>' +
          '<div class="nav-right">' +
            '<nav class="top-nav" aria-label="Tool shortcuts">' +
              '<a href="' + BASE + 'tools/pdf-merge.html">Merge PDF</a>' +
              '<a href="' + BASE + 'tools/pdf-compressor.html">Compress</a>' +
              '<a href="' + BASE + 'tools/image-compressor.html">Compress Image</a>' +
              '<a href="' + BASE + 'tools/image-bg-remover.html">BG Remover</a>' +
              '<a href="' + BASE + 'tools/qr-generator.html">QR Code</a>' +
            '</nav>' +
            '<label class="theme-switch" aria-label="Toggle dark mode">' +
              '<input type="checkbox" id="doceasy-theme-toggle">' +
              '<span class="slider"></span>' +
            '</label>' +
          '</div>' +
        '</div>' +
      '</header>';
  }

  /* ---------- FOOTER ---------- */
  var footerEl = document.getElementById('doceasy-footer');
  if (footerEl) {
    footerEl.outerHTML =
      '<footer class="site-footer">' +
        '<div class="footer-container">' +
          '<div class="footer-col">' +
            '<span class="footer-brand-box">' +
              '<img src="' + BASE + 'assets/images/logo-full.png" alt="DocEasy" ' +
                   'onerror="this.parentElement.innerHTML=\'DocEasy\'">' +
            '</span>' +
            '<p style="color:#e0e7ff;font-size:12.5px;line-height:1.65;margin:12px 0 0;max-width:280px;">' +
              'Free browser-based tools for PDFs, images, and documents. ' +
              '100% private — your files never leave your device.' +
            '</p>' +
          '</div>' +
          '<div class="footer-col">' +
            '<h5>PDF Tools</h5>' +
            '<ul>' +
              '<li><a href="' + BASE + 'tools/pdf-merge.html">Merge PDF</a></li>' +
              '<li><a href="' + BASE + 'tools/pdf-split.html">Split PDF</a></li>' +
              '<li><a href="' + BASE + 'tools/pdf-compressor.html">Compress PDF</a></li>' +
              '<li><a href="' + BASE + 'tools/pdf-editor.html">PDF Editor</a></li>' +
              '<li><a href="' + BASE + 'tools/pdf-to-word.html">PDF to Word</a></li>' +
            '</ul>' +
          '</div>' +
          '<div class="footer-col">' +
            '<h5>Image Tools</h5>' +
            '<ul>' +
              '<li><a href="' + BASE + 'tools/image-compressor.html">Image Compressor</a></li>' +
              '<li><a href="' + BASE + 'tools/image-bg-remover.html">Background Remover</a></li>' +
              '<li><a href="' + BASE + 'tools/passport-maker.html">Passport Photo</a></li>' +
              '<li><a href="' + BASE + 'tools/card-cropper.html">ID Card Cropper</a></li>' +
              '<li><a href="' + BASE + 'tools/signature-resize.html">Signature Resize</a></li>' +
            '</ul>' +
          '</div>' +
          '<div class="footer-col">' +
            '<h5>Company</h5>' +
            '<ul>' +
              '<li><a href="' + BASE + 'about.html">About</a></li>' +
              '<li><a href="' + BASE + 'contact.html">Contact</a></li>' +
              '<li><a href="' + BASE + 'privacy.html">Privacy</a></li>' +
              '<li><a href="' + BASE + 'terms.html">Terms</a></li>' +
            '</ul>' +
          '</div>' +
        '</div>' +
        '<div class="footer-bottom-bar">' +
          '<span>© 2026 DocEasy. All rights reserved.</span>' +
          '<span>Made with ❤️ for the world</span>' +
        '</div>' +
      '</footer>';
  }

  /* ---------- THEME TOGGLE ---------- */
  var toggle = document.getElementById('doceasy-theme-toggle');
  var savedTheme = 'light';
  try { savedTheme = localStorage.getItem('doceasy_theme') || 'light'; } catch (e) {}

  function applyTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      if (toggle) toggle.checked = true;
    } else {
      document.documentElement.removeAttribute('data-theme');
      if (toggle) toggle.checked = false;
    }
  }
  applyTheme(savedTheme);

  if (toggle) {
    toggle.addEventListener('change', function () {
      var next = this.checked ? 'dark' : 'light';
      try { localStorage.setItem('doceasy_theme', next); } catch (e) {}
      applyTheme(next);
    });
  }

})();
