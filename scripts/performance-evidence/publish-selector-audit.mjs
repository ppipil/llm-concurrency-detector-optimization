import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) values[argv[index]?.replace(/^--/u, "")] = argv[index + 1];
  for (const required of ["input", "output", "replace", "with"]) {
    if (!values[required]) throw new Error(`Missing --${required}`);
  }
  return values;
}

function replaceStrings(value, needle, replacement) {
  if (typeof value === "string") return value.replaceAll(needle, replacement);
  if (Array.isArray(value)) return value.map((item) => replaceStrings(item, needle, replacement));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceStrings(item, needle, replacement)]));
  }
  return value;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const input = JSON.parse(await readFile(resolve(args.input), "utf8"));
  const sanitized = replaceStrings(input, args.replace, args.with);
  sanitized.publication = {
    normalized_copy: true,
    normalization: `exact string replacement with ${args.with}`,
  };
  await writeFile(resolve(args.output), `${JSON.stringify(sanitized, null, 2)}\n`, "utf8");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
