const PROFILE_PHOTO_MAX_BYTES = 8 * 1024 * 1024;
const SUPPORTED_PROFILE_PHOTO_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif']);

const hasUploadBinarySource = (asset = {}) => asset?.file instanceof Blob || asset?.blob instanceof Blob;

const getAssetUri = (asset = {}) => (typeof asset === 'string' ? asset : asset?.uri || '');

const getAssetExtension = (asset = {}) => {
  const candidate = typeof asset === 'string'
    ? asset
    : asset?.fileName || asset?.name || asset?.uri || '';
  const match = String(candidate).match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  return match?.[1] ? match[1].toLowerCase() : '';
};

const getMimeSubtype = (mimeType = '') => {
  if (!mimeType.includes('/')) {
    return '';
  }

  return mimeType.split('/')[1].trim().toLowerCase();
};

export const validateProfilePhotoAsset = (asset = {}) => {
  const assetUri = getAssetUri(asset);
  const mimeType = typeof asset === 'string' ? '' : String(asset?.mimeType || asset?.type || '').trim().toLowerCase();
  const extension = getAssetExtension(asset);
  const fileSize = Number(typeof asset === 'string' ? NaN : asset?.fileSize ?? asset?.size);

  if (!assetUri && !hasUploadBinarySource(asset)) {
    throw new Error('Die ausgewaehlte Bilddatei enthaelt keine nutzbaren Upload-Daten. Bitte waehle das Bild erneut aus.');
  }

  if (mimeType && !mimeType.startsWith('image/')) {
    throw new Error('Bitte wähle ein unterstütztes Bildformat für dein Profilbild aus.');
  }

  if (extension && !SUPPORTED_PROFILE_PHOTO_EXTENSIONS.has(extension)) {
    throw new Error('Bitte wähle ein unterstütztes Bildformat für dein Profilbild aus.');
  }

  if (!extension && mimeType && !SUPPORTED_PROFILE_PHOTO_EXTENSIONS.has(getMimeSubtype(mimeType))) {
    throw new Error('Bitte wähle ein unterstütztes Bildformat für dein Profilbild aus.');
  }

  if (Number.isFinite(fileSize) && fileSize > PROFILE_PHOTO_MAX_BYTES) {
    throw new Error('Das Profilbild überschreitet die erlaubte Größe von 8 MB.');
  }

  return asset;
};

export const buildProfilePhotoStatePatch = (profilePhotoUrl) => ({
  profileImageUploaded: true,
  verified: true,
  profilePhotoUrl,
  profileImageUri: profilePhotoUrl,
  profilePhotoAgeMonths: 0,
  verificationState: 'uploaded',
});

export const uploadProfilePhoto = async ({ asset, ownerId, uploadAsset }) => {
  validateProfilePhotoAsset(asset);

  const profilePhotoUrl = await uploadAsset('profileImages', asset, ownerId);

  if (!profilePhotoUrl) {
    throw new Error('Das Profilbild wurde hochgeladen, aber die Bild-URL konnte nicht ermittelt werden.');
  }

  return {
    directUpload: true,
    ...buildProfilePhotoStatePatch(profilePhotoUrl),
  };
};

export {
    PROFILE_PHOTO_MAX_BYTES,
    SUPPORTED_PROFILE_PHOTO_EXTENSIONS
};
