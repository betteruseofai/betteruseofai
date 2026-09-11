---
title: Why the frontier model is usually the wrong default
description: Most of what people ask a model to do does not need the largest one, and the gap in cost is much larger than the gap in answer quality.
date: 2026-09-11
tags: [choosing, method]
status: draft
---

Take a typical exchange, four hundred tokens in and three hundred out. Run it through the engine
against the world average grid and the frontier model lands near 5 Wh, with a range from about
0.6 to 60. The small model in the same family lands near 0.6 Wh. That is roughly eight times, and
the spread inside each estimate is wider than the gap between them, which is worth saying plainly.

The reason the smaller model is not the default is that nobody chooses per question. You pick a
model once, at the top of the session or in a settings pane. Then you ask it everything: reformat
this list, what is 18 per cent of 340, translate this line, write this function. Three of those
four do not need a frontier model, and one does not need a model at all.

## What the recommender actually does

It looks at the text you are about to send for a small number of signals. Arithmetic it can do
itself. A unit conversion it can do itself. A short simple request with no reasoning cues. A long
document with no question attached. Each rule votes with a confidence, and nothing is shown below
0.6.

It is deliberately quiet. A nudge that fires on the wrong thing gets the whole feature switched
off, and then nothing is measured at all. Inside a coding session the bar is higher still and three
rules are muted outright, because they kept firing on things people legitimately type mid-session.

## What it will not do

It will not tell you the small model gives the same answer. Often it does not. It tells you what
the difference costs, and leaves the judgment where it belongs.
