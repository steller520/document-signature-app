import { useEffect, useMemo, useRef, useState } from "react";
import { Document, Page } from "react-pdf";

const DEFAULT_SIGNATURE_WIDTH = 0.2;
const DEFAULT_SIGNATURE_HEIGHT = 0.08;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalizeFontSize(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 24;
  }

  return clamp(parsed, 8, 72);
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

function getSignatureLabel(signature) {
  if (!signature) {
    return "Signature";
  }

  if (signature.signature?.trim()) {
    return signature.signature.trim();
  }

  if (signature.signatureDetails?.signerName?.trim()) {
    return signature.signatureDetails.signerName.trim();
  }

  if (signature.email?.trim()) {
    return signature.email.trim();
  }

  return signature.status === "signed" ? "Signed" : "Pending signature";
}

function getNormalizedCoordinates(signature) {
  const width = clamp(
    Number(signature?.coordinates?.width || DEFAULT_SIGNATURE_WIDTH),
    0.08,
    0.6,
  );
  const height = clamp(
    Number(signature?.coordinates?.height || DEFAULT_SIGNATURE_HEIGHT),
    0.04,
    0.2,
  );
  const minCenterX = width / 2;
  const maxCenterX = 1 - width / 2;
  const minCenterY = height / 2;
  const maxCenterY = 1 - height / 2;
  const centerX = clamp(Number(signature?.coordinates?.x || 0.5), minCenterX, maxCenterX);
  const centerY = clamp(Number(signature?.coordinates?.y || 0.5), minCenterY, maxCenterY);

  return {
    x: centerX,
    y: centerY,
    width,
    height,
  };
}

function PdfCanvas({
  pdfUrl,
  numPages,
  signatures,
  onLoadSuccess,
  onPageClick,
  isDocumentFinalized,
  sidebarVisible,
  enableDnd,
  onSignatureMove,
}) {
  const containerRef = useRef(null);
  const suppressClickUntilRef = useRef(0);
  const [availableWidth, setAvailableWidth] = useState(0);
  const [draggingSignatureId, setDraggingSignatureId] = useState(null);
  const [draggingOverPage, setDraggingOverPage] = useState(null);
  const [renderError, setRenderError] = useState("");

  const canDragMarkers =
    enableDnd !== false && Boolean(onSignatureMove) && !isDocumentFinalized;

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const resizeObserver = new ResizeObserver((entries) => {
      const nextWidth = entries?.[0]?.contentRect?.width || 0;
      setAvailableWidth(nextWidth);
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  const pageWidth = useMemo(() => {
    if (!availableWidth) {
      return sidebarVisible ? 900 : 1200;
    }

    const horizontalPadding = sidebarVisible ? 26 : 20;
    const maxWidth = sidebarVisible ? 950 : 1400;
    const calculated = Math.floor(availableWidth - horizontalPadding);

    return clamp(calculated, 320, maxWidth);
  }, [availableWidth, sidebarVisible]);

  const signaturesByPage = useMemo(() => {
    const pageMap = new Map();

    for (const signature of signatures || []) {
      const page = Number(signature?.page || 1);
      const existing = pageMap.get(page) || [];
      existing.push(signature);
      pageMap.set(page, existing);
    }

    return pageMap;
  }, [signatures]);

  const suppressPageClick = (durationMs = 250) => {
    suppressClickUntilRef.current = Date.now() + durationMs;
  };

  const isPageClickSuppressed = () => Date.now() < suppressClickUntilRef.current;

  const handleDocumentLoadSuccess = (payload) => {
    setRenderError("");
    onLoadSuccess?.(payload);
  };

  const handleDocumentLoadError = () => {
    setRenderError("Could not render the PDF preview.");
  };

  const handlePageClick = (pageNumber, event) => {
    if (isDocumentFinalized || isPageClickSuppressed()) {
      return;
    }

    onPageClick?.(pageNumber, event);
  };

  const handleMarkerDragStart = (event, signature) => {
    if (!canDragMarkers || !signature?._id) {
      return;
    }

    setDraggingSignatureId(signature._id);
    suppressPageClick(400);

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", signature._id);
      event.dataTransfer.setData("application/signature-id", signature._id);
    }
  };

  const handleMarkerDragEnd = () => {
    setDraggingSignatureId(null);
    setDraggingOverPage(null);
    suppressPageClick(250);
  };

  const handlePageDragOver = (event, pageNumber) => {
    if (!canDragMarkers) {
      return;
    }

    event.preventDefault();

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }

    setDraggingOverPage(pageNumber);
  };

  const handlePageDrop = (event, pageNumber) => {
    if (!canDragMarkers) {
      return;
    }

    event.preventDefault();

    const signatureId =
      event.dataTransfer?.getData("application/signature-id") ||
      event.dataTransfer?.getData("text/plain") ||
      draggingSignatureId;

    if (!signatureId) {
      setDraggingSignatureId(null);
      setDraggingOverPage(null);
      suppressPageClick(250);
      return;
    }

    const signature = (signatures || []).find((item) => item._id === signatureId);

    if (!signature) {
      setDraggingSignatureId(null);
      setDraggingOverPage(null);
      suppressPageClick(250);
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();

    if (!rect.width || !rect.height) {
      setDraggingSignatureId(null);
      setDraggingOverPage(null);
      suppressPageClick(250);
      return;
    }

    const normalized = getNormalizedCoordinates(signature);
    const minCenterX = normalized.width / 2;
    const maxCenterX = 1 - normalized.width / 2;
    const minCenterY = normalized.height / 2;
    const maxCenterY = 1 - normalized.height / 2;
    const centerX = clamp((event.clientX - rect.left) / rect.width, minCenterX, maxCenterX);
    const centerY = clamp((event.clientY - rect.top) / rect.height, minCenterY, maxCenterY);

    onSignatureMove?.(signatureId, pageNumber, {
      x: centerX,
      y: centerY,
      width: normalized.width,
      height: normalized.height,
    });

    setDraggingSignatureId(null);
    setDraggingOverPage(null);
    suppressPageClick(350);
  };

  return (
    <section ref={containerRef} className="h-full w-full rounded-2xl border border-slate-200 bg-white p-3 shadow-sm md:p-4">
      {!pdfUrl && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Document preview will appear here.
        </div>
      )}

      {renderError && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {renderError}
        </div>
      )}

      {pdfUrl && (
        <Document
          file={pdfUrl}
          onLoadSuccess={handleDocumentLoadSuccess}
          onLoadError={handleDocumentLoadError}
        >
          <div className="space-y-6">
            {Array.from(new Array(numPages || 0), (_, index) => {
              const pageNumber = index + 1;
              const pageSignatures = isDocumentFinalized
                ? []
                : signaturesByPage.get(pageNumber) || [];

              return (
                <div
                  key={pageNumber}
                  className={`mx-auto w-fit rounded-xl border border-slate-200 bg-slate-50 p-2 ${draggingOverPage === pageNumber ? "ring-2 ring-blue-300" : ""}`}
                >
                  <div
                    className="relative inline-block"
                    onClick={(event) => handlePageClick(pageNumber, event)}
                    onDragOver={(event) => handlePageDragOver(event, pageNumber)}
                    onDrop={(event) => handlePageDrop(event, pageNumber)}
                    onDragLeave={() => {
                      if (draggingOverPage === pageNumber) {
                        setDraggingOverPage(null);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if ((event.key === "Enter" || event.key === " ") && !isDocumentFinalized) {
                        event.preventDefault();
                        handlePageClick(pageNumber, event);
                      }
                    }}
                  >
                    <Page pageNumber={pageNumber} width={pageWidth} />

                    {pageSignatures.map((signature) => {
                      const normalized = getNormalizedCoordinates(signature);
                      const markerLabel = getSignatureLabel(signature);
                      const markerToneClass =
                        signature.status === "signed"
                          ? "border-emerald-300 bg-emerald-100 text-emerald-800"
                          : "border-amber-300 bg-amber-100 text-amber-800";

                      return (
                        <div
                          key={signature._id}
                          draggable={canDragMarkers}
                          onDragStart={(event) => handleMarkerDragStart(event, signature)}
                          onDragEnd={handleMarkerDragEnd}
                          onClick={(event) => event.stopPropagation()}
                          onMouseDown={(event) => event.stopPropagation()}
                          role="button"
                          tabIndex={0}
                          className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-lg border px-2 py-1 shadow-sm ${markerToneClass} ${canDragMarkers ? "cursor-grab active:cursor-grabbing" : "cursor-default"} ${draggingSignatureId === signature._id ? "opacity-60" : "opacity-100"}`}
                          style={{
                            left: `${normalized.x * 100}%`,
                            top: `${normalized.y * 100}%`,
                            width: `${normalized.width * 100}%`,
                            minHeight: `${normalized.height * 100}%`,
                            fontFamily: getFontPreviewFamily(
                              signature?.signatureDetails?.fontFamily,
                            ),
                            fontStyle: getFontPreviewStyle(
                              signature?.signatureDetails?.fontFamily,
                            ),
                            fontSize: `${normalizeFontSize(signature?.signatureDetails?.fontSize)}px`,
                          }}
                        >
                          <div className="truncate text-center font-medium leading-tight">
                            {markerLabel}
                          </div>
                        </div>
                      );
                    })}

                    <span className="pointer-events-none absolute right-2 top-2 rounded bg-black/60 px-2 py-0.5 text-xs font-semibold text-white">
                      Page {pageNumber}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </Document>
      )}
    </section>
  );
}

export default PdfCanvas;
