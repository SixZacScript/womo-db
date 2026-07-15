import { invoke } from "@tauri-apps/api/core";

interface CollectionStats {
  name: string;
  size: number;
  count: number;
  avg_obj_size: number;
  storage_size: number;
  total_index_size: number;
  nindexes: number;
}

export const mongoService = {
  async connect(uri: string): Promise<boolean> {
    return await invoke("connect_mongodb", { uri });
  },

  async listDatabases(): Promise<string[]> {
    return await invoke("list_databases");
  },

  async listCollections(dbName: string): Promise<string[]> {
    return await invoke("list_collections", { dbName });
  },

  async getCollectionStats(dbName: string, collectionName: string): Promise<CollectionStats> {
    return await invoke("get_collection_stats", { dbName, collectionName });
  },
};
