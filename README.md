<div align="center">

# 🧾 BillFlow

**GST-compliant invoicing SaaS for Indian small businesses**

[![Next.js](https://img.shields.io/badge/Next.js-15.2-black?logo=next.js)](https://nextjs.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi)](https://fastapi.tiangolo.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-3ECF8E?logo=supabase)](https://supabase.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://typescriptlang.org)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

[Features](#-features) · [Tech Stack](#-tech-stack) · [Getting Started](#-getting-started) · [API Docs](#-api-docs) · [Project Structure](#-project-structure)

![BillFlow Dashboard](https://via.placeholder.com/900x500/0f172a/2563eb?text=BillFlow+Dashboard)

</div>

---

## ✨ Features

### 🔐 Authentication
- Email + password signup with **OTP email verification**
- **Forgot password** via OTP (3-step: email → verify code → new password)
- JWT access + refresh token system with auto-renewal
- 60-second resend cooldown, 5-attempt brute-force protection
- Auto-delete stale accounts (unverified after 30 min, abandoned onboarding after 30 min)

### 🏢 Multi-tenant Business Management
- Each user owns one business with isolated data
- Business onboarding with slug generation
- Logo upload via Supabase Storage
- Custom invoice prefix, terms, notes, currency

### 🧾 Invoice Management
- Create GST-compliant invoices with line items
- **CGST / SGST** (intra-state) and **IGST** (inter-state) tax calculation
- HSN code support
- Invoice statuses: Draft → Sent → Paid / Partially Paid / Overdue / Cancelled
- Sequential invoice numbering (atomic, race-condition safe)
- **Download PDF** and **Print** directly from the browser
- Customer stats (total purchases, invoice count) updated automatically

### 📦 Product & Customer Management
- Product catalog with GST %, HSN code, unit, stock tracking
- Customer directory with purchase history
- Soft delete for both (data preserved, filtered from lists)
- Search with 300ms debounce across all list pages

### 📊 Dashboard Analytics
- Revenue summary, outstanding dues, overdue invoices
- Monthly revenue chart (area graph)
- Recent invoices list
- Stat cards with trend indicators

### 👑 Super Admin Panel
- View and manage all registered businesses
- Toggle business active/inactive
- Delete business and all its data
- View all platform users, create users, change roles

---

## 🛠 Tech Stack

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| Next.js | 15.2.6 | React framework (App Router) |
| TypeScript | 5 | Type safety |
| Tailwind CSS | 3.4 | Styling |
| Zustand | 5.0 | Auth state management (persisted) |
| React Hook Form | 7.53 | Form handling |
| Zod | 3.23 | Schema validation |
| Axios | 1.7 | HTTP client with interceptors |
| Recharts | 2.13 | Dashboard charts |
| Sonner | 1.5 | Toast notifications |
| Lucide React | 0.453 | Icons |

### Backend
| Technology | Version | Purpose |
|---|---|---|
| FastAPI | 0.115 | Async REST API framework |
| SQLAlchemy | 2.0 | Async ORM |
| Alembic | 1.13 | Database migrations |
| asyncpg | 0.29 | Async PostgreSQL driver |
| Pydantic v2 | 2.9 | Request/response validation |
| passlib + bcrypt | 1.7 / 4.0.1 | Password hashing |
| python-jose | 3.3 | JWT tokens |
| ReportLab | 4.2 | PDF invoice generation |
| aiosmtplib | 3.0 | Async SMTP email |
| APScheduler | 3.10 | Background cleanup jobs |
| Supabase | 2.9 | Storage (logos) |
| Pillow | 10.4 | Image processing |

### Infrastructure
| Service | Purpose |
|---|---|
| Supabase | PostgreSQL database + file storage |
| Netlify | Frontend hosting |
| Gmail SMTP | Transactional OTP emails |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Python 3.12+
- A [Supabase](https://supabase.com) project (free tier works)
- Gmail account with [App Password](https://myaccount.google.com/apppasswords) enabled

---

### 1. Clone the repository

```bash
git clone https://github.com/cognivus/Bill-flow.git
cd Bill-flow
```

---

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
```

Edit `.env` with your values:

```env
# Security
SECRET_KEY=your-secret-key-min-32-chars
JWT_SECRET_KEY=your-jwt-secret-min-32-chars

# Database (Supabase → Project Settings → Database → URI)
DATABASE_URL=postgresql+asyncpg://postgres.YOURREF:YOURPASS@aws-0-ap-south-1.pooler.supabase.com:5432/postgres

# Supabase (Project Settings → API)
SUPABASE_URL=https://YOURREF.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Gmail SMTP (requires 2FA + App Password)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your@gmail.com
SMTP_PASSWORD=xxxx xxxx xxxx xxxx
SMTP_FROM_EMAIL=your@gmail.com
SMTP_USE_TLS=True

# Super Admin
SUPER_ADMIN_EMAIL=admin@yourdomain.com
```

```bash
# Run database migrations
alembic upgrade head

# Start the backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

API available at: `http://localhost:8000`  
Interactive docs: `http://localhost:8000/docs`

---

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

```bash
# Start the development server
npm run dev
```

App available at: `http://localhost:3000`

---

### 4. Docker (Optional)

Run everything with a single command:

```bash
docker-compose up --build
```

---

## 📁 Project Structure

```
Bill-flow/
├── backend/
│   ├── app/
│   │   ├── auth/
│   │   │   └── dependencies.py       # JWT auth, role guards
│   │   ├── core/
│   │   │   ├── config.py             # Pydantic settings
│   │   │   ├── email.py              # Gmail SMTP (aiosmtplib)
│   │   │   ├── logging.py            # Logging config
│   │   │   └── security.py           # Password hashing, JWT
│   │   ├── database/
│   │   │   └── session.py            # Async SQLAlchemy session
│   │   ├── middleware/
│   │   │   └── tenant.py             # Multi-tenant isolation
│   │   ├── models/
│   │   │   └── models.py             # SQLAlchemy ORM models
│   │   ├── routers/
│   │   │   ├── auth.py               # Signup, login, OTP, forgot password
│   │   │   ├── businesses.py         # Business CRUD + logo upload
│   │   │   ├── customers.py          # Customer management
│   │   │   ├── dashboard.py          # Analytics aggregation
│   │   │   ├── invoices.py           # Invoice CRUD + PDF
│   │   │   ├── products.py           # Product catalog
│   │   │   └── admin.py              # Super admin panel
│   │   ├── schemas/
│   │   │   └── schemas.py            # Pydantic request/response models
│   │   ├── services/
│   │   │   ├── invoice_service.py    # GST calc, PDF generation
│   │   │   ├── cleanup_service.py    # Stale account deletion
│   │   │   └── storage_service.py    # Supabase file storage
│   │   └── main.py                   # FastAPI app + scheduler
│   ├── alembic/                      # Database migrations
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/
│   └── src/
│       ├── app/
│       │   ├── auth/
│       │   │   ├── login/            # Login + forgot password flow
│       │   │   └── signup/           # Signup + OTP verification
│       │   ├── dashboard/
│       │   │   ├── page.tsx          # Analytics dashboard
│       │   │   ├── invoices/         # Invoice list, create, detail
│       │   │   ├── customers/        # Customer management
│       │   │   ├── products/         # Product catalog
│       │   │   └── settings/         # Business settings
│       │   ├── admin/                # Super admin panel
│       │   └── onboarding/           # Business setup wizard
│       ├── lib/
│       │   ├── api.ts                # Axios client + all API calls
│       │   ├── store.ts              # Zustand auth store
│       │   └── utils.ts              # Helpers, formatters
│       └── types/
│           └── index.ts              # TypeScript interfaces
│
├── docs/
│   ├── schema.sql                    # Database schema reference
│   └── seed.sql                      # Sample data
│
├── docker-compose.yml
└── netlify.toml
```

---

## 📡 API Docs

Once the backend is running, visit:

| URL | Description |
|---|---|
| `http://localhost:8000/docs` | Swagger UI (interactive) |
| `http://localhost:8000/redoc` | ReDoc (clean reference) |

### Key Endpoints

```
POST   /api/v1/auth/signup              Register + send OTP
POST   /api/v1/auth/verify-otp          Verify OTP → get tokens
POST   /api/v1/auth/login               Login with email + password
POST   /api/v1/auth/forgot-password     Send reset OTP
POST   /api/v1/auth/verify-reset-otp    Verify reset OTP
POST   /api/v1/auth/reset-password      Set new password

GET    /api/v1/businesses/me            Get current business
POST   /api/v1/businesses               Create business (onboarding)
PUT    /api/v1/businesses/me            Update business settings

GET    /api/v1/invoices                 List invoices (paginated, filterable)
POST   /api/v1/invoices                 Create invoice
GET    /api/v1/invoices/{id}            Get invoice detail
PUT    /api/v1/invoices/{id}            Update invoice / mark paid
DELETE /api/v1/invoices/{id}            Delete invoice
GET    /api/v1/invoices/{id}/pdf        Download PDF

GET    /api/v1/customers                List customers
POST   /api/v1/customers               Create customer
GET    /api/v1/products                 List products
POST   /api/v1/products                Create product

GET    /api/v1/dashboard                Analytics summary

GET    /api/v1/admin/stats              Platform stats (super admin)
GET    /api/v1/admin/businesses         All businesses (super admin)
GET    /api/v1/admin/users              All users (super admin)
```

---

## 🔒 Security

- Passwords hashed with **bcrypt** (via passlib)
- JWTs signed with HS256, short-lived access tokens (7 days) + refresh tokens
- OTP brute-force protection (5 attempts max, 10-min expiry)
- Multi-tenant isolation — every query scoped by `business_id`
- Pydantic v2 input validation on all endpoints
- CORS configured via environment variable
- Security headers: `X-Frame-Options`, `X-Content-Type-Options`, `X-XSS-Protection`

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'feat: add your feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License.

---

<div align="center">
  Built with ❤️ by <a href="https://github.com/cognivus">Cognivus</a>
</div>
