# Client README

This client is the React frontend for the Document Signature App. It provides the owner document workflow, invite management UI, PDF preview, signature placement, drag-and-drop marker updates, the public signing page, and signed PDF download controls.

## Stack

- React 19
- Vite 7
- React Router
- Axios
- Tailwind CSS 4
- React PDF
- DnD Kit

## Setup

1. Install dependencies:

```bash
cd client
npm install
```

2. Start the development server:

```bash
cd client
npm run dev
```

3. Build for production:

```bash
cd client
npm run build
```

## Available Scripts

```bash
npm run dev
npm run build
npm run lint
npm run preview
```

## Application Areas

- Authentication pages for login and registration.
- Dashboard for document listing and access.
- Owner document viewer for placing, moving, and finalizing signatures.
- Public signing page for invited signers.
- Shared PDF canvas and signature sidebar components.

## Important Files

- `src/pages/DocumentViewer.jsx`: owner document signing and finalization flow.
- `src/pages/PublicSign.jsx`: public invitee signing flow.
- `src/components/PdfCanvas.jsx`: PDF rendering, marker preview, drag-and-drop, and zoom controls.
- `src/components/SignatureSidebar.jsx`: owner signature controls and invite UI.
- `src/api/axios.js`: API client configuration.

## API Integration

- The client currently expects the backend API at `http://localhost:5000/api`.
- Authenticated requests attach the JWT token from `localStorage`.
- Public signing routes are accessed without auth using the tokenized link.

## Notes

- PDF preview uses `react-pdf` and `pdfjs-dist`.
- Marker preview sizing and positioning are designed to match finalized PDF output as closely as possible.
- Zoom and drag behavior are part of the signing experience for both owners and public signers.
