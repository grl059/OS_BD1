#!/bin/sh
# LaTeX эх кодоос PDF үүсгэх: docs/report_src/latex/build/
set -eu
cd "$(dirname "$0")"

for dir in "$HOME/Library/TinyTeX/bin/universal-darwin" \
           "$HOME/.TinyTeX/bin/x86_64-linux" \
           "$HOME/.TinyTeX/bin/aarch64-linux"; do
  [ -d "$dir" ] && PATH="$dir:$PATH"
done
command -v xelatex >/dev/null 2>&1 || {
  echo "xelatex олдсонгүй. TinyTeX эсвэл TeX Live суулгана уу." >&2
  exit 1
}

mkdir -p build

build() {
  src=$1
  name=$2
  for _ in 1 2 3; do
    xelatex -interaction=nonstopmode -halt-on-error \
            -output-directory=build -jobname="$name" "$src.tex" >/dev/null || {
      echo "---- $src.tex алдаа ----" >&2
      tail -40 "build/$name.log" >&2
      exit 1
    }
  done
  echo "OK build/$name.pdf"
}

build report V-1-4_BD1_Report
build manual V-1-4_Manual
