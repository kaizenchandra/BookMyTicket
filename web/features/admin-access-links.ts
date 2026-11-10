/** Keep all filters and sort direction when moving between directory pages. */
export function adminPageLink(path: string, search: string, cursor?: string) {
  const params = new URLSearchParams(search);
  params.delete("after");
  if (cursor) params.set("after", cursor);
  return `${path}${params.size ? "?" + params.toString() : ""}`;
}
export function permissionSources(
  permission: string,
  direct: string[],
  roles: { name: string; active: boolean; permissions: string[] }[],
) {
  return [
    ...(direct.includes(permission) ? ["Direct grant"] : []),
    ...roles
      .filter((r) => r.active && r.permissions.includes(permission))
      .map((r) => `Role: ${r.name}`),
  ];
}
