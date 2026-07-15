import { createContext, useContext, useState, ReactNode } from "react";

interface CollectionStats {
  name: string;
  size: number;
  count: number;
  avg_obj_size: number;
  storage_size: number;
  total_index_size: number;
  nindexes: number;
}

interface CachedStats {
  stats: CollectionStats;
  timestamp: number;
}

interface CollectionCacheContextType {
  getStats: (db: string, collection: string) => CollectionStats | null;
  setStats: (db: string, collection: string, stats: CollectionStats) => void;
  clearCache: () => void;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const CollectionCacheContext = createContext<CollectionCacheContextType | undefined>(undefined);

export function CollectionCacheProvider({ children }: { children: ReactNode }) {
  const [cache, setCache] = useState<Map<string, CachedStats>>(new Map());

  function getCacheKey(db: string, collection: string): string {
    return `${db}:${collection}`;
  }

  function getStats(db: string, collection: string): CollectionStats | null {
    const key = getCacheKey(db, collection);
    const cached = cache.get(key);

    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > CACHE_TTL) {
      // Cache expired
      return null;
    }

    return cached.stats;
  }

  function setStats(db: string, collection: string, stats: CollectionStats): void {
    const key = getCacheKey(db, collection);
    setCache(prev => {
      const next = new Map(prev);
      next.set(key, {
        stats,
        timestamp: Date.now(),
      });
      return next;
    });
  }

  function clearCache(): void {
    setCache(new Map());
  }

  return (
    <CollectionCacheContext.Provider value={{ getStats, setStats, clearCache }}>
      {children}
    </CollectionCacheContext.Provider>
  );
}

export function useCollectionCache() {
  const context = useContext(CollectionCacheContext);
  if (!context) {
    throw new Error('useCollectionCache must be used within CollectionCacheProvider');
  }
  return context;
}
