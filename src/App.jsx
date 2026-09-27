import { useState, useRef } from 'react'
import './App.css'
import { detectEventIntent, EVENT_SOURCES, NIGHTLIFE_SOURCES, QUICK_SEARCHES } from './eventSearch'

function SourceCard({ source, query }) {
  const url = source.buildUrl(query)
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="source-card"
      style={{ '--source-color': source.color }}
    >
      <span className="source-icon">{source.icon}</span>
      <div className="source-info">
        <span className="source-name">{source.name}</span>
        <span className="source-desc">{source.description}</span>
      </div>
      <span className="source-arrow">→</span>
    </a>
  )
}

export default function App() {
  const [query, setQuery] = useState('')
  const [submitted, setSubmitted] = useState('')
  const inputRef = useRef(null)

  const intent = submitted ? detectEventIntent(submitted) : null
  const sources = intent?.isNightlife
    ? [...NIGHTLIFE_SOURCES, ...EVENT_SOURCES.filter(s => !NIGHTLIFE_SOURCES.find(n => n.id === s.id))]
    : EVENT_SOURCES

  function handleSubmit(e) {
    e?.preventDefault()
    if (query.trim()) setSubmitted(query.trim())
  }

  function handleQuick(label) {
    setQuery(label)
    setSubmitted(label)
  }

  function handleClear() {
    setQuery('')
    setSubmitted('')
    inputRef.current?.focus()
  }

  return (
    <div className="app">
      {/* Header */}
      <header className="site-header">
        <div className="logo">
          <span className="logo-icon">🌃</span>
          <span className="logo-text">SA<strong>Nightlife</strong></span>
        </div>
      </header>

      {/* Hero */}
      <main className={`main ${submitted ? 'has-results' : ''}`}>
        <div className="hero-section">
          <h1 className="hero-title">
            {submitted ? `Results for "${submitted}"` : 'Discover SA Events'}
          </h1>
          {!submitted && (
            <p className="hero-sub">Search nightlife, concerts, parties & more across South Africa</p>
          )}

          {/* Search bar */}
          <form className="search-form" onSubmit={handleSubmit}>
            <div className="search-bar">
              <span className="search-icon">🔍</span>
              <input
                ref={inputRef}
                className="search-input"
                type="text"
                placeholder="Search events, nightlife, concerts..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                autoFocus
              />
              {query && (
                <button type="button" className="clear-btn" onClick={handleClear} aria-label="Clear">✕</button>
              )}
              <button type="submit" className="search-btn">Search</button>
            </div>
          </form>

          {/* Quick searches — only when no results */}
          {!submitted && (
            <div className="quick-searches">
              {QUICK_SEARCHES.map(({ label, icon }) => (
                <button key={label} className="quick-chip" onClick={() => handleQuick(label)}>
                  {icon} {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Results */}
        {submitted && intent && (
          <div className="results-section">
            {/* Intent badge */}
            <div className="intent-row">
              {intent.isNightlife && <span className="intent-badge nightlife">🌃 Nightlife</span>}
              {intent.isCategory && !intent.isNightlife && <span className="intent-badge category">🎭 Event</span>}
              {intent.isGeneral && <span className="intent-badge general">📅 Events</span>}
              {!intent.isEvent && <span className="intent-badge general">🔍 General</span>}
              <span className="results-label">
                {intent.isNightlife
                  ? 'Showing nightlife-first sources'
                  : intent.isEvent
                  ? 'Showing event sources'
                  : 'Showing all sources'}
              </span>
            </div>

            {/* Source cards */}
            <div className="sources-grid">
              {sources.map(source => (
                <SourceCard key={source.id} source={source} query={submitted} />
              ))}
            </div>

            {/* New search */}
            <div className="new-search-row">
              <span style={{ color: 'var(--text)', fontSize: '0.9rem' }}>Not what you're looking for?</span>
              <button className="new-search-btn" onClick={handleClear}>New search</button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
