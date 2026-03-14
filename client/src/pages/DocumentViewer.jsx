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

const DEFAULT_SIGNATURE_WIDTH = 0.2;
const DEFAULT_SIGNATURE_HEIGHT = 0.08;
const SIGNATURE_STACK_GAP = 0.015;

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function getSignatureClusterKey(signature) {
    return [
        Number(signature.coordinates?.x || 0).toFixed(4),
        Number(signature.coordinates?.y || 0).toFixed(4),
    ].join(":");
}

function getMarkerPosition(signature, stackIndex) {
    const widthNormalized = clamp(
        Number(signature.coordinates?.width || DEFAULT_SIGNATURE_WIDTH),
        0.08,
        0.6,
    );
    const heightNormalized = clamp(
        Number(signature.coordinates?.height || DEFAULT_SIGNATURE_HEIGHT),
        0.04,
        0.2,
    );
    const minCenterX = widthNormalized / 2;
    const maxCenterX = 1 - widthNormalized / 2;
    const minCenterY = heightNormalized / 2;
    const maxCenterY = 1 - heightNormalized / 2;
    const centerXNormalized = clamp(
        Number(signature.coordinates?.x || 0),
        minCenterX,
        maxCenterX,
    );
    const baseCenterYNormalized = clamp(
        Number(signature.coordinates?.y || 0),
        minCenterY,
        maxCenterY,
    );
    const stackStep = heightNormalized + SIGNATURE_STACK_GAP;
    const canStackDown =
        baseCenterYNormalized + stackIndex * stackStep <= maxCenterY;
    const canStackUp =
        baseCenterYNormalized - stackIndex * stackStep >= minCenterY;
    const stackDirection = canStackDown ? 1 : canStackUp ? -1 : baseCenterYNormalized > 0.5 ? -1 : 1;
    const centerYNormalized = clamp(
        baseCenterYNormalized + stackIndex * stackStep * stackDirection,
        minCenterY,
        maxCenterY,
    );

    return {
        left: `${centerXNormalized * 100}%`,
        top: `${centerYNormalized * 100}%`,
    };
}

function DocumentViewer() {
    const { publicDocToken } = useParams();
    const [pdfUrl, setPdfUrl] = useState(null);
    const [numPages, setNumPages] = useState(0);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [finalizing, setFinalizing] = useState(false);
    const [statusMessage, setStatusMessage] = useState("");
    const [signatures, setSignatures] = useState([]);
    const [documentId, setDocumentId] = useState(null);
    const [documentInfo, setDocumentInfo] = useState(null);
    const [refreshCounter, setRefreshCounter] = useState(0);

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [pendingPlacement, setPendingPlacement] = useState(null);
    const [signatureForm, setSignatureForm] = useState({
        signature: "",
        signerName: "",
        signerTitle: "",
        reason: "",
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
            return;
        }

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
        if(!documentId) {
            setStatusMessage("Document not ready yet. Please wait and try again.");
            console.log(documentId);
            return;
        }

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
            width: DEFAULT_SIGNATURE_WIDTH,
            height: DEFAULT_SIGNATURE_HEIGHT,
        };
        const signatureDetails = {
            signerName: signatureForm.signerName.trim(),
            signerTitle: signatureForm.signerTitle.trim(),
            reason: signatureForm.reason.trim(),
            signedAt: new Date().toISOString(),
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
        } catch (error) {
            console.error(error);
            const message =
                error?.response?.data?.message || "Failed to save signature details.";
            setStatusMessage(message);
        } finally {
            setSaving(false);
        }
    };

    const finalizeDocument = async () => {
        if (!documentId) {
            setStatusMessage("Document not ready yet. Please wait and try again.");
            return;
        }

        try {
            setFinalizing(true);
            setStatusMessage("");

            const { data } = await API.post("/signatures/finalize", { documentId });

            setStatusMessage(
                data?.message || "Document finalized and signed PDF generated.",
            );
            setIsDialogOpen(false);
            setPendingPlacement(null);
            setRefreshCounter((currentValue) => currentValue + 1);
        } catch (error) {
            console.error(error);
            const message =
                error?.response?.data?.message || "Failed to finalize the document.";
            setStatusMessage(message);
        } finally {
            setFinalizing(false);
        }
    };

    const statusBadgeClassName = isDocumentFinalized
        ? "border-green-200 bg-green-50 text-green-700"
        : "border-yellow-200 bg-yellow-50 text-yellow-700";
    const statusLabel = documentInfo?.status
        ? `${documentInfo.status.charAt(0).toUpperCase()}${documentInfo.status.slice(1)}`
        : "Pending";

    return (
        <div className="mx-auto max-w-6xl p-6 md:p-10">
            <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Document Signing</h1>
                    <p className="mt-1 text-sm text-gray-600">
                        {isDocumentFinalized
                            ? "This document has been finalized and is ready to review."
                            : "Click on any page to open the signing dialog and add invitees."}
                    </p>
                </div>

                <div className="flex max-w-sm flex-col items-end gap-3">
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
                        className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
                    >
                        {isDocumentFinalized
                            ? "Document finalized"
                            : finalizing
                                ? "Finalizing..."
                                : "Finalize signed PDF"}
                    </button>

                    <p className="text-right text-sm text-gray-600">
                        {finalizeHelperMessage}
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
                        {Array.from(new Array(numPages || 0), (_, index) => {
                            const pageNumber = index + 1;
                            const pageSignatures = signatures.filter((signature) => signature.page === pageNumber);
                            const signatureClusterCounts = new Map();

                            return (
                                <div
                                    key={index}
                                    className={`relative w-fit rounded-lg border border-gray-200 bg-white p-2 shadow-sm ${
                                        isDocumentFinalized ? "cursor-default" : "cursor-crosshair"
                                    }`}
                                    onClick={(event) => openSignDialog(pageNumber, event)}
                                >
                                    <Page pageNumber={pageNumber} width={800} />

                                    {pageSignatures.map((signature) => {
                                        const markerText =
                                            signature.signature ||
                                            signature.signatureDetails?.signerName ||
                                            (signature.email ? "Invite" : "Sign");

                                        const markerClass =
                                            signature.status === "signed"
                                                ? "border-green-300 bg-green-100 text-green-700"
                                                : "border-blue-300 bg-blue-100 text-blue-700";
                                        const clusterKey = getSignatureClusterKey(signature);
                                        const stackIndex = signatureClusterCounts.get(clusterKey) || 0;
                                        signatureClusterCounts.set(clusterKey, stackIndex + 1);
                                        const markerPosition = getMarkerPosition(signature, stackIndex);

                                        return (
                                            <div
                                                key={signature._id}
                                                className={`pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded border px-2 py-1 text-xs font-semibold ${markerClass}`}
                                                style={markerPosition}
                                            >
                                                {markerText}
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}
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
                                disabled={saving }
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