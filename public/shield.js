/**
 * @copyright 2026 hentertrabelsi - All Rights Reserved
 * SkyBridge - Runtime Protection Shield
 */
(function () {
  'use strict';

  // ===== 1. ANTI-IFRAME: Bust out of frames =====
  if (window.top !== window.self) {
    try {
      window.top.location.href = window.self.location.href;
    } catch (e) {
      // Cross-origin frame - destroy content
      document.documentElement.innerHTML = '';
      document.title = '';
    }
  }

  // ===== 2. ANTI-RIGHT-CLICK =====
  document.addEventListener('contextmenu', function (e) {
    e.preventDefault();
    return false;
  });

  // ===== 3. ANTI-KEYBOARD SHORTCUTS =====
  document.addEventListener('keydown', function (e) {
    // Block F12 (DevTools)
    if (e.key === 'F12') {
      e.preventDefault();
      return false;
    }
    // Block Ctrl+Shift+I (DevTools), Ctrl+Shift+J (Console), Ctrl+Shift+C (Inspector)
    if (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(e.key.toUpperCase())) {
      e.preventDefault();
      return false;
    }
    // Block Ctrl+U (View Source)
    if (e.ctrlKey && e.key.toUpperCase() === 'U') {
      e.preventDefault();
      return false;
    }
    // Block Ctrl+S (Save Page)
    if (e.ctrlKey && e.key.toUpperCase() === 'S') {
      e.preventDefault();
      return false;
    }
    // Block Ctrl+A (Select All)
    if (e.ctrlKey && e.key.toUpperCase() === 'A') {
      e.preventDefault();
      return false;
    }
    // Block Ctrl+P (Print)
    if (e.ctrlKey && e.key.toUpperCase() === 'P') {
      e.preventDefault();
      return false;
    }
  });

  // ===== 4. ANTI-DRAG =====
  document.addEventListener('dragstart', function (e) {
    e.preventDefault();
    return false;
  });

  // ===== 5. ANTI-SELECTION =====
  document.addEventListener('selectstart', function (e) {
    // Allow selection in input/textarea
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
      return true;
    }
    e.preventDefault();
    return false;
  });

  // ===== 6. ANTI-COPY =====
  document.addEventListener('copy', function (e) {
    // Allow copy in input/textarea
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
      return true;
    }
    e.preventDefault();
    return false;
  });

  // ===== 7. DEVTOOLS DETECTION =====
  var _dc = 0;
  var _el = new Image();
  Object.defineProperty(_el, 'id', {
    get: function () {
      _dc++;
      if (_dc > 1) {
        // DevTools opened - take action
        document.title = '⚠️ SkyBridge - Protected Content';
        console.clear();
        console.log(
          '%c⚠️ WARNING',
          'color: red; font-size: 40px; font-weight: bold;'
        );
        console.log(
          '%cThis game is proprietary software. Copying, reverse-engineering, or redistributing is strictly prohibited.\n© 2026 hentertrabelsi - All Rights Reserved\nContact: hentertrabelsi@gmail.com | Discord: #susuxo',
          'color: white; font-size: 14px;'
        );
      }
    },
  });

  // Periodic DevTools check
  setInterval(function () {
    _dc = 0;
    console.log(_el);
    console.clear();
  }, 2000);

  // ===== 8. CONSOLE WARNING =====
  console.log(
    '%c🛑 STOP!',
    'color: red; font-size: 50px; font-weight: bold; text-shadow: 2px 2px 0 black;'
  );
  console.log(
    '%cThis is a browser feature intended for developers.',
    'font-size: 16px; color: white;'
  );
  console.log(
    '%cIf someone told you to copy-paste something here, it\'s a scam.',
    'font-size: 16px; color: #ff6b6b;'
  );
  console.log(
    '%c© 2026 hentertrabelsi - All Rights Reserved\nUnauthorized copying or cloning of this game is illegal.',
    'font-size: 14px; color: #888;'
  );

  // ===== 9. ANTI-PRINT =====
  window.addEventListener('beforeprint', function () {
    document.body.style.display = 'none';
  });
  window.addEventListener('afterprint', function () {
    document.body.style.display = '';
  });

  // ===== 10. DOMAIN LOCK =====
  var _allowedHosts = [
    'localhost',
    '127.0.0.1',
    'sky-bridge-teal-two.vercel.app',
    'skybridge-server.onrender.com'
  ];

  function _checkDomain() {
    var host = window.location.hostname;
    var allowed = _allowedHosts.some(function (h) {
      return host === h || host.endsWith(h);
    });
    if (!allowed) {
      document.documentElement.innerHTML =
        '<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#0a0a0a;color:#ff4444;font-family:monospace;font-size:24px;text-align:center;padding:20px;">' +
        '<div>⛔ UNAUTHORIZED MIRROR DETECTED<br><br>' +
        '<span style="font-size:16px;color:#888;">This is a stolen copy of SkyBridge.<br>' +
        'Play the real game at the official site.</span><br><br>' +
        '<span style="font-size:12px;color:#555;">© 2026 hentertrabelsi</span></div></div>';
      document.title = '⛔ Unauthorized Copy - SkyBridge';
      // Kill all scripts
      var scripts = document.querySelectorAll('script');
      scripts.forEach(function (s) {
        s.remove();
      });
    }
  }

  _checkDomain();

  // ===== 11. MUTATION OBSERVER - Prevent tampering =====
  if (window.MutationObserver) {
    var _headObs = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        m.addedNodes.forEach(function (node) {
          if (node.tagName === 'SCRIPT' && node.src && !node.src.includes(window.location.hostname)) {
            node.remove();
          }
          if (node.tagName === 'IFRAME') {
            node.remove();
          }
        });
      });
    });
    _headObs.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
