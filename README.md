# BillFlow — Multi-tenant SaaS Billing Platform

A production-ready, full-stack SaaS billing platform for small businesses. Built with Next.js 15 + FastAPI + Supabase.

```
┌─────────────────────────────────────────────────────────────┐
│                     BillFlow Platform                       │
├────────────────────────┬────────────────────────────────────┤
│  Frontend (Next.js 15) │  Backend (FastAPI + Python)        │
│  TypeScript            │  SQLAlchemy ORM                    │
│  Tailwind CSS          │  Pydantic v2 Schemas               │
│  Zustand State         │  JWT Authentication                │
│  React Hook Form + Zod │  ReportLab PDF Generation          │
│  Recharts              │  Async/Await throughout            │
├────────────────────────┴────────────────────────────────────┤
│                Supabase (PostgreSQL + Auth + Storage)        │
└─────────────────────────────────────────────────────────────┘
```

---

## Features

### Core
- **Multi-tenant architecture** — each business has fully isolated data
- **Role-based auth** — `super_admin` / `business_owner` / `staff` (future-ready)
- **JWT authentication** — access + refresh tokens, auto-renewal
- **GST invoice system** — CGST/SGST/IGST auto-calculation, HSN codes
- **PDF generation** — professional ReportLab PDFs
- **Invoice numbering** — configurable prefix + auto-increment (RT-0001, INV-0042)

### Modules
| Module | Features |
|--------|----------|
| Auth | Signup, login, refresh, protected routes |
| Business | Profile, logo, GST/PAN, address |
| Dashboard | Revenue charts, stats, recent invoices |
| Products | CRUD, GST%, HSN codes, inventory tracking |
| Customers | CRUD, GST, purchase history |
| Invoices | Multi-item, discounts, PDF, mark paid |
| Settings | Business profile, invoice customization |

---

## Quick Start

### Prerequisites
- Python 3.12+
- Node.js 20+
- Docker & Docker Compose (recommended)
- Supabase account (or local PostgreSQL)

### Option A: Docker Compose (Recommended)

```bash
git clone <repo>
cd saas-billing-platform

# Copy environment files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local

# Edit backend/.env with your Supabase credentials
nano backend/.env

# Start everything
docker compose up --build

# Access:
# Frontend: http://localhost:3000
# Backend:  http://localhost:8000
# API Docs: http://localhost:8000/api/docs
```

### Option B: Manual Setup

#### Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy and configure environment
cp .env.example .env
# Edit .env with your DATABASE_URL and secrets

# Run database migrations (creates tables)
uvicorn app.main:app --reload

# Or run with production settings
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

#### Frontend

```bash
cd frontend
npm install

cp .env.example .env.local
# Set NEXT_PUBLIC_API_URL=http://localhost:8000

npm run dev
```

---

## Environment Variables

### Backend (`backend/.env`)

```env
# App
APP_ENV=development
DEBUG=True

# Security — CHANGE THESE IN PRODUCTION!
SECRET_KEY=your-min-32-char-secret-key-here
JWT_SECRET_KEY=your-min-32-char-jwt-secret-here

# Supabase PostgreSQL
DATABASE_URL=postgresql+asyncpg://postgres.xxxx:password@aws-0-ap-south-1.pooler.supabase.com:5432/postgres

# Supabase
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJI...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJI...

# CORS
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com

# Super Admin (first user with this email gets super_admin role)
SUPER_ADMIN_EMAIL=admin@yourdomain.com
```

### Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## Supabase Setup

### 1. Create Project
Go to [supabase.com](https://supabase.com) → New Project

### 2. Run Schema
In Supabase SQL Editor, run `docs/schema.sql`

### 3. Load Demo Data (optional)
Run `docs/seed.sql`

### 4. Get Credentials
- Project Settings → API → `anon` key and `service_role` key
- Project Settings → Database → Connection string

### 5. Storage Buckets
Create two buckets in Supabase Storage:
- `business-logos` (public)
- `invoices` (private)

---

## API Reference

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/signup` | Create account |
| POST | `/api/v1/auth/login` | Login, get tokens |
| POST | `/api/v1/auth/refresh` | Refresh access token |
| GET | `/api/v1/auth/me` | Get current user |
| POST | `/api/v1/auth/logout` | Logout |

### Business
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/businesses` | Create business |
| GET | `/api/v1/businesses/me` | Get my business |
| PUT | `/api/v1/businesses/me` | Update business |

### Invoices
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/invoices` | List with filters |
| POST | `/api/v1/invoices` | Create invoice |
| GET | `/api/v1/invoices/{id}` | Get invoice |
| PUT | `/api/v1/invoices/{id}` | Update invoice |
| DELETE | `/api/v1/invoices/{id}` | Delete invoice |
| GET | `/api/v1/invoices/{id}/pdf` | Download PDF |

### Full Swagger docs: `http://localhost:8000/api/docs`

---

## Project Structure

```
saas-billing-platform/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app + lifespan
│   │   ├── core/
│   │   │   ├── config.py        # Settings (pydantic-settings)
│   │   │   ├── security.py      # JWT + bcrypt
│   │   │   └── logging.py       # Structured logging
│   │   ├── database/
│   │   │   └── session.py       # Async SQLAlchemy engine
│   │   ├── models/
│   │   │   └── models.py        # All ORM models
│   │   ├── schemas/
│   │   │   └── schemas.py       # Pydantic v2 schemas
│   │   ├── routers/
│   │   │   ├── auth.py          # Auth endpoints
│   │   │   ├── businesses.py    # Business CRUD
│   │   │   ├── products.py      # Products CRUD
│   │   │   ├── customers.py     # Customers CRUD
│   │   │   ├── invoices.py      # Invoices + PDF
│   │   │   └── dashboard.py     # Analytics
│   │   ├── services/
│   │   │   └── invoice_service.py  # GST calc + PDF gen
│   │   ├── auth/
│   │   │   └── dependencies.py  # JWT deps, RBAC
│   │   └── middleware/
│   │       └── tenant.py        # Tenant isolation
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
│
├── frontend/
│   └── src/
│       ├── app/
│       │   ├── auth/login/      # Login page
│       │   ├── auth/signup/     # Signup page
│       │   ├── onboarding/      # Business setup
│       │   └── dashboard/
│       │       ├── layout.tsx   # Sidebar layout
│       │       ├── page.tsx     # Dashboard + charts
│       │       ├── invoices/    # Invoice list + create + view
│       │       ├── products/    # Products grid
│       │       ├── customers/   # Customers table
│       │       └── settings/    # Business settings
│       ├── lib/
│       │   ├── api.ts           # Axios client + all APIs
│       │   ├── store.ts         # Zustand auth store
│       │   └── utils.ts         # Formatters, helpers
│       └── types/
│           └── index.ts         # All TypeScript types
│
├── docs/
│   ├── schema.sql               # Full DB schema + RLS
│   └── seed.sql                 # Demo data
│
└── docker-compose.yml
```

---

## Demo Credentials

After running seed data:

| Role | Email | Password |
|------|-------|----------|
| Business Owner | demo@billflow.io | Demo@1234 |
| Super Admin | admin@billflow.io | Demo@1234 |

---

## Deployment

### Frontend → Vercel

```bash
cd frontend
npm run build  # verify build passes

# In Vercel dashboard:
# 1. Import repo
# 2. Set NEXT_PUBLIC_API_URL to your backend URL
# 3. Deploy
```

### Backend → Railway / Render

```bash
# Railway
railway login
railway new
railway up

# Set environment variables in Railway dashboard
# Add: DATABASE_URL, JWT_SECRET_KEY, SECRET_KEY, etc.
```

### Backend → Docker

```bash
cd backend
docker build -t billflow-api .
docker run -p 8000:8000 \
  -e DATABASE_URL=... \
  -e JWT_SECRET_KEY=... \
  -e SECRET_KEY=... \
  billflow-api
```

---

## Future Roadmap

### AI Integration (LangChain / LangGraph)
```python
# Prepared hook in invoice service
# app/services/ai_service.py (add)
from langchain.chat_models import ChatOpenAI

async def extract_invoice_from_image(image_bytes: bytes) -> dict:
    """OCR + LLM to parse invoice from uploaded image"""
    ...

async def generate_payment_reminder(invoice: Invoice) -> str:
    """AI-drafted WhatsApp/email reminder"""
    ...
```

### WhatsApp Integration
```python
# app/services/whatsapp_service.py (add)
async def send_invoice_whatsapp(invoice: Invoice, pdf_url: str):
    """Send invoice PDF via WhatsApp Business API"""
    ...
```

### Staff Accounts
The `staff` role is already in the ENUM. Add:
- `business_staff` table with permissions
- Scoped JWT tokens for staff

---

## Security Checklist

- [x] bcrypt password hashing
- [x] JWT access + refresh tokens
- [x] Supabase Row Level Security
- [x] Business-level data isolation (business_id in all queries)
- [x] Security response headers
- [x] Input validation (Pydantic + Zod)
- [x] SQL injection prevention (SQLAlchemy ORM)
- [ ] Rate limiting (add `slowapi` to backend)
- [ ] CSRF protection
- [ ] Audit logging table

---

Built with ❤️ by the BillFlow team
