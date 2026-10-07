use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::{fs, sync::Mutex};
use tauri::{Manager, State};

struct Database(Mutex<Connection>);

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct EventCount {
    event_type: String,
    count: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SessionSummary {
    session_id: String,
    started_at: String,
    last_event_at: String,
    captures: i64,
    downloaded: bool,
    printed: bool,
    status: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ThemeInput {
    id: String,
    name: String,
    category: String,
    layout_id: String,
    frame_data_url: String,
    active: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ThemeRecord {
    id: String,
    name: String,
    category: String,
    layout_id: String,
    frame_data_url: String,
    active: bool,
    created_at: String,
}

#[tauri::command]
fn record_event(
    database: State<Database>,
    session_id: String,
    event_type: String,
    metadata: Option<serde_json::Value>,
) -> Result<(), String> {
    database
        .0
        .lock()
        .map_err(|error| error.to_string())?
        .execute(
            "INSERT INTO events (session_id, event_type, metadata) VALUES (?1, ?2, ?3)",
            params![session_id, event_type, metadata.map(|value| value.to_string())],
        )
        .map(|_| ())
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn event_counts(database: State<Database>) -> Result<Vec<EventCount>, String> {
    let connection = database.0.lock().map_err(|error| error.to_string())?;
    let mut statement = connection
        .prepare("SELECT event_type, COUNT(*) FROM events GROUP BY event_type ORDER BY event_type")
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], |row| Ok(EventCount { event_type: row.get(0)?, count: row.get(1)? }))
        .map_err(|error| error.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|error| error.to_string())
}

#[tauri::command]
fn session_history(database: State<Database>) -> Result<Vec<SessionSummary>, String> {
    let connection = database.0.lock().map_err(|error| error.to_string())?;
    let mut statement = connection.prepare(
        "SELECT session_id, MIN(created_at), MAX(created_at),
            COALESCE(SUM(CASE WHEN event_type = 'capture_completed' THEN CAST(json_extract(metadata, '$.count') AS INTEGER) ELSE 0 END), 0),
            MAX(event_type = 'download_completed'), MAX(event_type = 'print_requested'),
            CASE
                WHEN MAX(event_type = 'session_completed') = 1 THEN 'Completed'
                WHEN MAX(event_type = 'session_abandoned') = 1 THEN 'Abandoned'
                ELSE 'Active'
            END
         FROM events GROUP BY session_id ORDER BY MIN(created_at) DESC LIMIT 100"
    ).map_err(|error| error.to_string())?;
    let rows = statement.query_map([], |row| Ok(SessionSummary {
        session_id: row.get(0)?, started_at: row.get(1)?, last_event_at: row.get(2)?, captures: row.get(3)?,
        downloaded: row.get::<_, i64>(4)? == 1, printed: row.get::<_, i64>(5)? == 1, status: row.get(6)?,
    })).map_err(|error| error.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|error| error.to_string())
}

#[tauri::command]
fn list_themes(database: State<Database>) -> Result<Vec<ThemeRecord>, String> {
    let connection = database.0.lock().map_err(|error| error.to_string())?;
    let mut statement = connection.prepare(
        "SELECT id, name, category, layout_id, frame_data_url, active, created_at FROM themes ORDER BY created_at DESC"
    ).map_err(|error| error.to_string())?;
    let rows = statement.query_map([], |row| Ok(ThemeRecord {
        id: row.get(0)?, name: row.get(1)?, category: row.get(2)?, layout_id: row.get(3)?, frame_data_url: row.get(4)?,
        active: row.get::<_, i64>(5)? == 1, created_at: row.get(6)?,
    })).map_err(|error| error.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|error| error.to_string())
}

#[tauri::command]
fn save_theme(database: State<Database>, theme: ThemeInput) -> Result<(), String> {
    database.0.lock().map_err(|error| error.to_string())?.execute(
        "INSERT OR REPLACE INTO themes (id, name, category, layout_id, frame_data_url, active) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![theme.id, theme.name, theme.category, theme.layout_id, theme.frame_data_url, theme.active],
    ).map(|_| ()).map_err(|error| error.to_string())
}

#[tauri::command]
fn set_theme_active(database: State<Database>, id: String, active: bool) -> Result<(), String> {
    database.0.lock().map_err(|error| error.to_string())?
        .execute("UPDATE themes SET active = ?1 WHERE id = ?2", params![active, id])
        .map(|_| ()).map_err(|error| error.to_string())
}

#[tauri::command]
fn delete_theme(database: State<Database>, id: String) -> Result<(), String> {
    database.0.lock().map_err(|error| error.to_string())?
        .execute("DELETE FROM themes WHERE id = ?1", params![id])
        .map(|_| ()).map_err(|error| error.to_string())
}

#[tauri::command]
fn save_settings(database: State<Database>, settings: serde_json::Value) -> Result<(), String> {
    database.0.lock().map_err(|error| error.to_string())?.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('global', ?1)",
        params![settings.to_string()],
    ).map(|_| ()).map_err(|error| error.to_string())
}

#[tauri::command]
fn get_settings(database: State<Database>) -> Result<Option<serde_json::Value>, String> {
    let connection = database.0.lock().map_err(|error| error.to_string())?;
    let mut stmt = connection.prepare("SELECT value FROM settings WHERE key = 'global'").map_err(|e| e.to_string())?;
    let mut rows = stmt.query_map([], |row| {
        let val_str: String = row.get(0)?;
        Ok(serde_json::from_str::<serde_json::Value>(&val_str).unwrap_or(serde_json::Value::Null))
    }).map_err(|e| e.to_string())?;
    if let Some(row) = rows.next() {
        Ok(Some(row.map_err(|e| e.to_string())?))
    } else {
        Ok(None)
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let directory = app.path().app_data_dir()?;
            fs::create_dir_all(&directory)?;
            let connection = Connection::open(directory.join("gic-booth.sqlite"))?;
            connection.execute_batch(
                "CREATE TABLE IF NOT EXISTS events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT NOT NULL,
                    event_type TEXT NOT NULL,
                    metadata TEXT,
                    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
                );
                CREATE INDEX IF NOT EXISTS events_session_id ON events(session_id);
                CREATE INDEX IF NOT EXISTS events_created_at ON events(created_at);",
            )?;
            connection.execute_batch(
                "CREATE TABLE IF NOT EXISTS themes (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    category TEXT NOT NULL,
                    layout_id TEXT NOT NULL,
                    frame_data_url TEXT NOT NULL,
                    active INTEGER NOT NULL DEFAULT 1,
                    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
                );
                CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
                );
                CREATE TABLE IF NOT EXISTS sync_queue (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    entity_type TEXT NOT NULL,
                    entity_id TEXT NOT NULL,
                    operation TEXT NOT NULL,
                    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
                    synced_at TEXT
                );"
            )?;
            app.manage(Database(Mutex::new(connection)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            record_event,
            event_counts,
            session_history,
            list_themes,
            save_theme,
            set_theme_active,
            delete_theme,
            save_settings,
            get_settings
        ])
        .run(tauri::generate_context!())
        .expect("failed to run GIC Booth");
}
