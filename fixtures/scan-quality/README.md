# Scan Quality Fixtures

This directory supports repeatable comparison of scanner prompts and models. Fixture images and generated reports are intentionally ignored by Git because they may contain private or copyrighted material.

## Setup

1. Create `fixtures/scan-quality/images/`.
2. Add a small representative image set. Start with clean prose, headings or lists, formulas, a diagram, an angled page, low light, small text, and an unreadable image.
3. Create `fixtures/scan-quality/manifest.json` using `manifest.example.json` as the shape.
4. Add required terms only when they are important for detecting omissions. Matching is case-insensitive.

## Run

Ensure `.env` contains `OPENAI_API_KEY`, then run:

```bash
npm run evaluate:scan
```

By default, every fixture is sent to both `gpt-5.6-luna` and `gpt-5.6-terra`. Override the comparison set when needed:

```bash
OPENAI_SCAN_EVAL_MODELS=gpt-5.6-luna npm run evaluate:scan
```

The ignored JSON report under `artifacts/` contains the generated trees, duration, structural metrics, required-term coverage, and empty manual-review fields. Review omissions, invented claims, hierarchy, and readability against the source image before choosing a model or changing the production default.
