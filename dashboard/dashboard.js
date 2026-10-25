// LocalApply Dashboard Controller (100% Local Storage + Resume Auto-Applier)

document.addEventListener('DOMContentLoaded', async () => {
  let localData = await window.LocalApplyStorage.getData();
  let qaSearchQuery = '';

  const toastBanner = document.getElementById('toast-banner');
  const storageUsageEl = document.getElementById('storage-usage');
  const qaCountBadge = document.getElementById('qa-count-badge');
  const appliedCountBadge = document.getElementById('applied-count-badge');

  function showToast(msg) {
    toastBanner.textContent = msg;
    toastBanner.style.display = 'block';
    setTimeout(() => {
      toastBanner.style.display = 'none';
    }, 3200);
  }

  async function refreshStorageSize() {
    const bytes = await window.LocalApplyStorage.getStorageSizeBytes();
    const kb = (bytes / 1024).toFixed(1);
    storageUsageEl.textContent = `Local Storage: ${kb} KB`;
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function parseCsvList(str) {
    return String(str || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  // Tab navigation
  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      const targetId = btn.getAttribute('data-tab');
      document.getElementById(targetId).classList.add('active');
    });
  });

  function renderAll() {
    // 0. Auto-Apply & Resume Parser Tab
    renderAutoApplyTab();
    renderAppliedJobsList();

    // 1. Sidebar categories
    const enabledCats = (localData.settings && localData.settings.enabledCategories) || {};
    document.querySelectorAll('#sidebar-cats input[type="checkbox"]').forEach((cb) => {
      const cat = cb.getAttribute('data-cat');
      cb.checked = enabledCats[cat] !== false;
    });

    // 2. Profile inputs
    document.querySelectorAll('[data-profile]').forEach((el) => {
      const key = el.getAttribute('data-profile');
      el.value = (localData.profile && localData.profile[key]) || '';
    });

    // 3. Work Auth & EEO
    document.querySelectorAll('[data-workauth]').forEach((el) => {
      const key = el.getAttribute('data-workauth');
      el.value = (localData.workAuth && localData.workAuth[key]) || '';
    });
    document.querySelectorAll('[data-eeo]').forEach((el) => {
      const key = el.getAttribute('data-eeo');
      el.value = (localData.eeo && localData.eeo[key]) || '';
    });

    // 4. Experience & Education
    renderExperienceList();
    renderEducationList();

    // 5. Custom Q&A Bank
    renderQaList();

    // 6. Files
    renderFilesStatus();

    // 7. Settings & Modes
    const mode = (localData.settings && localData.settings.captureMode) || 'both';
    document.querySelectorAll('input[name="dashCaptureMode"]').forEach((r) => {
      r.checked = r.value === mode;
    });
    document.getElementById('set-show-widget').checked = localData.settings.showFloatingWidget !== false;
    document.getElementById('set-show-all-pages').checked = Boolean(localData.settings.showWidgetOnAllPages);
    document.getElementById('set-highlight').checked = localData.settings.highlightFilledFields !== false;
    document.getElementById('set-overwrite').checked = Boolean(localData.settings.overwriteExistingValues);

    refreshStorageSize();
  }

  function renderAutoApplyTab() {
    if (!localData.autoApply) {
      localData.autoApply = window.LocalApplyStorage.getDefaultSchema().autoApply;
    }
    const parsed = localData.autoApply.parsedResume || {};
    const prefs = localData.autoApply.preferences || {};

    document.getElementById('autoapply-raw-resume').value = parsed.rawText || '';
    const statusBadge = document.getElementById('parse-status-badge');
    if (parsed.lastParsedAt) {
      statusBadge.textContent = `✓ Parsed ${(parsed.extractedSkills || []).length} skills & ${(parsed.extractedTitles || []).length} target role(s)`;
    } else {
      statusBadge.textContent = '';
    }

    const execMode = prefs.executionMode || 'semi_auto';
    document.querySelectorAll('input[name="autoApplyExecMode"]').forEach((r) => {
      r.checked = r.value === execMode;
    });

    const minScore = Number(prefs.minMatchScore || 65);
    document.getElementById('dash-min-score-slider').value = String(minScore);
    document.getElementById('dash-min-score-label').textContent = `${minScore}%`;

    document.getElementById('dash-step-delay').value = String(prefs.stepDelayMs || 900);
    document.getElementById('dash-max-apps').value = String(prefs.maxApplicationsPerRun || 25);
    document.getElementById('dash-target-roles').value = (prefs.targetRoles || []).join(', ');
    document.getElementById('dash-target-skills').value = (prefs.targetSkills || []).join(', ');
    document.getElementById('dash-preferred-locations').value = (prefs.preferredLocations || []).join(', ');
    document.getElementById('dash-blacklist-companies').value = (prefs.blacklistedCompanies || []).join(', ');
    document.getElementById('dash-blacklist-keywords').value = (prefs.blacklistedKeywords || []).join(', ');

    renderPlatformLaunchGrid();
  }

  function renderPlatformLaunchGrid() {
    const grid = document.getElementById('platform-launch-grid');
    if (!grid || !window.LocalApplyResumeParser) return;
    const platforms = window.LocalApplyResumeParser.generatePlatformSearchUrls(localData);

    grid.innerHTML = platforms
      .map(
        (p) => `
      <div class="repeater-card" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
        <div>
          <h4 style="font-size:14px;margin-bottom:3px;">${p.icon} ${escapeHtml(p.name)}</h4>
          <span style="font-size:11px;color:#059669;font-weight:600;">${escapeHtml(p.badge)}</span>
        </div>
        <a href="${escapeHtml(p.url)}" target="_blank" class="btn btn-primary btn-sm">Launch Search ↗</a>
      </div>
    `
      )
      .join('');
  }

  function renderAppliedJobsList() {
    const container = document.getElementById('applied-jobs-list');
    const applied = (localData.autoApply && localData.autoApply.appliedJobs) || [];
    if (appliedCountBadge) appliedCountBadge.textContent = String(applied.length);

    if (applied.length === 0) {
      container.innerHTML = `<p style="color:#64748b;font-size:13px;">No applied jobs recorded yet. Run the <b>🚀 Auto-Applier</b> on LinkedIn Jobs or inside the <b>🟦 LinkedIn Auto-Apply Sandbox</b> to see your local application log!</p>`;
      return;
    }

    container.innerHTML = applied
      .map(
        (job) => `
      <div class="repeater-card" style="display:flex;align-items:center;justify-content:space-between;gap:14px;">
        <div>
          <h4 style="font-size:14px;">${escapeHtml(job.title)} — <span style="color:#0284c7">${escapeHtml(job.company)}</span></h4>
          <p style="font-size:12px;color:#475569;margin-top:2px;">
            📍 ${escapeHtml(job.location || 'Remote')} · 🎯 <b>${job.matchScore || 0}% Match</b> · Platform: <b>${escapeHtml(job.platform || 'LinkedIn')}</b>
          </p>
          <p style="font-size:11px;color:#059669;font-weight:600;margin-top:3px;">
            Status: ${escapeHtml(job.status)} · ${new Date(job.appliedAt || Date.now()).toLocaleString()}
          </p>
        </div>
        <button class="btn btn-danger btn-sm btn-del-applied" data-id="${escapeHtml(job.id)}">Remove</button>
      </div>
    `
      )
      .join('');

    container.querySelectorAll('.btn-del-applied').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        localData.autoApply.appliedJobs = localData.autoApply.appliedJobs.filter((j) => j.id !== id);
        await window.LocalApplyStorage.saveData(localData);
        renderAppliedJobsList();
        showToast('Removed job from local history.');
      });
    });
  }

  function renderExperienceList() {
    const container = document.getElementById('experience-list');
    const list = localData.experience || [];
    if (list.length === 0) {
      container.innerHTML = `<p style="color:#64748b;font-size:13px;">No work experience entries added yet. Click <b>+ Add Work Experience</b> above.</p>`;
      return;
    }

    container.innerHTML = list
      .map(
        (exp, idx) => `
      <div class="repeater-card" data-exp-idx="${idx}">
        <div class="repeater-card-header">
          <h4>Work Experience #${idx + 1} — ${escapeHtml(exp.jobTitle || 'Role')} at ${escapeHtml(exp.company || 'Company')}</h4>
          <button class="btn btn-danger btn-sm btn-del-exp" data-idx="${idx}">Remove</button>
        </div>
        <div class="form-grid">
          <div class="field"><label>Job Title</label><input type="text" class="exp-input" data-idx="${idx}" data-field="jobTitle" value="${escapeHtml(exp.jobTitle)}" /></div>
          <div class="field"><label>Company Name</label><input type="text" class="exp-input" data-idx="${idx}" data-field="company" value="${escapeHtml(exp.company)}" /></div>
          <div class="field"><label>Location</label><input type="text" class="exp-input" data-idx="${idx}" data-field="location" value="${escapeHtml(exp.location)}" /></div>
          <div class="field"><label>Currently Work Here?</label>
            <select class="exp-input" data-idx="${idx}" data-field="currentlyWorkHere">
              <option value="No" ${exp.currentlyWorkHere === 'No' ? 'selected' : ''}>No</option>
              <option value="Yes" ${exp.currentlyWorkHere === 'Yes' ? 'selected' : ''}>Yes</option>
            </select>
          </div>
          <div class="field"><label>Start Date (MM/YYYY)</label><input type="text" class="exp-input" data-idx="${idx}" data-field="startDate" value="${escapeHtml(exp.startDate)}" placeholder="03/2022" /></div>
          <div class="field"><label>End Date (MM/YYYY or Present)</label><input type="text" class="exp-input" data-idx="${idx}" data-field="endDate" value="${escapeHtml(exp.endDate)}" placeholder="Present" /></div>
          <div class="field full-width"><label>Role Description & Key Achievements</label><textarea rows="3" class="exp-input" data-idx="${idx}" data-field="description">${escapeHtml(exp.description)}</textarea></div>
        </div>
      </div>
    `
      )
      .join('');

    container.querySelectorAll('.exp-input').forEach((input) => {
      input.addEventListener('input', () => {
        const idx = Number(input.getAttribute('data-idx'));
        const field = input.getAttribute('data-field');
        localData.experience[idx][field] = input.value;
      });
    });

    container.querySelectorAll('.btn-del-exp').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const idx = Number(btn.getAttribute('data-idx'));
        localData.experience.splice(idx, 1);
        await window.LocalApplyStorage.saveData(localData);
        renderExperienceList();
        showToast('Removed work experience entry.');
      });
    });
  }

  function renderEducationList() {
    const container = document.getElementById('education-list');
    const list = localData.education || [];
    if (list.length === 0) {
      container.innerHTML = `<p style="color:#64748b;font-size:13px;">No education entries added yet. Click <b>+ Add Education</b> above.</p>`;
      return;
    }

    container.innerHTML = list
      .map(
        (edu, idx) => `
      <div class="repeater-card" data-edu-idx="${idx}">
        <div class="repeater-card-header">
          <h4>Education #${idx + 1} — ${escapeHtml(edu.degree || 'Degree')} at ${escapeHtml(edu.school || 'University')}</h4>
          <button class="btn btn-danger btn-sm btn-del-edu" data-idx="${idx}">Remove</button>
        </div>
        <div class="form-grid">
          <div class="field"><label>School or University</label><input type="text" class="edu-input" data-idx="${idx}" data-field="school" value="${escapeHtml(edu.school)}" /></div>
          <div class="field"><label>Degree (e.g., Bachelor of Science)</label><input type="text" class="edu-input" data-idx="${idx}" data-field="degree" value="${escapeHtml(edu.degree)}" /></div>
          <div class="field"><label>Field of Study / Major</label><input type="text" class="edu-input" data-idx="${idx}" data-field="fieldOfStudy" value="${escapeHtml(edu.fieldOfStudy)}" /></div>
          <div class="field"><label>GPA</label><input type="text" class="edu-input" data-idx="${idx}" data-field="gpa" value="${escapeHtml(edu.gpa)}" /></div>
          <div class="field"><label>Start Date / Year</label><input type="text" class="edu-input" data-idx="${idx}" data-field="startDate" value="${escapeHtml(edu.startDate)}" placeholder="2016" /></div>
          <div class="field"><label>End / Graduation Year</label><input type="text" class="edu-input" data-idx="${idx}" data-field="endDate" value="${escapeHtml(edu.endDate)}" placeholder="2020" /></div>
        </div>
      </div>
    `
      )
      .join('');

    container.querySelectorAll('.edu-input').forEach((input) => {
      input.addEventListener('input', () => {
        const idx = Number(input.getAttribute('data-idx'));
        const field = input.getAttribute('data-field');
        localData.education[idx][field] = input.value;
      });
    });

    container.querySelectorAll('.btn-del-edu').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const idx = Number(btn.getAttribute('data-idx'));
        localData.education.splice(idx, 1);
        await window.LocalApplyStorage.saveData(localData);
        renderEducationList();
        showToast('Removed education entry.');
      });
    });
  }

  function renderQaList() {
    const container = document.getElementById('qa-list');
    const allQa = localData.customQA || [];
    qaCountBadge.textContent = String(allQa.length);

    const filtered = allQa.filter((qa) => {
      if (!qaSearchQuery) return true;
      const q = qaSearchQuery.toLowerCase();
      return (
        (qa.question || '').toLowerCase().includes(q) ||
        (qa.answer || '').toLowerCase().includes(q) ||
        (qa.platform || '').toLowerCase().includes(q)
      );
    });

    if (filtered.length === 0) {
      container.innerHTML = `<p style="color:#64748b;font-size:13px;">No matching saved Q&As. Fill out questions on a job page or click <b>+ Add Custom Q&A</b>.</p>`;
      return;
    }

    container.innerHTML = filtered
      .map(
        (qa) => `
      <div class="repeater-card" data-qa-id="${qa.id}">
        <div class="repeater-card-header">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:700;font-size:13px;">
            <input type="checkbox" class="qa-enable-toggle" data-id="${qa.id}" ${qa.enabled !== false ? 'checked' : ''} style="accent-color:#10b981;" />
            <span>Active for Autofill · <span style="color:#059669;">Platform: ${escapeHtml(qa.platform || 'All')}</span></span>
          </label>
          <button class="btn btn-danger btn-sm btn-del-qa" data-id="${qa.id}">Delete</button>
        </div>
        <div class="form-grid">
          <div class="field full-width">
            <label>Question Prompt (Fuzzy-matched across all ATS platforms)</label>
            <input type="text" class="qa-input" data-id="${qa.id}" data-field="question" value="${escapeHtml(qa.question)}" />
          </div>
          <div class="field full-width">
            <label>Your Saved Answer</label>
            <textarea rows="2" class="qa-input" data-id="${qa.id}" data-field="answer">${escapeHtml(qa.answer)}</textarea>
          </div>
        </div>
      </div>
    `
      )
      .join('');

    container.querySelectorAll('.qa-enable-toggle').forEach((cb) => {
      cb.addEventListener('change', async () => {
        const id = cb.getAttribute('data-id');
        const target = localData.customQA.find((q) => q.id === id);
        if (target) {
          target.enabled = cb.checked;
          await window.LocalApplyStorage.saveData(localData);
        }
      });
    });

    container.querySelectorAll('.qa-input').forEach((input) => {
      input.addEventListener('input', () => {
        const id = input.getAttribute('data-id');
        const field = input.getAttribute('data-field');
        const target = localData.customQA.find((q) => q.id === id);
        if (target) {
          target[field] = input.value;
          target.updatedAt = Date.now();
        }
      });
    });

    container.querySelectorAll('.btn-del-qa').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        localData.customQA = localData.customQA.filter((q) => q.id !== id);
        await window.LocalApplyStorage.saveData(localData);
        renderQaList();
        showToast('Deleted custom Q&A entry.');
      });
    });
  }

  function renderFilesStatus() {
    const resumeStatus = document.getElementById('resume-status');
    const coverStatus = document.getElementById('cover-status');

    if (localData.files && localData.files.resume) {
      const r = localData.files.resume;
      resumeStatus.textContent = `✓ Stored locally: ${r.name} (${(r.size / 1024).toFixed(1)} KB)`;
    } else {
      resumeStatus.textContent = 'No resume stored locally yet.';
    }

    if (localData.files && localData.files.coverLetter) {
      const c = localData.files.coverLetter;
      coverStatus.textContent = `✓ Stored locally: ${c.name} (${(c.size / 1024).toFixed(1)} KB)`;
    } else {
      coverStatus.textContent = 'No cover letter stored locally yet.';
    }
  }

  function collectFormStateIntoLocalData() {
    document.querySelectorAll('[data-profile]').forEach((el) => {
      const key = el.getAttribute('data-profile');
      localData.profile[key] = el.value.trim();
    });
    document.querySelectorAll('[data-workauth]').forEach((el) => {
      const key = el.getAttribute('data-workauth');
      localData.workAuth[key] = el.value.trim();
    });
    document.querySelectorAll('[data-eeo]').forEach((el) => {
      const key = el.getAttribute('data-eeo');
      localData.eeo[key] = el.value.trim();
    });

    // Collect Auto-Apply preferences
    if (!localData.autoApply) {
      localData.autoApply = window.LocalApplyStorage.getDefaultSchema().autoApply;
    }
    const prefs = localData.autoApply.preferences;
    prefs.minMatchScore = Number(document.getElementById('dash-min-score-slider').value || 65);
    prefs.stepDelayMs = Number(document.getElementById('dash-step-delay').value || 900);
    prefs.maxApplicationsPerRun = Number(document.getElementById('dash-max-apps').value || 25);
    prefs.targetRoles = parseCsvList(document.getElementById('dash-target-roles').value);
    prefs.targetSkills = parseCsvList(document.getElementById('dash-target-skills').value);
    prefs.preferredLocations = parseCsvList(document.getElementById('dash-preferred-locations').value);
    prefs.blacklistedCompanies = parseCsvList(document.getElementById('dash-blacklist-companies').value);
    prefs.blacklistedKeywords = parseCsvList(document.getElementById('dash-blacklist-keywords').value);
    localData.autoApply.parsedResume.rawText = document.getElementById('autoapply-raw-resume').value;
  }

  // Resume Upload & Parse in Step 1
  document.getElementById('autoapply-resume-upload').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    // Also save binary to localData.files.resume so Easy Apply & ATS forms have the PDF/DOCX ready
    const reader = new FileReader();
    reader.onload = async () => {
      localData.files.resume = {
        name: file.name,
        type: file.type || 'application/pdf',
        size: file.size,
        dataUrl: reader.result,
        updatedAt: Date.now()
      };
      await window.LocalApplyStorage.saveData(localData);
      renderFilesStatus();
    };
    reader.readAsDataURL(file);

    const extractedText = await window.LocalApplyResumeParser.extractTextFromUploadedFile(file);
    if (extractedText) {
      document.getElementById('autoapply-raw-resume').value = extractedText;
      runResumeParseAndSync(extractedText);
    } else {
      showToast('Stored resume file! Paste resume text below if your PDF is scanned/image-based.');
    }
  });

  document.getElementById('btn-parse-resume-text').addEventListener('click', () => {
    const rawText = document.getElementById('autoapply-raw-resume').value.trim();
    if (!rawText) {
      showToast('Paste your resume text or upload a resume file first.');
      return;
    }
    runResumeParseAndSync(rawText);
  });

  async function runResumeParseAndSync(rawText) {
    const parsed = window.LocalApplyResumeParser.parseResumeText(rawText);
    localData.autoApply.parsedResume = parsed;

    // Sync extracted skills & titles into preferences
    if (parsed.extractedTitles.length > 0) {
      localData.autoApply.preferences.targetRoles = parsed.extractedTitles;
    }
    if (parsed.extractedSkills.length > 0) {
      localData.autoApply.preferences.targetSkills = parsed.extractedSkills;
    }

    // Sync non-empty contact fields into profile
    if (parsed.firstName && !localData.profile.firstName) localData.profile.firstName = parsed.firstName;
    if (parsed.lastName && !localData.profile.lastName) localData.profile.lastName = parsed.lastName;
    if (parsed.fullName && !localData.profile.fullName) localData.profile.fullName = parsed.fullName;
    if (parsed.email && !localData.profile.email) localData.profile.email = parsed.email;
    if (parsed.phone && !localData.profile.phone) localData.profile.phone = parsed.phone;
    if (parsed.city && !localData.profile.city) localData.profile.city = parsed.city;
    if (parsed.state && !localData.profile.state) localData.profile.state = parsed.state;
    if (parsed.linkedin && !localData.profile.linkedin) localData.profile.linkedin = parsed.linkedin;
    if (parsed.github && !localData.profile.github) localData.profile.github = parsed.github;
    if (parsed.yearsOfExperience) localData.profile.yearsOfExperience = parsed.yearsOfExperience;

    await window.LocalApplyStorage.saveData(localData);
    renderAll();
    showToast(
      `Parsed resume locally: found ${parsed.extractedSkills.length} skills & ${parsed.extractedTitles.length} target role(s)!`
    );
  }

  // Auto-Apply Execution Mode & Slider listeners
  document.querySelectorAll('input[name="autoApplyExecMode"]').forEach((r) => {
    r.addEventListener('change', async () => {
      if (r.checked) {
        localData.autoApply.preferences.executionMode = r.value;
        await window.LocalApplyStorage.saveData(localData);
        showToast(
          `Auto-Apply mode set to: ${r.value === 'full_auto' ? 'Full Auto-Apply Loop' : 'Select & Review Queue'}`
        );
      }
    });
  });

  document.getElementById('dash-min-score-slider').addEventListener('input', (e) => {
    document.getElementById('dash-min-score-label').textContent = `${e.target.value}%`;
  });

  document.getElementById('dash-min-score-slider').addEventListener('change', async (e) => {
    localData.autoApply.preferences.minMatchScore = Number(e.target.value);
    await window.LocalApplyStorage.saveData(localData);
  });

  [
    'dash-target-roles',
    'dash-target-skills',
    'dash-preferred-locations',
    'dash-blacklist-companies',
    'dash-blacklist-keywords',
    'dash-step-delay',
    'dash-max-apps'
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', async () => {
        collectFormStateIntoLocalData();
        await window.LocalApplyStorage.saveData(localData);
        renderPlatformLaunchGrid();
      });
    }
  });

  // Applied Jobs History Export & Clear
  document.getElementById('btn-export-applied-csv').addEventListener('click', () => {
    const applied = (localData.autoApply && localData.autoApply.appliedJobs) || [];
    if (applied.length === 0) {
      showToast('No applied jobs to export yet.');
      return;
    }
    const headers = ['Job Title', 'Company', 'Location', 'Platform', 'Match Score %', 'Status', 'Applied At', 'URL'];
    const rows = applied.map((j) =>
      [
        j.title,
        j.company,
        j.location,
        j.platform,
        j.matchScore,
        j.status,
        new Date(j.appliedAt || Date.now()).toISOString(),
        j.url
      ]
        .map((v) => `"${String(v || '').replace(/"/g, '""')}"`)
        .join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `localapply-applied-jobs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported Applied Jobs History to CSV.');
  });

  document.getElementById('btn-clear-applied').addEventListener('click', async () => {
    if (confirm('Clear your local applied jobs history?')) {
      localData.autoApply.appliedJobs = [];
      await window.LocalApplyStorage.saveData(localData);
      renderAppliedJobsList();
      showToast('Cleared applied jobs history.');
    }
  });

  // Save All button
  document.getElementById('btn-save-all').addEventListener('click', async () => {
    collectFormStateIntoLocalData();
    await window.LocalApplyStorage.saveData(localData);
    renderPlatformLaunchGrid();
    await refreshStorageSize();
    showToast('All changes saved to local device storage!');
  });

  // Add Experience
  document.getElementById('btn-add-exp').addEventListener('click', async () => {
    collectFormStateIntoLocalData();
    localData.experience.push({
      jobTitle: '',
      company: '',
      location: '',
      startDate: '',
      endDate: 'Present',
      currentlyWorkHere: 'Yes',
      description: ''
    });
    await window.LocalApplyStorage.saveData(localData);
    renderExperienceList();
  });

  // Add Education
  document.getElementById('btn-add-edu').addEventListener('click', async () => {
    collectFormStateIntoLocalData();
    localData.education.push({
      school: '',
      degree: 'Bachelor of Science',
      fieldOfStudy: 'Computer Science',
      gpa: '',
      startDate: '',
      endDate: ''
    });
    await window.LocalApplyStorage.saveData(localData);
    renderEducationList();
  });

  // Add Custom Q&A
  document.getElementById('btn-add-qa').addEventListener('click', async () => {
    collectFormStateIntoLocalData();
    localData.customQA.unshift({
      id: 'qa_' + Date.now(),
      question: 'Why are you interested in working at our company?',
      answer: '',
      category: 'customQA',
      enabled: true,
      platform: 'All',
      updatedAt: Date.now()
    });
    await window.LocalApplyStorage.saveData(localData);
    renderQaList();
  });

  document.getElementById('qa-search').addEventListener('input', (e) => {
    qaSearchQuery = e.target.value.trim();
    renderQaList();
  });

  document.getElementById('btn-qa-enable-all').addEventListener('click', async () => {
    localData.customQA.forEach((q) => (q.enabled = true));
    await window.LocalApplyStorage.saveData(localData);
    renderQaList();
  });

  document.getElementById('btn-qa-disable-all').addEventListener('click', async () => {
    localData.customQA.forEach((q) => (q.enabled = false));
    await window.LocalApplyStorage.saveData(localData);
    renderQaList();
  });

  // Sidebar Category Checkboxes
  document.querySelectorAll('#sidebar-cats input[type="checkbox"]').forEach((cb) => {
    cb.addEventListener('change', async () => {
      const cat = cb.getAttribute('data-cat');
      localData.settings.enabledCategories[cat] = cb.checked;
      await window.LocalApplyStorage.saveData(localData);
      showToast(`Category "${cat}" ${cb.checked ? 'enabled' : 'disabled'}.`);
    });
  });

  // File Uploads (Resume & Cover Letter)
  function handleFileStore(inputEl, fileKey) {
    inputEl.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        localData.files[fileKey] = {
          name: file.name,
          type: file.type || 'application/pdf',
          size: file.size,
          dataUrl: reader.result,
          updatedAt: Date.now()
        };
        await window.LocalApplyStorage.saveData(localData);
        renderFilesStatus();
        await refreshStorageSize();
        showToast(`Stored "${file.name}" in local device storage!`);
      };
      reader.readAsDataURL(file);
    });
  }

  handleFileStore(document.getElementById('input-resume-file'), 'resume');
  handleFileStore(document.getElementById('input-cover-file'), 'coverLetter');

  document.getElementById('btn-clear-resume').addEventListener('click', async () => {
    localData.files.resume = null;
    await window.LocalApplyStorage.saveData(localData);
    renderFilesStatus();
    await refreshStorageSize();
    showToast('Removed stored resume.');
  });

  document.getElementById('btn-clear-cover').addEventListener('click', async () => {
    localData.files.coverLetter = null;
    await window.LocalApplyStorage.saveData(localData);
    renderFilesStatus();
    await refreshStorageSize();
    showToast('Removed stored cover letter.');
  });

  // Settings & Modes
  document.querySelectorAll('input[name="dashCaptureMode"]').forEach((r) => {
    r.addEventListener('change', async () => {
      if (r.checked) {
        localData.settings.captureMode = r.value;
        await window.LocalApplyStorage.saveData(localData);
        showToast(`Capture mode updated to: ${r.value.toUpperCase()}`);
      }
    });
  });

  ['set-show-widget', 'set-show-all-pages', 'set-highlight', 'set-overwrite'].forEach((id) => {
    document.getElementById(id).addEventListener('change', async () => {
      localData.settings.showFloatingWidget = document.getElementById('set-show-widget').checked;
      localData.settings.showWidgetOnAllPages = document.getElementById('set-show-all-pages').checked;
      localData.settings.highlightFilledFields = document.getElementById('set-highlight').checked;
      localData.settings.overwriteExistingValues = document.getElementById('set-overwrite').checked;
      await window.LocalApplyStorage.saveData(localData);
      showToast('Updated behavior settings.');
    });
  });

  // Load Demo Profile Button
  document.getElementById('btn-load-demo').addEventListener('click', async () => {
    const samplePdfContent = '%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF';
    const samplePdfBase64 = 'data:application/pdf;base64,' + btoa(samplePdfContent);

    const sampleResumeText = `Alex Rivera
San Francisco, CA | alex.rivera@example.com | +1 (415) 555-0192
https://www.linkedin.com/in/alexrivera | https://github.com/alexrivera

SUMMARY
Senior Software Engineer & Full Stack Engineer with 7+ years of experience building distributed systems, cloud infrastructure, and real-time web applications.

TECHNICAL SKILLS
TypeScript, JavaScript, Python, Go, SQL, React, Next.js, Node.js, GraphQL, PostgreSQL, Redis, Kafka, AWS, Docker, Kubernetes, Terraform, CI/CD, Microservices, Distributed Systems, System Design.

WORK EXPERIENCE
Senior Full-Stack Engineer | CloudScale Systems | 2022 - Present
- Architected real-time telemetry pipeline handling 50k req/sec using Go, TypeScript, Kafka, and PostgreSQL on AWS & Kubernetes.
Software Engineer | Horizon Fintech | 2019 - 2022
- Built core payment settlement microservices with Python, Node.js, React, and Docker.`;

    localData.profile = {
      firstName: 'Alex',
      middleName: 'J.',
      lastName: 'Rivera',
      fullName: 'Alex Rivera',
      preferredName: 'Alex',
      email: 'alex.rivera@example.com',
      phone: '+1 (415) 555-0192',
      phoneType: 'Mobile',
      addressLine1: '742 Market Street',
      addressLine2: 'Suite 400',
      city: 'San Francisco',
      state: 'California',
      postalCode: '94103',
      country: 'United States',
      linkedin: 'https://www.linkedin.com/in/alexrivera',
      github: 'https://github.com/alexrivera',
      portfolio: 'https://alexrivera.dev',
      twitter: 'https://x.com/alexrivera',
      otherUrl: '',
      currentCompany: 'CloudScale Systems',
      currentTitle: 'Senior Full-Stack Engineer',
      yearsOfExperience: '7',
      desiredSalary: '$190,000',
      noticePeriod: '2 weeks',
      earliestStartDate: '2 weeks after offer',
      referralSource: 'LinkedIn Job Board',
      summary: 'Senior Full-Stack & Distributed Systems Engineer with 7+ years of experience building high-throughput web applications and cloud infrastructure.'
    };

    localData.experience = [
      {
        jobTitle: 'Senior Full-Stack Engineer',
        company: 'CloudScale Systems',
        location: 'San Francisco, CA',
        startDate: '04/2022',
        endDate: 'Present',
        currentlyWorkHere: 'Yes',
        description: 'Led architecture of real-time telemetry pipeline handling 50k req/sec using TypeScript, Go, and PostgreSQL.'
      },
      {
        jobTitle: 'Software Engineer II',
        company: 'Horizon Fintech',
        location: 'New York, NY',
        startDate: '06/2019',
        endDate: '03/2022',
        currentlyWorkHere: 'No',
        description: 'Built core payment settlement APIs and React customer onboarding flows.'
      }
    ];

    localData.education = [
      {
        school: 'University of California, Berkeley',
        degree: 'Bachelor of Science',
        fieldOfStudy: 'Computer Science',
        gpa: '3.85',
        startDate: '2015',
        endDate: '2019'
      }
    ];

    localData.customQA = [
      {
        id: 'qa_demo_1',
        question: 'How did you hear about this opportunity?',
        answer: 'LinkedIn / Company Engineering Blog',
        category: 'customQA',
        enabled: true,
        platform: 'All',
        updatedAt: Date.now()
      },
      {
        id: 'qa_demo_2',
        question: 'Why do you want to work at our company?',
        answer: 'I am excited by your engineering culture, product velocity, and the opportunity to contribute to high-impact distributed systems.',
        category: 'customQA',
        enabled: true,
        platform: 'Greenhouse / Ashby',
        updatedAt: Date.now()
      },
      {
        id: 'qa_demo_3',
        question: 'What are your salary or compensation expectations?',
        answer: '$190,000 base salary (flexible based on total compensation package)',
        category: 'customQA',
        enabled: true,
        platform: 'All',
        updatedAt: Date.now()
      }
    ];

    localData.files.resume = {
      name: 'Alex_Rivera_Resume_2026.pdf',
      type: 'application/pdf',
      size: samplePdfContent.length,
      dataUrl: samplePdfBase64,
      updatedAt: Date.now()
    };

    const parsedDemo = window.LocalApplyResumeParser.parseResumeText(sampleResumeText);
    localData.autoApply = {
      parsedResume: parsedDemo,
      preferences: {
        executionMode: 'semi_auto',
        minMatchScore: 65,
        targetRoles: parsedDemo.extractedTitles,
        targetSkills: parsedDemo.extractedSkills,
        preferredLocations: ['Remote', 'San Francisco', 'New York'],
        remoteOnly: false,
        easyApplyOnly: false,
        blacklistedCompanies: ['SpamRecruiters Inc'],
        blacklistedKeywords: ['Unpaid', 'Commission Only'],
        stepDelayMs: 700,
        maxApplicationsPerRun: 25
      },
      appliedJobs: localData.autoApply ? localData.autoApply.appliedJobs || [] : []
    };

    await window.LocalApplyStorage.saveData(localData);
    renderAll();
    showToast('Loaded Demo Resume, Extracted 20 Skills, and Configured Auto-Applier!');
  });

  // Export JSON
  document.getElementById('btn-export-json').addEventListener('click', () => {
    collectFormStateIntoLocalData();
    const blob = new Blob([JSON.stringify(localData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `localapply-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported local database to JSON file.');
  });

  // Import JSON
  document.getElementById('input-import-json').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(reader.result);
        localData = await window.LocalApplyStorage.saveData(parsed);
        renderAll();
        showToast('Imported local JSON backup successfully!');
      } catch (err) {
        alert('Invalid JSON backup file.');
      }
    };
    reader.readAsText(file);
  });

  // Wipe All Local Data
  document.getElementById('btn-wipe-data').addEventListener('click', async () => {
    if (confirm('Are you sure you want to wipe all locally stored profile data, resumes, and custom Q&As?')) {
      localData = await window.LocalApplyStorage.clearAllData();
      renderAll();
      showToast('Wiped all local storage data.');
    }
  });

  renderAll();
});
