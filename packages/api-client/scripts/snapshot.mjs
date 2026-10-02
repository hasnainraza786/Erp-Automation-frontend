// Refreshes openapi.snapshot.json from a running API: API_SPEC_URL=http://localhost:4000/openapi.json yarn api:snapshot
import { writeFile } from 'node:fs/promises';

const url = process.env.API_SPEC_URL ?? 'http://localhost:4000/openapi.json';
const res = await fetch(url);
if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
const spec = await res.json();
await writeFile(new URL('../openapi.snapshot.json', import.meta.url), JSON.stringify(spec, null, 2) + '\n');
console.log(`Snapshot updated from ${url} (${Object.keys(spec.paths).length} paths)`);
