-- Arranges the mounted read-write disk image so opening the .dmg shows the app
-- and the /Applications symlink side by side, with the drag between them the
-- obvious thing to do. Icon positions live in the volume's .DS_Store, and only
-- Finder writes that file, so this has to go through Finder rather than hdiutil.
--
-- Called from the Makefile's dmg target with the volume name as the argument;
-- run by hand as: osascript dmg-layout.applescript 9film

on run argv
	set volumeName to item 1 of argv

	tell application "Finder"
		tell disk volumeName
			open

			-- Icon view, no chrome: the toolbar and sidebar would push the two
			-- icons off-centre and give the window a file-manager feel.
			set current view of container window to icon view
			set toolbar visible of container window to false
			set statusbar visible of container window to false
			set the bounds of container window to {200, 150, 800, 550}

			set viewOptions to the icon view options of container window
			set arrangement of viewOptions to not arranged
			set icon size of viewOptions to 104
			set text size of viewOptions to 12

			-- Same y, so the drag is a straight horizontal line.
			set position of item "9film.app" of container window to {150, 190}
			set position of item "Applications" of container window to {450, 190}

			update without registering applications
			close
		end tell
	end tell

	-- Finder writes .DS_Store lazily; without this the image is often detached
	-- before the layout has been flushed and the next mount shows defaults.
	delay 2
end run
