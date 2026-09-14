const { z } = require('zod');
const {
  normalizeFullName,
  isValidFullName,
  isValidPhone,
} = require('../utils/personFields');

const fullNameField = z
  .string({ required_error: 'Full name is required' })
  .trim()
  .transform(normalizeFullName)
  .refine(isValidFullName, {
    message: 'Full name must be at least 3 letters and contain only alphabets.',
  });

const phoneField = z
  .string()
  .trim()
  .optional()
  .or(z.literal(''))
  .refine(isValidPhone, {
    message: 'Phone number must be exactly 10 digits.',
  });

const registerSchema = z.object({
  email: z.string().trim().email('Enter a valid email'),
  password: z
    .string()
    .min(3, 'Password must be at least 3 characters')
    .max(72, 'Password is too long'),
  fullName: fullNameField,
  phone: phoneField,
});

const profileSchema = z.object({
  fullName: fullNameField,
  email: z.string().trim().email('Enter a valid email').max(255),
  phone: phoneField,
});

const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

module.exports = {
  registerSchema,
  loginSchema,
  profileSchema,
};
