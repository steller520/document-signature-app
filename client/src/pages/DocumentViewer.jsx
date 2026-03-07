import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Document, Page, pdfjs } from "react-pdf";
import API from "../api/axios";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).href;

const EMPTY_INVITEE = {
  email: "",
  signerName: "",
  signerTitle: "",
  reason: "",
};

function DocumentViewer() {
  const { id } = useParams();
  const [pdfUrl, setPdfUrl] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [signatures, setSignatures] = useState([]);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [pendingPlacement, setPendingPlacement] = useState(null);
  const [signatureForm, setSignatureForm] = useState({
    signature: "",
    signerName: "",
    signerTitle: "",
    reason: "",
  });
  const [invitees, setInvitees] = useState([EMPTY_INVITEE]);

  const fetchSignatures = async () => {
    try {
      const { data } = await API.get(`/signatures/${id}`);
      setSignatures(data || []);
    } catch (error) {
      console.error("Failed to fetch signatures:", error);
    }
  };

  useEffect(() => {
    let objectUrl = null;

    const fetchDoc = async () => {
      try {
        setLoading(true);
        const [{ data: blobData }] = await Promise.all([
          API.get(`/docs/${id}/file`, {
            responseType: "blob",
          }),
          fetchSignatures(),
        ]);

        objectUrl = URL.createObjectURL(blobData);
        setPdfUrl(objectUrl);
      } catch (error) {
        console.error(error);
        setStatusMessage("Could not load document.");
      } finally {
        setLoading(false);
      }
    };

    fetchDoc();

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [id]);

  const openSignDialog = (page, event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;

    setPendingPlacement({ x, y, page });
    setSignatureForm({
      signature: "",
      signerName: "",
      signerTitle: "",
      reason: "",
    });
    setInvitees([EMPTY_INVITEE]);
    setStatusMessage("");
    setIsDialogOpen(true);
  };

  const closeSignDialog = () => {
    setIsDialogOpen(false);
    setPendingPlacement(null);
  };

  const updateInvitee = (index, field, value) => {
    setInvitees((prev) =>
      prev.map((invitee, i) =>
        i === index
          ? {
              ...invitee,
              [field]: value,
            }
          : invitee,
      ),
    );
  };

  const addInvitee = () => {
    setInvitees((prev) => [...prev, { ...EMPTY_INVITEE }]);
  };

  const removeInvitee = (index) => {
    setInvitees((prev) => {
      if (prev.length === 1) {
        return prev;
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const saveSignatureWithDetails = async () => {
    if (!pendingPlacement) {
      return;
    }

    if (!signatureForm.signature.trim()) {
      setStatusMessage("Signature text is required.");
      return;
    }

    const coordinates = {
      x: pendingPlacement.x,
      y: pendingPlacement.y,
      width: 0.2,
      height: 0.08,
    };

    const cleanedInvitees = invitees
      .map((invitee) => ({
        email: String(invitee.email || "").trim().toLowerCase(),
        signerName: String(invitee.signerName || "").trim(),
        signerTitle: String(invitee.signerTitle || "").trim(),
        reason: String(invitee.reason || "").trim(),
      }))
      .filter((invitee) => invitee.email);

    try {
      setSaving(true);
      setStatusMessage("");

      await API.post("/signatures", {
        documentId: id,
        signature: signatureForm.signature.trim(),
        signatureDetails: {
          signerName: signatureForm.signerName.trim(),
          signerTitle: signatureForm.signerTitle.trim(),
          reason: signatureForm.reason.trim(),
          signedAt: new Date().toISOString(),
        },
        coordinates,
        page: pendingPlacement.page,
      });

      let inviteResultMessage = "";

      if (cleanedInvitees.length > 0) {
        const { data } = await API.post("/signatures/invite-batch", {
          documentId: id,
          coordinates,
          page: pendingPlacement.page,
          invitees: cleanedInvitees,
        });

        const createdCount = data?.created?.length || 0;
        const skippedCount = data?.skipped?.length || 0;
        inviteResultMessage = ` Invitees added: ${createdCount}. Skipped: ${skippedCount}.`;
      }

      await fetchSignatures();
      closeSignDialog();
      setStatusMessage(`Signature saved successfully.${inviteResultMessage}`);
    } catch (error) {
      console.error(error);
      const message =
        error?.response?.data?.message || "Failed to save signature details.";
      setStatusMessage(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl p-6 md:p-10">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Document Signing</h1>
          <p className="mt-1 text-sm text-gray-600">
            Click on any page to open the signing dialog and add invitees.
          </p>
        </div>
      </div>

      {statusMessage && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          {statusMessage}
        </div>
      )}

      {loading && <p className="text-gray-600">Loading document...</p>}

      {pdfUrl && (
        <div className="space-y-6">
          <Document
            file={pdfUrl}
            onLoadSuccess={({ numPages: totalPages }) => setNumPages(totalPages)}
            onLoadError={(error) => console.error("PDF error:", error)}
          >
            {Array.from(new Array(numPages || 0), (_, index) => (
              <div
                key={index}
                className="relative w-fit cursor-crosshair rounded-lg border border-gray-200 bg-white p-2 shadow-sm"
                onClick={(event) => openSignDialog(index + 1, event)}
              >
                <Page pageNumber={index + 1} width={800} />

                {signatures
                  .filter((signature) => signature.page === index + 1)
                  .map((signature) => {
                    const markerText =
                      signature.signature ||
                      signature.signatureDetails?.signerName ||
                      (signature.email ? "Invite" : "Sign");

                    const markerClass =
                      signature.status === "signed"
                        ? "border-green-300 bg-green-100 text-green-700"
                        : "border-blue-300 bg-blue-100 text-blue-700";

                    return (
                      <div
                        key={signature._id}
                        className={`pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded border px-2 py-1 text-xs font-semibold ${markerClass}`}
                        style={{
                          left: `${signature.coordinates.x * 100}%`,
                          top: `${signature.coordinates.y * 100}%`,
                        }}
                      >
                        {markerText}
                      </div>
                    );
                  })}
              </div>
            ))}
          </Document>
        </div>
      )}

      {isDialogOpen && pendingPlacement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-semibold text-gray-900">
              Signature Details
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Page {pendingPlacement.page} at x {pendingPlacement.x.toFixed(2)}, y {pendingPlacement.y.toFixed(2)}
            </p>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Signature text
                </label>
                <input
                  type="text"
                  value={signatureForm.signature}
                  onChange={(event) =>
                    setSignatureForm((prev) => ({
                      ...prev,
                      signature: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  placeholder="Type your signature"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Signer name
                </label>
                <input
                  type="text"
                  value={signatureForm.signerName}
                  onChange={(event) =>
                    setSignatureForm((prev) => ({
                      ...prev,
                      signerName: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  placeholder="Full name"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Signer title
                </label>
                <input
                  type="text"
                  value={signatureForm.signerTitle}
                  onChange={(event) =>
                    setSignatureForm((prev) => ({
                      ...prev,
                      signerTitle: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  placeholder="Designation"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Reason / note
                </label>
                <textarea
                  value={signatureForm.reason}
                  onChange={(event) =>
                    setSignatureForm((prev) => ({
                      ...prev,
                      reason: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  rows={3}
                  placeholder="Optional signing reason"
                />
              </div>
            </div>

            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Invitees</h3>
                <button
                  type="button"
                  onClick={addInvitee}
                  className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200"
                >
                  Add invitee
                </button>
              </div>

              <div className="space-y-3">
                {invitees.map((invitee, index) => (
                  <div key={`invitee-${index}`} className="rounded-lg border border-gray-200 p-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      <input
                        type="email"
                        value={invitee.email}
                        onChange={(event) =>
                          updateInvitee(index, "email", event.target.value)
                        }
                        className="rounded-lg border border-gray-300 px-3 py-2"
                        placeholder="Invitee email"
                      />
                      <input
                        type="text"
                        value={invitee.signerName}
                        onChange={(event) =>
                          updateInvitee(index, "signerName", event.target.value)
                        }
                        className="rounded-lg border border-gray-300 px-3 py-2"
                        placeholder="Invitee name"
                      />
                      <input
                        type="text"
                        value={invitee.signerTitle}
                        onChange={(event) =>
                          updateInvitee(index, "signerTitle", event.target.value)
                        }
                        className="rounded-lg border border-gray-300 px-3 py-2"
                        placeholder="Invitee title"
                      />
                      <input
                        type="text"
                        value={invitee.reason}
                        onChange={(event) =>
                          updateInvitee(index, "reason", event.target.value)
                        }
                        className="rounded-lg border border-gray-300 px-3 py-2"
                        placeholder="Invitee reason"
                      />
                    </div>

                    <div className="mt-2 text-right">
                      <button
                        type="button"
                        onClick={() => removeInvitee(index)}
                        disabled={invitees.length === 1}
                        className="text-sm text-red-600 disabled:cursor-not-allowed disabled:text-gray-400"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeSignDialog}
                className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveSignatureWithDetails}
                disabled={saving}
                className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:bg-blue-300"
              >
                {saving ? "Saving..." : "Save signature"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DocumentViewer;