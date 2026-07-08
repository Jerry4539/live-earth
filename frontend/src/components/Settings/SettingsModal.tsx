import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Settings, Key, Clock, Shield, Eye, EyeOff,
  Save, CheckCircle, AlertCircle, ExternalLink, RefreshCw, LogIn,
} from 'lucide-react'
import { apiClient } from '../../api/client'

/* ── Types ──────────────────────────────────────────────────────────────────── */
interface SettingEntry {
  key: string
  value: string
  description: string
  is_secret: boolean
  has_value: boolean
  updated_at: string | null
}

interface SettingsModalProps {
  open: boolean
  onClose: () => void
}

/* ── Static data ────────────────────────────────────────────────────────────── */
const KEY_LABELS: Record<string, string> = {
  cesium_ion_token:     'CesiumJS Ion Token',
  nasa_firms_map_key:   'NASA FIRMS MAP_KEY',
  openaq_api_key:       'OpenAQ API Key',
  earthquakes_interval: 'Earthquakes Interval',
  weather_interval:     'Weather Interval',
  satellites_interval:  'Satellites Interval',
  volcanoes_interval:   'Volcanoes Interval',
  wildfires_interval:   'Wildfires Interval',
  airquality_interval:  'Air Quality Interval',
}

const KEY_LINKS: Record<string, string> = {
  cesium_ion_token:   'https://ion.cesium.com',
  nasa_firms_map_key: 'https://firms.modaps.eosdis.nasa.gov/api/',
  openaq_api_key:     'https://openaq.org',
}

const KEY_DESC: Record<string, string> = {
  cesium_ion_token:   'Enables satellite imagery & terrain. Free at ion.cesium.com.',
  nasa_firms_map_key: 'Higher-resolution wildfire data from NASA.',
  openaq_api_key:     'Air quality stations worldwide.',
}

const API_KEYS = ['cesium_ion_token', 'nasa_firms_map_key', 'openaq_api_key']
const INTERVAL_KEYS = [
  'earthquakes_interval',
  'weather_interval',
  'satellites_interval',
  'volcanoes_interval',
  'wildfires_interval',
  'airquality_interval',
]
const LAYER_ICONS: Record<string, string> = {
  earthquakes_interval: '🌍',
  weather_interval:     '🌤️',
  satellites_interval:  '🛰️',
  volcanoes_interval:   '🌋',
  wildfires_interval:   '🔥',
  airquality_interval:  '💨',
}

/* ── Sub-components ─────────────────────────────────────────────────────────── */
function SecretInput({ id, value, onChange, placeholder }: {
  id: string; value: string; onChange: (v: string) => void; placeholder?: string
}) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <input
        id={id}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || 'Paste your key here…'}
        autoComplete="off"
        style={{
          width: '100%', background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px',
          color: 'var(--text-primary)', fontFamily: 'var(--font-mono)',
          fontSize: '12px', padding: '9px 38px 9px 12px',
          outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s',
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent-primary)')}
        onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
      />
      <button type="button" onClick={() => setShow((s) => !s)} tabIndex={-1}
        style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', padding: '2px' }}>
        {show ? <EyeOff size={13} /> : <Eye size={13} />}
      </button>
    </div>
  )
}

function IntervalSlider({ id, value, onChange, label, icon }: {
  id: string; value: string; onChange: (v: string) => void; label: string; icon: string
}) {
  const s = parseInt(value) || 60
  const display = s >= 3600 ? `${Math.floor(s / 3600)}h` : s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <span style={{ fontSize: '18px', flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '6px' }}>{label}</div>
        <input id={id} type="range" min={15} max={3600} step={15} value={value}
          onChange={(e) => onChange(e.target.value)} style={{ width: '100%' }} />
      </div>
      <div style={{ minWidth: '52px', textAlign: 'right', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)', fontWeight: 600 }}>
        {display}
      </div>
    </div>
  )
}

/* ── Login Panel ──────────────────────────────────────────────────────────────── */
function LoginPanel({ onSuccess }: { onSuccess: () => void }) {
  const [user, setUser] = useState('admin')
  const [pass, setPass] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const login = async () => {
    setLoading(true); setError('')
    try {
      const form = new URLSearchParams()
      form.append('username', user)
      form.append('password', pass)
      const { data } = await apiClient.post('/auth/login', form, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      })
      localStorage.setItem('wl_token', data.access_token)
      localStorage.setItem('wl_user', user)
      onSuccess()
    } catch {
      setError('Invalid credentials')
    }
    setLoading(false)
  }

  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ padding: '14px', borderRadius: '10px', background: 'rgba(79,158,255,0.07)', border: '1px solid rgba(79,158,255,0.15)', marginBottom: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <LogIn size={14} color="var(--accent-primary)" />
          <span style={{ fontSize: '13px', fontWeight: 600 }}>Sign in to save settings</span>
        </div>
        <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
          Use your admin credentials from <code style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: '3px', fontSize: '10px' }}>.env</code>
        </p>
      </div>
      <div>
        <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '5px' }}>Username</label>
        <input id="login-username" type="text" value={user} onChange={(e) => setUser(e.target.value)}
          style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13px', padding: '9px 12px', outline: 'none', boxSizing: 'border-box' }}
          onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent-primary)')}
          onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
        />
      </div>
      <div>
        <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '5px' }}>Password</label>
        <input id="login-password" type="password" value={pass}
          onChange={(e) => setPass(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && login()}
          style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13px', padding: '9px 12px', outline: 'none', boxSizing: 'border-box' }}
          onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent-primary)')}
          onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
        />
      </div>
      {error && <div style={{ fontSize: '12px', color: '#ef5350', display: 'flex', alignItems: 'center', gap: '5px' }}><AlertCircle size={12} />{error}</div>}
      <button id="login-submit-btn" onClick={login} disabled={loading}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', padding: '10px', borderRadius: '9px', fontSize: '13px', fontWeight: 600, background: loading ? 'rgba(79,158,255,0.4)' : 'var(--accent-primary)', color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', border: 'none', boxShadow: loading ? 'none' : '0 0 20px rgba(79,158,255,0.25)', transition: 'all 0.2s' }}>
        {loading ? <><div className="spinner" style={{ width: '13px', height: '13px', borderWidth: '2px' }} />Signing in…</> : <><LogIn size={13} />Sign In</>}
      </button>
    </div>
  )
}

/* ── Main Modal ──────────────────────────────────────────────────────────────── */
export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const [settings, setSettings] = useState<Record<string, SettingEntry>>({})
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'keys' | 'intervals' | 'account'>('keys')
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('wl_token'))
  const [showLogin, setShowLogin] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const token = localStorage.getItem('wl_token')
      const endpoint = token ? '/settings/full' : '/settings'
      const { data } = await apiClient.get(endpoint)
      const map: Record<string, SettingEntry> = {}
      const draftMap: Record<string, string> = {}
      for (const s of data.settings as SettingEntry[]) {
        map[s.key] = s
        // Don't pre-fill masked values
        draftMap[s.key] = s.value.startsWith('••') ? '' : s.value
      }
      setSettings(map)
      setDraft(draftMap)
    } catch {
      setError('Could not load settings — is the backend running?')
    }
    setLoading(false)
  }, [])

  useEffect(() => { if (open) { setIsLoggedIn(!!localStorage.getItem('wl_token')); load() } }, [open, load])

  const save = async () => {
    if (!isLoggedIn) { setShowLogin(true); return }
    setSaving(true); setError('')
    try {
      const payload: Record<string, string> = {}
      // API keys: only send non-empty new values
      for (const key of API_KEYS) {
        const val = draft[key]?.trim()
        if (val && val !== settings[key]?.value && !val.startsWith('••')) {
          payload[key] = val
        }
      }
      // Intervals: always send current value
      for (const key of INTERVAL_KEYS) {
        if (draft[key] !== undefined) payload[key] = draft[key]
      }

      if (Object.keys(payload).length === 0) {
        setSaved(true); setTimeout(() => setSaved(false), 2000); setSaving(false); return
      }

      await apiClient.post('/settings/bulk', { settings: payload })

      // Apply Cesium token immediately in browser
      if (payload.cesium_ion_token) {
        localStorage.setItem('cesium_ion_token', payload.cesium_ion_token)
      }

      setSaved(true); setTimeout(() => setSaved(false), 2500)
      await load()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      if ((e as { response?: { status?: number } })?.response?.status === 401) {
        localStorage.removeItem('wl_token')
        setIsLoggedIn(false)
        setShowLogin(true)
        setError('Session expired — please sign in again')
      } else {
        setError(msg || 'Save failed')
      }
    }
    setSaving(false)
  }

  const tabs = [
    { id: 'keys' as const,      label: 'API Keys',  icon: <Key size={13} /> },
    { id: 'intervals' as const, label: 'Intervals', icon: <Clock size={13} /> },
    { id: 'account' as const,   label: 'Account',   icon: <Shield size={13} /> },
  ]

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* ── Backdrop ────────────────────────────────────────────── */}
          <motion.div
            key="settings-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)' }}
          />

          {/* ── Centering wrapper (NOT animated — avoids transform conflict) */}
          <div
            style={{
              position: 'fixed', inset: 0, zIndex: 201,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none',
            }}
          >
            {/* ── Modal (animated scale/opacity only) ─────────────────── */}
            <motion.div
              key="settings-modal"
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              transition={{ type: 'spring', duration: 0.3, bounce: 0.15 }}
              id="settings-modal"
              style={{
                pointerEvents: 'auto',
                width: '520px',
                maxWidth: 'calc(100vw - 32px)',
                maxHeight: '85vh',
                display: 'flex',
                flexDirection: 'column',
                background: 'rgba(10, 14, 26, 0.98)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '16px',
                boxShadow: '0 24px 80px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.04)',
                overflow: 'hidden',
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 0', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, rgba(79,158,255,0.2), rgba(123,94,167,0.2))', border: '1px solid rgba(79,158,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Settings size={15} color="var(--accent-primary)" />
                  </div>
                  <div>
                    <h2 style={{ fontSize: '15px', fontWeight: 700, fontFamily: 'var(--font-head)', margin: 0 }}>Settings</h2>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>Configure API keys and intervals</p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button id="settings-refresh-btn" onClick={load} disabled={loading} title="Reload"
                    style={{ padding: '6px', borderRadius: '7px', color: 'var(--text-muted)', transition: 'all 0.15s' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
                    <RefreshCw size={13} style={{ animation: loading ? 'spin 0.8s linear infinite' : 'none' }} />
                  </button>
                  <button id="settings-close-btn" onClick={onClose}
                    style={{ padding: '6px', borderRadius: '7px', color: 'var(--text-muted)', transition: 'all 0.15s' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'var(--text-primary)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}>
                    <X size={15} />
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', gap: '4px', padding: '14px 20px 0', flexShrink: 0 }}>
                {tabs.map((tab) => (
                  <button key={tab.id} id={`settings-tab-${tab.id}`} onClick={() => setActiveTab(tab.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s', background: activeTab === tab.id ? 'rgba(79,158,255,0.15)' : 'transparent', color: activeTab === tab.id ? 'var(--accent-primary)' : 'var(--text-secondary)', border: `1px solid ${activeTab === tab.id ? 'rgba(79,158,255,0.3)' : 'transparent'}` }}>
                    {tab.icon}{tab.label}
                  </button>
                ))}
                {!isLoggedIn && (
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
                    <span style={{ fontSize: '10px', color: '#ffb74d', display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', borderRadius: '6px', background: 'rgba(255,183,77,0.1)', border: '1px solid rgba(255,183,77,0.2)' }}>
                      🔒 Not signed in
                    </span>
                  </div>
                )}
              </div>

              {/* Login panel (inline) */}
              <AnimatePresence>
                {showLogin && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    style={{ overflow: 'hidden', flexShrink: 0 }}
                  >
                    <div style={{ margin: '12px 20px 0', borderRadius: '10px', background: 'rgba(6,8,16,0.8)', border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                      <LoginPanel onSuccess={() => { setIsLoggedIn(true); setShowLogin(false); load() }} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Content */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
                {loading && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', gap: '12px', color: 'var(--text-muted)' }}>
                    <div className="spinner" /> Loading…
                  </div>
                )}

                {/* ── API Keys tab ─────────────────────────────────────── */}
                {!loading && activeTab === 'keys' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
                      The globe works without keys. Adding them enables higher-quality data sources.
                    </p>
                    {API_KEYS.map((key) => {
                      const s = settings[key]
                      return (
                        <div key={key} id={`setting-field-${key}`}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '7px', gap: '8px' }}>
                            <div style={{ flex: 1 }}>
                              <label htmlFor={`input-${key}`} style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: '2px' }}>
                                {KEY_LABELS[key]}
                              </label>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{KEY_DESC[key] || s?.description}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, marginTop: '2px' }}>
                              {s?.has_value && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px', color: '#66bb6a', padding: '2px 7px', borderRadius: '10px', background: 'rgba(102,187,106,0.1)', border: '1px solid rgba(102,187,106,0.2)' }}>
                                  <CheckCircle size={9} /> Saved
                                </span>
                              )}
                              {KEY_LINKS[key] && (
                                <a href={KEY_LINKS[key]} target="_blank" rel="noopener noreferrer"
                                  style={{ color: 'var(--text-muted)', display: 'flex', padding: '3px' }} title="Get API key">
                                  <ExternalLink size={12} />
                                </a>
                              )}
                            </div>
                          </div>
                          <SecretInput
                            id={`input-${key}`}
                            value={draft[key] || ''}
                            onChange={(v) => setDraft((d) => ({ ...d, [key]: v }))}
                            placeholder={s?.has_value ? '(already saved — enter to replace)' : 'Paste your key here…'}
                          />
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* ── Intervals tab ─────────────────────────────────────── */}
                {!loading && activeTab === 'intervals' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.6, margin: '0 0 6px' }}>
                      Polling intervals per collector. Changes apply live without restarting.
                    </p>
                    {INTERVAL_KEYS.map((key) => (
                      <IntervalSlider key={key} id={`input-${key}`}
                        value={draft[key] || '60'}
                        onChange={(v) => setDraft((d) => ({ ...d, [key]: v }))}
                        label={KEY_LABELS[key]} icon={LAYER_ICONS[key] || '⚙️'}
                      />
                    ))}
                  </div>
                )}

                {/* ── Account tab ───────────────────────────────────────── */}
                {!loading && activeTab === 'account' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {isLoggedIn ? (
                      <>
                        <div style={{ padding: '14px', borderRadius: '10px', background: 'rgba(79,158,255,0.07)', border: '1px solid rgba(79,158,255,0.15)' }}>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Logged in as</div>
                          <div style={{ fontSize: '14px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>
                            {localStorage.getItem('wl_user') || 'admin'}
                          </div>
                        </div>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
                          To change your password, edit <code style={{ fontFamily: 'var(--font-mono)', background: 'rgba(255,255,255,0.08)', padding: '1px 6px', borderRadius: '4px' }}>ADMIN_PASSWORD</code> in <code style={{ fontFamily: 'var(--font-mono)', background: 'rgba(255,255,255,0.08)', padding: '1px 6px', borderRadius: '4px' }}>.env</code> and restart the backend.
                        </p>
                        <button id="settings-logout-btn"
                          onClick={() => { localStorage.removeItem('wl_token'); localStorage.removeItem('wl_user'); setIsLoggedIn(false); setShowLogin(false) }}
                          style={{ width: 'fit-content', padding: '9px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 500, background: 'rgba(239,83,80,0.1)', color: '#ef5350', border: '1px solid rgba(239,83,80,0.25)', cursor: 'pointer', transition: 'all 0.15s' }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239,83,80,0.2)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(239,83,80,0.1)')}>
                          Sign out
                        </button>
                      </>
                    ) : (
                      <LoginPanel onSuccess={() => { setIsLoggedIn(true); setShowLogin(false); load() }} />
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              {activeTab !== 'account' && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.07)', flexShrink: 0, background: 'rgba(0,0,0,0.25)' }}>
                  <div style={{ fontSize: '12px', minHeight: '18px' }}>
                    {error && <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#ef5350' }}><AlertCircle size={12} />{error}</span>}
                    {saved && !error && (
                      <motion.span initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                        style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#66bb6a' }}>
                        <CheckCircle size={12} /> Saved!
                      </motion.span>
                    )}
                    {!isLoggedIn && !error && !saved && (
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Sign in to save changes
                      </span>
                    )}
                  </div>
                  <button id="settings-save-btn" onClick={save} disabled={saving}
                    style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 20px', borderRadius: '9px', fontSize: '13px', fontWeight: 600, background: saving ? 'rgba(79,158,255,0.4)' : 'var(--accent-primary)', color: '#fff', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', boxShadow: saving ? 'none' : '0 0 16px rgba(79,158,255,0.3)', transition: 'all 0.2s' }}
                    onMouseEnter={(e) => { if (!saving) e.currentTarget.style.background = '#6aaeff' }}
                    onMouseLeave={(e) => { if (!saving) e.currentTarget.style.background = 'var(--accent-primary)' }}>
                    {saving
                      ? <><div className="spinner" style={{ width: '13px', height: '13px', borderWidth: '2px' }} />Saving…</>
                      : !isLoggedIn
                        ? <><LogIn size={13} />Sign In & Save</>
                        : <><Save size={13} />Save Changes</>
                    }
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
