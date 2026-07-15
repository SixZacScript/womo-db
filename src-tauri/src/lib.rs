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
            get_collection_stats
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
