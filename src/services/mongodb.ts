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

  async getDocuments(dbName: string, collectionName: string, limit: number = 100): Promise<any[]> {
    return await invoke("get_documents", { dbName, collectionName, limit });
  },

  async queryDocuments(dbName: string, collectionName: string, query: string, limit: number = 100): Promise<any[]> {
    return await invoke("query_documents", { dbName, collectionName, query, limit });
  },

  async updateDocument(dbName: string, collectionName: string, docId: string, newDoc: string): Promise<boolean> {
    return await invoke("update_document", { dbName, collectionName, docId, newDoc });
  },

  async deleteDocument(dbName: string, collectionName: string, docId: string): Promise<boolean> {
    return await invoke("delete_document", { dbName, collectionName, docId });
  },
};
