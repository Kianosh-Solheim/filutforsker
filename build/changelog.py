"""Henter avsnittet for én versjon fra CHANGELOG.md (overskrift «## 1.2.3»)."""
import re
import sys

text = open(sys.argv[1], encoding="utf-8").read()
version = sys.argv[2]
m = re.search(rf"^## +v?{re.escape(version)}\b.*?$\n(.*?)(?=^## |\Z)", text, re.M | re.S)
print(m.group(1).strip() if m else f"Filutforsker {version}")
