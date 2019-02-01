# 1.0.0


- Then release a MVP (min viable prod)

# Future

- Get rid of top menu bar. Or add controls to it? (e.g. mark all in current dir as watched/unwatched, and change dir)
- Add button to modal to close VLC
- Color code the xxx/yyy progress text, to show if completed, in progress, or watched
- Replace annoying file names with human-readable names
	- Get rid of the file extension
	- If there is a dot or dash separator, replace it with a space
	- If it has `DVDRip`, or similar, delete everything after it
	- Examples:
		- `Psych.S07E01.HDTV.x264-2HD.mp4` -> `Psych S07E01`
		- `Andromeda.S01E01.Under.The.Night.DVDRip.XviD-N-(Rus.Eng)_(from_www.FTP85.ru).avi` -> `Andromeda S01E01 Under The Night`
		- `Chuck 01x01 - Pilot.avi` -> `Chuck 01x01 - Pilot`
		- `01-Yesterday's Jam.avi` -> `01-Yesterday's Jam`
