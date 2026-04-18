# Commit Tracker

A lightweight web dashboard for tracking commits across GitHub repositories in real time inspired by the facepunch development team at ```https://commits.facepunch.com```.

This project uses GitHub webhooks to capture new commits as they happen, stores them on a backend service, and displays them through a simple frontend hosted on GitHub Pages.

---

## Overview

The goal of this project was to build a minimal system that reacts to events instead of constantly polling APIs. Rather than fetching commit history repeatedly, it listens for push events and updates immediately.

Only commits made after the backend starts are tracked. There is no historical scanning or syncing.

---

## How it works

1. A commit is pushed to a repository
2. GitHub sends a webhook event
3. The backend receives and processes the event
4. The commit is stored in a database
5. The frontend fetches and displays the updated data

---

## Architecture

```
GitHub → Webhook → Backend (FastAPI) → SQLite → Frontend (GitHub Pages)
```

* **Frontend**: Static site (this repository)
* **Backend**: FastAPI application running on a self-hosted Ubuntu server
* **Storage**: SQLite database
* **Trigger mechanism**: GitHub webhooks (push events)

---

## Frontend

This repository contains the static frontend used to display commit activity.

### Files

```
index.html
style.css
app.js
config.js
404.html
```

### Configuration

The frontend communicates with the backend via the API base URL defined in `config.js`:

```javascript
window.APP_CONFIG = {
  API_BASE: "https://api.yourdomain.com"
};
```

---

## Running locally

You can run the frontend locally with any static file server:

```bash
npx serve .
```

or simply open `index.html` in a browser.

If testing locally, make sure the backend allows requests from `http://localhost` in its CORS configuration.

---

## Backend

The backend is not part of this repository, but it is responsible for:

* receiving webhook events from GitHub
* validating requests using a shared secret
* extracting commit data
* storing commits in a SQLite database
* exposing API endpoints for the frontend

---

## Webhook setup

To enable commit tracking, configure a webhook in your GitHub repository:

* **Payload URL**

  ```
  https://api.yourdomain.com/github/webhook
  ```

* **Content type**

  ```
  application/json
  ```

* **Events**

  ```
  Push events
  ```

* **Secret**
  Must match the backend configuration

---

## Notes

* Only commits made after the backend starts are tracked
* No GitHub API polling is used
* The system is event-driven and lightweight by design

---

## Possible improvements

* filtering commits by repository or author
* real-time updates using WebSockets instead of polling
* pagination and better data handling for larger datasets
* authentication or private dashboards

---

## License

This project is for personal use and experimentation. Use or modify it as needed.
