import { execSync } from 'child_process';

try {
  const r = execSync('npx eslint src/pages/student/ --format json', { encoding: 'utf8' });
  console.log('ALL CLEAN');
} catch (e) {
  const data = JSON.parse(e.stdout);
  for (const file of data) {
    if (file.messages.length === 0) continue;
    const name = file.filePath.replace(/\\/g, '/').split('/').pop();
    console.log(`FILE: ${name}`);
    for (const m of file.messages) {
      console.log(`  LINE ${m.line} COL ${m.column} RULE ${m.ruleId}`);
      console.log(`    ${m.message}`);
    }
  }
}
