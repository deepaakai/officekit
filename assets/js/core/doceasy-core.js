/* ==========================================================================
   DocEasy — Core JS
   Injects header and footer. Handles theme toggle.
   Path-agnostic: works both on GitHub Pages and custom domain.
   ========================================================================== */

(function () {
  'use strict';

  /* ---------- Detect base path ---------- */
  // Works both on /officekit/ (GitHub Pages) and / (custom domain)
  var basePath = '';
  if (window.location.hostname.indexOf('github.io') !== -1) {
    // GitHub Pages: /officekit/
    var pathParts = window.location.pathname.split('/').filter(Boolean);
    if (pathParts.length > 0 && pathParts[0] !== 'tools' &&
        pathParts[0] !== 'assets' && pathParts[0].indexOf('.') === -1) {
      basePath = '/' + pathParts[0] + '/';
    }
  }

  function url(p) {
    // Remove leading slash if basePath has trailing slash
    p = p.replace(/^\//, '');
    return basePath + p;
  }

  /* ---------- HEADER ---------- */
  var headerEl = document.getElementById('doceasy-header');
  if (headerEl) {
    headerEl.outerHTML = [
      '<header class="site-header">',
      '  <div class="header-inner">',
      '    <a class="brand-link" href="' + url('/') + '" aria-label="DocEasy home">',
      '      <span class="brand-badge">',
      '        <img src="' + url('assets/images/logo-full.png') + '" alt="DocEasy" onerror="this.parentElement.textContent=\'DocEasy\'">',
      '      </span>',
      '    </a>',
      '    <nav class="pill-nav" aria-label="Main navigation">',
      '      <a href="' + url('/') + '#tools">Tools</a>',
      '      <a href="' + url('/') + '#ai">AI Tools</a>',
      '      <a href="' + url('/') + '#templates">Templates</a>',
      '      <a href="' + url('/') + '#features">Why DocEasy</a>',
      '      <a href="' + url('/') + '#faq">FAQ</a>',
      '    </nav>',
      '    <div class="nav-right">',
      '      <nav class="top-nav" aria-label="Tool shortcuts">',
      '        <a href="' + url('tools/pdf-merge.html') + '">Merge PDF</a>',
      '        <a href="' + url('tools/pdf-compressor.html') + '">Compress</a>',
      '        <a href="' + url('tools/image-compressor.html') + '">Compress Image</a>',
      '        <a href="' + url('tools/image-bg-remover.html') + '">BG Remover</a>',
      '        <a href="' + url('tools/qr-generator.html') + '">QR Code</a>',
      '      </nav>',
      '      <label class="theme-switch" aria-label="Toggle dark mode">',
      '        <input type="checkbox" id="doceasy-theme-toggle">',
      '        <span class="slider"></span>',
      '      </label>',
      '    </div>',
      '  </div>',
      '</header>'
    ].join('\n');
  }

  /* ---------- FOOTER ---------- */
  var footerEl = document.getElementById('doceasy-footer');
  if (footerEl) {
    footerEl.outerHTML = [
      '<footer class="site-footer">',
      '  <div class="footer-container">',
      '    <div class="footer-col">',
      '      <span class="footer-brand-box">',
      '        <img src="' + url('assets/images/logo-full.png') + '" alt="DocEasy" onerror="this.parentElement.textContent=\'DocEasy\'">',
      '      </span>',
      '      <p style="color:#e0e7ff;font-size:12.5px;line-height:1.65;margin:12px 0 0;max-width:280px;">',
      '        25+ free browser-based tools for PDFs, images, and documents. 100% private — your files never leave your device.',
      '      </p>',
      '    </div>',
      '    <div class="footer-col">',
      '      <h5>PDF Tools</h5>',
      '      <ul>',
      '        <li><a href="' + url('tools/pdf-merge.html') + '">Merge PDF</a></li>',
      '        <li><a href="' + url('tools/pdf-split.html') + '">Split PDF</a></li>',
      '        <li><a href="' + url('tools/pdf-compressor.html') + '">Compress PDF</a></li>',
      '        <li><a href="' + url('tools/pdf-editor.html') + '">PDF Editor</a></li>',
      '        <li><a href="' + url('tools/pdf-to-word.html') + '">PDF to Word</a></li>',
      '      </ul>',
      '    </div>',
      '    <div class="footer-col">',
      '      <h5>Image Tools</h5>',
      '      <ul>',
      '        <li><a href="' + url('tools/image-compressor.html') + '">Image Compressor</a></li>',
      '        <li><a href="' + url('tools/image-bg-remover.html') + '">Background Remover</a></li>',
      '        <li><a href="' + url('tools/passport-maker.html') + '">Passport Photo</a></li>',
      '        <li><a href="' + url('tools/card-cropper.html') + '">ID Card Cropper</a></li>',
      '        <li><a href="' + url('tools/signature-resize.html') + '">Signature Resize</a></li>',
      '      </ul>',
      '    </div>',
      '    <div class="footer-col">',
      '      <h5>Company</h5>',
      '      <ul>',
      '        <li><a href="' + url('about.html') + '">About</a></li>',
      '        <li><a href="' + url('contact.html') + '">Contact</a></li>',
      '        <li><a href="' + url('privacy.html') + '">Privacy</a></li>',
      '        <li><a href="' + url('terms.html') + '">Terms</a></li>',
      '      </ul>',
      '    </div>',
      '  </div>',
      '  <div class="footer-bottom-bar">',
      '    <span>© 2026 DocEasy. All rights reserved.</span>',
      '    <span>Made with ❤️ for the world</span>',
      '  </div>',
      '</footer>'
    ].join('\n');
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
