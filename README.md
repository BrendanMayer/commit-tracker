# Commit Tracker

A lightweight real-time GitHub commit dashboard inspired by Facepunch's internal development tracker:

```txt
https://commits.facepunch.com
```

My personal deployment can be viewed here:

```txt
https://brendanmayer.github.io/commit-tracker/
```

The project uses GitHub webhooks to capture commits in real time, stores them through a FastAPI backend, and visualizes repository activity through a modern frontend hosted on GitHub Pages.

---

# Overview

This project was built around an event-driven approach rather than constant polling.

Instead of repeatedly requesting commit history from the GitHub API, repositories send webhook events whenever new commits are pushed. The backend processes and stores those events immediately, allowing the frontend to update live.

Only commits received after the backend starts tracking are stored. Historical syncing is intentionally avoided to keep the system lightweight and responsive.

---

# Features

## Real-time commit tracking

* GitHub webhook-based architecture
* Live commit updates using Server-Sent Events (SSE)
* Automatic commit ingestion and storage
* Repository-aware filtering and pagination

---

## Commit visualization

* Modern commit cards with:
  * branch styling
  * commit type tags
  * contributor metadata
  * repository indicators
  * hover animations
  * live update pulse effects

* Automatic commit categorization:
  * feature
  * bugfix
  * cleanup
  * merge
  * hotfix

* Tag detection based on:
  * branch names
  * commit message keywords

---

## Branch visualization

* Dedicated branches tab
* Real repository branch fetching through GitHub API
* Branch grouping by type
* Animated branch graph styling
* Visual branch badges:
  * active
  * protected
  * merged
  * mainline

---

## Contributor drilldowns

Contributor profiles include:

* commit counts
* repository activity
* branch participation
* recent commits
* commit tag distribution

---

## Video attachments

Admin users can:

* drag and drop videos directly onto commit cards
* upload MP4 / WebM / OGG files
* attach videos to commits
* remove attached videos
* preview uploaded videos directly in the feed

Uploads are protected using an API key system.

---

## Releases & patch notes

Per-repository release tracking system with:

* version creation
* release deletion
* markdown patch note generation
* markdown rendering directly in the UI
* release regeneration
* commit grouping per release version

Patch notes are automatically generated from commits associated with each repository and version range.

---

## UI & UX improvements

* glassmorphism-inspired panels
* animated tab transitions
* ambient gradients and glow effects
* cinematic branch graph styling
* animated analytics chart hover states
* custom toast notifications
* custom admin login modal
* responsive layouts
* sticky pagination footer
* live commit animations

---

# How it works

1. A commit is pushed to a repository
2. GitHub sends a webhook event
3. The backend validates and processes the request
4. Commit data is stored in SQLite
5. Connected frontend clients receive live updates
6. The UI updates automatically

---

# Architecture

```txt
GitHub
   ↓
Webhook
   ↓
FastAPI Backend
   ↓
SQLite Database
   ↓
Frontend (GitHub Pages)
```

---

# Tech stack

## Frontend

* HTML
* CSS
* Vanilla JavaScript
* GitHub Pages hosting

## Backend

* FastAPI
* SQLite
* Uvicorn
* Python

## Infrastructure

* Ubuntu VPS
* Nginx reverse proxy
* GitHub webhooks
* Let's Encrypt SSL

---

# Frontend structure

```txt
index.html
style.css
app.js
config.js
404.html
```

---

# Backend responsibilities

The backend service is responsible for:

* receiving webhook events
* validating webhook signatures
* storing commit data
* exposing REST endpoints
* serving uploaded videos
* generating release markdown
* fetching repository branch information
* handling admin-authenticated uploads
* broadcasting live updates to clients

---

# Running locally

You can run the frontend locally with any static file server:

```bash
npx serve .
```

or simply open:

```txt
index.html
```

in a browser.

If testing locally, ensure the backend CORS configuration allows requests from localhost.

---

# Frontend configuration

The frontend communicates with the backend through `config.js`:

```js
window.APP_CONFIG = {
  API_BASE: "https://api.yourdomain.com"
};
```

---

# Webhook setup

To enable tracking for a repository:

## Payload URL

```txt
https://api.yourdomain.com/github/webhook
```

## Content type

```txt
application/json
```

## Events

```txt
Push events
```

## Secret

Must match the backend webhook secret configuration.

---

# API features

The backend exposes endpoints for:

* commits
* statistics
* filters
* live streaming
* branch visualization
* releases
* markdown generation
* video uploads
* video attachment management

---

# Notes

* Only commits received after tracking starts are stored
* No GitHub polling is used
* The system is fully event-driven
* Branch data is cached server-side to reduce GitHub API usage
* Video uploads require admin authorization

---

# Recent release history

## v1.0.0

Major additions included:

* filtering and pagination
* branch visualization
* commit tags and colors
* drag-and-drop video uploads
* release generation system
* markdown patch notes
* admin mode
* visual improvements
* sticky pagination footer

---

## v1.1.13

UI and interaction focused release including:

* glass panels and glow styling
* animated analytics chart tooltips
* custom admin modal
* custom toast notifications
* animated tab switching
* live commit pulse animations
* cinematic branch graph
* contributor profile drilldowns
* various UI and styling fixes

---

# Future ideas

Potential future additions:

* WebSocket support
* private dashboards
* multi-user authentication
* repository activity heatmaps
* deployment tracking
* CI/CD integration
* commit timelines
* replayable repository history
* AI-assisted patch note summaries

---

# Documentation

| File | Description |
|---|---|
| CONTRIBUTING.md | Contribution guidelines |
| docs/frontend-setup.md | Frontend setup |
| docs/webhook-setup.md | GitHub webhook setup |
| docs/api-overview.md | API architecture overview |
| docs/roadmap.md | Planned features |
| docs/screenshots.md | UI previews |
