# 0002. Hybrid Validation Architecture

Input validation is split cleanly between Mongoose Schema data integrity (formatting, regex trimming, type coercion) and dedicated Express middleware (`middleware/validate.js` for temporal order, non-past dates, and max duration rules). This keeps route controller signatures idiomatic and uncluttered while ensuring requests fail fast with standard `400 Bad Request` responses before invoking downstream database writes.
