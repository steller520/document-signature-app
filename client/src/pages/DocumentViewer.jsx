import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { pdfjs } from "react-pdf";
import API from "../api/axios";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import PdfCanvas from "../components/PdfCanvas";
import SignatureSidebar from "../components/SignatureSidebar";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).href;

const EMPTY_INVITEE = {
  email: "",
};

const DEFAULT_SIGNATURE_WIDTH = 0.2;
const DEFAULT_SIGNATURE_HEIGHT = 0.08;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getDownloadFilename(title, isFinalized) {
  const normalizedTitle = String(title || "document").trim() || "document";
  const baseTitle = normalizedTitle.replace(/\.pdf$/i, "");

  return isFinalized ? `${baseTitle}-signed.pdf` : `${baseTitle}.pdf`;
}

function DocumentViewer() {
  const { publicDocToken } = useParams();
  const [pdfUrl, setPdfUrl] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusTone, setStatusTone] = useState("info");
  const [signatures, setSignatures] = useState([]);
  const [documentId, setDocumentId] = useState(null);
  const [documentInfo, setDocumentInfo] = useState(null);
  const [refreshCounter, setRefreshCounter] = useState(0);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [pendingPlacement, setPendingPlacement] = useState(null);
  const [signatureForm, setSignatureForm] = useState({
    signature: "",
    fontFamily: "Helvetica",
    fontSize: 24,
  });
  const [invitees, setInvitees] = useState([EMPTY_INVITEE]);

  useEffect(() => {
    const fetchDocumentInfo = async () => {
      try {
        const { data } = await API.get(`/docs/view/${publicDocToken}`);
        setDocumentInfo(data);
        setDocumentId(data._id);
      } catch (error) {
        console.error("Failed to fetch document info:", error);
        setStatusMessage("Could not load document information.");
        setStatusTone("error");
      }
    };

    if (publicDocToken) {
      fetchDocumentInfo();
    }
  }, [publicDocToken, refreshCounter]);

  useEffect(() => {
    if (documentId) {
      fetchSignatures();
    }
  }, [documentId, refreshCounter]);

  const fetchSignatures = async () => {
    if (!documentId) {
      return;
    }

    try {
      const { data } = await API.get(`/signatures/${documentId}`);
      const sortedSignatures = [...(data || [])].sort((left, right) => {
        const pageDifference = Number(left.page || 0) - Number(right.page || 0);

        if (pageDifference !== 0) {
          return pageDifference;
        }

        return new Date(left.createdAt || 0).getTime() - new Date(right.createdAt || 0).getTime();
      });
      setSignatures(sortedSignatures);
    } catch (error) {
      console.error("Failed to fetch signatures:", error);
      setStatusMessage("Could not load signature markers.");
      setStatusTone("error");
    }
  };

  useEffect(() => {
    let objectUrl = null;

    const fetchDoc = async () => {
      try {
        setLoading(true);
        const [{ data: blobData }] = await Promise.all([
          API.get(`/docs/${publicDocToken}`, {
            responseType: "blob",
          }),
        ]);
        fetchSignatures();

        objectUrl = URL.createObjectURL(blobData);
        setPdfUrl(objectUrl);
      } catch (error) {
        console.error(error);
        setStatusMessage("Could not load document.");
        setStatusTone("error");
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
  }, [publicDocToken, refreshCounter]);

  const pendingSignatureCount = signatures.filter(
    (signature) => signature.status !== "signed",
  ).length;
  const hasAnySignatures = signatures.length > 0;
  const isDocumentFinalized = documentInfo?.status === "signed";
  const canDownloadSignedPdf =
    Boolean(publicDocToken) && isDocumentFinalized && !loading && !downloading;

  const canFinalize =
    Boolean(documentId) &&
    !isDocumentFinalized &&
    hasAnySignatures &&
    pendingSignatureCount === 0 &&
    !loading &&
    !saving &&
    !finalizing;

  const finalizeHelperMessage = isDocumentFinalized
    ? "This document has already been finalized."
    : !hasAnySignatures
      ? "Add at least one signature before finalizing the PDF."
      : pendingSignatureCount > 0
        ? `${pendingSignatureCount} signature${pendingSignatureCount === 1 ? " is" : "s are"} still pending.`
        : "All signatures are complete. You can finalize the signed PDF.";

  const openSignDialog = (page, event) => {
    if (isDocumentFinalized) {
      setStatusMessage("Document is already finalized.");
      setStatusTone("info");
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;

    setPendingPlacement({ x, y, page });
    setSignatureForm({
      signature: "",
      fontFamily: "Helvetica",
      fontSize: 24,
    });
    setInvitees([EMPTY_INVITEE]);
    setStatusMessage("");
    setStatusTone("info");
    setIsDialogOpen(true);
  };

  const closeSignDialog = () => {
    setIsDialogOpen(false);
    setPendingPlacement(null);
  };

  const updateInvitee = (index, field, value) => {
    setInvitees((prev) =>
      prev.map((invitee, inviteeIndex) =>
        inviteeIndex === index
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

      return prev.filter((_, inviteeIndex) => inviteeIndex !== index);
    });
  };

  const saveSignatureWithDetails = async () => {
    if (!documentId) {
      setStatusMessage("Document not ready yet. Please wait and try again.");
      setStatusTone("error");
      return;
    }

    if (!pendingPlacement) {
      return;
    }

    if (!signatureForm.signature.trim()) {
      setStatusMessage("Signature text is required.");
      setStatusTone("error");
      return;
    }

    const coordinates = {
      x: pendingPlacement.x,
      y: pendingPlacement.y,
      width: DEFAULT_SIGNATURE_WIDTH,
      height: DEFAULT_SIGNATURE_HEIGHT,
    };

    const signatureDetails = {
      fontFamily: signatureForm.fontFamily || "Helvetica",
      fontSize: clamp(Number(signatureForm.fontSize || 24), 8, 72),
      signedAt: new Date().toISOString(),
    };

    const cleanedInvitees = invitees
      .map((invitee) => ({
        email: String(invitee.email || "").trim().toLowerCase(),
      }))
      .filter((invitee) => invitee.email);

    try {
      setSaving(true);
      setStatusMessage("");
      setStatusTone("info");
      let reusedExistingSignature = false;

      try {
        await API.post("/signatures", {
          documentId,
          signature: signatureForm.signature.trim(),
          signatureDetails,
          coordinates,
          page: pendingPlacement.page,
        });
      } catch (error) {
        const message = error?.response?.data?.message || "";

        if (message !== "You have already signed this document") {
          throw error;
        }

        reusedExistingSignature = true;
      }

      await API.post("/signatures/sign", {
        documentId,
        signature: signatureForm.signature.trim(),
        signatureDetails,
      });

      let inviteResultMessage = "";

      if (cleanedInvitees.length > 0) {
        const { data } = await API.post("/signatures/invite-batch", {
          documentId,
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
      setStatusMessage(
        `${reusedExistingSignature ? "Signature updated successfully." : "Signature saved successfully."}${inviteResultMessage}`,
      );
      setStatusTone("success");
    } catch (error) {
      console.error(error);
      const message =
        error?.response?.data?.message || "Failed to save signature details.";
      setStatusMessage(message);
      setStatusTone("error");
    } finally {
      setSaving(false);
    }
  };

  const updateSignatureCoordinates = async (
    signatureId,
    page,
    nextCoordinates,
  ) => {
    if (!signatureId || !documentId || isDocumentFinalized) {
      return;
    }

    const previousSignatures = signatures;

    setSignatures((currentSignatures) =>
      currentSignatures.map((signature) =>
        signature._id === signatureId
          ? {
              ...signature,
              page,
              coordinates: {
                ...(signature.coordinates || {}),
                ...nextCoordinates,
              },
            }
          : signature,
      ),
    );

    try {
      await API.patch(`/signatures/${signatureId}/coordinates`, {
        documentId,
        page,
        coordinates: {
          x: clamp(Number(nextCoordinates?.x || 0), 0, 1),
          y: clamp(Number(nextCoordinates?.y || 0), 0, 1),
          width: clamp(Number(nextCoordinates?.width || DEFAULT_SIGNATURE_WIDTH), 0, 1),
          height: clamp(Number(nextCoordinates?.height || DEFAULT_SIGNATURE_HEIGHT), 0, 1),
        },
      });
    } catch (error) {
      console.error("Failed to update signature position:", error);
      setSignatures(previousSignatures);
      setStatusMessage(
        error?.response?.data?.message ||
          "Failed to update signature position.",
      );
      setStatusTone("error");
    }
  };

  const finalizeDocument = async () => {
    if (!documentId) {
      setStatusMessage("Document not ready yet. Please wait and try again.");
      setStatusTone("error");
      return;
    }

    try {
      setFinalizing(true);
      setStatusMessage("");
      setStatusTone("info");

      const { data } = await API.post("/signatures/finalize", { documentId });

      setStatusMessage(
        data?.message || "Document finalized and signed PDF generated.",
      );
      setStatusTone("success");
      setIsDialogOpen(false);
      setPendingPlacement(null);
      setRefreshCounter((currentValue) => currentValue + 1);
    } catch (error) {
      console.error(error);
      const message =
        error?.response?.data?.message || "Failed to finalize the document.";
      setStatusMessage(message);
      setStatusTone("error");
    } finally {
      setFinalizing(false);
    }
  };

  const downloadSignedPdf = async () => {
    if (!publicDocToken) {
      return;
    }

    try {
      setDownloading(true);
      setStatusMessage("");
      setStatusTone("info");

      const { data } = await API.get(`/docs/${publicDocToken}`, {
        responseType: "blob",
      });
      const blob = data instanceof Blob ? data : new Blob([data], {
        type: "application/pdf",
      });
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = downloadUrl;
      anchor.download = getDownloadFilename(documentInfo?.title, true);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(downloadUrl);

      setStatusMessage("Signed PDF download started.");
      setStatusTone("success");
    } catch (error) {
      console.error("Failed to download signed PDF:", error);
      setStatusMessage(
        error?.response?.data?.message || "Failed to download signed PDF.",
      );
      setStatusTone("error");
    } finally {
      setDownloading(false);
    }
  };

  const statusBadgeClassName = isDocumentFinalized
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-amber-200 bg-amber-50 text-amber-700";

  const statusLabel = documentInfo?.status
    ? `${documentInfo.status.charAt(0).toUpperCase()}${documentInfo.status.slice(1)}`
    : "Pending";

  const statusMessageClassName =
    statusTone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : statusTone === "error"
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-blue-200 bg-blue-50 text-blue-700";

  return (
    <div className="mx-auto w-full max-w-375 p-4 md:p-8">
      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Document Signing</h1>
            <p className="mt-1 text-sm text-slate-600">
              {documentInfo?.title ? `Document: ${documentInfo.title}` : ""}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {isDocumentFinalized
                ? "This document has been finalized and is ready to review."
                : "Click on any page to open the signing dialog and add invitees."}
            </p>
          </div>

          <div className="flex max-w-md flex-col items-start gap-3 lg:items-end">
            {documentInfo && (
              <span
                className={`rounded-full border px-3 py-1 text-sm font-semibold ${statusBadgeClassName}`}
              >
                {statusLabel}
              </span>
            )}

            <button
              type="button"
              onClick={finalizeDocument}
              disabled={!canFinalize}
              className="w-full rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300 lg:w-auto"
            >
              {isDocumentFinalized
                ? "Document finalized"
                : finalizing
                  ? "Finalizing..."
                  : "Finalize signed PDF"}
            </button>

            {isDocumentFinalized && (
              <button
                type="button"
                onClick={downloadSignedPdf}
                disabled={!canDownloadSignedPdf}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 lg:w-auto"
              >
                {downloading ? "Preparing download..." : "Download signed PDF"}
              </button>
            )}

            <p className="text-sm text-slate-600 lg:text-right">
              {finalizeHelperMessage}
            </p>
          </div>
        </div>
      </section>

      {statusMessage && (
        <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${statusMessageClassName}`}>
          {statusMessage}
        </div>
      )}

      {loading && (
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Loading document preview...
        </div>
      )}

      <div className={`grid gap-6 ${isDialogOpen && pendingPlacement ? "xl:grid-cols-[minmax(0,1fr)_380px]" : "xl:grid-cols-1"}`}>
        <div className={`min-h-[65vh] ${isDialogOpen && pendingPlacement ? "" : "col-span-full"}`}>
          <PdfCanvas
            pdfUrl={pdfUrl}
            numPages={numPages}
            signatures={signatures}
            onLoadSuccess={({ numPages: totalPages }) => setNumPages(totalPages)}
            onPageClick={openSignDialog}
            isDocumentFinalized={isDocumentFinalized}
            sidebarVisible={isDialogOpen && !!pendingPlacement}
            enableDnd
            onSignatureMove={updateSignatureCoordinates}
          />
        </div>

        <SignatureSidebar
          isDialogOpen={isDialogOpen}
          pendingPlacement={pendingPlacement}
          signatureForm={signatureForm}
          invitees={invitees}
          saving={saving}
          addInvitee={addInvitee}
          removeInvitee={removeInvitee}
          updateInvitee={updateInvitee}
          closeSignDialog={closeSignDialog}
          saveSignatureWithDetails={saveSignatureWithDetails}
          setSignatureForm={setSignatureForm}
        />
      </div>
    </div>
  );
}

export default DocumentViewer;