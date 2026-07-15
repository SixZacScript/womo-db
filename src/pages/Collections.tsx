import { useState, useEffect } from "react";
import { Star } from "lucide-react";
import { mongoService } from "../services/mongodb";
import { useTabContext } from "../contexts/TabContext";
import { useCollectionCache } from "../contexts/CollectionCacheContext";

interface CollectionStats {
  name: string;
  size: number;
  count: number;
  avg_obj_size: number;
  storage_size: number;
  total_index_size: number;
  nindexes: number;
}

interface CollectionsProps {
  selectedDb: string;
  favoriteCollections: Set<string>;
  onToggleFavoriteCollection: (colName: string) => void;
}

export function Collections({ selectedDb, favoriteCollections, onToggleFavoriteCollection }: CollectionsProps) {
  const [collections, setCollections] = useState<string[]>([]);
  const [collectionStats, setCollectionStats] = useState<Map<string, CollectionStats>>(new Map());
  const [_, setError] = useState("");
  const [collectionSearchTerm, setCollectionSearchTerm] = useState("");
  const { addTab } = useTabContext();
  const { getStats, setStats } = useCollectionCache();

  useEffect(() => {
    if (selectedDb) {
      loadCollections();
    }
  }, [selectedDb]);

  async function loadCollections() {
    try {
      setError("");
      setCollections([]);
      setCollectionStats(new Map());
      const cols = await mongoService.listCollections(selectedDb);

      // Sort collections first
      const sorted = cols.sort((a, b) => {
        const aKey = `${selectedDb}:${a}`;
        const bKey = `${selectedDb}:${b}`;
        const aFav = favoriteCollections.has(aKey);
        const bFav = favoriteCollections.has(bKey);
        if (aFav && !bFav) return -1;
        if (!aFav && bFav) return 1;
        return a.localeCompare(b);
      });

      setCollections(sorted);

      // Load cached stats immediately
      const cachedStats = new Map<string, CollectionStats>();
      sorted.forEach(col => {
        const cached = getStats(selectedDb, col);
        if (cached) {
          cachedStats.set(col, cached);
        }
      });
      setCollectionStats(cachedStats);

      // Fetch favorites first
      const favorites = sorted.filter(col => favoriteCollections.has(`${selectedDb}:${col}`));
      const nonFavorites = sorted.filter(col => !favoriteCollections.has(`${selectedDb}:${col}`));

      // Fetch favorite stats in parallel
      const favoritesWithoutCache = favorites.filter(col => !cachedStats.has(col));
      if (favoritesWithoutCache.length > 0) {
        const favoriteResults = await Promise.all(
          favoritesWithoutCache.map(async (col) => {
            try {
              const stats = await mongoService.getCollectionStats(selectedDb, col);
              setStats(selectedDb, col, stats);
              return [col, stats] as const;
            } catch (e) {
              console.error(`Failed to get stats for ${col}:`, e);
              return null;
            }
          })
        );

        setCollectionStats(prev => {
          const next = new Map(prev);
          favoriteResults.forEach(entry => {
            if (entry) next.set(entry[0], entry[1]);
          });
          return next;
        });
      }

      // Fetch non-favorites in batches (only those without cache)
      const BATCH_SIZE = 10;
      const nonFavoritesWithoutCache = nonFavorites.filter(col => !cachedStats.has(col));

      for (let i = 0; i < nonFavoritesWithoutCache.length; i += BATCH_SIZE) {
        const batch = nonFavoritesWithoutCache.slice(i, i + BATCH_SIZE);
        const batchStats = await Promise.all(
          batch.map(async (col) => {
            try {
              const stats = await mongoService.getCollectionStats(selectedDb, col);
              setStats(selectedDb, col, stats);
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

  async function handleSelectCollection(collectionName: string) {
    addTab({
      type: 'documents',
      db: selectedDb,
      collection: collectionName,
      label: `${selectedDb}.${collectionName}`,
      state: {
        query: '{}',
        page: 1,
        pageSize: 20,
      },
    });
  }

  function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "kB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  if (!selectedDb) return null;

  return (
    <div className="flex-1 pl-5 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <h3 className="text-lg font-semibold">Collections in {selectedDb}</h3>
        <input
          type="text"
          value={collectionSearchTerm}
          onChange={(e) => setCollectionSearchTerm(e.target.value)}
          placeholder="Search collections..."
          className="w-64 px-3 py-2 rounded border border-gray-700 bg-gray-800 text-gray-100 outline-none text-sm placeholder:text-gray-500"
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 bg-gray-900 z-10">
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
                        onToggleFavoriteCollection(col);
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
    </div>
  );
}
