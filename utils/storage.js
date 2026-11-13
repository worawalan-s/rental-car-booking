const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

let s3ClientInstance = null;

const isS3Configured = () => {
  return Boolean(
    process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY &&
      process.env.AWS_BUCKET_NAME
  );
};

const getS3Client = () => {
  if (!s3ClientInstance) {
    s3ClientInstance = new S3Client({
      region: process.env.AWS_REGION || 'ap-southeast-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
  }
  return s3ClientInstance;
};

/**
 * Upload a file buffer to AWS S3 if credentials are provided,
 * or fallback to local disk storage (public/uploads/<folder>)
 *
 * @param {Object} file - Multer memory storage file object ({ buffer, originalname, mimetype })
 * @param {string} folder - Sub-directory or S3 prefix (default: 'licenses')
 * @returns {Promise<{ key: string, url: string, provider: 's3' | 'local' }>}
 */
const uploadFile = async (file, folder = 'licenses') => {
  if (!file || !file.buffer) {
    throw new Error('No file buffer provided for upload');
  }

  const ext = path.extname(file.originalname || '').toLowerCase();
  const randomSuffix = crypto.randomBytes(8).toString('hex');
  const filename = `${Date.now()}-${randomSuffix}${ext}`;
  const key = `${folder}/${filename}`;

  if (isS3Configured()) {
    const client = getS3Client();
    const region = process.env.AWS_REGION || 'ap-southeast-1';
    const bucket = process.env.AWS_BUCKET_NAME;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    });

    await client.send(command);

    const url = process.env.AWS_S3_CUSTOM_DOMAIN
      ? `${process.env.AWS_S3_CUSTOM_DOMAIN.replace(/\/$/, '')}/${key}`
      : `https://${bucket}.s3.${region}.amazonaws.com/${key}`;

    return {
      key,
      url,
      provider: 's3',
    };
  }

  // Local filesystem fallback
  const uploadDir = path.join(__dirname, '..', 'public', 'uploads', folder);
  await fs.promises.mkdir(uploadDir, { recursive: true });

  const filePath = path.join(uploadDir, filename);
  await fs.promises.writeFile(filePath, file.buffer);

  const localUrl = `/uploads/${folder}/${filename}`;

  return {
    key: filename,
    url: localUrl,
    provider: 'local',
  };
};

/**
 * Delete a file from storage
 *
 * @param {string} key - S3 Key or local filename
 * @param {string} folder - Subdirectory for local files
 * @param {'s3'|'local'} provider
 */
const deleteFile = async (key, folder = 'licenses', provider = 'local') => {
  if (provider === 's3' && isS3Configured()) {
    const client = getS3Client();
    await client.send(
      new DeleteObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: key,
      })
    );
    return;
  }

  try {
    const filePath = path.join(__dirname, '..', 'public', 'uploads', folder, key);
    await fs.promises.unlink(filePath);
  } catch (err) {
    // Ignore if file already doesn't exist
    if (err.code !== 'ENOENT') {
      throw err;
    }
  }
};

module.exports = {
  isS3Configured,
  uploadFile,
  deleteFile,
};
