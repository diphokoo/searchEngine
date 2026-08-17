import { z } from 'zod'

export const EventStatusSchema = z.enum([
  'DISCOVERED', 'PROCESSING', 'NEEDS_REVIEW', 'VERIFIED', 'APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED'
])

export const GenreSchema = z.enum([
  'Amapiano', 'Hip-Hop', 'House', 'Deep House', 'Afro House', 'Gqom', 'Afrobeats',
  'Afro-Tech', 'Kwaito', 'EDM', 'Techno', 'Drum & Bass', 'Soul', 'R&B', 'Jazz',
  'Gospel', 'Reggae', 'Dancehall', 'Pop', 'Rock', 'Alternative', 'Mixed', 'Unknown'
])

export const ProvinceSchema = z.enum([
  'Gauteng', 'Western Cape', 'KwaZulu-Natal', 'Eastern Cape',
  'Free State', 'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape'
])

export const EventFiltersSchema = z.object({
  status: EventStatusSchema.optional(),
  province: ProvinceSchema.optional(),
  city: z.string().optional(),
  genre: z.string().optional(),
  category: z.string().optional(),
  search: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export const NearbyEventsSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().min(1).max(500).default(50),
  genre: z.string().optional(),
  date: z.string().optional(),
})

export const UpdateEventSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  date: z.string().optional(),
  startTime: z.string().nullable().optional(),
  endTime: z.string().nullable().optional(),
  venue: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  province: ProvinceSchema.nullable().optional(),
  price: z.number().nullable().optional(),
  ticketUrl: z.string().url().nullable().optional(),
  eventUrl: z.string().url().nullable().optional(),
  organiser: z.string().nullable().optional(),
  artists: z.array(z.string()).optional(),
  genres: z.array(GenreSchema).optional(),
  ageRestriction: z.string().nullable().optional(),
})

export const SourceSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  platform: z.enum(['instagram', 'facebook', 'twitter', 'youtube', 'tiktok', 'website', 'rss', 'ical', 'ticketing', 'other']),
  sourceType: z.string(),
  province: ProvinceSchema.nullable().optional(),
  city: z.string().nullable().optional(),
  connector: z.string(),
  reliabilityScore: z.number().int().min(0).max(100).default(50),
})

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})
