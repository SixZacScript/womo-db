mod mongodb;

use mongodb::{ConnectionConfig, MongoDBClient, CollectionStats};
use tokio::sync::Mutex;
use tauri::State;

struct AppState {
    mongo_client: Mutex<Option<MongoDBClient>>,
}

#[tauri::command]
async fn connect_mongodb(uri: String, state: State<'_, AppState>) -> Result<bool, String> {
    let config = ConnectionConfig {
        uri: uri.clone(),
        database: "admin".to_string(),
    };

    let client = MongoDBClient::new(config)
        .await
        .map_err(|e| e.to_string())?;

    let ping_result = client.ping().await.map_err(|e| e.to_string())?;

    if ping_result {
        *state.mongo_client.lock().await = Some(client);
        Ok(true)
    } else {
        Err("Connection failed".to_string())
    }
}

#[tauri::command]
async fn list_databases(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    let client_guard = state.mongo_client.lock().await;
    let client = client_guard.as_ref().ok_or("Not connected")?;

    client.list_databases().await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn list_collections(db_name: String, state: State<'_, AppState>) -> Result<Vec<String>, String> {
    let client_guard = state.mongo_client.lock().await;
    let client = client_guard.as_ref().ok_or("Not connected")?;

    client.list_collections(&db_name).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_collection_stats(db_name: String, collection_name: String, state: State<'_, AppState>) -> Result<CollectionStats, String> {
    let client_guard = state.mongo_client.lock().await;
    let client = client_guard.as_ref().ok_or("Not connected")?;

    client.get_collection_stats(&db_name, &collection_name).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_documents(db_name: String, collection_name: String, limit: i64, state: State<'_, AppState>) -> Result<Vec<serde_json::Value>, String> {
    let client_guard = state.mongo_client.lock().await;
    let client = client_guard.as_ref().ok_or("Not connected")?;

    let docs = client.get_documents(&db_name, &collection_name, limit).await.map_err(|e| e.to_string())?;

    // Convert BSON Documents to JSON Values
    let json_docs: Vec<serde_json::Value> = docs.iter()
        .filter_map(|doc| bson::to_bson(doc).ok())
        .filter_map(|bson_val| serde_json::to_value(&bson_val).ok())
        .collect();

    Ok(json_docs)
}

#[tauri::command]
async fn query_documents(db_name: String, collection_name: String, query: String, limit: i64, state: State<'_, AppState>) -> Result<Vec<serde_json::Value>, String> {
    let client_guard = state.mongo_client.lock().await;
    let client = client_guard.as_ref().ok_or("Not connected")?;

    let docs = client.query_documents(&db_name, &collection_name, &query, limit).await.map_err(|e| e.to_string())?;

    let json_docs: Vec<serde_json::Value> = docs.iter()
        .filter_map(|doc| bson::to_bson(doc).ok())
        .filter_map(|bson_val| serde_json::to_value(&bson_val).ok())
        .collect();

    Ok(json_docs)
}

#[tauri::command]
async fn update_document(db_name: String, collection_name: String, doc_id: String, new_doc: String, state: State<'_, AppState>) -> Result<bool, String> {
    let client_guard = state.mongo_client.lock().await;
    let client = client_guard.as_ref().ok_or("Not connected")?;

    client.update_document(&db_name, &collection_name, &doc_id, &new_doc).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_document(db_name: String, collection_name: String, doc_id: String, state: State<'_, AppState>) -> Result<bool, String> {
    let client_guard = state.mongo_client.lock().await;
    let client = client_guard.as_ref().ok_or("Not connected")?;

    client.delete_document(&db_name, &collection_name, &doc_id).await.map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState {
            mongo_client: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            connect_mongodb,
            list_databases,
            list_collections,
            get_collection_stats,
            get_documents,
            query_documents,
            update_document,
            delete_document
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
