# API Overview

The frontend communicates with a private backend API.

---

# Features exposed by the API

* commit retrieval
* filtering
* pagination
* live updates
* branch visualization
* release generation
* statistics
* media uploads

---

# Real-time updates

Live commit updates are delivered using Server-Sent Events (SSE).

---

# Authentication

Some endpoints require admin authorization for:

* video uploads
* commit media management
* release management

---

# Branch system

Branch data is aggregated from connected repositories and cached server-side to reduce API usage.

---

# Release system

Patch notes are generated per repository and version.

Generated releases include:

* categorized commit summaries
* markdown rendering
* version grouping