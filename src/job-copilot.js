// LocalApply Job Discovery Scanner, Relevance Badge Injector & Multi-Step Auto-Apply Engine
// Supports LinkedIn Easy Apply, Indeed, Glassdoor, Wellfound, BuiltIn, Dice, ZipRecruiter & Direct ATS

(function (global) {
  let copilotState = {
    isRunning: false,
    stopRequested: false,
    currentJobIndex: -1,
    totalSelected: 0,
    completedCount: 0,
    statusLog: 'Idle — Ready to scan job listings.'
  };

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function detectJobBoard(doc = document, loc = window.location) {
    const host = (loc.hostname || '').toLowerCase();
    const sandboxBoard = doc.body && doc.body.getAttribute('data-job-board-platform');
    if (sandboxBoard) {
      return { id: sandboxBoard.toLowerCase(), name: sandboxBoard, isJobBoard: true };
    }
    if (host.includes('linkedin.com')) {
      return { id: 'linkedin', name: 'LinkedIn Jobs', isJobBoard: true };
    }
    if (host.includes('indeed.com')) {
      return { id: 'indeed', name: 'Indeed', isJobBoard: true };
    }
    if (host.includes('glassdoor.com')) {
      return { id: 'glassdoor', name: 'Glassdoor', isJobBoard: true };
    }
    if (host.includes('wellfound.com')) {
      return { id: 'wellfound', name: 'Wellfound', isJobBoard: true };
    }
    if (host.includes('builtin.com')) {
      return { id: 'builtin', name: 'BuiltIn', isJobBoard: true };
    }
    if (host.includes('dice.com')) {
      return { id: 'dice', name: 'Dice', isJobBoard: true };
    }
    if (host.includes('ziprecruiter.com')) {
      return { id: 'ziprecruiter', name: 'ZipRecruiter', isJobBoard: true };
    }
    return { id: 'direct_ats', name: 'Direct ATS / Career Portal', isJobBoard: false };
  }

  /**
   * Scans job cards on LinkedIn, Indeed, Glassdoor, Wellfound, BuiltIn, Dice, ZipRecruiter, or Sandbox
   */
  function scanJobsOnPage(localData, doc = document) {
    const board = detectJobBoard(doc, window.location);

    const cardSelectors = [
      '[data-job-card]',                                   // Sandbox & Universal attribute
      'li[data-occludable-job-id]',                        // LinkedIn Search Feed
      '.job-card-container',                               // LinkedIn Job Card
      '.jobs-search-results__list-item',                   // LinkedIn List Item
      '.job_seen_beacon',                                  // Indeed Job Card
      '[data-test="jobListing"]',                          // Glassdoor Job Card
      '[data-cy="card-title-link"]',                       // Dice Card
      'article.job-result',                                // ZipRecruiter / Generic
      '.job-listing-item'
    ];

    const rawNodes = Array.from(doc.querySelectorAll(cardSelectors.join(', ')));
    // Deduplicate nested card containers
    const cardElements = rawNodes.filter(
      (node, idx) => !rawNodes.some((other, otherIdx) => otherIdx !== idx && other.contains(node))
    );

    const discoveredJobs = [];
    const seenIds = new Set();

    cardElements.forEach((cardEl, index) => {
      const jobId =
        cardEl.getAttribute('data-job-id') ||
        cardEl.getAttribute('data-occludable-job-id') ||
        cardEl.getAttribute('data-jk') ||
        cardEl.id ||
        `job_card_${index}`;

      if (seenIds.has(jobId)) return;
      seenIds.add(jobId);

      const titleEl = cardEl.querySelector(
        '[data-job-title], .job-card-list__title, .job-card-container__link, .jobTitle, [data-test="job-title"], h2, h3, a strong'
      );
      const companyEl = cardEl.querySelector(
        '[data-job-company], .job-card-container__primary-description, .artdeco-entity-lockup__subtitle, [data-testid="company-name"], .companyName, [data-test="employer-name"]'
      );
      const locationEl = cardEl.querySelector(
        '[data-job-location], .job-card-container__metadata-item, .artdeco-entity-lockup__caption, [data-testid="text-location"], .companyLocation, [data-test="emp-location"]'
      );
      const descEl = cardEl.querySelector(
        '[data-job-snippet], .job-card-list__footer-wrapper, .job-snippet, p'
      );

      const title = (titleEl ? titleEl.textContent : cardEl.getAttribute('data-title') || '').replace(/\s+/g, ' ').trim();
      if (!title) return;

      const company = (companyEl ? companyEl.textContent : cardEl.getAttribute('data-company') || 'Company')
        .replace(/\s+/g, ' ')
        .trim();
      const location = (locationEl ? locationEl.textContent : cardEl.getAttribute('data-location') || 'Remote')
        .replace(/\s+/g, ' ')
        .trim();
      const description = (
        cardEl.getAttribute('data-description') ||
        (descEl ? descEl.textContent : '') ||
        cardEl.innerText ||
        ''
      )
        .replace(/\s+/g, ' ')
        .trim();

      const isEasyApply =
        cardEl.getAttribute('data-easy-apply') === 'true' ||
        /easy\s*apply|easily\s*apply|instant\s*apply|1-click\s*apply/i.test(cardEl.innerText || '');

      const linkEl = cardEl.querySelector('a[href]');
      const url = linkEl ? linkEl.href : window.location.href;

      const rawJob = {
        jobId,
        title,
        company,
        location,
        description,
        isEasyApply,
        url,
        platform: board.name,
        cardElement: cardEl
      };

      const scoreResult = global.LocalApplyResumeParser.scoreJobListing(rawJob, localData);
      injectBadgeOnJobCard(cardEl, scoreResult, isEasyApply);

      discoveredJobs.push({
        ...rawJob,
        scoreResult,
        selected: scoreResult.eligible
      });
    });

    // Sort highest match score first in the returned list
    return discoveredJobs.sort((a, b) => b.scoreResult.score - a.scoreResult.score);
  }

  function injectBadgeOnJobCard(cardEl, scoreResult, isEasyApply) {
    if (!cardEl) return;
    let badge = cardEl.querySelector('.localapply-job-match-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.className = 'localapply-job-match-badge localapply-ignore';
      badge.style.cssText =
        'display:inline-flex;align-items:center;gap:6px;padding:3px 9px;border-radius:999px;font-size:11px;font-weight:700;margin-top:6px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;';
      cardEl.appendChild(badge);
    }

    if (scoreResult.alreadyApplied) {
      badge.style.background = '#dbeafe';
      badge.style.color = '#1e40af';
      badge.style.border = '1px solid #93c5fd';
      badge.textContent = `✓ Applied Locally (${scoreResult.score}% Match)`;
    } else if (scoreResult.blacklisted) {
      badge.style.background = '#fee2e2';
      badge.style.color = '#991b1b';
      badge.style.border = '1px solid #fca5a5';
      badge.textContent = `⛔ Skipped (${scoreResult.blacklistReason})`;
    } else if (scoreResult.score >= 75) {
      badge.style.background = '#d1fae5';
      badge.style.color = '#065f46';
      badge.style.border = '1px solid #6ee7b7';
      badge.textContent = `🎯 ${scoreResult.score}% Resume Match${isEasyApply ? ' · ⚡ Easy Apply' : ''}`;
    } else if (scoreResult.score >= 55) {
      badge.style.background = '#fef3c7';
      badge.style.color = '#92400e';
      badge.style.border = '1px solid #fcd34d';
      badge.textContent = `⚖️ ${scoreResult.score}% Resume Match`;
    } else {
      badge.style.background = '#f1f5f9';
      badge.style.color = '#64748b';
      badge.style.border = '1px solid #cbd5e1';
      badge.textContent = `Low Match (${scoreResult.score}%)`;
    }
  }

  /**
   * Executes multi-step application on a single job (LinkedIn Easy Apply modal, Indeed Apply, or Direct ATS form)
   */
  async function applyToSingleJob(jobItem, localData, onProgress) {
    const prefs = (localData.autoApply && localData.autoApply.preferences) || {};
    const executionMode = prefs.executionMode || 'semi_auto'; // 'semi_auto' | 'full_auto'
    const delayMs = Math.max(300, Number(prefs.stepDelayMs || 900));

    const log = (msg) => {
      copilotState.statusLog = msg;
      if (onProgress) onProgress(copilotState);
    };

    // 1. Click job card to load its detail pane / modal trigger
    if (jobItem.cardElement) {
      const clickTarget =
        jobItem.cardElement.querySelector('[data-job-clickable], a, .job-card-list__title') ||
        jobItem.cardElement;
      clickTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
      clickTarget.click();
      log(`Selected "${jobItem.title}" at ${jobItem.company} (${jobItem.scoreResult.score}% match)...`);
      await sleep(delayMs);
    }

    if (copilotState.stopRequested) return { status: 'Stopped' };

    // 2. Find & click Easy Apply / Apply Now button if not already inside an open modal
    const findOpenModal = () =>
      document.querySelector(
        '[data-easy-apply-modal]:not([hidden]), .jobs-easy-apply-modal, .artdeco-modal[role="dialog"], .ia-BasePage'
      );

    if (!findOpenModal()) {
      const applyBtn = document.querySelector(
        '[data-easy-apply-btn], button.jobs-apply-button, button[aria-label*="Easy Apply"], .ia-IndeedApplyButton, [data-testid="apply-button"]'
      );

      if (applyBtn && !applyBtn.disabled) {
        log(`Opening Easy Apply modal for ${jobItem.company}...`);
        applyBtn.click();
        await sleep(delayMs);
      }
    }

    // 3. Step through modal steps (or single-page form) up to 10 steps
    const MAX_STEPS = 10;
    for (let step = 1; step <= MAX_STEPS; step++) {
      if (copilotState.stopRequested) return { status: 'Stopped' };

      const activeModal = findOpenModal() || document;
      const rawFields = global.LocalApplyAdapters.scanPageFields(activeModal);

      let filledOnStep = 0;
      for (const sf of rawFields) {
        const matchResult = global.LocalApplyMatcher.matchField(sf.descriptor, localData);
        if (matchResult.matched) {
          const ok = await global.LocalApplyAdapters.fillSingleField(sf, matchResult, {
            overwriteExistingValues: true,
            highlightFilledFields: true
          });
          if (ok) filledOnStep++;
        }
      }

      log(`Step ${step}: Autofilled ${filledOnStep} field(s) for ${jobItem.title}...`);
      await sleep(Math.round(delayMs * 0.8));

      // Check for Submit button first
      const submitBtn = activeModal.querySelector(
        '[data-easy-apply-submit], button[aria-label*="Submit application"], button[data-control-name="submit_unify"]'
      ) || Array.from(activeModal.querySelectorAll('button')).find((b) =>
        /^(submit\s+application|submit)$/i.test((b.textContent || '').trim())
      );

      if (submitBtn && !submitBtn.disabled && submitBtn.offsetParent !== null) {
        if (executionMode === 'semi_auto') {
          // Pause before clicking Submit so the user can review!
          submitBtn.style.boxShadow = '0 0 0 4px rgba(245, 158, 11, 0.6)';
          log(`Paused at Final Submit for "${jobItem.title}" (Review & click Submit).`);
          await global.LocalApplyStorage.recordAppliedJob({
            ...jobItem,
            matchScore: jobItem.scoreResult.score,
            status: 'Ready for Review (Paused Before Submit)'
          });
          return { status: 'PausedForReview' };
        } else {
          // Full Auto-Apply Mode: click Submit application!
          log(`Submitting application to ${jobItem.company}...`);
          submitBtn.click();
          await sleep(delayMs);

          // Dismiss post-submission confirmation dialog if present
          const dismissBtn = document.querySelector(
            '[data-modal-dismiss], button[aria-label="Dismiss"], button[aria-label="Done"]'
          );
          if (dismissBtn) {
            dismissBtn.click();
            await sleep(300);
          }

          await global.LocalApplyStorage.recordAppliedJob({
            ...jobItem,
            matchScore: jobItem.scoreResult.score,
            status: 'Applied (Full Auto)'
          });

          log(`✓ Successfully applied to "${jobItem.title}" at ${jobItem.company}!`);
          return { status: 'Applied' };
        }
      }

      // Check for Review button
      const reviewBtn = activeModal.querySelector(
        '[data-easy-apply-review], button[aria-label*="Review your application"]'
      ) || Array.from(activeModal.querySelectorAll('button')).find((b) =>
        /^review$/i.test((b.textContent || '').trim())
      );

      if (reviewBtn && !reviewBtn.disabled && reviewBtn.offsetParent !== null) {
        log(`Step ${step}: Advancing to Review step...`);
        reviewBtn.click();
        await sleep(delayMs);
        continue;
      }

      // Check for Next / Continue button
      const nextBtn = activeModal.querySelector(
        '[data-easy-apply-next], button[aria-label*="Continue to next step"]'
      ) || Array.from(activeModal.querySelectorAll('button')).find((b) =>
        /^(next|continue|save\s*&\s*continue)$/i.test((b.textContent || '').trim())
      );

      if (nextBtn && !nextBtn.disabled && nextBtn.offsetParent !== null) {
        log(`Step ${step}: Clicking Next...`);
        nextBtn.click();
        await sleep(delayMs);
        continue;
      }

      // If no Next/Review/Submit button found, break out
      break;
    }

    return { status: 'FilledCurrentStep' };
  }

  /**
   * Runs the batch auto-applier across all user-selected jobs in the queue
   */
  async function runAutoApplyQueue(selectedJobs, localData, onProgress) {
    if (copilotState.isRunning) return;

    const prefs = (localData.autoApply && localData.autoApply.preferences) || {};
    const executionMode = prefs.executionMode || 'semi_auto';
    const maxApps = Number(prefs.maxApplicationsPerRun || 25);
    const jobsToProcess = selectedJobs.slice(0, maxApps);

    copilotState.isRunning = true;
    copilotState.stopRequested = false;
    copilotState.totalSelected = jobsToProcess.length;
    copilotState.completedCount = 0;

    for (let i = 0; i < jobsToProcess.length; i++) {
      if (copilotState.stopRequested) break;
      copilotState.currentJobIndex = i;
      const jobItem = jobsToProcess[i];

      const freshData = await global.LocalApplyStorage.getData();
      const result = await applyToSingleJob(jobItem, freshData, onProgress);

      copilotState.completedCount++;
      if (onProgress) onProgress(copilotState);

      // In Semi-Auto (Review Before Submit) mode, pause after preparing the first selected job so user can review & submit it
      if (executionMode === 'semi_auto' && result.status === 'PausedForReview') {
        copilotState.isRunning = false;
        if (onProgress) onProgress(copilotState);
        return result;
      }

      await sleep(600);
    }

    copilotState.isRunning = false;
    copilotState.statusLog = copilotState.stopRequested
      ? `Stopped after ${copilotState.completedCount} job(s).`
      : `Finished Auto-Apply run (${copilotState.completedCount}/${copilotState.totalSelected} jobs processed)!`;
    if (onProgress) onProgress(copilotState);
    return { status: 'Completed', count: copilotState.completedCount };
  }

  function requestStop() {
    copilotState.stopRequested = true;
    copilotState.isRunning = false;
    copilotState.statusLog = 'Stopped by user.';
  }

  function getState() {
    return copilotState;
  }

  global.LocalApplyJobCopilot = {
    detectJobBoard,
    scanJobsOnPage,
    applyToSingleJob,
    runAutoApplyQueue,
    requestStop,
    getState
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
