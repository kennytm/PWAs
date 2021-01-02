common.min.js: common.js
	terser --compress --mangle --mangle-props keep_quoted --ecma 2015 --toplevel --source-map --output $@ -- $<

common.js: common.ts
	tsc -t ES2015 --removeComments --strict --outFile $@ $<
