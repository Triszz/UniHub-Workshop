import { execSync } from 'child_process';
import { writeFileSync } from 'fs';

// Lint student pages
try {
  execSync('npx eslint src/pages/student/ --format json', { encoding: 'utf8' });
  console.log('STUDENT LINT: ALL CLEAN');
} catch (e) {
  const data = JSON.parse(e.stdout);
  let hasErrors = false;
  for (const file of data) {
    if (file.messages.length === 0) continue;
    hasErrors = true;
    const name = file.filePath.replace(/\\/g, '/').split('/').pop();
    console.log(`FILE: ${name}`);
    for (const m of file.messages) {
      console.log(`  L${m.line} [${m.ruleId}] ${m.message.substring(0, 80)}`);
    }
  }
  if (!hasErrors) console.log('STUDENT LINT: ALL CLEAN');
}
