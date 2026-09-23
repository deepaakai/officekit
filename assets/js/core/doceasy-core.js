/* ==========================================================================
   DocEasy — Core JS
   Injects header and footer. Handles theme toggle.
   ========================================================================== */

(function () {
  'use strict';

  /* ---------- HEADER ---------- */
  var headerEl = document.getElementById('doceasy-header');
  if (headerEl) {
    headerEl.outerHTML = `
      <header class="site-header">
        <div class="header-inner">
          <a class="brand-link" href="/officekit/" aria-label="DocEasy home">
            <span class="brand-badge">
              <img src="/officekit/assets/images/logo-full.png" alt="DocEasy">
            </span>
          </a>
          <nav class="pill-nav" aria-label="Main navigation">
            <a href="/officekit/#tools">Tools</a>
            <a href="/officekit/#ai">AI Tools</a>
            <a href="/officekit/#templates">Templates</a>
            <a href="/officekit/#features">Why DocEasy</a>
            <a href="/officekit/#faq">FAQ</a>
            <a href="/officekit/#blog">Blog</a>
          </nav>
          <div class="nav-right">
            <nav class="top-nav" aria-label="Tool shortcuts">
              <a href="/officekit/tools/pdf-merge.html">Merge PDF</a>
              <a href="/officekit/tools/pdf-split.html">Split PDF</a>
              <a href="/officekit/tools/pdf-compressor.html">Compress</a>
              <a href="/officekit/tools/jpg-to-pdf.html">JPG to PDF</a>
              <a href="/officekit/tools/image-bg-remover.html">BG Remover</a>
            </nav>
            <label class="theme-switch" aria-label="Toggle dark mode">
              <input type="checkbox" id="theme-toggle">
              <span class="slider"></span>
            </label>
          </div>
        </div>
      </header>
    `;
  }

  /* ---------- FOOTER ---------- */
  var footerEl = document.getElementById('doceasy-footer');
  if (footerEl) {
    footerEl.outerHTML = `
      <footer class="site-footer">
        <div class="footer-container">
          <div class="footer-col">
            <span class="footer-brand-box">
              <img src="/officekit/assets/images/logo-full.png" alt="DocEasy">
            </span>
            <p style="color:#e0e7ff;font-size:12.5px;line-height:1.6;margin:8px 0 0;">
              Free browser-based tools for PDFs, images, and documents.
              100% private — your files never leave your device.
            </p>
          </div>
          <div class="footer-col">
            <h5>PDF Tools</h5>
            <ul>
              <li><a href="/officekit/tools/pdf-merge.html">Merge PDF</a></li>
              <li><a href="/officekit/tools/pdf-split.html">Split PDF</a></li>
              <li><a href="/officekit/tools/pdf-compressor.html">Compress PDF</a></li>
              <li><a href="/officekit/tools/pdf-editor.html">PDF Editor</a></li>
              <li><a href="/officekit/tools/pdf-to-word.html">PDF to Word</a></li>
            </ul>
          </div>
          <div class="footer-col">
            <h5>Image Tools</h5>
            <ul>
              <li><a href="/officekit/tools/image-compressor.html">Image Compressor</a></li>
              <li><a href="/officekit/tools/image-bg-remover.html">Background Remover</a></li>
              <li><a href="/officekit/tools/passport-maker.html">Passport Photo</a></li>
              <li><a href="/officekit/tools/card-cropper.html">ID Card Cropper</a></li>
              <li><a href="/officekit/tools/signature-resize.html">Signature Resize</a></li>
            </ul>
          </div>
          <div class="footer-col">
            <h5>Company</h5>
            <ul>
              <li><a href="/officekit/about.html">About</a></li>
              <li><a href="/officekit/contact.html">Contact</a></li>
              <li><a href="/officekit/privacy.html">Privacy</a></li>
              <li><a href="/officekit/terms.html">Terms</a></li>
            </ul>
          </div>
        </div>
        <div class="footer-bottom-bar">
          <span>© 2026 DocEasy. All rights reserved.</span>
          <span>Made with ❤️ for the world</span>
        </div>
      </footer>
    `;
  }

  /* ---------- THEME TOGGLE ---------- */
  var toggle = document.getElementById('theme-toggle');
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
