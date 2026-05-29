const command = process.argv.slice(2).join(" ").trim();
const port = process.env.PORT ?? "3000";
const baseUrl = `http://localhost:${port}`;

if (!command) {
  console.error('Usage: npm run task -- "your command here"');
  process.exit(1);
}

const response = await fetch(`${baseUrl}/tasks`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ command })
});

const body = await response.json();
if (!response.ok) {
  console.error("Task failed:", body);
  process.exit(1);
}

console.log(JSON.stringify(body, null, 2));
console.log(`\nTask id: ${body.id}`);
console.log(`Status: ${body.status}`);
console.log(`Check: ${baseUrl}/tasks/${body.id}`);
if (body.status === "waiting_for_human") {
  console.log(
    "\nCaptcha/manual step: solve it in the browser, then run:\n" +
      `  npm run resume -- ${body.id}`
  );
}
