# LocalApply — 100% Local Job Application Autofill, Answer Memory & Resume Auto-Applier

A strictly local, offline-first Manifest V3 Chrome/Brave/Edge extension that:
1. **Parses your Resume 100% locally** (`PDF`, `DOCX`, `TXT`, or pasted text) to extract your skills, target job titles, years of experience, and contact info.
2. **Scans & Scores Job Listings (`0–100% Match`)** on **LinkedIn Jobs, Indeed, Glassdoor, Wellfound, BuiltIn, Dice, ZipRecruiter**, and direct ATS boards.
3. **Executes Both Select-and-Review & Full Auto-Apply Loops** across multi-step **LinkedIn Easy Apply** modals, **Indeed Apply**, and **Workday, Greenhouse, Ashby, Eightfold.ai, Lever, SmartRecruiters, and iCIMS**.
4. **Remembers Your Custom Answers Locally** in `chrome.storage.local` with on-demand category & field-level checkboxes.

## Key Features
- **100% Local Device Storage (`chrome.storage.local`)**: Zero external servers, zero telemetry, zero cloud accounts.
- **100% Local Resume Parser & Relevance Scorer (`src/resume-parser.js`)**:
  - Extracts 180+ technical & domain skills, role titles, and experience years locally.
  - Scores job cards (`0–100%`) based on Role Alignment (35%), Skills Overlap (40%), Seniority Fit (15%), and Location/Remote Fit (10%).
  - Supports adjustable **Min Match % Slider** and **Company / Keyword Blacklists**.
- **Dual Auto-Apply Execution Modes (`src/job-copilot.js`)**:
  - **Mode 1: Select & Review Queue (`semi_auto`)**: Pick which discovered jobs to apply to, autofill all multi-step screens (`Next` -> `Review`), and pause right before the final `Submit` button for your review.
  - **Mode 2: Full Auto-Apply Loop (`full_auto`)**: Automatically steps through and submits all checked matching jobs with safe human-like pacing and logs every application in the **Local Applied Jobs Tracker** (preventing duplicate applications).
- **On-Demand Category & Individual Field Selection (`src/content.js`)**:
  - Toggle `Profile`, `Experience`, `Education`, `Work Auth`, `EEO`, `Custom Q&A`, and `Resume PDF` on/off on demand, or inspect and check/uncheck individual fields.
- **Configurable Answer Learning**:
  - Switch between **Auto-Capture Mode**, **Manual Save Button Mode**, or **Both**.

## How to Load & Test in Chrome / Brave / Edge
1. Open `chrome://extensions` in your browser and enable **Developer mode**.
2. Click **Load unpacked** and select `/Users/hasinalamadgu/.gemini/antigravity/scratch/local-job-autofill`.
3. In the **Local Candidate Vault Dashboard**:
   - Click **✨ Load Demo Profile** (or upload/paste your own resume in **🚀 Resume Auto-Applier**).
   - Click **🟦 LinkedIn Auto-Apply Sandbox** (`test-pages/linkedin-easy-apply-sandbox.html`) or **🧪 Multi-ATS Sandbox** (`test-pages/ats-sandbox.html`) to test multi-job scoring and multi-step auto-applying immediately!
