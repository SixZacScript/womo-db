import { useState, useEffect } from "react";
import { Star } from "lucide-react";
import { mongoService } from "./services/mongodb";
import { secureStorage } from "./services/storage";
import { TabProvider, useTabContext } from "./contexts/TabContext";
import { CollectionCacheProvider } from "./contexts/CollectionCacheContext";
import { TabBar } from "./components/TabBar";
import { TabContent } from "./components/TabContent";
import "./App.css";

function AppContent() {
  const { addTab, clearTabs } = useTabContext();
  const [uri, setUri] = useState("");
  const [connected, setConnected] = useState(false);
  const [databases, setDatabases] = useState<string[]>([]);
  const [selectedDb, setSelectedDb] = useState("");
  const [error, setError] = useState("");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [favoriteCollections, setFavoriteCollections] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");

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
    setSelectedDb(dbName);

    // Create or switch to Collections tab for this database
    addTab({
      type: 'collection',
      db: dbName,
      label: `Collections - ${dbName}`,
    });
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

          <div className="flex-1 flex flex-col overflow-hidden">
            <TabBar />
            <TabContent
              selectedDb={selectedDb}
              favoriteCollections={favoriteCollections}
              onToggleFavoriteCollection={toggleFavoriteCollection}
            />
          </div>
        </div>
      )}

    </main>
  );
}

function App() {
  return (
    <TabProvider>
      <CollectionCacheProvider>
        <AppContent />
      </CollectionCacheProvider>
    </TabProvider>
  );
}

export default App;
