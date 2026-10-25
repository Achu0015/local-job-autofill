# LocalApply — 100% Local Job Application Autofill, Answer Memory & Resume Auto-Applier

**LocalApply** is a strictly local, privacy-first Manifest V3 browser extension (Chrome, Brave, Microsoft Edge, Arc) that:
1. **Parses your Resume 100% locally** (`PDF`, `DOCX`, `TXT`, `MD`, or pasted text) to extract your skills, target job titles, years of experience, and contact details.
2. **Scans & Scores Job Listings (`0–100% Match`)** in real time on **LinkedIn Jobs, Indeed, Glassdoor, Wellfound, BuiltIn, Dice, ZipRecruiter**, and direct ATS career portals.
3. **Executes Both Select-and-Review & Full Auto-Apply Loops** across multi-step **LinkedIn Easy Apply** modals, **Indeed Apply**, and major Applicant Tracking Systems (**Workday, Greenhouse, Ashby, Eightfold.ai, Lever, SmartRecruiters, iCIMS**).
4. **Remembers Your Custom Answers Locally** inside `chrome.storage.local` with on-demand category and field-level selection.

---

## 🔒 Privacy & Local Storage Guarantee

- **100% Stored on Your Own Device:** All profile fields, work history, custom Q&A pairs, applied job logs, and resume files are stored strictly inside your browser's local storage (`chrome.storage.local`).
- **Zero Cloud Servers / Zero Telemetry:** This extension makes **no external API calls** and requires **no account creation**.
- **Full Data Portability:** Export your entire local vault to a `.json` backup file (or export your applied jobs log to `.csv`) anytime with 1 click.

---

## ✨ Key Features

### 1. Local Resume Parser & Job Relevance Scorer (`src/resume-parser.js`)
- Upload your resume (`PDF`, `TXT`, `MD`, `DOCX`) or paste your resume text to automatically extract:
  - **180+ Technical & Domain Skills** (Languages, Frontend, Backend, Cloud/DevOps, Data/AI/ML, Product, Agile, Finance).
  - **Target Role Titles & Seniority** and **Total Years of Experience**.
  - **Contact Info** (Name, Email, Phone, Location, LinkedIn, GitHub).
- Scores every job card on a job board (`0–100% Match`) based on:
  - **Role & Title Alignment (35%)**
  - **Skills Overlap (40%)**
  - **Experience / Seniority Fit (15%)**
  - **Location / Remote Fit (10%)**
- Includes an adjustable **Minimum Match % Slider** (e.g. `>= 65%`) and **Blacklist Filters** for excluded companies or keywords.

### 2. Multi-Platform Auto-Apply Queue (`src/job-copilot.js`)
Supports two user-selectable execution modes:
- **Mode 1 — Select & Review Queue (`semi_auto`):**
  - Scans and scores jobs on the page, lets you check/uncheck which jobs to apply to, fills every multi-step screen (`Next` → `Continue` → `Review`), and **pauses right before the final `Submit` button** so you can inspect the application first.
- **Mode 2 — Full Auto-Apply Loop (`full_auto`):**
  - Automatically steps through all checked matching jobs in sequence with configurable human-like pacing, submits the application, logs the job in your **Local Applied Jobs Tracker** (to prevent duplicate applications), and advances to the next job.

### 3. Universal ATS Autofill + On-Demand Selection (`src/adapters.js` & `src/content.js`)
- Works across **Workday** (`data-automation-id` + multi-entry Work Experience & Education blocks), **Greenhouse** (`#grnhse_app`), **Ashby** (`_systemfield_`), **Eightfold.ai** (including open Shadow DOM traversal), **Lever**, **SmartRecruiters**, and **iCIMS**.
- Automatically reconstructs and attaches your locally stored PDF/DOCX resume into `<input type="file">` upload fields via `DataTransfer`.
- **Pick & Choose On-Demand:** Toggle entire categories (`Profile`, `Experience`, `Education`, `Work Auth`, `EEO`, `Custom Q&A`, `Resume PDF`) or expand the on-page field list to check/uncheck individual fields before autofilling.

### 4. Automatic & Manual Answer Learning (`src/matcher.js`)
- Choose how LocalApply learns new answers as you fill out job applications:
  - **Option 1 (Auto-Capture):** Automatically detects newly typed or modified answers on the page and lets you select which ones to save.
  - **Option 2 (Manual Save Button):** Only scans when you click **Save Q&A**, displaying a checklist of filled answers to save to your local Q&A bank.
  - **Both (Default):** Keeps live detection and manual scan/save active together.

---

## 🚀 How to Install & Set Up on Your Device

### Step 1: Clone or Download the Repository
Clone this repository to any folder on your computer (or click **Code → Download ZIP** on GitHub and extract it):

```bash
git clone https://github.com/Achu0015/local-job-autofill.git
cd local-job-autofill
```

### Step 2: Load the Extension in Chrome / Brave / Edge
1. Open your browser and navigate to:
   - **Chrome:** `chrome://extensions`
   - **Brave:** `brave://extensions`
   - **Edge:** `edge://extensions`
2. Enable the **Developer mode** toggle in the top-right corner.
3. Click **Load unpacked** in the top-left corner.
4. Select the `local-job-autofill` folder you cloned or extracted in Step 1.
5. Pin **LocalApply** (`🔒`) from your browser's extensions puzzle menu for easy access.

### Step 3: Set Up Your Resume & Local Candidate Vault
1. When installed, the **LocalApply Candidate Vault** (`dashboard/dashboard.html`) opens automatically (you can also open it anytime by clicking the extension icon → **⚙️ Open Local Profile & Q&A Dashboard**).
2. In the **🚀 Resume Auto-Applier** tab:
   - Upload your resume file (`.pdf`, `.txt`, `.md`) or paste your resume text and click **🧠 Parse Resume Text & Sync to Profile**.
   - Review your extracted **Target Job Titles**, **Matched Skills**, **Minimum Match Score %**, and **Blacklist Filters**.
   - Choose your preferred **Execution Mode** (*Select & Review Queue* vs. *Full Auto-Apply Loop*).
3. Review the **👤 Profile & Contact**, **💼 Work Experience**, **🎓 Education**, **🛂 Work Auth & EEO**, and **📎 Resume & Cover Letter** tabs, then click **💾 Save All Changes**.

---

## 🧪 Testing Locally with Built-In Simulators

You can test every feature offline before visiting live job boards using the two built-in sandboxes (accessible directly from the top bar of the dashboard):

1. **🟦 LinkedIn Auto-Apply Simulator (`test-pages/linkedin-easy-apply-sandbox.html`):**
   - Click **✨ Load Demo Profile** in the dashboard, then open the **LinkedIn Auto-Apply Sandbox**.
   - Use the floating **LocalApply → 🚀 Auto-Apply** widget in the bottom-right corner to inspect job match badges (`93% Match`, `Excluded Company`, `Low Match`) and run either **Select & Review** or the **Full Auto-Apply Loop**.
2. **🧪 Multi-ATS Form Sandbox (`test-pages/ats-sandbox.html`):**
   - Simulates **Workday, Greenhouse, Ashby, and Eightfold** application forms so you can test category toggles, individual field selection, PDF resume upload injection, and custom answer learning.

---

## 📁 Project Structure

```text
local-job-autofill/
├── manifest.json                         # Manifest V3 configuration (strictly local permissions)
├── README.md                             # Setup and usage documentation
├── src/
│   ├── background.js                     # Service worker (install init & badge updates)
│   ├── storage.js                        # chrome.storage.local engine & binary file reconstruction
│   ├── matcher.js                        # Pure offline heuristic & fuzzy Q&A matcher
│   ├── resume-parser.js                  # Local resume parser, job relevance scorer & search URL builder
│   ├── adapters.js                       # Workday, Greenhouse, Ashby, Eightfold, Lever & Universal DOM adapters
│   ├── job-copilot.js                    # Job feed scanner, card badge injector & multi-step Easy Apply stepper
│   └── content.js                        # Isolated Shadow DOM floating controller widget
├── popup/
│   ├── popup.html                        # Browser toolbar popup UI
│   └── popup.js                          # Popup controller
├── dashboard/
│   ├── dashboard.html                    # Local Candidate Vault, Resume Auto-Applier & Applied Tracker UI
│   ├── dashboard.css                     # Dashboard styles
│   └── dashboard.js                      # Dashboard logic, JSON backup/restore & CSV export
└── test-pages/
    ├── ats-sandbox.html                  # Workday / Greenhouse / Ashby / Eightfold form simulator
    └── linkedin-easy-apply-sandbox.html  # LinkedIn job feed & multi-step Easy Apply simulator
```
