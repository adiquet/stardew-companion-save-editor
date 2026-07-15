"""Dump field/property declaration order for Stardew GameData classes.

Reads .NET metadata tables directly from StardewValley.GameData.dll (via
dnfile), which is the ground truth for XNB reflective serialization order.
Emits JSON: { className: [ {name, kind} ... ] } in metadata order.

Usage: python tools/dump-gamedata-layout.py "<game dir>" Class1 Class2 ...
"""
import json
import sys

import dnfile

game_dir = sys.argv[1]
wanted = set(sys.argv[2:])

pe = dnfile.dnPE(game_dir + r"\StardewValley.GameData.dll")
md = pe.net.mdtables

typedefs = md.TypeDef.rows
fields = md.Field.rows
props = md.Property.rows if md.Property else []
methods = md.MethodDef.rows

# PropertyMap links TypeDef -> property list ranges
prop_map = md.PropertyMap.rows if md.PropertyMap else []

def idx(ref):
    """dnfile represents table indices as [MDTableIndex] lists."""
    if isinstance(ref, list):
        return ref[0].row_index if ref else None
    return ref.row_index if ref is not None else None


out = {}
for i, td in enumerate(typedefs):
    full = f"{td.TypeNamespace}.{td.TypeName}" if td.TypeNamespace else td.TypeName
    if wanted and full not in wanted:
        continue
    members = []
    # fields: range from this typedef's FieldList to the next typedef's
    start = idx(td.FieldList)
    nxt = idx(typedefs[i + 1].FieldList) if i + 1 < len(typedefs) else None
    start = (start - 1) if start else len(fields)
    end = (nxt - 1) if nxt else len(fields)
    for f in fields[start:end]:
        members.append({"name": str(f.Name), "kind": "field"})
    # properties via PropertyMap
    for j, pm in enumerate(prop_map):
        if idx(pm.Parent) - 1 != i:
            continue
        pstart = idx(pm.PropertyList) - 1
        pend = (idx(prop_map[j + 1].PropertyList) - 1) if j + 1 < len(prop_map) else len(props)
        for p in props[pstart:pend]:
            members.append({"name": str(p.Name), "kind": "property"})
    out[full] = members

print(json.dumps(out, indent=1))
