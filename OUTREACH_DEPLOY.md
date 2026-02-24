# Email Outreach Engine — Deployment Guide

## What's New

### Frontend (React Portal)
- **EmailOutreach.jsx** — Full 6-tab dashboard (919 lines)
  - Overview: metrics, active campaigns, recent replies, monthly stats, quick actions
  - Campaigns: grid view, create/launch/pause/resume, new campaign modal
  - Inbox: split-pane unified inbox, thread view, AI classification badges, reply composer, move-to-pipeline
  - Accounts & Health: domain cards, DNS status, per-account health scores, warmup progress
  - Templates: template cards with variables, performance stats, seed defaults
  - Analytics: funnel, sentiment breakdown, daily performance table
- **Route**: `/dashboard/email-outreach`
- **Sidebar**: Send icon in Advanced section

### Backend (FastAPI)
- **routes/outreach.py** — 34 API endpoints (1,171 lines)
- **agent/services/outreach.py** — Service layer (927 lines)
  - Warmup engine (14-day graduated ramp)
  - Sender rotation (round-robin across domains)
  - Campaign execution engine
  - Claude Haiku AI personalisation
  - Claude Haiku reply classification
  - Health scoring with auto-pause
- **agent/tasks/outreach.py** — 5 scheduled tasks (199 lines)
- **models/outreach.py** — MongoDB schemas + indexes (383 lines)

### Files Modified
- `frontend/src/App.jsx` — Added EmailOutreach route
- `frontend/src/config/navigation.js` — Added sidebar nav item
- `frontend/src/components/layout/Sidebar.jsx` — Added Send/Bot/Linkedin icons
- `backend/routes/__init__.py` — Added outreach_router
- `backend/server.py` — Added outreach_router include
- `backend/agent/scheduler.py` — Added 5 outreach tasks
- `backend/agent/indexes.py` — Added 7 collection indexes
- `backend/routes/agent.py` — Added outreach tasks to manual triggers

## Deploy Steps

```bash
# 1. SSH into VPS
ssh root@178.128.33.73

# 2. Pull latest code
cd /root/rezvo.app
git pull origin main

# 3. Install any new Python deps (none new for outreach)
cd backend
pip install -r requirements.txt

# 4. Build frontend
cd ../frontend
npm install
npm run build

# 5. Copy build to nginx serve directory
cp -r dist/* /var/www/rezvo.app/frontend/dist/

# 6. Restart backend
systemctl restart rezvo-backend  # or however it's running

# 7. Seed default templates
curl -X POST https://rezvo.app/api/outreach/seed-templates

# 8. Add first domain
curl -X POST https://rezvo.app/api/outreach/domains \
  -H "Content-Type: application/json" \
  -d '{"domain": "getrezvo.co.uk"}'

# 9. Create 5 accounts for domain
curl -X POST "https://rezvo.app/api/outreach/accounts/bulk?domain=getrezvo.co.uk"

# 10. Start warmup
curl -X POST https://rezvo.app/api/outreach/domains/getrezvo.co.uk/start-warmup
```

## Resend Webhook Configuration
Point these webhooks at your API:
- `https://rezvo.app/api/outreach/webhooks/resend` — Delivery events (delivered, opened, clicked, bounced)
- `https://rezvo.app/api/outreach/webhooks/resend/inbound` — Inbound replies

## API Endpoints Quick Reference
| Method | Path | Description |
|--------|------|-------------|
| GET | /outreach/stats | Dashboard overview metrics |
| GET/POST | /outreach/domains | List/create domains |
| PUT | /outreach/domains/{d}/verify-dns | Mark DNS verified |
| POST | /outreach/domains/{d}/start-warmup | Begin warmup |
| POST | /outreach/accounts | Create sending account |
| POST | /outreach/accounts/bulk?domain=x | Create 5-account set |
| GET/POST | /outreach/campaigns | List/create campaigns |
| POST | /outreach/campaigns/{id}/launch | Launch campaign |
| POST | /outreach/campaigns/{id}/pause | Pause campaign |
| POST | /outreach/campaigns/{id}/resume | Resume campaign |
| GET | /outreach/inbox | Unified inbox |
| GET | /outreach/inbox/{id} | Full thread |
| POST | /outreach/inbox/{id}/reply | Reply from inbox |
| POST | /outreach/inbox/{id}/move-to-pipeline | Promote to sales |
| GET/POST | /outreach/templates | List/create templates |
| POST | /outreach/seed-templates | Load 5 defaults |
| GET | /outreach/analytics/funnel | Conversion funnel |
| GET | /outreach/analytics/daily | Daily breakdown |
| GET | /outreach/analytics/sentiment | Reply sentiment |
| POST | /outreach/webhooks/resend | Delivery webhooks |
| POST | /outreach/webhooks/resend/inbound | Reply detection |
| GET | /outreach/warmup/status | Warmup progress |
| POST | /outreach/warmup/run | Manual warmup |
| POST | /outreach/process | Manual send processing |
