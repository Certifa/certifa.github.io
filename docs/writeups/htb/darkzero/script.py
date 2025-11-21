import re
with open("README.md") as f:
    txt = f.read()
txt = re.sub(r'!\[([^\]]*)\]\((?:docs/)?([^\)]+)\)', r'![](\.\./\.\./\.\./assets/writeups/darkzero/\2)', txt)
with open("README.fixed.md", "w") as f:
    f.write(txt)
