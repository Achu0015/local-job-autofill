// External controller for Live LinkedIn, Greenhouse & Ashby Job Hub + Auto-Apply Simulator
// Strictly external JS (100% Manifest V3 CSP compliant)

(function () {
  const FALLBACK_SAMPLE_JOBS = [
    {
      jobId: 'li_4479305237',
      numericId: '4479305237',
      platform: 'LinkedIn Jobs',
      isLive: true,
      title: 'Software Engineer I, Fullstack (Search)',
      company: 'Affirm',
      location: 'San Francisco, CA / Remote-First',
      url: 'https://www.linkedin.com/jobs/view/software-engineer-i-fullstack-search-at-affirm-4479305237',
      isEasyApply: true,
      description:
        'At Affirm, we exist for the moments that matter. Search has become the default way consumers discover where to shop. What We Look For: Experience working with JavaScript, TypeScript, React, Python, or Kotlin, designing, developing and launching backend systems at scale. USA base pay range: $130,000 - $180,000.'
    },
    {
      jobId: 'li_aws_iam_1',
      platform: 'LinkedIn Jobs',
      isLive: true,
      title: 'Software Development Engineer, AWS IAM Distributed Database System',
      company: 'Amazon Web Services (AWS)',
      location: 'Seattle, WA',
      url: 'https://www.linkedin.com/jobs/search/?keywords=Software%20Development%20Engineer%20AWS%20IAM',
      isEasyApply: true,
      description:
        'Build mission-critical distributed database and identity systems at AWS. Required skills: Java, Go, TypeScript, Python, AWS, Distributed Systems, Microservices, Linux, and SQL/NoSQL databases.'
    },
    {
      jobId: 'li_jpmc_1',
      platform: 'LinkedIn Jobs',
      isLive: true,
      title: 'Software Engineer III (Full Stack / Cloud)',
      company: 'JPMorganChase',
      location: 'New York, NY',
      url: 'https://www.linkedin.com/jobs/search/?keywords=Software%20Engineer%20JPMorganChase',
      isEasyApply: true,
      description:
        'Design and implement scalable cloud-native financial applications using TypeScript, React, Java, Python, AWS, Kubernetes, Docker, PostgreSQL, and Kafka.'
    },
    {
      jobId: 'li_clear_1',
      platform: 'LinkedIn Jobs',
      isLive: true,
      title: 'Software Development Engineer III',
      company: 'CLEAR',
      location: 'New York, NY',
      url: 'https://www.linkedin.com/jobs/search/?keywords=Software%20Development%20Engineer%20CLEAR',
      isEasyApply: true,
      description:
        'Build secure biometric identity platforms using TypeScript, Node.js, React, Go, AWS, PostgreSQL, Redis, and Docker. 5+ years of experience.'
    },
    {
      jobId: 'ashby_linear_1',
      platform: 'Ashby',
      isLive: true,
      title: 'Senior / Staff Fullstack Engineer',
      company: 'Linear',
      location: 'Remote',
      url: 'https://jobs.ashbyhq.com/linear/d3bc1ced-3ce4-4086-a050-555055dbb1ff',
      isEasyApply: true,
      description:
        'Join Linear to build high-craft software for product teams. Stack: TypeScript, JavaScript, React, Node.js, GraphQL, PostgreSQL, and Distributed Sync Engine.'
    },
    {
      jobId: 'gh_stripe_1',
      platform: 'Greenhouse',
      isLive: true,
      title: 'Senior Full-Stack Software Engineer',
      company: 'Stripe',
      location: 'San Francisco, CA / Remote',
      url: 'https://stripe.com/jobs/search',
      isEasyApply: true,
      description:
        'We are looking for a Senior Full-Stack Engineer with 5+ years of experience in TypeScript, JavaScript, React, Ruby, Go, PostgreSQL, AWS, and Distributed Systems.'
    },
    {
      jobId: 'gh_cloudflare_1',
      platform: 'Greenhouse',
      isLive: true,
      title: 'Systems & Platform Software Engineer',
      company: 'Cloudflare',
      location: 'San Francisco, CA / Hybrid',
      url: 'https://boards.greenhouse.io/cloudflare',
      isEasyApply: true,
      description:
        'Architect edge cloud infrastructure using Go, Rust, Python, TypeScript, Kubernetes, Docker, Terraform, Linux, and PostgreSQL.'
    },
    {
      jobId: 'li_sample_105',
      platform: 'LinkedIn Jobs',
      isLive: false,
      title: 'Software Engineer (Excluded Agency Demo)',
      company: 'SpamRecruiters Inc',
      location: 'Remote',
      url: 'https://www.linkedin.com/jobs',
      isEasyApply: true,
      description: 'TypeScript, React, Node.js role at an excluded staffing agency to demonstrate blacklist filtering.'
    }
  ];

  let allJobs = [...FALLBACK_SAMPLE_JOBS];
  let currentFilter = 'All';
  let activeJob = allJobs[0];
  let currentModalStep = 1;

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getFilteredJobs() {
    if (currentFilter === 'All') return allJobs;
    return allJobs.filter((j) => j.platform === currentFilter);
  }

  function updateFilterButtonCounts() {
    const counts = {
      All: allJobs.length,
      'LinkedIn Jobs': allJobs.filter((j) => j.platform === 'LinkedIn Jobs').length,
      Greenhouse: allJobs.filter((j) => j.platform === 'Greenhouse').length,
      Ashby: allJobs.filter((j) => j.platform === 'Ashby').length
    };

    document.querySelectorAll('.board-filter-btn').forEach((btn) => {
      const board = btn.getAttribute('data-board');
      if (board === 'All') {
        btn.textContent = `🌐 All Jobs (${counts.All})`;
      } else if (board === 'LinkedIn Jobs') {
        btn.textContent = `🟦 LinkedIn Jobs (${counts['LinkedIn Jobs']})`;
      } else if (board === 'Greenhouse') {
        btn.textContent = `🟢 Greenhouse Live (${counts.Greenhouse})`;
      } else if (board === 'Ashby') {
        btn.textContent = `🟣 Ashby Live (${counts.Ashby})`;
      }
    });
  }

  function renderFeed() {
    const feedEl = document.getElementById('job-feed-list');
    if (!feedEl) return;

    updateFilterButtonCounts();
    const visibleJobs = getFilteredJobs();
    const countLabel = document.getElementById('feed-count-label');
    if (countLabel) {
      countLabel.textContent = `Job Picks Based on Your Resume (${visibleJobs.length})`;
    }

    if (visibleJobs.length === 0) {
      feedEl.innerHTML = `<div style="padding:20px;color:#64748b;text-align:center;">No jobs in this filter yet. Click <b>🔄 Fetch Real Live Jobs Now</b> above.</div>`;
      return;
    }

    feedEl.innerHTML = visibleJobs
      .map(
        (j) => `
        <div
          class="job-card-container ${activeJob && j.jobId === activeJob.jobId ? 'active' : ''}"
          data-job-card
          data-job-id="${escapeHtml(j.jobId)}"
          data-platform="${escapeHtml(j.platform)}"
          data-easy-apply="${j.isEasyApply !== false}"
          data-description="${escapeHtml(j.description || '')}"
        >
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
            <div class="job-title" data-job-title data-job-clickable>${escapeHtml(j.title)}</div>
            <span class="plat-pill ${j.isLive ? 'live' : ''}">${j.isLive ? '🟢 LIVE · ' : ''}${escapeHtml(j.platform)}</span>
          </div>
          <div class="job-company" data-job-company>${escapeHtml(j.company)}</div>
          <div class="job-loc" data-job-location>${escapeHtml(j.location)} ${j.postedAgo ? `· ${escapeHtml(j.postedAgo)}` : ''}</div>
          <div class="job-snippet" data-job-snippet>${escapeHtml((j.description || '').slice(0, 120))}...</div>
        </div>
      `
      )
      .join('');

    feedEl.querySelectorAll('.job-card-container').forEach((card) => {
      card.addEventListener('click', async () => {
        const id = card.getAttribute('data-job-id');
        activeJob = allJobs.find((m) => m.jobId === id) || visibleJobs[0];
        feedEl.querySelectorAll('.job-card-container').forEach((c) => c.classList.remove('active'));
        card.classList.add('active');
        renderJobDetail();

        // If this is a live LinkedIn job whose full description hasn't been fetched yet, fetch it on demand
        if (
          activeJob &&
          activeJob.numericId &&
          activeJob.description &&
          activeJob.description.includes('Click card or Fetch Details') &&
          window.LocalApplyLiveFetcher
        ) {
          const detail = await window.LocalApplyLiveFetcher.fetchLinkedInJobDetail(activeJob.numericId);
          if (detail && detail.description) {
            activeJob.description = detail.description;
            card.setAttribute('data-description', detail.description);
            renderJobDetail();
            window.dispatchEvent(new CustomEvent('localapply:jobs-updated'));
          }
        }
      });
    });

    // Notify LocalApply content script to rescan & score all cards
    window.dispatchEvent(new CustomEvent('localapply:jobs-updated'));
  }

  function renderJobDetail() {
    const pane = document.getElementById('job-detail-pane');
    if (!pane || !activeJob) return;

    pane.innerHTML = `
      <div class="detail-header">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap;">
          <span class="plat-pill ${activeJob.isLive ? 'live' : ''}">${activeJob.isLive ? '🟢 REAL LIVE POSTING · ' : ''}${escapeHtml(activeJob.platform)}</span>
          <span style="font-size:12px;color:#059669;font-weight:700;">⚡ LocalApply Ready</span>
        </div>
        <h2 style="font-size:20px;">${escapeHtml(activeJob.title)}</h2>
        <p style="font-size:14px;color:#475569;margin-top:4px;">
          <b>${escapeHtml(activeJob.company)}</b> · ${escapeHtml(activeJob.location)}
        </p>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px;">
          <button class="btn-easy-apply" id="btn-open-easy-apply" data-easy-apply-btn>
            ⚡ Easy Apply (3-Step Auto-Fill Modal)
          </button>
          ${
            activeJob.url
              ? `<a href="${escapeHtml(activeJob.url)}" target="_blank" rel="noopener" class="btn-live-link">
                  ↗ Open Real Job Page on ${escapeHtml(activeJob.platform)}
                </a>`
              : ''
          }
        </div>
      </div>
      <h3 style="font-size:15px;margin-bottom:8px;">Job Description & Extracted Requirements</h3>
      <div style="font-size:13.5px;line-height:1.65;color:#334155;white-space:pre-line;">${escapeHtml(
        activeJob.description
      )}</div>
    `;

    const applyBtn = document.getElementById('btn-open-easy-apply');
    if (applyBtn) {
      applyBtn.addEventListener('click', () => {
        openEasyApplyModal(activeJob);
      });
    }
  }

  async function triggerLiveJobsFetch() {
    if (!window.LocalApplyLiveFetcher) return;
    const kwInput = document.getElementById('live-search-keywords');
    const locInput = document.getElementById('live-search-location');
    const statusPill = document.getElementById('live-fetch-status');
    const fetchBtn = document.getElementById('btn-fetch-live-jobs');

    const keywords = (kwInput && kwInput.value.trim()) || 'Software Engineer';
    const location = (locInput && locInput.value.trim()) || 'United States';

    if (statusPill) {
      statusPill.style.color = '#0284c7';
      statusPill.textContent = `⏳ Fetching real live jobs from LinkedIn, Greenhouse & Ashby...`;
    }
    if (fetchBtn) fetchBtn.disabled = true;

    try {
      const liveFetched = await window.LocalApplyLiveFetcher.fetchAllLiveJobs({
        keywords,
        location
      });

      if (liveFetched && liveFetched.length > 0) {
        const markedLive = liveFetched.map((j) => ({ ...j, isLive: true }));
        // Keep the blacklisted sample job at the bottom so user can also see blacklist filtering in action
        const blacklistSample = FALLBACK_SAMPLE_JOBS.find((s) => s.jobId === 'li_sample_105');
        allJobs = blacklistSample ? [...markedLive, blacklistSample] : markedLive;
        activeJob = allJobs[0];
        renderFeed();
        renderJobDetail();
        if (statusPill) {
          statusPill.style.color = '#059669';
          statusPill.textContent = `✓ Pulled ${markedLive.length} REAL live jobs from LinkedIn, Greenhouse & Ashby!`;
        }
      } else {
        if (statusPill) {
          statusPill.style.color = '#d97706';
          statusPill.textContent = `Showing ${allJobs.length} cached/built-in jobs (no live matches returned for query).`;
        }
      }
    } catch (err) {
      if (statusPill) {
        statusPill.style.color = '#d97706';
        statusPill.textContent = `Showing built-in jobs (${err.message || 'offline mode'}).`;
      }
    } finally {
      if (fetchBtn) fetchBtn.disabled = false;
    }
  }

  function openEasyApplyModal(job) {
    currentModalStep = 1;
    const heading = document.getElementById('modal-job-heading');
    if (heading) {
      heading.textContent = `Apply to ${job.company} — ${job.title}`;
    }
    const backdrop = document.getElementById('modal-backdrop');
    if (backdrop) {
      backdrop.hidden = false;
    }
    updateModalStepView();
  }

  function updateModalStepView() {
    const s1 = document.getElementById('step-1');
    const s2 = document.getElementById('step-2');
    const s3 = document.getElementById('step-3');
    if (s1) s1.hidden = currentModalStep !== 1;
    if (s2) s2.hidden = currentModalStep !== 2;
    if (s3) s3.hidden = currentModalStep !== 3;

    const ind = document.getElementById('modal-step-indicator');
    const nextBtn = document.getElementById('btn-modal-next');
    const revBtn = document.getElementById('btn-modal-review');
    const subBtn = document.getElementById('btn-modal-submit');

    if (currentModalStep === 1) {
      if (ind) ind.textContent = 'Step 1 of 3 — Contact Information';
      if (nextBtn) nextBtn.hidden = false;
      if (revBtn) revBtn.hidden = true;
      if (subBtn) subBtn.hidden = true;
    } else if (currentModalStep === 2) {
      if (ind) ind.textContent = 'Step 2 of 3 — Resume & Experience';
      if (nextBtn) nextBtn.hidden = true;
      if (revBtn) revBtn.hidden = false;
      if (subBtn) subBtn.hidden = true;
    } else {
      if (ind) ind.textContent = 'Step 3 of 3 — Work Authorization & Final Review';
      if (nextBtn) nextBtn.hidden = true;
      if (revBtn) revBtn.hidden = true;
      if (subBtn) subBtn.hidden = false;
    }
  }

  async function initSandbox() {
    // Load user's target role & location from LocalApplyStorage if available
    if (window.LocalApplyStorage) {
      try {
        const data = await window.LocalApplyStorage.getData();
        const prefs = (data.autoApply && data.autoApply.preferences) || {};
        const kwInput = document.getElementById('live-search-keywords');
        const locInput = document.getElementById('live-search-location');
        if (kwInput && prefs.targetRoles && prefs.targetRoles[0]) {
          kwInput.value = prefs.targetRoles[0];
        }
        if (locInput && prefs.preferredLocations && prefs.preferredLocations[0]) {
          locInput.value = prefs.preferredLocations[0];
        }
      } catch (e) {
        // ignore
      }
    }

    // Platform filter tabs
    document.querySelectorAll('.board-filter-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.board-filter-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.getAttribute('data-board') || 'All';
        document.body.setAttribute(
          'data-job-board-platform',
          currentFilter === 'All' ? 'LinkedIn Jobs' : currentFilter
        );
        const visible = getFilteredJobs();
        if (visible.length > 0) activeJob = visible[0];
        renderFeed();
        renderJobDetail();
      });
    });

    const fetchBtn = document.getElementById('btn-fetch-live-jobs');
    if (fetchBtn) {
      fetchBtn.addEventListener('click', () => {
        triggerLiveJobsFetch();
      });
    }

    const nextBtn = document.getElementById('btn-modal-next');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        currentModalStep = 2;
        updateModalStepView();
      });
    }

    const revBtn = document.getElementById('btn-modal-review');
    if (revBtn) {
      revBtn.addEventListener('click', () => {
        currentModalStep = 3;
        updateModalStepView();
      });
    }

    const subBtn = document.getElementById('btn-modal-submit');
    if (subBtn) {
      subBtn.addEventListener('click', () => {
        document.getElementById('modal-backdrop').hidden = true;
      });
    }

    const closeBtn = document.getElementById('btn-close-modal');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        document.getElementById('modal-backdrop').hidden = true;
      });
    }

    // Render initial jobs immediately so feed is never empty
    renderFeed();
    renderJobDetail();

    // Then automatically pull REAL live jobs from LinkedIn, Greenhouse, and Ashby!
    await triggerLiveJobsFetch();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSandbox);
  } else {
    initSandbox();
  }
})();
