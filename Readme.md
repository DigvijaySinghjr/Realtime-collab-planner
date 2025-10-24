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
- Email-based collaborator invitations with expiring, secure tokens.
- Advanced Role-Based Access Control (RBAC) for notes, managed via a `can()` middleware.
- Endpoints for managing collaborator roles and revoking access.

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

## API Endpoints

The application provides several key endpoints for managing notes and collaboration. All protected routes require the user to be authenticated.

### User & Authentication
- `POST /createUser`: Creates a new user account.
- `POST /login`: Authenticates a user and starts a session.

### Note Management
- `POST /addNotes`: Creates a new note and assigns ownership to the creator.
- `GET /getAllNotes`: Retrieves all notes the current user has access to.
- `GET /getNotes/:noteId`: Retrieves a single note by its ID. Requires `read_note` permission.
- `PATCH /updateNotes/:noteId`: Updates a note's content or title. Requires `edit_note_content` permission.
- `DELETE /deleteNotes/:noteId`: Deletes a note and all associated memberships. Requires `delete_note` permission.

### Collaboration & Invitations
- `POST /inviteUser`: Sends an email invitation to a user to collaborate on a specific note with a given role.
- `GET /accept-invitation`: Endpoint for the link in the invitation email. Verifies the token and grants the user access to the note. The user must be logged in to accept.

### Role & Access Management
- `POST /changeRoles`: Allows a note's 'Owner' to change the role of another collaborator on that note.
- `DELETE /revokeAccess/:noteId/:targetId`: Allows a note's 'Owner' to remove a collaborator from a note.



Development notes
- Sessions: use `connect-mongo` to persist sessions to the database for production. The existing notes mention session storage; move that logic into `src/config/session.js` (create if missing).
- Authorization: the project prefers role-based policies. Suggested roles and permissions (example):

  - Viewer: read:self, read:group
  - User: create:note, update:own_note, delete:own_note (ownership checks required)
  - Editor: update:any_note, delete:any_note, manage:group_settings (group membership checks required)
  - Admin: manage:roles, manage:users (global admin checks)




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