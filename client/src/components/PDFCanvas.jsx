import React, { useRef } from 'react'
import { Document, Page } from "react-pdf";

const DEFAULT_SIGNATURE_WIDTH = 0.2;
const DEFAULT_SIGNATURE_HEIGHT = 0.08;
const SIGNATURE_STACK_GAP = 0.015;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
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
      return 'Helvetica, Arial, sans-serif';
  }
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
    0.6
  );

  const heightNormalized = clamp(
    Number(signature.coordinates?.height || DEFAULT_SIGNATURE_HEIGHT),
    0.04,
    0.2
  );

  const minCenterX = widthNormalized / 2;
  const maxCenterX = 1 - widthNormalized / 2;
  const minCenterY = heightNormalized / 2;
  const maxCenterY = 1 - heightNormalized / 2;

  const centerXNormalized = clamp(
    Number(signature.coordinates?.x || 0),
    minCenterX,
    maxCenterX
  );

  const baseCenterYNormalized = clamp(
    Number(signature.coordinates?.y || 0),
    minCenterY,
    maxCenterY
  );

  const stackStep = heightNormalized + SIGNATURE_STACK_GAP;

  const centerYNormalized = clamp(
    baseCenterYNormalized + stackIndex * stackStep,
    minCenterY,
    maxCenterY
  );

  return {
    left: `${centerXNormalized * 100}%`,
    top: `${centerYNormalized * 100}%`,
  };
}

function PDFCanvas( {
  pdfUrl,
  numPages,
  signatures,
  onLoadSuccess,
  onPageClick,
  isDocumentFinalized,
  sidebarVisible,
  enableDnd,
  onSignatureMove
} ) {
  const suppressPageClickUntilRef = useRef(0);

  const handlePageClick = (pageNumber, event) => {
    if (Date.now() < suppressPageClickUntilRef.current) {
      return;
    }

    if (!isDocumentFinalized && typeof onPageClick === "function") {
      onPageClick(pageNumber, event);
    }
  };

  // When sidebar is hidden, PDFCanvas should take full width/height
  const containerClass = sidebarVisible
    ? "flex flex-col h-full w-full overflow-auto bg-gray-50 rounded-lg border border-gray-200 shadow-md p-4"
    : "flex flex-col h-[80vh] w-full overflow-auto bg-gray-50 rounded-lg border border-gray-200 shadow-md p-4 xl:col-span-full";

  return (
    <div className={containerClass}>
      {pdfUrl ? (
        <div className="flex flex-col gap-8 items-center justify-center">
          <Document
            file={pdfUrl}
            onLoadSuccess={onLoadSuccess}
            onLoadError={(error) => console.error("PDF error:", error)}
          >
            {Array.from(new Array(numPages || 0), (_, index) => {
              const pageNumber = index + 1;
              const pageSignatures = signatures.filter((signature) => signature.page === pageNumber);
              const signatureClusterCounts = new Map();
              const visibleSignatures = isDocumentFinalized ? [] : pageSignatures;

              return (
                <div
                  id={enableDnd ? `pdf-page-${pageNumber}` : undefined}
                  key={index}
                  className={`relative mx-auto my-4 w-fit rounded-lg border border-gray-300 bg-white p-4 shadow-lg ${
                    isDocumentFinalized ? "cursor-default" : "cursor-crosshair hover:ring-2 hover:ring-blue-200"
                  }`}
                  onClick={(event) => handlePageClick(pageNumber, event)}
                  style={{ minWidth: 320, maxWidth: 820, padding: 0 }}
                >
                  <Page pageNumber={pageNumber} width={800} />

                  {visibleSignatures.map((signature) => {
                    const markerText =
                      signature.signature ||
                      signature.signatureDetails?.signerName ||
                      (signature.email ? "Invite" : "Sign");

                    const markerClass =
                      signature.status === "signed"
                        ? "border-green-400 bg-green-100 text-green-700 shadow-md"
                        : "border-blue-400 bg-blue-100 text-blue-700 shadow-md";
                    const clusterKey = getSignatureClusterKey(signature);
                    const stackIndex = signatureClusterCounts.get(clusterKey) || 0;
                    signatureClusterCounts.set(clusterKey, stackIndex + 1);
                    const markerPosition = getMarkerPosition(signature, stackIndex);
                    const markerFont = signature.signatureDetails?.fontFamily || "Helvetica";
                    const markerFontSize = clamp(
                      Number(signature.signatureDetails?.fontSize || 16),
                      8,
                      72,
                    );
                    const isItalicFont = String(markerFont).toLowerCase().includes("italic") || String(markerFont).toLowerCase().includes("oblique");

                    // Make marker draggable if not finalized
                    if (!isDocumentFinalized) {
                      return (
                        <div
                          key={signature._id}
                          data-signature-marker="true"
                          className={`absolute -translate-x-1/2 -translate-y-1/2 rounded border px-3 py-1 text-xs font-semibold ${markerClass} transition-all duration-150 cursor-grab bg-blue-500 text-white`}
                          style={{
                            ...markerPosition,
                            zIndex: 100 + stackIndex,
                            minWidth: "80px",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                            fontFamily: getFontPreviewFamily(markerFont),
                            fontStyle: isItalicFont ? "italic" : "normal",
                            fontSize: `${markerFontSize}px`,
                            lineHeight: 1.2,
                          }}
                          draggable
                          onClick={(event) => event.stopPropagation()}
                          onDragStart={e => {
                            e.stopPropagation();
                            suppressPageClickUntilRef.current = Date.now() + 400;
                            e.dataTransfer.setData("signatureId", signature._id);
                          }}
                          onDragEnd={e => {
                            e.stopPropagation();
                            suppressPageClickUntilRef.current = Date.now() + 400;
                            const rect = e.currentTarget.parentElement.getBoundingClientRect();
                            const widthNormalized = clamp(Number(signature.coordinates?.width || DEFAULT_SIGNATURE_WIDTH), 0.08, 0.6);
                            const heightNormalized = clamp(Number(signature.coordinates?.height || DEFAULT_SIGNATURE_HEIGHT), 0.04, 0.2);
                            const minCenterX = widthNormalized / 2;
                            const maxCenterX = 1 - widthNormalized / 2;
                            const minCenterY = heightNormalized / 2;
                            const maxCenterY = 1 - heightNormalized / 2;

                            const centerXNormalized = clamp((e.clientX - rect.left) / rect.width, minCenterX, maxCenterX);
                            const centerYNormalized = clamp((e.clientY - rect.top) / rect.height, minCenterY, maxCenterY);

                            if (typeof onSignatureMove === "function") {
                              onSignatureMove(signature._id, pageNumber, {
                                x: centerXNormalized,
                                y: centerYNormalized,
                                width: widthNormalized,
                                height: heightNormalized,
                              });
                            }
                          }}
                        >
                          {markerText}
                        </div>
                      );
                    }

                    return (
                      <div
                        key={signature._id}
                        className={`pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded border px-3 py-1 text-xs font-semibold ${markerClass} transition-all duration-150`}
                        style={{
                          ...markerPosition,
                          zIndex: 10 + stackIndex,
                          minWidth: "80px",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                          fontFamily: getFontPreviewFamily(markerFont),
                          fontStyle: isItalicFont ? "italic" : "normal",
                          fontSize: `${markerFontSize}px`,
                          lineHeight: 1.2,
                        }}
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
      ) : (
        <div className="flex items-center justify-center h-full text-gray-400 text-lg">No PDF loaded</div>
      )}
    </div>
  );
}

export default PDFCanvas;