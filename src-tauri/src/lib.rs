use base64::{engine::general_purpose::STANDARD, Engine as _};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::{fs, sync::Mutex};
use tauri::{AppHandle, Manager, State, Window};

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

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
struct PrinterInfo {
    name: String,
    driver_name: String,
    port_name: String,
    status: String,
    is_default: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
struct PrintResult {
    success: bool,
    message: String,
    printer: String,
    copies: u32,
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

// -----------------------------------------------------------------------------
// PHASE 5: HARDWARE & SILENT PRINTING COMMANDS
// -----------------------------------------------------------------------------

#[tauri::command]
fn list_system_printers() -> Result<Vec<PrinterInfo>, String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let script = r#"
            $defName = (Get-CimInstance Win32_Printer | Where-Object Default | Select-Object -ExpandProperty Name -ErrorAction SilentlyContinue)
            $list = @(Get-Printer | ForEach-Object {
                [PSCustomObject]@{
                    name = $_.Name
                    driverName = $_.DriverName
                    portName = $_.PortName
                    status = if ($_.PrinterStatus -eq 0) { "Ready" } else { "Offline/Busy" }
                    isDefault = ($_.Name -eq $defName)
                }
            })
            $list | ConvertTo-Json -Compress
        "#;
        let output = Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-Command", script])
            .output()
            .map_err(|e| format!("Failed to query printers: {}", e))?;

        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if stdout.is_empty() {
            return Ok(Vec::new());
        }

        if stdout.starts_with('[') {
            serde_json::from_str::<Vec<PrinterInfo>>(&stdout).map_err(|e| e.to_string())
        } else if stdout.starts_with('{') {
            let single: PrinterInfo = serde_json::from_str(&stdout).map_err(|e| e.to_string())?;
            Ok(vec![single])
        } else {
            Ok(Vec::new())
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(Vec::new())
    }
}

#[tauri::command]
fn silent_print(
    image_data_url: String,
    printer_name: Option<String>,
    copies: Option<u32>,
) -> Result<PrintResult, String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;

        let clean_base64 = if let Some(idx) = image_data_url.find(',') {
            &image_data_url[idx + 1..]
        } else {
            &image_data_url
        };

        let bytes = STANDARD
            .decode(clean_base64.trim())
            .map_err(|e| format!("Invalid base64 image data: {}", e))?;

        let temp_dir = std::env::temp_dir();
        let filename = format!(
            "gic-print-{}.png",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis()
        );
        let file_path = temp_dir.join(&filename);
        std::fs::write(&file_path, &bytes).map_err(|e| format!("Failed to write print image: {}", e))?;

        let path_str = file_path.to_string_lossy().to_string();
        let copies_count = copies.unwrap_or(1);

        let script = format!(
            r#"
            $imgPath = "{}"
            $targetPrinter = "{}"
            $copies = {}

            Add-Type -AssemblyName System.Drawing
            $doc = New-Object System.Drawing.Printing.PrintDocument
            if ($targetPrinter -ne "") {{
                $doc.PrinterSettings.PrinterName = $targetPrinter
            }}
            $doc.PrinterSettings.Copies = [int]$copies
            $doc.PrintController = New-Object System.Drawing.Printing.StandardPrintController
            $img = [System.Drawing.Image]::FromFile($imgPath)
            $doc.add_PrintPage({{
                param($sender, $ev)
                $ev.Graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
                $ev.Graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
                $ev.Graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
                $ev.Graphics.DrawImage($img, $ev.PageBounds)
                $ev.HasMorePages = $false
            }})
            $doc.Print()
            $img.Dispose()
            Remove-Item -Force $imgPath -ErrorAction SilentlyContinue
            "#,
            path_str.replace('\\', "\\\\"),
            printer_name.clone().unwrap_or_default().replace('"', "`\""),
            copies_count
        );

        let output = Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-Command", &script])
            .output()
            .map_err(|e| format!("Failed to execute print command: {}", e))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Print failed: {}", stderr));
        }

        let printer_used = printer_name.unwrap_or_else(|| "Default Windows Printer".to_string());
        Ok(PrintResult {
            success: true,
            message: format!("Successfully sent {} copy/copies to {}", copies_count, printer_used),
            printer: printer_used,
            copies: copies_count,
        })
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("Silent printing is only supported on Windows".to_string())
    }
}

// -----------------------------------------------------------------------------
// PHASE 6: KIOSK HARDENING, LOCKDOWN & SYSTEM COMMANDS
// -----------------------------------------------------------------------------

#[tauri::command]
fn set_kiosk_mode(window: Window, enabled: bool) -> Result<(), String> {
    window.set_fullscreen(enabled).map_err(|e| e.to_string())?;
    window.set_always_on_top(enabled).map_err(|e| e.to_string())?;
    window.set_decorations(!enabled).map_err(|e| e.to_string())?;
    window.set_resizable(!enabled).map_err(|e| e.to_string())?;
    if enabled {
        let _ = window.maximize();
    }
    Ok(())
}

#[tauri::command]
fn get_local_ip() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let script = r#"
            (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254*" }).IPAddress | Select-Object -First 1
        "#;
        let output = Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-Command", script])
            .output()
            .map_err(|e| format!("Failed to get local IP: {}", e))?;
        let ip = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if ip.is_empty() {
            Ok("127.0.0.1".to_string())
        } else {
            Ok(ip)
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok("127.0.0.1".to_string())
    }
}

#[tauri::command]
fn set_autostart(enabled: bool) -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let exe = std::env::current_exe().map_err(|e| e.to_string())?;
        let exe_str = exe.to_string_lossy().to_string();
        let script = if enabled {
            format!(
                r#"Set-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -Name 'GICBooth' -Value '"{}"'"#,
                exe_str.replace('\\', "\\\\")
            )
        } else {
            r#"Remove-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -Name 'GICBooth' -ErrorAction SilentlyContinue"#.to_string()
        };

        let output = Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-Command", &script])
            .output()
            .map_err(|e| format!("Failed to configure autostart: {}", e))?;
        Ok(output.status.success())
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(false)
    }
}

#[tauri::command]
fn get_autostart_status() -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let script = r#"
            $val = Get-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -Name 'GICBooth' -ErrorAction SilentlyContinue
            if ($null -ne $val.GICBooth) { "true" } else { "false" }
        "#;
        let output = Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-Command", script])
            .output()
            .map_err(|e| format!("Failed to check autostart: {}", e))?;
        let status = String::from_utf8_lossy(&output.stdout).trim().to_string();
        Ok(status == "true")
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(false)
    }
}

#[tauri::command]
fn exit_kiosk_app(app_handle: AppHandle) -> Result<(), String> {
    app_handle.exit(0);
    Ok(())
}

#[tauri::command]
fn restart_kiosk_app(app_handle: AppHandle) {
    app_handle.restart();
}


#[tauri::command]
fn reboot_system() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        Command::new("shutdown")
            .args(["/r", "/t", "5", "/c", "GIC Booth Kiosk System Restart"])
            .spawn()
            .map_err(|e| format!("Failed to trigger system reboot: {}", e))?;
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(())
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
            get_settings,
            list_system_printers,
            silent_print,
            set_kiosk_mode,
            get_local_ip,
            set_autostart,
            get_autostart_status,
            exit_kiosk_app,
            restart_kiosk_app,
            reboot_system
        ])
        .run(tauri::generate_context!())
        .expect("failed to run GIC Booth");
}

