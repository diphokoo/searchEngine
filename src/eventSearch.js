// ─── Keyword Sets ─────────────────────────────────────────────────────────────

const GENERAL_KEYWORDS = [
  'events', 'upcoming events', 'things to do', "what's on", 'whats on',
  'events near me', 'local events', 'weekend events', 'events tonight',
  'events this week', 'live events', 'experiences', 'entertainment',
  'events happening today', 'events happening this weekend',
]

const CATEGORY_KEYWORDS = [
  'concerts', 'concert', 'festivals', 'festival', 'parties', 'party',
  'nightlife', 'club events', 'club night', 'live music', 'dj events', 'dj event',
  'comedy', 'sports', 'exhibitions', 'exhibition', 'markets', 'market',
  'food & drink', 'food and drink', 'networking', 'conferences', 'conference',
  'workshops', 'workshop', 'pop-up events', 'pop up events', 'cultural events',
  'community events', 'theatre', 'performances', 'performance', 'family events',
  'outdoor events', 'lifestyle events', 'business events', 'wellness events',
  'car events', 'motoring events',
]

const NIGHTLIFE_KEYWORDS = [
  'nightlife', 'night out', 'clubbing', 'club events', 'late night',
  'dj', 'live dj', 'rooftop party', 'lounge', 'day party', 'sundowner',
  'after party', 'weekend party', 'ladies night', 'theme party',
  'music festival', 'amapiano', 'house music', 'hip-hop', 'hip hop',
  'r&b', 'rnb', 'afrobeat', 'gqom', 'deep house',
]

// ─── Detection ────────────────────────────────────────────────────────────────

export function detectEventIntent(query) {
  const q = query.toLowerCase().trim()
  const isNightlife = NIGHTLIFE_KEYWORDS.some(k => q.includes(k))
  const isCategory = CATEGORY_KEYWORDS.some(k => q.includes(k))
  const isGeneral = GENERAL_KEYWORDS.some(k => q.includes(k))
  return { isEvent: isNightlife || isCategory || isGeneral, isNightlife, isCategory, isGeneral }
}

// ─── Sources ──────────────────────────────────────────────────────────────────

export const EVENT_SOURCES = [
  {
    id: 'quicket',
    name: 'Quicket',
    icon: '🎟️',
    color: '#e85d04',
    description: 'SA\'s largest ticketing platform',
    buildUrl: q => `https://www.quicket.co.za/events/?search=${encodeURIComponent(q)}`,
  },
  {
    id: 'howler',
    name: 'Howler',
    icon: '🎵',
    color: '#7c3aed',
    description: 'Nightlife & club events',
    buildUrl: q => `https://howler.co.za/events?q=${encodeURIComponent(q)}`,
  },
  {
    id: 'webtickets',
    name: 'Webtickets',
    icon: '🎫',
    color: '#0ea5e9',
    description: 'Events & entertainment tickets',
    buildUrl: q => `https://www.webtickets.co.za/v2/Search.aspx?q=${encodeURIComponent(q)}`,
  },
  {
    id: 'eventbrite',
    name: 'Eventbrite ZA',
    icon: '📅',
    color: '#f97316',
    description: 'Local & international events',
    buildUrl: q => `https://www.eventbrite.co.za/d/south-africa/${encodeURIComponent(q.replace(/\s+/g, '-'))}/`,
  },
  {
    id: 'facebook',
    name: 'Facebook Events',
    icon: '📘',
    color: '#1877f2',
    description: 'Community & local events',
    buildUrl: q => `https://www.facebook.com/search/events/?q=${encodeURIComponent(q)}`,
  },
  {
    id: 'google',
    name: 'Google Events',
    icon: '🔍',
    color: '#4285f4',
    description: 'Search across all sources',
    buildUrl: q => `https://www.google.com/search?q=${encodeURIComponent(q + ' events South Africa')}`,
  },
]

export const NIGHTLIFE_SOURCES = [
  {
    id: 'howler',
    name: 'Howler',
    icon: '🎵',
    color: '#7c3aed',
    description: 'SA\'s #1 nightlife platform',
    buildUrl: q => `https://howler.co.za/events?q=${encodeURIComponent(q)}`,
  },
  {
    id: 'quicket-nightlife',
    name: 'Quicket Nightlife',
    icon: '🎟️',
    color: '#e85d04',
    description: 'Club nights & parties',
    buildUrl: q => `https://www.quicket.co.za/events/?search=${encodeURIComponent(q)}&category=nightlife`,
  },
  {
    id: 'instagram',
    name: 'Instagram',
    icon: '📸',
    color: '#e1306c',
    description: 'Discover via hashtags',
    buildUrl: q => `https://www.instagram.com/explore/tags/${encodeURIComponent(q.replace(/\s+/g, ''))}`,
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    icon: '🎬',
    color: '#010101',
    description: 'Event clips & promos',
    buildUrl: q => `https://www.tiktok.com/search?q=${encodeURIComponent(q)}`,
  },
]

// ─── Suggestions ──────────────────────────────────────────────────────────────

export const QUICK_SEARCHES = [
  { label: 'Amapiano events', icon: '🎵' },
  { label: 'Nightlife Johannesburg', icon: '🌃' },
  { label: 'Weekend parties Cape Town', icon: '🎉' },
  { label: 'Live music tonight', icon: '🎸' },
  { label: 'Sundowner events', icon: '🌅' },
  { label: 'DJ events this weekend', icon: '🎧' },
  { label: 'Rooftop parties', icon: '🏙️' },
  { label: 'Gqom events', icon: '🔊' },
  { label: 'Comedy shows', icon: '😂' },
  { label: 'Food festivals', icon: '🍽️' },
  { label: 'Outdoor concerts', icon: '🎪' },
  { label: 'Club nights Pretoria', icon: '🕺' },
]
