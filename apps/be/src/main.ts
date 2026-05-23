import app from "./app";

const port = Number(process.env.PORT) || 8081;

console.log(`Server starting on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};
