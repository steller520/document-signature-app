import { useEffect, useState } from "react";

function Dashboard() {

    const [documents, setDocuments] = useState([]);

    useEffect(() => {
        // Fetch documents from API
        const fetchDocs = async () => {
            try {
                const {data} = await API.get("/documents");
                setDocuments(data);
            } catch (error) {
                console.error("Error fetching documents:", error);
            }
        }
        fetchDocs();
    }, []);

    return (
        <div>
            <h1 className="text-3xl font-bold underline">
                Dashboard
            </h1>

            {
                documents.length === 0 ? (
                    <p>No documents found.</p>
                ) : (
                    <>
                        {documents.map((doc) => (
                            <div key={doc._id} className="border p-4 mb-4">
                                <h2 className="text-xl font-semibold">{doc.status}</h2>
                            </div>
                        ))}
                    </>
                )
            }
        </div>
    )
}

export default Dashboard;