# Basic To-Do App

A simple to-do list application built with Node.js, Express, and MongoDB.

## Features
- Create, edit, and delete notes and to-dos
- Support for photos and simple formatting
- Collaboration enabled (share lists with others)












# realtime-collab-planner

Realtime Collab Planner
=======================

This repository now contains `realtime-collab-planner`, a Node.js application focused on realtime collaborative planning and note-taking. The project was originally a basic to-do app; this README documents the current purpose, quick setup, and development notes.

Key features
- Realtime collaboration (Socket.io / WebSocket-ready)
- User authentication (Passport.js integration in `src/config/passport-config.js`)
- Note model with CRUD repository pattern (`model/`, `repository/`)
- Lightweight server built with Express

Quickstart (development)
1. Install dependencies

	npm install

2. Configure the environment

	- Create or update `src/config/db_config.js` with your MongoDB (or other DB) credentials.
	- Ensure `src/config/passport-config.js` matches your auth strategy (local, OAuth, etc.).
	- Optionally set environment variables: `PORT`, `MONGO_URI`, `SESSION_SECRET`.

3. Start the server

	npm start

The server reads configuration from `src/index.js` and environment variables.

Project layout
- `src/` - main entry (`index.js`) and configuration
- `model/` - data models (`note.js`, `user.js`)
- `repository/` - data access / repository pattern
- `routes/` - Express route handlers (e.g., `auth_route.js`)
- `helper.js` - utility helpers

Development notes
- Sessions: use `connect-mongo` to persist sessions to the database for production. The existing notes mention session storage; move that logic into `src/config/session.js` (create if missing).
- Authorization: the project prefers role-based policies. Suggested roles and permissions (example):

  - Viewer: read:self, read:group
  - User: create:note, update:own_note, delete:own_note (ownership checks required)
  - Editor: update:any_note, delete:any_note, manage:group_settings (group membership checks required)
  - Admin: manage:roles, manage:users (global admin checks)

Contribution guide
- Open issues for bugs or feature requests.
- Keep PRs small and focused.
- Add tests for new model/repository logic.

License & contact
Add a `LICENSE` file if you want to publish as open source. Add contact info or a project maintainers section if desired.

Notes
This README is intentionally concise. If you want a more detailed developer guide (setup scripts, Docker, CI), say so and I can add it.







## Data Model and Authorization

The core of the authorization system is the `NoteMembership` model. It acts as a **junction table** (or "middleman") that establishes and manages all relationships between a `User`, a `Note`, and a `Role`.

### How `NoteMembership` Works


+-----------+       (One-to-Many)       +--------------------+       (Many-to-One)       +--------+
|           | ------------------------- |                    | ------------------------- |        |
|   User    |                           |  NoteMembership    |                           |  Note  |
|           | <-----------------------  |                    |  -----------------------> |        |
+-----------+       (userId)            +--------------------+       (noteId)            +--------+
                                                  |
                                                  | (roleId)
                                                  | (Many-to-One)
                                                  v
                                            +--------+
                                            |        |
                                            |  Role  |
                                            |        |
                                            +--------+


Each `NoteMembership` document is a single, atomic statement of permission: **"User X has Role Y on Note Z."** It connects the other models as follows:

*   **Connecting Users to Notes:**
    *   `userId`: Links to a specific `User`.
    *   `noteId`: Links to a specific `Note`.

*   **Defining the Permission:**
    *   `roleId`: Links to a `Role` (e.g., 'Owner', 'Editor', 'Viewer'), defining what the user is allowed to do with the note.

### Lifecycle of a Membership

A `NoteMembership` document is created, updated, or deleted in these key scenarios:

*   **Note Creation:** A new membership is created to assign the 'Owner' role to the note's creator.
*   **Adding a Collaborator:** A new membership is created when a user is invited to a note with a specific role.
*   **Changing a Role:** An existing membership is updated if a user's role on a note changes (e.g., a 'Viewer' is promoted to 'Editor').

This design centralizes all access control logic. To check if a user can perform an action, you only need to query the `NoteMembership` collection.

### Cleaning Up Redundant Fields

To maintain a single source of truth, the following fields in other models become redundant and should be removed:

1.  **In the `Note` Model:**
    *   **Redundant Field:** Any field like `owner`, `ownerId`, or `creatorId` that directly points to a single user.
    *   **Reason:** Ownership is now defined by a `NoteMembership` entry with an 'Owner' role. Keeping a separate `owner` field creates data duplication and potential for inconsistency. The `Note` model should only contain data about the note itself.

2.  **In the `User` Model:**
    *   **Redundant Field:** Any field that stores an array of note IDs, such as `notes`, `ownedNotes`, or `collaboratingNotes`.
    *   **Reason:** To find all notes a user can access, you should query the `NoteMembership` collection. This is more powerful as it can also retrieve the user's specific role for each note. Storing note IDs on the `User` model is inefficient and doesn't capture the full relationship.