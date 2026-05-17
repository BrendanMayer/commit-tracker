# Contributing

Thanks for checking out Commit Tracker.

This project is primarily a personal project, but suggestions, fixes, and improvements are welcome.

---

# Development philosophy

The project focuses on:

* lightweight architecture
* real-time updates
* event-driven systems
* minimal dependencies
* simple deployment

The frontend intentionally avoids frameworks to keep the project small and easy to understand.

---

# Project structure

## Frontend

```txt
index.html
style.css
app.js
config.js
```

## Backend

The backend is a separate FastAPI service responsible for:

* GitHub webhook handling
* commit storage
* branch fetching
* release generation
* video uploads
* live event streaming

---

# Running locally

Frontend:

```bash
npx serve .
```

Backend:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```

---

# Pull requests

If contributing:

* keep commits focused
* avoid unnecessary dependencies
* maintain the existing coding style
* test changes before submitting

---

# Areas for improvement

Some areas still being explored:

* replayable timelines
* deployment tracking
* activity heatmaps
* multi-user auth
* improved graph rendering
* analytics improvements

---

# Reporting issues

When reporting issues, include:

* screenshots if relevant
* browser/device info
* reproduction steps
* backend logs if applicable