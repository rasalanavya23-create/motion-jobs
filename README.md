# 🎬 Motion Jobs — Global Motion Design Job Portal

A self-refreshing job portal that aggregates motion designer roles worldwide.
Auto-refreshes every 24 hours via GitHub Actions. Zero maintenance required after setup.

---

## ⚡ 10-Minute Setup

### Step 1 — Get Free API Keys (2 APIs, both free)

#### A. Adzuna API (worldwide jobs)
1. Go to https://developer.adzuna.com/
2. Sign up for a free account
3. Create an application → copy your **App ID** and **App Key**

#### B. JSearch via RapidAPI (USA/LinkedIn/Indeed/Glassdoor data)
1. Go to https://rapidapi.com/letscrape-6bfcf95c52dc59cca1ea0fb0/api/jsearch
2. Sign up for free RapidAPI account
3. Subscribe to JSearch (free tier: 500 requests/month)
4. Copy your **RapidAPI Key** from the header

---

### Step 2 — Create GitHub Repository

1. Go to https://github.com/new
2. Name it `motion-jobs` (or anything you like)
3. Set to **Public**
4. Click **Create repository**

---

### Step 3 — Push the code

Open your Terminal and run:

```bash
cd /Users/navyarasala/motion-jobs
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/motion-jobs.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username.

---

### Step 4 — Add API Keys as Secrets

1. Go to your repo on GitHub → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret** and add these three:

| Secret Name     | Value                      |
|-----------------|---------------------------|
| `ADZUNA_APP_ID` | Your Adzuna App ID        |
| `ADZUNA_APP_KEY`| Your Adzuna App Key       |
| `RAPIDAPI_KEY`  | Your RapidAPI Key         |

---

### Step 5 — Enable GitHub Pages

1. Go to your repo → **Settings** → **Pages**
2. Under **Source**, select **Deploy from a branch**
3. Choose **main** branch, **/ (root)** folder
4. Click **Save**

Your site will be live at: `https://YOUR_USERNAME.github.io/motion-jobs/`

---

### Step 6 — Run the first job fetch manually

1. Go to your repo → **Actions** tab
2. Click **Fetch Motion Design Jobs Daily**
3. Click **Run workflow** → **Run workflow**

Wait ~2 minutes. Jobs will appear on your site immediately.

---

## 🔄 How Auto-Refresh Works

- GitHub Actions runs the Python script every day at **6:00 AM UTC**
- The script fetches jobs from Adzuna (worldwide) + JSearch (USA/LinkedIn/Indeed)
- Results are saved to `data/jobs.json` and committed back to the repo
- Your site automatically shows the new data (no server needed)
- This runs automatically for **free** — no intervention needed

**Free tier limits:**
- Adzuna: 250 requests/day (we use ~60/day)
- JSearch: 500 requests/month (we use ~100/month)
- GitHub Actions: 2,000 minutes/month (we use ~60 minutes/month)

All well within free limits for 30+ days.

---

## ✨ Features

- **Job listings** from USA (New York priority), UK, Canada, Australia, and 25+ countries
- **Filters**: Date (24h / week / month), Work type, Employment type, Country, Visa sponsorship
- **Each job shows**: Title, Company, Location, Salary, Skills, Work type, Date posted, Source
- **Decision Makers**: LinkedIn search links for recruiters and hiring managers at each company
- **Personalized outreach messages**: Auto-generated, company-specific, ready to send
- **Bookmarks**: Save jobs you're interested in
- **Application Tracker**: Track applied/interview/offer/rejected status
- **Profile**: Store your resume, portfolio link, and contact details
- **New job notifications**: Badge shows how many new jobs appeared since your last visit

---

## 📁 File Structure

```
motion-jobs/
├── index.html                    # The website
├── css/styles.css                # All styling
├── js/app.js                     # Frontend logic
├── data/jobs.json                # Auto-generated job data
├── scripts/
│   ├── fetch_jobs.py             # Data pipeline
│   └── requirements.txt         # Python deps
└── .github/
    └── workflows/
        └── fetch_jobs.yml        # Daily auto-refresh
```

---

## 🛠 Troubleshooting

**No jobs showing up?**
→ Run the GitHub Action manually (Step 6 above). The initial `data/jobs.json` is empty.

**Action failing?**
→ Check that all 3 secrets are set correctly in Settings → Secrets.

**Want to refresh more often?**
→ Edit `.github/workflows/fetch_jobs.yml` and change the cron schedule.

---

## ⚠️ Data Source Notes

| Source | What it provides |
|--------|-----------------|
| JSearch (RapidAPI) | Aggregates LinkedIn Jobs, Indeed, Glassdoor, ZipRecruiter — legitimate API access |
| Adzuna | Direct job board, 16+ countries |
| Remotive | Remote-only creative jobs |
| The Muse | US tech/creative companies |

LinkedIn, Instagram, and Twitter direct scraping is not included — they block automated access and violate their ToS. JSearch provides the same LinkedIn job data through their official API partnership.
