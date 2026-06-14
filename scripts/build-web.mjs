/* Copie les assets statiques de l'app web vers www/ (le webDir de Capacitor).
   La source reste à la racine (servie telle quelle par Netlify) ; www/ n'est
   qu'un dossier d'emballage pour l'APK. */
import { cpSync, rmSync, mkdirSync, existsSync } from 'node:fs';

const OUT = 'www';
const ASSETS = ['index.html', 'manifest.json', 'css', 'js', 'img', 'samples'];

if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

for (const a of ASSETS) {
  if (existsSync(a)) cpSync(a, `${OUT}/${a}`, { recursive: true });
}
console.log('✓ Assets web copiés → www/');
