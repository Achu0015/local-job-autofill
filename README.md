# LocalApply — 100% Local Job Application Autofill & Answer Memory

A strictly local, offline-first Manifest V3 Chrome/Brave/Edge extension that autofills job applications and remembers your custom answers across **Workday, Greenhouse, Ashby, Eightfold.ai, Lever, SmartRecruiters, iCIMS**, and generic company career portals.

## Key Features
1. **100% Local Device Storage (`chrome.storage.local`)**:
   - Zero external servers, zero analytics, zero network permissions.
   - Full JSON Export/Import backup and 1-click data wipe.
2. **Pick & Choose Categories and Fields On-Demand**:
   - Toggle categories on/off anytime (`Profile & Contact`, `Work Experience`, `Education`, `Work Authorization`, `EEO / Demographics`, `Custom Q&A Bank`, `Resume & Cover Letter Files`).
   - Inspect and check/uncheck individual detected fields on the job page before clicking **Autofill Selected**.
3. **Configurable Answer Learning (Option 1, Option 2, or Both)**:
   - **Option 1 (Auto-Capture + Select)**: Automatically detects new or updated answers as you fill out job applications and lists them so you can select which ones to keep.
   - **Option 2 (Manual Save Button)**: Only scans for answers when you click the **Save Answers** button, presenting a checklist of filled answers to store locally.
   - **Both (Default)**: Gives you live auto-detection plus manual scan/save controls at all times.
4. **Pure Local Heuristic & Fuzzy Question Matcher**:
   - Matches rephrased questions across platforms using local token Jaccard + bigram Dice similarity and polarity guards (distinguishes *"Are you authorized to work?"* from *"Do you require sponsorship?"*).
   - Automatically matches `<select>`, radio groups, checkboxes, US state names/codes, degree aliases, and injects locally stored PDF/DOCX resumes into `<input type="file">` via `DataTransfer`.

## How to Load in Chrome / Brave / Edge
1. Open `chrome://extensions` in your browser.
2. Enable **Developer mode** (toggle in the top-right corner).
3. Click **Load unpacked** (top-left button).
4. Select this directory:
   `/Users/hasinalamadgu/.gemini/antigravity/scratch/local-job-autofill`
5. The **Local Candidate Vault Dashboard** will open automatically. Click **✨ Load Demo Profile** (or enter your own info) and click **🧪 Open Multi-ATS Sandbox** to test it immediately!
