// LocalApply Content Script & On-Page Shadow DOM Controller Widget
// Provides:
// 1. On-demand category & field-level selection for Autofill
// 2. Auto-Capture & Manual Answer Learning to Local Storage
// 3. Resume-to-Jobs Discovery Scanner & Multi-Step Auto-Apply Queue (LinkedIn Easy Apply, Indeed, Glassdoor, etc.)

(function () {
  if (window.__localApplyInjected) return;
  window.__localApplyInjected = true;

  let shadowRoot = null;
  let widgetState = {
    minimized: false,
    activeTab: 'autofill', // 'autofill' | 'capture' | 'autoapply'
    platform: { id: 'universal', name: 'Universal ATS', badgeColor: '#10b981' },
    jobBoard: { id: 'direct_ats', name: 'Direct ATS', isJobBoard: false },
    localData: null,
    scannedItems: [], // { fieldId, scannedField, matchResult, selectedToFill, currentPageValue, selectedToSave }
    discoveredJobs: [], // { jobId, title, company, location, isEasyApply, scoreResult, selected, cardElement }
    statusMessage: ''
  };

  const CATEGORY_META = [
    { key: 'profile', label: 'Profile & Contact', icon: '👤' },
    { key: 'experience', label: 'Experience', icon: '💼' },
    { key: 'education', label: 'Education', icon: '🎓' },
    { key: 'workAuth', label: 'Work Auth', icon: '🛂' },
    { key: 'eeo', label: 'EEO / Demo', icon: '⚖️' },
    { key: 'customQA', label: 'Custom Q&A', icon: '💬' },
    { key: 'files', label: 'Resume / PDF', icon: '📎' }
  ];

  async function initContentScript() {
    widgetState.platform = window.LocalApplyAdapters.detectPlatform(document, window.location);
    widgetState.jobBoard = window.LocalApplyJobCopilot
      ? window.LocalApplyJobCopilot.detectJobBoard(document, window.location)
      : { id: 'direct_ats', name: 'Direct ATS', isJobBoard: false };
    widgetState.localData = await window.LocalApplyStorage.getData();

    // If on a multi-job board feed (like LinkedIn Jobs, Indeed, etc.), default to the Auto-Apply tab
    if (widgetState.jobBoard.isJobBoard) {
      widgetState.activeTab = 'autoapply';
    }

    const shouldMount =
      widgetState.localData.settings.showWidgetOnAllPages ||
      widgetState.jobBoard.isJobBoard ||
      (widgetState.localData.settings.showFloatingWidget &&
        window.LocalApplyAdapters.isLikelyJobApplicationPage(document, window.location));

    if (shouldMount) {
      mountFloatingWidget();
      await refreshScan();
      attachAutoCaptureListeners();
      attachJobFeedWatchers();
    }

    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        handleRuntimeMessage(msg).then(sendResponse);
        return true;
      });
    }
  }

  async function handleRuntimeMessage(msg) {
    if (!msg || !msg.type) return { ok: false };

    if (msg.type === 'PING_PAGE_STATUS') {
      widgetState.localData = await window.LocalApplyStorage.getData();
      await refreshScan();
      return {
        ok: true,
        platform: widgetState.jobBoard.isJobBoard
          ? { id: widgetState.jobBoard.id, name: widgetState.jobBoard.name, badgeColor: '#0284c7' }
          : widgetState.platform,
        totalFields: widgetState.scannedItems.length,
        matchedCount: widgetState.scannedItems.filter((i) => i.matchResult.matched && i.selectedToFill).length,
        jobsCount: widgetState.discoveredJobs.length,
        eligibleJobsCount: widgetState.discoveredJobs.filter((j) => j.selected).length
      };
    }

    if (msg.type === 'SHOW_WIDGET') {
      if (!shadowRoot) mountFloatingWidget();
      widgetState.minimized = false;
      if (msg.tab) widgetState.activeTab = msg.tab;
      await refreshScan();
      renderWidget();
      return { ok: true };
    }

    if (msg.type === 'TRIGGER_AUTOFILL') {
      if (!shadowRoot) mountFloatingWidget();
      widgetState.localData = await window.LocalApplyStorage.getData();
      await refreshScan();
      const filledCount = await executeAutofillSelected();
      return { ok: true, filledCount };
    }

    if (msg.type === 'TRIGGER_CAPTURE_SCAN') {
      if (!shadowRoot) mountFloatingWidget();
      widgetState.minimized = false;
      widgetState.activeTab = 'capture';
      await refreshScan();
      renderWidget();
      return { ok: true };
    }

    if (msg.type === 'TRIGGER_AUTOAPPLY_TAB') {
      if (!shadowRoot) mountFloatingWidget();
      widgetState.minimized = false;
      widgetState.activeTab = 'autoapply';
      await refreshScan();
      renderWidget();
      return { ok: true };
    }

    return { ok: true };
  }

  async function refreshScan() {
    widgetState.localData = await window.LocalApplyStorage.getData();
    widgetState.platform = window.LocalApplyAdapters.detectPlatform(document, window.location);
    widgetState.jobBoard = window.LocalApplyJobCopilot
      ? window.LocalApplyJobCopilot.detectJobBoard(document, window.location)
      : { id: 'direct_ats', name: 'Direct ATS', isJobBoard: false };

    const enabledCats = widgetState.localData.settings.enabledCategories || {};
    const rawFields = window.LocalApplyAdapters.scanPageFields(document);

    const prevSelectedFill = new Map(widgetState.scannedItems.map((i) => [i.fieldId, i.selectedToFill]));
    const prevSelectedSave = new Map(widgetState.scannedItems.map((i) => [i.fieldId, i.selectedToSave]));

    widgetState.scannedItems = rawFields.map((sf) => {
      const matchResult = window.LocalApplyMatcher.matchField(sf.descriptor, widgetState.localData);
      const currentVal = window.LocalApplyAdapters.readCurrentFieldValue(sf);
      const catEnabled = enabledCats[matchResult.category] !== false;

      const defaultFill = matchResult.matched && catEnabled;
      const selectedToFill = prevSelectedFill.has(sf.fieldId)
        ? prevSelectedFill.get(sf.fieldId) && catEnabled
        : defaultFill;

      const isNewOrChanged =
        Boolean(currentVal) &&
        sf.controlType !== 'file' &&
        (!matchResult.matched || String(matchResult.value).trim() !== String(currentVal).trim());

      const selectedToSave = prevSelectedSave.has(sf.fieldId)
        ? prevSelectedSave.get(sf.fieldId)
        : isNewOrChanged || Boolean(currentVal);

      return {
        fieldId: sf.fieldId,
        scannedField: sf,
        matchResult,
        currentPageValue: currentVal,
        isNewOrChanged,
        selectedToFill,
        selectedToSave
      };
    });

    // Scan job listings on the page for Auto-Apply
    if (window.LocalApplyJobCopilot) {
      const prevJobSel = new Map(widgetState.discoveredJobs.map((j) => [j.jobId, j.selected]));
      const scannedJobs = window.LocalApplyJobCopilot.scanJobsOnPage(widgetState.localData, document);
      widgetState.discoveredJobs = scannedJobs.map((j) => ({
        ...j,
        selected: prevJobSel.has(j.jobId) ? prevJobSel.get(j.jobId) : j.scoreResult.eligible
      }));
    }

    const badgeCount =
      widgetState.discoveredJobs.length > 0
        ? widgetState.discoveredJobs.filter((j) => j.selected).length
        : widgetState.scannedItems.filter((i) => i.matchResult.matched).length;

    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      try {
        chrome.runtime.sendMessage({ type: 'UPDATE_BADGE', count: badgeCount });
      } catch (e) {
        // ignore
      }
    }

    if (shadowRoot) {
      renderWidget();
    }
  }

  function attachAutoCaptureListeners() {
    const handleFieldChange = async (e) => {
      const target = e.target;
      if (!target || target.closest?.('#localapply-host-root')) return;

      widgetState.localData = await window.LocalApplyStorage.getData();
      const mode = widgetState.localData.settings.captureMode || 'both';
      if (mode === 'manual') return;

      await refreshScan();
    };

    document.addEventListener('change', handleFieldChange, true);
    document.addEventListener('blur', handleFieldChange, true);
  }

  function attachJobFeedWatchers() {
    window.addEventListener('localapply:jobs-updated', () => {
      refreshScan();
    });

    if (!widgetState.jobBoard.isJobBoard) return;
    let debounceTimer = null;
    const observer = new MutationObserver((mutations) => {
      // Ignore mutations caused by our own badge or widget
      const hasExternalChange = mutations.some((m) => {
        if (!m.target || m.target.id === 'localapply-host-root') return false;
        if (m.target.classList && m.target.classList.contains('localapply-job-match-badge')) return false;
        return m.addedNodes && m.addedNodes.length > 0;
      });
      if (!hasExternalChange) return;

      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        refreshScan();
      }, 650);
    });

    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  async function executeAutofillSelected() {
    let filledCount = 0;
    const settings = widgetState.localData.settings || {};

    for (const item of widgetState.scannedItems) {
      if (!item.selectedToFill || !item.matchResult.matched) continue;
      const ok = await window.LocalApplyAdapters.fillSingleField(item.scannedField, item.matchResult, {
        overwriteExistingValues: settings.overwriteExistingValues,
        highlightFilledFields: settings.highlightFilledFields
      });
      if (ok) filledCount++;
    }

    await refreshScan();
    showStatusToast(`Autofilled ${filledCount} selected field${filledCount === 1 ? '' : 's'} from local storage!`);
    return filledCount;
  }

  async function executeSaveSelectedAnswers() {
    const itemsToSave = [];
    for (const item of widgetState.scannedItems) {
      const val = window.LocalApplyAdapters.readCurrentFieldValue(item.scannedField);
      if (!item.selectedToSave || !val || item.scannedField.controlType === 'file') continue;

      itemsToSave.push({
        question: item.matchResult.displayLabel || item.scannedField.descriptor.label,
        answer: val,
        canonicalKey: item.matchResult.canonicalKey,
        section: item.matchResult.section,
        category: item.matchResult.category
      });
    }

    if (itemsToSave.length === 0) {
      showStatusToast('Select at least one filled answer to save locally.');
      return 0;
    }

    await window.LocalApplyStorage.upsertAnswers(itemsToSave, widgetState.platform.name);
    await refreshScan();
    showStatusToast(`Saved ${itemsToSave.length} answer${itemsToSave.length === 1 ? '' : 's'} to local device storage!`);
    return itemsToSave.length;
  }

  async function executeAutoApplyQueue() {
    const selectedJobs = widgetState.discoveredJobs.filter((j) => j.selected);
    if (selectedJobs.length === 0) {
      showStatusToast('Check at least one job in the queue to apply.');
      return;
    }

    await window.LocalApplyJobCopilot.runAutoApplyQueue(
      selectedJobs,
      widgetState.localData,
      () => {
        renderWidget();
      }
    );

    await refreshScan();
  }

  function showStatusToast(msg) {
    widgetState.statusMessage = msg;
    renderWidget();
    setTimeout(() => {
      if (widgetState.statusMessage === msg) {
        widgetState.statusMessage = '';
        renderWidget();
      }
    }, 3500);
  }

  function mountFloatingWidget() {
    if (document.getElementById('localapply-host-root')) return;

    const host = document.createElement('div');
    host.id = 'localapply-host-root';
    document.documentElement.appendChild(host);

    shadowRoot = host.attachShadow({ mode: 'open' });
    renderWidget();
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderWidget() {
    if (!shadowRoot || !widgetState.localData) return;

    const settings = widgetState.localData.settings || {};
    const enabledCats = settings.enabledCategories || {};
    const captureMode = settings.captureMode || 'both';
    const autoApplyPrefs = (widgetState.localData.autoApply && widgetState.localData.autoApply.preferences) || {};
    const executionMode = autoApplyPrefs.executionMode || 'semi_auto';
    const minMatchScore = Number(autoApplyPrefs.minMatchScore || 65);
    const copilotState = window.LocalApplyJobCopilot
      ? window.LocalApplyJobCopilot.getState()
      : { isRunning: false, statusLog: '' };

    const matchedItems = widgetState.scannedItems.filter((i) => i.matchResult.matched);
    const selectedFillCount = matchedItems.filter((i) => i.selectedToFill).length;

    const capturableItems = widgetState.scannedItems.filter(
      (i) => Boolean(i.currentPageValue) && i.scannedField.controlType !== 'file'
    );
    const newOrChangedCount = capturableItems.filter((i) => i.isNewOrChanged).length;
    const selectedSaveCount = capturableItems.filter((i) => i.selectedToSave).length;

    const selectedJobsCount = widgetState.discoveredJobs.filter((j) => j.selected).length;
    const headerPlatformName = widgetState.jobBoard.isJobBoard
      ? widgetState.jobBoard.name
      : widgetState.platform.name;

    const styles = `
      :host {
        all: initial;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        color: #0f172a;
      }
      * {
        box-sizing: border-box;
      }
      .la-widget {
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 415px;
        max-height: 84vh;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 14px;
        box-shadow: 0 20px 35px -10px rgba(15, 23, 42, 0.22), 0 4px 12px rgba(15, 23, 42, 0.08);
        z-index: 2147483646;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        font-size: 13px;
      }
      .la-pill-minimized {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #0f172a;
        color: #ffffff;
        border-radius: 999px;
        padding: 10px 16px;
        display: flex;
        align-items: center;
        gap: 10px;
        cursor: pointer;
        box-shadow: 0 10px 25px rgba(15, 23, 42, 0.25);
        z-index: 2147483646;
        font-size: 13px;
        font-weight: 600;
        border: 1px solid #334155;
      }
      .la-pill-badge {
        background: #10b981;
        color: #fff;
        border-radius: 999px;
        padding: 2px 8px;
        font-size: 11px;
        font-weight: 700;
      }
      .la-header {
        background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
        color: #ffffff;
        padding: 12px 14px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .la-brand {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .la-brand-title {
        font-weight: 700;
        font-size: 14px;
        letter-spacing: -0.01em;
      }
      .la-platform-tag {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        padding: 2px 7px;
        border-radius: 99px;
        background: ${widgetState.jobBoard.isJobBoard ? '#0284c7' : widgetState.platform.badgeColor};
        color: #fff;
      }
      .la-header-actions {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .la-icon-btn {
        background: rgba(255, 255, 255, 0.12);
        border: none;
        color: #f8fafc;
        border-radius: 6px;
        padding: 4px 8px;
        font-size: 11px;
        cursor: pointer;
        font-weight: 600;
      }
      .la-icon-btn:hover {
        background: rgba(255, 255, 255, 0.22);
      }
      .la-tabs {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        background: #f1f5f9;
        padding: 4px;
        gap: 4px;
        border-bottom: 1px solid #e2e8f0;
      }
      .la-tab {
        border: none;
        background: transparent;
        padding: 7px 6px;
        border-radius: 8px;
        font-size: 11.5px;
        font-weight: 600;
        color: #475569;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
      }
      .la-tab.active {
        background: #ffffff;
        color: #0f172a;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
      }
      .la-count-pill {
        background: #e2e8f0;
        color: #0f172a;
        padding: 1px 5px;
        border-radius: 99px;
        font-size: 10px;
        font-weight: 700;
      }
      .la-count-pill.green {
        background: #d1fae5;
        color: #065f46;
      }
      .la-count-pill.blue {
        background: #dbeafe;
        color: #1e40af;
      }
      .la-count-pill.amber {
        background: #fef3c7;
        color: #92400e;
      }
      .la-body {
        padding: 12px;
        overflow-y: auto;
        max-height: 55vh;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .la-section-label {
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        color: #64748b;
        letter-spacing: 0.03em;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .la-cat-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
      }
      .la-cat-chip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 8px;
        border-radius: 7px;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        border: 1px solid #cbd5e1;
        background: #f8fafc;
        color: #475569;
        user-select: none;
      }
      .la-cat-chip.enabled {
        background: #ecfdf5;
        border-color: #10b981;
        color: #065f46;
      }
      .la-field-list {
        border: 1px solid #e2e8f0;
        border-radius: 9px;
        max-height: 215px;
        overflow-y: auto;
        background: #fcfcfd;
      }
      .la-field-row {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        padding: 7px 10px;
        border-bottom: 1px solid #f1f5f9;
        font-size: 12px;
      }
      .la-field-row:last-child {
        border-bottom: none;
      }
      .la-field-row input[type="checkbox"] {
        margin-top: 2px;
        cursor: pointer;
        accent-color: #10b981;
      }
      .la-field-info {
        flex: 1;
        min-width: 0;
      }
      .la-field-q {
        font-weight: 600;
        color: #1e293b;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .la-field-val {
        color: #059669;
        font-size: 11px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .la-field-val.unmatched {
        color: #94a3b8;
        font-style: italic;
      }
      .la-field-meta {
        font-size: 10px;
        color: #64748b;
      }
      .la-mode-selector {
        display: flex;
        flex-direction: column;
        gap: 5px;
        background: #f8fafc;
        padding: 8px;
        border-radius: 8px;
        border: 1px solid #e2e8f0;
      }
      .la-mode-opt {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        color: #334155;
        cursor: pointer;
      }
      .la-slider-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        background: #f8fafc;
        padding: 7px 10px;
        border-radius: 8px;
        border: 1px solid #e2e8f0;
        font-size: 11.5px;
      }
      .la-slider-row input[type="range"] {
        flex: 1;
        accent-color: #10b981;
      }
      .la-status-bar {
        background: #eff6ff;
        border: 1px solid #bfdbfe;
        color: #1e40af;
        padding: 6px 9px;
        border-radius: 7px;
        font-size: 11px;
        font-weight: 600;
      }
      .la-footer {
        padding: 10px 12px;
        border-top: 1px solid #e2e8f0;
        background: #f8fafc;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .la-btn-row {
        display: flex;
        gap: 8px;
      }
      .la-btn-primary {
        flex: 1;
        background: #10b981;
        color: #ffffff;
        border: none;
        border-radius: 8px;
        padding: 9px 12px;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
        text-align: center;
      }
      .la-btn-primary:hover {
        background: #059669;
      }
      .la-btn-danger {
        flex: 1;
        background: #ef4444;
        color: #ffffff;
        border: none;
        border-radius: 8px;
        padding: 9px 12px;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
      }
      .la-btn-secondary {
        background: #ffffff;
        color: #334155;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        padding: 8px 10px;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
      }
      .la-btn-secondary:hover {
        background: #f1f5f9;
      }
      .la-toast {
        background: #065f46;
        color: #ffffff;
        padding: 7px 10px;
        border-radius: 7px;
        font-size: 11px;
        font-weight: 600;
        text-align: center;
      }
      .la-link-btn {
        background: none;
        border: none;
        color: #0284c7;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        padding: 0;
      }
      .la-local-badge {
        font-size: 10px;
        color: #64748b;
        text-align: center;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
      }
    `;

    if (widgetState.minimized) {
      shadowRoot.innerHTML = `
        <style>${styles}</style>
        <div class="la-pill-minimized" id="la-expand-btn" title="Open LocalApply Autofill & Auto-Applier">
          <span>🔒 LocalApply</span>
          ${
            widgetState.discoveredJobs.length > 0
              ? `<span class="la-pill-badge" style="background:#0284c7">${selectedJobsCount} Jobs Matched</span>`
              : `<span class="la-pill-badge">${selectedFillCount} Fields</span>`
          }
        </div>
      `;
      shadowRoot.getElementById('la-expand-btn').addEventListener('click', () => {
        widgetState.minimized = false;
        renderWidget();
      });
      return;
    }

    const categoryChipsHtml = CATEGORY_META.map((cat) => {
      const isEnabled = enabledCats[cat.key] !== false;
      return `
        <label class="la-cat-chip ${isEnabled ? 'enabled' : ''}" data-cat-key="${cat.key}">
          <input type="checkbox" ${isEnabled ? 'checked' : ''} style="display:none" />
          <span>${cat.icon} ${escapeHtml(cat.label)}</span>
        </label>
      `;
    }).join('');

    const autofillTabHtml = `
      <div class="la-section-label">
        <span>1. Pick Categories On-Demand</span>
        <div>
          <button class="la-link-btn" id="la-cats-all">All</button> ·
          <button class="la-link-btn" id="la-cats-none">None</button>
        </div>
      </div>
      <div class="la-cat-grid">
        ${categoryChipsHtml}
      </div>

      <div class="la-section-label" style="margin-top:4px;">
        <span>2. Pick Individual Fields (${selectedFillCount}/${matchedItems.length} selected)</span>
        <div>
          <button class="la-link-btn" id="la-fields-all">Select All</button> ·
          <button class="la-link-btn" id="la-fields-none">Clear</button>
        </div>
      </div>

      <div class="la-field-list">
        ${
          widgetState.scannedItems.length === 0
            ? `<div style="padding:14px;text-align:center;color:#64748b;">No form fields detected yet. Click <b>Rescan</b> or switch to <b>🚀 Auto-Apply</b> if browsing a job feed.</div>`
            : widgetState.scannedItems
                .map((item) => {
                  const m = item.matchResult;
                  return `
                    <label class="la-field-row">
                      <input
                        type="checkbox"
                        class="la-fill-check"
                        data-field-id="${item.fieldId}"
                        ${item.selectedToFill ? 'checked' : ''}
                        ${!m.matched ? 'disabled' : ''}
                      />
                      <div class="la-field-info">
                        <div class="la-field-q" title="${escapeHtml(m.displayLabel)}">${escapeHtml(m.displayLabel)}</div>
                        <div class="la-field-val ${m.matched ? '' : 'unmatched'}">
                          ${m.matched ? `→ ${escapeHtml(m.value)}` : 'No saved value yet (fill on page to save)'}
                        </div>
                        <div class="la-field-meta">${escapeHtml(m.source)}</div>
                      </div>
                    </label>
                  `;
                })
                .join('')
        }
      </div>
    `;

    const captureTabHtml = `
      <div class="la-section-label">
        <span>Answer Capture Mode</span>
      </div>
      <div class="la-mode-selector">
        <label class="la-mode-opt">
          <input type="radio" name="la_capture_mode" value="both" ${captureMode === 'both' ? 'checked' : ''} />
          <span><b>Both (Recommended):</b> Auto-detect as I fill + Manual Save button</span>
        </label>
        <label class="la-mode-opt">
          <input type="radio" name="la_capture_mode" value="auto" ${captureMode === 'auto' ? 'checked' : ''} />
          <span><b>Option 1:</b> Auto-capture filled fields & ask which to save</span>
        </label>
        <label class="la-mode-opt">
          <input type="radio" name="la_capture_mode" value="manual" ${captureMode === 'manual' ? 'checked' : ''} />
          <span><b>Option 2:</b> Manual only (only when I click Scan & Save)</span>
        </label>
      </div>

      <div class="la-section-label" style="margin-top:4px;">
        <span>Select Filled Answers to Save (${selectedSaveCount}/${capturableItems.length})</span>
        <div>
          <button class="la-link-btn" id="la-save-select-new">New Only</button> ·
          <button class="la-link-btn" id="la-save-select-all">All</button> ·
          <button class="la-link-btn" id="la-save-select-none">None</button>
        </div>
      </div>

      <div class="la-field-list">
        ${
          capturableItems.length === 0
            ? `<div style="padding:14px;text-align:center;color:#64748b;">Type or select answers in the job application form, then select which ones to store locally here.</div>`
            : capturableItems
                .map((item) => {
                  const m = item.matchResult;
                  return `
                    <label class="la-field-row">
                      <input
                        type="checkbox"
                        class="la-save-check"
                        data-field-id="${item.fieldId}"
                        ${item.selectedToSave ? 'checked' : ''}
                      />
                      <div class="la-field-info">
                        <div class="la-field-q">${escapeHtml(m.displayLabel)}</div>
                        <div class="la-field-val">Saved Value: "${escapeHtml(item.currentPageValue)}"</div>
                        <div class="la-field-meta">
                          ${item.isNewOrChanged ? '✨ New / Updated Answer' : '✓ Already matches local storage'}
                          → Stores in <b>${escapeHtml(m.section === 'customQA' ? 'Custom Q&A Bank' : m.section)}</b>
                        </div>
                      </div>
                    </label>
                  `;
                })
                .join('')
        }
      </div>
    `;

    const autoApplyTabHtml = `
      <div class="la-section-label">
        <span>1. Execution Mode</span>
      </div>
      <div class="la-mode-selector">
        <label class="la-mode-opt">
          <input type="radio" name="la_exec_mode" value="semi_auto" ${executionMode === 'semi_auto' ? 'checked' : ''} />
          <span><b>Select & Review Queue:</b> Fill steps & pause before final Submit</span>
        </label>
        <label class="la-mode-opt">
          <input type="radio" name="la_exec_mode" value="full_auto" ${executionMode === 'full_auto' ? 'checked' : ''} />
          <span><b>Full Auto-Apply Loop:</b> Auto-step & submit all selected jobs</span>
        </label>
      </div>

      <div class="la-slider-row">
        <span><b>Min Resume Match:</b> <span id="la-min-score-val">${minMatchScore}%</span></span>
        <input type="range" id="la-min-score-slider" min="20" max="95" step="5" value="${minMatchScore}" />
      </div>

      ${
        copilotState.statusLog
          ? `<div class="la-status-bar">🤖 ${escapeHtml(copilotState.statusLog)}</div>`
          : ''
      }

      <div class="la-section-label">
        <span>2. Discovered Jobs (${selectedJobsCount}/${widgetState.discoveredJobs.length} selected)</span>
        <div>
          <button class="la-link-btn" id="la-jobs-select-eligible">Match ≥${minMatchScore}%</button> ·
          <button class="la-link-btn" id="la-jobs-select-all">All</button> ·
          <button class="la-link-btn" id="la-jobs-select-none">None</button>
        </div>
      </div>

      <div class="la-field-list">
        ${
          widgetState.discoveredJobs.length === 0
            ? `<div style="padding:14px;text-align:center;color:#64748b;">
                No job cards detected on this page yet. Open LinkedIn Jobs, Indeed, Glassdoor, or click <b>⚙️ Local DB</b> → <b>🧠 Resume Auto-Applier</b> to launch tailored searches!
              </div>`
            : widgetState.discoveredJobs
                .map((j) => {
                  const sr = j.scoreResult;
                  const statusNote = sr.alreadyApplied
                    ? '✓ Already Applied'
                    : sr.blacklisted
                    ? `⛔ ${sr.blacklistReason}`
                    : sr.matchedSkills.length > 0
                    ? `Matched Skills: ${sr.matchedSkills.slice(0, 5).join(', ')}`
                    : 'Matched by Role & Seniority';
                  return `
                    <label class="la-field-row">
                      <input
                        type="checkbox"
                        class="la-job-check"
                        data-job-id="${escapeHtml(j.jobId)}"
                        ${j.selected ? 'checked' : ''}
                      />
                      <div class="la-field-info">
                        <div class="la-field-q">${escapeHtml(j.title)} — ${escapeHtml(j.company)}</div>
                        <div class="la-field-val" style="color:${sr.score >= minMatchScore ? '#059669' : '#d97706'}">
                          🎯 ${sr.score}% Match · ${escapeHtml(j.location)} ${j.isEasyApply ? '· ⚡ Easy Apply' : ''}
                        </div>
                        <div class="la-field-meta">${escapeHtml(statusNote)}</div>
                      </div>
                    </label>
                  `;
                })
                .join('')
        }
      </div>
    `;

    let activeBodyHtml = autofillTabHtml;
    if (widgetState.activeTab === 'capture') activeBodyHtml = captureTabHtml;
    if (widgetState.activeTab === 'autoapply') activeBodyHtml = autoApplyTabHtml;

    let primaryActionBtnHtml = `<button class="la-btn-primary" id="la-run-autofill-btn">⚡ Autofill Selected (${selectedFillCount})</button>`;
    if (widgetState.activeTab === 'capture') {
      primaryActionBtnHtml = `<button class="la-btn-primary" id="la-run-save-btn">💾 Save Selected Locally (${selectedSaveCount})</button>`;
    } else if (widgetState.activeTab === 'autoapply') {
      if (copilotState.isRunning) {
        primaryActionBtnHtml = `<button class="la-btn-danger" id="la-stop-autoapply-btn">⏹ Stop Auto-Apply Loop</button>`;
      } else {
        primaryActionBtnHtml = `<button class="la-btn-primary" id="la-run-autoapply-btn">🚀 ${
          executionMode === 'full_auto' ? 'Auto-Apply Selected' : 'Fill & Review Selected'
        } (${selectedJobsCount})</button>`;
      }
    }

    shadowRoot.innerHTML = `
      <style>${styles}</style>
      <div class="la-widget">
        <div class="la-header">
          <div class="la-brand">
            <span>🔒</span>
            <span class="la-brand-title">LocalApply</span>
            <span class="la-platform-tag">${escapeHtml(headerPlatformName)}</span>
          </div>
          <div class="la-header-actions">
            <button class="la-icon-btn" id="la-open-dashboard" title="Open Local Candidate Vault & Resume Matcher">⚙️ Local DB</button>
            <button class="la-icon-btn" id="la-minimize-btn" title="Minimize widget">—</button>
          </div>
        </div>

        <div class="la-tabs">
          <button class="la-tab ${widgetState.activeTab === 'autofill' ? 'active' : ''}" id="la-tab-autofill">
            <span>⚡ Autofill</span>
            <span class="la-count-pill green">${selectedFillCount}</span>
          </button>
          <button class="la-tab ${widgetState.activeTab === 'autoapply' ? 'active' : ''}" id="la-tab-autoapply">
            <span>🚀 Auto-Apply</span>
            <span class="la-count-pill blue">${selectedJobsCount}</span>
          </button>
          <button class="la-tab ${widgetState.activeTab === 'capture' ? 'active' : ''}" id="la-tab-capture">
            <span>💾 Save Q&A</span>
            <span class="la-count-pill ${newOrChangedCount > 0 ? 'amber' : ''}">${
              newOrChangedCount > 0 ? `${newOrChangedCount}` : capturableItems.length
            }</span>
          </button>
        </div>

        <div class="la-body">
          ${activeBodyHtml}
        </div>

        <div class="la-footer">
          ${widgetState.statusMessage ? `<div class="la-toast">${escapeHtml(widgetState.statusMessage)}</div>` : ''}
          <div class="la-btn-row">
            <button class="la-btn-secondary" id="la-rescan-btn">↻ Rescan</button>
            ${primaryActionBtnHtml}
          </div>
          <div class="la-local-badge">
            <span>🛡️ 100% Stored on Your Local Device · Zero Cloud Calls</span>
          </div>
        </div>
      </div>
    `;

    bindWidgetEvents();
  }

  function bindWidgetEvents() {
    if (!shadowRoot) return;

    const minBtn = shadowRoot.getElementById('la-minimize-btn');
    if (minBtn) {
      minBtn.addEventListener('click', () => {
        widgetState.minimized = true;
        renderWidget();
      });
    }

    const dashBtn = shadowRoot.getElementById('la-open-dashboard');
    if (dashBtn) {
      dashBtn.addEventListener('click', () => {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({ type: 'OPEN_DASHBOARD' });
        } else {
          window.open('../dashboard/dashboard.html', '_blank');
        }
      });
    }

    const tabAutofill = shadowRoot.getElementById('la-tab-autofill');
    if (tabAutofill) {
      tabAutofill.addEventListener('click', async () => {
        widgetState.activeTab = 'autofill';
        await refreshScan();
      });
    }

    const tabAutoApply = shadowRoot.getElementById('la-tab-autoapply');
    if (tabAutoApply) {
      tabAutoApply.addEventListener('click', async () => {
        widgetState.activeTab = 'autoapply';
        await refreshScan();
      });
    }

    const tabCapture = shadowRoot.getElementById('la-tab-capture');
    if (tabCapture) {
      tabCapture.addEventListener('click', async () => {
        widgetState.activeTab = 'capture';
        await refreshScan();
      });
    }

    const rescanBtn = shadowRoot.getElementById('la-rescan-btn');
    if (rescanBtn) {
      rescanBtn.addEventListener('click', async () => {
        await refreshScan();
        showStatusToast('Rescanned fields and job cards on page.');
      });
    }

    const runAutofillBtn = shadowRoot.getElementById('la-run-autofill-btn');
    if (runAutofillBtn) {
      runAutofillBtn.addEventListener('click', () => {
        executeAutofillSelected();
      });
    }

    const runSaveBtn = shadowRoot.getElementById('la-run-save-btn');
    if (runSaveBtn) {
      runSaveBtn.addEventListener('click', () => {
        executeSaveSelectedAnswers();
      });
    }

    const runAutoApplyBtn = shadowRoot.getElementById('la-run-autoapply-btn');
    if (runAutoApplyBtn) {
      runAutoApplyBtn.addEventListener('click', () => {
        executeAutoApplyQueue();
      });
    }

    const stopAutoApplyBtn = shadowRoot.getElementById('la-stop-autoapply-btn');
    if (stopAutoApplyBtn) {
      stopAutoApplyBtn.addEventListener('click', () => {
        if (window.LocalApplyJobCopilot) {
          window.LocalApplyJobCopilot.requestStop();
          renderWidget();
        }
      });
    }

    // Category chip toggles
    shadowRoot.querySelectorAll('.la-cat-chip').forEach((chip) => {
      chip.addEventListener('click', async (e) => {
        e.preventDefault();
        const key = chip.getAttribute('data-cat-key');
        const currentCats = Object.assign({}, widgetState.localData.settings.enabledCategories);
        const nextVal = !(currentCats[key] !== false);
        currentCats[key] = nextVal;

        widgetState.localData.settings.enabledCategories = currentCats;
        await window.LocalApplyStorage.saveData(widgetState.localData);

        for (const item of widgetState.scannedItems) {
          if (item.matchResult.category === key) {
            item.selectedToFill = nextVal && item.matchResult.matched;
          }
        }
        renderWidget();
      });
    });

    const catsAll = shadowRoot.getElementById('la-cats-all');
    if (catsAll) {
      catsAll.addEventListener('click', async () => {
        for (const c of CATEGORY_META) {
          widgetState.localData.settings.enabledCategories[c.key] = true;
        }
        await window.LocalApplyStorage.saveData(widgetState.localData);
        for (const item of widgetState.scannedItems) {
          item.selectedToFill = item.matchResult.matched;
        }
        renderWidget();
      });
    }

    const catsNone = shadowRoot.getElementById('la-cats-none');
    if (catsNone) {
      catsNone.addEventListener('click', async () => {
        for (const c of CATEGORY_META) {
          widgetState.localData.settings.enabledCategories[c.key] = false;
        }
        await window.LocalApplyStorage.saveData(widgetState.localData);
        for (const item of widgetState.scannedItems) {
          item.selectedToFill = false;
        }
        renderWidget();
      });
    }

    // Individual field fill checkboxes
    shadowRoot.querySelectorAll('.la-fill-check').forEach((cb) => {
      cb.addEventListener('change', () => {
        const fid = cb.getAttribute('data-field-id');
        const found = widgetState.scannedItems.find((i) => i.fieldId === fid);
        if (found) {
          found.selectedToFill = cb.checked;
          renderWidget();
        }
      });
    });

    const fieldsAll = shadowRoot.getElementById('la-fields-all');
    if (fieldsAll) {
      fieldsAll.addEventListener('click', () => {
        for (const item of widgetState.scannedItems) {
          if (item.matchResult.matched) item.selectedToFill = true;
        }
        renderWidget();
      });
    }

    const fieldsNone = shadowRoot.getElementById('la-fields-none');
    if (fieldsNone) {
      fieldsNone.addEventListener('click', () => {
        for (const item of widgetState.scannedItems) {
          item.selectedToFill = false;
        }
        renderWidget();
      });
    }

    // Capture mode radio buttons
    shadowRoot.querySelectorAll('input[name="la_capture_mode"]').forEach((radio) => {
      radio.addEventListener('change', async () => {
        if (radio.checked) {
          widgetState.localData.settings.captureMode = radio.value;
          await window.LocalApplyStorage.saveData(widgetState.localData);
          showStatusToast(`Capture mode updated to: ${radio.value.toUpperCase()}`);
        }
      });
    });

    // Individual field save checkboxes
    shadowRoot.querySelectorAll('.la-save-check').forEach((cb) => {
      cb.addEventListener('change', () => {
        const fid = cb.getAttribute('data-field-id');
        const found = widgetState.scannedItems.find((i) => i.fieldId === fid);
        if (found) {
          found.selectedToSave = cb.checked;
          renderWidget();
        }
      });
    });

    const saveSelectNew = shadowRoot.getElementById('la-save-select-new');
    if (saveSelectNew) {
      saveSelectNew.addEventListener('click', () => {
        for (const item of widgetState.scannedItems) {
          item.selectedToSave = Boolean(item.isNewOrChanged);
        }
        renderWidget();
      });
    }

    const saveSelectAll = shadowRoot.getElementById('la-save-select-all');
    if (saveSelectAll) {
      saveSelectAll.addEventListener('click', () => {
        for (const item of widgetState.scannedItems) {
          if (item.currentPageValue) item.selectedToSave = true;
        }
        renderWidget();
      });
    }

    const saveSelectNone = shadowRoot.getElementById('la-save-select-none');
    if (saveSelectNone) {
      saveSelectNone.addEventListener('click', () => {
        for (const item of widgetState.scannedItems) {
          item.selectedToSave = false;
        }
        renderWidget();
      });
    }

    // Auto-Apply Execution Mode radios
    shadowRoot.querySelectorAll('input[name="la_exec_mode"]').forEach((radio) => {
      radio.addEventListener('change', async () => {
        if (radio.checked) {
          widgetState.localData.autoApply.preferences.executionMode = radio.value;
          await window.LocalApplyStorage.saveData(widgetState.localData);
          renderWidget();
        }
      });
    });

    // Min Match Score slider
    const minSlider = shadowRoot.getElementById('la-min-score-slider');
    if (minSlider) {
      minSlider.addEventListener('change', async () => {
        const newMin = Number(minSlider.value);
        widgetState.localData.autoApply.preferences.minMatchScore = newMin;
        await window.LocalApplyStorage.saveData(widgetState.localData);
        for (const j of widgetState.discoveredJobs) {
          j.selected = !j.scoreResult.alreadyApplied && !j.scoreResult.blacklisted && j.scoreResult.score >= newMin;
        }
        renderWidget();
      });
    }

    // Individual Job Queue Checkboxes
    shadowRoot.querySelectorAll('.la-job-check').forEach((cb) => {
      cb.addEventListener('change', () => {
        const jid = cb.getAttribute('data-job-id');
        const found = widgetState.discoveredJobs.find((j) => j.jobId === jid);
        if (found) {
          found.selected = cb.checked;
          renderWidget();
        }
      });
    });

    const jobsEligible = shadowRoot.getElementById('la-jobs-select-eligible');
    if (jobsEligible) {
      jobsEligible.addEventListener('click', () => {
        const minScore = Number(widgetState.localData.autoApply.preferences.minMatchScore || 65);
        for (const j of widgetState.discoveredJobs) {
          j.selected = !j.scoreResult.alreadyApplied && !j.scoreResult.blacklisted && j.scoreResult.score >= minScore;
        }
        renderWidget();
      });
    }

    const jobsAll = shadowRoot.getElementById('la-jobs-select-all');
    if (jobsAll) {
      jobsAll.addEventListener('click', () => {
        for (const j of widgetState.discoveredJobs) {
          if (!j.scoreResult.blacklisted) j.selected = true;
        }
        renderWidget();
      });
    }

    const jobsNone = shadowRoot.getElementById('la-jobs-select-none');
    if (jobsNone) {
      jobsNone.addEventListener('click', () => {
        for (const j of widgetState.discoveredJobs) {
          j.selected = false;
        }
        renderWidget();
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initContentScript);
  } else {
    initContentScript();
  }
})();
