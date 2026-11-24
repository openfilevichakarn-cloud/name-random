/** OAuth client id of the deployment (public, not a secret). Empty = Google Drive sync is not offered. */
export const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '').trim()

export const isDriveConfigured = GOOGLE_CLIENT_ID !== ''

/**
 * Only files this app created or opened — not the rest of the teacher's Drive.
 * A non-sensitive scope: the consent screen needs no Google verification.
 */
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'

/** Name of the data file in the teacher's Drive. */
export const DRIVE_FILE_NAME = 'NEXT-GEN Student Randomizer - ข้อมูล.json'
