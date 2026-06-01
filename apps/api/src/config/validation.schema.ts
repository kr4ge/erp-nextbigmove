import * as Joi from 'joi';

export default Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3001),

  // Database
  DATABASE_URL: Joi.string().required(),

  // JWT
  JWT_SECRET: Joi.string().min(64).required(),
  JWT_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_SECRET: Joi.string().min(64).required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  // Redis
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow('', null),

  // Rate limiting
  THROTTLE_TTL: Joi.number().default(60000),
  THROTTLE_LIMIT: Joi.number().default(100),

  // Pancake webhook queue processing
  PANCAKE_WEBHOOK_PROCESS_INLINE: Joi.string().valid('true', 'false').default('false'),
  PANCAKE_WEBHOOK_INLINE_FALLBACK: Joi.string().valid('true', 'false').default('true'),
  PANCAKE_WEBHOOK_QUEUE_ATTEMPTS: Joi.number().integer().min(1).default(5),
  PANCAKE_WEBHOOK_QUEUE_BACKOFF_MS: Joi.number().integer().min(100).default(2000),
  PANCAKE_WEBHOOK_QUEUE_TIMEOUT_MS: Joi.number().integer().min(1000).default(120000),
  PANCAKE_WEBHOOK_QUEUE_REMOVE_ON_COMPLETE: Joi.number().integer().min(1).default(1000),
  PANCAKE_WEBHOOK_QUEUE_REMOVE_ON_FAIL: Joi.number().integer().min(1).default(5000),

  // Object storage
  OBJECT_STORAGE_PROVIDER: Joi.string().default('s3-compatible'),
  OBJECT_STORAGE_ENDPOINT: Joi.string().allow('', null),
  OBJECT_STORAGE_REGION: Joi.string().default('us-east-1'),
  OBJECT_STORAGE_BUCKET: Joi.string().allow('', null),
  OBJECT_STORAGE_ACCESS_KEY_ID: Joi.string().allow('', null),
  OBJECT_STORAGE_SECRET_ACCESS_KEY: Joi.string().allow('', null),
  OBJECT_STORAGE_FORCE_PATH_STYLE: Joi.string().valid('true', 'false').default('false'),
  OBJECT_STORAGE_AUTO_CREATE_BUCKET: Joi.string().valid('true', 'false').default('false'),
  OBJECT_STORAGE_SIGNED_URL_TTL_SECONDS: Joi.number().integer().min(60).default(900),
  OBJECT_STORAGE_PAYMENT_PROOF_MAX_FILE_MB: Joi.number().integer().min(1).default(8),
});
