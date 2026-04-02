const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

/** Read a single frontmatter file and return parsed { frontmatter, content, raw }. */
function readFrontmatterFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed = matter(raw);
  return { frontmatter: parsed.data, content: parsed.content.trim(), raw };
}

/** List all .md files in a directory and parse their frontmatter. */
function readFrontmatterDir(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .map(f => {
      const { frontmatter, content } = readFrontmatterFile(path.join(dir, f));
      return { filename: f, ...frontmatter, content };
    });
}

/** Write a frontmatter file from separate data and content parts. */
function writeFrontmatter(filePath, data, content) {
  const output = matter.stringify(content || '', data || {});
  fs.writeFileSync(filePath, output, 'utf-8');
}

module.exports = { readFrontmatterFile, readFrontmatterDir, writeFrontmatter };
