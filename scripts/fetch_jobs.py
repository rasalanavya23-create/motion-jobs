#!/usr/bin/env python3
"""
Motion Jobs Aggregator
Fetches motion designer jobs from multiple sources and saves to data/jobs.json
Run daily via GitHub Actions
"""

import requests
import json
import os
import re
import hashlib
from datetime import datetime, timezone, timedelta

ADZUNA_APP_ID  = os.environ.get("ADZUNA_APP_ID", "")
ADZUNA_APP_KEY = os.environ.get("ADZUNA_APP_KEY", "")
RAPIDAPI_KEY   = os.environ.get("RAPIDAPI_KEY", "")

MOTION_KEYWORDS = [
    "motion designer", "motion graphics", "motion design",
    "motion graphic designer", "mograph", "animation designer",
    "2d animator", "3d motion", "visual effects designer"
]

SKILL_KEYWORDS = [
    "after effects", "cinema 4d", "c4d", "blender", "premiere pro",
    "illustrator", "photoshop", "davinci resolve", "nuke", "houdini",
    "3d animation", "2d animation", "motion graphics", "vfx",
    "character animation", "ui animation", "lottie", "figma",
    "creative suite", "adobe cc", "maya", "unreal engine",
    "octane", "redshift", "arnold", "substance", "zbrush"
]

VISA_KEYWORDS = [
    "visa sponsorship", "will sponsor", "visa support", "h1b", "h-1b",
    "work permit", "work authorization", "sponsorship available",
    "sponsor work", "visa provided"
]

# Adzuna country codes: all supported regions
ADZUNA_COUNTRIES = [
    ("us", "United States"), ("gb", "United Kingdom"), ("au", "Australia"),
    ("ca", "Canada"),        ("de", "Germany"),         ("fr", "France"),
    ("nl", "Netherlands"),   ("sg", "Singapore"),       ("in", "India"),
    ("nz", "New Zealand"),   ("at", "Austria"),         ("be", "Belgium"),
    ("br", "Brazil"),        ("mx", "Mexico"),           ("za", "South Africa"),
    ("it", "Italy"),         ("es", "Spain"),            ("pl", "Poland"),
    ("se", "Sweden"),        ("no", "Norway"),           ("ch", "Switzerland"),
    ("dk", "Denmark"),       ("fi", "Finland"),          ("pt", "Portugal"),
    ("ae", "United Arab Emirates"), ("jp", "Japan"),    ("ie", "Ireland"),
    ("ru", "Russia"),        ("hu", "Hungary"),
]


# ─────────────────────────── helpers ────────────────────────────

def make_id(url: str) -> str:
    return hashlib.md5(url.encode()).hexdigest()[:16]


def check_visa(text: str) -> bool | None:
    if not text:
        return None
    lower = text.lower()
    return True if any(k in lower for k in VISA_KEYWORDS) else None


def extract_skills(text: str) -> list[str]:
    if not text:
        return []
    lower = text.lower()
    return [k.title() for k in SKILL_KEYWORDS if k in lower]


def detect_work_type(title: str, desc: str) -> str:
    text = (title + " " + desc).lower()
    if "remote" in text:
        return "Remote"
    if "hybrid" in text:
        return "Hybrid"
    return "On-site"


def detect_employment_type(title: str, desc: str) -> str:
    text = (title + " " + desc).lower()
    if any(w in text for w in ["freelance", "freelancer", "contract", "contractor"]):
        return "Freelance / Contract"
    if "internship" in text or "intern" in text:
        return "Internship"
    if "part-time" in text or "part time" in text:
        return "Part-time"
    return "Full-time"


def parse_iso(s: str) -> str:
    """Normalise various date strings to ISO-8601 UTC."""
    if not s:
        return datetime.now(timezone.utc).isoformat()
    for fmt in ("%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%dT%H:%M:%S.%fZ",
                "%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%d"):
        try:
            dt = datetime.strptime(s[:26], fmt[:len(s)])
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.isoformat()
        except ValueError:
            continue
    return datetime.now(timezone.utc).isoformat()


def format_salary(mn, mx, currency="$") -> str:
    if mn and mx:
        return f"{currency}{int(mn):,} – {currency}{int(mx):,}"
    if mn:
        return f"From {currency}{int(mn):,}"
    if mx:
        return f"Up to {currency}{int(mx):,}"
    return ""


def clean_html(text: str) -> str:
    if not text:
        return ""
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:3000]


# ─────────────────────────── Adzuna ─────────────────────────────

def fetch_adzuna(country_code: str, country_name: str) -> list[dict]:
    if not ADZUNA_APP_ID or not ADZUNA_APP_KEY:
        print(f"  Adzuna: missing API keys (ADZUNA_APP_ID={bool(ADZUNA_APP_ID)}, ADZUNA_APP_KEY={bool(ADZUNA_APP_KEY)})")
        return []
    jobs = []
    for query in ["motion designer", "motion graphics designer"]:
        for page in range(1, 4):
            url = f"https://api.adzuna.com/v1/api/jobs/{country_code}/search/{page}"
            params = {
                "app_id": ADZUNA_APP_ID,
                "app_key": ADZUNA_APP_KEY,
                "what": query,
                "results_per_page": 50,
                "sort_by": "date",
                "content-type": "application/json",
            }
            try:
                r = requests.get(url, params=params, timeout=15)
                if r.status_code != 200:
                    print(f"  Adzuna {country_code} HTTP {r.status_code}: {r.text[:300]}")
                    break
                data = r.json()
                results = data.get("results", [])
                if not results:
                    break
                for j in results:
                    jobs.append(_norm_adzuna(j, country_name))
            except Exception as e:
                print(f"  Adzuna {country_code} page {page}: {e}")
                break
    return jobs


def _norm_adzuna(j: dict, country_name: str) -> dict:
    area  = j.get("location", {}).get("area", [])
    city  = area[-1] if area else ""
    title = j.get("title", "Motion Designer")
    desc  = clean_html(j.get("description", ""))
    url   = j.get("redirect_url", "")
    return {
        "id":               make_id(url),
        "title":            title,
        "company":          j.get("company", {}).get("display_name", "Unknown"),
        "location":         city,
        "country":          country_name,
        "employment_type":  detect_employment_type(title, desc),
        "work_type":        detect_work_type(title, desc),
        "description":      desc,
        "salary":           format_salary(j.get("salary_min"), j.get("salary_max")),
        "salary_min":       j.get("salary_min"),
        "salary_max":       j.get("salary_max"),
        "date_posted":      parse_iso(j.get("created", "")),
        "source":           "Adzuna",
        "apply_url":        url,
        "visa_sponsorship": check_visa(desc),
        "skills":           extract_skills(desc),
        "experience":       "",
    }


# ─────────────────────────── JSearch (RapidAPI) ─────────────────

def fetch_jsearch(query: str, location: str = "", num_pages: int = 5) -> list[dict]:
    if not RAPIDAPI_KEY:
        print("  JSearch: missing RAPIDAPI_KEY")
        return []
    jobs = []
    full_query = f"{query} in {location}" if location else query
    for page in range(1, num_pages + 1):
        url = "https://jsearch.p.rapidapi.com/search"
        headers = {
            "x-rapidapi-key": RAPIDAPI_KEY,
            "x-rapidapi-host": "jsearch.p.rapidapi.com",
        }
        params = {
            "query": full_query,
            "page": page,
            "num_pages": 1,
            "date_posted": "month",
        }
        try:
            r = requests.get(url, headers=headers, params=params, timeout=15)
            if r.status_code != 200:
                print(f"  JSearch HTTP {r.status_code}: {r.text[:300]}")
                break
            results = r.json().get("data", [])
            if results:
                print(f"  JSearch '{full_query}' page {page}: {len(results)} jobs")
            if not results:
                break
            for j in results:
                jobs.append(_norm_jsearch(j))
        except Exception as e:
            print(f"  JSearch page {page}: {e}")
            break
    return jobs


def _norm_jsearch(j: dict) -> dict:
    title = j.get("job_title", "Motion Designer")
    desc  = clean_html(j.get("job_description", ""))
    url   = j.get("job_apply_link", "") or j.get("job_google_link", "")
    emp   = j.get("job_employment_type", "")
    country = j.get("job_country", "")

    sal_min = j.get("job_min_salary")
    sal_max = j.get("job_max_salary")
    currency = "$" if country in ("US", "United States") else ""

    posted_at = j.get("job_posted_at_datetime_utc", "") or j.get("job_posted_at_timestamp", "")
    if isinstance(posted_at, (int, float)):
        from datetime import datetime
        posted_at = datetime.utcfromtimestamp(posted_at).isoformat() + "Z"

    work_type = detect_work_type(title, desc)
    if j.get("job_is_remote"):
        work_type = "Remote"

    empl_map = {"FULLTIME": "Full-time", "PARTTIME": "Part-time",
                "CONTRACTOR": "Freelance / Contract", "INTERN": "Internship"}
    employment_type = empl_map.get(emp, detect_employment_type(title, desc))

    country_map = {"US": "United States", "GB": "United Kingdom", "CA": "Canada",
                   "AU": "Australia", "DE": "Germany", "FR": "France",
                   "NL": "Netherlands", "SG": "Singapore", "IN": "India"}
    country_name = country_map.get(country.upper(), country or "United States")

    return {
        "id":               make_id(url or title + j.get("employer_name", "")),
        "title":            title,
        "company":          j.get("employer_name", "Unknown"),
        "location":         j.get("job_city", "") or j.get("job_state", ""),
        "country":          country_name,
        "employment_type":  employment_type,
        "work_type":        work_type,
        "description":      desc,
        "salary":           format_salary(sal_min, sal_max, currency),
        "salary_min":       sal_min,
        "salary_max":       sal_max,
        "date_posted":      parse_iso(str(posted_at)),
        "source":           "JSearch (LinkedIn/Indeed/Glassdoor)",
        "apply_url":        url,
        "visa_sponsorship": check_visa(desc),
        "skills":           extract_skills(desc),
        "experience":       j.get("job_required_experience", {}).get("required_experience_in_months", ""),
    }


# ─────────────────────────── Remotive ────────────────────────────

def fetch_remotive() -> list[dict]:
    """Remotive is free, no auth required."""
    jobs = []
    url = "https://remotive.com/api/remote-jobs"
    params = {"category": "design", "limit": 100}
    try:
        r = requests.get(url, params=params, timeout=15)
        if r.status_code == 200:
            for j in r.json().get("jobs", []):
                title = j.get("title", "")
                if any(k in title.lower() for k in ["motion", "animation", "animator", "mograph"]):
                    jobs.append(_norm_remotive(j))
    except Exception as e:
        print(f"  Remotive error: {e}")
    return jobs


def _norm_remotive(j: dict) -> dict:
    title = j.get("title", "Motion Designer")
    desc  = clean_html(j.get("description", ""))
    url   = j.get("url", "")
    return {
        "id":               make_id(url),
        "title":            title,
        "company":          j.get("company_name", "Unknown"),
        "location":         "Remote",
        "country":          "Worldwide (Remote)",
        "employment_type":  detect_employment_type(title, desc),
        "work_type":        "Remote",
        "description":      desc,
        "salary":           j.get("salary", ""),
        "salary_min":       None,
        "salary_max":       None,
        "date_posted":      parse_iso(j.get("publication_date", "")),
        "source":           "Remotive",
        "apply_url":        url,
        "visa_sponsorship": None,
        "skills":           extract_skills(desc),
        "experience":       "",
    }


# ─────────────────────────── The Muse ────────────────────────────

def fetch_themuse() -> list[dict]:
    """The Muse has a free public API (no key needed for basic use)."""
    jobs = []
    url = "https://www.themuse.com/api/public/jobs"
    params = {"category": "Design & UX", "level": "Mid Level", "page": 0}
    for page in range(0, 3):
        params["page"] = page
        try:
            r = requests.get(url, params=params, timeout=15)
            if r.status_code != 200:
                break
            results = r.json().get("results", [])
            if not results:
                break
            for j in results:
                title = j.get("name", "")
                if any(k in title.lower() for k in ["motion", "animation", "animator"]):
                    jobs.append(_norm_muse(j))
        except Exception as e:
            print(f"  The Muse page {page}: {e}")
            break
    return jobs


def _norm_muse(j: dict) -> dict:
    title   = j.get("name", "Motion Designer")
    company = j.get("company", {}).get("name", "Unknown")
    desc    = clean_html(j.get("contents", ""))
    url     = j.get("refs", {}).get("landing_page", "")
    locs    = j.get("locations", [])
    loc     = locs[0].get("name", "") if locs else "United States"
    return {
        "id":               make_id(url),
        "title":            title,
        "company":          company,
        "location":         loc,
        "country":          "United States",
        "employment_type":  detect_employment_type(title, desc),
        "work_type":        detect_work_type(title, desc),
        "description":      desc,
        "salary":           "",
        "salary_min":       None,
        "salary_max":       None,
        "date_posted":      parse_iso(j.get("publication_date", "")),
        "source":           "The Muse",
        "apply_url":        url,
        "visa_sponsorship": check_visa(desc),
        "skills":           extract_skills(desc),
        "experience":       "",
    }


# ─────────────────────────── deduplicate ─────────────────────────

def deduplicate(jobs: list[dict]) -> list[dict]:
    seen_ids   = set()
    seen_pairs = set()
    result     = []
    for j in jobs:
        jid  = j["id"]
        pair = (j["company"].lower().strip(), j["title"].lower().strip())
        if jid in seen_ids or pair in seen_pairs:
            continue
        seen_ids.add(jid)
        seen_pairs.add(pair)
        result.append(j)
    return result


def filter_recent(jobs: list[dict], days: int = 35) -> list[dict]:
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    result = []
    for j in jobs:
        try:
            dt = datetime.fromisoformat(j["date_posted"].replace("Z", "+00:00"))
            if dt >= cutoff:
                result.append(j)
        except Exception:
            result.append(j)  # keep if date unparseable
    return result


# ─────────────────────────── main ────────────────────────────────

def main():
    all_jobs: list[dict] = []

    # ── JSearch (USA priority — New York first) ──
    print("Fetching JSearch: New York motion designer...")
    all_jobs += fetch_jsearch("motion designer", "New York", num_pages=5)

    print("Fetching JSearch: USA motion designer...")
    all_jobs += fetch_jsearch("motion designer", "United States", num_pages=5)

    print("Fetching JSearch: USA motion graphics...")
    all_jobs += fetch_jsearch("motion graphics designer", "United States", num_pages=3)

    print("Fetching JSearch: USA 2D animator...")
    all_jobs += fetch_jsearch("2D animator motion", "United States", num_pages=2)

    print("Fetching JSearch: remote motion designer...")
    all_jobs += fetch_jsearch("remote motion designer", num_pages=3)

    print("Fetching JSearch: mograph freelance...")
    all_jobs += fetch_jsearch("mograph freelance motion graphics", num_pages=2)

    # ── Adzuna (worldwide) ──
    for code, name in ADZUNA_COUNTRIES:
        print(f"Fetching Adzuna: {name}...")
        all_jobs += fetch_adzuna(code, name)

    # ── Remotive (remote) ──
    print("Fetching Remotive...")
    all_jobs += fetch_remotive()

    # ── The Muse (US) ──
    print("Fetching The Muse...")
    all_jobs += fetch_themuse()

    print(f"\nRaw total: {len(all_jobs)} jobs")

    all_jobs = deduplicate(all_jobs)
    print(f"After dedup: {len(all_jobs)} jobs")

    all_jobs = filter_recent(all_jobs, days=35)
    print(f"After 35-day filter: {len(all_jobs)} jobs")

    # Sort: USA/NY first, then by date
    def sort_key(j):
        is_us = 1 if j.get("country", "") == "United States" else 0
        is_ny = 1 if "new york" in (j.get("location") or "").lower() else 0
        return (-(is_us + is_ny), j.get("date_posted", ""))

    all_jobs.sort(key=sort_key, reverse=False)
    # After sort, reverse date within groups done above
    # Final sort: US/NY first, then newest first
    us_ny = [j for j in all_jobs if "new york" in (j.get("location") or "").lower()]
    us_other = [j for j in all_jobs if j.get("country") == "United States" and "new york" not in (j.get("location") or "").lower()]
    world = [j for j in all_jobs if j.get("country") != "United States"]
    for group in [us_ny, us_other, world]:
        group.sort(key=lambda x: x.get("date_posted", ""), reverse=True)
    all_jobs = us_ny + us_other + world

    output = {
        "last_updated": datetime.now(timezone.utc).isoformat(),
        "total_jobs": len(all_jobs),
        "jobs": all_jobs,
    }

    os.makedirs("data", exist_ok=True)
    with open("data/jobs.json", "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\nSaved {len(all_jobs)} jobs to data/jobs.json")
    print(f"Last updated: {output['last_updated']}")


if __name__ == "__main__":
    main()
