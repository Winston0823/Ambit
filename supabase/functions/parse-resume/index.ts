import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { extractText, getDocumentProxy } from 'https://esm.sh/unpdf@0.12.1';
import { unzipSync, strFromU8 } from 'https://esm.sh/fflate@0.8.2';
import { encodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts';

// Anthropic (Haiku) for structured extraction. NEW secret to add:
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TEXT_CAP = 24000; // safety bound on extracted text

// Structured-output schema — Claude is constrained to return exactly this shape.
// All fields required; the model fills empty strings / arrays when absent.
const RESUME_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { type: 'string' },
    headline: { type: 'string' },
    skills: { type: 'array', items: { type: 'string' } },
    links: {
      type: 'object',
      additionalProperties: false,
      properties: {
        github: { type: 'string' },
        linkedin: { type: 'string' },
        portfolio: { type: 'string' },
      },
      required: ['github', 'linkedin', 'portfolio'],
    },
    experience: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { title: { type: 'string' }, org: { type: 'string' }, summary: { type: 'string' } },
        required: ['title', 'org', 'summary'],
      },
    },
    education: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { school: { type: 'string' }, degree: { type: 'string' }, year: { type: 'string' } },
        required: ['school', 'degree', 'year'],
      },
    },
    portfolio: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { title: { type: 'string' }, description: { type: 'string' }, link: { type: 'string' } },
        required: ['title', 'description', 'link'],
      },
    },
  },
  required: ['name', 'headline', 'skills', 'links', 'experience', 'education', 'portfolio'],
};

const SYSTEM = `You extract structured profile data from a résumé for a student/early-career networking app.
Return ONLY the fields in the schema. Rules:
- name: the person's full name.
- headline: one warm, first-person sentence capturing what they build / are into (≤140 chars). Infer; don't copy a job title verbatim.
- skills: 5–12 short canonical tags (e.g. "React", "Python", "UI Design", "Machine Learning"). No sentences, no duplicates.
- links: github / linkedin / portfolio URLs if present, else "".
- experience / education: only what's clearly stated; summary is one concise line.
- portfolio: notable projects worth showcasing (title + one-line description + link if any). Empty array if none.
Use "" or [] for anything absent. Do not invent facts.`;

type ParseBody =
  | { kind: 'text'; text: string }
  | { kind: 'pdf' | 'docx' | 'image'; path: string };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  try {
    // 1. Authenticate the caller.
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return json({ error: 'Unauthorized' }, 401);

    const body = (await req.json().catch(() => null)) as ParseBody | null;
    if (!body || !body.kind) return json({ error: 'kind required' }, 400);

    // 2. Resolve the input into either text or an image block for Claude.
    let userContent: unknown;

    if (body.kind === 'text') {
      const t = String(body.text ?? '').trim();
      if (!t) return json({ error: 'text required' }, 400);
      userContent = `Résumé text:\n\n${t.slice(0, TEXT_CAP)}`;
    } else {
      const { path } = body;
      if (!path || !path.startsWith(`${user.id}/`)) return json({ error: 'Forbidden' }, 403);

      const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const { data: file, error: dlErr } = await admin.storage.from('resumes').download(path);
      if (dlErr || !file) return json({ error: 'File not found' }, 404);
      const bytes = new Uint8Array(await file.arrayBuffer());

      let text: string | null = null;
      let image: { media_type: string; data: string } | null = null;

      if (body.kind === 'pdf') {
        const pdf = await getDocumentProxy(bytes);
        const out = await extractText(pdf, { mergePages: true });
        text = String(out.text ?? '').trim();
      } else if (body.kind === 'docx') {
        text = docxToText(bytes);
      } else if (body.kind === 'image') {
        image = { media_type: mediaTypeFor(path), data: encodeBase64(bytes) };
      }

      // Done reading the file — delete it (we keep only the extracted JSON).
      await admin.storage.from('resumes').remove([path]).catch(() => {});

      if (image) {
        userContent = [
          { type: 'image', source: { type: 'base64', media_type: image.media_type, data: image.data } },
          { type: 'text', text: 'This image is a résumé. Extract the fields per the schema.' },
        ];
      } else {
        const clean = (text ?? '').slice(0, TEXT_CAP);
        if (!clean.trim()) return json({ error: 'Could not read any text from this file' }, 422);
        userContent = `Résumé text:\n\n${clean}`;
      }
    }

    // 3. Structure it with Claude Haiku (text or vision — same schema).
    const parsed = await extractWithClaude(userContent);
    return json(parsed, 200);
  } catch (e: any) {
    console.error('parse-resume error:', e);
    return json({ error: e?.message ?? 'Internal error' }, 500);
  }
});

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function mediaTypeFor(path: string): string {
  const ext = path.toLowerCase().split('.').pop();
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  return 'image/jpeg';
}

// DOCX = a ZIP whose word/document.xml holds the body. Dependency-light
// extraction (fflate unzip + tag strip) — robust in Deno without a heavy
// node-based parser. Good enough: the LLM only needs the words.
function docxToText(bytes: Uint8Array): string {
  try {
    const files = unzipSync(bytes);
    const xml = files['word/document.xml'];
    if (!xml) return '';
    return strFromU8(xml)
      .replace(/<w:tab[^>]*\/>/g, ' ')
      .replace(/<\/w:p>/g, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  } catch {
    return '';
  }
}

async function extractWithClaude(userContent: unknown): Promise<unknown> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      // If your account requires it for structured outputs, add:
      //   'anthropic-beta': 'structured-outputs-2025-11-13',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 2048,
      system: SYSTEM,
      messages: [{ role: 'user', content: userContent }],
      output_config: { format: { type: 'json_schema', schema: RESUME_SCHEMA } },
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const block = (data.content ?? []).find((b: any) => b.type === 'text');
  if (!block?.text) throw new Error('No structured output returned');
  return JSON.parse(block.text);
}
