const { z } = require('zod');

const eventFormSchema = z
  .object({
    title: z.string().trim().min(3, 'Title is required').max(200),
    description: z.string().trim().max(5000).optional().or(z.literal('')),
    venue: z.string().trim().max(255).optional().or(z.literal('')),
    startsAt: z.string().min(1, 'Start time is required'),
    endsAt: z.string().min(1, 'End time is required'),
    doorsOpenAt: z.string().min(1, 'Doors open time is required'),
    doorsCloseAt: z.string().min(1, 'Doors close time is required'),
    capacity: z.coerce.number().int().positive('Capacity must be at least 1'),
    priceRupees: z.coerce.number().min(0, 'Price cannot be negative'),
    status: z.enum(['DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED']).default('DRAFT'),
  })
  .refine((data) => data.endsAt > data.startsAt, {
    message: 'End time must be after start time',
    path: ['endsAt'],
  })
  .refine((data) => data.doorsCloseAt >= data.doorsOpenAt, {
    message: 'Doors close must be after doors open',
    path: ['doorsCloseAt'],
  });

module.exports = { eventFormSchema };