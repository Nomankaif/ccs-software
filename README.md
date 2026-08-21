# Clinical Case Simulator

A TypeScript MERN clinical case simulator with a screenshot-faithful desktop exam interface. It is independent educational software and is not affiliated with USMLE, NBME, FSMB, Prometric, or Primum.

## Active stack

- React 19, Vite, Tailwind CSS 4, TanStack Query
- Express 5, Node.js, TypeScript
- MongoDB and Mongoose
- Argon2id passwords and JWT HTTP-only cookies
- REST polling every five seconds; no Socket.IO or WebSockets

## Run locally

MongoDB must be available at `mongodb://127.0.0.1:27017` or configured through `MONGODB_URI`.

```powershell
pnpm install
pnpm dev
```

Open `http://localhost:5173`.

Demo accounts:

- Student: `student@example.com` / `password`
- Admin: `admin@example.com` / `password`

Admins can create cases through the guided editor or import validated JSON, then publish them manually. Only published cases are visible in the student library.

## Backend architecture

The Express API uses an MVC-style structure under `apps/server/src`:

- `models/`: Mongoose schemas and database models.
- `controllers/`: HTTP request and response handling. JSON is the view representation for this REST API.
- `services/`: Authentication, case lifecycle, simulation, scoring, and seed-data business logic.
- `routes/`: Versioned endpoint definitions and middleware composition.
- `middleware/`: Authentication, authorization, validation, rate limiting, and error handling.
- `validators/`: Zod request schemas owned by the API layer.
- `config/`: Environment and MongoDB connection configuration.
- `data/`: Original development seed content.
- `types/`, `utils/`, and `errors/`: Shared infrastructure with no feature business logic.

The dependency flow is `routes -> controllers -> services -> models`. Controllers never query MongoDB directly, and route files contain no business rules.

## Frontend architecture

React components under `apps/client/src/components` are presentation-focused. Reusable session, navigation, React Query, polling, mutation, validation, and editor behavior lives under `apps/client/src/hooks`.

The frontend dependency flow is `components -> hooks -> api`. Components keep only local visual state such as open dialogs and selected form controls.
