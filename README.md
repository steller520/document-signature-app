# Document Signature App

Document Signature App is a full-stack PDF signing workflow built with React, Vite, Express, and MongoDB. It supports document upload, owner-managed signature placement, invite-based public signing, PDF finalization, and signed document download.

## Repository Structure

- `client/`: React frontend for document upload, signing, preview, and public signing.
- `server/`: Express API, MongoDB models, mail sending, PDF finalization, and file storage.

## Main Features

- User authentication with JWT-based protected routes.
- PDF upload and in-app preview.
- Owner signature placement and drag-and-drop repositioning before finalization.
- Invite multiple signers by email.
- Public signing flow with token-based access.
- Signature font and size selection with live preview.
- Signed PDF generation and download.
- Audit logging for document and signing actions.

## Tech Stack

- Frontend: React, Vite, React Router, Axios, Tailwind CSS, React PDF, DnD Kit.
- Backend: Express, Mongoose, JWT, Multer, Nodemailer, PDF-Lib.
- Database: MongoDB.

## Prerequisites

- Node.js 18 or newer.
- npm.
- MongoDB instance.

## Quick Start

1. Install frontend dependencies:

```bash
cd client
npm install
```

2. Install backend dependencies:

```bash
cd server
npm install
```

3. Configure backend environment variables in `server/.env`:

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
FRONTEND_URL=http://localhost:5173
EMAIL_USER=your_email_account
EMAIL_PASS=your_email_app_password
```

4. Start the backend:

```bash
cd server
npm start
```

5. Start the frontend:

```bash
cd client
npm run dev
```

6. Open the app in the browser:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:5000`

## Development Notes

- The frontend API client currently uses a fixed base URL of `http://localhost:5000/api`.
- Uploaded and generated PDF files are stored in `server/uploads/`.
- Public signing links are built from `FRONTEND_URL` on the backend.
- The backend serves PDF files inline for in-app preview and exposes a separate download endpoint for signed files.

## Useful Commands

Frontend:

```bash
cd client
npm run dev
npm run build
npm run lint
```

Backend:

```bash
cd server
npm start
```

## Current Flow

1. A user registers or logs in.
2. The owner uploads a PDF.
3. The owner places their signature and invitee markers.
4. Invitees open the public sign link and sign the document.
5. The owner finalizes the document.
6. The app generates and downloads the signed PDF.