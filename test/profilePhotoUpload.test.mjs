import assert from 'node:assert/strict';
import test from 'node:test';

import {
    PROFILE_PHOTO_MAX_BYTES,
    buildProfilePhotoStatePatch,
    uploadProfilePhoto,
    validateProfilePhotoAsset,
} from '../untils/profilePhotoUpload.js';

test('validiert ein unterstuetztes Profilbild erfolgreich', () => {
  const asset = {
    uri: 'file:///tmp/avatar.jpg',
    fileName: 'avatar.jpg',
    mimeType: 'image/jpeg',
    fileSize: 512000,
  };

  assert.equal(validateProfilePhotoAsset(asset), asset);
});

test('lehnt nicht unterstuetztes Bildformat ab', () => {
  const asset = {
    uri: 'file:///tmp/avatar.gif',
    fileName: 'avatar.gif',
    mimeType: 'image/gif',
    fileSize: 1234,
  };

  assert.throws(
    () => validateProfilePhotoAsset(asset),
    /unterstütztes Bildformat/i,
  );
});

test('lehnt zu grosse Profilbilder ab', () => {
  const asset = {
    uri: 'file:///tmp/avatar.jpg',
    fileName: 'avatar.jpg',
    mimeType: 'image/jpeg',
    fileSize: PROFILE_PHOTO_MAX_BYTES + 1,
  };

  assert.throws(
    () => validateProfilePhotoAsset(asset),
    /8 MB/i,
  );
});

test('liefert beim Direktupload den erwarteten Profil-Patch zurueck', async () => {
  const calls = [];
  const asset = {
    uri: 'file:///tmp/avatar.jpg',
    fileName: 'avatar.jpg',
    mimeType: 'image/jpeg',
    fileSize: 1024,
  };

  const result = await uploadProfilePhoto({
    asset,
    ownerId: 'user-1',
    uploadAsset: async (...args) => {
      calls.push(args);
      return 'https://storage.example/profileImages/user-1/avatar.jpg';
    },
  });

  assert.deepEqual(calls, [['profileImages', asset, 'user-1']]);
  assert.deepEqual(result, {
    directUpload: true,
    ...buildProfilePhotoStatePatch('https://storage.example/profileImages/user-1/avatar.jpg'),
  });
  assert.equal(result.profileImageUploaded, true);
  assert.equal(result.verificationState, 'uploaded');
});

test('reicht Upload-Fehler unveraendert weiter', async () => {
  const asset = {
    uri: 'file:///tmp/avatar.jpg',
    fileName: 'avatar.jpg',
    mimeType: 'image/jpeg',
    fileSize: 1024,
  };

  await assert.rejects(
    uploadProfilePhoto({
      asset,
      ownerId: 'user-1',
      uploadAsset: async () => {
        throw new Error('storage down');
      },
    }),
    /storage down/i,
  );
});

test('verwendet keinen separaten Fakecheck-Dienst neben dem Storage-Upload', async () => {
  let uploadCalls = 0;

  const result = await uploadProfilePhoto({
    asset: {
      uri: 'file:///tmp/avatar.webp',
      fileName: 'avatar.webp',
      mimeType: 'image/webp',
      fileSize: 1024,
    },
    ownerId: 'user-2',
    uploadAsset: async () => {
      uploadCalls += 1;
      return 'https://storage.example/profileImages/user-2/avatar.webp';
    },
  });

  assert.equal(uploadCalls, 1);
  assert.equal(result.profilePhotoUrl, 'https://storage.example/profileImages/user-2/avatar.webp');
  assert.equal(result.profileImageUri, result.profilePhotoUrl);
});