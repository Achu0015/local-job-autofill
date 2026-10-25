// LocalApply Popup Controller

document.addEventListener('DOMContentLoaded', async () => {
  let localData = await window.LocalApplyStorage.getData();

  const statusMsg = document.getElementById('status-msg');
  const platformBadge = document.getElementById('platform-badge');
  const statQa = document.getElementById('stat-qa');
  const statResume = document.getElementById('stat-resume');

  function showToast(text) {
    statusMsg.textContent = text;
    statusMsg.style.display = 'block';
    setTimeout(() => {
      statusMsg.style.display = 'none';
    }, 3000);
  }

  function renderSettings() {
    const cats = (localData.settings && localData.settings.enabledCategories) || {};
    document.querySelectorAll('#cat-grid input[type="checkbox"]').forEach((cb) => {
      const key = cb.getAttribute('data-cat');
      cb.checked = cats[key] !== false;
    });

    const mode = (localData.settings && localData.settings.captureMode) || 'both';
    document.querySelectorAll('input[name="captureMode"]').forEach((r) => {
      r.checked = r.value === mode;
    });

    statQa.textContent = `Saved Q&As: ${(localData.customQA || []).length}`;
    statResume.textContent =
      localData.files && localData.files.resume ? `Resume: ${localData.files.resume.name}` : 'Resume: Not uploaded';
  }

  renderSettings();

  // Query active tab for detected ATS platform
  if (typeof chrome !== 'undefined' && chrome.tabs) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || !tabs[0]) return;
      chrome.tabs.sendMessage(tabs[0].id, { type: 'PING_PAGE_STATUS' }, (res) => {
        if (chrome.runtime.lastError || !res || !res.ok) return;
        platformBadge.textContent = `${res.platform.name} (${res.matchedCount} ready)`;
      });
    });
  }

  // Category checkboxes
  document.querySelectorAll('#cat-grid input[type="checkbox"]').forEach((cb) => {
    cb.addEventListener('change', async () => {
      const key = cb.getAttribute('data-cat');
      localData.settings.enabledCategories[key] = cb.checked;
      await window.LocalApplyStorage.saveData(localData);
    });
  });

  document.getElementById('cat-all').addEventListener('click', async (e) => {
    e.preventDefault();
    document.querySelectorAll('#cat-grid input[type="checkbox"]').forEach((cb) => {
      cb.checked = true;
      localData.settings.enabledCategories[cb.getAttribute('data-cat')] = true;
    });
    await window.LocalApplyStorage.saveData(localData);
  });

  document.getElementById('cat-none').addEventListener('click', async (e) => {
    e.preventDefault();
    document.querySelectorAll('#cat-grid input[type="checkbox"]').forEach((cb) => {
      cb.checked = false;
      localData.settings.enabledCategories[cb.getAttribute('data-cat')] = false;
    });
    await window.LocalApplyStorage.saveData(localData);
  });

  // Capture mode radios
  document.querySelectorAll('input[name="captureMode"]').forEach((r) => {
    r.addEventListener('change', async () => {
      if (r.checked) {
        localData.settings.captureMode = r.value;
        await window.LocalApplyStorage.saveData(localData);
        showToast(`Capture mode saved: ${r.value.toUpperCase()}`);
      }
    });
  });

  // Autofill button
  document.getElementById('btn-autofill').addEventListener('click', () => {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs || !tabs[0]) return;
        chrome.tabs.sendMessage(tabs[0].id, { type: 'TRIGGER_AUTOFILL' }, (res) => {
          if (chrome.runtime.lastError || !res) {
            showToast('Refresh the job page to activate LocalApply.');
            return;
          }
          showToast(`Autofilled ${res.filledCount || 0} fields on page!`);
        });
      });
    }
  });

  // Capture answers button
  document.getElementById('btn-capture').addEventListener('click', () => {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs || !tabs[0]) return;
        chrome.tabs.sendMessage(tabs[0].id, { type: 'TRIGGER_CAPTURE_SCAN' }, () => {
          window.close();
        });
      });
    }
  });

  // Show on-page widget button
  document.getElementById('btn-show-widget').addEventListener('click', () => {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs || !tabs[0]) return;
        chrome.tabs.sendMessage(tabs[0].id, { type: 'SHOW_WIDGET', tab: 'autofill' }, () => {
          window.close();
        });
      });
    }
  });

  // Open Dashboard button
  document.getElementById('btn-dashboard').addEventListener('click', () => {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open('../dashboard/dashboard.html', '_blank');
    }
  });
});
