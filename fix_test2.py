import re

with open("tests/layout.test.ts", "r") as f:
    code = f.read()

# tests/layout.test.ts(165,58): error TS2532: Object is possibly 'undefined'.
# -> expect(res.positions["s2"]!.x) -> maybe missing ! somewhere else in line 165
# tests/layout.test.ts(197,28): error TS2532: Object is possibly 'undefined'.
# tests/layout.test.ts(239,14): error TS2532: Object is possibly 'undefined'.
# tests/layout.test.ts(240,14): error TS2532: Object is possibly 'undefined'.
# tests/layout.test.ts(250,14): error TS2532: Object is possibly 'undefined'.
# tests/layout.test.ts(259,14): error TS2532: Object is possibly 'undefined'.

# Just replace `res.positions["something"]` with `res.positions["something"]!`
# And replace `res.warnings[0]` with `res.warnings[0]!`
# Actually, the error on 165 is `expect(res.positions["s1"]!.x).toBeLessThanOrEqual(res.positions["s2"]!.x);`
# wait, if res.positions["s2"] is undefined, then ! won't help? `res.positions["s2"]!.x` is valid.
# What is line 165?
# tests/layout.test.ts(165,58) -> the argument of toBeLessThanOrEqual.
# `expect(res.positions["s1"]!.x).toBeLessThanOrEqual(res.positions["s2"]!.x);` -> TS doesn't like it.
# Let's fix them with regex or simple replacements.

lines = code.split("\n")
for i, line in enumerate(lines):
    if "expect(res.positions" in line:
        line = re.sub(r'res\.positions\["([^"]+)"\]\.x', r'res.positions["\1"]!.x', line)
        line = re.sub(r'res\.positions\["([^"]+)"\]\.y', r'res.positions["\1"]!.y', line)
        lines[i] = line
    if "res.warnings[0]" in line:
        lines[i] = line.replace("res.warnings[0].", "res.warnings[0]!.")
    
with open("tests/layout.test.ts", "w") as f:
    f.write("\n".join(lines))
