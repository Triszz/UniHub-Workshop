import { ESLint } from "eslint";

(async function main() {
  const eslint = new ESLint();
  const results = await eslint.lintFiles(["src/pages/student/CheckoutPage.tsx", "src/pages/student/WorkshopDetailPage.tsx", "src/services/payment.service.ts", "src/services/registration.service.ts"]);
  let hasError = false;
  results.forEach((result) => {
    if (result.errorCount > 0 || result.warningCount > 0) {
      hasError = true;
      console.log(result.filePath);
      result.messages.forEach((msg) => {
        console.log(`  Line ${msg.line}: ${msg.message} (${msg.ruleId})`);
      });
    }
  });
  if (!hasError) {
    console.log("No lint errors found in the updated files.");
  }
})().catch((error) => {
  process.exitCode = 1;
  console.error(error);
});
