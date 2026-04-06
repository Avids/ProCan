import { S3Client, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import path from 'path';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

export const uploadToS3 = async (file: Express.Multer.File): Promise<{ url: string; key: string }> => {
  const bucket = process.env.AWS_S3_BUCKET;
  if (!bucket) throw new Error('AWS_S3_BUCKET is not configured.');

  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
  const ext = path.extname(file.originalname);
  const key = `uploads/${uniqueSuffix}${ext}`;

  const uploadTask = new Upload({
    client: s3Client,
    params: {
      Bucket: bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    },
  });

  await uploadTask.done();
  const url = `https://${bucket}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
  return { url, key };
};

export const deleteFromS3 = async (key: string): Promise<void> => {
  const bucket = process.env.AWS_S3_BUCKET;
  if (!bucket) return; // Silently skip if not configured
  await s3Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
};

export const getPresignedUrl = async (key: string): Promise<string> => {
  const bucket = process.env.AWS_S3_BUCKET;
  if (!bucket) throw new Error('AWS_S3_BUCKET is not configured.');
  
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  // Generate a URL valid for 1 hour
  return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
};
