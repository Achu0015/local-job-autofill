// LocalApply Real Live Job Fetcher
// Pulls real, live job postings directly from LinkedIn Guest API, Greenhouse Public API, Ashby Public API & Remotive API

(function (global) {
  const GREENHOUSE_BOARDS = [
    { token: 'stripe', name: 'Stripe' },
    { token: 'cloudflare', name: 'Cloudflare' },
    { token: 'datadog', name: 'Datadog' },
    { token: 'vercel', name: 'Vercel' },
    { token: 'figma', name: 'Figma' },
    { token: 'coinbase', name: 'Coinbase' }
  ];

  const ASHBY_BOARDS = [
    { token: 'linear', name: 'Linear' },
    { token: 'ramp', name: 'Ramp' },
    { token: 'supabase', name: 'Supabase' },
    { token: 'vanta', name: 'Vanta' },
    { token: 'notion', name: 'Notion' }
  ];

  function stripHtml(html) {
    if (!html) return '';
    return String(html)
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|li|div|h[1-6])>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /**
   * Parses raw HTML returned by LinkedIn's public guest search endpoint:
   * https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search
   */
  function parseLinkedInGuestSearchHtml(html) {
    const jobs = [];
    if (!html) return jobs;

    // Split by <li> blocks so it works both in DOM and Service Worker / headless environments
    const liBlocks = html.split(/<li[^>]*>/i).slice(1);
    for (const block of liBlocks) {
      const urnMatch = block.match(/data-entity-urn="urn:li:jobPosting:(\d+)"/i);
      const jobId = urnMatch ? `li_${urnMatch[1]}` : '';
      const numericId = urnMatch ? urnMatch[1] : '';
      if (!jobId) continue;

      const titleMatch =
        block.match(/<h3[^>]*class="[^"]*base-search-card__title[^"]*"[^>]*>([\s\S]*?)<\/h3>/i) ||
        block.match(/<span[^>]*class="sr-only"[^>]*>([\s\S]*?)<\/span>/i);
      const companyMatch = block.match(
        /<h4[^>]*class="[^"]*base-search-card__subtitle[^"]*"[^>]*>([\s\S]*?)<\/h4>/i
      );
      const locationMatch = block.match(
        /<span[^>]*class="[^"]*job-search-card__location[^"]*"[^>]*>([\s\S]*?)<\/span>/i
      );
      const linkMatch = block.match(
        /<a[^>]*class="[^"]*base-card__full-link[^"]*"[^>]*href="([^"]+)"/i
      );
      const timeMatch = block.match(/<time[^>]*datetime="([^"]+)"[^>]*>([\s\S]*?)<\/time>/i);

      const title = stripHtml(titleMatch ? titleMatch[1] : '');
      const company = stripHtml(companyMatch ? companyMatch[1] : '');
      const location = stripHtml(locationMatch ? locationMatch[1] : 'United States');
      const url = linkMatch ? linkMatch[1].replace(/&amp;/g, '&') : `https://www.linkedin.com/jobs/view/${numericId}`;
      const postedAgo = stripHtml(timeMatch ? timeMatch[2] : 'Recently');

      if (!title) continue;

      jobs.push({
        jobId,
        numericId,
        platform: 'LinkedIn Jobs',
        title,
        company: company || 'LinkedIn Employer',
        location,
        postedAgo,
        url,
        applyUrl: url,
        isEasyApply: true,
        description: `${title} at ${company} (${location}). Click card or Fetch Details to view full LinkedIn job description.`
      });
    }

    return jobs;
  }

  /**
   * Fetches the full job description for a single LinkedIn job ID from LinkedIn's guest jobPosting endpoint
   */
  async function fetchLinkedInJobDetail(numericId) {
    if (!numericId) return null;
    try {
      const resp = await fetch(
        `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${encodeURIComponent(numericId)}`,
        {
          method: 'GET',
          headers: { Accept: 'text/html' }
        }
      );
      if (!resp.ok) return null;
      const html = await resp.text();
      const markupMatch = html.match(
        /<div[^>]*class="[^"]*show-more-less-html__markup[^"]*"[^>]*>([\s\S]*?)<\/div>/i
      );
      const criteriaMatches = Array.from(
        html.matchAll(/<span[^>]*class="[^"]*description__job-criteria-text[^"]*"[^>]*>([\s\S]*?)<\/span>/gi)
      ).map((m) => stripHtml(m[1]));

      const descriptionText = stripHtml(markupMatch ? markupMatch[1] : '');
      const isOffsiteApply = /applyUrl|offsite/i.test(html);

      return {
        description: descriptionText || '',
        criteria: criteriaMatches,
        isEasyApply: !isOffsiteApply
      };
    } catch (e) {
      return null;
    }
  }

  /**
   * Fetches live LinkedIn jobs + enriches the top results with full descriptions
   */
  async function fetchLiveLinkedInJobs(keywords = 'Software Engineer', location = 'United States', limit = 10) {
    const url = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${encodeURIComponent(
      keywords
    )}&location=${encodeURIComponent(location)}&start=0`;

    const resp = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'text/html' }
    });
    if (!resp.ok) {
      throw new Error(`LinkedIn HTTP ${resp.status}`);
    }
    const html = await resp.text();
    const cards = parseLinkedInGuestSearchHtml(html).slice(0, limit);

    // Fetch full descriptions for top 6 cards in parallel so local skill scoring is 100% accurate
    await Promise.all(
      cards.slice(0, 6).map(async (card) => {
        const detail = await fetchLinkedInJobDetail(card.numericId);
        if (detail && detail.description) {
          card.description = detail.description;
          if (detail.criteria && detail.criteria.length) {
            card.criteria = detail.criteria.join(' · ');
          }
        }
      })
    );

    return cards;
  }

  /**
   * Fetches live Greenhouse jobs across major tech companies matching keywords
   */
  async function fetchLiveGreenhouseJobs(keywords = 'Engineer', limit = 8) {
    const kwTokens = String(keywords || '')
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 2);

    const results = [];
    await Promise.all(
      GREENHOUSE_BOARDS.slice(0, 4).map(async (board) => {
        try {
          const resp = await fetch(
            `https://boards-api.greenhouse.io/v1/boards/${board.token}/jobs?content=true`
          );
          if (!resp.ok) return;
          const data = await resp.json();
          const jobs = (data && data.jobs) || [];
          const matching = jobs.filter((j) => {
            const titleLower = (j.title || '').toLowerCase();
            return kwTokens.length === 0 || kwTokens.some((t) => titleLower.includes(t));
          });

          for (const j of matching.slice(0, 3)) {
            const cleanDesc = stripHtml(j.content || j.title || '');
            results.push({
              jobId: `gh_${board.token}_${j.id}`,
              platform: 'Greenhouse',
              title: j.title,
              company: board.name,
              location: (j.location && j.location.name) || 'Remote / US',
              postedAgo: j.updated_at ? new Date(j.updated_at).toLocaleDateString() : 'Live',
              url: j.absolute_url,
              applyUrl: j.absolute_url,
              isEasyApply: true,
              description: cleanDesc.slice(0, 2500)
            });
          }
        } catch (e) {
          // ignore single board error
        }
      })
    );

    return results.slice(0, limit);
  }

  /**
   * Fetches live Ashby jobs across major tech startups matching keywords
   */
  async function fetchLiveAshbyJobs(keywords = 'Engineer', limit = 8) {
    const kwTokens = String(keywords || '')
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 2);

    const results = [];
    await Promise.all(
      ASHBY_BOARDS.slice(0, 4).map(async (board) => {
        try {
          const resp = await fetch(
            `https://api.ashbyhq.com/posting-api/job-board/${board.token}`
          );
          if (!resp.ok) return;
          const data = await resp.json();
          const jobs = (data && data.jobs) || [];
          const matching = jobs.filter((j) => {
            const titleLower = (j.title || '').toLowerCase();
            return kwTokens.length === 0 || kwTokens.some((t) => titleLower.includes(t));
          });

          for (const j of matching.slice(0, 3)) {
            const cleanDesc = stripHtml(
              j.descriptionPlain || j.descriptionHtml || `${j.title} (${j.department || 'Engineering'}) at ${board.name}`
            );
            results.push({
              jobId: `ashby_${board.token}_${j.id}`,
              platform: 'Ashby',
              title: j.title,
              company: board.name,
              location: j.location || (j.isRemote ? 'Remote' : 'United States'),
              postedAgo: j.publishedAt ? new Date(j.publishedAt).toLocaleDateString() : 'Live',
              url: j.applyUrl || j.jobUrl,
              applyUrl: j.applyUrl || j.jobUrl,
              isEasyApply: true,
              description: cleanDesc.slice(0, 2500)
            });
          }
        } catch (e) {
          // ignore single board error
        }
      })
    );

    return results.slice(0, limit);
  }

  /**
   * Combined live job aggregator across LinkedIn, Greenhouse, and Ashby
   */
  async function fetchAllLiveJobs(options = {}) {
    const keywords = options.keywords || 'Software Engineer';
    const location = options.location || 'United States';

    const settled = await Promise.allSettled([
      fetchLiveLinkedInJobs(keywords, location, 10),
      fetchLiveGreenhouseJobs(keywords, 6),
      fetchLiveAshbyJobs(keywords, 6)
    ]);

    const combined = [];
    for (const res of settled) {
      if (res.status === 'fulfilled' && Array.isArray(res.value)) {
        combined.push(...res.value);
      }
    }

    return combined;
  }

  global.LocalApplyLiveFetcher = {
    stripHtml,
    parseLinkedInGuestSearchHtml,
    fetchLinkedInJobDetail,
    fetchLiveLinkedInJobs,
    fetchLiveGreenhouseJobs,
    fetchLiveAshbyJobs,
    fetchAllLiveJobs
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
