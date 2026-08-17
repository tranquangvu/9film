.PHONY: dev build dmg frontend-dev frontend-build clean

WEB := ../web

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
#
# The image is staged rather than built straight from the .app, because the
# whole point of a disk image is the drag: the staging folder holds the bundle
# next to a symlink to /Applications, so opening the volume shows both and the
# install is one gesture. A symlink is what a .app can be dropped *onto* —
# Finder resolves it to the real folder — and hdiutil copies it in as a link.
#
# That drag only reads as an instruction if the two icons sit side by side, and
# icon positions live in the volume's .DS_Store, which only Finder writes. So
# the image is built read-write first, mounted, arranged by AppleScript, then
# converted to the compressed read-only image people download. Automating
# Finder needs the terminal to hold Automation permission; if it is refused the
# arrange step is skipped and the .dmg still ships, just with default layout.
dmg: build
	rm -rf build/dmg && mkdir -p build/dmg
	cp -R build/bin/9film.app build/dmg/9film.app
	ln -s /Applications build/dmg/Applications
	rm -f build/bin/9film.dmg build/9film-rw.dmg
	hdiutil create -volname 9film -srcfolder build/dmg -ov -fs HFS+ -format UDRW build/9film-rw.dmg
	hdiutil resize -size 400m build/9film-rw.dmg
	set -e; \
	device=$$(hdiutil attach -readwrite -noverify -noautoopen build/9film-rw.dmg | grep '^/dev/' | head -1 | awk '{print $$1}'); \
	osascript dmg-layout.applescript 9film || echo "dmg: skipping Finder layout (Automation permission not granted)"; \
	sync; \
	hdiutil detach "$$device" -quiet
	hdiutil convert build/9film-rw.dmg -format UDZO -imagekey zlib-level=9 -ov -o build/bin/9film.dmg
	rm -rf build/9film-rw.dmg build/dmg

# The two targets below back wails.json's frontend:* hooks. Wails execs those
# directly — no shell, so no env prefixes and no && — and both need a shell, so
# they live here as recipes rather than as desktop-only scripts in web/. Wails
# kills the whole process group, so the extra make layer still shuts down with
# the dev server.

# The desktop build of the frontend: VITE_DESKTOP flips utils/desktop.ts over to
# the injected apiOrigin. //go:embed can't cross .., so the bundle is copied in
# here; .gitkeep is restored because the tracked directory is what lets the
# embed compile before anyone has built the frontend.
frontend-build:
	cd $(WEB) && VITE_DESKTOP=1 pnpm build
	rm -rf dist
	cp -R $(WEB)/dist dist
	touch dist/.gitkeep

# The Vite dev server in desktop mode. Wails scans its stdout for the server URL
# (frontend:dev:serverUrl "auto"), so this must stay in the foreground.
frontend-dev:
	cd $(WEB) && VITE_DESKTOP=1 pnpm dev

clean:
	rm -rf build/bin build/dmg build/9film-rw.dmg dist
	mkdir -p dist && touch dist/.gitkeep
