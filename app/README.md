# Cantine

App de gestion des ardoises cantine. Chaque employe a un compte identifie par son numero d'employe et peut y accumuler un solde.

## Prerequisites

- [Node.js](https://nodejs.org/) (v20+)
- [pnpm](https://pnpm.io/)
- [Docker](https://www.docker.com/) (for MongoDB)

## Getting started

### 1. Start MongoDB

```bash
docker run -d --name mongo -p 27017:27017 mongo
```

If the container already exists:

```bash
docker start mongo
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Configure environment

A `.env.local` file should exist at the root of `app/` with:

```
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB=cantine
```

### 4. Run the dev server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project structure

```
src/
├── app/
│   ├── page.tsx                  # Employee login (enter number)
│   ├── register/page.tsx         # New employee registration
│   ├── tab/[employeeNumber]/     # Tab view (balance, add, reset)
│   └── api/
│       └── employees/
│           ├── route.ts          # POST - create employee
│           ├── lookup/route.ts   # GET  - lookup by number
│           └── tab/route.ts      # POST - add to tab, DELETE - reset
└── lib/
    ├── domain/
    │   ├── entities/             # Employee entity
    │   └── ports/                # Repository interface
    ├── application/
    │   └── services/             # Employee application service
    └── infrastructure/
        ├── db/mongo.ts           # MongoDB connection
        └── repositories/         # MongoDB repository implementation
```

## Tech stack

- **Next.js 16** (App Router)
- **Chakra UI v3**
- **MongoDB** (via native driver)
- **TypeScript**
