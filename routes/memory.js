const express = require('express');
const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const AdmZip = require('adm-zip');
const { backup, safeSlug, safeMemoryFile, wrapRoute } = require('../lib/file-helpers');

const router = express.Router({ mergeParams: true });

const zipBodyParser = express.raw({ type: 'application/zip', limit: '25mb' });

router.get('/:slug/memory', wrapRoute((req, res) => {
  const dir = safeSlug(req.params.slug);
  if (!dir) return res.status(400).json({ error: 'Invalid slug' });

  const memoryDir = path.join(dir, 'memory');
  if (!fs.existsSync(memoryDir)) return res.json([]);

  const files = fs.readdirSync(memoryDir).filter(f => f.endsWith('.md'));
  const memories = files.map(f => {
    const raw = fs.readFileSync(path.join(memoryDir, f), 'utf-8');
    const parsed = matter(raw);
    return {
      filename: f,
      name: parsed.data.name || f,
      description: parsed.data.description || '',
      type: parsed.data.type || 'unknown',
      content: parsed.content.trim()
    };
  });
  res.json(memories);
}));

router.get('/:slug/memory/:file', wrapRoute((req, res) => {
  const dir = safeSlug(req.params.slug);
  const file = safeMemoryFile(req.params.file);
  if (!dir || !file) return res.status(400).json({ error: 'Invalid params' });

  const filePath = path.join(dir, 'memory', file);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });

  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed = matter(raw);
  res.json({
    filename: file,
    name: parsed.data.name || '',
    description: parsed.data.description || '',
    type: parsed.data.type || '',
    content: parsed.content.trim(),
    raw
  });
}));

router.put('/:slug/memory/:file', wrapRoute((req, res) => {
  const dir = safeSlug(req.params.slug);
  const file = safeMemoryFile(req.params.file);
  if (!dir || !file) return res.status(400).json({ error: 'Invalid params' });

  const filePath = path.join(dir, 'memory', file);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });

  const { name, description, type, content } = req.body;
  backup(filePath);
  const frontmatter = matter.stringify(content || '', { name, description, type });
  fs.writeFileSync(filePath, frontmatter, 'utf-8');
  res.json({ ok: true });
}));

router.post('/:slug/memory', wrapRoute((req, res) => {
  const dir = safeSlug(req.params.slug);
  if (!dir) return res.status(400).json({ error: 'Invalid slug' });

  const memoryDir = path.join(dir, 'memory');
  fs.mkdirSync(memoryDir, { recursive: true });

  const { filename, name, description, type, content } = req.body;
  const safe = safeMemoryFile(filename);
  if (!safe) return res.status(400).json({ error: 'Invalid filename' });

  const filePath = path.join(memoryDir, safe);
  if (fs.existsSync(filePath)) return res.status(409).json({ error: 'File already exists' });

  const frontmatter = matter.stringify(content || '', { name, description, type });
  fs.writeFileSync(filePath, frontmatter, 'utf-8');
  res.json({ ok: true });
}));

router.delete('/:slug/memory/:file', wrapRoute((req, res) => {
  const dir = safeSlug(req.params.slug);
  const file = safeMemoryFile(req.params.file);
  if (!dir || !file) return res.status(400).json({ error: 'Invalid params' });

  const filePath = path.join(dir, 'memory', file);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });

  backup(filePath);
  fs.unlinkSync(filePath);
  res.json({ ok: true });
}));

// --- Export / Import ---

router.get('/:slug/memory-export', wrapRoute((req, res) => {
  const dir = safeSlug(req.params.slug);
  if (!dir) return res.status(400).json({ error: 'Invalid slug' });

  const memoryDir = path.join(dir, 'memory');
  const zip = new AdmZip();
  let fileCount = 0;

  if (fs.existsSync(memoryDir)) {
    const entries = fs.readdirSync(memoryDir).filter(f => f.endsWith('.md'));
    for (const f of entries) {
      zip.addLocalFile(path.join(memoryDir, f));
      fileCount++;
    }
  }

  if (fileCount === 0) return res.status(404).json({ error: 'No memory files to export' });

  const buf = zip.toBuffer();
  const downloadName = `memory-${req.params.slug}-${new Date().toISOString().slice(0, 10)}.zip`;
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
  res.setHeader('X-File-Count', String(fileCount));
  res.send(buf);
}));

router.post('/:slug/memory-import', zipBodyParser, wrapRoute((req, res) => {
  const dir = safeSlug(req.params.slug);
  if (!dir) return res.status(400).json({ error: 'Invalid slug' });

  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    return res.status(400).json({ error: 'Expected ZIP binary body (Content-Type: application/zip)' });
  }

  const overwrite = req.query.overwrite === '1' || req.query.overwrite === 'true';

  let zip;
  try {
    zip = new AdmZip(req.body);
  } catch (e) {
    return res.status(400).json({ error: 'Not a valid ZIP file: ' + e.message });
  }

  const entries = zip.getEntries().filter(e => !e.isDirectory && e.entryName.endsWith('.md'));
  if (entries.length === 0) return res.status(400).json({ error: 'ZIP contains no .md files' });

  const validated = [];
  for (const entry of entries) {
    const basename = path.basename(entry.entryName);
    const safe = safeMemoryFile(basename);
    if (!safe) return res.status(400).json({ error: 'Invalid filename in ZIP: ' + entry.entryName });
    validated.push({ filename: safe, content: entry.getData().toString('utf-8') });
  }

  const memoryDir = path.join(dir, 'memory');
  fs.mkdirSync(memoryDir, { recursive: true });

  const conflicts = validated
    .filter(f => fs.existsSync(path.join(memoryDir, f.filename)))
    .map(f => f.filename);

  if (conflicts.length > 0 && !overwrite) {
    return res.status(409).json({ error: 'conflict', conflicts });
  }

  for (const f of validated) {
    const filePath = path.join(memoryDir, f.filename);
    if (fs.existsSync(filePath)) backup(filePath);
    fs.writeFileSync(filePath, f.content, 'utf-8');
  }

  res.json({ ok: true, imported: validated.length });
}));

// --- MEMORY.md index ---

router.get('/:slug/memory-index', wrapRoute((req, res) => {
  const dir = safeSlug(req.params.slug);
  if (!dir) return res.status(400).json({ error: 'Invalid slug' });

  const filePath = path.join(dir, 'memory', 'MEMORY.md');
  if (!fs.existsSync(filePath)) return res.json({ content: '' });

  res.json({ content: fs.readFileSync(filePath, 'utf-8') });
}));

router.put('/:slug/memory-index', wrapRoute((req, res) => {
  const dir = safeSlug(req.params.slug);
  if (!dir) return res.status(400).json({ error: 'Invalid slug' });

  const filePath = path.join(dir, 'memory', 'MEMORY.md');
  backup(filePath);
  fs.mkdirSync(path.join(dir, 'memory'), { recursive: true });
  fs.writeFileSync(filePath, req.body.content, 'utf-8');
  res.json({ ok: true });
}));

module.exports = router;
