# Scientific calculator engine

Source: https://github.com/simoncragg/scientific-calculator
Pinned commit: `0ae021d5fb846e3ea9bcce253a3108df04339d0e`
License: MIT; copyright Simon Cragg 2024. See LICENSE.

Vendored modules: calculation slice, reducers, types, constants, expression/fraction classes and utilities. The app uses a custom accessible school-themed keypad and no upstream MathJax/CDN/UI dependencies. Unsupported upstream TODO controls are not exposed. Math.js 15 uses bigint fraction fields; Fraction.fromDecimal explicitly converts those fields to retain the upstream number-based API. The school adapter validates finite real results and catches operation failures.

This is CASIO-inspired open-source software, not an official CASIO product or certified emulator.

The S⇄D reducer is adapted to toggle decimal/fraction output in both directions. Only implemented controls are exposed; input comes from bounded keypad actions, not a free-form program evaluator.
