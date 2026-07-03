# Careers Page Integration Guide

This guide is for the BDG IT team. It covers how to pull live job listings from the ATS and submit applications in real time.

---

## Overview

The ATS exposes two public endpoints — no login needed:

| What | URL |
|------|-----|
| **Fetch active jobs** | `https://tdtvactpmkzvnlufsosk.supabase.co/rest/v1/jobs` |
| **Submit an application** | `https://tdtvactpmkzvnlufsosk.supabase.co/functions/v1/submit-application` |

The **anon key** (safe to include in public frontend code) is:

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRkdHZhY3RwbWt6dm5sdWZzb3NrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI0OTkxMzksImV4cCI6MjA1ODA3NTEzOX0.5J7L5LCslt_iBc3iNqf47MGPoBHmHl5Np7jUTcGw6r0
```

---

## 1. Fetch Active Job Listings

**Request**

```http
GET https://tdtvactpmkzvnlufsosk.supabase.co/rest/v1/jobs
  ?status=eq.Active
  &select=id,title,dept,location,employment_type,salary,description,posted_at
  &order=posted_at.desc
Headers:
  apikey: <anon key above>
  Content-Type: application/json
```

**Response** — array of job objects:

```json
[
  {
    "id": "uuid-here",
    "title": "Senior Software Engineer",
    "dept": "Engineering",
    "location": "New York, NY",
    "employment_type": "Full-time",
    "salary": "$140,000 – $170,000",
    "description": "Full job description text…",
    "posted_at": "2026-06-15T12:00:00Z"
  }
]
```

**Plain JS example**

```js
async function fetchJobs() {
  const res = await fetch(
    'https://tdtvactpmkzvnlufsosk.supabase.co/rest/v1/jobs' +
    '?status=eq.Active&select=id,title,dept,location,employment_type,salary,description,posted_at&order=posted_at.desc',
    {
      headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRkdHZhY3RwbWt6dm5sdWZzb3NrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI0OTkxMzksImV4cCI6MjA1ODA3NTEzOX0.5J7L5LCslt_iBc3iNqf47MGPoBHmHl5Np7jUTcGw6r0',
        'Content-Type': 'application/json',
      }
    }
  )
  const jobs = await res.json()
  return jobs  // array — render however you like
}
```

Jobs appear on the careers page automatically the moment HR posts them in the ATS with status "Active". Paused or closed jobs disappear automatically.

---

## 2. Submit an Application

When a candidate clicks Apply and fills out the form, `POST` to the submit-application function as **multipart/form-data** (same encoding as a standard HTML `<form enctype="multipart/form-data">`).

**Endpoint**

```
POST https://tdtvactpmkzvnlufsosk.supabase.co/functions/v1/submit-application
```

No `Authorization` header needed — this endpoint is public.

**Form fields**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `job_id` | string (UUID) | ✅ | The `id` from the job listing |
| `first_name` | string | ✅ | |
| `last_name` | string | ✅ | |
| `email` | string | ✅ | |
| `work_authorized` | string | ✅ | `"yes"` or `"no"` — "Are you authorized to work in the US?" |
| `phone` | string | | |
| `linkedin_url` | string | | Full URL, e.g. `https://linkedin.com/in/…` |
| `salary_expectations` | string | | Free text, e.g. `"$120,000 – $140,000"` |
| `resume` | File | | PDF or Word (.pdf, .doc, .docx), max 10MB |

**Success response (HTTP 200)**

```json
{
  "success": true,
  "message": "Thank you, Jane! Your application for Senior Software Engineer has been received."
}
```

**Error response (HTTP 400)**

```json
{
  "success": false,
  "error": "This position is no longer accepting applications"
}
```

Always check `success` in the response body — show the `error` message to the user if false.

---

## 3. Plain JS Example — Full Apply Form

Drop this into any page. Replace the `<form>` markup with your own design — the JS logic handles everything.

```html
<form id="apply-form" enctype="multipart/form-data">
  <input type="hidden" name="job_id" value="PASTE_JOB_ID_HERE" />

  <!-- Contact info -->
  <input type="text"  name="first_name"   placeholder="First name"  required />
  <input type="text"  name="last_name"    placeholder="Last name"   required />
  <input type="email" name="email"        placeholder="Email"       required />
  <input type="tel"   name="phone"        placeholder="Phone (optional)" />
  <input type="url"   name="linkedin_url" placeholder="LinkedIn URL (optional)" />
  <input type="file"  name="resume"       accept=".pdf,.doc,.docx" />

  <!-- Screening questions -->
  <fieldset>
    <legend>Are you authorized to work in the United States? *</legend>
    <label><input type="radio" name="work_authorized" value="yes" required /> Yes</label>
    <label><input type="radio" name="work_authorized" value="no"  required /> No</label>
  </fieldset>

  <input type="text" name="salary_expectations" placeholder="Salary expectations (e.g. $120,000 – $140,000)" />

  <button type="submit">Submit Application</button>
  <div id="apply-status"></div>
</form>

<script>
document.getElementById('apply-form').addEventListener('submit', async function(e) {
  e.preventDefault()
  const status = document.getElementById('apply-status')
  status.textContent = 'Submitting…'

  const formData = new FormData(this)

  try {
    const res = await fetch(
      'https://tdtvactpmkzvnlufsosk.supabase.co/functions/v1/submit-application',
      { method: 'POST', body: formData }
    )
    const data = await res.json()

    if (data.success) {
      status.textContent = data.message
      this.reset()
    } else {
      status.textContent = 'Error: ' + data.error
    }
  } catch (err) {
    status.textContent = 'Something went wrong. Please try again.'
  }
})
</script>
```

---

## 4. What Happens in the ATS After Submission

1. A new candidate record is created instantly with the applicant's name, email, phone, LinkedIn URL, and resume.
2. An application is created at stage **"Applied"** linked to the specific job.
3. The candidate appears in the ATS pipeline immediately — no refresh needed (the ATS polls in real time).
4. Source is set to **"Careers Page"** so HR can see where they came from.
5. If someone applies again with the same email, their record is updated rather than duplicated.

---

## 5. Deployment Steps (one-time, done by ATS team)

Before this works end-to-end, run these steps once:

**Step 1 — Run the SQL migration** in the Supabase SQL Editor (`tdtvactpmkzvnlufsosk`):

```sql
-- From migration 008
alter table candidates
  add column if not exists linkedin_url text;

create policy "Public can read active jobs"
  on jobs for select to anon
  using (status = 'Active');

create policy "Public can submit candidates"
  on candidates for insert to anon
  with check (true);

create policy "Public can submit applications"
  on applications for insert to anon
  with check (true);

-- From migration 009
alter table applications
  add column if not exists work_authorized boolean,
  add column if not exists salary_expectations text;
```

**Step 2 — Deploy the Edge Function** from Terminal in the `hire-ats` project folder:

```bash
npx supabase functions deploy submit-application --no-verify-jwt --project-ref tdtvactpmkzvnlufsosk
```

That's it — no other config needed.

---

## 6. CORS

The endpoint currently accepts requests from any origin (`*`). Once the BDG careers page domain is known, update the `Access-Control-Allow-Origin` header in `supabase/functions/submit-application/index.ts` to lock it down:

```ts
"Access-Control-Allow-Origin": "https://www.bustle.com",  // or whichever domain hosts careers
```

Then redeploy the function.
