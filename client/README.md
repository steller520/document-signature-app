# Client README

This client is the React frontend for the Document Signature App. It provides the owner document workflow, invite management UI, PDF preview, signature placement, drag-and-drop marker updates, public signing page, and signed file download controls.

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
- Dashboard for document list and access.
- Document viewer for owners to place, move, and finalize signatures.
- Public signing page for invited users.
- Shared PDF canvas and signature sidebar components.

## Important Files

- `src/pages/DocumentViewer.jsx`: owner document signing and finalization flow.
- `src/pages/PublicSign.jsx`: public invitee signing flow.
- `src/components/PdfCanvas.jsx`: PDF rendering, marker preview, drag-and-drop, zoom controls.
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

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
