use mongodb::{Client, options::ClientOptions, Database, bson::doc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct ConnectionConfig {
    pub uri: String,
    pub database: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CollectionStats {
    pub name: String,
    pub size: i64,
    pub count: i64,
    pub avg_obj_size: i64,
    pub storage_size: i64,
    pub total_index_size: i64,
    pub nindexes: i32,
}

pub struct MongoDBClient {
    client: Client,
    config: ConnectionConfig,
}

impl MongoDBClient {
    pub async fn new(config: ConnectionConfig) -> Result<Self, mongodb::error::Error> {
        let client_options = ClientOptions::parse(&config.uri).await?;
        let client = Client::with_options(client_options)?;

        Ok(Self { client, config })
    }

    pub fn get_database(&self, name: &str) -> Database {
        let db_name = if name.is_empty() {
            self.config.database.as_str()
        } else {
            name
        };

        self.client.database(db_name)
    }

    pub async fn list_databases(&self) -> Result<Vec<String>, mongodb::error::Error> {
        let databases = self.client.list_database_names().await?;
        Ok(databases)
    }

    pub async fn list_collections(&self, db_name: &str) -> Result<Vec<String>, mongodb::error::Error> {
        let db = self.get_database(db_name);
        let collections = db.list_collection_names().await?;
        Ok(collections)
    }

    pub async fn get_collection_stats(&self, db_name: &str, collection_name: &str) -> Result<CollectionStats, mongodb::error::Error> {
        let db = self.get_database(db_name);
        let result = db.run_command(doc! { "collStats": collection_name, "scale": 1 }).await?;

        // MongoDB may return i32 or i64 depending on value size and storage engine
        let get_number = |doc: &mongodb::bson::Document, key: &str| -> i64 {
            doc.get_i64(key)
                .or_else(|_| doc.get_i32(key).map(|v| v as i64))
                .or_else(|_| doc.get_f64(key).map(|v| v as i64))
                .unwrap_or(0)
        };

        let stats = CollectionStats {
            name: collection_name.to_string(),
            size: get_number(&result, "size"),
            count: get_number(&result, "count"),
            avg_obj_size: get_number(&result, "avgObjSize"),
            storage_size: get_number(&result, "storageSize"),
            total_index_size: get_number(&result, "totalIndexSize"),
            nindexes: result.get_i32("nindexes").unwrap_or(0),
        };

        Ok(stats)
    }

    pub async fn get_documents(&self, db_name: &str, collection_name: &str, limit: i64) -> Result<Vec<mongodb::bson::Document>, mongodb::error::Error> {
        use mongodb::bson::Document;
        use futures::stream::StreamExt;

        let db = self.get_database(db_name);
        let collection = db.collection::<Document>(collection_name);

        let mut cursor = collection.find(doc! {}).limit(limit).await?;
        let mut documents = Vec::new();

        while let Some(doc) = cursor.next().await {
            documents.push(doc?);
        }

        Ok(documents)
    }

    pub async fn query_documents(&self, db_name: &str, collection_name: &str, query_str: &str, limit: i64, skip: u64) -> Result<Vec<mongodb::bson::Document>, mongodb::error::Error> {
        use mongodb::bson::Document;
        use futures::stream::StreamExt;

        let db = self.get_database(db_name);
        let collection = db.collection::<Document>(collection_name);

        let query: Document = serde_json::from_str(query_str).map_err(|e| {
            mongodb::error::Error::custom(format!("Invalid query JSON: {}", e))
        })?;

        let mut cursor = collection.find(query).limit(limit).skip(skip).await?;
        let mut documents = Vec::new();

        while let Some(doc) = cursor.next().await {
            documents.push(doc?);
        }

        Ok(documents)
    }

    pub async fn update_document(&self, db_name: &str, collection_name: &str, doc_id: &str, new_doc_str: &str) -> Result<bool, mongodb::error::Error> {
        use mongodb::bson::{Document, oid::ObjectId};

        let db = self.get_database(db_name);
        let collection = db.collection::<Document>(collection_name);

        let oid = ObjectId::parse_str(doc_id).map_err(|e| {
            mongodb::error::Error::custom(format!("Invalid ObjectId: {}", e))
        })?;

        let new_doc: Document = serde_json::from_str(new_doc_str).map_err(|e| {
            mongodb::error::Error::custom(format!("Invalid document JSON: {}", e))
        })?;

        let result = collection.replace_one(doc! { "_id": oid }, new_doc).await?;
        Ok(result.modified_count > 0)
    }

    pub async fn delete_document(&self, db_name: &str, collection_name: &str, doc_id: &str) -> Result<bool, mongodb::error::Error> {
        use mongodb::bson::{Document, oid::ObjectId};

        let db = self.get_database(db_name);
        let collection = db.collection::<Document>(collection_name);

        let oid = ObjectId::parse_str(doc_id).map_err(|e| {
            mongodb::error::Error::custom(format!("Invalid ObjectId: {}", e))
        })?;

        let result = collection.delete_one(doc! { "_id": oid }).await?;
        Ok(result.deleted_count > 0)
    }

    pub async fn ping(&self) -> Result<bool, mongodb::error::Error> {
        let admin_db = self.client.database("admin");
        let ping_result = admin_db.run_command(mongodb::bson::doc! { "ping": 1 }).await;
        Ok(ping_result.is_ok())
    }
}
