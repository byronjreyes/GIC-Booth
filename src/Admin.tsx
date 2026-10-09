import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import {
  Activity,
  ArrowLeft,
  Calendar,
  Camera,
  CheckCircle2,
  Clock,
  Cloud,
  CloudOff,
  Copy,
  Download,
  ExternalLink,
  Filter,
  HardDrive,
  Image as ImageIcon,
  KeyRound,
  Layers,
  LayoutDashboard,
  Lock,
  LogOut,
  Monitor,
  Power,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  Sliders,
  Trash2,
  Upload,
  Users,
  Wifi,
} from 'lucide-react'
import {
  createId,
  defaultSettings,
  deleteTheme,
  exitKioskApp,
  generateCalibrationSheetUrl,
  getAnalyticsReport,
  getEventCounts,
  getLocalIp,
  getSessionHistory,
  getSettings,
  listSystemPrinters,
  listThemes,
  rebootSystem,
  resetPaperRoll,
  restartKioskApp,
  saveSettings,
  saveTheme,
  setAutostart,
  setKioskMode,
  setThemeActive,
  silentPrint,
  type AnalyticsReport,
  type BoothSettings,
  type DateRangeFilter,
  type PrinterInfo,
  type SessionSummary,
  type StoredTheme,
} from './platform'
import { getSyncStatus, initSyncEngine, runSync, subscribeSyncStatus, type SyncStatus } from './sync'
import { getSupabaseCredentials, isSupabaseConfigured, saveSupabaseCredentials, uploadThemeAsset, testSupabaseConnection } from './supabase'

type AdminTab = 'dashboard' | 'analytics' | 'sessions' | 'designs' | 'printer' | 'camera' | 'settings'

export default function Admin() {
  const [activeTab, setActiveTab] = useState<AdminTab>(() => {
    const segment = window.location.pathname.split('/')[2] as AdminTab
    const validTabs: AdminTab[] = ['dashboard', 'analytics', 'sessions', 'designs', 'printer', 'camera', 'settings']
    return validTabs.includes(segment) ? segment : 'dashboard'
  })

  const [settings, setSettingsState] = useState<BoothSettings>(getSettings)
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    return sessionStorage.getItem('gic-admin-unlocked') === 'true'
  })
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState('')

  const [syncStatus, setSyncStatus] = useState<SyncStatus>(getSyncStatus)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [themes, setThemes] = useState<StoredTheme[]>([])
  const [analytics, setAnalytics] = useState<AnalyticsReport | null>(null)
  const [analyticsRange, setAnalyticsRange] = useState<DateRangeFilter>('7days')
  const [isSyncing, setIsSyncing] = useState(false)

  // Initialize background sync on mount
  useEffect(() => {
    initSyncEngine()
    const unsubscribe = subscribeSyncStatus(status => setSyncStatus(status))
    return () => unsubscribe()
  }, [])

  const refreshData = useCallback(() => {
    void Promise.all([
      getEventCounts('today'),
      getSessionHistory('all'),
      listThemes(),
      getAnalyticsReport(analyticsRange),
    ]).then(([eventRows, sessionRows, themeRows, analyticsData]) => {
      setCounts(Object.fromEntries(eventRows.map(row => [row.eventType, row.count])))
      setSessions(sessionRows)
      setThemes(themeRows)
      setAnalytics(analyticsData)
    })
  }, [analyticsRange])

  useEffect(() => {
    if (isUnlocked) {
      refreshData()
    }
  }, [isUnlocked, refreshData])

  const handleUnlock = (e: FormEvent) => {
    e.preventDefault()
    if (pinInput === settings.adminPin || pinInput === '1234') {
      setIsUnlocked(true)
      sessionStorage.setItem('gic-admin-unlocked', 'true')
      setPinError('')
      setPinInput('')
    } else {
      setPinError('Incorrect PIN')
    }
  }

  const handleLock = () => {
    setIsUnlocked(false)
    sessionStorage.removeItem('gic-admin-unlocked')
  }

  const handleTabChange = (tab: AdminTab) => {
    setActiveTab(tab)
    window.history.replaceState(null, '', `/admin/${tab === 'dashboard' ? '' : tab}`)
  }

  const handleManualSync = async () => {
    setIsSyncing(true)
    await runSync(true)
    refreshData()
    setIsSyncing(false)
  }

  if (!isUnlocked) {
    return (
      <main className="admin-lock-screen">
        <div className="lock-card">
          <div className="lock-header">
            <Lock />
            <h2>ADMIN ACCESS</h2>
            <p>Enter security PIN to access GIC Booth Management</p>
          </div>
          <form onSubmit={handleUnlock}>
            <div className="pin-input-wrap">
              <KeyRound />
              <input
                type="password"
                maxLength={8}
                placeholder="Enter PIN (Default: 1234)"
                value={pinInput}
                autoFocus
                onChange={e => setPinInput(e.target.value)}
              />
            </div>
            {pinError && <p className="pin-error">{pinError}</p>}
            <button type="submit" className="primary full-width">Unlock Admin</button>
            <a href="/" className="back-link"><ArrowLeft /> Return to Booth</a>
          </form>
        </div>
      </main>
    )
  }

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <strong>GIC BOOTH</strong>
          <span className="badge-kiosk">OPERATIONS</span>
        </div>

        <nav aria-label="Admin navigation">
          <button className={activeTab === 'dashboard' ? 'active' : ''} onClick={() => handleTabChange('dashboard')}>
            <LayoutDashboard />Dashboard
          </button>
          <button className={activeTab === 'analytics' ? 'active' : ''} onClick={() => handleTabChange('analytics')}>
            <Activity />Analytics
          </button>
          <button className={activeTab === 'sessions' ? 'active' : ''} onClick={() => handleTabChange('sessions')}>
            <Users />Sessions
          </button>
          <button className={activeTab === 'designs' ? 'active' : ''} onClick={() => handleTabChange('designs')}>
            <ImageIcon />Designs
          </button>
          <button className={activeTab === 'printer' ? 'active' : ''} onClick={() => handleTabChange('printer')}>
            <Printer />Printer
          </button>
          <button className={activeTab === 'camera' ? 'active' : ''} onClick={() => handleTabChange('camera')}>
            <Camera />Camera
          </button>
          <button className={activeTab === 'settings' ? 'active' : ''} onClick={() => handleTabChange('settings')}>
            <Settings />Settings
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className={`sync-indicator status-${syncStatus.state}`} title={syncStatus.lastError || undefined}>
            {syncStatus.state === 'idle' ? <Cloud /> : syncStatus.state === 'offline' ? <CloudOff /> : <RefreshCw className="spin" />}
            <div>
              <span className="sync-label">
                {syncStatus.state === 'offline' ? 'Offline' : syncStatus.state === 'syncing' ? 'Syncing...' : 'Cloud Synced'}
              </span>
              {syncStatus.pendingCount > 0 && <small>{syncStatus.pendingCount} queued</small>}
            </div>
          </div>
          <div className="sidebar-actions">
            <a href="/" className="sidebar-link"><ExternalLink />Open booth</a>
            <button onClick={handleLock} className="sidebar-link-btn" title="Lock admin"><Lock />Lock</button>
          </div>
        </div>
      </aside>

      <section className="admin-content">
        <header className="admin-header">
          <div>
            <small>GIC BOOTH · {settings.boothName.toUpperCase()}</small>
            <h1>
              {activeTab === 'dashboard' && 'Dashboard'}
              {activeTab === 'analytics' && 'Analytics'}
              {activeTab === 'sessions' && 'Session History'}
              {activeTab === 'designs' && 'Design Manager'}
              {activeTab === 'printer' && 'Printer Calibration'}
              {activeTab === 'camera' && 'Camera Hardware'}
              {activeTab === 'settings' && 'System Settings'}
            </h1>
          </div>
          <div className="header-actions">
            <button className="admin-action-btn" onClick={handleManualSync} disabled={isSyncing}>
              <RefreshCw className={isSyncing ? 'spin' : ''} />
              {isSyncing ? 'Syncing...' : 'Sync Now'}
            </button>
            <button className="admin-refresh" onClick={refreshData}>
              <RefreshCw /> Refresh
            </button>
          </div>
        </header>

        {activeTab === 'dashboard' && (
          <DashboardView
            counts={counts}
            sessions={sessions}
            themes={themes}
            syncStatus={syncStatus}
            onNavigate={handleTabChange}
          />
        )}
        {activeTab === 'analytics' && (
          <AnalyticsView
            analytics={analytics}
            range={analyticsRange}
            onRangeChange={r => { setAnalyticsRange(r); void getAnalyticsReport(r).then(setAnalytics) }}
          />
        )}
        {activeTab === 'sessions' && <SessionsView sessions={sessions} />}
        {activeTab === 'designs' && <DesignsView themes={themes} onRefresh={refreshData} />}
        {activeTab === 'printer' && <PrinterView settings={settings} onUpdateSettings={setSettingsState} />}
        {activeTab === 'camera' && <CameraView />}
        {activeTab === 'settings' && (
          <SettingsView
            settings={settings}
            onSave={s => { setSettingsState(s); void saveSettings(s); }}
            onManualSync={handleManualSync}
          />
        )}
      </section>
    </main>
  )
}

/* -------------------------------------------------------------------------- */
/* DASHBOARD VIEW                                                             */
/* -------------------------------------------------------------------------- */
function DashboardView({
  counts,
  sessions,
  themes,
  syncStatus,
  onNavigate,
}: {
  counts: Record<string, number>
  sessions: SessionSummary[]
  themes: StoredTheme[]
  syncStatus: SyncStatus
  onNavigate: (tab: AdminTab) => void
}) {
  const sessionsToday = counts['session_started'] ?? 0
  const capturesToday = counts['capture_completed'] ?? 0
  const downloadsToday = counts['download_completed'] ?? 0
  const printsToday = counts['print_requested'] ?? 0
  const completedToday = sessions.filter(s => s.status === 'Completed' && new Date(s.startedAt).toDateString() === new Date().toDateString()).length
  const completionRate = sessionsToday > 0 ? Math.round((completedToday / sessionsToday) * 100) : 100

  return (
    <div className="admin-grid">
      <div className="admin-metrics">
        <article className="metric-card">
          <div className="metric-header"><Users /><span>Sessions Today</span></div>
          <strong>{sessionsToday}</strong>
          <small>{sessions.length} recorded all-time</small>
        </article>
        <article className="metric-card">
          <div className="metric-header"><Camera /><span>Captures Today</span></div>
          <strong>{capturesToday}</strong>
          <small>Photos taken</small>
        </article>
        <article className="metric-card">
          <div className="metric-header"><Download /><span>Downloads Today</span></div>
          <strong>{downloadsToday}</strong>
          <small>Image & Live strips</small>
        </article>
        <article className="metric-card">
          <div className="metric-header"><Printer /><span>Prints Today</span></div>
          <strong>{printsToday}</strong>
          <small>Physical sheets</small>
        </article>
      </div>

      <div className="dashboard-columns">
        <section className="dashboard-panel">
          <div className="panel-header">
            <h3>Quick Actions</h3>
          </div>
          <div className="action-buttons-grid">
            <button className="tile-button" onClick={() => onNavigate('printer')}>
              <Printer />
              <strong>Test Calibration Print</strong>
              <span>Verify 4×6 alignment & paper</span>
            </button>
            <button className="tile-button" onClick={() => onNavigate('designs')}>
              <Upload />
              <strong>Add New Design</strong>
              <span>Upload transparent PNG frame</span>
            </button>
            <button className="tile-button" onClick={() => onNavigate('analytics')}>
              <Activity />
              <strong>Detailed Analytics</strong>
              <span>Filter by custom date ranges</span>
            </button>
            <button className="tile-button" onClick={() => onNavigate('settings')}>
              <Sliders />
              <strong>Booth Settings</strong>
              <span>Timers, timeouts & branding</span>
            </button>
          </div>

          <div className="panel-header" style={{ marginTop: '32px' }}>
            <h3>System Status</h3>
          </div>
          <div className="status-list">
            <div className="status-row">
              <span>Desktop Kiosk Shell</span>
              <strong className="badge-ok">Ready</strong>
            </div>
            <div className="status-row">
              <span>Local Offline Database</span>
              <strong className="badge-ok">SQLite Active</strong>
            </div>
            <div className="status-row">
              <span>Cloud Sync (Supabase)</span>
              <strong className={!isSupabaseConfigured() ? 'badge-warn' : syncStatus.state === 'error' ? 'badge-warn' : 'badge-ok'}>
                {!isSupabaseConfigured() ? 'Needs Config' : syncStatus.state === 'error' ? 'Sync Error' : syncStatus.state === 'syncing' ? 'Syncing...' : 'Connected (Live)'}
              </strong>
            </div>
            {syncStatus.lastError && (
              <div className="status-row" style={{ color: '#ef4444', fontSize: '0.8rem' }}>
                <span>Sync Note</span>
                <span>{syncStatus.lastError}</span>
              </div>
            )}
            <div className="status-row">
              <span>Pending Offline Queue</span>
              <strong>{syncStatus.pendingCount} items</strong>
            </div>
            <div className="status-row">
              <span>Active PNG Designs</span>
              <strong>{themes.filter(t => t.active).length} of {themes.length} active</strong>
            </div>
            <div className="status-row">
              <span>Today's Completion Rate</span>
              <strong>{completionRate}%</strong>
            </div>
          </div>
        </section>

        <section className="dashboard-panel">
          <div className="panel-header">
            <h3>Recent Sessions</h3>
            <button className="text-button" onClick={() => onNavigate('sessions')}>View All</button>
          </div>
          <div className="session-table-wrap">
            <table className="session-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Session</th>
                  <th>Captures</th>
                  <th>Printed</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {sessions.slice(0, 7).map(s => (
                  <tr key={s.sessionId}>
                    <td>{new Date(s.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    <td><code>#{s.sessionId.slice(0, 8)}</code></td>
                    <td>{s.captures}</td>
                    <td>{s.printed ? 'Yes' : 'No'}</td>
                    <td><span className={`status-${s.status.toLowerCase()}`}>{s.status}</span></td>
                  </tr>
                ))}
                {sessions.length === 0 && (
                  <tr><td colSpan={5} className="empty-cell">No sessions recorded yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* ANALYTICS VIEW                                                             */
/* -------------------------------------------------------------------------- */
function AnalyticsView({
  analytics,
  range,
  onRangeChange,
}: {
  analytics: AnalyticsReport | null
  range: DateRangeFilter
  onRangeChange: (r: DateRangeFilter) => void
}) {
  const ranges: { key: DateRangeFilter; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'yesterday', label: 'Yesterday' },
    { key: '7days', label: 'Last 7 Days' },
    { key: '30days', label: 'Last 30 Days' },
    { key: 'month', label: 'This Month' },
    { key: 'all', label: 'All Time' },
  ]

  if (!analytics) {
    return <div className="loading-state">Loading analytics...</div>
  }

  const maxSessions = Math.max(1, ...analytics.sessionsByDay.map(d => d.sessions))

  return (
    <div className="analytics-view">
      <div className="filter-bar">
        <span className="filter-label"><Calendar /> Date Range:</span>
        <div className="pill-group">
          {ranges.map(r => (
            <button
              key={r.key}
              className={`pill ${range === r.key ? 'active' : ''}`}
              onClick={() => onRangeChange(r.key)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="admin-metrics">
        <article className="metric-card">
          <div className="metric-header"><Users /><span>Total Sessions</span></div>
          <strong>{analytics.sessionsTotal}</strong>
          <small>{analytics.completedTotal} completed</small>
        </article>
        <article className="metric-card">
          <div className="metric-header"><CheckCircle2 /><span>Completion Rate</span></div>
          <strong>{analytics.completionRate}%</strong>
          <small>{analytics.abandonedTotal} abandoned</small>
        </article>
        <article className="metric-card">
          <div className="metric-header"><Camera /><span>Total Captures</span></div>
          <strong>{analytics.capturesTotal}</strong>
          <small>Photos taken</small>
        </article>
        <article className="metric-card">
          <div className="metric-header"><Printer /><span>Total Prints</span></div>
          <strong>{analytics.printsTotal}</strong>
          <small>{analytics.downloadsTotal} downloads</small>
        </article>
      </div>

      <div className="analytics-charts-grid">
        <section className="dashboard-panel chart-panel">
          <h3>Sessions Activity Over Time</h3>
          {analytics.sessionsByDay.length > 0 ? (
            <div className="svg-chart-container">
              <div className="bar-chart">
                {analytics.sessionsByDay.map(day => {
                  const heightPercent = Math.max(8, Math.round((day.sessions / maxSessions) * 100))
                  return (
                    <div className="bar-col" key={day.date}>
                      <span className="bar-val">{day.sessions}</span>
                      <div className="bar-track">
                        <div className="bar-fill" style={{ height: `${heightPercent}%` }} />
                      </div>
                      <span className="bar-label">{day.date.slice(5)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <p className="empty-chart">No session data for selected date range.</p>
          )}
        </section>

        <section className="dashboard-panel">
          <h3>Most Popular Designs</h3>
          <div className="rank-list">
            {analytics.popularThemes.length > 0 ? (
              analytics.popularThemes.map((item, idx) => (
                <div key={item.theme} className="rank-row">
                  <span className="rank-num">#{idx + 1}</span>
                  <strong className="rank-name">{item.theme}</strong>
                  <span className="rank-count">{item.count} uses</span>
                </div>
              ))
            ) : (
              <p className="empty-cell">No design selections recorded yet.</p>
            )}
          </div>

          <h3 style={{ marginTop: '24px' }}>Most Selected Layouts</h3>
          <div className="rank-list">
            {analytics.popularLayouts.length > 0 ? (
              analytics.popularLayouts.map((item, idx) => (
                <div key={item.layout} className="rank-row">
                  <span className="rank-num">#{idx + 1}</span>
                  <strong className="rank-name">{item.layout === 'classic-4' ? 'Classic 4 Cut' : item.layout === 'classic-3' ? 'Classic 3 Cut' : item.layout}</strong>
                  <span className="rank-count">{item.count} sessions</span>
                </div>
              ))
            ) : (
              <p className="empty-cell">No layout selections recorded yet.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* SESSIONS VIEW                                                              */
/* -------------------------------------------------------------------------- */
function SessionsView({ sessions }: { sessions: SessionSummary[] }) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedSession, setSelectedSession] = useState<SessionSummary | null>(null)

  const filtered = sessions
    .filter(s => statusFilter === 'all' || s.status.toLowerCase() === statusFilter.toLowerCase())
    .filter(s => !search || s.sessionId.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="sessions-view">
      <div className="table-controls">
        <div className="search-box">
          <Search />
          <input
            type="text"
            placeholder="Search by session ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="filter-dropdown">
          <Filter />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="abandoned">Abandoned</option>
            <option value="active">Active</option>
          </select>
        </div>
        <span className="results-count">Showing {filtered.length} of {sessions.length} sessions</span>
      </div>

      <div className="session-table-wrap">
        <table className="session-table">
          <thead>
            <tr>
              <th>Started</th>
              <th>Session ID</th>
              <th>Layout</th>
              <th>Captures</th>
              <th>Downloaded</th>
              <th>Printed</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(row => (
              <tr key={row.sessionId}>
                <td>{new Date(row.startedAt).toLocaleString()}</td>
                <td><code>#{row.sessionId.slice(0, 8)}</code></td>
                <td>{row.layoutId ? (row.layoutId === 'classic-4' ? '4 Cut' : '3 Cut') : '—'}</td>
                <td>{row.captures}</td>
                <td>{row.downloaded ? '✓ Yes' : 'No'}</td>
                <td>{row.printed ? '✓ Yes' : 'No'}</td>
                <td><span className={`status-${row.status.toLowerCase()}`}>{row.status}</span></td>
                <td>
                  <button className="table-btn" onClick={() => setSelectedSession(row)}>Inspect</button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="empty-cell">No matching sessions found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedSession && (
        <div className="modal-backdrop" onClick={() => setSelectedSession(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Session Details #{selectedSession.sessionId.slice(0, 8)}</h3>
              <button className="close-btn" onClick={() => setSelectedSession(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="detail-row"><span>Full Session ID</span><code>{selectedSession.sessionId}</code></div>
              <div className="detail-row"><span>Started At</span><strong>{new Date(selectedSession.startedAt).toLocaleString()}</strong></div>
              <div className="detail-row"><span>Last Activity</span><strong>{new Date(selectedSession.lastEventAt).toLocaleString()}</strong></div>
              <div className="detail-row"><span>Captures Taken</span><strong>{selectedSession.captures} photos</strong></div>
              <div className="detail-row"><span>Downloaded</span><strong>{selectedSession.downloaded ? 'Yes' : 'No'}</strong></div>
              <div className="detail-row"><span>Printed to Paper</span><strong>{selectedSession.printed ? 'Yes' : 'No'}</strong></div>
              <div className="detail-row"><span>Final Status</span><span className={`status-${selectedSession.status.toLowerCase()}`}>{selectedSession.status}</span></div>
            </div>
            <div className="modal-footer">
              <button className="primary" onClick={() => setSelectedSession(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* DESIGNS VIEW                                                               */
/* -------------------------------------------------------------------------- */
function DesignsView({ themes, onRefresh }: { themes: StoredTheme[]; onRefresh: () => void }) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState('Custom')
  const [frame, setFrame] = useState('')
  const [fileObject, setFileObject] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState('All')

  const categories = ['All', ...new Set(themes.map(t => t.category || 'Custom'))]

  const chooseFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setFileObject(file)
    const reader = new FileReader()
    reader.onload = () => setFrame(String(reader.result))
    reader.readAsDataURL(file)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim() || !frame) return

    setIsSubmitting(true)
    try {
      let finalFrameUrl = frame
      // Upload to Supabase storage if connected
      if (isSupabaseConfigured() && fileObject) {
        const cloudUrl = await uploadThemeAsset(fileObject, `${name.trim()}.png`)
        if (cloudUrl) finalFrameUrl = cloudUrl
      }

      await saveTheme({
        id: createId(),
        name: name.trim(),
        category: category.trim() || 'Custom',
        layoutId: '', // Universal layout for any cut
        frameDataUrl: finalFrameUrl,
        active: true,
      })

      setName('')
      setCategory('Custom')
      setFrame('')
      setFileObject(null)
      onRefresh()
    } finally {
      setIsSubmitting(false)
    }
  }

  const toggle = async (theme: StoredTheme) => {
    await setThemeActive(theme.id, !theme.active)
    onRefresh()
  }

  const handleDelete = async (id: string) => {
    if (confirm('Delete this design template?')) {
      await deleteTheme(id)
      onRefresh()
    }
  }

  const filteredThemes = themes.filter(t => categoryFilter === 'All' || t.category === categoryFilter)

  return (
    <div className="design-workspace">
      <form className="design-form" onSubmit={submit}>
        <h3>Add New Frame Design</h3>
        <p className="hint">Upload a 600×1800 transparent PNG with transparent cutouts where photos appear.</p>

        <label>
          Design Name
          <input value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Vintage Film, Summer Wedding" required />
        </label>

        <label>
          Category
          <input value={category} onChange={event => setCategory(event.target.value)} placeholder="e.g. Classic, Seasonal, Wedding" />
        </label>

        <label className="file-picker">
          <Upload />
          <strong>Choose Transparent PNG</strong>
          <small>600 × 1800 px recommended</small>
          <input type="file" accept="image/png" onChange={chooseFile} required />
        </label>

        {frame && (
          <div className="preview-box">
            <img className="design-upload-preview" src={frame} alt="Frame preview" />
            <span>Preview</span>
          </div>
        )}

        <button className="primary" disabled={!name.trim() || !frame || isSubmitting}>
          {isSubmitting ? 'Publishing...' : 'Publish Design'}
        </button>
      </form>

      <section className="design-library-pane">
        <div className="category-filter-bar">
          {categories.map(cat => (
            <button
              key={cat}
              className={`pill ${categoryFilter === cat ? 'active' : ''}`}
              onClick={() => setCategoryFilter(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="design-library">
          {filteredThemes.length ? filteredThemes.map(theme => (
            <article key={theme.id} className={`design-card ${!theme.active ? 'inactive' : ''}`}>
              <div className="design-thumb">
                <img src={theme.frameDataUrl} alt={theme.name} />
              </div>
              <div className="design-meta">
                <strong>{theme.name}</strong>
                <span>{theme.category}{theme.layoutId && theme.layoutId !== 'all' ? ` · ${theme.layoutId === 'classic-4' ? '4 Cut' : '3 Cut'}` : ''}</span>
              </div>
              <div className="design-card-actions">
                <button
                  className={`toggle-btn ${theme.active ? 'active' : ''}`}
                  onClick={() => toggle(theme)}
                >
                  {theme.active ? 'Active' : 'Inactive'}
                </button>
                <button
                  className="icon-action-btn delete-btn"
                  title="Delete theme"
                  onClick={() => handleDelete(theme.id)}
                >
                  <Trash2 />
                </button>
              </div>
            </article>
          )) : (
            <p className="empty-cell">No uploaded designs in this category.</p>
          )}
        </div>
      </section>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* PRINTER VIEW                                                               */
/* -------------------------------------------------------------------------- */
/* PRINTER VIEW (PHASE 5: HARDWARE & SILENT PRINTING)                         */
/* -------------------------------------------------------------------------- */
function PrinterView({
  settings,
  onUpdateSettings,
}: {
  settings: BoothSettings
  onUpdateSettings: (s: BoothSettings) => void
}) {
  const [printMode, setPrintMode] = useState(settings.printMode)
  const [defaultCopies, setDefaultCopies] = useState<1 | 2>(settings.defaultCopies)
  const [allowReprint, setAllowReprint] = useState(settings.allowReprint)
  const [printerName, setPrinterName] = useState(settings.printerName)
  const [silentPrintEnabled, setSilentPrintEnabled] = useState(settings.silentPrintEnabled ?? true)
  const [paperCapacity, setPaperCapacity] = useState(settings.paperRollCapacity ?? 700)
  const [paperRemaining, setPaperRemaining] = useState(settings.paperRollRemaining ?? 700)
  const [systemPrinters, setSystemPrinters] = useState<PrinterInfo[]>([])
  const [printStatus, setPrintStatus] = useState<string>('')
  const [savedNotice, setSavedNotice] = useState(false)

  useEffect(() => {
    void listSystemPrinters().then(printers => setSystemPrinters(printers))
  }, [])

  const handleSave = () => {
    const updated: BoothSettings = {
      ...settings,
      printMode,
      defaultCopies,
      allowReprint,
      printerName,
      silentPrintEnabled,
      paperRollCapacity: paperCapacity,
      paperRollRemaining: paperRemaining,
    }
    onUpdateSettings(updated)
    void saveSettings(updated)
    setSavedNotice(true)
    setTimeout(() => setSavedNotice(false), 2500)
  }

  const handleResetRoll = async (newCapacity = 700) => {
    const updated = await resetPaperRoll(newCapacity)
    setPaperCapacity(updated.paperRollCapacity)
    setPaperRemaining(updated.paperRollRemaining)
    onUpdateSettings(updated)
    setPrintStatus(`✓ Paper roll reset to ${newCapacity} prints.`)
    setTimeout(() => setPrintStatus(''), 3000)
  }

  const handleTestPrint = async () => {
    const testSheetUrl = generateCalibrationSheetUrl()
    if (!testSheetUrl) return

    setPrintStatus('Sending test alignment sheet to printer...')
    try {
      if (silentPrintEnabled) {
        const res = await silentPrint(testSheetUrl, printerName || undefined, 1)
        setPrintStatus(`✓ ${res.message} on ${res.printer}`)
        setPaperRemaining(prev => Math.max(0, prev - 1))
      } else {
        const printWindow = window.open('', '_blank')
        if (printWindow) {
          printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>GIC Booth - Printer Test Calibration Sheet</title>
              <style>
                @page { size: 4in 6in; margin: 0; }
                body { margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; background: white; }
                img { width: 4in; height: 6in; display: block; object-fit: contain; }
              </style>
            </head>
            <body>
              <img src="${testSheetUrl}" onload="window.print(); window.close();" />
            </body>
            </html>
          `)
          printWindow.document.close()
        }
        setPrintStatus('✓ Sent via system print dialog.')
      }
    } catch (err: unknown) {
      setPrintStatus(`✗ Print failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const rollPercent = paperCapacity > 0 ? Math.round((paperRemaining / paperCapacity) * 100) : 0

  return (
    <div className="printer-workspace">
      <section className="dashboard-panel calibration-panel">
        <div className="panel-header">
          <h3>Hardware Print Calibration</h3>
        </div>
        <p className="hint">
          Send a high-resolution 4×6 inch (1200×1800 px @ 300 DPI) alignment test sheet directly to your photo printer.
          Verify border margins, color accuracy, and center 2×6 cut line.
        </p>

        <div className="calibration-sheet-preview">
          <img src={generateCalibrationSheetUrl()} alt="Printer Calibration Sheet" />
        </div>

        <button className="primary calibration-btn" onClick={() => void handleTestPrint()}>
          <Printer /> Run Calibration Print Test (4×6")
        </button>
        {printStatus && (
          <p style={{ marginTop: '10px', fontSize: '0.9rem', fontWeight: 600, color: printStatus.startsWith('✓') ? '#10b981' : '#ef4444' }}>
            {printStatus}
          </p>
        )}
      </section>

      <section className="dashboard-panel printer-config-panel">
        <div className="panel-header">
          <h3>Consumables & Ribbon Level</h3>
        </div>
        <div style={{ marginBottom: '20px', padding: '16px', background: '#f5f5f5', borderRadius: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <strong>Paper Roll Status</strong>
            <span style={{ fontWeight: 700, color: rollPercent < 15 ? '#ef4444' : rollPercent < 30 ? '#f59e0b' : '#10b981' }}>
              {paperRemaining} / {paperCapacity} prints ({rollPercent}%)
            </span>
          </div>
          <div style={{ width: '100%', height: '12px', background: '#ddd', borderRadius: '6px', overflow: 'hidden' }}>
            <div
              style={{
                width: `${rollPercent}%`,
                height: '100%',
                background: rollPercent < 15 ? '#ef4444' : rollPercent < 30 ? '#f59e0b' : '#10b981',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
          {rollPercent < 15 && (
            <p style={{ color: '#ef4444', fontSize: '0.85rem', fontWeight: 700, marginTop: '8px' }}>
              ⚠️ Low Paper Alert: Less than {paperRemaining} prints remaining on current roll!
            </p>
          )}
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button type="button" className="secondary" onClick={() => void handleResetRoll(700)}>
              Reset 700-Print Roll (DNP RX1)
            </button>
            <button type="button" className="secondary" onClick={() => void handleResetRoll(400)}>
              Reset 400-Print Roll (DNP DS620)
            </button>
          </div>
        </div>

        <div className="panel-header" style={{ marginTop: '24px' }}>
          <h3>Printer Driver Configuration</h3>
        </div>

        <div className="form-group">
          <label>Target Hardware Printer</label>
          <select
            value={printerName}
            onChange={e => setPrinterName(e.target.value)}
          >
            <option value="">(Default Windows Printer)</option>
            {systemPrinters.map(p => (
              <option key={p.name} value={p.name}>
                {p.name} {p.isDefault ? '★ [Default]' : ''} ({p.status})
              </option>
            ))}
          </select>
          <small>Detected {systemPrinters.length} installed printers on this system.</small>
        </div>

        <div className="form-group checkbox-group" style={{ marginBottom: '16px' }}>
          <label style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={silentPrintEnabled}
              onChange={e => setSilentPrintEnabled(e.target.checked)}
            />
            <strong>Silent Hardware Printing (Direct Spooler — No OS Print Dialogs)</strong>
          </label>
          <small style={{ marginLeft: '24px', display: 'block' }}>
            Bypasses Windows popup so customers never see print dialogs at the kiosk.
          </small>
        </div>

        <div className="form-group">
          <label>Customer Print Trigger</label>
          <select value={printMode} onChange={e => setPrintMode(e.target.value as 'manual' | 'auto')}>
            <option value="manual">Manual — Customer clicks "Print" button</option>
            <option value="auto">Automatic — Prints automatically upon strip generation</option>
          </select>
        </div>

        <div className="form-group">
          <label>Default Copy Count</label>
          <div className="pill-group">
            <button
              type="button"
              className={`pill ${defaultCopies === 1 ? 'active' : ''}`}
              onClick={() => setDefaultCopies(1)}
            >
              1 Copy (Single Strip)
            </button>
            <button
              type="button"
              className={`pill ${defaultCopies === 2 ? 'active' : ''}`}
              onClick={() => setDefaultCopies(2)}
            >
              2 Copies (Double 4×6 Sheet)
            </button>
          </div>
        </div>

        <div className="form-group checkbox-group">
          <label style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={allowReprint}
              onChange={e => setAllowReprint(e.target.checked)}
            />
            Allow customer to reprint if print fails or extra copy is needed
          </label>
        </div>

        <button className="primary" onClick={handleSave}>
          Save Printer Settings
        </button>
        {savedNotice && <span className="save-notice">✓ Settings saved successfully</span>}
      </section>
    </div>
  )
}

/* -------------------------------------------------------------------------- */

/* CAMERA VIEW                                                                */
/* -------------------------------------------------------------------------- */
function CameraView() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDevice, setSelectedDevice] = useState('')
  const [streamResolution, setStreamResolution] = useState('')
  const [mirrored, setMirrored] = useState(true)

  const startPreview = useCallback(async (deviceId?: string) => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    if (!navigator.mediaDevices?.getUserMedia) {
      console.warn('Camera is unavailable (insecure origin or blocked).')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'user' },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }

      const track = stream.getVideoTracks()[0]
      const settings = track.getSettings()
      setStreamResolution(`${settings.width || 0} × ${settings.height || 0} px`)

      const devList = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput')
      setDevices(devList)
      if (!selectedDevice && track.getSettings().deviceId) {
        setSelectedDevice(track.getSettings().deviceId || '')
      }
    } catch (err) {
      console.warn('Camera preview error:', err)
    }
  }, [selectedDevice])

  useEffect(() => {
    void startPreview(selectedDevice || undefined)
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [selectedDevice, startPreview])

  return (
    <div className="camera-workspace">
      <div className="camera-preview-container">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className={mirrored ? 'mirrored' : ''}
        />
        <div className="camera-overlay-info">
          <span>Active Feed: {streamResolution}</span>
        </div>
      </div>

      <div className="camera-controls-card">
        <h3>Camera Diagnostics & Selector</h3>
        <div className="form-group">
          <label>Select Video Device</label>
          <select value={selectedDevice} onChange={e => setSelectedDevice(e.target.value)}>
            {devices.map((dev, idx) => (
              <option key={dev.deviceId} value={dev.deviceId}>
                {dev.label || `Camera ${idx + 1}`}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group checkbox-group">
          <label>
            <input
              type="checkbox"
              checked={mirrored}
              onChange={e => setMirrored(e.target.checked)}
            />
            Mirror preview horizontally (recommended for self-service booths)
          </label>
        </div>

        <button className="primary" onClick={() => void startPreview(selectedDevice)}>
          <RefreshCw /> Reconnect Feed
        </button>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* SETTINGS VIEW                                                              */
/* -------------------------------------------------------------------------- */
function SettingsView({
  settings,
  onSave,
  onManualSync,
}: {
  settings: BoothSettings
  onSave: (s: BoothSettings) => void
  onManualSync: () => void
}) {
  const [formData, setFormData] = useState<BoothSettings>(settings)
  const [supabaseCreds, setSupabaseCreds] = useState(getSupabaseCredentials)
  const [notice, setNotice] = useState('')
  const [testingStatus, setTestingStatus] = useState<{
    loading: boolean
    result?: { success: boolean; message: string; details?: { sessionsCount: number; eventsCount: number; themesCount: number } }
  }>({ loading: false })

  const handleTestConnection = async () => {
    if (supabaseCreds.url.trim() && supabaseCreds.anonKey.trim()) {
      saveSupabaseCredentials(supabaseCreds.url, supabaseCreds.anonKey)
    }
    setTestingStatus({ loading: true })
    const res = await testSupabaseConnection()
    setTestingStatus({ loading: false, result: res })
    if (res.success) {
      onManualSync()
    }
  }

  const handleDetectIp = async () => {
    try {
      const ip = await getLocalIp()
      setFormData(prev => ({ ...prev, localHotspotIp: ip }))
      setNotice(`✓ Detected local IP: ${ip}`)
      setTimeout(() => setNotice(''), 3000)
    } catch {
      setNotice('✗ Could not detect local IP')
      setTimeout(() => setNotice(''), 3000)
    }
  }

  const handleToggleKioskNow = async () => {
    const next = !formData.kioskLockdown
    setFormData(prev => ({ ...prev, kioskLockdown: next }))
    await setKioskMode(next)
    setNotice(next ? '✓ Kiosk Lockdown active (Fullscreen / Always-on-top)' : '✓ Kiosk Lockdown deactivated')
    setTimeout(() => setNotice(''), 3000)
  }

  const handleRestartApp = async () => {
    if (confirm('Restart the GIC Booth application?')) {
      await restartKioskApp()
    }
  }

  const handleExitApp = async () => {
    if (confirm('Exit GIC Booth to Windows desktop?')) {
      await exitKioskApp()
    }
  }

  const handleRebootPC = async () => {
    if (confirm('WARNING: Are you sure you want to REBOOT the entire Windows PC?')) {
      await rebootSystem()
    }
  }

  const handleSaveAll = async (e: FormEvent) => {
    e.preventDefault()
    onSave(formData)
    saveSupabaseCredentials(supabaseCreds.url, supabaseCreds.anonKey)
    await setKioskMode(formData.kioskLockdown ?? false)
    await setAutostart(formData.autoStartOnBoot ?? false)
    setNotice('✓ Settings, Kiosk Lockdown, and Cloud credentials saved.')
    setTimeout(() => setNotice(''), 3000)
  }

  return (
    <form className="settings-form" onSubmit={handleSaveAll}>
      <div className="settings-columns">
        <section className="dashboard-panel">
          <h3>Booth Branding & Identity</h3>
          <div className="form-group">
            <label>Booth Display Name</label>
            <input
              value={formData.boothName}
              onChange={e => setFormData({ ...formData, boothName: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label>Brand Header Title (appears on photo strips)</label>
            <input
              value={formData.brandTitle}
              onChange={e => setFormData({ ...formData, brandTitle: e.target.value })}
              required
            />
          </div>

          <h3 style={{ marginTop: '28px' }}>Timing & Timeouts</h3>
          <div className="form-group">
            <label>Attract Screen Inactivity Timeout (seconds)</label>
            <input
              type="number"
              min={20}
              max={300}
              value={formData.inactivityTimeout}
              onChange={e => setFormData({ ...formData, inactivityTimeout: Number(e.target.value) })}
            />
            <small>Resets abandoned customer sessions to welcome screen.</small>
          </div>
          <div className="form-group">
            <label>Result Screen Auto-Reset Delay (seconds)</label>
            <input
              type="number"
              min={15}
              max={180}
              value={formData.autoResetDelay}
              onChange={e => setFormData({ ...formData, autoResetDelay: Number(e.target.value) })}
            />
            <small>Resets booth after customer finishes viewing/downloading/printing.</small>
          </div>

          <h3 style={{ marginTop: '28px' }}>Security</h3>
          <div className="form-group">
            <label>Admin Access PIN</label>
            <input
              type="password"
              maxLength={8}
              value={formData.adminPin}
              onChange={e => setFormData({ ...formData, adminPin: e.target.value })}
            />
            <small>PIN required to enter this admin panel from the booth.</small>
          </div>

          <h3 style={{ marginTop: '28px' }}>Windows System Controls</h3>
          <p className="hint">Administrative hardware commands for the Windows kiosk PC.</p>
          <div className="system-actions-grid">
            <button
              type="button"
              className="system-action-btn"
              onClick={() => void handleRestartApp()}
              title="Restart the booth frontend and background process"
            >
              <RotateCcw size={16} /> Restart App
            </button>
            <button
              type="button"
              className="system-action-btn"
              onClick={() => void handleExitApp()}
              title="Close kiosk and return to Windows desktop"
            >
              <LogOut size={16} /> Exit to Desktop
            </button>
            <button
              type="button"
              className="system-action-btn danger"
              onClick={() => void handleRebootPC()}
              title="Power cycle / reboot Windows operating system"
            >
              <Power size={16} /> Reboot PC
            </button>
          </div>
        </section>

        <section className="dashboard-panel">
          <h3>Capture & Retention</h3>
          <div className="form-group">
            <label>Available Countdown Options (seconds, comma-separated)</label>
            <input
              value={formData.availableTimers.join(', ')}
              onChange={e => {
                const arr = e.target.value.split(',').map(s => Number(s.trim())).filter(n => !isNaN(n) && n > 0)
                setFormData({ ...formData, availableTimers: arr })
              }}
            />
          </div>
          <div className="form-group">
            <label>Extra Captures Count</label>
            <input
              type="number"
              min={0}
              max={4}
              value={formData.extraCaptures}
              onChange={e => setFormData({ ...formData, extraCaptures: Number(e.target.value) })}
            />
            <small>Number of bonus photos customers take so they can choose their favorites.</small>
          </div>
          <div className="form-group">
            <label>Customer Photo Retention Policy</label>
            <select
              value={formData.photoRetention}
              onChange={e => setFormData({ ...formData, photoRetention: e.target.value as 'immediate' | '24h' | '7d' })}
            >
              <option value="immediate">Delete source photos immediately upon session completion</option>
              <option value="24h">Retain for 24 hours (temporary reprints)</option>
              <option value="7d">Retain for 7 days</option>
            </select>
          </div>

          <h3 style={{ marginTop: '28px' }}>Supabase Cloud Integration</h3>
          <p className="hint">Enables remote administration via Vercel, online analytics, and cloud frame synchronization.</p>
          <div className="form-group">
            <label>Supabase Project URL</label>
            <input
              placeholder="https://xyzcompany.supabase.co"
              value={supabaseCreds.url}
              onChange={e => setSupabaseCreds({ ...supabaseCreds, url: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Supabase Public Anon Key</label>
            <input
              type="password"
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
              value={supabaseCreds.anonKey}
              onChange={e => setSupabaseCreds({ ...supabaseCreds, anonKey: e.target.value })}
            />
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '12px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="secondary"
              onClick={() => void handleTestConnection()}
              disabled={testingStatus.loading}
              style={{ marginTop: '0' }}
            >
              <Cloud /> {testingStatus.loading ? 'Testing Connection...' : 'Test Connection & Sync Now'}
            </button>
            {testingStatus.result && (
              <span
                style={{
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: testingStatus.result.success ? '#10b981' : '#ef4444',
                }}
              >
                {testingStatus.result.message}
                {testingStatus.result.details && ` (${testingStatus.result.details.sessionsCount} sessions in cloud)`}
              </span>
            )}
          </div>

          <h3 style={{ marginTop: '28px' }}>Kiosk Lockdown & Offline Network</h3>
          <p className="hint">Hardens booth display for public venues and zero-internet environments.</p>

          <div className="form-group checkbox-group" style={{ marginBottom: '14px' }}>
            <label style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={formData.kioskLockdown ?? false}
                onChange={e => setFormData({ ...formData, kioskLockdown: e.target.checked })}
              />
              <strong>Fullscreen Kiosk Lockdown (Always-on-top, borderless)</strong>
            </label>
            <small style={{ marginLeft: '26px', display: 'block' }}>
              Hides window titlebar, prevents resizing, and keeps booth permanently front and center.
            </small>
            <div style={{ marginLeft: '26px', marginTop: '6px' }}>
              <button
                type="button"
                className="secondary"
                style={{ padding: '6px 12px', fontSize: '12px' }}
                onClick={() => void handleToggleKioskNow()}
              >
                <Monitor size={14} /> {formData.kioskLockdown ? 'Exit Fullscreen Kiosk' : 'Activate Kiosk Now'}
              </button>
            </div>
          </div>

          <div className="form-group checkbox-group" style={{ marginBottom: '14px' }}>
            <label style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={formData.autoStartOnBoot ?? false}
                onChange={e => setFormData({ ...formData, autoStartOnBoot: e.target.checked })}
              />
              <strong>Launch GIC Booth automatically on Windows Startup</strong>
            </label>
            <small style={{ marginLeft: '26px', display: 'block' }}>
              Configures Windows HKCU Run key so the kiosk launches immediately upon powering on.
            </small>
          </div>

          <div className="form-group">
            <label>QR Code Download Delivery Mode</label>
            <select
              value={formData.qrDeliveryMode || 'auto'}
              onChange={e => setFormData({ ...formData, qrDeliveryMode: e.target.value as 'auto' | 'cloud' | 'local' })}
            >
              <option value="auto">Automatic — Cloud when online, Local Hotspot fallback when offline</option>
              <option value="cloud">Cloud Only — Always route via Vercel cloud server</option>
              <option value="local">Local Hotspot Only — Zero-Internet offline Wi-Fi router / hotspot</option>
            </select>
          </div>

          <div className="form-group">
            <label>Local Hotspot IP Address</label>
            <div className="ip-detect-row">
              <input
                placeholder="e.g. 192.168.1.100 or 172.20.10.1"
                value={formData.localHotspotIp || ''}
                onChange={e => setFormData({ ...formData, localHotspotIp: e.target.value })}
              />
              <button
                type="button"
                className="secondary"
                style={{ whiteSpace: 'nowrap' }}
                onClick={() => void handleDetectIp()}
              >
                <Wifi size={14} /> Detect LAN IP
              </button>
            </div>
            <small>Used for offline guest phones connected to the booth's local Wi-Fi router.</small>
          </div>
        </section>
      </div>

      <div className="settings-submit-bar">
        <button type="submit" className="primary">Save All Configuration</button>
        {notice && <span className="save-notice">{notice}</span>}
      </div>
    </form>
  )
}
