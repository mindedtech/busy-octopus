---
name: code-docs
description: "Code documentation conventions for Busy Octopus. Use when writing or reviewing TypeScript JSDoc, file documentation, parameters, returns, throws, callbacks, or Zod descriptions. Keywords: JSDoc, @file, @param, @returns, @throws, comments, documentation, Zod, describe."
---

# Busy Octopus Code Documentation

Document intent and domain meaning that types and implementation do not already make clear. Do not use comments to narrate straightforward code.

## Writing

- Describe callable behavior with the verb that names the actual operation: `Read the pending request`, not `Reads` or `Returns`.
- Describe types, properties, parameters, and values with direct domain language rather than forcing an action verb.
- Avoid mechanically prefixing descriptions with filler such as `Use`, `Provide`, `Define`, `Represent`, `Describe`, or `Carry`. Use such a verb only when it names the actual behavior.
- End every description with a period.
- Describe one unified purpose. Do not enumerate properties, exports, or capabilities already expressed by the type.
- Avoid filler and implementation plumbing. Describe what a value means or an operation accomplishes.

## JSDoc

- Always use multi-line blocks, even for a one-line description.
- Give every authored TypeScript file an `@file` block as its first content. Put an executable script's block immediately after its shebang. Never use `@fileoverview` or `@module`.
- Document exported functions, classes, types, and methods when their intent or contract is not already obvious. Never add tautological JSDoc solely because a declaration is exported; a behaviorless framework stub needs none.
- Use `@param name - Description.` only when it adds meaning beyond the name and type. Use dot notation for object parameter properties when needed.
- Use `@returns` or `@yields` only when the result needs clarification beyond the name and type. Omit return documentation for `void` and trivial results.
- Add `@throws {Type}` for every direct `throw` statement in the documented body, and only for direct throws. State the condition that causes the throw.
- Document non-trivial callbacks and lifecycle-owned references when their synchronization or cleanup behavior is not evident from the type.
- Put implementation explanations in `//` comments near the relevant code, not in API JSDoc.

```typescript
/**
 * Claim the next pending notification request.
 *
 * @param queue - Queue whose ownership transition must remain atomic.
 * @returns Claimed request, or null when the queue has no pending request.
 * @throws {Error} If the queue cannot publish the claim atomically.
 */
```

## Zod descriptions

- Document schemas with `.describe()`, not JSDoc, when the description should travel with runtime validation metadata.
- Describe the domain value, never the schema implementation. Do not begin with `Schema for` or repeat the schema name mechanically.
- Describe each property that needs context and the complete object. Let an imported schema carry the description from its definition; do not repeat it at reference sites.
- Prefer `.describe()` to `.meta({ description })`. Chain `.meta({ id })` only when a consumer needs a schema identifier.

## Review

Before presenting documentation, verify:

1. Callable descriptions name their actual operation; type and value descriptions use direct domain language. No description has a mechanical filler prefix. All descriptions end with periods and do not enumerate structure already represented by types.
2. JSDoc blocks are multi-line and every authored TypeScript file begins with an `@file` block, immediately after the shebang when present.
3. Parameter and result tags add information rather than restating names and types.
4. Every direct throw in a documented body has a precise `@throws`, with no documentation for exceptions thrown only by callees.
5. Zod descriptions express domain meaning and are defined once.
