# Frontend — React (Vite + TypeScript)

## Scripts

```bash
npm run dev
npm run build
npm run preview
```

## Environment

```env
VITE_BACKEND_URL=http://localhost:3001
```

LiveKit URL and tokens are **not** stored in the frontend env — NestJS sends them on the `matched` Socket.IO event after creating a room.
