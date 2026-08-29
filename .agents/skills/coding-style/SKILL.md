---
name: coding-style
description: "TypeScript coding conventions for Busy Octopus. Use when writing, modifying, or reviewing TypeScript, tests, Zod schemas, queue logic, CLI code, or VS Code extension code. Keywords: TypeScript, type safety, Zod, naming, functions, async, errors, imports, exports, Vitest."
---

# Busy Octopus Coding Style

These rules cover design choices that TypeScript, Biome, and Vitest do not fully express. Let repository configuration own mechanical formatting and lint rules. Read `.agents/skills/code-docs/SKILL.md` when adding or reviewing code documentation.

Do not insert line breaks solely to enforce a source width. Keep each Markdown paragraph and list item on one source line, and use line breaks in code documentation only when they express semantic structure required by the code documentation conventions.

Before changing code, read the nearest implementation and tests for the same kind of behavior. Follow local precedent unless it conflicts with this skill or a documented invariant. Afterward, review the result against both the precedent and the checks; diagnostics do not replace design review.

When one style violation is found, scan every in-scope authored file for the same pattern before presenting the correction.

## Type safety and validation

- Never use `any`. Accept uncertain values as `unknown`, narrow them, and use Zod for untrusted runtime input.
- Avoid type assertions. `as const` is allowed. Any other assertion requires a precise explanation and explicit human approval when a sound refactor, narrowing check, `satisfies`, or runtime schema cannot express the invariant.
- Do not add suppression comments such as `@ts-ignore`, `@ts-expect-error`, or Biome ignores without explicit approval. Compile-failure tests may use `@ts-expect-error` when TypeScript checks the directive itself.
- Never change runtime behavior merely to silence static analysis.
- Prefer inference for local values. Type public APIs, parameters, generic constraints, and non-obvious return contracts explicitly.
- Derive related types with TypeScript utility types instead of duplicating shapes. Give generic parameters descriptive names.
- Prefer indexed access type references for interface-defined methods and properties instead of repeating their parameter and return types.
- Treat values as effectively read-only by default: do not mutate inputs or shared data, and prefer `const`, non-mutating operations, and explicit copies. Do not clutter internal types with `readonly`, `Readonly`, `ReadonlyArray`, or deep-readonly utilities. Use type-level readonly only when compiler enforcement materially defines a public ownership contract.
- Use `satisfies` when an expression otherwise lacks a target type and narrow inference must be preserved. Omit it when an assignment, return, or function call already enforces the same constraint contextually.

Treat hook input, JSON files, queue entries, extension configuration, and external process results as untrusted. Parse them with strict Zod schemas at the boundary. Do not repeatedly parse trusted values within internal code.

Use explicit `null` rather than optional properties or parameters for significant values that a caller must consciously omit. Reserve `?` for values whose omission is genuinely part of the upstream contract. Do not annotate type guards in `.filter()` callbacks: let TypeScript infer the narrowing so it stays coupled to the predicate.

Name a Zod schema in PascalCase after the domain concept, without a `Schema` or `Type` suffix, and derive its TypeScript type using the same name:

```typescript
export const NotificationRequest = z.strictObject({
  schemaVersion: z.literal(1),
  notificationId: z.string(),
});
export type NotificationRequest = z.infer<typeof NotificationRequest>;
```

Use Zod enums when values form both a runtime enumeration and a TypeScript union. Use `satisfies` for typed object literals passed directly to `JSON.stringify` when a meaningful target contract exists.

Use `z.custom<T>()` only as a last resort for values that Zod cannot fully describe, such as complex function types. Validate as much of the runtime shape as possible and add a precise comment explaining why full validation is not possible.

## Functions and control flow

- Prefer arrow functions for standalone functions and callbacks. Use function declarations where required, such as generators or simple assertion functions, and normal VS Code lifecycle exports where clearer.
- Define class methods as arrow-function fields so they retain their instance binding when passed as callbacks. Constructors and accessors keep their language-defined syntax.
- Do not use `else`. Use an early return or otherwise flatten the control flow.
- Use `switch` for exhaustive matching over discriminated unions, enums, and other closed value sets. Use `if` for independent predicates.
- Use an object parameter for three or more related values.
- Avoid overload signatures. Split operations or use a discriminated union.
- Prefer `async`/`await` to promise chains.
- Use `Promise.withResolvers()` when settlement occurs outside construction.
- Pass `AbortSignal` through cancellable asynchronous operations and check it at meaningful boundaries.
- A `.catch()` callback must type its error parameter as `unknown`.
- In Node.js TypeScript, express guard conditions and invariants with the matching named import from `node:assert/strict`: use `ok` for predicates, `strictEqual` for scalar equality, and `deepStrictEqual` for structural equality instead of `if` and `throw` or manual comparison and serialization. Keep deliberately recoverable failures as operation-specific errors.
- Do not hide a missing required value behind a fallback. Report or throw an operation-specific error. Product defaults remain valid when absence is an expected input state.

## Naming and structure

- Do not use plural identifiers. Describe the collection shape with a singular domain name and a suffix: `requestList`, `requestMap`, `workspaceSet`, not `requests`, `requestLookup`, or `workspaces`. This avoids irregular and inconsistent English pluralization. Preserve field names imposed by external APIs and serialized contracts.
- Do not use past participles in authored identifiers, including function, schema, type, callback, local-value, and constant names. Prefer a direct operation or domain concept: `boundText`, not `boundedText`; `load`, not `loaded`; `result`, not `processed`; and `REFERENCE_TIMESTAMP`, not `FIXED_TIMESTAMP`. Preserve names imposed by external contracts and boolean adjectives such as `enabled`. A wire format controlled by this project follows these naming rules and is not an external-contract exemption. Inline a single-use intermediate when no clear operation or domain name remains.
- Name values for what they represent, not their provenance or implementation: prefer `request` to `requestFromQueue` and `config` to `configData`.
- Group parallel variants under their shared concept instead of repeating that concept in flat names: prefer `fileList: { actual, allow }` to `actualFileList` and `allowFileList`.
- Never use compound identifiers shaped like `xOrY`, `xAndY`, `xWithY`, `xFromY`, or `xByY`. Split alternatives and unrelated concerns, introduce a single domain concept, or use a collection-shape suffix. For example, use `target` instead of `idOrSlug`, `author` instead of `userWithPosts`, `user` instead of `userFromDatabase`, and `userMap` instead of `userListByEmail`.
- Avoid generic suffixes that merely restate a type or implementation detail: prefer `user`, `config`, and `listener` to `userData`, `configObject`, and `listenerFunction`. Keep a suffix when it expresses a real domain distinction, such as `userMetadata`.
- Prefer boolean adjectives such as `enabled`, `trusted`, and `valid` over an `is` prefix, except when implementing or consuming an external API.
- Give boolean configuration flags a `false` default and start their names with `enable` or `disable` according to the behavior selected by `true`.
- Name callbacks with a direct verb or `on` prefix, not `handle`.
- Prefix intentionally unused parameters with `_`.
- Use `UPPER_CASE` only for true constants. Use camel case for values that are merely module-scoped or exported configuration objects.
- Avoid single-use intermediate variables unless they clarify a long or nested expression, preserve evaluation semantics, or improve an error.
- Inline a private type used in only one straightforward signature. Name it only when the domain concept, complexity, or reuse makes the indirection valuable.
- Destructure named imports instead of importing a namespace or default object to access its members. Destructure parameters and returned values to the deepest useful level; do not bind an aggregate solely to access its children. Retain the aggregate when its identity or lifecycle is meaningful.
- Prefer named exports. Use default exports only when a tool requires them.
- Prefer named Node.js imports over namespace property access.
- Use ECMAScript `#` private fields and methods for class internals; do not use TypeScript's `private` modifier. Omit `#` only for class fields and methods that are intentionally public.
- Keep internals private. Do not expose queue state, filesystem operations, timers, diagnostics, or lifecycle hooks to make callers or tests convenient; improve the owning abstraction's public API instead.
- Put shared code in a domain-named module. Do not create catch-all `helpers.ts` or `utils.ts` files.
- Prefer directories to hyphenated filenames for namespacing related concepts: use `scripts/build/cli.ts`, not `scripts/build-cli.ts`. Keep a hyphen only when it belongs to one indivisible filename concept rather than representing hierarchy.

## Product-specific safety

- Keep integration and delivery paths fail-open without swallowing diagnostics needed for local troubleshooting.
- Never interpolate queue values into shell commands. Spawn without a shell and pass arguments separately.
- Bound external input before expensive processing, logging, or display.
- Preserve atomic queue transitions and make ownership changes explicit.
- Keep delivery adapters independent so one failure does not block another.
- Do not log prompts, agent output, raw hook payloads, credentials, or notification details.
- Dispose timers, listeners, file handles, cancellation sources, and VS Code disposables through an explicit lifecycle owner.

## Tests

- Test behavior and public boundaries, including failure and cleanup paths.
- Do not remove or weaken a failing assertion to make a test pass. Find the cause and fix the implementation or an independently invalid test.
- Use redacted synthetic fixtures. Never copy real prompts, paths, credentials, or hook payloads into the repository.
- Keep time, randomness, filesystem roots, process execution, and platform detection controllable in tests.
- Restore mocked globals and isolate temporary state after each test.

## Final review

Before presenting code, verify:

1. No `any`, unjustified assertion, or unapproved suppression was introduced.
2. Inspect every introduced or changed identifier. Names use singular domain concepts plus collection-shape suffixes, contain no past participles, and contain no `Or`/`And`/`With`/`From`/`By` compounds.
3. Single-use intermediates are justified, parameters and returned values are destructured to the deepest useful level, and control flow contains no `else`.
4. Every untrusted boundary is validated once with a strict, bounded contract; significant omissions use explicit `null` where the caller owns the choice.
5. Errors, cancellations, resources, and fail-open behavior are explicit.
6. Private implementation details remain private.
7. Tests cover changed behavior without sensitive fixtures or leaked state.
8. Applicable checks ran, or omitted checks are reported.
