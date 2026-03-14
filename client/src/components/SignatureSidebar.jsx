import React from 'react'

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
  setSignatureForm
}) {
    return (
        <>
            {isDialogOpen && pendingPlacement && (
                <aside className="w-[380px] min-w-[320px] max-w-[420px] h-full border-l border-gray-200 bg-white flex flex-col p-0 shadow-lg">
                    <div className="flex-1 overflow-y-auto px-6 py-8">
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Signature Details</h2>
                        <p className="text-xs text-gray-500 mb-4">
                            Page <span className="font-semibold">{pendingPlacement.page}</span> at x <span className="font-mono">{pendingPlacement.x.toFixed(2)}</span>, y <span className="font-mono">{pendingPlacement.y.toFixed(2)}</span>
                        </p>

                        <div className="space-y-4">
                            <div>
                                <label className="mb-1 block text-sm font-medium text-gray-700">Signature text</label>
                                <input
                                    type="text"
                                    value={signatureForm.signature}
                                    onChange={(event) => setSignatureForm((prev) => ({ ...prev, signature: event.target.value }))}
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-200"
                                    placeholder="Type your signature"
                                />
                            </div>
                            <div className="flex gap-3">
                                <div className="flex-1">
                                    <label className="mb-1 block text-sm font-medium text-gray-700">Signer name</label>
                                    <input
                                        type="text"
                                        value={signatureForm.signerName}
                                        onChange={(event) => setSignatureForm((prev) => ({ ...prev, signerName: event.target.value }))}
                                        className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-200"
                                        placeholder="Full name"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="mb-1 block text-sm font-medium text-gray-700">Signer title</label>
                                    <input
                                        type="text"
                                        value={signatureForm.signerTitle}
                                        onChange={(event) => setSignatureForm((prev) => ({ ...prev, signerTitle: event.target.value }))}
                                        className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-200"
                                        placeholder="Designation"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-medium text-gray-700">Reason / note</label>
                                <textarea
                                    value={signatureForm.reason}
                                    onChange={(event) => setSignatureForm((prev) => ({ ...prev, reason: event.target.value }))}
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-200"
                                    rows={3}
                                    placeholder="Optional signing reason"
                                />
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
                                        <div className="grid gap-3 grid-cols-2">
                                            <input
                                                type="email"
                                                value={invitee.email}
                                                onChange={(event) => updateInvitee(index, "email", event.target.value)}
                                                className="rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-200"
                                                placeholder="Invitee email"
                                            />
                                            <input
                                                type="text"
                                                value={invitee.signerName}
                                                onChange={(event) => updateInvitee(index, "signerName", event.target.value)}
                                                className="rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-200"
                                                placeholder="Invitee name"
                                            />
                                            <input
                                                type="text"
                                                value={invitee.signerTitle}
                                                onChange={(event) => updateInvitee(index, "signerTitle", event.target.value)}
                                                className="rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-200"
                                                placeholder="Invitee title"
                                            />
                                            <input
                                                type="text"
                                                value={invitee.reason}
                                                onChange={(event) => updateInvitee(index, "reason", event.target.value)}
                                                className="rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-200"
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
  )
}

export default SignatureSidebar