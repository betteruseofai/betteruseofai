# Recorded web fixtures

> Status: draft.

Request and response bodies for the four site adapters, written by hand from the documented shapes.
No real conversation, no real account, no real session identifier. **CI never contacts claude.ai,
chatgpt.com, gemini.google.com or anybody else**, and a test that did would be flaky and rude in
equal measure.

## What each one is for

### `claude/`

`sse-with-model.txt` has the model in the stream and a disclosed thinking count. `sse-no-model.txt`
has neither: the model is absent, so the page picker is the only source, and the model thought
without saying how much, so the turn is a lower bound. Both cases happen on the real site.

### `chatgpt/`

`sse-routed.txt` is the important one. The request asked for `auto` and the answer came from
`gpt-4o`, which is only visible in `metadata.resolved_model_slug`. Pricing this turn against the
requested model would be a wrong number, so an adapter that reads the request slug and stops has a
bug. `sse-reasoning.txt` streams thoughts that are never counted.

### `gemini/`

The request body is a nested array with no field names, doubly encoded inside a form field, which
is why the adapter reads the model from the `x-goog-ext-525001261-jspb` header rather than digging
it out by shape. The response is length-prefixed JSON.

### `local/`

The happy case. Ollama reports `prompt_eval_count` and `eval_count`, and LM Studio reports a usage
block, so nothing is estimated and the interface stops showing a tilde.

## Refreshing one

Record a real exchange, then take out everything that is not needed to parse it: the whole prompt
and answer, any identifier, any header that authenticates anything. What is left should be the
shape and nothing else. Bump the adapter's `version` in the same change, so stored health states
are cleared and a fixed adapter starts clean.
