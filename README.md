# Bell Canteen - Self-Service Kiosk

A web-based self-service kiosk application for the Bell office canteen. Employees can purchase items (drinks, snacks, etc.) by entering their name and the purchase amount.

## Project Overview

This application consists of:

- **Frontend**: Next.js app optimized for iPad/tablet display
- **Backend**: NestJS REST API for processing purchases
- **MVP Features**: Simple purchase entry with name and amount

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript
- **Backend**: NestJS, TypeScript
- **Database**: MongoDB

## Project Structure

```
OPN/
├── backend/          # NestJS backend API
│   ├── src/
│   │   ├── app.module.ts
│   │   ├── main.ts
│   │   └── purchases/
│   └── package.json
├── frontend/         # Next.js frontend app
│   ├── src/
│   │   ├── app/
│   │   └── components/
│   └── package.json
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn
- Git

### Backend Setup

```bash
cd backend
npm install
npm run start:dev
```

The backend will run on `http://localhost:3000`

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend will run on `http://localhost:3001`

## MVP Features

### About the MVP

The MVP (Minimum Viable Product) is designed to be a streamlined proof-of-concept for the Bell canteen self-service system. It focuses on the core functionality: allowing employees to quickly record their purchases at the kiosk. The interface is intentionally simple—employees enter their name and the dollar amount of their purchase, then submit. This data is sent to the backend API where it's stored with a timestamp. The goal is to validate the user flow and technical architecture before adding complexity like product catalogs, payment processing, or user authentication. Think of it as a digital honor system that lays the foundation for a full-featured canteen management system.

### Current Features (v0.1)

- ✅ Simple purchase form with name and amount inputs
- ✅ Submit purchases to backend API
- ✅ Basic validation
- ✅ iPad-optimized UI

### Planned Features

- [ ] Product catalog with prices
- [ ] User authentication/employee ID
- [ ] Purchase history
- [ ] Admin dashboard
- [ ] Payment integration
- [ ] Receipt generation
- [ ] Inventory management
- [ ] Analytics and reporting

## API Endpoints

### POST /purchases

Create a new purchase

**Request Body:**

```json
{
  "name": "John Doe",
  "amount": 5.5
}
```

**Response:**

```json
{
  "id": "uuid",
  "name": "John Doe",
  "amount": 5.5,
  "timestamp": "2026-02-05T12:00:00.000Z"
}
```

### GET /purchases

Get all purchases (for admin/testing)

## Development

### Running Tests

```bash
# Backend
cd backend
npm run test

# Frontend
cd frontend
npm run test
```

### Building for Production

```bash
# Backend
cd backend
npm run build
npm run start:prod

# Frontend
cd frontend
npm run build
npm run start
```

## License

Proprietary - Bell Internal Use Only
