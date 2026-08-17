// ─── Event ───────────────────────────────────────────────────────────────────

export type EventStatus =
  | 'DISCOVERED'
  | 'PROCESSING'
  | 'NEEDS_REVIEW'
  | 'VERIFIED'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'EXPIRED';

export type Genre =
  | 'Amapiano' | 'Hip-Hop' | 'House' | 'Deep House' | 'Afro House'
  | 'Gqom' | 'Afrobeats' | 'Afro-Tech' | 'Kwaito' | 'EDM' | 'Techno'
  | 'Drum & Bass' | 'Soul' | 'R&B' | 'Jazz' | 'Gospel' | 'Reggae'
  | 'Dancehall' | 'Pop' | 'Rock' | 'Alternative' | 'Mixed' | 'Unknown';

export type EventType =
  | 'Club Night' | 'Party' | 'Day Party' | 'Night Party' | 'Festival'
  | 'Concert' | 'DJ Set' | 'Live Performance' | 'Launch Party'
  | 'Album Launch' | 'Birthday Celebration' | 'Themed Party' | 'Pool Party'
  | 'Beach Party' | 'Rooftop Party' | 'Brunch Party' | 'Street Party'
  | 'Block Party' | 'After Party' | 'Concert After Party' | 'Music Showcase'
  | 'Comedy Event' | 'Other';

export type Province =
  | 'Gauteng' | 'Western Cape' | 'KwaZulu-Natal' | 'Eastern Cape'
  | 'Free State' | 'Limpopo' | 'Mpumalanga' | 'North West' | 'Northern Cape';

export interface EventLocation {
  latitude: number | null;
  longitude: number | null;
}

export interface EventSource {
  sourceId: string;
  sourceName: string;
  sourceUrl: string;
  platform: string;
  discoveredAt: string;
}

export interface NightlifeEvent {
  id: string;
  title: string;
  description: string | null;
  category: string;
  genres: Genre[];
  eventType: EventType;

  date: string;
  startTime: string | null;
  endTime: string | null;

  venue: string | null;
  address: string | null;
  city: string | null;
  province: Province | null;
  country: 'South Africa';

  location: EventLocation;

  price: number | null;
  currency: 'ZAR';

  ticketUrl: string | null;
  eventUrl: string | null;
  imageUrl: string | null;

  organiser: string | null;
  artists: string[];

  ageRestriction: string | null;

  sources: EventSource[];

  confidenceScore: number;
  verificationReasons: string[];

  status: EventStatus;

  discoveredAt: string;
  lastVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Source ───────────────────────────────────────────────────────────────────

export type SourceStatus = 'PENDING' | 'ACTIVE' | 'WARNING' | 'FAILED' | 'BLOCKED' | 'DISABLED';
export type SourcePlatform =
  | 'instagram' | 'facebook' | 'twitter' | 'youtube' | 'tiktok'
  | 'website' | 'rss' | 'ical' | 'ticketing' | 'other';

export interface EventSource_ {
  id: string;
  name: string;
  url: string;
  platform: SourcePlatform;
  sourceType: string;
  province: Province | null;
  city: string | null;
  connector: string;
  status: SourceStatus;
  reliabilityScore: number;
  lastScan: string | null;
  lastSuccessfulScan: string | null;
  lastFailure: string | null;
  eventsFound: number;
  eventsImported: number;
  eventsRejected: number;
  errorCount: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'REVIEWER' | 'MINER' | 'PUBLIC_API';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
}

// ─── Audit ────────────────────────────────────────────────────────────────────

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  entityType: 'event' | 'source' | 'user';
  entityId: string;
  details: Record<string, unknown>;
  createdAt: string;
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────────

export interface DashboardStats {
  totalEvents: number;
  newToday: number;
  needsReview: number;
  verified: number;
  approved: number;
  rejected: number;
  cancelled: number;
  expired: number;
  duplicates: number;
  activeSources: number;
  failedSources: number;
}

// ─── API Responses ────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}
