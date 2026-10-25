// External controller for Multi-ATS Form Sandbox (100% Manifest V3 CSP compliant)

(function () {
  function initAtsSandbox() {
    const form = document.getElementById('application_form');
    if (form) {
      form.addEventListener('submit', (e) => e.preventDefault());
    }

    document.querySelectorAll('.plat-btn[data-plat]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.plat-btn[data-plat]').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const plat = btn.getAttribute('data-plat');
        document.body.setAttribute('data-ats-platform', plat);
        const titleEl = document.getElementById('job-header-title');
        if (titleEl) {
          titleEl.textContent = `Senior Distributed Systems Engineer — ${plat} Application`;
        }
        const host = document.getElementById('localapply-host-root');
        if (host && host.shadowRoot) {
          const rescan = host.shadowRoot.getElementById('la-rescan-btn');
          if (rescan) rescan.click();
        }
      });
    });

    const clearBtn = document.getElementById('btn-clear-form');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (form) form.reset();
        const fileStatus = document.querySelector('[data-file-status]');
        if (fileStatus) fileStatus.textContent = 'No file chosen';
        const host = document.getElementById('localapply-host-root');
        if (host && host.shadowRoot) {
          const rescan = host.shadowRoot.getElementById('la-rescan-btn');
          if (rescan) rescan.click();
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAtsSandbox);
  } else {
    initAtsSandbox();
  }
})();
