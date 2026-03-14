import React from 'react'

function FinalizeBar( { finalizeDocument, canFinalize, isDocumentFinalized, finalizing } ) {
  const buttonText = isDocumentFinalized
    ? "Document finalized"
    : finalizing
      ? "Finalizing..."
      : "Finalize signed PDF";

  return (
    <button
      type="button"
      onClick={finalizeDocument}
      disabled={!canFinalize}
      className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
    >
      {buttonText}
    </button>
  )
}

export default FinalizeBar