import { useEffect, useState } from "react";
import API from "../api/axios";
import "./Dashboard.css";

function Dashboard() {
    // State to hold documents
    const [documents, setDocuments] = useState([]);

    // Fetch documents on component mount
    useEffect(() => {
        const fetchDocs = async () => {
            try {
                const { data } = await API.get("/docs");
                setDocuments(data);
            } catch (error) {
                console.error(error);
            }
        };

        fetchDocs();
    }, []);

    // Helper function to get status badge color
    const getStatusColor = (status) => {
        const statusColors = {
            pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
            signed: "bg-green-100 text-green-800 border-green-300",
            rejected: "bg-red-100 text-red-800 border-red-300",
        };
        return statusColors[status] || "bg-gray-100 text-gray-800 border-gray-300";
    };

    // Handle file upload
    const handleUpload = async (e) => {
    const file = e.target.files[0];

    if (!file) return;

    const formData = new FormData();
    formData.append("document", file);

    try {
        const { data } = await API.post("/docs/upload", formData);

        // Add new document to dashboard immediately
        setDocuments((prev) => [data, ...prev]);

    } catch (error) {
        console.error(error);
    }
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

                {/* Upload Button */}
                <div className="mb-8">
                    <label className="cursor-pointer px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-lg transition-all duration-200">
                        + Upload Document
                        <input
                            type="file"
                            accept="application/pdf"
                            className="hidden"
                            onChange={handleUpload}
                        />
                    </label>
                </div>

                {/* Documents Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {documents.length > 0 ? (
                        documents.map((doc) => (
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
                                    <button className="w-full mt-4 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold rounded-lg transition-colors duration-200 border border-blue-200">
                                        View Details
                                    </button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="col-span-full flex flex-col items-center justify-center py-16">
                            <p className="text-xl text-gray-600 mb-4">
                                No documents yet
                            </p>
                            <p className="text-gray-500">
                                Upload your first document to get started
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default Dashboard;