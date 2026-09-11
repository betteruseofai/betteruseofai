---
title: How we estimate water per prompt
description: Three different quantities share one word, which is most of why published water figures look like they disagree by a hundred times.
date: 2026-09-11
tags: [water, method]
status: draft
---

Google says a median text prompt costs 0.26 mL of water. A life cycle study of Mistral Large 2
works out at about 45 mL for a page of text. That is a factor of one hundred and seventy, between
two organisations who both know what they are doing and neither of whom is lying.

They are counting different things.

## On site

Water evaporated in the cooling towers of the building the model ran in. Divide the energy the
request used by the building's water usage effectiveness and you have it. Google's figure is this
one, and their published WUE of 1.15 litres per kilowatt hour reproduces their own 0.26 mL from
their own 0.24 Wh, which is a useful check that we have understood the arithmetic.

This number is small, well measured by the people who own the buildings, and improving quickly.

## At the power station

Thermal power stations evaporate water to condense steam. A gas plant uses roughly a litre per
kilowatt hour; a coal plant uses more; wind and solar use almost none. So the same request costs
very different amounts of water in Sweden and in India, and the difference has nothing to do with
the data centre.

This one is usually the larger of the two, which is why we default to showing both together.

## Over the life of the hardware

Making a chip uses a great deal of ultrapure water. Spread that over the millions of requests the
chip serves and it is small per request, but the spreading involves assumptions about lifetime and
utilisation that nobody can check.

Mistral's figure is this one. It measures a different boundary. Comparing it with Google's is
comparing a household's water bill with the water embedded in the walls of the house.

## What we do

Default to on site plus the power station, because that is the water that flows because you sent
the prompt. The calculator lets you switch to either of the other two, and when you do the label on
the figure changes with it, so a screenshot can never be quoted under the wrong boundary.
