import { cp, mkdir } from 'node:fs/promises';

await mkdir('dist', { recursive: true });
await cp('src/ui/theme.css', 'dist/theme.css');
