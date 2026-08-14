.PHONY: dev build dmg clean

# The app icon: wails reads build/appicon.png alone and generates the whole
# 16–1024 icns ladder from it. build/appicon.svg is the drawing it was
# rasterised from — re-export at 1024x1024 to change the icon.

# -skipbindings everywhere: wails generates JS bindings by *running* the built
# binary, which would open the database and bind the port mid-build. Nothing is
# passed to options.Bind, so there is nothing to generate.

# Runs the Vite dev server (web/) and the Go side together; the window reloads
# on frontend edits and rebuilds on Go edits.
dev:
	wails dev -skipbindings

# Universal so the .app runs on both Apple Silicon and Intel. The ad-hoc
# signature is what stops macOS calling an unsigned arm64 bundle "damaged" —
# it is not a Developer ID signature, so Gatekeeper still asks on first open.
build:
	wails build -platform darwin/universal -clean -skipbindings -ldflags "-s -w"
	codesign --force --deep --sign - build/bin/9film.app

# hdiutil ships with macOS, so packaging needs nothing installed.
dmg: build
	hdiutil create -volname 9film -srcfolder build/bin/9film.app -ov -format UDZO build/bin/9film.dmg

clean:
	rm -rf build/bin dist
	mkdir -p dist && touch dist/.gitkeep
