import { useEffect, useMemo, useRef, useState } from "react";
import { DragDropProvider, useDraggable, useDroppable } from "@dnd-kit/react";
import { Document, Page } from "react-pdf";

const DEFAULT_SIGNATURE_WIDTH = 0.2;
const DEFAULT_SIGNATURE_HEIGHT = 0.08;
const SIGNATURE_STACK_GAP = 0.015;

let textMeasureCanvas;

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

  return signature.status === "signed" ? "Signed" : "Awaiting signature";
}

function getSignatureClusterKey(signature) {
  return [
    signature.page,
    Number(signature.coordinates?.x || 0).toFixed(4),
    Number(signature.coordinates?.y || 0).toFixed(4),
  ].join(":");
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

function getPreviewCoordinates(signature, stackIndex = 0) {
  const normalized = getNormalizedCoordinates(signature);
  const stackStep = normalized.height + SIGNATURE_STACK_GAP;
  const minCenterY = normalized.height / 2;
  const maxCenterY = 1 - normalized.height / 2;
  const canStackDown = normalized.y + stackIndex * stackStep <= maxCenterY;
  const canStackUp = normalized.y - stackIndex * stackStep >= minCenterY;
  const stackDirection = canStackDown ? 1 : canStackUp ? -1 : normalized.y > 0.5 ? -1 : 1;

  return {
    ...normalized,
    y: clamp(
      normalized.y + stackIndex * stackStep * stackDirection,
      minCenterY,
      maxCenterY,
    ),
  };
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

function getFittedMarkerFontSize(label, signature, pageWidth, coordinates) {
  if (!label?.trim()) {
    return 12;
  }

  let fontSize = normalizeFontSize(signature?.signatureDetails?.fontSize || 24);
  const markerWidth = pageWidth * coordinates.width;
  const maxTextWidth = Math.max(markerWidth * 0.95, 24);
  const canvas = getSharedMeasurementCanvas();
  const context = canvas?.getContext("2d");

  if (!context) {
    return fontSize;
  }

  const fontStyle = getFontPreviewStyle(signature?.signatureDetails?.fontFamily);
  const fontFamily = getFontPreviewFamily(signature?.signatureDetails?.fontFamily);
  context.font = `${fontStyle} ${fontSize}px ${fontFamily}`;

  const textWidth = context.measureText(label.trim()).width;

  if (textWidth > maxTextWidth) {
    fontSize = clamp(fontSize * (maxTextWidth / textWidth), 8, 72);
  }

  return fontSize;
}

function getClientCoordinates(operation, nativeEvent) {
  const operationX = Number(operation?.position?.current?.x);
  const operationY = Number(operation?.position?.current?.y);

  if (Number.isFinite(operationX) && Number.isFinite(operationY)) {
    return { x: operationX, y: operationY };
  }

  if (nativeEvent && typeof nativeEvent === "object") {
    if ("clientX" in nativeEvent && "clientY" in nativeEvent) {
      return {
        x: nativeEvent.clientX,
        y: nativeEvent.clientY,
      };
    }

    const touch = nativeEvent.changedTouches?.[0] || nativeEvent.touches?.[0];

    if (touch) {
      return {
        x: touch.clientX,
        y: touch.clientY,
      };
    }
  }

  return null;
}

function SignatureMarker({
  signature,
  canDragMarkers,
  pageWidth,
  pageDimensions,
  coordinates,
}) {
  const isSigned = signature.status === "signed";
  const markerLabel = getSignatureLabel(signature);
  const markerToneClass =
    isSigned
      ? "border-slate-300 bg-white/95 text-slate-900 shadow-[0_12px_30px_rgba(15,23,42,0.12)]"
      : "border-amber-300/90 border-dashed bg-amber-50/95 text-amber-900 shadow-[0_10px_24px_rgba(217,119,6,0.16)]";
  const markerStatusClass = isSigned
    ? "bg-emerald-100 text-emerald-700"
    : "bg-amber-100 text-amber-700";
  const fittedFontSize = signature.signature?.trim()
    ? getFittedMarkerFontSize(markerLabel, signature, pageWidth, coordinates)
    : 12;
  const markerPixelWidth = Math.max(
    Number(pageDimensions?.width || pageWidth || 0) * coordinates.width,
    24,
  );
  const markerPixelHeight = Math.max(
    Number(pageDimensions?.height || 0) * coordinates.height,
    18,
  );
  const markerTextStyle = signature.signature?.trim()
    ? {
        fontFamily: getFontPreviewFamily(signature?.signatureDetails?.fontFamily),
        fontStyle: getFontPreviewStyle(signature?.signatureDetails?.fontFamily),
        fontSize: `${fittedFontSize}px`,
      }
    : {
        fontSize: "12px",
      };
  const { ref, isDragging } = useDraggable({
    id: `signature:${signature._id}`,
    data: {
      signatureId: signature._id,
    },
    disabled: !canDragMarkers,
    feedback: "move",
  });

  return (
    <div
      ref={ref}
      onClick={(event) => {
        event.stopPropagation();
      }}
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
      title={canDragMarkers ? "Drag to reposition signature" : "Signature position"}
      className={`absolute -translate-x-1/2 -translate-y-1/2 overflow-visible rounded-xl border select-none backdrop-blur-[2px] ${markerToneClass} ${canDragMarkers ? "cursor-grab active:cursor-grabbing transition-[box-shadow,border-color,background-color,opacity] duration-150 hover:shadow-lg" : "cursor-default"} ${isDragging ? "z-20 opacity-70" : "z-10 opacity-100"}`}
      style={{
        left: `${coordinates.x * 100}%`,
        top: `${coordinates.y * 100}%`,
        width: isDragging ? `${markerPixelWidth}px` : `${coordinates.width * 100}%`,
        height: isDragging ? `${markerPixelHeight}px` : `${coordinates.height * 100}%`,
        minWidth: isDragging ? `${markerPixelWidth}px` : undefined,
        maxWidth: isDragging ? `${markerPixelWidth}px` : undefined,
        minHeight: isDragging ? `${markerPixelHeight}px` : undefined,
        maxHeight: isDragging ? `${markerPixelHeight}px` : undefined,
        touchAction: canDragMarkers ? "none" : "auto",
        willChange: canDragMarkers ? "transform" : "auto",
        boxSizing: "border-box",
      }}
    >
      <div className="pointer-events-none absolute left-0 top-0 flex -translate-y-[calc(100%+6px)] items-center gap-1.5">
        <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] ${markerStatusClass}`}>
          {isSigned ? "Signed" : "Pending"}
        </span>
        {canDragMarkers && (
          <span className="rounded-full bg-slate-900/5 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Drag
          </span>
        )}
      </div>

      <div className="pointer-events-none flex h-full items-center justify-center px-2">
        <div className="w-full whitespace-nowrap text-center font-medium leading-none" style={markerTextStyle}>
          {markerLabel}
        </div>
      </div>
    </div>
  );
}

function PdfPageDropZone({
  pageNumber,
  pageWidth,
  pageMarkerEntries,
  isDocumentFinalized,
  canDragMarkers,
  onPageClick,
}) {
  const pageContainerRef = useRef(null);
  const [pageDimensions, setPageDimensions] = useState({ width: 0, height: 0 });
  const { ref, isDropTarget } = useDroppable({
    id: `page:${pageNumber}`,
    data: {
      pageNumber,
    },
    disabled: isDocumentFinalized,
  });

  useEffect(() => {
    if (!pageContainerRef.current) {
      return;
    }

    const resizeObserver = new ResizeObserver((entries) => {
      const nextRect = entries?.[0]?.contentRect;

      if (!nextRect) {
        return;
      }

      setPageDimensions({
        width: nextRect.width,
        height: nextRect.height,
      });
    });

    resizeObserver.observe(pageContainerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div
      className={`mx-auto w-fit rounded-xl border border-slate-200 bg-slate-50 p-2 ${isDropTarget ? "ring-2 ring-blue-300" : ""}`}
    >
      <div
        ref={(node) => {
          ref(node);
          pageContainerRef.current = node;
        }}
        className="relative inline-block"
        onClick={(event) => onPageClick(pageNumber, event)}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onPageClick(pageNumber, event);
          }
        }}
      >
        <Page pageNumber={pageNumber} width={pageWidth} />

        {pageMarkerEntries.map(({ signature, coordinates }) => (
          <SignatureMarker
            key={signature._id}
            signature={signature}
            canDragMarkers={canDragMarkers}
            pageWidth={pageWidth}
            pageDimensions={pageDimensions}
            coordinates={coordinates}
          />
        ))}

        <span className="pointer-events-none absolute right-2 top-2 rounded bg-black/60 px-2 py-0.5 text-xs font-semibold text-white">
          Page {pageNumber}
        </span>
      </div>
    </div>
  );
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
  const [renderError, setRenderError] = useState("");
  const [zoom, setZoom] = useState(1);

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
      return (sidebarVisible ? 900 : 1200) * zoom;
    }

    const horizontalPadding = sidebarVisible ? 26 : 20;
    const maxWidth = sidebarVisible ? 950 : 1400;
    const calculated = Math.floor(availableWidth - horizontalPadding);

    return clamp(calculated, 320, maxWidth) * zoom;
  }, [availableWidth, sidebarVisible, zoom]);

  const signaturesByPage = useMemo(() => {
    const pageMap = new Map();
    const clusterCounts = new Map();

    for (const signature of signatures || []) {
      const page = Number(signature?.page || 1);
      const clusterKey = getSignatureClusterKey(signature);
      const stackIndex = clusterCounts.get(clusterKey) || 0;
      clusterCounts.set(clusterKey, stackIndex + 1);
      const existing = pageMap.get(page) || [];
      existing.push({
        signature,
        coordinates: getPreviewCoordinates(signature, stackIndex),
      });
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

  const handleDragStart = (event) => {
    const signatureId = event?.operation?.source?.data?.signatureId;

    if (!signatureId) {
      return;
    }

    suppressPageClick(400);
  };

  const handleDragEnd = (event) => {
    suppressPageClick(350);

    if (event?.canceled || !canDragMarkers) {
      return;
    }

    const signatureId = event?.operation?.source?.data?.signatureId;
    const pageNumber = Number(event?.operation?.target?.data?.pageNumber);
    const targetElement = event?.operation?.target?.element;

    if (!signatureId || !Number.isFinite(pageNumber) || !targetElement) {
      return;
    }

    const signature = (signatures || []).find((item) => item._id === signatureId);

    if (!signature) {
      return;
    }

    const rect = targetElement.getBoundingClientRect();

    if (!rect.width || !rect.height) {
      return;
    }

    const clientCoordinates = getClientCoordinates(
      event.operation,
      event.nativeEvent,
    );

    if (!clientCoordinates) {
      return;
    }

    const normalized = getNormalizedCoordinates(signature);
    const minCenterX = normalized.width / 2;
    const maxCenterX = 1 - normalized.width / 2;
    const minCenterY = normalized.height / 2;
    const maxCenterY = 1 - normalized.height / 2;
    const centerX = clamp(
      (clientCoordinates.x - rect.left) / rect.width,
      minCenterX,
      maxCenterX,
    );
    const centerY = clamp(
      (clientCoordinates.y - rect.top) / rect.height,
      minCenterY,
      maxCenterY,
    );

    onSignatureMove?.(signatureId, pageNumber, {
      x: centerX,
      y: centerY,
      width: normalized.width,
      height: normalized.height,
    });
  };

  const handleZoomIn = () => {
    setZoom((currentZoom) => clamp(currentZoom + 0.2, 0.5, 3));
  };

  const handleZoomOut = () => {
    setZoom((currentZoom) => clamp(currentZoom - 0.2, 0.5, 3));
  };

  const handleZoomReset = () => {
    setZoom(1);
  };

  return (
    <section ref={containerRef} className="h-full w-full rounded-2xl border border-slate-200 bg-white p-3 shadow-sm md:p-4">
      {!pdfUrl && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Document preview will appear here.
        </div>
      )}

      {pdfUrl && (
        <div className="mb-4 flex items-center justify-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2">
          <button
            type="button"
            onClick={handleZoomOut}
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
            onClick={handleZoomIn}
            disabled={zoom >= 3}
            className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            title="Zoom in"
          >
            +
          </button>
          
          <button
            type="button"
            onClick={handleZoomReset}
            className="ml-2 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-100"
            title="Reset zoom"
          >
            Reset
          </button>
        </div>
      )}

      {renderError && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {renderError}
        </div>
      )}

      {pdfUrl && (
        <DragDropProvider onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <Document
            file={pdfUrl}
            onLoadSuccess={handleDocumentLoadSuccess}
            onLoadError={handleDocumentLoadError}
          >
            <div className="space-y-6">
              {Array.from(new Array(numPages || 0), (_, index) => {
                const pageNumber = index + 1;
                const pageMarkerEntries = isDocumentFinalized
                  ? []
                  : signaturesByPage.get(pageNumber) || [];

                return (
                  <PdfPageDropZone
                    key={pageNumber}
                    pageNumber={pageNumber}
                    pageWidth={pageWidth}
                    pageMarkerEntries={pageMarkerEntries}
                    isDocumentFinalized={isDocumentFinalized}
                    canDragMarkers={canDragMarkers}
                    onPageClick={handlePageClick}
                  />
                );
              })}
            </div>
          </Document>
        </DragDropProvider>
      )}
    </section>
  );
}

export default PdfCanvas;
