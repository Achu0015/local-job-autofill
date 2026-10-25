// LocalApply 100% Local Resume Parser, Job Relevance Scorer & Multi-Platform Search Generator

(function (global) {
  const SKILL_DICTIONARY = [
    // Languages
    'JavaScript', 'TypeScript', 'Python', 'Java', 'Go', 'Golang', 'C++', 'C#', 'Rust', 'Ruby',
    'PHP', 'Swift', 'Kotlin', 'Scala', 'SQL', 'NoSQL', 'HTML', 'CSS', 'Bash', 'Shell', 'R',
    // Frontend
    'React', 'Next.js', 'Vue', 'Angular', 'Svelte', 'Redux', 'Tailwind', 'Webpack', 'Vite', 'GraphQL',
    // Backend & APIs
    'Node.js', 'Express', 'NestJS', 'Django', 'FastAPI', 'Flask', 'Spring Boot', 'Ruby on Rails',
    '.NET', 'gRPC', 'REST', 'Microservices', 'Distributed Systems', 'System Design', 'Kafka', 'RabbitMQ',
    // Databases & Storage
    'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Elasticsearch', 'DynamoDB', 'Cassandra', 'Snowflake', 'BigQuery',
    // Cloud, DevOps & Infra
    'AWS', 'GCP', 'Azure', 'Docker', 'Kubernetes', 'Terraform', 'Ansible', 'CI/CD', 'GitHub Actions',
    'Jenkins', 'Linux', 'Prometheus', 'Grafana', 'Datadog', 'Nginx',
    // AI, ML & Data
    'Machine Learning', 'Deep Learning', 'PyTorch', 'TensorFlow', 'Scikit-learn', 'LLM', 'NLP',
    'Computer Vision', 'Pandas', 'NumPy', 'Spark', 'Airflow', 'dbt', 'Tableau', 'Power BI',
    // Product, Design & Operations
    'Product Management', 'Agile', 'Scrum', 'Jira', 'Figma', 'A/B Testing', 'Roadmapping',
    'Project Management', 'Stakeholder Management', 'Financial Modeling', 'Salesforce'
  ];

  const COMMON_ROLE_TITLES = [
    'Software Engineer',
    'Senior Software Engineer',
    'Staff Software Engineer',
    'Full Stack Engineer',
    'Full-Stack Engineer',
    'Frontend Engineer',
    'Front-End Engineer',
    'Backend Engineer',
    'Back-End Engineer',
    'Distributed Systems Engineer',
    'Platform Engineer',
    'Site Reliability Engineer',
    'DevOps Engineer',
    'Cloud Engineer',
    'Machine Learning Engineer',
    'AI Engineer',
    'Data Scientist',
    'Data Engineer',
    'Data Analyst',
    'Security Engineer',
    'Mobile Engineer',
    'iOS Engineer',
    'Android Engineer',
    'Engineering Manager',
    'Product Manager',
    'Technical Program Manager',
    'UX Designer',
    'Product Designer',
    'Solutions Architect'
  ];

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Extracts skills from any text (Resume or Job Description)
   */
  function extractSkillsFromText(text) {
    if (!text) return [];
    const found = new Set();
    for (const skill of SKILL_DICTIONARY) {
      const pattern = new RegExp(`(^|[^a-zA-Z0-9+#.])${escapeRegex(skill)}([^a-zA-Z0-9+#.]|$)`, 'i');
      if (pattern.test(text)) {
        // Normalize Go / Golang
        if (skill.toLowerCase() === 'golang') {
          found.add('Go');
        } else {
          found.add(skill);
        }
      }
    }
    return Array.from(found);
  }

  /**
   * Extracts candidate profile, skills, titles, experience, and education from raw resume text
   */
  function parseResumeText(rawText) {
    const text = String(rawText || '').replace(/\r\n/g, '\n');
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    // 1. Email
    const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    const email = emailMatch ? emailMatch[0] : '';

    // 2. Phone
    const phoneMatch = text.match(/(\+?\d{1,2}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);
    const phone = phoneMatch ? phoneMatch[0].trim() : '';

    // 3. Links
    const linkedinMatch = text.match(/https?:\/\/(www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+\/?/i) ||
      text.match(/linkedin\.com\/in\/[a-zA-Z0-9_-]+/i);
    const githubMatch = text.match(/https?:\/\/(www\.)?github\.com\/[a-zA-Z0-9_-]+\/?/i) ||
      text.match(/github\.com\/[a-zA-Z0-9_-]+/i);

    const linkedin = linkedinMatch
      ? linkedinMatch[0].startsWith('http')
        ? linkedinMatch[0]
        : `https://${linkedinMatch[0]}`
      : '';
    const github = githubMatch
      ? githubMatch[0].startsWith('http')
        ? githubMatch[0]
        : `https://${githubMatch[0]}`
      : '';

    // 4. Candidate Name (usually first non-contact line)
    let fullName = '';
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const candidateLine = lines[i].replace(/[|•·].*$/, '').trim();
      if (
        candidateLine.length >= 4 &&
        candidateLine.length <= 42 &&
        !/[@0-9:/]/.test(candidateLine) &&
        /^[A-Z][a-zA-Z.'-]+(\s+[A-Z][a-zA-Z.'-]+){1,3}$/.test(candidateLine)
      ) {
        fullName = candidateLine;
        break;
      }
    }
    const nameParts = fullName ? fullName.split(/\s+/) : [];
    const firstName = nameParts[0] || '';
    const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';

    // 5. Location (City, ST)
    const locMatch = text.match(/\b([A-Z][a-zA-Z\s.]{2,24}),\s*(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\b/);
    const city = locMatch ? locMatch[1].trim() : '';
    const state = locMatch ? locMatch[2].trim() : '';

    // 6. Extracted Skills
    const extractedSkills = extractSkillsFromText(text);

    // 7. Extracted Role Titles
    const extractedTitles = [];
    for (const title of COMMON_ROLE_TITLES) {
      const re = new RegExp(`\\b${escapeRegex(title)}\\b`, 'i');
      if (re.test(text)) {
        extractedTitles.push(title);
      }
    }
    if (extractedTitles.length === 0) {
      extractedTitles.push('Software Engineer');
    }

    // 8. Years of Experience
    let yearsOfExperience = '';
    const explicitYears = text.match(/(\d{1,2})\+?\s*years?\s+of\s+(?:professional\s+|relevant\s+|full-time\s+)?experience/i);
    if (explicitYears) {
      yearsOfExperience = explicitYears[1];
    } else {
      const yearMatches = Array.from(text.matchAll(/\b(20\d{2})\s*[-–—to]+\s*(Present|Current|20\d{2})\b/gi));
      if (yearMatches.length > 0) {
        const startYears = yearMatches.map((m) => Number(m[1])).filter((y) => y >= 2000 && y <= 2026);
        if (startYears.length > 0) {
          const earliest = Math.min(...startYears);
          const diff = Math.max(1, new Date().getFullYear() - earliest);
          yearsOfExperience = String(diff);
        }
      }
    }

    return {
      rawText: text,
      fullName,
      firstName,
      lastName,
      email,
      phone,
      city,
      state,
      linkedin,
      github,
      extractedSkills,
      extractedTitles,
      yearsOfExperience: yearsOfExperience || '5',
      lastParsedAt: Date.now()
    };
  }

  /**
   * Extracts readable text from an uploaded PDF, DOCX, TXT, or MD file locally in the browser
   */
  async function extractTextFromUploadedFile(file) {
    if (!file) return '';
    const name = (file.name || '').toLowerCase();

    if (name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.json')) {
      return await file.text();
    }

    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // Local PDF text extraction (handles both uncompressed and FlateDecode streams)
    if (name.endsWith('.pdf') || file.type === 'application/pdf') {
      const rawLatin = new TextDecoder('latin1').decode(bytes);
      const chunks = [];

      // Extract parenthesized PDF text strings: (Hello World) Tj or [(Hello) -20 (World)] TJ
      const extractStringsFromPdfContent = (contentStr) => {
        const matches = contentStr.matchAll(/\(([^()\\]*(?:\\.[^()\\]*)*)\)/g);
        for (const m of matches) {
          const s = m[1]
            .replace(/\\n/g, '\n')
            .replace(/\\r/g, ' ')
            .replace(/\\t/g, ' ')
            .replace(/\\\(/g, '(')
            .replace(/\\\)/g, ')')
            .replace(/\\\\/g, '\\');
          if (/[a-zA-Z0-9]{2,}/.test(s) && !/^PDF-|obj|endobj|stream|FlateDecode|Type|Font/i.test(s)) {
            chunks.push(s);
          }
        }
      };

      extractStringsFromPdfContent(rawLatin);

      // Also attempt DecompressionStream('deflate') on compressed PDF streams if available
      if (typeof DecompressionStream !== 'undefined') {
        const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
        let match;
        while ((match = streamRegex.exec(rawLatin)) !== null) {
          const streamBinary = match[1];
          if (streamBinary.length > 10 && streamBinary.length < 500000) {
            const buf = new Uint8Array(streamBinary.length);
            for (let i = 0; i < streamBinary.length; i++) {
              buf[i] = streamBinary.charCodeAt(i) & 0xff;
            }
            try {
              const ds = new DecompressionStream('deflate');
              const writer = ds.writable.getWriter();
              writer.write(buf);
              writer.close();
              const decompressedBuf = await new Response(ds.readable).arrayBuffer();
              const decompressedText = new TextDecoder('latin1').decode(decompressedBuf);
              extractStringsFromPdfContent(decompressedText);
            } catch (e) {
              // Not a standard zlib stream; ignore
            }
          }
        }
      }

      return chunks.join(' ').replace(/\s+/g, ' ').trim();
    }

    // Fallback: extract printable ASCII/UTF-8 runs
    const rawUtf8 = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    const printable = rawUtf8.match(/[a-zA-Z0-9@.,:/+\-()\s]{4,}/g) || [];
    return printable.join(' ').replace(/\s+/g, ' ').trim();
  }

  /**
   * Scores a job listing against the candidate's parsed resume & preferences
   * job: { jobId, title, company, location, description, isEasyApply, url, platform }
   */
  function scoreJobListing(job, localData) {
    const autoApply = (localData && localData.autoApply) || {};
    const prefs = autoApply.preferences || {};
    const parsed = autoApply.parsedResume || {};
    const profile = (localData && localData.profile) || {};

    const jobTitle = String(job.title || '').trim();
    const jobCompany = String(job.company || '').trim();
    const jobLocation = String(job.location || '').trim();
    const jobDesc = String(job.description || '').trim();
    const combinedJobText = `${jobTitle} ${jobCompany} ${jobLocation} ${jobDesc}`;

    // 1. Check if already applied
    const appliedList = autoApply.appliedJobs || [];
    const alreadyApplied = appliedList.some(
      (a) =>
        (job.jobId && a.jobId === job.jobId) ||
        (jobTitle &&
          jobCompany &&
          (a.title || '').toLowerCase() === jobTitle.toLowerCase() &&
          (a.company || '').toLowerCase() === jobCompany.toLowerCase())
    );

    // 2. Check Blacklisted Companies & Keywords
    const blacklistedCompanies = (prefs.blacklistedCompanies || []).map((c) => c.toLowerCase().trim()).filter(Boolean);
    const blacklistedKeywords = (prefs.blacklistedKeywords || []).map((k) => k.toLowerCase().trim()).filter(Boolean);

    const matchedBlacklistedCompany = blacklistedCompanies.find((bc) => jobCompany.toLowerCase().includes(bc));
    const matchedBlacklistedKeyword = blacklistedKeywords.find(
      (bk) => jobTitle.toLowerCase().includes(bk) || jobDesc.toLowerCase().includes(bk)
    );

    if (matchedBlacklistedCompany || matchedBlacklistedKeyword) {
      return {
        score: 0,
        eligible: false,
        alreadyApplied,
        blacklisted: true,
        blacklistReason: matchedBlacklistedCompany
          ? `Excluded Company: ${matchedBlacklistedCompany}`
          : `Excluded Keyword: ${matchedBlacklistedKeyword}`,
        matchedSkills: [],
        missingSkills: [],
        breakdown: { titleScore: 0, skillScore: 0, expScore: 0, locScore: 0 }
      };
    }

    // 3. Title & Role Alignment (0 - 35 points)
    const targetRoles = Array.from(
      new Set([
        ...(prefs.targetRoles || []),
        ...(parsed.extractedTitles || []),
        profile.currentTitle || ''
      ])
    )
      .map((r) => r.trim())
      .filter(Boolean);

    let titleScore = 10; // baseline if generic engineering/professional role
    const lowerTitle = jobTitle.toLowerCase();

    for (const role of targetRoles) {
      const lowerRole = role.toLowerCase();
      if (lowerTitle.includes(lowerRole) || lowerRole.includes(lowerTitle)) {
        titleScore = 35;
        break;
      }
      const roleTokens = lowerRole.split(/\s+/).filter((t) => t.length > 2);
      const matchedTokens = roleTokens.filter((t) => lowerTitle.includes(t));
      if (roleTokens.length > 0) {
        const partial = Math.round((matchedTokens.length / roleTokens.length) * 32);
        if (partial > titleScore) titleScore = partial;
      }
    }

    // 4. Skills Alignment (0 - 40 points)
    const candidateSkills = Array.from(
      new Set([...(prefs.targetSkills || []), ...(parsed.extractedSkills || [])])
    );
    const candidateSkillsLower = new Set(candidateSkills.map((s) => s.toLowerCase()));

    const jobSkills = extractSkillsFromText(combinedJobText);
    const matchedSkills = [];
    const missingSkills = [];

    for (const js of jobSkills) {
      if (candidateSkillsLower.has(js.toLowerCase())) {
        matchedSkills.push(js);
      } else {
        missingSkills.push(js);
      }
    }

    let skillScore = 0;
    if (jobSkills.length === 0) {
      // If job card only shows title + snippet without full tech list, give proportional credit based on title match
      skillScore = Math.round((titleScore / 35) * 30);
    } else {
      const ratio = matchedSkills.length / Math.min(jobSkills.length, 6);
      skillScore = Math.min(40, Math.round(ratio * 40));
    }

    // 5. Experience / Seniority Fit (0 - 15 points)
    const candidateYears = Number(profile.yearsOfExperience || parsed.yearsOfExperience || 5);
    let expScore = 13;
    const reqYearsMatch = combinedJobText.match(/(\d{1,2})\+?\s*years?\s+of\s+experience/i);
    if (reqYearsMatch) {
      const reqYears = Number(reqYearsMatch[1]);
      if (candidateYears >= reqYears) {
        expScore = 15;
      } else if (reqYears - candidateYears <= 2) {
        expScore = 10;
      } else {
        expScore = 4;
      }
    }

    // 6. Location / Remote Fit (0 - 10 points)
    let locScore = 8;
    const isRemoteJob = /remote|anywhere|work from home/i.test(`${jobLocation} ${jobTitle}`);
    const preferredLocs = (prefs.preferredLocations || []).map((l) => l.toLowerCase().trim()).filter(Boolean);
    if (prefs.remoteOnly && !isRemoteJob) {
      locScore = 0;
    } else if (
      isRemoteJob ||
      preferredLocs.some((pl) => jobLocation.toLowerCase().includes(pl)) ||
      (profile.city && jobLocation.toLowerCase().includes(profile.city.toLowerCase()))
    ) {
      locScore = 10;
    }

    const totalScore = Math.min(100, Math.max(0, titleScore + skillScore + expScore + locScore));
    const minThreshold = Number(prefs.minMatchScore || 65);
    const eligible = !alreadyApplied && totalScore >= minThreshold && (!prefs.remoteOnly || isRemoteJob);

    return {
      score: totalScore,
      eligible,
      alreadyApplied,
      blacklisted: false,
      blacklistReason: '',
      matchedSkills,
      missingSkills,
      breakdown: { titleScore, skillScore, expScore, locScore }
    };
  }

  /**
   * Generates direct job search URLs across LinkedIn and major job platforms tailored to the parsed resume
   */
  function generatePlatformSearchUrls(localData) {
    const autoApply = (localData && localData.autoApply) || {};
    const prefs = autoApply.preferences || {};
    const parsed = autoApply.parsedResume || {};
    const profile = (localData && localData.profile) || {};

    const primaryRole =
      (prefs.targetRoles && prefs.targetRoles[0]) ||
      (parsed.extractedTitles && parsed.extractedTitles[0]) ||
      profile.currentTitle ||
      'Software Engineer';

    const topSkills = Array.from(
      new Set([...(prefs.targetSkills || []), ...(parsed.extractedSkills || [])])
    ).slice(0, 3);

    const primaryLoc =
      (prefs.preferredLocations && prefs.preferredLocations[0]) ||
      profile.city ||
      'Remote';

    const roleAndSkillsQuery = `${primaryRole} ${topSkills.slice(0, 2).join(' ')}`.trim();
    const encRole = encodeURIComponent(primaryRole);
    const encQuery = encodeURIComponent(roleAndSkillsQuery);
    const encLoc = encodeURIComponent(primaryLoc);

    return [
      {
        id: 'linkedin_easy',
        name: 'LinkedIn Jobs (Easy Apply)',
        icon: '🟦',
        badge: 'Multi-Step Auto-Apply Supported',
        url: `https://www.linkedin.com/jobs/search/?keywords=${encQuery}&location=${encLoc}&f_AL=true`
      },
      {
        id: 'linkedin_all',
        name: 'LinkedIn Jobs (All Matching Roles)',
        icon: '💼',
        badge: 'Easy Apply + External ATS',
        url: `https://www.linkedin.com/jobs/search/?keywords=${encRole}&location=${encLoc}`
      },
      {
        id: 'indeed',
        name: 'Indeed Jobs',
        icon: '🔎',
        badge: 'Indeed Apply + ATS',
        url: `https://www.indeed.com/jobs?q=${encQuery}&l=${encLoc}`
      },
      {
        id: 'glassdoor',
        name: 'Glassdoor Jobs',
        icon: '🟢',
        badge: 'Easy Apply + Salary Data',
        url: `https://www.glassdoor.com/Job/jobs.htm?sc.keyword=${encRole}`
      },
      {
        id: 'wellfound',
        name: 'Wellfound (Startups)',
        icon: '🚀',
        badge: 'Startup Direct Apply',
        url: `https://wellfound.com/jobs?query=${encRole}`
      },
      {
        id: 'builtin',
        name: 'BuiltIn Tech Jobs',
        icon: '⚡',
        badge: 'Tech Portals',
        url: `https://builtin.com/jobs?search=${encRole}`
      },
      {
        id: 'dice',
        name: 'Dice Tech Jobs',
        icon: '🎲',
        badge: 'Easy Apply Tech',
        url: `https://www.dice.com/jobs?q=${encQuery}&location=${encLoc}`
      },
      {
        id: 'ziprecruiter',
        name: 'ZipRecruiter',
        icon: '🟩',
        badge: '1-Click / ATS Apply',
        url: `https://www.ziprecruiter.com/jobs-search?search=${encRole}&location=${encLoc}`
      },
      {
        id: 'ats_direct',
        name: 'Direct ATS Search (Greenhouse / Ashby / Workday / Eightfold)',
        icon: '🎯',
        badge: 'Direct ATS Forms',
        url: `https://www.google.com/search?q=${encodeURIComponent(
          `(site:boards.greenhouse.io OR site:jobs.ashbyhq.com OR site:myworkdayjobs.com OR site:eightfold.ai OR site:jobs.lever.co) "${primaryRole}" "${topSkills[0] || ''}"`
        )}`
      }
    ];
  }

  global.LocalApplyResumeParser = {
    SKILL_DICTIONARY,
    COMMON_ROLE_TITLES,
    extractSkillsFromText,
    parseResumeText,
    extractTextFromUploadedFile,
    scoreJobListing,
    generatePlatformSearchUrls
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
