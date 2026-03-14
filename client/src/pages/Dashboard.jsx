import { useEffect, useState } from "react";
import API from "../api/axios";
import { Navigate, NavLink } from "react-router-dom";

function Dashboard() {

    // State to hold documents
    const [documents, setDocuments] = useState([]);
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [filterStatus, setFilterStatus] = useState("all");

    const fetchDocuments = async () => {
        try {
            const { data } = await API.get("/docs");
            setDocuments(data);
        } catch (error) {
            console.error(error);
        }
    };


    // Fetch documents on component mount
    useEffect(() => {
        fetchDocuments();
    }, []);

    const totalDocs = documents.length;
    const pendingDocs = documents.filter(d => d.status === "pending").length;
    const signedDocs = documents.filter(d => d.status === "signed").length;
    const rejectedDocs = documents.filter(d => d.status === "rejected").length;

    // Filter documents based on selected status
    const filteredDocuments = filterStatus === "all" 
        ? documents 
        : documents.filter(d => d.status === filterStatus);

    // Helper function to get status badge color
    const getStatusColor = (status) => {
        const statusColors = {
            pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
            signed: "bg-green-100 text-green-800 border-green-300",
            rejected: "bg-red-100 text-red-800 border-red-300",
        };
        return statusColors[status] || "bg-gray-100 text-gray-800 border-gray-300";
    };

    // Handle file selection
    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.type !== "application/pdf") {
            alert("Please select a PDF file.");
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            alert("File size exceeds 5MB limit.");
            return;
        }
        setSelectedFile(file);
    };

    // Handle file upload
    const handleUpload = async () => {
        if (!selectedFile) return;

        const formData = new FormData();
        formData.append("document", selectedFile);

        try {
            setUploading(true);
            const { data } = await API.post("/docs/upload", formData);

            // Add new document to dashboard immediately
            setDocuments((prev) => [data, ...prev]);
            setSelectedFile(null);
            alert("Document uploaded successfully!");
            console.log("Uploaded Successfully:", data);

        } catch (error) {
            console.error(error);
            alert("Failed to upload document. Please try again.");
        } finally {
            setUploading(false);
        }
    };

    // Clear selected file
    const handleClearSelection = () => {
        setSelectedFile(null);
    };

    return (
        <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 p-8">
            <div className="max-w-6xl mx-auto">
                {/* Header Section */}
                <div className="mb-12">
                    <h1 className="text-4xl font-bold text-gray-900 mb-2">
                        Document Dashboard
                    </h1>
                    <p className="text-gray-600">
                        Manage and sign your documents securely
                    </p>
                </div>

                {/* Upload Section */}
                <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-8 mb-12">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">Upload Documents</h2>

                    {!selectedFile ? (
                        <div className="flex items-center justify-center">
                            <label className="w-full cursor-pointer">
                                <div className="border-2 border-dashed border-blue-400 rounded-lg p-12 text-center hover:bg-blue-50 transition-colors duration-200">
                                    <div className="text-4xl mb-4">📄</div>
                                    <p className="text-lg font-semibold text-gray-800 mb-2">
                                        Click to upload or drag and drop
                                    </p>
                                    <p className="text-gray-600">
                                        PDF files only (Max 5MB)
                                    </p>
                                </div>
                                <input
                                    type="file"
                                    accept="application/pdf"
                                    className="hidden"
                                    onChange={handleFileSelect}
                                />
                            </label>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* File Preview Card */}
                            <div className="bg-linear-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-start gap-4">
                                        <div className="text-4xl">📄</div>
                                        <div>
                                            <h3 className="text-lg font-bold text-gray-900 wrap-break-word">
                                                {selectedFile.name}
                                            </h3>
                                            <p className="text-sm text-gray-600 mt-1">
                                                Size: {(selectedFile.size / 1024).toFixed(2)} KB
                                            </p>
                                            <p className="text-sm text-gray-600">
                                                Type: {selectedFile.type || "PDF"}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-green-600 text-2xl">✓</div>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-4">
                                <button
                                    onClick={handleUpload}
                                    disabled={uploading}
                                    className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold rounded-lg shadow-lg transition-all duration-200 transform hover:scale-105"
                                >
                                    {uploading ? "Uploading..." : "✓ Confirm Upload"}
                                </button>
                                <button
                                    onClick={handleClearSelection}
                                    disabled={uploading}
                                    className="flex-1 px-6 py-3 bg-gray-300 hover:bg-gray-400 disabled:bg-gray-400 text-gray-800 font-semibold rounded-lg transition-all duration-200"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Stats & Filter Bar */}
                <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-12">
                    <div className="flex flex-wrap items-center gap-6 mb-6">
                        <div className="flex gap-8">
                            <div className="flex items-center gap-2">
                                <span className="text-2xl">📄</span>
                                <p className="text-lg font-semibold text-gray-900">Total: <span className="text-blue-600">{totalDocs}</span></p>
                            </div>
                            <div className="flex items-center gap-2 cursor-pointer hover:text-yellow-600" onClick={() => setFilterStatus("pending")}>
                                <span className="text-2xl">⏳</span>
                                <p className="text-lg font-semibold text-gray-900">Pending: <span className="text-yellow-600">{pendingDocs}</span></p>
                            </div>
                            <div className="flex items-center gap-2 cursor-pointer hover:text-green-600" onClick={() => setFilterStatus("signed")}>
                                <span className="text-2xl">✓</span>
                                <p className="text-lg font-semibold text-gray-900">Signed: <span className="text-green-600">{signedDocs}</span></p>
                            </div>
                            <div className="flex items-center gap-2 cursor-pointer hover:text-red-600" onClick={() => setFilterStatus("rejected")}>
                                <span className="text-2xl">✕</span>
                                <p className="text-lg font-semibold text-gray-900">Rejected: <span className="text-red-600">{rejectedDocs}</span></p>
                            </div>
                        </div>
                        <button
                            onClick={fetchDocuments}
                            className="ml-auto px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded transition-all"
                        >
                            🔄
                        </button>
                    </div>

                    <div className="flex gap-2 flex-wrap">
                        <button
                            onClick={() => setFilterStatus("all")}
                            className={`px-3 py-1 text-sm rounded font-semibold transition-all ${
                                filterStatus === "all"
                                    ? "bg-blue-600 text-white"
                                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            }`}
                        >
                            All
                        </button>
                        <button
                            onClick={() => setFilterStatus("pending")}
                            className={`px-3 py-1 text-sm rounded font-semibold transition-all ${
                                filterStatus === "pending"
                                    ? "bg-yellow-500 text-white"
                                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            }`}
                        >
                            Pending
                        </button>
                        <button
                            onClick={() => setFilterStatus("signed")}
                            className={`px-3 py-1 text-sm rounded font-semibold transition-all ${
                                filterStatus === "signed"
                                    ? "bg-green-600 text-white"
                                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            }`}
                        >
                            Signed
                        </button>
                        <button
                            onClick={() => setFilterStatus("rejected")}
                            className={`px-3 py-1 text-sm rounded font-semibold transition-all ${
                                filterStatus === "rejected"
                                    ? "bg-red-600 text-white"
                                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            }`}
                        >
                            Rejected
                        </button>
                    </div>
                </div>

                {/* Documents Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredDocuments.length > 0 ? (
                        filteredDocuments.map((doc) => (
                            <div
                                key={doc._id}
                                className="bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300 overflow-hidden border border-gray-200 hover:border-blue-300"
                            >
                                {/* Card Header */}
                                <div className="bg-linear-to-r from-blue-500 to-indigo-600 p-4 text-white">
                                    <h3 className="text-lg font-bold truncate">
                                        {doc.title}
                                    </h3>
                                </div>

                                {/* Card Content */}
                                <div className="p-6 space-y-4">
                                    {/* Status Badge */}
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-semibold text-gray-600">
                                            Status
                                        </span>
                                        <span
                                            className={`px-3 py-1 text-sm font-semibold rounded-full border ${getStatusColor(
                                                doc.status
                                            )}`}
                                        >
                                            {doc.status.charAt(0).toUpperCase() +
                                                doc.status.slice(1)}
                                        </span>
                                    </div>

                                    {/* Date Info */}
                                    <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                                        <span className="text-sm text-gray-600">
                                            Created
                                        </span>
                                        <span className="text-sm font-medium text-gray-900">
                                            {new Date(
                                                doc.createdAt
                                            ).toLocaleDateString("en-US", {
                                                year: "numeric",
                                                month: "short",
                                                day: "numeric",
                                            })}
                                        </span>
                                    </div>

                                    {/* Action Button */}
                                    <NavLink to={`/docs/${doc.publicDocToken}`} className="block">
                                        <button className="w-full mt-4 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold rounded-lg border border-blue-200">
                                            View Details
                                        </button>
                                    </NavLink>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="col-span-full flex flex-col items-center justify-center py-16">
                            <p className="text-xl text-gray-600 mb-4">
                                {filterStatus === "all" 
                                    ? "No documents yet" 
                                    : `No ${filterStatus} documents`}
                            </p>
                            <p className="text-gray-500">
                                {filterStatus === "all"
                                    ? "Upload your first document to get started"
                                    : `Try a different filter or upload a new document`}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default Dashboard;