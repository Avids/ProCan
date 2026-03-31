# ProCan - Full Stack Construction Management System

A system for General Contractors, handling trades, subcontractors, and suppliers.

## Quick Start (Docker)
1. Copy `backend/.env.example` to `backend/.env`.
2. Start the system:
   ```bash
   docker-compose up -d
   ```
3. Run migrations on the db:
   ```bash
   docker exec -it procan-backend pnpm prisma migrate dev
   ```
4. Access the API at `http://localhost:3000/api/v1/health`.
5. Access the Frontend at `http://localhost:5173`.
