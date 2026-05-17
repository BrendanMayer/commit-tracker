# GitHub Webhook Setup

To enable real-time tracking, configure a webhook for your repository.

---

# Payload URL

```txt
https://api.example.com/github/webhook
```

---

# Content Type

```txt
application/json
```

---

# Events

Select:

```txt
Push events
```

---

# Secret

The webhook secret must match the backend configuration.

---

# Flow

```txt
GitHub Push
    ↓
Webhook Event
    ↓
Backend Processing
    ↓
Database Storage
    ↓
Frontend Live Update
```