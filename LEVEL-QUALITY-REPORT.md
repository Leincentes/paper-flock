# Paper Flock v0.9 — Level Quality Audit

**Scope:** Campaign Levels 1–20

## Summary

- Levels analyzed: **20**
- Solvable within the analysis budget: **20/20**
- Tutorial: **5**
- Gentle: **3**
- Steady: **5**
- Tricky: **7**

Automated quality analysis identifies structure and risk; it does not prove that a level is fun or fair to humans.

## Level table

| Level | Concept | Band | Openings | Safe | Immediate traps | Avg choices | Peak choices | Solver nodes | Flags |
|---:|---|---|---:|---:|---:|---:|---:|---:|---|
| 1 | Single clear path | tutorial | 1 | 1 | 0 | 1 | 1 | 3 | — |
| 2 | Observe two clockwise folds | tutorial | 1 | 1 | 0 | 1 | 1 | 4 | — |
| 3 | Follow a forced chain | tutorial | 1 | 1 | 0 | 1 | 1 | 5 | — |
| 4 | Recover from a deliberate dead end | tutorial | 2 | 1 | 1 | 1.75 | 2 | 4 | — |
| 5 | Independent understanding check | tutorial | 2 | 2 | 0 | 2.2 | 3 | 5 | — |
| 6 | Wide openings with low punishment | gentle | 3 | 3 | 0 | 2.86 | 4 | 12 | — |
| 7 | Compare multiple safe exits | gentle | 3 | 3 | 0 | 2.38 | 4 | 10 | — |
| 8 | Plan around a compact cluster | gentle | 3 | 3 | 0 | 1.56 | 3 | 9 | — |
| 9 | Use a rotation to open the edge | steady | 4 | 4 | 0 | 3.2 | 4 | 10 | — |
| 10 | Avoid an early misleading route | steady | 3 | 2 | 1 | 3.09 | 4 | 11 | contains-opening-trap |
| 11 | Balance two active regions | steady | 4 | 4 | 0 | 2.5 | 4 | 140 | — |
| 12 | Preserve a future escape lane | steady | 4 | 4 | 0 | 3.31 | 4 | 34 | — |
| 13 | Read a larger five-by-five flock | tricky | 5 | 4 | 1 | 4.54 | 7 | 447 | contains-opening-trap |
| 14 | Sequence several edge releases | steady | 5 | 5 | 0 | 3 | 5 | 33 | — |
| 15 | Choose between competing chains | tricky | 6 | 6 | 0 | 4.33 | 6 | 610 | — |
| 16 | Recover from a mid-puzzle trap | tricky | 5 | 5 | 0 | 4.38 | 7 | 16 | — |
| 17 | Plan a longer rotation cascade | tricky | 5 | 4 | 1 | 4.82 | 7 | 1175 | contains-opening-trap, high-search-complexity |
| 18 | Protect a narrow late-game lane | tricky | 6 | 6 | 0 | 4 | 6 | 1493 | high-search-complexity |
| 19 | Expert branching and trap control | tricky | 6 | 6 | 0 | 4.42 | 7 | 1410 | high-search-complexity |
| 20 | Full-system mastery finale | tricky | 6 | 6 | 0 | 3.1 | 6 | 24 | — |

## Watch list

- **Level 10:** Contains one intentional-looking unsafe opening. Verify that players understand the consequence rather than interpreting it as randomness.
- **Level 13:** First larger-board level with one unsafe opening and a peak of seven legal choices. Watch for analysis overload.
- **Level 17:** Contains an unsafe opening and the highest combined branching/search concern in the current middle-late sequence.
- **Levels 18–19:** High solver-search complexity. Human testing should verify that difficulty feels strategic rather than opaque.

## Current conclusion

No level has zero openings, zero safe openings, or a solver-budget failure. The existing set is technically suitable for the v0.9 feel test. The watch-list levels should not be replaced until observed human behavior confirms a fairness or repetition problem.
