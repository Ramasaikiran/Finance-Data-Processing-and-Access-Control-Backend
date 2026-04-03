// server.js
// Starts the HTTP server. Nothing else lives here — logic is in src/.

require("dotenv").config();
const app  = require("./src/app");

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`\n🚀  Finance Backend running on http://localhost:${PORT}`);
  console.log(`    ENV  : ${process.env.NODE_ENV || "development"}`);
  console.log(`    DB   : ${process.env.DB_PATH  || "./finance.db"}\n`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received – shutting down gracefully");
  server.close(() => process.exit(0));
});
