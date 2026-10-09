# Al-Alamiya ERP/POS — Architecture & Engineering Foundation (Phase 1)

## 1. Architectural Principles

Al-Alamiya ERP/POS is designed for furniture showroom operations in Egypt, following the project constitution ([AGENTS.md](file:///d:/elalamya-main/AGENTS.md)).

Core architectural rules established in Phase 1:
1. **Server-Side Authoritative Truth**: The backend is the sole source of truth for business rules, calculations, authorizations, and data integrity. The React frontend is a strict client of the API.
2. **Thin Controllers**: Controllers validate input via Form Requests, delegate execution to single-purpose Actions, and return standardized API Resources or JSON responses.
3. **No Floating Point Money**: Money is strictly handled as fixed-precision `DECIMAL(15,2)` (via `App\Domain\Support\Money` using PHP BCMath), preventing rounding and floating point drift.
4. **Whole Number Quantities**: Quantities in the showroom domain are integer units (via `App\Domain\Support\Quantity`).
5. **Arabic RTL First**: Designed natively for right-to-left layout, Cairo typography, and high-density desktop operational efficiency.

---

## 2. Backend Architecture (`backend/`)

```text
backend/
├── app/
│   ├── Actions/
│   │   └── Auth/
│   │       ├── LoginUserAction.php
│   │       └── LogoutUserAction.php
│   ├── Domain/
│   │   ├── Auth/
│   │   │   └── Enums/
│   │   │       └── UserRole.php       (Owner, Cashier + capabilities)
│   │   └── Support/
│   │       ├── Money.php              (BCMath fixed-precision decimal arithmetic)
│   │       └── Quantity.php           (Strict whole-number quantities)
│   ├── Http/
│   │   ├── Controllers/
│   │   │   └── Api/
│   │   │       └── V1/
│   │   │           ├── Auth/
│   │   │           │   └── AuthController.php
│   │   │           ├── HealthController.php
│   │   │           └── System/
│   │   │               └── SystemCheckController.php
│   │   ├── Middleware/
│   │   │   ├── EnsureUserRole.php     (Role-based access barrier)
│   │   │   └── ForceJsonResponse.php  (Forces JSON headers for /api/*)
│   │   ├── Requests/
│   │   │   └── Auth/
│   │   │       └── LoginRequest.php
│   │   └── Resources/
│   │       └── UserResource.php       (Safe DTO presentation)
│   ├── Models/
│   │   └── User.php                   (Sanctum tokens, roles, casts)
│   ├── Providers/
│   │   └── AppServiceProvider.php     (Laravel Gates for capabilities)
│   └── Support/
│       └── ApiResponse.php            (Standardized JSON response builder)
├── config/
│   ├── app.php                        (Timezone: Africa/Cairo, Locale: ar)
│   └── cors.php                       (CORS configuration for frontend)
├── database/
│   ├── migrations/
│   │   ├── 0001_01_01_000000_create_users_table.php
│   │   ├── 2026_10_07_232447_create_personal_access_tokens_table.php
│   │   └── 2026_10_08_022854_add_role_and_username_to_users_table.php
│   └── seeders/
│       └── DatabaseSeeder.php         (Seeds default Owner & Cashier users)
├── routes/
│   └── api.php                        (Versioned prefix: /api/v1/...)
└── tests/
    ├── Feature/Api/V1/
    │   ├── AuthTest.php
    │   ├── AuthorizationTest.php
    │   └── HealthTest.php
    └── Unit/Domain/
        ├── MoneyTest.php
        └── QuantityTest.php
```

---

## 3. API Conventions & Standard Response Shapes

All API routes live strictly under `/api/v1/`.

### Successful Response Format
```json
{
  "success": true,
  "data": { ... },
  "message": "نص الرسالة التوضيحية"
}
```

### Error / Validation Response Format
```json
{
  "success": false,
  "message": "رسالة الخطأ للمستخدم",
  "code": "VALIDATION_ERROR | FORBIDDEN | UNAUTHORIZED | NOT_FOUND | ...",
  "errors": {
    "login": ["بيانات الدخول غير صحيحة"]
  }
}
```

Internal technical errors, stack traces, and SQL exceptions are suppressed from API consumers in non-debug mode.

---

## 4. Authentication & Authorization Foundation

### Roles:
- **Owner (`owner` / مالك)**: Full access across the entire system, including financial reports, audit logs, user management, and system settings.
- **Cashier (`cashier` / كاشير)**: Access to operational POS workflows (sales, returns, customer/supplier transactions, stock receiving), strictly blocked from owner-only reports and settings.

### Server-Side Enforcement:
- Managed via `App\Http\Middleware\EnsureUserRole` (`role:owner`, `role:owner,cashier`).
- Defined via Laravel Gates in `App\Providers\AppServiceProvider`:
  - `access-reports`: Owner only
  - `manage-settings`: Owner only
  - `manage-users`: Owner only
  - `view-audit-logs`: Owner only
  - `operate-pos`: Active users (Owner & Cashier)
  - `manage-catalog`: Active users (Owner & Cashier)
  - `manage-inventory`: Active users (Owner & Cashier)
  - `manage-customers`: Active users (Owner & Cashier)
  - `manage-suppliers`: Active users (Owner & Cashier)
  - `manage-expenses`: Active users (Owner & Cashier)

---

## 5. Frontend Architecture (`frontend/`)

```text
frontend/
├── src/
│   ├── app/
│   │   ├── providers/
│   │   │   ├── authContextDef.ts
│   │   │   ├── AuthContext.tsx
│   │   │   ├── useAuth.ts
│   │   │   ├── toastContextDef.ts
│   │   │   ├── ToastContext.tsx
│   │   │   └── useToast.ts
│   │   └── router/
│   │       ├── AppLayout.tsx          (Operational RTL shell with Cairo clock & user badge)
│   │       ├── Guards.tsx             (RequireAuth, RequireRole)
│   │       ├── routes.tsx             (Centralized routes definition)
│   │       └── pages/
│   │           ├── LoginPage.tsx      (Keyboard-accessible login with demo helpers)
│   │           ├── SystemFoundationPage.tsx (Interactive API & Role verification dashboard)
│   │           └── Placeholders.tsx   (Strictly isolated module placeholders for future phases)
│   ├── components/
│   │   └── ui/
│   │       ├── Alert.tsx
│   │       ├── Badge.tsx
│   │       ├── Button.tsx
│   │       ├── Card.tsx
│   │       ├── ConfirmDialog.tsx
│   │       ├── EmptyState.tsx
│   │       ├── Input.tsx
│   │       ├── Modal.tsx
│   │       ├── MoneyDisplay.tsx
│   │       ├── Select.tsx
│   │       ├── Spinner.tsx
│   │       └── Table.tsx
│   ├── services/
│   │   └── api/
│   │       ├── client.ts              (Centralized fetch client with 401 interception)
│   │       ├── endpoints.ts           (API v1 route constants)
│   │       └── auth.ts                (Authentication and health service)
│   ├── styles/
│   │   ├── globals.css                (Reset, Cairo typography, RTL rules, focus rings)
│   │   └── tokens.css                 (Operational CSS design tokens)
│   ├── types/
│   │   ├── api.ts                     (ApiResponse, ApiError, ApiHealthData)
│   │   └── auth.ts                    (User, UserRole, UserCapabilities, LoginCredentials)
│   └── __tests__/
│       ├── client.test.ts             (ApiClient, token storage, ApiError tests)
│       └── formatters.test.ts         (Decimal money & integer quantity tests)
```

---

## 6. RTL and Operational UX Foundation

- **Direction**: Native `dir="rtl"` at `<html>` document level with Cairo Google Font typography.
- **Visual Design**: High contrast, restrained borders, dense data density suited for all-day operational showroom use. Avoids decorative glassmorphism, heavy gradients, or SaaS card sprawl.
- **Keyboard Friendliness**: Focus rings, explicit labels, Tab navigation, Enter to submit, and Esc to dismiss modals.
