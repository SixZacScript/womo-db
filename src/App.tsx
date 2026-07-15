import { useState, useEffect } from "react";
import { Star } from "lucide-react";
import { mongoService } from "./services/mongodb";
import { secureStorage } from "./services/storage";
import { DocumentViewer } from "./components/DocumentViewer";
import { CustomQueryEditor } from "./components/CustomQueryEditor";
import "./App.css";

interface CollectionStats {
  name: string;
  size: number;
  count: number;
  avg_obj_size: number;
  storage_size: number;
  total_index_size: number;
  nindexes: number;
}

function App() {
  const [uri, setUri] = useState("");
  const [connected, setConnected] = useState(false);
  const [databases, setDatabases] = useState<string[]>([]);
  const [selectedDb, setSelectedDb] = useState("");
  const [collections, setCollections] = useState<string[]>([]);
  const [collectionStats, setCollectionStats] = useState<Map<string, CollectionStats>>(new Map());
  const [error, setError] = useState("");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [favoriteCollections, setFavoriteCollections] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCollection, setSelectedCollection] = useState("");
  const [documents, setDocuments] = useState<any[]>([]);
  const [query, setQuery] = useState("{}");
  const [collectionSearchTerm, setCollectionSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("womo-db-favorites");
    if (stored) {
      setFavorites(new Set(JSON.parse(stored)));
    }
    const storedCols = localStorage.getItem("womo-db-favorite-collections");
    if (storedCols) {
      setFavoriteCollections(new Set(JSON.parse(storedCols)));
    }
    const storedUri = secureStorage.getUri();
    if (storedUri) {
      setUri(storedUri);
      handleConnectWithUri(storedUri);
    }
  }, []);

  async function handleConnectWithUri(connectionUri: string) {
    try {
      setError("");
      const result = await mongoService.connect(connectionUri);
      setConnected(result);
      if (result) {
        const dbs = await mongoService.listDatabases();
        setDatabases(dbs);
      }
    } catch (e) {
      setError(String(e));
      setConnected(false);
    }
  }

  function toggleFavorite(dbName: string) {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(dbName)) {
        next.delete(dbName);
      } else {
        next.add(dbName);
      }
      localStorage.setItem("womo-db-favorites", JSON.stringify([...next]));
      return next;
    });
  }

  function toggleFavoriteCollection(colName: string) {
    const key = `${selectedDb}:${colName}`;
    setFavoriteCollections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      localStorage.setItem("womo-db-favorite-collections", JSON.stringify([...next]));
      return next;
    });
  }

  function getSortedDatabases() {
    const filtered = databases.filter((db) =>
      db.toLowerCase().includes(searchTerm.toLowerCase())
    );
    return filtered.sort((a, b) => {
      const aFav = favorites.has(a);
      const bFav = favorites.has(b);
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;
      return a.localeCompare(b);
    });
  }

  function getSortedCollections() {
    const filtered = collections.filter((col) =>
      col.toLowerCase().includes(collectionSearchTerm.toLowerCase())
    );
    return filtered.sort((a, b) => {
      const aKey = `${selectedDb}:${a}`;
      const bKey = `${selectedDb}:${b}`;
      const aFav = favoriteCollections.has(aKey);
      const bFav = favoriteCollections.has(bKey);
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;
      return a.localeCompare(b);
    });
  }

  async function handleConnect() {
    try {
      setError("");
      const result = await mongoService.connect(uri);
      setConnected(result);
      if (result) {
        secureStorage.setUri(uri);
        const dbs = await mongoService.listDatabases();
        setDatabases(dbs);
      }
    } catch (e) {
      setError(String(e));
      setConnected(false);
    }
  }

  async function handleSelectDb(dbName: string) {
    try {
      setError("");
      setSelectedDb(dbName);
      setSelectedCollection("");
      setDocuments([]);
      setCollections([]);
      setCollectionStats(new Map());
      const cols = await mongoService.listCollections(dbName);

      // Sort collections first
      const sorted = cols.sort((a, b) => {
        const aKey = `${dbName}:${a}`;
        const bKey = `${dbName}:${b}`;
        const aFav = favoriteCollections.has(aKey);
        const bFav = favoriteCollections.has(bKey);
        if (aFav && !bFav) return -1;
        if (!aFav && bFav) return 1;
        return a.localeCompare(b);
      });

      setCollections(sorted);
      setCollectionStats(new Map());

      // Fetch favorites first
      const favorites = sorted.filter(col => favoriteCollections.has(`${dbName}:${col}`));
      const nonFavorites = sorted.filter(col => !favoriteCollections.has(`${dbName}:${col}`));

      // Fetch favorite stats sequentially to render immediately
      for (const col of favorites) {
        try {
          const stats = await mongoService.getCollectionStats(dbName, col);
          setCollectionStats(prev => new Map(prev).set(col, stats));
        } catch (e) {
          console.error(`Failed to get stats for ${col}:`, e);
        }
      }

      // Fetch non-favorites in batches
      const BATCH_SIZE = 5;
      for (let i = 0; i < nonFavorites.length; i += BATCH_SIZE) {
        const batch = nonFavorites.slice(i, i + BATCH_SIZE);
        const batchStats = await Promise.all(
          batch.map(async (col) => {
            try {
              const stats = await mongoService.getCollectionStats(dbName, col);
              return [col, stats] as const;
            } catch (e) {
              console.error(`Failed to get stats for ${col}:`, e);
              return null;
            }
          })
        );

        setCollectionStats(prev => {
          const next = new Map(prev);
          batchStats.forEach(entry => {
            if (entry) next.set(entry[0], entry[1]);
          });
          return next;
        });
      }
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleSelectCollection(collectionName: string) {
    try {
      setError("");
      setSelectedCollection(collectionName);
      setQuery("{}");
      setCurrentPage(1);
      const docs = await mongoService.getDocuments(selectedDb, collectionName, pageSize);
      setDocuments(docs);

      // Get total count
      const stats = collectionStats.get(collectionName);
      setTotalCount(stats?.count || 0);
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
      const stats = collectionStats.get(selectedCollection);
      setTotalCount(stats?.count || docs.length);
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

  function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "kB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

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
    <main className="m-0 p-4 h-screen flex flex-col bg-gray-900 text-gray-100">
      {/* do not uncomment this section */}
      {/* <h1 className="m-0 mb-5 text-2xl font-bold">WOMO DB</h1> */}

      {!connected ? (
        <div className="max-w-lg mx-auto">
          <h2 className="text-xl mb-4">Connect to MongoDB</h2>
          <input
            type="text"
            value={uri}
            onChange={(e) => setUri(e.target.value)}
            placeholder="mongodb://localhost:27017"
            className="w-full mb-2.5 px-5 py-2.5 rounded-lg border border-gray-700 bg-gray-800 text-gray-100 outline-none shadow-sm focus:border-blue-500 placeholder:text-gray-500"
          />
          <button
            onClick={handleConnect}
            className="px-5 py-2.5 rounded-lg bg-gray-800 border border-gray-700 font-medium shadow-sm cursor-pointer hover:border-blue-500 active:bg-gray-700"
          >
            Connect
          </button>
          {error && <p className="text-red-400 mt-2">{error}</p>}
        </div>
      ) : (
        <div className="flex flex-1 gap-5 overflow-hidden">
          <div className="w-64 border-r border-gray-700 overflow-y-auto overflow-x-hidden pr-5">
            <h3 className="text-lg font-semibold mb-3">Databases</h3>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search databases..."
              className="w-full mb-2.5 px-3 py-2 rounded border border-gray-700 bg-gray-800 text-gray-100 outline-none text-sm placeholder:text-gray-500"
            />
            <ul className="list-none p-0 m-0 flex flex-col w-full">
              {getSortedDatabases().map((db) => (
                <li
                  key={db}
                  onClick={() => handleSelectDb(db)}
                  className={`flex items-center justify-between w-full px-3 py-2 mb-1 rounded cursor-pointer hover:bg-gray-700 ${
                    selectedDb === db ? "font-bold bg-gray-800" : ""
                  } ${favorites.has(db) ? "text-amber-500" : ""}`}
                >
                  <span>{db}</span>
                  <Star
                    size={16}
                    fill={favorites.has(db) ? "#F59E0B" : "none"}
                    stroke={favorites.has(db) ? "#F59E0B" : "currentColor"}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(db);
                    }}
                    className="cursor-pointer hover:scale-110 transition-transform flex-shrink-0"
                  />
                </li>
              ))}
            </ul>
          </div>

          <div className="flex-1 overflow-y-auto pl-5">
            {selectedDb ? (
              <>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {selectedCollection && (
                      <button
                        onClick={() => {
                          setSelectedCollection("");
                          setQuery("{}");
                        }}
                        className="px-3 py-1.5 rounded bg-gray-800 border border-gray-700 text-sm hover:border-blue-500"
                      >
                        ← Back to collections
                      </button>
                    )}
                    <h3 className="text-lg font-semibold">
                      {selectedCollection ? `Query ${selectedCollection}` : `Collections in ${selectedDb}`}
                    </h3>
                  </div>
                  {!selectedCollection && (
                    <input
                      type="text"
                      value={collectionSearchTerm}
                      onChange={(e) => setCollectionSearchTerm(e.target.value)}
                      placeholder="Search collections..."
                      className="w-64 px-3 py-2 rounded border border-gray-700 bg-gray-800 text-gray-100 outline-none text-sm placeholder:text-gray-500"
                    />
                  )}
                </div>
                {!selectedCollection ? (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b border-gray-700">
                          <th className="text-left py-2 px-3 font-semibold text-sm">Collection name</th>
                          <th className="text-left py-2 px-3 font-semibold text-sm">Properties</th>
                          <th className="text-left py-2 px-3 font-semibold text-sm">Storage size</th>
                          <th className="text-left py-2 px-3 font-semibold text-sm">Data size</th>
                          <th className="text-left py-2 px-3 font-semibold text-sm">Documents</th>
                          <th className="text-left py-2 px-3 font-semibold text-sm">Avg. document size</th>
                          <th className="text-left py-2 px-3 font-semibold text-sm">Indexes</th>
                          <th className="text-left py-2 px-3 font-semibold text-sm">Total index size</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getSortedCollections().map((col) => {
                          const colKey = `${selectedDb}:${col}`;
                          const isFav = favoriteCollections.has(colKey);
                          const stats = collectionStats.get(col);
                          return (
                            <tr
                              key={col}
                              className="border-b border-gray-800 hover:bg-gray-800 cursor-pointer"
                              onClick={() => handleSelectCollection(col)}
                            >
                              <td className="py-2 px-3 flex items-center gap-2">
                                <Star
                                  size={14}
                                  fill={isFav ? "#F59E0B" : "none"}
                                  stroke={isFav ? "#F59E0B" : "currentColor"}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleFavoriteCollection(col);
                                  }}
                                  className="cursor-pointer hover:scale-110 transition-transform flex-shrink-0"
                                />
                                <span className={isFav ? "text-amber-500" : ""}>{col}</span>
                              </td>
                              <td className="py-2 px-3 text-gray-400">-</td>
                              <td className="py-2 px-3 text-gray-400">{stats ? formatBytes(stats.storage_size) : "-"}</td>
                              <td className="py-2 px-3 text-gray-400">{stats ? formatBytes(stats.size) : "-"}</td>
                              <td className="py-2 px-3 text-gray-400">{stats ? stats.count : "-"}</td>
                              <td className="py-2 px-3 text-gray-400">{stats ? formatBytes(stats.avg_obj_size) : "-"}</td>
                              <td className="py-2 px-3 text-gray-400">{stats ? stats.nindexes : "-"}</td>
                              <td className="py-2 px-3 text-gray-400">{stats ? formatBytes(stats.total_index_size) : "-"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div>
                    <div className="mb-4">
                      <h4 className="text-md font-semibold mb-3">Query {selectedCollection}</h4>
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

                    <DocumentViewer
                      documents={documents}
                      onUpdate={handleSaveDocument}
                      onDelete={handleDeleteDocument}
                      onCopy={showToast}
                    />
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-4 right-4 px-4 py-2 bg-gray-800 border border-gray-700 rounded shadow-lg text-sm text-gray-100 animate-fade-in">
          {toast}
        </div>
      )}
    </main>
  );
}

export default App;
