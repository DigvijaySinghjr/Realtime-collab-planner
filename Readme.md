
# realtime-collab-planner

Realtime Collab Planner
=======================

This repository contains `realtime-collab-planner`, a Node.js application focused on collaborative planning and note-taking. The project was originally a basic to-do app; this README documents the current purpose, setup, and development notes.

Key features
- Note model with CRUD repository pattern (`model/`, `repository/`)
- User management with simple association of notes to users
- Lightweight server built with Express

Quickstart (development)

1. Install dependencies

    npm install

2. Configure the environment

    - The MongoDB connection is set in `src/config/db_config.js`. Update as needed.
    - Optionally set environment variables: `PORT`, `MONGO_URI`.

3. Start the server

    npm start

The server reads configuration from `src/index.js` and environment variables.

Project layout
- `src/` - main entry (`index.js`) and configuration
- `model/` - data models (`note.js`, `user.js`)
- `repository/` - data access / repository pattern
- `helper.js` - utility helpers

Development notes
- The current implementation does not use authentication or authorization. All note and user operations are open.
- There is no real-time (Socket.io/WebSocket) functionality in the base setup: all endpoints are synchronous HTTP/REST.
- Sessions are not implemented. If you plan to add session support, consider using a library such as `connect-mongo` for session persistence.

