// LocalApply Background Service Worker (100% Local, Zero Network Calls)

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    // Initialize default storage structure if not present
    const existing = await chrome.storage.local.get(['localApplyData']);
    if (!existing.localApplyData) {
      await chrome.storage.local.set({
        localApplyData: getInitialData()
      });
    }
    // Open dashboard on first install so user can set up or review local storage
    chrome.runtime.openOptionsPage();
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'OPEN_DASHBOARD') {
    chrome.runtime.openOptionsPage();
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === 'UPDATE_BADGE') {
    const count = message.count || 0;
    if (sender.tab && sender.tab.id) {
      chrome.action.setBadgeText({
        tabId: sender.tab.id,
        text: count > 0 ? String(count) : ''
      });
      chrome.action.setBadgeBackgroundColor({
        tabId: sender.tab.id,
        color: '#10b981'
      });
    }
    sendResponse({ ok: true });
    return true;
  }
});

function getInitialData() {
  return {
    version: '1.0.0',
    settings: {
      // 'both' enables auto-detecting new answers with a non-intrusive select-to-save prompt
      // AND provides the manual "Save Answers" button at all times.
      // Can be set to: 'both' | 'auto_prompt' | 'manual_only'
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
        question: 'How did you hear about this role / opportunity?',
        answer: 'Online Job Board / Company Careers Page',
        category: 'customQA',
        enabled: true,
        platform: 'All',
        updatedAt: Date.now()
      }
    ],
    files: {
      resume: null,       // { name, type, size, dataUrl, updatedAt }
      coverLetter: null   // { name, type, size, dataUrl, updatedAt }
    }
  };
}
