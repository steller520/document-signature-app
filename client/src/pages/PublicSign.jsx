import { useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { useParams } from "react-router-dom";
import API from "../api/axios";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";

const DEFAULT_SIGNATURE_WIDTH = 0.2;
const DEFAULT_SIGNATURE_HEIGHT = 0.08;

const SIGNATURE_FONT_OPTIONS = [
  { value: "Helvetica", label: "Helvetica" },
  { value: "Helvetica-Oblique", label: "Helvetica Oblique" },
  { value: "Times-Roman", label: "Times Roman" },
  { value: "Times-Italic", label: "Times Italic" },
  { value: "Courier", label: "Courier" },
  { value: "Courier-Oblique", label: "Courier Oblique" },
];

let textMeasureCanvas;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalizeFontSize(value) {
  const parsedSize = Number(value);

  if (!Number.isFinite(parsedSize)) {
    return 24;
  }

  return clamp(parsedSize, 8, 72);
}

function getFontPreviewFamily(fontFamily) {
  switch (fontFamily) {
    case "Times-Roman":
    case "Times-Italic":
    case "TimesRoman":
    case "TimesRomanItalic":
      return '"Times New Roman", Times, serif';
    case "Courier-Oblique":
    case "Courier":
    case "CourierOblique":
      return '"Courier New", Courier, monospace';
    default:
      return "Helvetica, Arial, sans-serif";
  }
}

function getFontPreviewStyle(fontFamily) {
  const normalized = String(fontFamily || "").toLowerCase();
  return normalized.includes("italic") || normalized.includes("oblique")
    ? "italic"
    : "normal";
}

function getSharedMeasurementCanvas() {
  if (typeof document === "undefined") {
    return null;
  }

  if (!textMeasureCanvas) {
    textMeasureCanvas = document.createElement("canvas");
  }

  return textMeasureCanvas;
}

function getPreviewMarkerFontSize({
  label,
  fontFamily,
  fontSize,
  coordinates,
  pageMetrics,
  fallbackPageWidth,
}) {
  const trimmedLabel = String(label || "").trim();

  if (!trimmedLabel) {
    return 12;
  }

  const renderedPageWidth = Number(pageMetrics?.width || fallbackPageWidth || 0);
  const originalPageWidth = Number(pageMetrics?.originalWidth || 0);
  const zoomScale =
    renderedPageWidth > 0 && originalPageWidth > 0
      ? renderedPageWidth / originalPageWidth
      : 1;
  let resolvedFontSize = normalizeFontSize(fontSize) * zoomScale;
  const canvas = getSharedMeasurementCanvas();
  const context = canvas?.getContext("2d");
  const maxTextWidth = Math.max(renderedPageWidth * coordinates.width * 0.92, 24);

  if (!context || !renderedPageWidth) {
    return Math.max(resolvedFontSize, 8);
  }

  context.font = `${getFontPreviewStyle(fontFamily)} ${resolvedFontSize}px ${getFontPreviewFamily(fontFamily)}`;

  const measuredTextWidth = context.measureText(trimmedLabel).width;

  if (measuredTextWidth > maxTextWidth) {
    resolvedFontSize = resolvedFontSize * (maxTextWidth / measuredTextWidth);
  }

  return Math.max(resolvedFontSize, 8);
}

function getNormalizedCoordinates(record) {
  const width = clamp(
    Number(record?.coordinates?.width || DEFAULT_SIGNATURE_WIDTH),
    0.08,
    0.6,
  );
  const height = clamp(
    Number(record?.coordinates?.height || DEFAULT_SIGNATURE_HEIGHT),
    0.04,
    0.2,
  );
  const minCenterX = width / 2;
  const maxCenterX = 1 - width / 2;
  const minCenterY = height / 2;
  const maxCenterY = 1 - height / 2;

  return {
    x: clamp(Number(record?.coordinates?.x || 0.5), minCenterX, maxCenterX),
    y: clamp(Number(record?.coordinates?.y || 0.5), minCenterY, maxCenterY),
    width,
    height,
  };
}

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).href;

function PublicSign() {
  const { token } = useParams();
  const previewContainerRef = useRef(null);
  const [invite, setInvite] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [signature, setSignature] = useState("");
  const [signatureFontFamily, setSignatureFontFamily] = useState("Helvetica");
  const [signatureFontSize, setSignatureFontSize] = useState(24);
  const [loadingInvite, setLoadingInvite] = useState(true);
  const [loadingPdf, setLoadingPdf] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusTone, setStatusTone] = useState("neutral");
  const [zoom, setZoom] = useState(1);
  const [previewWidth, setPreviewWidth] = useState(0);
  const [renderError, setRenderError] = useState("");
  const [pageMetricsByNumber, setPageMetricsByNumber] = useState({});

  useEffect(() => {
    if (!previewContainerRef.current) {
      return;
    }

    const resizeObserver = new ResizeObserver((entries) => {
      const nextWidth = entries?.[0]?.contentRect?.width || 0;
      setPreviewWidth(nextWidth);
    });

    resizeObserver.observe(previewContainerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    const fetchInvite = async () => {
      try {
        setLoadingInvite(true);
        const { data } = await API.get(`/signatures/public-sign/${token}`);
        setInvite(data);
        setSignature(data.signature || "");
        setSignatureFontFamily(data.signatureDetails?.fontFamily || "Helvetica");
        setSignatureFontSize(normalizeFontSize(data.signatureDetails?.fontSize || 24));
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
        setRenderError("");
        const { data } = await API.get(`/signatures/public-sign/${token}/document`, {
          responseType: "blob",
        });
        objectUrl = URL.createObjectURL(data);
        setPdfUrl(objectUrl);
      } catch (error) {
        setRenderError("Could not load the document preview.");
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
        signatureDetails: {
          fontFamily: signatureFontFamily,
          fontSize: normalizeFontSize(signatureFontSize),
          signedAt: new Date().toISOString(),
        },
      });

      setInvite((currentInvite) =>
        currentInvite
          ? {
              ...currentInvite,
              signature: trimmedSignature,
              signatureDetails: {
                ...(currentInvite.signatureDetails || {}),
                fontFamily: signatureFontFamily,
                fontSize: normalizeFontSize(signatureFontSize),
                signedAt: new Date().toISOString(),
              },
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

  const pageWidth = useMemo(() => {
    if (!previewWidth) {
      return 760 * zoom;
    }

    const calculated = Math.floor(previewWidth - 24);
    return clamp(calculated, 280, 1100) * zoom;
  }, [previewWidth, zoom]);

  const markerCoordinates = getNormalizedCoordinates(invite);
  const previewSignatureLabel =
    invite?.status === "signed"
      ? invite.signature || "Signed"
      : signature.trim() || "Sign here";
  const previewFontFamily = invite?.status === "signed"
    ? invite?.signatureDetails?.fontFamily || signatureFontFamily
    : signatureFontFamily;
  const previewFontSize = invite?.status === "signed"
    ? normalizeFontSize(invite?.signatureDetails?.fontSize || signatureFontSize)
    : normalizeFontSize(signatureFontSize);
  const invitePageNumber = Number(invite?.page || 1);
  const invitePageMetrics = pageMetricsByNumber[invitePageNumber];
  const previewMarkerFontSize = getPreviewMarkerFontSize({
    label: previewSignatureLabel,
    fontFamily: previewFontFamily,
    fontSize: previewFontSize,
    coordinates: markerCoordinates,
    pageMetrics: invitePageMetrics,
    fallbackPageWidth: pageWidth,
  });

  const handlePageRenderSuccess = (pageNumber, page) => {
    const nextMetrics = {
      width: Number(page?.width || 0),
      height: Number(page?.height || 0),
      originalWidth: Number(page?.originalWidth || 0),
      originalHeight: Number(page?.originalHeight || 0),
    };

    setPageMetricsByNumber((currentMetrics) => {
      const previousMetrics = currentMetrics[pageNumber];

      if (
        previousMetrics &&
        previousMetrics.width === nextMetrics.width &&
        previousMetrics.height === nextMetrics.height &&
        previousMetrics.originalWidth === nextMetrics.originalWidth &&
        previousMetrics.originalHeight === nextMetrics.originalHeight
      ) {
        return currentMetrics;
      }

      return {
        ...currentMetrics,
        [pageNumber]: nextMetrics,
      };
    });
  };

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

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section ref={previewContainerRef} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Document preview</h2>
          <p className="mb-4 text-sm text-slate-600">
            Review the document and use the controls on the right to preview the exact signature font and size before submitting.
          </p>

          {(loadingInvite || loadingPdf) && (
            <p className="text-sm text-slate-600">Loading document...</p>
          )}

          {renderError && !loadingPdf && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {renderError}
            </div>
          )}

          {pdfUrl && (
            <>
              <div className="mb-4 flex items-center justify-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.5, z - 0.2))}
                  disabled={zoom <= 0.5}
                  className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                  title="Zoom out"
                >
                  −
                </button>
                
                <input
                  type="range"
                  min="0.5"
                  max="3"
                  step="0.1"
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-32 accent-blue-600"
                  title="Zoom level"
                />
                
                <span className="min-w-16 text-center text-sm font-medium text-slate-700">
                  {Math.round(zoom * 100)}%
                </span>
                
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(3, z + 0.2))}
                  disabled={zoom >= 3}
                  className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                  title="Zoom in"
                >
                  +
                </button>
                
                <button
                  type="button"
                  onClick={() => setZoom(1)}
                  className="ml-2 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-100"
                  title="Reset zoom"
                >
                  Reset
                </button>
              </div>

              <Document
                file={pdfUrl}
                onLoadSuccess={({ numPages: totalPages }) => setNumPages(totalPages)}
                onLoadError={() => {
                  setRenderError("Could not render the PDF preview.");
                  setStatusMessage("Could not render the PDF preview.");
                  setStatusTone("error");
                }}
              >
                <div className="space-y-6 overflow-x-auto pb-2">
                  {Array.from(new Array(numPages || 0), (_, index) => {
                    const pageNumber = index + 1;
                    const isSignaturePage = invite?.page === pageNumber;
                    const markerToneClass =
                      invite?.status === "signed"
                        ? "border-green-300 bg-green-100 text-green-700"
                        : "border-blue-300 bg-blue-100 text-blue-700";

                    return (
                      <div
                        key={pageNumber}
                        className="relative mx-auto w-fit rounded-xl border border-slate-200 bg-slate-50 p-2"
                      >
                        <div className="relative inline-block">
                          <Page
                            pageNumber={pageNumber}
                            width={pageWidth}
                            onRenderSuccess={(page) => handlePageRenderSuccess(pageNumber, page)}
                          />

                          {isSignaturePage && invite?.coordinates && (
                            <div
                              className={`pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg border shadow-sm ${markerToneClass}`}
                              style={{
                                left: `${markerCoordinates.x * 100}%`,
                                top: `${markerCoordinates.y * 100}%`,
                                width: `${markerCoordinates.width * 100}%`,
                                height: `${markerCoordinates.height * 100}%`,
                              }}
                            >
                              <div className="flex h-full items-center justify-center px-2">
                                <div
                                  className="w-full truncate text-center font-medium leading-none"
                                  style={{
                                    fontFamily: getFontPreviewFamily(previewFontFamily),
                                    fontStyle: getFontPreviewStyle(previewFontFamily),
                                    fontSize: `${previewMarkerFontSize}px`,
                                  }}
                                >
                                  {previewSignatureLabel}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Document>
            </>
          )}

          {!loadingPdf && !pdfUrl && !renderError && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Document preview is currently unavailable.
            </div>
          )}
        </section>

        <aside className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:sticky lg:top-6 lg:self-start">
          <h2 className="text-lg font-semibold text-slate-900">Complete signature</h2>
          <p className="mt-2 text-sm text-slate-600">
            The signature will be applied to page {invite?.page || "-"} at the saved position. You can adjust the font and size before submitting.
          </p>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Signature text *
              </label>
              <input
                type="text"
                value={signature}
                onChange={(event) => setSignature(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900"
                placeholder="Type your signature"
                disabled={invite?.status === "signed" || loadingInvite}
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Signature font
              </label>
              <select
                value={signatureFontFamily}
                onChange={(event) => setSignatureFontFamily(event.target.value)}
                disabled={invite?.status === "signed" || loadingInvite}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900"
              >
                {SIGNATURE_FONT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Signature size on page
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="8"
                  max="72"
                  step="1"
                  value={normalizeFontSize(signatureFontSize)}
                  onChange={(event) => setSignatureFontSize(normalizeFontSize(event.target.value))}
                  disabled={invite?.status === "signed" || loadingInvite}
                  className="w-full accent-blue-600"
                />
                <span className="w-14 text-right text-sm text-slate-600">
                  {normalizeFontSize(signatureFontSize)}px
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
                Live preview
              </p>
              <p
                className="text-slate-900"
                style={{
                  fontFamily: getFontPreviewFamily(signatureFontFamily),
                  fontStyle: getFontPreviewStyle(signatureFontFamily),
                  fontSize: `${normalizeFontSize(signatureFontSize)}px`,
                }}
              >
                {signature.trim() || "Signature preview"}
              </p>
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