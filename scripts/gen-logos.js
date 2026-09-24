const si = require('simple-icons');
const fs = require('fs');

const WANT = ['google','facebook','instagram','x','apple','amazon','linkedin','github',
  'snapchat','tiktok','reddit','discord','whatsapp','telegram','paypal','netflix',
  'spotify','steam','dropbox','pinterest','twitch','ebay','gitlab','slack','zoom','adobe','roblox'];

const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const out = [];
const missing = [];
for (const slug of WANT) {
  const icon = si['si' + cap(slug)];
  if (!icon) { missing.push(slug); continue; }
  out.push({ slug, title: icon.title, hex: icon.hex, path: icon.path });
}
console.error('missing:', missing.length ? missing : 'none');
console.error('got:', out.length, 'avg path len:', Math.round(out.reduce((a,b)=>a+b.path.length,0)/out.length));

const body = out.map(i =>
  `  ${i.slug}: { title: '${i.title.replace(/'/g, "\\'")}', hex: '#${i.hex}', path: '${i.path}' }`
).join(',\n');

fs.writeFileSync('platform-logos.ts',
`// GENERATED FILE -- do not edit by hand.
// Brand marks from simple-icons v11.14.0 (icon shapes are CC0-1.0).
// Each logo and brand colour remains the trademark of its owner; they appear
// here only to identify the platform a password belongs to.
//
// Regenerate with: node scripts/gen-logos.js

export interface BrandMark {
  title: string;
  hex: string;
  path: string;
}

export const BRAND_MARKS: { [slug: string]: BrandMark } = {
${body}
};
`);
console.error('wrote platform-logos.ts', fs.statSync('platform-logos.ts').size, 'bytes');
