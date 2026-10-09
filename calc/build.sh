#!/bin/sh

bun build ./common.ts --target=browser --format=iife --minify --sourcemap=external --outdir=. --entry-naming='[name].min.js'
