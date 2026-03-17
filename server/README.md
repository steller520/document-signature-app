# Server README

This server provides the API and PDF-processing layer for the Document Signature App. It handles authentication, document storage, signature records, invite links, PDF finalization, email invitations, and audit logging.

## Stack

- Express 5
- Mongoose
- JWT authentication
- Multer for PDF uploads
- Nodemailer for invitation emails
- PDF-Lib for signed PDF generation

## Setup

1. Install dependencies:

```bash
cd server
npm install
```

2. Create or update `server/.env`:

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
FRONTEND_URL=http://localhost:5173
EMAIL_USER=your_email_account
EMAIL_PASS=your_email_app_password
```

3. Start the server:

```bash
cd server
npm start
```

The API will run on `http://localhost:5000` unless `PORT` is overridden.

## Available Script

```bash
npm start
```

`npm start` runs `nodemon server.js` for local development.

## Environment Variables

- `PORT`: API port. Defaults to `5000`.
- `MONGO_URI`: MongoDB connection string.
- `JWT_SECRET`: Secret used to sign and verify JWT tokens.
- `FRONTEND_URL`: Base URL used to generate public signing links.
- `EMAIL_USER`: Sender email account for invitation emails.
- `EMAIL_PASS`: App password or mail credential for `EMAIL_USER`.

## Main Responsibilities

- Authenticate users and protect owner-only routes.
- Upload PDF files and store their metadata.
- Create and update signature records.
- Generate public signing links.
- Serve PDF files for preview.
- Finalize documents by writing signatures onto the PDF.
- Send invitation emails.
- Store audit records.

## Key Route Areas

Authentication and users:

- `POST /api/users/register`
- `POST /api/users/login`

Documents:

- `POST /api/docs/upload`
- `GET /api/docs`
- `GET /api/docs/:token`
- `GET /api/docs/:token/download`
- `GET /api/docs/view/:token`

Signatures:

- `POST /api/signatures`
- `GET /api/signatures/:documentId`
- `POST /api/signatures/sign`
- `PATCH /api/signatures/:signatureId/coordinates`
- `POST /api/signatures/invite`
- `POST /api/signatures/invite-batch`
- `POST /api/signatures/finalize`
- `GET /api/signatures/public-sign/:token`
- `GET /api/signatures/public-sign/:token/document`
- `POST /api/signatures/public-sign/:token`

## File Storage

- Uploaded and finalized PDFs are stored in `server/uploads/`.
- The API serves PDFs inline for viewer pages.
- Signed PDFs are generated during finalization and written back to the uploads directory.

## Notes

- The current mail flow uses Gmail via Nodemailer.
- Public signing is token based and does not require authentication.
- The server uses ESM modules, so keep imports in `import` syntax.