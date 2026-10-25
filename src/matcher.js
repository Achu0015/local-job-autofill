// LocalApply Matcher Engine — 100% Offline Heuristic & Fuzzy Matching

(function (global) {
  const STOP_WORDS = new Set([
    'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'about', 'as',
    'into', 'like', 'through', 'after', 'over', 'between', 'out', 'against',
    'during', 'without', 'before', 'under', 'around', 'among', 'please',
    'enter', 'provide', 'select', 'choose', 'your', 'you', 'what', 'which',
    'this', 'that', 'these', 'those', 'do', 'does', 'did', 'have', 'has', 'had'
  ]);

  const US_STATES = {
    AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
    CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
    HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
    KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
    MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
    MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
    NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
    OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
    SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
    VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
    DC: 'District of Columbia'
  };

  // Canonical rules ordered from most specific to general
  const CANONICAL_RULES = [
    // --- WORK AUTHORIZATION & COMPLIANCE ---
    {
      section: 'workAuth',
      category: 'workAuth',
      key: 'requireSponsorship',
      label: 'Require Visa Sponsorship',
      patterns: [
        /require.*sponsorship/i,
        /need.*sponsorship/i,
        /visa\s*sponsorship/i,
        /now\s+or\s+in\s+the\s+future\s+require\s+sponsorship/i,
        /sponsor.*employment\s*visa/i,
        /h-?1b|opt|tn\s*visa\s*sponsorship/i
      ]
    },
    {
      section: 'workAuth',
      category: 'workAuth',
      key: 'authorizedToWork',
      label: 'Legally Authorized to Work',
      patterns: [
        /legally\s+authorized\s+to\s+work/i,
        /authorized\s+to\s+work\s+in/i,
        /eligible\s+to\s+work\s+in/i,
        /right\s+to\s+work/i,
        /work\s+authorization/i
      ]
    },
    {
      section: 'workAuth',
      category: 'workAuth',
      key: 'over18',
      label: 'At Least 18 Years of Age',
      patterns: [
        /18\s+years\s+of\s+age/i,
        /at\s+least\s+18/i,
        /over\s+the\s+age\s+of\s+18/i,
        /legal\s+working\s+age/i
      ]
    },
    {
      section: 'workAuth',
      category: 'workAuth',
      key: 'willingToRelocate',
      label: 'Willing to Relocate',
      patterns: [
        /willing\s+to\s+relocate/i,
        /open\s+to\s+relocation/i,
        /able\s+to\s+relocate/i,
        /\brelocate\b/i
      ]
    },
    {
      section: 'workAuth',
      category: 'workAuth',
      key: 'willingToTravel',
      label: 'Willing to Travel',
      patterns: [
        /willing\s+to\s+travel/i,
        /able\s+to\s+travel/i
      ]
    },
    {
      section: 'workAuth',
      category: 'workAuth',
      key: 'previouslyEmployed',
      label: 'Previously Employed at Company',
      patterns: [
        /previously\s+worked\s+for/i,
        /previously\s+been\s+employed/i,
        /former\s+employee/i,
        /ever\s+worked\s+for\s+this\s+company/i,
        /have\s+you\s+ever\s+worked\s+at/i
      ]
    },
    {
      section: 'workAuth',
      category: 'workAuth',
      key: 'hasRelativesAtCompany',
      label: 'Relatives at Company',
      patterns: [
        /relatives?\s+employed/i,
        /family\s+members?\s+working/i,
        /related\s+to\s+anyone/i
      ]
    },
    {
      section: 'workAuth',
      category: 'workAuth',
      key: 'governmentOfficial',
      label: 'Government Official / Employment',
      patterns: [
        /government\s+official/i,
        /employed\s+by\s+a\s+government/i
      ]
    },
    {
      section: 'workAuth',
      category: 'workAuth',
      key: 'nonCompeteAgreement',
      label: 'Non-Compete / Restrictive Covenant',
      patterns: [
        /non-?compete/i,
        /restrictive\s+covenant/i,
        /non-?solicitation/i
      ]
    },
    {
      section: 'workAuth',
      category: 'workAuth',
      key: 'securityClearance',
      label: 'Security Clearance',
      patterns: [
        /security\s+clearance/i,
        /active\s+clearance/i
      ]
    },

    // --- EEO / DEMOGRAPHICS ---
    {
      section: 'eeo',
      category: 'eeo',
      key: 'gender',
      label: 'Gender',
      patterns: [
        /\bgender\b/i,
        /\bsex\b/i
      ]
    },
    {
      section: 'eeo',
      category: 'eeo',
      key: 'pronouns',
      label: 'Preferred Pronouns',
      patterns: [
        /\bpronouns?\b/i
      ]
    },
    {
      section: 'eeo',
      category: 'eeo',
      key: 'hispanicOrLatino',
      label: 'Hispanic or Latino',
      patterns: [
        /hispanic\s+or\s+latino/i,
        /hispanic\/latino/i
      ]
    },
    {
      section: 'eeo',
      category: 'eeo',
      key: 'raceEthnicity',
      label: 'Race / Ethnicity',
      patterns: [
        /\brace\b/i,
        /\bethnicity\b/i,
        /racial\s+background/i
      ]
    },
    {
      section: 'eeo',
      category: 'eeo',
      key: 'veteranStatus',
      label: 'Veteran Status',
      patterns: [
        /\bveteran\b/i,
        /military\s+service/i,
        /armed\s+forces/i
      ]
    },
    {
      section: 'eeo',
      category: 'eeo',
      key: 'disabilityStatus',
      label: 'Disability Status',
      patterns: [
        /\bdisability\b/i,
        /\bhandicap\b/i
      ]
    },
    {
      section: 'eeo',
      category: 'eeo',
      key: 'lgbtq',
      label: 'LGBTQ+ Identity',
      patterns: [
        /\blgbtq/i,
        /sexual\s+orientation/i
      ]
    },

    // --- PROFILE & CONTACT ---
    {
      section: 'profile',
      category: 'profile',
      key: 'firstName',
      label: 'First Name',
      patterns: [
        /first[\s_-]*name/i,
        /given[\s_-]*name/i,
        /legal[\s_-]*first[\s_-]*name/i,
        /^fname$/i
      ]
    },
    {
      section: 'profile',
      category: 'profile',
      key: 'middleName',
      label: 'Middle Name',
      patterns: [
        /middle[\s_-]*name/i,
        /middle[\s_-]*initial/i,
        /^mname$/i
      ]
    },
    {
      section: 'profile',
      category: 'profile',
      key: 'lastName',
      label: 'Last Name',
      patterns: [
        /last[\s_-]*name/i,
        /family[\s_-]*name/i,
        /surname/i,
        /legal[\s_-]*last[\s_-]*name/i,
        /^lname$/i
      ]
    },
    {
      section: 'profile',
      category: 'profile',
      key: 'preferredName',
      label: 'Preferred / Chosen Name',
      patterns: [
        /preferred[\s_-]*name/i,
        /chosen[\s_-]*name/i,
        /nickname/i
      ]
    },
    {
      section: 'profile',
      category: 'profile',
      key: 'fullName',
      label: 'Full Name',
      patterns: [
        /full[\s_-]*name/i,
        /candidate[\s_-]*name/i,
        /applicant[\s_-]*name/i,
        /your[\s_-]*name/i,
        /^name$/i
      ],
      excludePatterns: [/company/i, /school/i, /university/i, /employer/i, /reference/i, /first/i, /last/i, /middle/i, /preferred/i]
    },
    {
      section: 'profile',
      category: 'profile',
      key: 'email',
      label: 'Email Address',
      patterns: [
        /e-?mail/i
      ]
    },
    {
      section: 'profile',
      category: 'profile',
      key: 'phoneType',
      label: 'Phone Device Type',
      patterns: [
        /phone[\s_-]*device[\s_-]*type/i,
        /phone[\s_-]*type/i,
        /device[\s_-]*type/i
      ]
    },
    {
      section: 'profile',
      category: 'profile',
      key: 'phone',
      label: 'Phone Number',
      patterns: [
        /phone/i,
        /mobile[\s_-]*number/i,
        /telephone/i,
        /cell[\s_-]*number/i,
        /contact[\s_-]*number/i
      ],
      excludePatterns: [/type/i, /extension/i, /country\s*code/i]
    },
    {
      section: 'profile',
      category: 'profile',
      key: 'linkedin',
      label: 'LinkedIn URL',
      patterns: [
        /linked\s*in/i
      ]
    },
    {
      section: 'profile',
      category: 'profile',
      key: 'github',
      label: 'GitHub URL',
      patterns: [
        /git\s*hub/i
      ]
    },
    {
      section: 'profile',
      category: 'profile',
      key: 'portfolio',
      label: 'Portfolio / Website URL',
      patterns: [
        /portfolio/i,
        /personal[\s_-]*website/i,
        /website[\s_-]*url/i,
        /\bwebsite\b/i,
        /\bblog\b/i
      ],
      excludePatterns: [/linkedin/i, /github/i, /twitter/i]
    },
    {
      section: 'profile',
      category: 'profile',
      key: 'twitter',
      label: 'Twitter / X URL',
      patterns: [
        /\btwitter\b/i,
        /x\.com/i
      ]
    },
    {
      section: 'profile',
      category: 'profile',
      key: 'addressLine1',
      label: 'Address Line 1',
      patterns: [
        /address[\s_-]*line[\s_-]*1/i,
        /street[\s_-]*address/i,
        /mailing[\s_-]*address/i,
        /^address$/i
      ]
    },
    {
      section: 'profile',
      category: 'profile',
      key: 'addressLine2',
      label: 'Address Line 2',
      patterns: [
        /address[\s_-]*line[\s_-]*2/i,
        /apt|suite|unit|building/i
      ]
    },
    {
      section: 'profile',
      category: 'profile',
      key: 'city',
      label: 'City / Location',
      patterns: [
        /\bcity\b/i,
        /\btown\b/i,
        /current[\s_-]*location/i,
        /^location$/i
      ]
    },
    {
      section: 'profile',
      category: 'profile',
      key: 'state',
      label: 'State / Province',
      patterns: [
        /\bstate\b/i,
        /\bprovince\b/i,
        /state\/province/i,
        /\bregion\b/i
      ],
      excludePatterns: [/united\s+states/i]
    },
    {
      section: 'profile',
      category: 'profile',
      key: 'postalCode',
      label: 'Postal / ZIP Code',
      patterns: [
        /postal[\s_-]*code/i,
        /zip[\s_-]*code/i,
        /\bzip\b/i,
        /postcode/i
      ]
    },
    {
      section: 'profile',
      category: 'profile',
      key: 'country',
      label: 'Country',
      patterns: [
        /\bcountry\b/i
      ],
      excludePatterns: [/phone\s*code/i]
    },
    {
      section: 'profile',
      category: 'profile',
      key: 'currentCompany',
      label: 'Current Company / Employer',
      patterns: [
        /current[\s_-]*company/i,
        /current[\s_-]*employer/i,
        /most[\s_-]*recent[\s_-]*employer/i,
        /most[\s_-]*recent[\s_-]*company/i,
        /\borg(anization)?\b/i
      ]
    },
    {
      section: 'profile',
      category: 'profile',
      key: 'currentTitle',
      label: 'Current Job Title',
      patterns: [
        /current[\s_-]*(job[\s_-]*)?title/i,
        /current[\s_-]*role/i,
        /most[\s_-]*recent[\s_-]*title/i
      ]
    },
    {
      section: 'profile',
      category: 'profile',
      key: 'yearsOfExperience',
      label: 'Years of Experience',
      patterns: [
        /years?\s+of\s+(relevant\s+|professional\s+|work\s+)?experience/i,
        /total\s+experience/i,
        /how\s+many\s+years\s+of\s+experience/i
      ]
    },
    {
      section: 'profile',
      category: 'profile',
      key: 'desiredSalary',
      label: 'Desired Salary / Compensation',
      patterns: [
        /desired[\s_-]*salary/i,
        /salary[\s_-]*expectations?/i,
        /compensation[\s_-]*expectations?/i,
        /expected[\s_-]*compensation/i,
        /expected[\s_-]*salary/i,
        /desired[\s_-]*pay/i,
        /base[\s_-]*salary/i
      ]
    },
    {
      section: 'profile',
      category: 'profile',
      key: 'noticePeriod',
      label: 'Notice Period',
      patterns: [
        /notice[\s_-]*period/i,
        /how\s+much\s+notice/i,
        /when\s+can\s+you\s+start/i,
        /availability\s+to\s+start/i
      ]
    },
    {
      section: 'profile',
      category: 'profile',
      key: 'earliestStartDate',
      label: 'Earliest Start Date',
      patterns: [
        /earliest[\s_-]*start[\s_-]*date/i,
        /available[\s_-]*start[\s_-]*date/i,
        /date[\s_-]*available/i
      ]
    },
    {
      section: 'profile',
      category: 'profile',
      key: 'referralSource',
      label: 'How Did You Hear About Us',
      patterns: [
        /how\s+did\s+you\s+hear/i,
        /where\s+did\s+you\s+hear/i,
        /how\s+did\s+you\s+find\s+out/i,
        /referral\s+source/i,
        /source\s+of\s+application/i
      ]
    },
    {
      section: 'profile',
      category: 'profile',
      key: 'summary',
      label: 'Professional Summary / Additional Info',
      patterns: [
        /additional[\s_-]*information/i,
        /cover[\s_-]*letter[\s_-]*text/i,
        /professional[\s_-]*summary/i,
        /anything[\s_-]*else[\s_-]*you[\s_-]*would[\s_-]*like/i
      ]
    }
  ];

  // Repeating Subsection Rules (Work Experience & Education)
  const EXPERIENCE_SUBFIELD_RULES = [
    { key: 'jobTitle', label: 'Job Title', patterns: [/job[\s_-]*title/i, /role[\s_-]*title/i, /^title$/i, /position/i] },
    { key: 'company', label: 'Company Name', patterns: [/company/i, /employer/i, /organization/i] },
    { key: 'location', label: 'Location', patterns: [/location/i, /city/i] },
    { key: 'startDate', label: 'Start Date', patterns: [/start[\s_-]*date/i, /from[\s_-]*date/i, /^from$/i] },
    { key: 'endDate', label: 'End Date', patterns: [/end[\s_-]*date/i, /to[\s_-]*date/i, /^to$/i] },
    { key: 'currentlyWorkHere', label: 'Currently Work Here', patterns: [/currently\s+work\s+here/i, /current\s+role/i, /present/i] },
    { key: 'description', label: 'Role Description', patterns: [/description/i, /responsibilities/i, /summary/i, /achievements/i] }
  ];

  const EDUCATION_SUBFIELD_RULES = [
    { key: 'school', label: 'School or University', patterns: [/school/i, /university/i, /college/i, /institution/i] },
    { key: 'degree', label: 'Degree', patterns: [/degree/i, /level\s+of\s+education/i, /qualification/i] },
    { key: 'fieldOfStudy', label: 'Field of Study / Major', patterns: [/field\s+of\s+study/i, /major/i, /discipline/i, /concentration/i] },
    { key: 'gpa', label: 'GPA', patterns: [/\bgpa\b/i, /grade\s+point/i] },
    { key: 'startDate', label: 'Start Date / Year', patterns: [/start[\s_-]*(date|year)/i, /from/i] },
    { key: 'endDate', label: 'End / Graduation Date', patterns: [/end[\s_-]*(date|year)/i, /graduation/i, /^to$/i] }
  ];

  function tokenize(text) {
    if (!text) return [];
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
  }

  function bigrams(str) {
    const clean = (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const result = [];
    for (let i = 0; i < clean.length - 1; i++) {
      result.push(clean.slice(i, i + 2));
    }
    return result;
  }

  function diceCoefficient(a, b) {
    const bg1 = bigrams(a);
    const bg2 = bigrams(b);
    if (!bg1.length || !bg2.length) return 0;
    const map = new Map();
    for (const bg of bg1) {
      map.set(bg, (map.get(bg) || 0) + 1);
    }
    let intersection = 0;
    for (const bg of bg2) {
      const count = map.get(bg) || 0;
      if (count > 0) {
        intersection++;
        map.set(bg, count - 1);
      }
    }
    return (2.0 * intersection) / (bg1.length + bg2.length);
  }

  function computeQuestionSimilarity(q1, q2) {
    if (!q1 || !q2) return 0;
    const norm1 = q1.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const norm2 = q2.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    if (norm1 === norm2) return 1.0;
    if (norm1.includes(norm2) || norm2.includes(norm1)) {
      const ratio = Math.min(norm1.length, norm2.length) / Math.max(norm1.length, norm2.length);
      if (ratio > 0.65) return 0.92;
    }

    const tokens1 = tokenize(q1);
    const tokens2 = tokenize(q2);
    if (!tokens1.length || !tokens2.length) return 0;

    const set1 = new Set(tokens1);
    const set2 = new Set(tokens2);

    // Check critical polarity mismatches (e.g., "require sponsorship" vs "authorized to work")
    const hasSponsor1 = set1.has('sponsorship') || set1.has('sponsor');
    const hasSponsor2 = set2.has('sponsorship') || set2.has('sponsor');
    if (hasSponsor1 !== hasSponsor2) return 0.1;

    let overlap = 0;
    for (const t of set1) {
      if (set2.has(t)) overlap++;
    }

    const jaccard = overlap / (set1.size + set2.size - overlap);
    const dice = diceCoefficient(norm1, norm2);

    return jaccard * 0.65 + dice * 0.35;
  }

  const LocalApplyMatcher = {
    US_STATES,
    CANONICAL_RULES,
    EXPERIENCE_SUBFIELD_RULES,
    EDUCATION_SUBFIELD_RULES,
    computeQuestionSimilarity,

    /**
     * Matches a field descriptor against local storage data.
     * descriptor: { label, name, id, placeholder, ariaLabel, automationId, tagName, inputType, sectionContext, indexContext }
     */
    matchField(descriptor, localData) {
      const enabledCats = (localData.settings && localData.settings.enabledCategories) || {};

      // Check file upload inputs first
      if (descriptor.inputType === 'file') {
        const combined = [descriptor.label, descriptor.name, descriptor.id, descriptor.automationId]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        const isCoverLetter = /cover[\s_-]*letter/i.test(combined);
        const fileKey = isCoverLetter ? 'coverLetter' : 'resume';
        const fileObj = localData.files && localData.files[fileKey];
        return {
          matched: Boolean(fileObj && fileObj.dataUrl),
          category: 'files',
          categoryEnabled: enabledCats.files !== false,
          section: 'files',
          canonicalKey: fileKey,
          displayLabel: isCoverLetter ? 'Cover Letter File' : 'Resume / CV File',
          value: fileObj ? fileObj.name : '',
          fileObject: fileObj || null,
          confidence: 0.98,
          source: 'Local File Storage'
        };
      }

      // Check if field is inside a repeating Work Experience or Education container
      if (descriptor.sectionContext === 'experience') {
        const expIndex = descriptor.indexContext || 0;
        const expEntry = (localData.experience || [])[expIndex];
        const combinedText = [descriptor.label, descriptor.name, descriptor.placeholder, descriptor.automationId]
          .filter(Boolean)
          .join(' ');

        for (const rule of EXPERIENCE_SUBFIELD_RULES) {
          if (rule.patterns.some((p) => p.test(combinedText))) {
            const val = expEntry ? expEntry[rule.key] : '';
            return {
              matched: val !== undefined && val !== null && String(val).trim() !== '',
              category: 'experience',
              categoryEnabled: enabledCats.experience !== false,
              section: 'experience',
              canonicalKey: `experience[${expIndex}].${rule.key}`,
              displayLabel: `Work Experience #${expIndex + 1} — ${rule.label}`,
              value: val !== undefined ? val : '',
              confidence: 0.92,
              source: `Experience #${expIndex + 1}`
            };
          }
        }
      }

      if (descriptor.sectionContext === 'education') {
        const eduIndex = descriptor.indexContext || 0;
        const eduEntry = (localData.education || [])[eduIndex];
        const combinedText = [descriptor.label, descriptor.name, descriptor.placeholder, descriptor.automationId]
          .filter(Boolean)
          .join(' ');

        for (const rule of EDUCATION_SUBFIELD_RULES) {
          if (rule.patterns.some((p) => p.test(combinedText))) {
            const val = eduEntry ? eduEntry[rule.key] : '';
            return {
              matched: val !== undefined && val !== null && String(val).trim() !== '',
              category: 'education',
              categoryEnabled: enabledCats.education !== false,
              section: 'education',
              canonicalKey: `education[${eduIndex}].${rule.key}`,
              displayLabel: `Education #${eduIndex + 1} — ${rule.label}`,
              value: val !== undefined ? val : '',
              confidence: 0.92,
              source: `Education #${eduIndex + 1}`
            };
          }
        }
      }

      // Build candidate text signals in priority order
      const primaryQuestion = (descriptor.label || descriptor.ariaLabel || descriptor.placeholder || '').trim();
      const attrSignal = [descriptor.automationId, descriptor.name, descriptor.id].filter(Boolean).join(' ');
      const fullSignal = `${primaryQuestion} ${attrSignal}`.trim();

      // 1. Check Custom Q&A Bank first for exact or very high-confidence match (>= 0.80)
      if (primaryQuestion && Array.isArray(localData.customQA)) {
        let bestQA = null;
        let bestScore = 0;
        for (const qa of localData.customQA) {
          if (qa.enabled === false) continue;
          const score = computeQuestionSimilarity(primaryQuestion, qa.question);
          if (score > bestScore) {
            bestScore = score;
            bestQA = qa;
          }
        }
        if (bestQA && bestScore >= 0.82 && String(bestQA.answer).trim() !== '') {
          return {
            matched: true,
            category: 'customQA',
            categoryEnabled: enabledCats.customQA !== false,
            section: 'customQA',
            canonicalKey: bestQA.id,
            displayLabel: primaryQuestion || bestQA.question,
            value: bestQA.answer,
            confidence: Number(bestScore.toFixed(2)),
            source: `Custom Q&A Bank (${Math.round(bestScore * 100)}% match)`
          };
        }
      }

      // 2. Check Canonical Rules (WorkAuth, EEO, Profile)
      for (const rule of CANONICAL_RULES) {
        if (rule.excludePatterns && rule.excludePatterns.some((ex) => ex.test(fullSignal))) {
          continue;
        }
        const matchedPattern = rule.patterns.some((pat) => pat.test(primaryQuestion) || pat.test(attrSignal));
        if (matchedPattern) {
          const sectionData = localData[rule.section] || {};
          let val = sectionData[rule.key];

          // Fallback: if fullName requested but empty, combine firstName + lastName
          if (rule.key === 'fullName' && (!val || !String(val).trim())) {
            const fn = (localData.profile && localData.profile.firstName) || '';
            const ln = (localData.profile && localData.profile.lastName) || '';
            val = `${fn} ${ln}`.trim();
          }

          // Fallback: if currentCompany/currentTitle requested but empty, pull from experience[0]
          if (rule.key === 'currentCompany' && (!val || !String(val).trim()) && localData.experience && localData.experience[0]) {
            val = localData.experience[0].company || '';
          }
          if (rule.key === 'currentTitle' && (!val || !String(val).trim()) && localData.experience && localData.experience[0]) {
            val = localData.experience[0].jobTitle || '';
          }

          const hasValue = val !== undefined && val !== null && String(val).trim() !== '';
          return {
            matched: hasValue,
            category: rule.category,
            categoryEnabled: enabledCats[rule.category] !== false,
            section: rule.section,
            canonicalKey: rule.key,
            displayLabel: primaryQuestion || rule.label,
            value: hasValue ? String(val) : '',
            confidence: 0.95,
            source: `Local ${rule.section === 'workAuth' ? 'Work Auth' : rule.section === 'eeo' ? 'EEO' : 'Profile'}`
          };
        }
      }

      // 3. Moderate-confidence Custom Q&A Bank fuzzy match (>= 0.58)
      if (primaryQuestion && Array.isArray(localData.customQA)) {
        let bestQA = null;
        let bestScore = 0;
        for (const qa of localData.customQA) {
          if (qa.enabled === false) continue;
          const score = computeQuestionSimilarity(primaryQuestion, qa.question);
          if (score > bestScore) {
            bestScore = score;
            bestQA = qa;
          }
        }
        if (bestQA && bestScore >= 0.58 && String(bestQA.answer).trim() !== '') {
          return {
            matched: true,
            category: 'customQA',
            categoryEnabled: enabledCats.customQA !== false,
            section: 'customQA',
            canonicalKey: bestQA.id,
            displayLabel: primaryQuestion || bestQA.question,
            value: bestQA.answer,
            confidence: Number(bestScore.toFixed(2)),
            source: `Fuzzy Q&A (${Math.round(bestScore * 100)}% match)`
          };
        }
      }

      // Unmatched field (can still be captured when user fills it!)
      return {
        matched: false,
        category: 'customQA',
        categoryEnabled: enabledCats.customQA !== false,
        section: 'customQA',
        canonicalKey: null,
        displayLabel: primaryQuestion || attrSignal || 'Unlabeled Field',
        value: '',
        confidence: 0,
        source: 'Unmatched (Fill to save locally)'
      };
    },

    /**
     * Matches a desired text value against a list of option strings/elements
     * (for <select>, radio buttons, or custom ATS dropdown options).
     */
    findBestOptionMatch(desiredValue, optionsList) {
      if (desiredValue === undefined || desiredValue === null) return null;
      const target = String(desiredValue).trim().toLowerCase();
      if (!target || !optionsList || !optionsList.length) return null;

      // 1. Exact text or value match
      for (const opt of optionsList) {
        const text = (opt.text || '').trim().toLowerCase();
        const val = (opt.value || '').trim().toLowerCase();
        if (text === target || val === target) return opt;
      }

      // 2. Boolean / Yes-No equivalence
      const isYes = ['yes', 'true', '1', 'y', 'i am authorized', 'authorized'].includes(target);
      const isNo = ['no', 'false', '0', 'n', 'i do not', 'not required'].includes(target);

      if (isYes || isNo) {
        for (const opt of optionsList) {
          const text = (opt.text || '').trim().toLowerCase();
          if (isYes && (/^yes\b/i.test(text) || /^i am\b/i.test(text))) return opt;
          if (isNo && (/^no\b/i.test(text) || /^i am not\b/i.test(text) || /^i do not\b/i.test(text))) return opt;
        }
      }

      // 3. Decline / Prefer not to say equivalence
      if (/decline|prefer not|wish to answer|choose not/i.test(target)) {
        for (const opt of optionsList) {
          const text = (opt.text || '').trim().toLowerCase();
          if (/decline|prefer not|wish to answer|choose not|don't wish/i.test(text)) return opt;
        }
      }

      // 4. US State code <-> full state name equivalence
      const upperTarget = target.toUpperCase();
      if (US_STATES[upperTarget]) {
        const stateFull = US_STATES[upperTarget].toLowerCase();
        for (const opt of optionsList) {
          const text = (opt.text || '').trim().toLowerCase();
          if (text === stateFull || text.includes(stateFull)) return opt;
        }
      } else {
        const foundCode = Object.keys(US_STATES).find((k) => US_STATES[k].toLowerCase() === target);
        if (foundCode) {
          for (const opt of optionsList) {
            const text = (opt.text || '').trim().toLowerCase();
            const val = (opt.value || '').trim().toLowerCase();
            if (text === foundCode.toLowerCase() || val === foundCode.toLowerCase()) return opt;
          }
        }
      }

      // 5. Degree aliases
      if (/bachelor|b\.?s\.?|b\.?a\.?/i.test(target)) {
        for (const opt of optionsList) {
          if (/bachelor|b\.?s\.?|b\.?a\.?/i.test(opt.text || '')) return opt;
        }
      }
      if (/master|m\.?s\.?|m\.?b\.?a\.?|m\.?eng/i.test(target)) {
        for (const opt of optionsList) {
          if (/master|m\.?s\.?|m\.?b\.?a\.?/i.test(opt.text || '')) return opt;
        }
      }
      if (/doctor|ph\.?d/i.test(target)) {
        for (const opt of optionsList) {
          if (/doctor|ph\.?d/i.test(opt.text || '')) return opt;
        }
      }

      // 6. Substring / startsWith match
      for (const opt of optionsList) {
        const text = (opt.text || '').trim().toLowerCase();
        if (!text || /^select|^choose|^--/i.test(text)) continue;
        if (text.includes(target) || target.includes(text)) return opt;
      }

      // 7. Fuzzy similarity match
      let bestOpt = null;
      let bestSim = 0;
      for (const opt of optionsList) {
        const text = (opt.text || '').trim();
        if (!text || /^select|^choose|^--/i.test(text)) continue;
        const sim = diceCoefficient(target, text);
        if (sim > bestSim && sim >= 0.55) {
          bestSim = sim;
          bestOpt = opt;
        }
      }

      return bestOpt;
    }
  };

  global.LocalApplyMatcher = LocalApplyMatcher;
})(typeof globalThis !== 'undefined' ? globalThis : window);
