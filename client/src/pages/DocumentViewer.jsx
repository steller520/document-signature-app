import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { Document, Page } from "react-pdf";
import API from "../api/axios";

function DocumentViewer() {
  const { id } = useParams();

  const [pdfUrl, setPdfUrl] = useState(null);
  const [numPages, setNumPages] = useState(null);

  useEffect(() => {
    const fetchDoc = async () => {
      try {
        const { data } = await API.get(`/docs/${id}`);
        setPdfUrl(`http://localhost:5000/${data.filePath}`);
      } catch (error) {
        console.error(error);
      }
    };

    fetchDoc();
  }, [id]);

  return (
    <div className="p-10">

      <h1 className="text-2xl font-bold mb-6">
        Document Viewer
      </h1>

      {pdfUrl && (
        <Document
          file={pdfUrl}
          onLoadSuccess={({ numPages }) => setNumPages(numPages)}
        >
          {Array.from(new Array(numPages), (el, index) => (
            <Page
              key={index}
              pageNumber={index + 1}
              width={800}
            />
          ))}
        </Document>
      )}

    </div>
  );
}

export default DocumentViewer;