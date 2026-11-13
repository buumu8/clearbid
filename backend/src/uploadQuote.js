/**
 * uploadQuote.js
 *
 * Registers POST /api/purchases/:id/upload-quote and
 * GET  /api/purchases/:id/quote-checks.
 *
 * Validates uploaded PDFs by magic bytes, MIME type, and size (10 MB cap),
 * computes a SHA-256 hash, optionally extracts text with pdf-parse, and
 * appends a versioned quote record to the purchase.
 *
 * IMPORTANT: Hash and text checks are officer review aids — they do not
 * prove authenticity or detect fraud on their own. All warnings require
 * human review.
 */

import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile, readdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import multer from 'multer';
import { getPurchase, logEvent } from './store.js';

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const UPLOAD_ROOT = new URL('../../uploads', import.meta.url).pathname;

// PDF magic bytes: %PDF (hex 25 50 44 46)
const PDF_MAGIC = Buffer.from([0x25, 0x50, 0x44, 0x46]);

// Try to import pdf-parse; degrade gracefully if unavailable.
let pdfParse = null;
try {
    const mod = await import('pdf-parse/lib/pdf-parse.js');
    pdfParse = mod.default ?? mod;
} catch {
    // pdf-parse unavailable — text extraction will be skipped.
}

// Multer stores to memory so we can inspect bytes before writing to disk.
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_SIZE_BYTES },
    fileFilter(_req, file, cb) {
        // First-pass MIME check; magic-byte check happens after in-memory receipt.
        if (file.mimetype !== 'application/pdf') {
            return cb(Object.assign(new Error('Only PDF files are accepted.'), { status: 400 }));
        }
        cb(null, true);
    },
});

/** Compute SHA-256 hex digest of a Buffer. */
function sha256(buf) {
    return createHash('sha256').update(buf).digest('hex');
}

/** Check the first 4 bytes for the PDF magic signature. */
function hasPdfMagic(buf) {
    return buf.length >= 4 && buf.subarray(0, 4).equals(PDF_MAGIC);
}

/**
 * Determine a versioned save path for the file so we never silently overwrite.
 * Returns { savePath, version }.
 */
async function versionedPath(dir, originalName) {
    const ext = extname(originalName) || '.pdf';
    const base = originalName.slice(0, originalName.length - ext.length);

    let existing = [];
    try {
        existing = await readdir(dir);
    } catch { /* directory doesn't exist yet — will be created below */ }

    // Count how many files share the same base name (any extension).
    const versions = existing.filter((f) => {
        const stripped = f.replace(/-v\d+/, '').replace(/\.\w+$/, '');
        return stripped === base;
    });

    const version = versions.length + 1;
    const fileName = version === 1 ? originalName : `${base}-v${version}${ext}`;
    return { savePath: join(dir, fileName), savedName: fileName, version };
}

/**
 * Try to extract text from a PDF buffer and produce comparison warnings
 * against entered purchase data (title, quantity — rough heuristics only).
 */
async function extractAndCheck(buf, purchase) {
    if (!pdfParse) {
        return { textExtracted: false, reason: 'pdf-parse not installed', warnings: [] };
    }
    try {
        const data = await pdfParse(buf);
        const text = (data?.text || '').toLowerCase();
        const warnings = [];

        if (!text.trim()) {
            warnings.push('⚠ No text found in PDF — may be a scanned image. Human review required.');
            return { textExtracted: true, pageCount: data?.numpages ?? 0, text: '', warnings };
        }

        // Heuristic checks — not proof of fraud or authenticity.
        if (purchase.quantity && !String(purchase.quantity).split('').every((c) => text.includes(c))) {
            // Only warn if the full quantity string is completely absent.
            const qty = String(purchase.quantity);
            if (!text.includes(qty)) {
                warnings.push(
                    `⚠ Entered quantity (${purchase.quantity}) not found in PDF text — verify manually.`
                );
            }
        }

        // Check for a rough dollar amount match for any vendor unit price.
        if (purchase.review?.vendors) {
            for (const v of purchase.review.vendors) {
                const price = String(Math.round(v.unitPrice));
                if (!text.includes(price)) {
                    warnings.push(
                        `⚠ Unit price $${v.unitPrice} for "${v.vendor}" not found in PDF text — verify manually.`
                    );
                }
            }
        }

        return { textExtracted: true, pageCount: data?.numpages ?? 0, warnings };
    } catch (err) {
        return {
            textExtracted: false,
            reason: `Text extraction error: ${err.message}`,
            warnings: ['⚠ Could not extract text from PDF — human review required.'],
        };
    }
}

/** Register the two quote-related routes onto the Express app. */
export function registerUploadRoutes(app) {
    // POST /api/purchases/:id/upload-quote
    app.post(
        '/api/purchases/:id/upload-quote',
        upload.single('file'),
        async (req, res, next) => {
            try {
                const purchase = getPurchase(req.params.id);
                if (!purchase) return res.status(404).json({ error: 'Purchase not found.' });

                const file = req.file;
                if (!file) return res.status(400).json({ error: 'No file received.' });

                // Magic-byte check (belt-and-suspenders beyond MIME).
                if (!hasPdfMagic(file.buffer)) {
                    return res.status(400).json({
                        error: 'File does not appear to be a valid PDF (magic bytes check failed).',
                    });
                }

                const hash = sha256(file.buffer);
                const dir = join(UPLOAD_ROOT, req.params.id);
                await mkdir(dir, { recursive: true });

                const { savePath, savedName, version } = await versionedPath(dir, file.originalname);
                await writeFile(savePath, file.buffer);

                const extraction = await extractAndCheck(file.buffer, purchase);

                const quoteRecord = {
                    fileName: savedName,
                    originalName: file.originalname,
                    size: file.size,
                    sha256: hash,
                    uploadedAt: new Date().toISOString(),
                    version,
                    textExtracted: extraction.textExtracted,
                    warnings: extraction.warnings,
                };

                // Append to purchase.quotes (preserve earlier entries).
                purchase.quotes = Array.isArray(purchase.quotes) ? purchase.quotes : [];
                purchase.quotes.push(quoteRecord);

                logEvent(req.params.id, 'officer', 'quote_uploaded', {
                    fileName: savedName,
                    originalName: file.originalname,
                    sha256: hash,
                    version,
                });

                res.json({
                    fileName: savedName,
                    originalName: file.originalname,
                    sha256: hash,
                    version,
                    textExtracted: extraction.textExtracted,
                    textExtractionReason: extraction.reason,
                    pageCount: extraction.pageCount,
                    warnings: extraction.warnings,
                    notice:
                        'These checks are officer review aids. They do not prove authenticity or detect fraud on their own. All warnings require human review.',
                });
            } catch (err) {
                next(err);
            }
        }
    );

    // GET /api/purchases/:id/quote-checks
    app.get('/api/purchases/:id/quote-checks', (req, res) => {
        const purchase = getPurchase(req.params.id);
        if (!purchase) return res.status(404).json({ error: 'Purchase not found.' });

        const quotes = (purchase.quotes || []).filter((q) => q.sha256); // only uploaded records
        res.json({
            purchaseId: req.params.id,
            quotes,
            notice:
                'These checks are officer review aids. They do not prove authenticity or detect fraud on their own. All warnings require human review.',
        });
    });
}
