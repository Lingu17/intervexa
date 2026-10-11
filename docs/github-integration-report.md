# Real GitHub integration report

Run date: 2026-10-11. Private fixture repository: [Lingu17/intervexa-integration-check](https://github.com/Lingu17/intervexa-integration-check).

## Verified external workflow

Created the repository, committed and pushed a Python baseline and two branches, and pulled main with `--ff-only`. Created [PR #1](https://github.com/Lingu17/intervexa-integration-check/pull/1) and [PR #2](https://github.com/Lingu17/intervexa-integration-check/pull/2); both remain open. The app installation received only the additional test repository after explicit approval; existing selections were preserved.

The deployed workspace discovered and connected the repository, synchronized both PRs and analyzed their exact revisions. Analysis `c9ec5056-b6b1-4157-80d9-b7f37393d8c7` produced finding `edff6001-06ca-43e9-b128-98af6003308f`: a potential authentication interaction with risk 55/100 and source evidence identifying removal of the `token` return key. The result correctly remains **inconclusive** because no isolated hosted runner is configured.

## Local Git-state evidence

The production explorer loaded authorized branches and indexed `main` at the recorded baseline SHA, saving four files. Its architecture renders those real files rather than a conceptual scene.

Lexical search for `create_session` returned actual `auth.py` and `client.py` excerpts pinned to that SHA. A subsequent push on the dedicated `webhook-probe` branch invalidated the earlier analysis and automatically recollected current PR revisions. New analysis `30d95a11-0438-4718-93e8-106333d16935` finished with one finding and the correct inconclusive execution status. No manual requeue was needed.

| State | SHA | Result |
| --- | --- | --- |
| Baseline | `4da2516aa380fd735db4d9ffec2f38f67bf86414` | Pass |
| Key rename | `56819707fe7518c283a5d045f99b8871652a0bc2` | Pass independently |
| New consumer | `5e3e396e3e322a79e0cc584dc82690736af31239` | Pass independently |
| Local combined merge | `c348cd1a63a34e5f4c887d4ef87f6483d825d33f` | Repeatable `KeyError: 'token'` |

The initial fixture layout caused a textual merge conflict. Moving the consumer to its own module in a normal follow-up commit made the final combination merge cleanly and expose the intended behavioral regression. This fixture bug is intentional, not a product regression.

## Test results

- **100 named acceptance scenarios passed** across contract comparison, execution evidence, lexical grounding, access/origin rejection and parsing.
- **100 additional local runs matched expectations**: each recorded Git state ran 25 times. Baseline and individual branches passed 75 runs; combined revisions failed 25 times with the expected missing-token error.
- **173 backend tests and 11 browser tests passed**, including migration preservation, tenant isolation, OAuth, webhooks, queue recovery, indexing, workspace navigation, mobile sign-in and social recovery.

Machine-readable local evidence: ignored `artifacts/github-check-100.xml`, `artifacts/github-full-validation.xml` and `artifacts/repeatability-results.json`. README screenshots show the actual deployed interface.

## Errors and limits

No new unexpected product regression was found in these tests. Previously identified signature/scope/evidence bugs, mobile sign-in visibility and social cold-start recovery are fixed and covered by regression checks.

Repeated runs reuse a controlled example; they do not represent 100 different defect classes or general AI accuracy. Hosted isolated execution, production AI answer quality and email recovery/delivery remain unavailable or unverified. Local KeyError reproduction is separate from the hosted runner's stricter repeated-assertion protocol. Free hosting may sleep; these results do not guarantee continuous uptime.
