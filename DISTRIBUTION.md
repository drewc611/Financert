# Distribution

Where Financert can plausibly go, what each channel actually wants, and what is
still missing. Researched September 2026 — **re-check the linked policies
before acting**, they move.

The headline: these four channels want **three different artifacts**, and only
one of them is close to ready.

| Channel | Wants | Status |
|---|---|---|
| Claude connectors directory | Remote MCP server | Server built; needs hosting + privacy URL |
| ChatGPT apps directory | Remote MCP server | Same server; needs hosting + privacy URL |
| Apple App Store | Native/mobile app | **Blocked on a policy question** (below) |
| Google Play | Native/mobile app | Needs a mobile app that doesn't exist |

---

## The MCP server covers both AI channels

`backend/mcp_server.py` exposes six read-only tools. One server, both
directories.

It is deliberately the **read-only subset** of the REST API — no portfolio
storage. That is not laziness; it removes most of what makes review hard:

- No auth, because the data is public Federal Reserve output.
- No stored state, so the data-handling answer is "nothing is retained".
- Every tool is genuinely `readOnlyHint=true`, and can be annotated honestly.

### Claude connectors directory

Submission happens in a portal inside claude.ai and
[requires a Team or Enterprise organisation](https://claude.com/docs/connectors/building/submission).

Two things decide most outcomes, and both are handled or nearly so:

- **Tool annotations.** Every tool is annotated `readOnlyHint: true`,
  `destructiveHint: false`, verified on the wire in camelCase, with a test
  guarding it (`tests/test_mcp_server.py`).
- **A public privacy policy.** A missing one is
  [an immediate rejection](https://support.anthropic.com/en/articles/11697096-anthropic-mcp-directory-policy).
  `PRIVACY.md` is drafted but **is not yet published at a URL**.

Also required: HTTPS, Origin-header validation (implemented — the HTTP
transport runs with DNS-rebinding protection on and refuses a forged `Origin`
with 403), public docs with example prompts, and a reviewer demo account.
Nothing here needs a demo account, since there is no login.

Listing limits: name ≤ 100 chars, tagline ≤ 55, description ≤ 2,000, one to
five categories.

### ChatGPT apps directory

Submitted through the OpenAI developer platform with
[MCP connectivity details, test cases, and directory metadata](https://developers.openai.com/apps-sdk/app-submission-guidelines).
Test cases must pass on both ChatGPT web and mobile. Same server, same privacy
policy, same hosting prerequisite.

### What is still missing for both

1. **Hosting.** The server runs locally. A directory listing needs a public
   HTTPS endpoint with a stable URL.
2. **A published privacy policy URL.** The document exists; it needs a home and
   a legal read.
3. **A monitored contact address.**
4. **A Team/Enterprise org**, for the Anthropic submission specifically.

---

## The app stores are a different problem

### The question to answer first

Apple requires that apps for **"financial trading, investment, or financial
management" be submitted by the financial institution providing those
services**, with the necessary licences in each region
([App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)).

Financert is not a financial institution, so on the strict reading that door is
closed.

There is a real counter-argument. Financert holds no money, executes no trades,
links no accounts, and gives no advice. It compares user-entered numbers
against published Federal Reserve statistics — closer to a reference or
education app than a financial-management one. The product is already written
that way throughout, which helps the case.

**Resolve this before building anything mobile.** It is the difference between
months of work and a rejection on principle, and it is not a question that
should be answered by guessing. Ask Apple directly, or ask someone qualified.

### If that clears, the rest still applies

- **A web wrapper will be rejected.** Guideline 4.2 minimum functionality
  exists precisely for repackaged websites. A mobile build needs to earn its
  place — offline use, native input, something.
- **The empty first-run state is a known rejection trigger.** Apple explicitly
  advises seeding sample data so the app doesn't look unfinished on launch.
  Financert currently shows an empty portfolio on first open. (Backlog F55.)
- **Both stores require** a privacy policy URL, a support URL, and a privacy
  nutrition label / data-safety form.
- **Account deletion in-app is required if accounts exist.** They don't yet —
  which is another reason not to add them casually.

---

## Recommended order

1. **Publish the privacy policy** at a real URL. Cheap, and blocks everything.
2. **Host the MCP server** over HTTPS with the real origin passed to
   `--allowed-origin`.
3. **Submit to both AI directories.** Same artifact, two forms.
4. **Get the Apple categorisation question answered** before any mobile work.
5. **Only then** consider a mobile build — and it needs real accounts first,
   because a shared bearer token is not a consumer auth model.
