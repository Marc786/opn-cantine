# AGENT.md - Development Guide for Bell Canteen Platform

This document serves as a comprehensive guide for AI agents and developers working on the Bell Canteen platform. It outlines architectural decisions, coding standards, best practices, and team conventions.

> **📝 IMPORTANT**: When making notable changes to the codebase (new features, architectural changes, technology updates, workflow changes), **always update this AGENT.md file** to keep documentation in sync with the implementation.

## Table of Contents

1. [Project Vision](#project-vision)
2. [Architecture](#architecture)
3. [Technology Stack](#technology-stack)
4. [Code Organization](#code-organization)
5. [Development Workflow](#development-workflow)
6. [Testing Strategy](#testing-strategy)
7. [Code Quality Standards](#code-quality-standards)
8. [Database Guidelines](#database-guidelines)
9. [UI/UX Guidelines](#ui-ux-guidelines)
10. [API Conventions](#api-conventions)
11. [Common Patterns](#common-patterns)

---

## Project Vision

The Bell Canteen platform is a comprehensive stock and sales management system that enables:

- **Digital purchasing** for employees/customers
- **Stock management** for administrators
- **User balance tracking** and transaction history
- **Analytics and reporting** for business insights

### Core Principles

- **Clean Architecture**: Business logic remains independent of frameworks
- **Maintainability**: Clear structure, well-tested, self-documenting code
- **Flexibility**: Database and infrastructure can be swapped without rewriting business logic
- **Internal Use**: Designed for ~100 Bell employees

---

## Architecture

This project follows **Hexagonal Architecture** (also known as Ports & Adapters pattern).

### Architecture Layers

```
┌─────────────────────────────────────────────────────────┐
│                      Presentation                        │
│  (Next.js Pages, API Routes, UI Components)             │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│                   Application Layer                      │
│        (Use Cases, Application Services)                │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│                    Domain Layer                          │
│  (Entities, Business Rules, Domain Logic, Ports)        │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│                 Infrastructure Layer                     │
│  (MongoDB Repositories, External APIs, File System)     │
└─────────────────────────────────────────────────────────┘
```

### Why Hexagonal Architecture?

1. **Database Independence**: Business logic doesn't know about MongoDB - we can switch to PostgreSQL, DynamoDB, or any other database
2. **Framework Independence**: Core business logic isn't tied to Next.js
3. **Testability**: Easy to test business logic with mock repositories
4. **Parallel Development**: Teams can work on different layers simultaneously
5. **Clear Boundaries**: Explicit interfaces (ports) between layers

### Directory Structure

```
app/
├── src/
│   ├── app/                        # Next.js App Router (Presentation)
│   │   ├── (customer)/            # Customer-facing pages
│   │   ├── (admin)/               # Admin pages
│   │   ├── api/                   # API routes
│   │   └── providers.tsx          # React providers
│   │
│   ├── lib/                       # Backend business logic
│   │   ├── domain/                # Domain Layer (Core Business Logic)
│   │   │   ├── entities/         # Business entities with validation
│   │   │   │   ├── purchase.entity.ts
│   │   │   │   ├── product.entity.ts
│   │   │   │   ├── user.entity.ts
│   │   │   │   └── transaction.entity.ts
│   │   │   │
│   │   │   ├── ports/            # Interface definitions
│   │   │   │   ├── *.repository.port.ts
│   │   │   │   └── *.service.port.ts
│   │   │   │
│   │   │   └── value-objects/    # Value objects (Money, Email, etc.)
│   │   │
│   │   ├── application/           # Application Layer (Use Cases)
│   │   │   ├── services/         # Application services
│   │   │   │   ├── purchase.application.service.ts
│   │   │   │   ├── product.application.service.ts
│   │   │   │   └── user.application.service.ts
│   │   │   │
│   │   │   └── dto/              # Data Transfer Objects
│   │   │       ├── purchase.dto.ts
│   │   │       └── product.dto.ts
│   │   │
│   │   └── infrastructure/        # Infrastructure Layer
│   │       ├── repositories/     # Repository implementations
│   │       │   ├── *.repository.mongodb.ts
│   │       │   └── *.repository.in-memory.ts
│   │       │
│   │       ├── database/         # Database connection & models
│   │       │   ├── mongodb.client.ts
│   │       │   └── models/
│   │       │
│   │       └── external/         # External service integrations
│   │
│   └── components/                # UI Components
│       ├── ui/                   # Reusable UI components (buttons, inputs, etc.)
│       ├── features/             # Feature-specific components
│       │   ├── purchase/
│       │   ├── product/
│       │   └── user/
│       └── layouts/              # Layout components
│
└── tests/                         # Test files
    ├── unit/
    ├── integration/
    └── e2e/
```

---

## Technology Stack

### Core Technologies

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript 5
- **Runtime**: Node.js 20+
- **UI Library**: Chakra UI v3
- **Database**: MongoDB (via repository pattern)
- **Testing**: (To be configured - Jest/Vitest recommended)

### Code Quality Tools

- **Linting**: ESLint 9 with Next.js config
- **Formatting**: Prettier 3
- **Type Checking**: TypeScript strict mode

### Key Dependencies

```json
{
  "@chakra-ui/react": "^3.32.0",
  "next": "16.1.6",
  "react": "19.2.3",
  "mongodb": "(to be added)",
  "zod": "(recommended for validation)"
}
```

---

## Code Organization

### Domain Layer (`lib/domain/`)

**Purpose**: Contains pure business logic, independent of any framework or database.

#### Entities

Entities are business objects with:
- Identity (ID)
- Validation rules
- Business logic methods
- Immutability (readonly properties)

**Example Pattern**:

```typescript
// lib/domain/entities/product.entity.ts
export interface Product {
  id: string;
  name: string;
  price: number;
  stockQuantity: number;
  category: string;
}

export class ProductEntity implements Product {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly price: number,
    public readonly stockQuantity: number,
    public readonly category: string
  ) {
    this.validate();
  }

  private validate(): void {
    if (!this.name || this.name.trim().length === 0) {
      throw new Error('Product name is required');
    }
    if (this.price < 0) {
      throw new Error('Price cannot be negative');
    }
    if (this.stockQuantity < 0) {
      throw new Error('Stock quantity cannot be negative');
    }
  }

  static create(name: string, price: number, stockQuantity: number, category: string): ProductEntity {
    return new ProductEntity(
      crypto.randomUUID(),
      name.trim(),
      price,
      stockQuantity,
      category
    );
  }

  isInStock(): boolean {
    return this.stockQuantity > 0;
  }

  reduceStock(quantity: number): ProductEntity {
    if (quantity > this.stockQuantity) {
      throw new Error('Insufficient stock');
    }
    return new ProductEntity(
      this.id,
      this.name,
      this.price,
      this.stockQuantity - quantity,
      this.category
    );
  }
}
```

#### Ports (Interfaces)

Ports define contracts without implementation details.

**Example Pattern**:

```typescript
// lib/domain/ports/product.repository.port.ts
import { Product } from '../entities/product.entity';

export interface IProductRepository {
  save(product: Product): Promise<Product>;
  findById(id: string): Promise<Product | null>;
  findAll(): Promise<Product[]>;
  findByCategory(category: string): Promise<Product[]>;
  update(product: Product): Promise<Product>;
  delete(id: string): Promise<void>;
}
```

### Application Layer (`lib/application/`)

**Purpose**: Orchestrates business workflows (use cases) using domain entities.

**Example Pattern**:

```typescript
// lib/application/services/product.application.service.ts
import { ProductEntity } from '@/lib/domain/entities/product.entity';
import { IProductRepository } from '@/lib/domain/ports/product.repository.port';

export interface CreateProductDto {
  name: string;
  price: number;
  stockQuantity: number;
  category: string;
}

export interface UpdateStockDto {
  productId: string;
  quantity: number;
}

export class ProductApplicationService {
  constructor(private readonly productRepository: IProductRepository) {}

  async createProduct(dto: CreateProductDto): Promise<ProductEntity> {
    const product = ProductEntity.create(
      dto.name,
      dto.price,
      dto.stockQuantity,
      dto.category
    );
    return await this.productRepository.save(product);
  }

  async reduceStock(dto: UpdateStockDto): Promise<ProductEntity> {
    const product = await this.productRepository.findById(dto.productId);
    if (!product) {
      throw new Error('Product not found');
    }

    const productEntity = new ProductEntity(
      product.id,
      product.name,
      product.price,
      product.stockQuantity,
      product.category
    );

    const updatedProduct = productEntity.reduceStock(dto.quantity);
    return await this.productRepository.update(updatedProduct);
  }

  async getProductsByCategory(category: string): Promise<ProductEntity[]> {
    return await this.productRepository.findByCategory(category);
  }
}
```

### Infrastructure Layer (`lib/infrastructure/`)

**Purpose**: Concrete implementations of ports (repositories, external services).

**Example Pattern**:

```typescript
// lib/infrastructure/repositories/product.repository.mongodb.ts
import { Product } from '@/lib/domain/entities/product.entity';
import { IProductRepository } from '@/lib/domain/ports/product.repository.port';
import { Collection } from 'mongodb';
import { getMongoClient } from '../database/mongodb.client';

export class MongoDBProductRepository implements IProductRepository {
  private async getCollection(): Promise<Collection> {
    const client = await getMongoClient();
    return client.db('bell-canteen').collection('products');
  }

  async save(product: Product): Promise<Product> {
    const collection = await this.getCollection();
    await collection.insertOne({
      _id: product.id,
      name: product.name,
      price: product.price,
      stockQuantity: product.stockQuantity,
      category: product.category,
      createdAt: new Date(),
    });
    return product;
  }

  async findById(id: string): Promise<Product | null> {
    const collection = await this.getCollection();
    const doc = await collection.findOne({ _id: id });
    if (!doc) return null;
    
    return {
      id: doc._id,
      name: doc.name,
      price: doc.price,
      stockQuantity: doc.stockQuantity,
      category: doc.category,
    };
  }

  async findAll(): Promise<Product[]> {
    const collection = await this.getCollection();
    const docs = await collection.find({}).toArray();
    return docs.map(doc => ({
      id: doc._id,
      name: doc.name,
      price: doc.price,
      stockQuantity: doc.stockQuantity,
      category: doc.category,
    }));
  }

  // ... other methods
}
```

### Presentation Layer (`app/`)

**Next.js API Routes**: Connect HTTP requests to application services.

**Example Pattern**:

```typescript
// app/api/products/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { ProductApplicationService } from '@/lib/application/services/product.application.service';
import { MongoDBProductRepository } from '@/lib/infrastructure/repositories/product.repository.mongodb';

const productRepository = new MongoDBProductRepository();
const productService = new ProductApplicationService(productRepository);

export async function GET() {
  try {
    const products = await productService.getAllProducts();
    return NextResponse.json(products);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const product = await productService.createProduct(body);
    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 400 }
    );
  }
}
```

---

## Development Workflow

### Before Starting

1. Pull latest changes: `git pull origin main`
2. Install dependencies: `npm install`
3. Check for linting issues: `npm run lint`
4. Run tests: `npm test` (when configured)

### Feature Development Flow

1. **Create a feature branch**: `git checkout -b feature/product-catalog`
2. **Implement domain entities first** (business logic)
3. **Define ports** (interfaces)
4. **Implement application services** (use cases)
5. **Create infrastructure implementations** (repositories)
6. **Build API routes**
7. **Create UI components**
8. **Write tests** for each layer
9. **Run linter**: `npm run lint:fix`
10. **Format code**: `npm run format`
11. **Update AGENT.md** if you made notable changes (new patterns, architecture changes, new conventions)
12. **Commit with clear messages**: `git commit -m "feat: add product catalog"`

### Git Conventions

Use conventional commits:

- `feat:` - New feature
- `fix:` - Bug fix
- `refactor:` - Code refactoring
- `test:` - Adding tests
- `docs:` - Documentation updates
- `chore:` - Maintenance tasks

**Examples**:
```
feat: add user balance tracking
fix: prevent negative stock quantities
refactor: extract purchase validation logic
test: add unit tests for ProductEntity
docs: update architecture diagrams
```

---

## Testing Strategy

### Test Pyramid

```
      ┌─────────────┐
      │   E2E (5%)  │  ← Full user flows
      └─────────────┘
     ┌───────────────┐
     │Integration(20%)│ ← API routes + repositories
     └───────────────┘
    ┌─────────────────┐
    │  Unit (75%)     │  ← Entities, services, components
    └─────────────────┘
```

### Testing Libraries (To Be Configured)

**Recommended**:
- **Jest** or **Vitest**: Unit and integration tests
- **React Testing Library**: Component tests
- **Playwright** or **Cypress**: E2E tests

### What to Test

#### Domain Layer (Unit Tests)

- Entity validation rules
- Business logic methods
- Value object behavior

**Example**:

```typescript
// tests/unit/domain/entities/product.entity.test.ts
import { ProductEntity } from '@/lib/domain/entities/product.entity';

describe('ProductEntity', () => {
  describe('create', () => {
    it('should create a valid product', () => {
      const product = ProductEntity.create('Coffee', 3.5, 100, 'Beverages');
      
      expect(product.name).toBe('Coffee');
      expect(product.price).toBe(3.5);
      expect(product.stockQuantity).toBe(100);
    });

    it('should throw error for negative price', () => {
      expect(() => {
        ProductEntity.create('Coffee', -1, 100, 'Beverages');
      }).toThrow('Price cannot be negative');
    });
  });

  describe('reduceStock', () => {
    it('should reduce stock quantity', () => {
      const product = ProductEntity.create('Coffee', 3.5, 100, 'Beverages');
      const updated = product.reduceStock(10);
      
      expect(updated.stockQuantity).toBe(90);
    });

    it('should throw error for insufficient stock', () => {
      const product = ProductEntity.create('Coffee', 3.5, 5, 'Beverages');
      
      expect(() => product.reduceStock(10)).toThrow('Insufficient stock');
    });
  });
});
```

#### Application Layer (Unit Tests with Mocks)

- Use case logic
- Service orchestration
- DTO validation

#### Infrastructure Layer (Integration Tests)

- Repository implementations with real database (test DB)
- Database queries
- External API integrations

#### Presentation Layer (Component Tests)

- UI component rendering
- User interactions
- Form validation

#### E2E Tests

- Critical user flows (purchase flow, admin stock management)
- Authentication flows
- Multi-step processes

---

## Code Quality Standards

### ESLint Configuration

The project uses ESLint 9 with:
- Next.js recommended rules
- TypeScript support
- Prettier integration

Run before committing:
```bash
npm run lint        # Check for issues
npm run lint:fix    # Auto-fix issues
```

### Prettier Configuration

Automatic code formatting:
```bash
npm run format       # Format all files
npm run format:check # Check formatting
```

### TypeScript Strict Mode

All code must:
- Use explicit types (avoid `any`)
- Handle null/undefined cases
- Define return types for functions
- Use interfaces for object shapes

**Good**:
```typescript
function calculateTotal(items: Product[]): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}
```

**Bad**:
```typescript
function calculateTotal(items: any) {
  return items.reduce((sum: any, item: any) => sum + item.price, 0);
}
```

### Code Review Checklist

- [ ] Follows hexagonal architecture patterns
- [ ] Business logic in domain layer
- [ ] No database details in domain/application layers
- [ ] Tests written and passing
- [ ] ESLint passes with no warnings
- [ ] Prettier formatting applied
- [ ] Type-safe (no `any` types)
- [ ] Clear variable/function names
- [ ] Comments only where necessary (code should be self-documenting)
- [ ] No console.logs in production code

---

## Database Guidelines

### MongoDB Connection

**IMPORTANT**: Database connection must be decoupled via repository pattern.

#### Connection Client

```typescript
// lib/infrastructure/database/mongodb.client.ts
import { MongoClient } from 'mongodb';

let client: MongoClient | null = null;

export async function getMongoClient(): Promise<MongoClient> {
  if (client) return client;

  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
  client = new MongoClient(uri);
  await client.connect();
  
  return client;
}

export async function closeMongoClient(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
  }
}
```

#### Environment Variables

```env
# .env.local
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB_NAME=bell-canteen
```

### Repository Pattern

**Key Principle**: Domain layer NEVER imports MongoDB types.

✅ **Good** - Domain layer:
```typescript
// lib/domain/ports/product.repository.port.ts
export interface IProductRepository {
  save(product: Product): Promise<Product>;
  findById(id: string): Promise<Product | null>;
}
```

❌ **Bad** - Domain layer:
```typescript
import { Collection } from 'mongodb'; // NEVER import MongoDB in domain

export interface IProductRepository {
  getCollection(): Collection; // WRONG - exposes MongoDB details
}
```

### Database Migration Strategy

When switching databases (e.g., MongoDB → PostgreSQL):

1. ✅ Change only in `infrastructure/repositories/`
2. ✅ Domain and application layers remain unchanged
3. ✅ Write new repository: `product.repository.postgresql.ts`
4. ✅ Update dependency injection in API routes

---

## UI/UX Guidelines

### Chakra UI Best Practices

#### Theme Configuration

```typescript
// app/providers.tsx
import { ChakraProvider, createSystem, defaultConfig } from '@chakra-ui/react';

const system = createSystem(defaultConfig, {
  theme: {
    tokens: {
      colors: {
        brand: {
          50: '#e6f2ff',
          500: '#0066cc',
          900: '#003366',
        },
      },
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return <ChakraProvider value={system}>{children}</ChakraProvider>;
}
```

### Component Organization

```
components/
├── ui/                      # Reusable UI primitives
│   ├── Button.tsx
│   ├── Input.tsx
│   ├── Card.tsx
│   └── Modal.tsx
│
├── features/                # Feature-specific components
│   ├── purchase/
│   │   ├── PurchaseForm.tsx
│   │   ├── PurchaseList.tsx
│   │   └── PurchaseCard.tsx
│   │
│   ├── product/
│   │   ├── ProductCatalog.tsx
│   │   ├── ProductCard.tsx
│   │   └── ProductFilter.tsx
│   │
│   └── user/
│       ├── UserProfile.tsx
│       └── UserBalance.tsx
│
└── layouts/
    ├── MainLayout.tsx
    ├── AdminLayout.tsx
    └── CustomerLayout.tsx
```

### Component Patterns

#### Small, focused components

```typescript
// components/features/product/ProductCard.tsx
import { Card, Heading, Text, Button } from '@chakra-ui/react';
import { Product } from '@/lib/domain/entities/product.entity';

interface ProductCardProps {
  product: Product;
  onAddToCart: (productId: string) => void;
}

export function ProductCard({ product, onAddToCart }: ProductCardProps) {
  return (
    <Card.Root>
      <Card.Body>
        <Heading size="md">{product.name}</Heading>
        <Text color="gray.600">{product.category}</Text>
        <Text fontSize="xl" fontWeight="bold">
          ${product.price.toFixed(2)}
        </Text>
        <Text color={product.isInStock() ? 'green.500' : 'red.500'}>
          {product.isInStock() ? 'In Stock' : 'Out of Stock'}
        </Text>
      </Card.Body>
      <Card.Footer>
        <Button
          colorScheme="brand"
          onClick={() => onAddToCart(product.id)}
          disabled={!product.isInStock()}
        >
          Add to Cart
        </Button>
      </Card.Footer>
    </Card.Root>
  );
}
```

---

## API Conventions

### RESTful Routes

```
GET    /api/products           # List all products
GET    /api/products/:id       # Get single product
POST   /api/products           # Create product
PUT    /api/products/:id       # Update product
DELETE /api/products/:id       # Delete product

GET    /api/purchases          # List purchases
POST   /api/purchases          # Create purchase

GET    /api/users              # List users
GET    /api/users/:id/balance  # Get user balance
POST   /api/users/:id/balance  # Update balance
```

### Response Format

**Success**:
```json
{
  "data": { ... },
  "message": "Product created successfully"
}
```

**Error**:
```json
{
  "error": "Product not found",
  "details": "No product with ID: 123"
}
```

### Status Codes

- `200` - OK (GET, PUT)
- `201` - Created (POST)
- `204` - No Content (DELETE)
- `400` - Bad Request (validation error)
- `404` - Not Found
- `500` - Internal Server Error

---

## Common Patterns

### Dependency Injection

Use constructor injection for services:

```typescript
export class PurchaseApplicationService {
  constructor(
    private readonly purchaseRepository: IPurchaseRepository,
    private readonly productRepository: IProductRepository,
    private readonly userRepository: IUserRepository
  ) {}
}
```

### Error Handling

Domain-level errors:

```typescript
export class InsufficientStockError extends Error {
  constructor(productId: string, requested: number, available: number) {
    super(`Insufficient stock for product ${productId}. Requested: ${requested}, Available: ${available}`);
    this.name = 'InsufficientStockError';
  }
}
```

Application-level error handling:

```typescript
try {
  const purchase = await purchaseService.createPurchase(dto);
  return NextResponse.json({ data: purchase }, { status: 201 });
} catch (error) {
  if (error instanceof InsufficientStockError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  console.error('Unexpected error:', error);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}
```

### Value Objects

For complex values like Money, Email, etc.:

```typescript
// lib/domain/value-objects/money.ts
export class Money {
  constructor(
    public readonly amount: number,
    public readonly currency: string = 'USD'
  ) {
    if (amount < 0) {
      throw new Error('Amount cannot be negative');
    }
  }

  add(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new Error('Cannot add different currencies');
    }
    return new Money(this.amount + other.amount, this.currency);
  }

  toString(): string {
    return `${this.currency} ${this.amount.toFixed(2)}`;
  }
}
```

---

## Quick Reference

### Adding a New Feature (Checklist)

1. [ ] Create domain entity in `lib/domain/entities/`
2. [ ] Define repository port in `lib/domain/ports/`
3. [ ] Create application service in `lib/application/services/`
4. [ ] Implement MongoDB repository in `lib/infrastructure/repositories/`
5. [ ] Create API routes in `app/api/`
6. [ ] Build UI components in `components/features/`
7. [ ] Write unit tests for entity
8. [ ] Write unit tests for application service (with mocks)
9. [ ] Write integration tests for repository
10. [ ] Write component tests
11. [ ] Run linter and formatter
12. [ ] **Update AGENT.md if adding new patterns or conventions**
13. [ ] Submit PR with clear description

### Commands Cheat Sheet

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm run start            # Start production server

# Code Quality
npm run lint             # Check linting
npm run lint:fix         # Fix linting issues
npm run format           # Format code
npm run format:check     # Check formatting

# Testing (when configured)
npm test                 # Run all tests
npm test:watch           # Watch mode
npm test:coverage        # Coverage report
```

### File Naming Conventions

- **Entities**: `*.entity.ts` (e.g., `product.entity.ts`)
- **Ports**: `*.port.ts` (e.g., `product.repository.port.ts`)
- **Services**: `*.service.ts` (e.g., `product.application.service.ts`)
- **Repositories**: `*.repository.mongodb.ts` or `*.repository.in-memory.ts`
- **Components**: PascalCase (e.g., `ProductCard.tsx`)
- **Tests**: `*.test.ts` or `*.spec.ts`

---

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Chakra UI Documentation](https://www.chakra-ui.com/)
- [Hexagonal Architecture Guide](https://alistair.cockburn.us/hexagonal-architecture/)
- [MongoDB Node.js Driver](https://www.mongodb.com/docs/drivers/node/current/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

---

## Questions?

For architecture decisions or questions about patterns, consult:
1. This AGENT.md document
2. Existing code examples in the codebase
3. Team lead or senior developers

**Remember**: Keep business logic pure, database decoupled, and code well-tested!
