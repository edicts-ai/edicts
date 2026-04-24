# Why We Built Edicts

A lot of agent failures do not come from reasoning. They come from certainty.

An agent will happily draft a convincing answer, a polished status update, or a perfectly formatted post while being wrong about the one fact that actually matters. The launch date is off by a week. The product has a feature it does not have. The company policy is described backwards. The partner name that should stay private ends up in public copy because the model found a familiar pattern in its training data and filled in the blank with confidence.

One example was painfully small: an agent prepared public copy that referenced the wrong version number. The current version was known. The team had already agreed on it. It existed in Slack, docs, release notes, and someone’s head. But “known somewhere” is not the same as “available cheaply, reliably, every time the model speaks.”

That distinction is where Edicts came from.

## The problem was not memory in the broad sense

There are already good tools for memory.

If you want long-horizon conversational recall, there are products built around that. If you want graph-shaped knowledge with deeper semantic retrieval, there are products built around that too. If you want a full RAG pipeline over manuals, tickets, PDFs, and scattered internal docs, plenty of tooling already exists.

But we kept running into a narrower problem.

Agents often need a tiny set of high-value facts that should always win:

- the current release number
- the public launch date
- a hard compliance constraint
- a negative assertion like “this product does **not** support gas sponsorship”
- a temporary operational constraint like “writes are disabled during the migration window”

Those are not documents. They are not embeddings-worthy paragraphs. They are not knowledge graphs. They are not “memory” in the warm, human, conversational sense.

They are ground truth.

And ground truth should be cheap.

## The existing options were either too heavy or too sloppy

We kept seeing four unsatisfying patterns.

### 1. System prompt stuffing

The fastest solution is to keep appending more context to the system prompt until the prompt looks like a family garage after twenty years: technically still functional, impossible to search, and full of things nobody wants to carry every single time.

Important facts get buried. Token cost drifts upward. Temporary facts linger forever. Contradictory updates accumulate. The model receives a wall of prose instead of a disciplined set of assertions.

### 2. RAG for tiny facts

RAG is powerful when you genuinely need retrieval across large corpora. But if your real need is “always remind the model that feature X does not exist,” wiring a retrieval pipeline around that is like installing airport security to protect a sandwich.

It solves a bigger class of problems than the one you have, and you pay for that ambition in complexity.

### 3. Conversational memory systems

Conversational memory systems are designed for a different kind of job: recall from interactions, preferences, patterns, personal details, and accumulated conversational context. Useful job. Wrong tool for non-negotiable product facts.

We did not want a system inferring which launch timing statement mattered most. We wanted a place to write the launch timing statement down and make it authoritative.

### 4. Knowledge graphs for everything

Knowledge-graph-heavy approaches become interesting when your domain genuinely needs relationships, entities, traversals, and deeper structured reasoning. But a surprising amount of agent reality is flatter than that.

Most production-critical facts are just assertions with a few pieces of metadata:

- category
- confidence
- source
- expiration
- optional supersession key

That is it. A lot of the time, that is enough.

## The insight was embarrassingly simple

We did not need a grand theory of memory.

We needed a tiny layer for flat, verified assertions that could be:

- stored on disk
- rendered cheaply into prompts
- updated safely
- expired automatically
- small enough to keep around all the time

That became Edicts.

An edict is just a statement plus metadata. Not a transcript. Not a vector. Not a graph node. A statement.

For example:

- “Product v2.0 launches April 15, NOT before.”
- “Do not name unannounced design partners publicly.”
- “Enterprise plan does NOT include white-label support.”
- “User-profile writes are disabled during the migration window.”

Each one can carry a category, tags, confidence, provenance, and a TTL. That is enough structure to make the facts operational without turning them into a tiny enterprise software project.

## We optimized for token cost on purpose

A big part of the design came from refusing to treat every fact like a document retrieval problem.

If an edict averages around a dozen useful tokens of actual semantic payload, you can afford to inject several of them into every prompt. That matters. Reliability often comes from repetition. The model should not have to go hunting for the facts that would make a public answer safe.

The goal is not to build the most sophisticated memory substrate in the world. The goal is to make the right facts cheap enough to always be present.

That changes behavior. Teams stop hoarding facts in docs nobody injects. They stop relying on the agent to “remember from last time.” They stop pretending that a compliance rule mentioned three tools ago will still be salient when the agent writes the public-facing answer.

## Where Edicts sits in the memory hierarchy

We think of agent memory as a hierarchy, not a winner-take-all battle.

At the bottom, you have immediate working context: the current turn, the current task, the current prompt.

Above that, you have Edicts: compact, verified, operational truths that should travel with the agent because they are cheap and important.

Above that, you may have richer recall systems: transcripts, summaries, vector stores, graphs, document retrieval, long-term conversational memory.

Those systems are not enemies of Edicts. They solve different problems.

Edicts is the layer you use when the question is not “what might be relevant?” but “what must stay true?”


## Production taught us a few lessons quickly

The first lesson was that **negative assertions are gold**.

People naturally document what exists. Agents hallucinate most dangerously around what does not exist. If your product does not support a feature, say that explicitly. If a name should never be used publicly, say that explicitly. If an inferred capability is false, write the counter-fact down.

The second lesson was **TTL hygiene**.

Temporary truths become permanent lies if you never expire them. Migration windows end. freezes end. launch embargoes end. “For the next 48 hours” is not a category; it is a lifecycle. Edicts bakes that lifecycle into the model. Ephemeral and event-based facts are not a social contract. They actually expire.

The third lesson was **key-based supersession**.

Facts that change over time should not pile up like geological layers in a prompt. If the current release is now `v2.4.2`, that should supersede `v2.4.1`, not sit next to it and ask the model to infer chronology from vibes. Stable keys give you clean replacement and a history trail without prompt clutter.

The fourth lesson was that **simple storage wins**.

YAML and JSON are boring. That is the compliment. You can read them, diff them, commit them, inspect them in production, and repair them without an archaeology team. We did not want ground truth trapped in a black box.

## We also wanted framework agnosticism to be real, not marketing copy

A lot of “framework-agnostic” products are framework-agnostic in a very theoretical sense: technically possible, but not the default experience.

We wanted Edicts to be genuinely usable anywhere.

If your stack can:

1. load a file,
2. prepend text to a system prompt, and
3. optionally expose function calls,

then you can integrate Edicts.

That is why the core stays small and boring. OpenClaw has a first-party integration because it is useful, but the store itself does not depend on OpenClaw or any orchestration framework. 
## Getting started with OpenClaw

If you are running [OpenClaw](https://openclaw.ai), Edicts has a first-party plugin that handles everything: injection, tool registration, and file bootstrapping.

Install and restart:

```bash
openclaw plugins install openclaw-plugin-edicts
openclaw gateway restart
```

That is it. On first load, the plugin creates an `edicts.yaml` file in your workspace. Every agent session — main chat, cron jobs, sub-agents, every channel — gets the edicts prepended to its system prompt automatically. No per-session wiring.

Your agents also get tools (`edicts_add`, `edicts_list`, `edicts_update`, `edicts_remove`, `edicts_search`, `edicts_stats`, `edicts_review`) so they can manage edicts conversationally. Say "remember that v2.2.0 launches March 23" and the agent writes it to the store.

You can also edit `edicts.yaml` by hand. It is a plain YAML file:

```yaml
version: 1
edicts:
  - id: e_001
    text: "Product v2.2.0 launches March 23, 2026."
    category: product
    ttl: event
    key: product-launch-date
```

If you are not on OpenClaw, install the standalone library:

```bash
npm install edicts
edicts init        # creates starter edicts.yaml with a placeholder e_001 edict
edicts update e_001 --text "Feature X does NOT support gas sponsorship" --category product
edicts list
```

The core library has zero framework dependencies. Any agent system that can prepend text to a system prompt can use it.

## What Edicts is not

Edicts is not an attempt to replace RAG.

It is not a general-purpose knowledge graph.

It is not a substitute for long-term conversational memory.

It is not trying to solve every memory problem an agent could ever have.

We wanted a tool that knows exactly which problem it is solving: compact ground truth for agents.

## Why we think this matters

As agent systems become more common, a lot of reliability work will come down to memory discipline rather than model cleverness.

Most public-facing or operational mistakes are not the result of deep reasoning failure. They are the result of missing or stale facts. A model that can reason beautifully on top of bad premises is still a liability.

Edicts is our attempt to make that layer boring, explicit, and cheap.

Not glamorous. Just useful.

If you need a small set of verified truths to follow your agents around without dragging a wagon of context behind them, that is exactly what we built.

- Docs: https://edicts.ai
- GitHub: https://github.com/edicts-ai/edicts
- License: MIT
