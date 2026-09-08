# Distribution

Where Financert can plausibly go, what each channel actually wants, and what is
still missing. Researched September 2026 — **re-check the linked policies
before acting**, they move.

The headline: these four channels want **three different artifacts**, and only
one of them is close to ready.

| Channel | Wants | Status |
|---|---|---|
| **Claude desktop extension** | An `.mcpb` bundle | **Submittable now.** `make mcpb` builds it. No hosting, no organisation. |
| Claude connectors directory | Remote MCP server | Built and configured. Needs hosting *and* a Team/Enterprise org. |
| ChatGPT apps directory | Remote MCP server | Same server, needs hosting. |
| Apple App Store | Native/mobile app | **Blocked on a policy question** (below) |
| Google Play | Native/mobile app | Needs a mobile app that doesn't exist |

The listing copy and reviewer test cases are in [SUBMISSION.md](SUBMISSION.md);
[DEPLOY.md](DEPLOY.md) is how to stand up the endpoint the hosted channels
point at.

**The desktop extension is the unblocked route, and it is easy to miss.** The
connectors *portal* lives in organisation settings, so it needs a Team or
Enterprise plan — but that requirement is a property of the portal, not of the
directory. Desktop extensions go through a
[separate submission form](https://clau.de/desktop-extention-submission)
instead, carrying a local stdio server rather than a hosted one. Same six
tools, same data, no infrastructure. Take this route first.

---

## The MCP server covers both AI channels

`backend/mcp_server.py` exposes six read-only tools. One server, both
directories.

It is deliberately the **read-only subset** of the REST API — no portfolio
storage. That is not laziness; it removes most of what makes review hard:

- No auth, because the data is public Federal Reserve output.
- No stored state, so the data-handling answer is "nothing is retained".
- Every tool is genuinely `readOnlyHint=true`, and can be annotated honestly.

### Claude desktop extension (the unblocked one)

`make mcpb` produces `backend/dist/financert.mcpb`, submitted through the
[desktop extension form](https://clau.de/desktop-extention-submission). No
portal, so no organisation; no endpoint, so no hosting bill.

The bundle declares `server.type = "uv"` rather than `"python"`, and that is
forced rather than preferred: a traditional Python bundle has to vendor its
dependencies, and the MCP SDK needs pydantic, which is compiled and
[cannot be vendored portably](https://github.com/modelcontextprotocol/mcpb).
UV resolves them per-platform on the user's machine, which also means the
bundle is ~90 KB rather than several megabytes.

Its manifest is generated — the listing fields come from `SUBMISSION.md` and
the tool list is read out of the running server — so the bundle cannot come to
describe a different product from the portal listing, or advertise a tool that
no longer exists.

The one requirement it shares with everything else is a **published privacy
policy URL**. Local connectors must carry one in `privacy_policies`, and a
missing one is an immediate rejection.

### Claude connectors directory

Submission happens in a portal inside claude.ai and
[requires a Team or Enterprise organisation](https://claude.com/docs/connectors/building/submission)
— *"Organization settings aren't available on individual plans."* This applies
to the portal only; the desktop-extension form above does not use it.

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

None of it is code — every remaining item needs an account, a decision or a
lawyer.

1. **A deployment.** The container image, the Fly config and the verification
   probes are in [DEPLOY.md](DEPLOY.md); running them needs a hosting account.
2. **A published privacy policy URL.** The Pages workflow publishes it on the
   next push to `main`. It still needs a legal read.
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
2. **Submit the desktop extension.** `make mcpb`, then the form. This is the
   only channel that needs nothing but step 1 — do it before spending money.
3. **Host the MCP server** over HTTPS with the real origin passed to
   `--allowed-origin`, and submit to the ChatGPT directory.
4. **The connectors portal** only if a Team or Enterprise org already exists or
   is worth buying. The desktop extension already covers Claude users.
5. **Get the Apple categorisation question answered** before any mobile work.
6. **Only then** consider a mobile build — and it needs real accounts first,
   because a shared bearer token is not a consumer auth model.
