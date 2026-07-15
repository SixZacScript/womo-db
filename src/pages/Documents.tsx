import { useState, useEffect } from "react";
import { mongoService } from "../services/mongodb";
import { DocumentViewer } from "../components/DocumentViewer";
import { CustomQueryEditor } from "../components/CustomQueryEditor";
import { useTabContext } from "../contexts/TabContext";
import { AIQueryButton } from "../components/AIQueryButton";

interface DocumentsProps {
  selectedDb: string;
  selectedCollection: string;
  tabId: string;
}

export function Documents({ selectedDb, selectedCollection, tabId }: DocumentsProps) {
  const { tabs, updateTabState } = useTabContext();
  const [documents, setDocuments] = useState<any[]>([]);
  const [query, setQuery] = useState("{}");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  // Load initial state from tab (only on mount or when tabId changes)
  useEffect(() => {
    const tab = tabs.find(t => t.id === tabId);
    if (tab?.state) {
      if (tab.state.query) setQuery(tab.state.query);
      if (tab.state.page) setCurrentPage(tab.state.page);
      if (tab.state.pageSize) setPageSize(tab.state.pageSize);
    }
  }, [tabId]); // Remove 'tabs' from dependency

  useEffect(() => {
    if (selectedCollection) {
      loadDocuments();
    }
  }, [selectedCollection]);

  async function loadDocuments() {
    try {
      setError("");
      setQuery("{}");
      setCurrentPage(1);
      const docs = await mongoService.getDocuments(selectedDb, selectedCollection, pageSize);
      setDocuments(docs);

      // Get total count
      const stats = await mongoService.getCollectionStats(selectedDb, selectedCollection);
      setTotalCount(stats.count || 0);
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleQuery() {
    try {
      setError("");
      setCurrentPage(1);

      // Normalize shell syntax to JSON
      let normalizedQuery = query.trim();

      // Convert ObjectId("...") to {"$oid": "..."}
      normalizedQuery = normalizedQuery.replace(/ObjectId\("([^"]+)"\)/g, '{"$oid":"$1"}');

      // Convert ISODate("...") to {"$date": "..."}
      normalizedQuery = normalizedQuery.replace(/ISODate\("([^"]+)"\)/g, '{"$date":"$1"}');

      // Quote unquoted field names (e.g., {_id:... -> {"_id":...)
      normalizedQuery = normalizedQuery.replace(/\{(\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '{$1"$2":');

      const docs = await mongoService.queryDocuments(selectedDb, selectedCollection, normalizedQuery, pageSize, 0);
      setDocuments(docs);

      // Get accurate count from collection stats
      const stats = await mongoService.getCollectionStats(selectedDb, selectedCollection);
      setTotalCount(stats.count || docs.length);
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleSaveDocument(docId: string, newContent: string) {
    try {
      setError("");
      await mongoService.updateDocument(selectedDb, selectedCollection, docId, newContent);
      // Refresh current page
      const normalizedQuery = query.trim()
        .replace(/ObjectId\("([^"]+)"\)/g, '{"$oid":"$1"}')
        .replace(/ISODate\("([^"]+)"\)/g, '{"$date":"$1"}')
        .replace(/\{(\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '{$1"$2":');
      const skip = (currentPage - 1) * pageSize;
      const docs = await mongoService.queryDocuments(selectedDb, selectedCollection, normalizedQuery, pageSize, skip);
      setDocuments(docs);
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleDeleteDocument(docId: string) {
    if (!confirm("Delete this document?")) return;
    try {
      setError("");
      await mongoService.deleteDocument(selectedDb, selectedCollection, docId);
      // Refresh current page
      const normalizedQuery = query.trim()
        .replace(/ObjectId\("([^"]+)"\)/g, '{"$oid":"$1"}')
        .replace(/ISODate\("([^"]+)"\)/g, '{"$date":"$1"}')
        .replace(/\{(\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '{$1"$2":');
      const skip = (currentPage - 1) * pageSize;
      const docs = await mongoService.queryDocuments(selectedDb, selectedCollection, normalizedQuery, pageSize, skip);
      setDocuments(docs);
    } catch (e) {
      setError(String(e));
    }
  }

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 2000);
  }

  // Sync state to tab context
  useEffect(() => {
    updateTabState(tabId, {
      query,
      page: currentPage,
      pageSize,
    });
  }, [query, currentPage, pageSize, tabId, updateTabState]);

  // Re-fetch documents when page or pageSize changes (but not query)
  useEffect(() => {
    if (!selectedCollection) return;

    const fetchPage = async () => {
      try {
        setError("");
        let normalizedQuery = query.trim();
        normalizedQuery = normalizedQuery.replace(/ObjectId\("([^"]+)"\)/g, '{"$oid":"$1"}');
        normalizedQuery = normalizedQuery.replace(/ISODate\("([^"]+)"\)/g, '{"$date":"$1"}');
        normalizedQuery = normalizedQuery.replace(/\{(\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '{$1"$2":');

        const skip = (currentPage - 1) * pageSize;
        const docs = await mongoService.queryDocuments(selectedDb, selectedCollection, normalizedQuery, pageSize, skip);
        setDocuments(docs);
      } catch (e) {
        setError(String(e));
      }
    };

    fetchPage();
  }, [currentPage, pageSize]);

  function extractFieldNames(docs: any[]): string[] {
    const fieldSet = new Set<string>();

    function traverse(obj: any, prefix: string = "") {
      if (!obj || typeof obj !== "object") return;

      for (const key in obj) {
        const fullPath = prefix ? `${prefix}.${key}` : key;
        fieldSet.add(fullPath);

        const value = obj[key];
        if (value && typeof value === "object" && !Array.isArray(value) && !value.$oid && !value.$date) {
          traverse(value, fullPath);
        }
      }
    }

    docs.forEach(doc => traverse(doc));
    return Array.from(fieldSet).sort();
  }

  return (
    <div className="flex-1 overflow-y-auto pl-5 flex flex-col">
      <div className="flex items-center gap-3 mb-3">
        <h3 className="text-lg font-semibold">Query {selectedCollection}</h3>
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-md font-semibold">Query {selectedCollection}</h4>
          <AIQueryButton
            collectionName={selectedCollection}
            sampleFields={documents.length > 0 ? extractFieldNames(documents) : []}
            onQueryGenerated={(generatedQuery) => {
              setQuery(generatedQuery);
            }}
          />
        </div>
        <CustomQueryEditor
          value={query}
          onChange={setQuery}
          onExecute={handleQuery}
          fieldNames={documents.length > 0 ? extractFieldNames(documents) : []}
        />
        <div className="flex items-center justify-end gap-3 mt-3">
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="px-3 py-1.5 rounded border border-gray-700 bg-gray-800 text-gray-100 outline-none text-sm"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 rounded border border-gray-700 bg-gray-800 text-sm hover:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ←
            </button>
            <span className="text-sm text-gray-400">
              Page {currentPage} of {Math.ceil(totalCount / pageSize) || 1}
            </span>
            <button
              onClick={() => setCurrentPage(Math.min(Math.ceil(totalCount / pageSize), currentPage + 1))}
              disabled={currentPage >= Math.ceil(totalCount / pageSize)}
              className="px-3 py-1.5 rounded border border-gray-700 bg-gray-800 text-sm hover:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              →
            </button>
          </div>
        </div>
      </div>

      {error && <p className="text-red-400 mb-3 text-sm">{error}</p>}

      <div className="flex-1 overflow-y-auto">
        <DocumentViewer
          documents={documents}
          onUpdate={handleSaveDocument}
          onDelete={handleDeleteDocument}
          onCopy={showToast}
        />
      </div>

      {toast && (
        <div className="fixed bottom-4 right-4 px-4 py-2 bg-gray-800 border border-gray-700 rounded shadow-lg text-sm text-gray-100 animate-fade-in">
          {toast}
        </div>
      )}
    </div>
  );
}
