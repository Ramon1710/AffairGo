const crypto = require('crypto');
const admin = require('firebase-admin');
const { getApps } = require('firebase-admin/app');
const { getStorage } = require('firebase-admin/storage');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const {
  CompareFacesCommand,
  CreateFaceLivenessSessionCommand,
  GetFaceLivenessSessionResultsCommand,
  RekognitionClient,
} = require('@aws-sdk/client-rekognition');

if (!getApps().length) {
  admin.initializeApp();
}

const AWS_ACCESS_KEY_ID = defineSecret('AWS_ACCESS_KEY_ID');
const AWS_SECRET_ACCESS_KEY = defineSecret('AWS_SECRET_ACCESS_KEY');
const PROFILE_IMAGE_VERIFICATION_SIGNING_KEY = defineSecret('PROFILE_IMAGE_VERIFICATION_SIGNING_KEY');

const AWS_REGION = 'eu-central-1';
const FIREBASE_REGION = 'europe-west1';
const MIN_FACE_MATCH_SIMILARITY = 90;
const MAX_TEMP_IMAGE_BYTES = 8 * 1024 * 1024;
const TOKEN_TTL_MS = 30 * 60 * 1000;
const LIVENESS_PENDING_STATUSES = new Set(['CREATED', 'IN_PROGRESS']);
const LIVENESS_FAILURE_STATUSES = new Set(['FAILED', 'EXPIRED']);

const getRekognitionClient = () => new RekognitionClient({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID.value(),
    secretAccessKey: AWS_SECRET_ACCESS_KEY.value(),
  },
});

const getSigningSecret = () => PROFILE_IMAGE_VERIFICATION_SIGNING_KEY.value();

const assertAuthenticated = (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Authentifizierung erforderlich.');
  }

  return request.auth.uid;
};

const assertString = (value, fieldName) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new HttpsError('invalid-argument', `${fieldName} ist erforderlich.`);
  }

  return value.trim();
};

const buildTempProfileImagePrefix = (uid) => `tempProfileImages/${uid}/`;
const buildApprovedProfileImagePath = (uid) => `profileImages/${uid}/profile.jpg`;

const assertOwnedTempPath = (uid, tempProfileImagePath) => {
  const normalizedPath = assertString(tempProfileImagePath, 'tempProfileImagePath').replace(/^\/+/, '');
  const expectedPrefix = buildTempProfileImagePrefix(uid);

  if (!normalizedPath.startsWith(expectedPrefix)) {
    throw new HttpsError('permission-denied', 'Temporäres Profilbild gehört nicht zum angemeldeten Nutzer.');
  }

  return normalizedPath;
};

const encodeBase64Url = (value) => Buffer.from(value).toString('base64url');
const decodeBase64UrlJson = (value) => JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));

const signPayload = (payload) => {
  const serialized = JSON.stringify(payload);
  const encodedPayload = encodeBase64Url(serialized);
  const signature = crypto
    .createHmac('sha256', getSigningSecret())
    .update(encodedPayload)
    .digest('base64url');

  return `${encodedPayload}.${signature}`;
};

const verifySignedPayload = (token, expectedUid, expectedSessionId, expectedTempPath) => {
  const rawToken = assertString(token, 'verificationToken');
  const tokenParts = rawToken.split('.');

  if (tokenParts.length !== 2) {
    throw new HttpsError('invalid-argument', 'Ungültiges Verifikationstoken.');
  }

  const [encodedPayload, providedSignature] = tokenParts;
  const expectedSignature = crypto
    .createHmac('sha256', getSigningSecret())
    .update(encodedPayload)
    .digest('base64url');

  const providedBuffer = Buffer.from(providedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (providedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
    throw new HttpsError('permission-denied', 'Signatur des Verifikationstokens ist ungültig.');
  }

  const payload = decodeBase64UrlJson(encodedPayload);

  if (!payload || payload.uid !== expectedUid || payload.sessionId !== expectedSessionId || payload.tempProfileImagePath !== expectedTempPath) {
    throw new HttpsError('permission-denied', 'Verifikationstoken passt nicht zu dieser Anfrage.');
  }

  if (!Number.isFinite(payload.expiresAt) || Date.now() > payload.expiresAt) {
    throw new HttpsError('deadline-exceeded', 'Verifikationstoken ist abgelaufen.');
  }

  return payload;
};

const toIsoString = (value) => {
  if (!value) {
    return null;
  }

  if (typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const getBucket = () => getStorage().bucket();

const loadStorageFileOrThrow = async (filePath) => {
  const file = getBucket().file(filePath);
  const [exists] = await file.exists();

  if (!exists) {
    throw new HttpsError('not-found', 'Temporäres Profilbild wurde nicht gefunden.');
  }

  const [metadata] = await file.getMetadata();
  const contentType = metadata.contentType || '';
  const size = Number(metadata.size || 0);

  if (!contentType.startsWith('image/')) {
    throw new HttpsError('invalid-argument', 'Temporäres Profilbild ist kein unterstütztes Bild.');
  }

  if (!Number.isFinite(size) || size <= 0 || size > MAX_TEMP_IMAGE_BYTES) {
    throw new HttpsError('invalid-argument', 'Temporäres Profilbild überschreitet die erlaubte Größe.');
  }

  const [buffer] = await file.download();
  return { file, buffer, metadata };
};

const extractReferenceImageBytes = (livenessResult) => {
  if (livenessResult?.ReferenceImage?.Bytes?.length) {
    return livenessResult.ReferenceImage.Bytes;
  }

  if (Array.isArray(livenessResult?.AuditImages)) {
    const withBytes = livenessResult.AuditImages.find((image) => image?.Bytes?.length);
    if (withBytes?.Bytes?.length) {
      return withBytes.Bytes;
    }
  }

  throw new HttpsError('failed-precondition', 'AWS Face Liveness hat kein Vergleichsbild geliefert.');
};

const getUserProfileSnapshot = async (uid) => {
  const userRef = getFirestore().collection('users').doc(uid);
  const snapshot = await userRef.get();
  return { userRef, snapshot };
};

const createDownloadUrl = (bucketName, filePath, downloadToken) => {
  const encodedPath = encodeURIComponent(filePath);
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media&token=${downloadToken}`;
};

exports.createFaceLivenessSession = onCall({
  region: FIREBASE_REGION,
  secrets: [AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, PROFILE_IMAGE_VERIFICATION_SIGNING_KEY],
}, async (request) => {
  const uid = assertAuthenticated(request);
  const tempProfileImagePath = assertOwnedTempPath(uid, request.data?.tempProfileImagePath);
  await loadStorageFileOrThrow(tempProfileImagePath);

  const rekognitionClient = getRekognitionClient();
  const createSessionResult = await rekognitionClient.send(new CreateFaceLivenessSessionCommand({
    ClientRequestToken: `${uid}-${Date.now()}`,
  }));

  const sessionId = createSessionResult?.SessionId;

  if (!sessionId) {
    throw new HttpsError('internal', 'AWS Face Liveness Session konnte nicht erstellt werden.');
  }

  const verificationToken = signPayload({
    uid,
    sessionId,
    tempProfileImagePath,
    expiresAt: Date.now() + TOKEN_TTL_MS,
  });

  return {
    sessionId,
    verificationToken,
    awsRegion: AWS_REGION,
    similarityThreshold: MIN_FACE_MATCH_SIMILARITY,
  };
});

exports.getFaceLivenessResultAndCompareProfileImage = onCall({
  region: FIREBASE_REGION,
  secrets: [AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, PROFILE_IMAGE_VERIFICATION_SIGNING_KEY],
}, async (request) => {
  const uid = assertAuthenticated(request);
  const sessionId = assertString(request.data?.sessionId, 'sessionId');
  const tempProfileImagePath = assertOwnedTempPath(uid, request.data?.tempProfileImagePath);
  verifySignedPayload(request.data?.verificationToken, uid, sessionId, tempProfileImagePath);

  const rekognitionClient = getRekognitionClient();
  const livenessResult = await rekognitionClient.send(new GetFaceLivenessSessionResultsCommand({
    SessionId: sessionId,
  }));

  const livenessStatus = livenessResult?.Status || 'UNKNOWN';
  const livenessPassed = livenessStatus === 'SUCCEEDED';
  const livenessConfidence = Number(livenessResult?.Confidence ?? 0);

  if (LIVENESS_PENDING_STATUSES.has(livenessStatus)) {
    return {
      approved: false,
      pending: true,
      livenessPassed: false,
      livenessStatus,
      livenessConfidence,
      similarityThreshold: MIN_FACE_MATCH_SIMILARITY,
      faceMatchSimilarity: 0,
      failureCode: 'LIVENESS_PENDING',
    };
  }

  if (!livenessPassed) {
    if (LIVENESS_FAILURE_STATUSES.has(livenessStatus)) {
      await getBucket().file(tempProfileImagePath).delete({ ignoreNotFound: true }).catch(() => undefined);
    }

    return {
      approved: false,
      pending: false,
      livenessPassed: false,
      livenessStatus,
      livenessConfidence,
      similarityThreshold: MIN_FACE_MATCH_SIMILARITY,
      faceMatchSimilarity: 0,
      failureCode: 'LIVENESS_FAILED',
    };
  }

  const referenceImageBytes = extractReferenceImageBytes(livenessResult);
  const { buffer: targetImageBytes } = await loadStorageFileOrThrow(tempProfileImagePath);
  const compareFacesResult = await rekognitionClient.send(new CompareFacesCommand({
    SourceImage: { Bytes: referenceImageBytes },
    TargetImage: { Bytes: targetImageBytes },
    SimilarityThreshold: MIN_FACE_MATCH_SIMILARITY,
  }));

  const bestMatch = Array.isArray(compareFacesResult?.FaceMatches)
    ? compareFacesResult.FaceMatches.reduce((best, current) => {
        const currentSimilarity = Number(current?.Similarity ?? 0);
        const bestSimilarity = Number(best?.Similarity ?? 0);
        return currentSimilarity > bestSimilarity ? current : best;
      }, null)
    : null;

  const faceMatchSimilarity = Number(bestMatch?.Similarity ?? 0);
  const approved = faceMatchSimilarity >= MIN_FACE_MATCH_SIMILARITY;

  if (!approved) {
    await getBucket().file(tempProfileImagePath).delete({ ignoreNotFound: true }).catch(() => undefined);
  }

  const approvalToken = approved
    ? signPayload({
        uid,
        sessionId,
        tempProfileImagePath,
        faceMatchSimilarity,
        expiresAt: Date.now() + TOKEN_TTL_MS,
      })
    : null;

  return {
    approved,
    pending: false,
    livenessPassed: true,
    livenessStatus,
    livenessConfidence,
    faceMatchSimilarity,
    similarityThreshold: MIN_FACE_MATCH_SIMILARITY,
    failureCode: approved ? null : 'FACE_MISMATCH',
    approvalToken,
  };
});

exports.approveProfileImage = onCall({
  region: FIREBASE_REGION,
  secrets: [PROFILE_IMAGE_VERIFICATION_SIGNING_KEY],
}, async (request) => {
  const uid = assertAuthenticated(request);
  const sessionId = assertString(request.data?.sessionId, 'sessionId');
  const tempProfileImagePath = assertOwnedTempPath(uid, request.data?.tempProfileImagePath);
  const approvalPayload = verifySignedPayload(request.data?.approvalToken, uid, sessionId, tempProfileImagePath);
  const faceMatchSimilarity = Number(approvalPayload.faceMatchSimilarity ?? 0);

  if (faceMatchSimilarity < MIN_FACE_MATCH_SIMILARITY) {
    throw new HttpsError('failed-precondition', 'Die Gesichtsähnlichkeit liegt unter dem Mindestwert von 90%.');
  }

  const approvedPath = buildApprovedProfileImagePath(uid);
  const { file: tempFile, buffer, metadata } = await loadStorageFileOrThrow(tempProfileImagePath);
  const bucket = getBucket();
  const approvedFile = bucket.file(approvedPath);
  const downloadToken = crypto.randomUUID();

  await approvedFile.save(buffer, {
    resumable: false,
    metadata: {
      contentType: metadata.contentType || 'image/jpeg',
      cacheControl: 'private, max-age=3600',
      metadata: {
        firebaseStorageDownloadTokens: downloadToken,
        ownerUid: uid,
        verificationStatus: 'approved',
      },
    },
  });

  await tempFile.delete({ ignoreNotFound: true });

  const profilePhotoUrl = createDownloadUrl(bucket.name, approvedPath, downloadToken);
  const { userRef } = await getUserProfileSnapshot(uid);
  await userRef.set({
    profilePhotoVerified: true,
    profilePhotoVerifiedAt: FieldValue.serverTimestamp(),
    faceMatchSimilarity,
    profilePhotoUrl,
    profileImageUri: FieldValue.delete(),
  }, { merge: true });

  return {
    approved: true,
    profilePhotoUrl,
    faceMatchSimilarity,
    profilePhotoVerified: true,
    profilePhotoVerifiedAt: new Date().toISOString(),
  };
});

exports.rejectAndDeleteTempProfileImage = onCall({
  region: FIREBASE_REGION,
  secrets: [PROFILE_IMAGE_VERIFICATION_SIGNING_KEY],
}, async (request) => {
  const uid = assertAuthenticated(request);
  const sessionId = assertString(request.data?.sessionId, 'sessionId');
  const tempProfileImagePath = assertOwnedTempPath(uid, request.data?.tempProfileImagePath);
  verifySignedPayload(request.data?.verificationToken, uid, sessionId, tempProfileImagePath);

  const file = getBucket().file(tempProfileImagePath);
  await file.delete({ ignoreNotFound: true });

  const { snapshot } = await getUserProfileSnapshot(uid);
  const profilePhotoVerifiedAt = toIsoString(snapshot.get('profilePhotoVerifiedAt'));

  return {
    deleted: true,
    profilePhotoVerified: Boolean(snapshot.get('profilePhotoVerified')),
    profilePhotoVerifiedAt,
    faceMatchSimilarity: Number(snapshot.get('faceMatchSimilarity') || 0),
    profilePhotoUrl: snapshot.get('profilePhotoUrl') || '',
  };
});