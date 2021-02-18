all: common.min.js

%.min.js: %.js
	terser --compress --mangle --mangle-props keep_quoted --ecma 2015 --toplevel --source-map --output $@ -- $<

%.js: %.ts
	tsc -t ES2015 --removeComments --strict --outFile $@ $<
