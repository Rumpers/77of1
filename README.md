# 7of1

> *7 days, always with you.*

Off-platform monetization for live-streaming creators — an always-on AI twin in the creator's own voice, on a hosted fan page reachable from any social bio link, managed through a personal AI agent that works on her terms.

## What is 7of1?

7of1 is an AI twin platform for 17 Live creators. Creators record their voice, upload content, and configure their AI persona once. Fans interact with the AI twin 24/7 via a hosted fan page — getting text replies, voice notes, short video clips, and shareable content — all without the creator being live.

## Architecture

7of1 is a **framework/scaffolding**. Underneath: swappable AI providers (GMI Inference models first, then best-in-class external providers where GMI doesn't yet have coverage). Above: a granular consent layer, a template/orchestration engine, and fan-facing surfaces.

The moat is the framework, the consent infrastructure, the per-creator data, and the 17 Live distribution — not any single model.

## Repository Structure

```
.planning/
  docs/
    PRD.md                              — Product Requirements Document (v8)
    ADR-002-data-layer-job-queue.md     — Data layer & job queue selection
    ADR-011-async-queue-consent-gate.md — Async queue, consent gate, tier enforcement
```

## Status

**Phase:** PRD complete (v8). Build not yet started.

## Links

- GitHub: https://github.com/Rumpers/77of1
