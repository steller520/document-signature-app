import { useEffect, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { useParams } from "react-router-dom";
import API from "../api/axios";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).href;

function PublicSign() {
  const { token } = useParams();
  const [invite, setInvite] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [signature, setSignature] = useState("");
  const [loadingInvite, setLoadingInvite] = useState(true);
  const [loadingPdf, setLoadingPdf] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusTone, setStatusTone] = useState("neutral");

  useEffect(() => {
    const fetchInvite = async () => {
      try {
        setLoadingInvite(true);
        const { data } = await API.get(`/signatures/public-sign/${token}`);
        setInvite(data);
        setSignature(data.signature || data.signatureDetails?.signerName || "");
      } catch (error) {
        const message =
          error?.response?.data?.message || "Could not load this signature request.";
        setStatusMessage(message);
        setStatusTone("error");
      } finally {
        setLoadingInvite(false);
      }
    };

    if (token) {
      fetchInvite();
    }
  }, [token]);

  useEffect(() => {
    let objectUrl = null;

    const fetchDocument = async () => {
      try {
        setLoadingPdf(true);
        const { data } = await API.get(`/signatures/public-sign/${token}/document`, {
          responseType: "blob",
        });
        objectUrl = URL.createObjectURL(data);
        setPdfUrl(objectUrl);
      } catch (error) {
        const message =
          error?.response?.data?.message || "Could not load the document preview.";
        setStatusMessage(message);
        setStatusTone("error");
      } finally {
        setLoadingPdf(false);
      }
    };

    if (token) {
      fetchDocument();
    }

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [token]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    const trimmedSignature = signature.trim();

    if (!trimmedSignature) {
      setStatusMessage("Signature text is required.");
      setStatusTone("error");
      return;
    }

    try {
      setSubmitting(true);
      setStatusMessage("");

      await API.post(`/signatures/public-sign/${token}`, {
        signature: trimmedSignature,
      });

      setInvite((currentInvite) =>
        currentInvite
          ? {
              ...currentInvite,
              signature: trimmedSignature,
              status: "signed",
            }
          : currentInvite,
      );
      setStatusMessage("Document signed successfully.");
      setStatusTone("success");
    } catch (error) {
      const message =
        error?.response?.data?.message || "Unable to submit your signature.";
      setStatusMessage(message);
      setStatusTone("error");
    } finally {
      setSubmitting(false);
    }
  };

  const statusClassName =
    statusTone === "success"
      ? "border-green-200 bg-green-50 text-green-700"
      : statusTone === "error"
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6 md:p-10">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
              Public signature request
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">
              {invite?.document?.title || "Document signature"}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Review the document and sign in the marked area below.
            </p>
          </div>

          {invite && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <div>Requested for: {invite.email || "Guest signer"}</div>
              <div>Status: {invite.status}</div>
            </div>
          )}
        </div>

        {statusMessage && (
          <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${statusClassName}`}>
            {statusMessage}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Document preview</h2>

          {(loadingInvite || loadingPdf) && (
            <p className="text-sm text-slate-600">Loading document...</p>
          )}

          {pdfUrl && (
            <Document
              file={pdfUrl}
              onLoadSuccess={({ numPages: totalPages }) => setNumPages(totalPages)}
              onLoadError={() => {
                setStatusMessage("Could not render the PDF preview.");
                setStatusTone("error");
              }}
            >
              <div className="space-y-6">
                {Array.from(new Array(numPages || 0), (_, index) => {
                  const pageNumber = index + 1;
                  const isSignaturePage = invite?.page === pageNumber;
                  const markerLabel =
                    invite?.status === "signed"
                      ? invite.signature || "Signed"
                      : "Sign here";

                  return (
                    <div
                      key={pageNumber}
                      className="relative w-fit rounded-xl border border-slate-200 bg-slate-50 p-2"
                    >
                      <Page pageNumber={pageNumber} width={800} />

                      {isSignaturePage && invite?.coordinates && (
                        <div
                          className={`pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border px-3 py-1 text-xs font-semibold ${
                            invite.status === "signed"
                              ? "border-green-300 bg-green-100 text-green-700"
                              : "border-blue-300 bg-blue-100 text-blue-700"
                          }`}
                          style={{
                            left: `${invite.coordinates.x * 100}%`,
                            top: `${invite.coordinates.y * 100}%`,
                          }}
                        >
                          {markerLabel}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Document>
          )}
        </section>

        <aside className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Complete signature</h2>
          <p className="mt-2 text-sm text-slate-600">
            The signature will be applied to page {invite?.page || "-"} at the saved position.
          </p>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Signature text
              </label>
              <input
                type="text"
                value={signature}
                onChange={(event) => setSignature(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900"
                placeholder="Type your full name"
                disabled={invite?.status === "signed" || loadingInvite}
              />
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <div>Name: {invite?.signatureDetails?.signerName || "Not provided"}</div>
              <div>Title: {invite?.signatureDetails?.signerTitle || "Not provided"}</div>
              <div>Reason: {invite?.signatureDetails?.reason || "Not provided"}</div>
            </div>

            <button
              type="submit"
              disabled={submitting || invite?.status === "signed" || loadingInvite}
              className="w-full rounded-xl bg-blue-600 px-4 py-2.5 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              {invite?.status === "signed"
                ? "Already signed"
                : submitting
                  ? "Submitting..."
                  : "Sign document"}
            </button>
          </form>
        </aside>
      </div>
    </div>
  );
}

export default PublicSign;