// LocalApply Storage Engine — Strictly Local (chrome.storage.local with localStorage fallback for local sandbox testing)

(function (global) {
  const STORAGE_KEY = 'localApplyData';

  function getDefaultSchema() {
    return {
      version: '1.0.0',
      settings: {
        // 'both': Auto-detects filled answers and asks user to confirm/select which to save + provides manual button
        // 'auto': Automatically saves newly entered answers on form submit / blur with selection toast
        // 'manual': Only saves when user clicks "Save Answers" button and selects items
        captureMode: 'both',
        showFloatingWidget: true,
        showWidgetOnAllPages: false,
        highlightFilledFields: true,
        overwriteExistingValues: false,
        enabledCategories: {
          profile: true,
          experience: true,
          education: true,
          workAuth: true,
          eeo: true,
          customQA: true,
          files: true
        }
      },
      profile: {
        firstName: '',
        middleName: '',
        lastName: '',
        fullName: '',
        preferredName: '',
        email: '',
        phone: '',
        phoneType: 'Mobile',
        addressLine1: '',
        addressLine2: '',
        city: '',
        state: '',
        postalCode: '',
        country: 'United States',
        linkedin: '',
        github: '',
        portfolio: '',
        twitter: '',
        otherUrl: '',
        currentCompany: '',
        currentTitle: '',
        yearsOfExperience: '',
        desiredSalary: '',
        noticePeriod: '2 weeks',
        earliestStartDate: '',
        referralSource: 'Company Career Site',
        summary: ''
      },
      experience: [],
      education: [],
      workAuth: {
        authorizedToWork: 'Yes',
        requireSponsorship: 'No',
        requireFutureSponsorship: 'No',
        visaStatus: 'Citizen / Permanent Resident',
        over18: 'Yes',
        willingToRelocate: 'Yes',
        willingToTravel: 'Yes',
        previouslyEmployed: 'No',
        previousContractor: 'No',
        hasRelativesAtCompany: 'No',
        governmentOfficial: 'No',
        nonCompeteAgreement: 'No',
        securityClearance: 'No'
      },
      eeo: {
        gender: 'Decline to self-identify',
        hispanicOrLatino: 'Decline to self-identify',
        raceEthnicity: 'Decline to self-identify',
        veteranStatus: 'I am not a protected veteran',
        disabilityStatus: 'I do not have a disability',
        pronouns: 'Prefer not to say',
        lgbtq: 'Prefer not to say'
      },
      customQA: [
        {
          id: 'qa_default_1',
          question: 'How did you hear about this job?',
          answer: 'Company Career Site',
          category: 'customQA',
          enabled: true,
          platform: 'All',
          updatedAt: Date.now()
        }
      ],
      files: {
        resume: null,
        coverLetter: null
      },
      autoApply: {
        parsedResume: {
          rawText: '',
          extractedTitles: [],
          extractedSkills: [],
          yearsOfExperience: '',
          lastParsedAt: null
        },
        preferences: {
          // 'semi_auto' = Select & Review Queue (autofills steps & pauses before final submit)
          // 'full_auto' = Full Auto-Apply Loop (autofills all steps & submits matching jobs automatically)
          executionMode: 'semi_auto',
          minMatchScore: 65,
          targetRoles: ['Software Engineer', 'Full Stack Engineer', 'Backend Engineer'],
          targetSkills: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'Python', 'SQL', 'AWS'],
          preferredLocations: ['Remote', 'San Francisco', 'New York'],
          remoteOnly: false,
          easyApplyOnly: false,
          blacklistedCompanies: [],
          blacklistedKeywords: ['Unpaid', 'Commission Only'],
          stepDelayMs: 900,
          maxApplicationsPerRun: 25
        },
        appliedJobs: []
      }
    };
  }

  function hasChromeStorage() {
    return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
  }

  function deepMerge(target, source) {
    const out = Object.assign({}, target);
    if (!source || typeof source !== 'object') return out;
    for (const key of Object.keys(source)) {
      if (
        source[key] &&
        typeof source[key] === 'object' &&
        !Array.isArray(source[key]) &&
        target[key] &&
        typeof target[key] === 'object' &&
        !Array.isArray(target[key])
      ) {
        out[key] = deepMerge(target[key], source[key]);
      } else if (source[key] !== undefined) {
        out[key] = source[key];
      }
    }
    return out;
  }

  const LocalApplyStorage = {
    getDefaultSchema,

    async getData() {
      const defaults = getDefaultSchema();
      if (hasChromeStorage()) {
        return new Promise((resolve) => {
          chrome.storage.local.get([STORAGE_KEY], (res) => {
            if (!res || !res[STORAGE_KEY]) {
              resolve(defaults);
            } else {
              resolve(deepMerge(defaults, res[STORAGE_KEY]));
            }
          });
        });
      } else {
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (!raw) return defaults;
          return deepMerge(defaults, JSON.parse(raw));
        } catch (e) {
          return defaults;
        }
      }
    },

    async saveData(newData) {
      const defaults = getDefaultSchema();
      const merged = deepMerge(defaults, newData);
      if (hasChromeStorage()) {
        return new Promise((resolve) => {
          chrome.storage.local.set({ [STORAGE_KEY]: merged }, () => {
            resolve(merged);
          });
        });
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        return merged;
      }
    },

    async updateSection(sectionName, sectionData) {
      const current = await this.getData();
      if (Array.isArray(sectionData)) {
        current[sectionName] = sectionData;
      } else if (typeof sectionData === 'object' && sectionData !== null) {
        current[sectionName] = Object.assign({}, current[sectionName] || {}, sectionData);
      } else {
        current[sectionName] = sectionData;
      }
      return this.saveData(current);
    },

    async upsertAnswers(itemsToSave, detectedPlatform = 'Universal') {
      // itemsToSave: Array of { question, answer, canonicalKey, section, category }
      const data = await this.getData();

      for (const item of itemsToSave) {
        if (!item || item.answer === undefined || item.answer === null) continue;
        const cleanAnswer = String(item.answer).trim();
        if (!cleanAnswer) continue;

        // If mapped to a canonical profile or workAuth or eeo key, update that directly as well
        if (item.section === 'profile' && item.canonicalKey && item.canonicalKey in data.profile) {
          data.profile[item.canonicalKey] = cleanAnswer;
          // Keep fullName synced if firstName/lastName updated and fullName is empty
          if ((item.canonicalKey === 'firstName' || item.canonicalKey === 'lastName') && !data.profile.fullName) {
            const fn = data.profile.firstName || '';
            const ln = data.profile.lastName || '';
            if (fn && ln) data.profile.fullName = `${fn} ${ln}`.trim();
          }
          continue;
        }

        if (item.section === 'workAuth' && item.canonicalKey && item.canonicalKey in data.workAuth) {
          data.workAuth[item.canonicalKey] = cleanAnswer;
          continue;
        }

        if (item.section === 'eeo' && item.canonicalKey && item.canonicalKey in data.eeo) {
          data.eeo[item.canonicalKey] = cleanAnswer;
          continue;
        }

        // Otherwise upsert into Custom Q&A Bank
        const qText = (item.question || '').trim();
        if (!qText) continue;

        const normNew = qText.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
        const existingIdx = data.customQA.findIndex((qa) => {
          const normOld = (qa.question || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
          return normOld === normNew;
        });

        if (existingIdx >= 0) {
          data.customQA[existingIdx].answer = cleanAnswer;
          data.customQA[existingIdx].updatedAt = Date.now();
          if (detectedPlatform) data.customQA[existingIdx].platform = detectedPlatform;
        } else {
          data.customQA.unshift({
            id: 'qa_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
            question: qText,
            answer: cleanAnswer,
            category: item.category || 'customQA',
            enabled: true,
            platform: detectedPlatform || 'All',
            updatedAt: Date.now()
          });
        }
      }

      return this.saveData(data);
    },

    async getStorageSizeBytes() {
      if (hasChromeStorage() && chrome.storage.local.getBytesInUse) {
        return new Promise((resolve) => {
          chrome.storage.local.getBytesInUse([STORAGE_KEY], (bytes) => resolve(bytes || 0));
        });
      }
      const raw = localStorage.getItem(STORAGE_KEY) || '';
      return new Blob([raw]).size;
    },

    async clearAllData() {
      const defaults = getDefaultSchema();
      return this.saveData(defaults);
    },

    async recordAppliedJob(jobEntry) {
      const data = await this.getData();
      if (!data.autoApply) data.autoApply = getDefaultSchema().autoApply;
      if (!Array.isArray(data.autoApply.appliedJobs)) {
        data.autoApply.appliedJobs = [];
      }

      const normTitle = (jobEntry.title || '').toLowerCase().trim();
      const normCompany = (jobEntry.company || '').toLowerCase().trim();

      const existingIdx = data.autoApply.appliedJobs.findIndex(
        (j) =>
          (jobEntry.jobId && j.jobId === jobEntry.jobId) ||
          (normTitle && normCompany && (j.title || '').toLowerCase().trim() === normTitle && (j.company || '').toLowerCase().trim() === normCompany)
      );

      const record = {
        id: 'app_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        jobId: jobEntry.jobId || '',
        title: jobEntry.title || 'Untitled Role',
        company: jobEntry.company || 'Unknown Company',
        location: jobEntry.location || '',
        platform: jobEntry.platform || 'LinkedIn',
        matchScore: jobEntry.matchScore || 0,
        status: jobEntry.status || 'Applied',
        url: jobEntry.url || (typeof window !== 'undefined' && window.location ? window.location.href : ''),
        appliedAt: Date.now()
      };

      if (existingIdx >= 0) {
        data.autoApply.appliedJobs[existingIdx] = Object.assign({}, data.autoApply.appliedJobs[existingIdx], record);
      } else {
        data.autoApply.appliedJobs.unshift(record);
      }

      return this.saveData(data);
    },

    dataUrlToFile(fileObj) {
      if (!fileObj || !fileObj.dataUrl) return null;
      try {
        const arr = fileObj.dataUrl.split(',');
        const mimeMatch = arr[0].match(/:(.*?);/);
        const mime = mimeMatch ? mimeMatch[1] : (fileObj.type || 'application/pdf');
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        return new File([u8arr], fileObj.name || 'Resume.pdf', {
          type: mime,
          lastModified: fileObj.updatedAt || Date.now()
        });
      } catch (err) {
        console.warn('[LocalApply] Could not reconstruct File from local dataUrl:', err);
        return null;
      }
    }
  };

  global.LocalApplyStorage = LocalApplyStorage;
})(typeof globalThis !== 'undefined' ? globalThis : window);
