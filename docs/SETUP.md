# Local Setup & Developer Guide

## Prerequisites

- **PHP**: 8.2 or higher (with `pdo_mysql`, `pdo_sqlite`, `bcmath`, `curl`, `mbstring`, `openssl`)
- **Composer**: 2.x
- **Node.js**: 20+ (Node v22 installed)
- **npm**: 10+
- **MySQL**: 8.x (for development/production database)

---

## 1. Backend Setup (`backend/`)

### Environment Configuration
```bash
cd backend
cp .env.example .env
php artisan key:generate
```

Key environment variables in `.env`:
```env
APP_NAME="Al-Alamiya ERP"
APP_ENV=local
APP_TIMEZONE=Africa/Cairo
APP_URL=http://localhost:8000
FRONTEND_URL=http://localhost:5173

APP_LOCALE=ar
APP_FALLBACK_LOCALE=en

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=elalamya_erp
DB_USERNAME=root
DB_PASSWORD=
```

### Database Migration & Seeding
```bash
php artisan migrate --seed
```

Default Seeded Accounts:
| Role | Username | Email | Password | Access Scope |
| :--- | :--- | :--- | :--- | :--- |
| **مالك (Owner)** | `owner` | `owner@elalamya.com` | `password123` | Full system access (reports, settings, POS, etc.) |
| **كاشير (Cashier)** | `cashier` | `cashier@elalamya.com` | `password123` | Operational access (POS, invoices, inventory), no reports |

### Starting Backend Server
```bash
php artisan serve --port=8000
```
Backend API will be accessible at: `http://localhost:8000/api/v1`
Health check: `http://localhost:8000/api/v1/health`

### Running Backend Tests & Code Style
```bash
# Run all Unit & Feature tests (uses SQLite in-memory automatically)
php artisan test

# Verify PHP code style with Laravel Pint
vendor/bin/pint --test

# Fix PHP code style automatically
vendor/bin/pint
```

---

## 2. Frontend Setup (`frontend/`)

### Installation
```bash
cd frontend
npm install
```

### Environment Configuration
Create `.env` if custom API URL is required (defaults to `http://localhost:8000/api/v1`):
```env
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

### Starting Development Server
```bash
npm run dev
```
Frontend web application will run at: `http://localhost:5173`

### Running Frontend Tests, Linter, and Build
```bash
# Run Vitest test suite
npm test

# Run Oxlint code quality checks
npm run lint

# TypeScript verification & production bundle build
npm run build
```
