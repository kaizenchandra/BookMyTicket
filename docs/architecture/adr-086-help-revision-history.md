# ADR 086: Audited Help revision history

FE:ADM-UI-08 and BE:CAT-10 are advanced by a protected history query and staff UI for existing immutable FAQ save receipts. This is inspection, not rollback or approval.

GET /api/v1/admin/help/:id/history requires authenticated current staff MFA and platform moderate permission. The Catalog adapter rechecks active permission inside a transaction, takes a shared article lock, reads a maximum twenty records plus one lookahead, and audits the read before returning. Missing articles return 404; empty history is a valid result. An audit failure withholds the response. Unpublished content is available only to authorized staff.

Rows are ordered by descending input version. Optional beforeVersion is a strictly validated positive integer string and selects older input versions. New edits do not duplicate or skip existing rows on older pages. The returned cursor is the last displayed input version. Only explicitly projected prior question, answer, topic and publication state are returned, along with input/output version, actor UUID, reason and time. Fingerprints and unrecognized snapshot fields are excluded.

Receipts hold content before an edit, not its resulting content. The UI labels this explicitly and keeps current editing separate from history. Initial article content appears as the prior snapshot of its first recorded edit; an unedited article has no receipt. History timestamps display in India time. No retention or legacy records are fabricated.

The editor includes an explicit Load article history control, per-row collapsed prior content, newest/older navigation, loading/error/retry and empty states. History loading does not change draft inputs. Component identity and effect cleanup isolate article/account transitions.

Tests cover 22 recorded edits over twenty-plus-two pages while a new edit arrives, exact prior content, actor/reason attribution, strict cursor validation, missing/empty records, MFA/permission rejection, revocation, audit failure and escaped rendering. Browser interaction, accessibility, load, approved retention and history comparison/restore remain open. No migration is needed.
