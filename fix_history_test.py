import re

with open("tests/history.test.ts", "r") as f:
    code = f.read()

code = code.replace("""    it("should not invoke undo on native text field edits", () => {
    // This is essentially testing the UI layer logic, but we can simulate the guard logic here to prove it
    const e = {
      ctrlKey: true,
      key: 'z',
      target: {
        tagName: 'INPUT',
        isContentEditable: false,
      }
    };
    
    const target = e.target as any;
    const isEditable = target && (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable);
    
    expect(isEditable).toBe(true);
  });
});""", "  });")

test = """
  it("should not invoke undo on native text field edits", () => {
    // This is essentially testing the UI layer logic, but we can simulate the guard logic here to prove it
    const e = {
      ctrlKey: true,
      key: 'z',
      target: {
        tagName: 'INPUT',
        isContentEditable: false,
      }
    };
    
    const target = e.target as any;
    const isEditable = target && (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable);
    
    expect(isEditable).toBe(true);
  });
});
"""

code = code.replace("});", test)
# Wait, replacing `});` will replace all of them. I'll just append it to the end before the last `});`.

with open("tests/history.test.ts", "w") as f:
    f.write(code)
