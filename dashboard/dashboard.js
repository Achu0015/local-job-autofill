// LocalApply Dashboard Controller (100% Local Storage)

document.addEventListener('DOMContentLoaded', async () => {
  let localData = await window.LocalApplyStorage.getData();
  let qaSearchQuery = '';

  const toastBanner = document.getElementById('toast-banner');
  const storageUsageEl = document.getElementById('storage-usage');
  const qaCountBadge = document.getElementById('qa-count-badge');

  function showToast(msg) {
    toastBanner.textContent = msg;
    toastBanner.style.display = 'block';
    setTimeout(() => {
      toastBanner.style.display = 'none';
    }, 3000);
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
  }

  // Save All button
  document.getElementById('btn-save-all').addEventListener('click', async () => {
    collectFormStateIntoLocalData();
    await window.LocalApplyStorage.saveData(localData);
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
    // Create a sample minimal PDF dataURL so resume auto-upload also works out of the box
    const samplePdfContent = '%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF';
    const samplePdfBase64 = 'data:application/pdf;base64,' + btoa(samplePdfContent);

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

    await window.LocalApplyStorage.saveData(localData);
    renderAll();
    showToast('Loaded Demo Candidate Profile + Sample Resume into local storage!');
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
