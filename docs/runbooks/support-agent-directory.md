# Find an agent for assignment

Open a support case at /operations and expand Supervisor assignment. Search with at least three characters of the agent contact, or their exact account UUID. Select the intended result, review the displayed contact and UUID, provide a reason and confirm replacement. Use More agents or First results to navigate searches.

Both platform support and support_assign permissions and recent MFA are required. Ordinary support agents cannot browse this directory. No result means no currently eligible matching platform agent; it is not a reason to create permissions automatically. Suspended accounts and organization-only support grants are excluded.

If assignment fails because access changed, search again and select an eligible agent. If the case version changed, refresh and review before retrying. Existing identical assignment retries remain supported. Directory results do not guarantee later eligibility.

GET /api/v1/operations/support-agents requires q and accepts after from nextCursor. A changed account/query requires restarting the search. Only id and contact are returned. Existing build, native test and Docker verification commands apply; no migration or new secrets are needed. See ADR 032 for disclosure and outstanding acceptance limits.

Successful directory pages are now audited without search text or contacts. [Audit review and failure behavior](support-directory-audit.md).
