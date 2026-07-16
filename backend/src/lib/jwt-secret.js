const nodeCrypto = require('crypto')
const fs = require('fs')
const path = require('path')

const DEFAULT_WEAK_SECRETS = new Set([
  'menu_digital_secret_key_change_in_production',
  'menu_digital_super_secret_key_change_in_production',
  'changeme',
  'default',
])

const SECRET_FILE_PATH = path.join(__dirname, '../../data/jwt-secret.txt')

function isStrongSecret(secret) {
  return typeof secret === 'string'
    && secret.length >= 32
    && !DEFAULT_WEAK_SECRETS.has(secret.toLowerCase())
}

function readPersistedSecret() {
  if (!fs.existsSync(SECRET_FILE_PATH)) return null

  const secret = fs.readFileSync(SECRET_FILE_PATH, 'utf8').trim()
  return isStrongSecret(secret) ? secret : null
}

function persistSecret(secret) {
  const dir = path.dirname(SECRET_FILE_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(SECRET_FILE_PATH, `${secret}\n`, { mode: 0o600 })
}

function resolveJwtSecret() {
  const envSecret = process.env.JWT_SECRET?.trim()

  if (envSecret) {
    if (!isStrongSecret(envSecret)) {
      throw new Error('JWT_SECRET is too weak. Use at least 32 characters and avoid default/common values')
    }
    return envSecret
  }

  const persistedSecret = readPersistedSecret()
  if (persistedSecret) return persistedSecret

  const generatedSecret = nodeCrypto.randomBytes(48).toString('hex')
  persistSecret(generatedSecret)
  return generatedSecret
}

module.exports = { resolveJwtSecret }