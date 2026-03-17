import React from "react";

const SIGNATURE_FONT_OPTIONS = [
  { value: "Helvetica", label: "Helvetica" },
  { value: "Helvetica-Oblique", label: "Helvetica Oblique" },
  { value: "Times-Roman", label: "Times Roman" },
  { value: "Times-Italic", label: "Times Italic" },
  { value: "Courier", label: "Courier" },
  { value: "Courier-Oblique", label: "Courier Oblique" },
];

function normalizeFontSize(value) {
  const parsedSize = Number(value);

  if (!Number.isFinite(parsedSize)) {
    return 24;
  }

  return Math.min(Math.max(parsedSize, 8), 72);
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

function SignatureSidebar({
  isDialogOpen,
  pendingPlacement,
  signatureForm,
  invitees,
  saving,
  addInvitee,
  removeInvitee,
  updateInvitee,
  closeSignDialog,
  saveSignatureWithDetails,
  setSignatureForm,
}) {
  return (
    <>
      {isDialogOpen && pendingPlacement && (
        <aside className="sticky top-4 w-95 min-w-[320px] max-w-105 max-h-[calc(100vh-2rem)] border-l border-gray-200 bg-white flex flex-col p-0 shadow-lg rounded-lg">
          <div className="flex-1 overflow-y-auto px-6 py-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Signature Details</h2>
            <p className="text-xs text-gray-500 mb-4">
              Page <span className="font-semibold">{pendingPlacement.page}</span> at x{" "}
              <span className="font-mono">{pendingPlacement.x.toFixed(2)}</span>, y{" "}
              <span className="font-mono">{pendingPlacement.y.toFixed(2)}</span>
            </p>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Signature text *</label>
                <input
                  type="text"
                  value={signatureForm.signature}
                  onChange={(event) =>
                    setSignatureForm((prev) => ({
                      ...prev,
                      signature: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-200"
                  placeholder="Type your signature"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Signature font</label>
                <select
                  value={signatureForm.fontFamily || "Helvetica"}
                  onChange={(event) =>
                    setSignatureForm((prev) => ({
                      ...prev,
                      fontFamily: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-200"
                >
                  {SIGNATURE_FONT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Signature size</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="8"
                    max="72"
                    step="1"
                    value={normalizeFontSize(signatureForm.fontSize)}
                    onChange={(event) =>
                      setSignatureForm((prev) => ({
                        ...prev,
                        fontSize: normalizeFontSize(event.target.value),
                      }))
                    }
                    className="w-full accent-blue-600"
                  />
                  <span className="w-14 text-right text-sm text-gray-600">
                    {normalizeFontSize(signatureForm.fontSize)}px
                  </span>
                </div>
                <p
                  className="mt-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-gray-800"
                  style={{
                    fontFamily: getFontPreviewFamily(signatureForm.fontFamily),
                    fontStyle:
                      String(signatureForm.fontFamily || "").toLowerCase().includes("italic") ||
                      String(signatureForm.fontFamily || "").toLowerCase().includes("oblique")
                        ? "italic"
                        : "normal",
                    fontSize: `${normalizeFontSize(signatureForm.fontSize)}px`,
                  }}
                >
                  {signatureForm.signature?.trim() || "Signature preview"}
                </p>
              </div>
            </div>

            <hr className="my-6 border-gray-200" />

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Invitees</h3>
                <button
                  type="button"
                  onClick={addInvitee}
                  className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 focus:ring-2 focus:ring-blue-200"
                >
                  Add invitee
                </button>
              </div>

              <div className="space-y-3">
                {invitees.map((invitee, index) => (
                  <div key={`invitee-${index}`} className="rounded-lg border border-gray-200 p-3 bg-gray-50">
                    <div className="flex gap-3 items-center">
                      <input
                        type="email"
                        value={invitee.email}
                        onChange={(event) => updateInvitee(index, "email", event.target.value)}
                        className="flex-1 rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-200"
                        placeholder="Invitee email"
                      />
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

            <div className="mt-8 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeSignDialog}
                className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-blue-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveSignatureWithDetails}
                disabled={saving}
                className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:bg-blue-300 focus:ring-2 focus:ring-blue-200"
              >
                {saving ? "Saving..." : "Save signature"}
              </button>
            </div>
          </div>
        </aside>
      )}
    </>
  );
}

export default SignatureSidebar;