# Clinical Case Simulator

A TypeScript MERN clinical case simulator with a screenshot-faithful desktop exam interface. It is independent educational software and is not affiliated with USMLE, NBME, FSMB, Prometric, or Primum.

## Active stack

- React 19, Vite, Tailwind CSS 4, TanStack Query
- Express 5, Node.js, TypeScript
- MongoDB and Mongoose
- Argon2id passwords and JWT HTTP-only cookies
- Socket.IO for live attempt updates, with REST polling and state recovery as a fallback

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

Admins and sub-admins manage employee accounts under Employees. Case writers can access Cases and Order catalog and save draft cases; publishing requires an admin or sub-admin. Shared CASL permissions enforce these restrictions on the client and server.

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

## Realtime architecture

REST remains authoritative for all attempt commands and full-state recovery. An authenticated Socket.IO connection joins a room scoped to the current attempt and immediately pushes patient updates, results, vital-sign changes, final-order warnings, synchronized timer data, forced completion, and changes from another browser session. If the connection drops, the frontend automatically resumes five-second REST polling until Socket.IO reconnects.

## P1 clinical simulation flow

1. In **Administration -> Order catalog**, create the globally searchable order with its aliases and qualifier choices.
2. In the case editor, use **Add from global order catalog**. The saved case version receives an immutable snapshot of the selected catalog definition.
3. Configure `orderBehaviors` for case-specific processing time, location availability, classification, and direct patient response.
4. Configure `clinicalStates` for patient appearance and vital-sign snapshots.
5. Configure `transitionRules` for order placement/completion, order combinations, location changes, or simulated-time thresholds.

The server schedules and resolves results and patient events chronologically. It remains authoritative for simulated time, clinical state, vital signs, progress notes, notifications, and case-ending events. The browser only submits revision-checked, idempotent REST actions.

The sample file `sample-cases/dehydration-flow-test.json` demonstrates this flow. After importing and publishing a new version, order IV access and normal saline, then advance simulated time by 30 minutes. The patient changes to the improving state, updated vital signs appear in the chart, and a patient-update notification is displayed. Advancing 60 minutes without effective treatment instead triggers the deterioration rule.
