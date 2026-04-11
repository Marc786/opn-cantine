# Cantine

## Tech stack

- Next.js 15 (App Router)
- Chakra UI v3
- MongoDB (native driver)
- TypeScript

## Environment variables

Create a `.env.local` file in `app/`:

```
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB=cantine
BASIC_AUTH_USER=<your-username>
BASIC_AUTH_PASSWORD=<your-strong-password>
ADMIN_PIN=<your-pin>
```

## Getting started

```bash
cd app
pnpm install
pnpm dev
```

## Docker

```bash
docker compose up --build
```

App runs on `http://localhost:3000` with MongoDB on `localhost:27017`.

```bash
docker compose down
```

## Project structure

```
src/
├── app/
│   ├── page.tsx                        # Employee login
│   ├── register/page.tsx               # New employee registration
│   ├── admin/page.tsx                  # Admin dashboard (PIN protected)
│   ├── tab/[employeeNumber]/page.tsx   # Employee tab view
│   └── api/
│       ├── health/route.ts             # Health check
│       ├── admin/
│       │   ├── verify-pin/route.ts     # POST - verify admin PIN
│       │   └── check/route.ts          # GET  - check admin session
│       └── employees/
│           ├── route.ts                # POST   - create employee
│           ├── lookup/route.ts         # GET    - lookup by number
│           ├── all/route.ts            # GET    - list all (admin)
│           ├── tab/route.ts            # POST/DELETE - add to tab / reset
│           └── delete/route.ts         # DELETE - remove employee (admin)
├── middleware.ts                        # Basic auth + session cookie
└── lib/
    ├── domain/
    │   ├── entities/                    # Employee entity
    │   └── ports/                       # Repository interface
    ├── application/
    │   └── services/                    # Employee application service
    └── infrastructure/
        ├── auth/                        # Admin token utilities
        ├── db/                          # MongoDB connection
        └── repositories/                # MongoDB repository
```
