#!/usr/bin/env node
/**
 * Import questions from a CSV into Supabase, no redeploy needed.
 *
 *   SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=... \
 *     node scripts/import-questions.mjs questions.csv [--dry-run]
 *
 * Columns (header row required, any order):
 *   id (optional, for updating), category, difficulty, text,
 *   option_a, option_b, option_c, option_d, correct (A–D or 1–4), image_url (optional)
 *
 * category: quick-maths | general-knowledge | naija-trivia | science | football | bible-quran
 * difficulty: easy | medium | hard
 * Rows with an id are upserted; rows without one get a stable id derived from their text.
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const CATEGORIES = ['quick-maths', 'general-knowledge', 'naija-trivia', 'science', 'football', 'bible-quran'];
const DIFFICULTIES = ['easy', 'medium', 'hard'];

/** Small RFC 4180 parser: quoted fields, escaped quotes, commas and newlines inside quotes. */
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((f) => f.trim() !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== '')) rows.push(row);
  return rows;
}

function toQuestion(rec, line) {
  const err = (m) => { throw new Error(`Line ${line}: ${m}`); };
  const category = rec.category?.trim().toLowerCase();
  const difficulty = (rec.difficulty?.trim().toLowerCase() || 'medium');
  const text = rec.text?.trim();
  const options = ['option_a', 'option_b', 'option_c', 'option_d'].map((k) => rec[k]?.trim() ?? '');
  const correctRaw = rec.correct?.trim().toUpperCase();
  const correct_index = 'ABCD'.includes(correctRaw) && correctRaw.length === 1
    ? 'ABCD'.indexOf(correctRaw)
    : Number(correctRaw) - 1;

  if (!CATEGORIES.includes(category)) err(`unknown category "${rec.category}"`);
  if (!DIFFICULTIES.includes(difficulty)) err(`unknown difficulty "${rec.difficulty}"`);
  if (!text || text.length < 3) err('missing question text');
  if (options.some((o) => !o)) err('all four options are required');
  if (new Set(options.map((o) => o.toLowerCase())).size !== 4) err('options must be different');
  if (!(correct_index >= 0 && correct_index <= 3)) err(`correct must be A–D or 1–4, got "${rec.correct}"`);

  const id = rec.id?.trim() || `${category}-${createHash('sha1').update(text.toLowerCase()).digest('hex').slice(0, 12)}`;
  return { id, category, difficulty, text, options, correct_index, image_url: rec.image_url?.trim() || null, active: true };
}

const [file, ...flags] = process.argv.slice(2);
if (!file) {
  console.error('Usage: node scripts/import-questions.mjs <file.csv> [--dry-run]');
  process.exit(1);
}
const dryRun = flags.includes('--dry-run');

const [header, ...data] = parseCsv(readFileSync(file, 'utf8').replace(/^﻿/, ''));
const cols = header.map((h) => h.trim().toLowerCase());
const questions = [];
const errors = [];
data.forEach((cells, i) => {
  const rec = Object.fromEntries(cols.map((c, j) => [c, cells[j]]));
  try { questions.push(toQuestion(rec, i + 2)); } catch (e) { errors.push(e.message); }
});

if (errors.length) {
  console.error(`${errors.length} row(s) have problems:\n  ${errors.join('\n  ')}`);
  process.exit(1);
}
const byCat = questions.reduce((m, q) => ((m[q.category] = (m[q.category] ?? 0) + 1), m), {});
console.log(`Parsed ${questions.length} questions:`, byCat);
if (dryRun) process.exit(0);

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (the service role key, never ship it to the app).');
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });
for (let i = 0; i < questions.length; i += 500) {
  const { error } = await db.from('questions').upsert(questions.slice(i, i + 500), { onConflict: 'id' });
  if (error) { console.error('Import failed:', error.message); process.exit(1); }
}
console.log('Imported.');
