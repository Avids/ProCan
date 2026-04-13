import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { uploadToS3, deleteFromS3, getPresignedUrl } from '../utils/s3';
import { PDFDocument } from 'pdf-lib';

const router = Router();
const prisma = new PrismaClient();
router.use(authenticate);

const FILE_LIMIT = 2;
const LINK_LIMIT = 3;

// ── GET attachments for an entity ─────────────────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  const { entityType, entityId } = req.query;
  if (!entityType || !entityId)
    return res.status(400).json({ error: 'entityType and entityId are required' });
  try {
    const attachments = await prisma.attachment.findMany({
      where: { entityType: String(entityType), entityId: String(entityId) },
      orderBy: { createdAt: 'asc' },
      include: { uploadedBy: { select: { firstName: true, lastName: true } } },
    });

    // Map files to presigned URLs dynamically so bucket contents can remain private
    const populated = await Promise.all(attachments.map(async (a) => {
      if (a.kind === 'FILE' && a.s3Key) {
        try {
          const presigned = await getPresignedUrl(a.s3Key);
          return { ...a, url: presigned };
        } catch (e) { console.error('Failed to presign URL', e); }
      }
      return a;
    }));

    res.json(populated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch attachments' });
  }
});

// ── POST upload a FILE ─────────────────────────────────────────────────────────
router.post('/upload', upload.single('file'), async (req: any, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'No file provided' });
  const { entityType, entityId, label } = req.body;
  if (!entityType || !entityId)
    return res.status(400).json({ error: 'entityType and entityId are required' });

  try {
    // Enforce file limit
    const existingFiles = await prisma.attachment.count({
      where: { entityType, entityId, kind: 'FILE' },
    });
    if (existingFiles >= FILE_LIMIT)
      return res.status(409).json({ error: `Maximum of ${FILE_LIMIT} files allowed per item` });

    const { url, key } = await uploadToS3(req.file);

    const attachment = await prisma.attachment.create({
      data: {
        entityType,
        entityId,
        kind: 'FILE',
        label: label || req.file.originalname,
        url,
        filename: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        s3Key: key,
        uploadedById: req.user.id,
      },
      include: { uploadedBy: { select: { firstName: true, lastName: true } } },
    });

    let presignedUrl = attachment.url;
    if (attachment.s3Key && attachment.kind === 'FILE') {
      try { presignedUrl = await getPresignedUrl(attachment.s3Key); } catch (e) { }
    }

    res.status(201).json({ ...attachment, url: presignedUrl });
  } catch (err: any) {
    console.error('Attachment upload error:', err);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// ── POST add an external LINK ──────────────────────────────────────────────────
router.post('/link', async (req: any, res: Response) => {
  const { entityType, entityId, label, url } = req.body;
  if (!entityType || !entityId || !url)
    return res.status(400).json({ error: 'entityType, entityId, and url are required' });

  // Basic URL validation
  try { new URL(url); } catch {
    return res.status(400).json({ error: 'Invalid URL format' });
  }

  try {
    // Enforce link limit
    const existingLinks = await prisma.attachment.count({
      where: { entityType, entityId, kind: 'LINK' },
    });
    if (existingLinks >= LINK_LIMIT)
      return res.status(409).json({ error: `Maximum of ${LINK_LIMIT} links allowed per item` });

    const attachment = await prisma.attachment.create({
      data: {
        entityType,
        entityId,
        kind: 'LINK',
        label: label || url,
        url,
        uploadedById: req.user.id,
      },
      include: { uploadedBy: { select: { firstName: true, lastName: true } } },
    });

    res.status(201).json(attachment);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save link' });
  }
});

// ── PATCH update label ─────────────────────────────────────────────────────────
router.patch('/:id', async (req: any, res: Response) => {
  const { label } = req.body;
  try {
    const a = await prisma.attachment.update({
      where: { id: req.params.id },
      data: { label },
      include: { uploadedBy: { select: { firstName: true, lastName: true } } },
    });
    res.json(a);
  } catch {
    res.status(500).json({ error: 'Failed to update attachment' });
  }
});

// ── DELETE attachment ──────────────────────────────────────────────────────────
router.delete('/:id', async (req: any, res: Response) => {
  try {
    const a = await prisma.attachment.findUnique({ where: { id: req.params.id } });
    if (!a) return res.status(404).json({ error: 'Attachment not found' });

    // Delete from S3 if it's a file
    if (a.kind === 'FILE' && a.s3Key) {
      try { await deleteFromS3(a.s3Key); } catch (e) {
        console.warn('S3 delete failed (continuing):', e);
      }
    }

    await prisma.attachment.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(500).json({ error: 'Failed to delete attachment' });
  }
});

// ── GET proxy for a FILE (to avoid CORS) ───────────────────────────────────────
router.get('/:id/proxy', async (req: Request, res: Response) => {
  try {
    const attachment = await prisma.attachment.findUnique({ where: { id: req.params.id } });
    if (!attachment || attachment.kind !== 'FILE') return res.status(404).json({ error: 'FILE attachment not found' });

    let finalUrl = attachment.url;
    if (attachment.s3Key) {
      finalUrl = await getPresignedUrl(attachment.s3Key);
    }

    const response = await fetch(finalUrl);
    if (!response.ok) throw new Error(`Failed to fetch from S3: ${response.statusText}`);

    const buffer = await response.arrayBuffer();
    res.setHeader('Content-Type', attachment.mimeType || 'application/octet-stream');
    res.send(Buffer.from(buffer));
  } catch (err: any) {
    console.error('Attachment proxy error:', err);
    res.status(500).json({ error: 'Failed to proxy attachment content' });
  }
});

// ── POST merge multiple PDFs ──────────────────────────────────────────────────
router.post('/merge', upload.single('cover'), async (req: any, res: Response) => {
  try {
    const { attachmentIds } = req.body; // Array of IDs as JSON string or array
    const ids = Array.isArray(attachmentIds) ? attachmentIds : JSON.parse(attachmentIds || '[]');
    
    const resultPdf = await PDFDocument.create();

    // 1. Load and add Cover Page
    if (req.file) {
      const coverDoc = await PDFDocument.load(req.file.buffer);
      const pages = await resultPdf.copyPages(coverDoc, coverDoc.getPageIndices());
      pages.forEach(p => resultPdf.addPage(p));
    }

    // 2. Fetch and merge attachments
    for (const id of ids) {
      try {
        const attach = await prisma.attachment.findUnique({ where: { id } });
        if (!attach || attach.kind !== 'FILE' || !attach.url.toLowerCase().endsWith('.pdf')) continue;

        let finalUrl = attach.url;
        if (attach.s3Key) {
          finalUrl = await getPresignedUrl(attach.s3Key);
        }

        const attachRes = await fetch(finalUrl);
        const bytes = await attachRes.arrayBuffer();
        const attachDoc = await PDFDocument.load(bytes);
        const pages = await resultPdf.copyPages(attachDoc, attachDoc.getPageIndices());
        pages.forEach(p => resultPdf.addPage(p));
      } catch (e) {
         console.error('Failed to merge attachment in backend:', id, e);
      }
    }

    const mergedBytes = await resultPdf.save();
    res.setHeader('Content-Type', 'application/pdf');
    res.send(Buffer.from(mergedBytes));
  } catch (err: any) {
    console.error('PDF Merging error:', err);
    res.status(500).json({ error: 'Failed to merge PDFs' });
  }
});

export default router;
