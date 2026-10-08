import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { ORDER_CATALOG } from './server/catalog.js';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const outputDirectory = path.join(projectRoot, 'dist');
const requiredFiles = [
  'index.html',
  'login.html',
  'styles.css',
  'app.js',
  'data.js',
  'favicon.svg',
  'robots.txt',
  'sitemap.xml'
];

const supabaseUrl = process.env.SUPABASE_URL?.trim();
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();

const clientDataSource = await readFile(path.join(projectRoot, 'data.js'), 'utf8');
const clientContext = {};
runInNewContext(`${clientDataSource}\nglobalThis.__catalogForBuild = PRODUCTS_DATA;`, clientContext);
const clientProducts = clientContext.__catalogForBuild;

if (clientProducts.length !== Object.keys(ORDER_CATALOG).length) {
  throw new Error('Server order catalog must contain exactly the same products as data.js.');
}
for (const product of clientProducts) {
  const orderProduct = ORDER_CATALOG[product.id];
  if (
    !orderProduct
    || orderProduct.name !== product.name
    || orderProduct.price !== product.launchPrice
    || JSON.stringify(orderProduct.sizes) !== JSON.stringify(product.sizes)
  ) {
    throw new Error(`Server order price or size options do not match data.js for ${product.id}.`);
  }
}

if (!supabaseUrl || !publishableKey) {
  throw new Error('Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY before building.');
}

let parsedUrl;
try {
  parsedUrl = new URL(supabaseUrl);
} catch {
  throw new Error('SUPABASE_URL must be a valid HTTPS URL.');
}

if (parsedUrl.protocol !== 'https:') {
  throw new Error('SUPABASE_URL must use HTTPS.');
}

const isLegacyAnonKey = () => {
  const payload = publishableKey.split('.')[1];
  if (!payload) return false;

  try {
    const decoded = Buffer.from(payload, 'base64url').toString('utf8');
    return JSON.parse(decoded).role === 'anon';
  } catch {
    return false;
  }
};

if (!publishableKey.startsWith('sb_publishable_') && !isLegacyAnonKey()) {
  throw new Error('SUPABASE_PUBLISHABLE_KEY must be a browser-safe publishable key or anon key.');
}

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

for (const file of requiredFiles) {
  await readFile(path.join(projectRoot, file));
  await cp(path.join(projectRoot, file), path.join(outputDirectory, file));
}

await cp(
  path.join(projectRoot, 'assets'),
  path.join(outputDirectory, 'assets'),
  { recursive: true }
);

const supabaseConfig = [
  `export const SUPABASE_URL = ${JSON.stringify(supabaseUrl)};`,
  `export const SUPABASE_PUBLISHABLE_KEY = ${JSON.stringify(publishableKey)};`,
  ''
].join('\n');

await writeFile(path.join(outputDirectory, 'supabase-config.js'), supabaseConfig);
console.log('Static production site built in dist/.');
