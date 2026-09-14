const { z } = require('zod');

const scannerFormSchema = z.object({
  email: z.string().trim().email('Enter a valid email').max(255),
  password: z
    .string()
    .min(3, 'Password must be at least 3 characters')
    .max(72, 'Password is too long'),
  scannerName: z
    .string()
    .trim()
    .min(2, 'Scanner name must be at least 2 characters')
    .max(150, 'Scanner name is too long'),
  gateNumber: z
    .string()
    .trim()
    .max(50, 'Gate number is too long')
    .optional()
    .or(z.literal('')),
});

module.exports = { scannerFormSchema };
