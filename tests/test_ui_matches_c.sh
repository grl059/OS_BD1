#!/bin/sh
# Needs node. Extracts the ENGINE block from docs/ui/index.html and compares with the C program.
python3 - <<'PY'
s=open('docs/ui/index.html').read()
e=s.split('/* ===== ENGINE')[1].split('/* ===== UI')[0].replace('document.getElementById&&draw&&draw();','')
open('/tmp/engine.js','w').write('/* ENGINE'+e+"\nconst fs=require('fs');reset();for(const l of fs.readFileSync(process.argv[2],'utf8').split('\\n')){const r=exec(l);if(r!==null)console.log(r);}\n")
PY
for t in textbook all_structures errors; do node /tmp/engine.js examples/$t.txt | diff -q - tests/expected_$t.out >/dev/null && echo "PASS ui==c $t" || echo "FAIL ui!=c $t"; done
