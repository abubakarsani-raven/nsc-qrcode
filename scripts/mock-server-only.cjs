/** Allow CLI scripts to import server-only modules outside Next.js. */
const Module = require("module");
const original = Module.prototype.require;
Module.prototype.require = function (id) {
  if (id === "server-only") return {};
  return original.apply(this, arguments);
};
