- Complete keyboard navigation
- Show what folder you're in
- Show the video runtime. No need to show folder runtimes. Those would be depressing
- Better icon
- Parse the filename better... Sometimes the "s04e12" is parsed away, sometimes it is left alone
- Use svelte as a front-end lib instead of my hand-rolled garbage
- Browse button is broken?
- Use windows built-in icons??? https://www.electronjs.org/docs/api/app#appgetfileiconpath-options
- Improve icon handling:
	- https://www.electronjs.org/docs/api/browser-window#new-browserwindowoptions (ctrl+f "icon")
	- https://www.electronjs.org/docs/api/native-image
- Star a folder which makes it also show up at the top of that folder



- Make my own video player inside the application
	- If a video is half-played, then re-start the video where it was left off
	- Fullscreen mode
	- If 90% played then mark as fully played? (Or if they click the >| button)
	- If I do this, I should maybe find a decent simple video player that already exists, and hoist that
-- OR --
- Make a timer on the modal, and only mark a video as "watched" if it has been playing for 15 minutes or more
