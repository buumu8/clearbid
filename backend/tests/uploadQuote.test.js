/**
 * uploadQuote.test.js
 *
 * Tests for uploadQuote.js helpers.
 * Runs with: node --test backend/tests/uploadQuote.test.js
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

// ── Helpers duplicated here to test without spinning up Express ──────────────

const PDF_MAGIC = Buffer.from([0x25, 0x50, 0x44, 0x46]);
const MAX_SIZE_BYTES = 10 * 1024 * 1024;

function hasPdfMagic(buf) {
    return buf.length >= 4 && buf.subarray(0, 4).equals(PDF_MAGIC);
}

function sha256(buf) {
    return createHash('sha256').update(buf).digest('hex');
}

function versionedNameSync(existingNames, originalName) {
    const dot = originalName.lastIndexOf('.');
    const ext = dot >= 0 ? originalName.slice(dot) : '.pdf';
    const base = dot >= 0 ? originalName.slice(0, dot) : originalName;

    const versions = existingNames.filter((f) => {
        const stripped = f.replace(/-v\d+/, '').replace(/\.\w+$/, '');
        return stripped === base;
    });

    const version = versions.length + 1;
    const fileName = version === 1 ? originalName : `${base}-v${version}${ext}`;
    return { fileName, version };
}

// ── Tests ────────────────────────────────────────────────────────────────────

test('magic byte check: accepts valid PDF header', () => {
    const buf = Buffer.concat([PDF_MAGIC, Buffer.from(' rest of file')]);
    assert.ok(hasPdfMagic(buf), 'Should accept valid PDF magic bytes');
});

test('magic byte check: rejects non-PDF buffer', () => {
    const buf = Buffer.from('This is not a PDF file at all');
    assert.ok(!hasPdfMagic(buf), 'Should reject non-PDF magic bytes');
});

test('magic byte check: rejects empty buffer', () => {
    assert.ok(!hasPdfMagic(Buffer.alloc(0)), 'Should reject empty buffer');
});

test('magic byte check: rejects buffer shorter than 4 bytes', () => {
    assert.ok(!hasPdfMagic(Buffer.from([0x25, 0x50])), 'Should reject too-short buffer');
});

test('sha256: produces a 64-char hex string', () => {
    const hash = sha256(Buffer.from('hello world'));
    assert.equal(typeof hash, 'string');
    assert.equal(hash.length, 64);
    assert.match(hash, /^[0-9a-f]{64}$/);
});

test('sha256: same content → same hash', () => {
    const a = sha256(Buffer.from('test content'));
    const b = sha256(Buffer.from('test content'));
    assert.equal(a, b);
});

test('sha256: different content → different hash', () => {
    const a = sha256(Buffer.from('content A'));
    const b = sha256(Buffer.from('content B'));
    assert.notEqual(a, b);
});

test('size limit: 10 MB constant is correct', () => {
    assert.equal(MAX_SIZE_BYTES, 10 * 1024 * 1024);
});

test('versioning: first upload keeps original name, version 1', () => {
    const { fileName, version } = versionedNameSync([], 'quote.pdf');
    assert.equal(fileName, 'quote.pdf');
    assert.equal(version, 1);
});

test('versioning: second upload with same name becomes -v2', () => {
    const { fileName, version } = versionedNameSync(['quote.pdf'], 'quote.pdf');
    assert.equal(fileName, 'quote-v2.pdf');
    assert.equal(version, 2);
});

test('versioning: third upload with same name becomes -v3', () => {
    const { fileName, version } = versionedNameSync(['quote.pdf', 'quote-v2.pdf'], 'quote.pdf');
    assert.equal(fileName, 'quote-v3.pdf');
    assert.equal(version, 3);
});

test('versioning: different base names are independent', () => {
    const { fileName, version } = versionedNameSync(['vendor-a.pdf'], 'vendor-b.pdf');
    assert.equal(fileName, 'vendor-b.pdf');
    assert.equal(version, 1);
});
