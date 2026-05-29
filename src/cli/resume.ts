const taskId = process.argv[2]?.trim();
const port = process.env.PORT ?? "3000";

if (!taskId) {
  console.error("Usage: npm run resume -- <task-id>");
  process.exit(1);
}

const response = await fetch(`http://localhost:${port}/tasks/${taskId}/resume`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ reason: "captcha_solved" })
});

const body = await response.json();
if (!response.ok) {
  console.error("Resume failed:", body);
  process.exit(1);
}

console.log(JSON.stringify(body, null, 2));
console.log(`\nResumed task ${taskId} — status: ${body.status}`);
