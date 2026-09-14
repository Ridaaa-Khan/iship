const env = require('./env');

const sessionConfig = {
  name: 'iship.sid',
  secret: env.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 8,
  },
};

module.exports = sessionConfig;