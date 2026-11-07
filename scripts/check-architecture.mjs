import { readdirSync, readFileSync } from "node:fs";
import { resolve, relative, dirname } from "node:path";
const root = resolve("src/modules");
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? files(`${dir}/${e.name}`)
      : e.name.endsWith(".ts")
        ? [`${dir}/${e.name}`]
        : [],
  );
}
const errors = [],
  graph = new Map();
for (const file of files(root)) {
  const source = readFileSync(file, "utf8"),
    [owner, layer] = relative(root, file).split("/");
  for (const match of source.matchAll(
    /(?:from\s+|import\s*)['"]([^'"]+)['"]/g,
  )) {
    const spec = match[1];
    if (layer === "domain" && !spec.startsWith("."))
      errors.push(`${file}: domain external dependency ${spec}`);
    if (!spec.startsWith(".")) continue;
    const target = resolve(dirname(file), spec),
      parts = relative(root, target).split("/");
    if (parts[0] === "..") {
      if (layer === "domain" && /database/.test(target))
        errors.push(`${file}: domain persistence dependency`);
      continue;
    }
    const [other, targetLayer] = parts;
    if (layer === "domain" && targetLayer !== "domain")
      errors.push(`${file}: domain imports ${targetLayer}`);
    if (layer === "application" && targetLayer === "adapters")
      errors.push(`${file}: application imports adapter`);
    if (other !== owner) {
      if (targetLayer !== "contracts")
        errors.push(`${file}: private module import ${spec}`);
      if (!graph.has(owner)) graph.set(owner, new Set());
      graph.get(owner).add(other);
    }
  }
}
function visit(node, path = []) {
  if (path.includes(node)) {
    errors.push(`Cycle: ${[...path, node].join(" -> ")}`);
    return;
  }
  for (const next of graph.get(node) ?? []) visit(next, [...path, node]);
}
for (const node of graph.keys()) visit(node);
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(
  `Architecture import checks passed for ${files(root).length} module files. SQL ownership and runtime composition require separate review.`,
);
