// Bundles src/ into the single self-contained phase1-skirmish.html.
// The JS files are concatenated in filename order inside one IIFE, so they
// share a single scope exactly as if they were one script.
const fs = require("fs");
const path = require("path");

const root = __dirname;
const src = path.join(root, "src");
const read = (p) => fs.readFileSync(path.join(src, p), "utf8");

const js = fs.readdirSync(path.join(src, "js"))
  .filter((f) => f.endsWith(".js"))
  .sort()
  .map((f) => read(path.join("js", f)))
  .join("");

const html = read("shell.html")
  .replace("/*@STYLES*/", () => read("styles.css"))
  .replace("/*@SCRIPT*/", () => js);

fs.writeFileSync(path.join(root, "phase1-skirmish.html"), html);
console.log("Built phase1-skirmish.html (" + html.length + " chars)");
