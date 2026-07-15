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
        let result = db.run_command(doc! { "collStats": collection_name }).await?;

        let stats = CollectionStats {
            name: collection_name.to_string(),
            size: result.get_i64("size").unwrap_or(0),
            count: result.get_i64("count").unwrap_or(0),
            avg_obj_size: result.get_i64("avgObjSize").unwrap_or(0),
            storage_size: result.get_i64("storageSize").unwrap_or(0),
            total_index_size: result.get_i64("totalIndexSize").unwrap_or(0),
            nindexes: result.get_i32("nindexes").unwrap_or(0),
        };

        Ok(stats)
    }

    pub async fn ping(&self) -> Result<bool, mongodb::error::Error> {
        let admin_db = self.client.database("admin");
        let ping_result = admin_db.run_command(mongodb::bson::doc! { "ping": 1 }).await;
        Ok(ping_result.is_ok())
    }
}
