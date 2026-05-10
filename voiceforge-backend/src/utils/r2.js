const crypto = require('crypto');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const {
  R2_ENDPOINT,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET,
  R2_PUBLIC_BASE_URL,
} = process.env;

const r2Enabled = Boolean(R2_ENDPOINT && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET);

const r2Client = r2Enabled
  ? new S3Client({
      region: 'auto',
      endpoint: R2_ENDPOINT,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    })
  : null;

const buildAudioKey = (userId, ext = 'wav') => {
  const stamp = Date.now();
  const rand = crypto.randomBytes(6).toString('hex');
  return `audio/${userId}/${stamp}-${rand}.${ext}`;
};

const uploadAudioBuffer = async ({ buffer, key, contentType = 'audio/wav' }) => {
  if (!r2Client) {
    throw new Error('R2 client not configured');
  }

  await r2Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    })
  );

  const publicUrl = R2_PUBLIC_BASE_URL ? `${R2_PUBLIC_BASE_URL}/${key}` : null;
  return { key, publicUrl };
};

const deleteAudioObject = async (key) => {
  if (!r2Client || !key) return;
  await r2Client.send(
    new DeleteObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
    })
  );
};

module.exports = {
  r2Enabled,
  buildAudioKey,
  uploadAudioBuffer,
  deleteAudioObject,
};
